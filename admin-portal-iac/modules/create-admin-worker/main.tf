# Create Admin Worker Lambda Module

locals {
  function_name = "${var.project_name}-${var.environment}-create-admin-worker"
  
  # Lambda package path - will be created during deployment
  lambda_package_path = "${path.root}/lambda-packages/create-admin-worker"
}

# Data source for Lambda package
data "archive_file" "create_admin_worker" {
  type        = "zip"
  source_dir  = "${path.root}/../create-admin-worker"
  output_path = "${local.lambda_package_path}/create-admin-worker.zip"
  
  excludes = [
    "node_modules",
    ".git",
    ".gitignore",
    "README.md",
    "package-lock.json"
  ]
}

# IAM Role for Lambda
resource "aws_iam_role" "create_admin_worker_role" {
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
    Purpose = "CreateAdminWorkerLambdaRole"
  })
}

# IAM Policy for Lambda execution
resource "aws_iam_role_policy" "create_admin_worker_policy" {
  name = "${local.function_name}-policy"
  role = aws_iam_role.create_admin_worker_role.id

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

# Attach VPC execution role if VPC is configured
resource "aws_iam_role_policy_attachment" "vpc_execution_role" {
  count      = var.vpc_config != null ? 1 : 0
  role       = aws_iam_role.create_admin_worker_role.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaVPCAccessExecutionRole"
}

# CloudWatch Log Group
resource "aws_cloudwatch_log_group" "create_admin_worker_logs" {
  name              = "/aws/lambda/${local.function_name}"
  retention_in_days = var.log_retention_days

  tags = merge(var.common_tags, {
    Name    = "${local.function_name}-logs"
    Purpose = "CreateAdminWorkerLogs"
  })
}

# Lambda Function
resource "aws_lambda_function" "create_admin_worker" {
  function_name = local.function_name
  role         = aws_iam_role.create_admin_worker_role.arn
  handler      = "index.handler"
  runtime      = var.runtime
  timeout      = var.timeout
  memory_size  = var.memory_size

  filename         = data.archive_file.create_admin_worker.output_path
  source_code_hash = data.archive_file.create_admin_worker.output_base64sha256

  environment {
    variables = {
      # IMS Service Configuration
      IMS_SERVICE_URL = var.ims_service_url
      IMS_TIMEOUT     = var.ims_timeout
      
      # Platform Tenant Configuration
      TENANT_PLATFORM_ID     = var.tenant_platform_id
      TENANT_ADMIN_GROUP_ID  = var.tenant_admin_group_id
      
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
    aws_iam_role_policy.create_admin_worker_policy,
    aws_cloudwatch_log_group.create_admin_worker_logs
  ]

  tags = merge(var.common_tags, {
    Name      = local.function_name
    Type      = "Lambda"
    Purpose   = "CreateTenantAdmin"
    Component = "TenantProvisioning"
  })
}

# Data sources
data "aws_caller_identity" "current" {}
data "aws_region" "current" {}