# Setup RBAC Worker Lambda Module

locals {
  function_name = "${var.project_name}-${var.environment}-setup-rbac-worker"
  
  # Lambda package path - will be created during deployment
  lambda_package_path = "${path.root}/lambda-packages/setup-rbac-worker"
}

# Data source for Lambda package
data "archive_file" "setup_rbac_worker" {
  type        = "zip"
  source_dir  = "${path.root}/../setup-rbac-worker"
  output_path = "${local.lambda_package_path}/setup-rbac-worker.zip"
  
  excludes = [
    "node_modules",
    ".git",
    ".gitignore",
    "README.md",
    "package-lock.json"
  ]
}

# IAM Role for Lambda
resource "aws_iam_role" "setup_rbac_worker_role" {
  name = "${local.function_name}-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "lambda.amazonaws.com"
        }
      }
    ]
  })

  tags = merge(var.common_tags, {
    Name    = "${local.function_name}-role"
    Purpose = "SetupRBACWorkerLambdaRole"
  })
}

# IAM Policy for Lambda execution
resource "aws_iam_role_policy" "setup_rbac_worker_policy" {
  name = "${local.function_name}-policy"
  role = aws_iam_role.setup_rbac_worker_role.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "logs:CreateLogGroup",
          "logs:CreateLogStream",
          "logs:PutLogEvents"
        ]
        Resource = "arn:aws:logs:*:*:*"
      },
      {
        Effect = "Allow"
        Action = [
          "xray:PutTraceSegments",
          "xray:PutTelemetryRecords"
        ]
        Resource = "*"
      }
    ]
  })
}

# IAM Policy for IMS Lambda Invocation
resource "aws_iam_role_policy" "lambda_invoke_ims" {
  name = "${local.function_name}-invoke-ims-policy"
  role = aws_iam_role.setup_rbac_worker_role.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = "lambda:InvokeFunction"
        Resource = var.ims_lambda_arn
      }
    ]
  })
}

# Attach VPC execution role if VPC is configured
resource "aws_iam_role_policy_attachment" "vpc_execution_role" {
  count      = var.vpc_config != null ? 1 : 0
  role       = aws_iam_role.setup_rbac_worker_role.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaVPCAccessExecutionRole"
}

# CloudWatch Log Group
resource "aws_cloudwatch_log_group" "setup_rbac_worker_logs" {
  name              = "/aws/lambda/${local.function_name}"
  retention_in_days = var.log_retention_days

  tags = merge(var.common_tags, {
    Name    = "${local.function_name}-logs"
    Purpose = "SetupRBACWorkerLogs"
  })
}

# Lambda Function
resource "aws_lambda_function" "setup_rbac_worker" {
  function_name = local.function_name
  role         = aws_iam_role.setup_rbac_worker_role.arn
  handler      = "index.handler"
  runtime      = var.runtime
  timeout      = var.timeout
  memory_size  = var.memory_size

  filename         = data.archive_file.setup_rbac_worker.output_path
  source_code_hash = data.archive_file.setup_rbac_worker.output_base64sha256

  environment {
    variables = {
      # IMS Lambda Configuration
      IMS_LAMBDA_FUNCTION_NAME = var.ims_lambda_function_name
      IMS_TIMEOUT              = var.ims_timeout
      
      # Logging
      LOG_LEVEL = "info"
    }
  }

  # VPC configuration (optional)
  dynamic "vpc_config" {
    for_each = var.vpc_config != null ? [var.vpc_config] : []
    content {
      subnet_ids         = vpc_config.value.subnet_ids
      security_group_ids = vpc_config.value.security_group_ids
    }
  }

  # X-Ray tracing
  tracing_config {
    mode = var.enable_xray ? "Active" : "PassThrough"
  }

  depends_on = [
    aws_iam_role_policy.setup_rbac_worker_policy,
    aws_iam_role_policy.lambda_invoke_ims,
    aws_cloudwatch_log_group.setup_rbac_worker_logs
  ]

  tags = merge(var.common_tags, {
    Name      = local.function_name
    Type      = "Lambda"
    Purpose   = "SetupDefaultRBAC"
    Component = "AccountProvisioning"
  })
}

# Data sources
data "aws_caller_identity" "current" {}
data "aws_region" "current" {}
