# Poll Infrastructure Worker Lambda Function
# Handles polling tenant infrastructure status

# Data sources
data "aws_caller_identity" "current" {}
data "aws_region" "current" {}

# Random suffix for unique names
resource "random_id" "suffix" {
  byte_length = 3
}

locals {
  function_name = "${var.project_name}-${var.environment}-poll-infra-worker"
  
  common_tags = merge(var.common_tags, {
    Name    = local.function_name
    Purpose = "TenantInfrastructurePolling"
    Type    = "Lambda"
    Component = "Worker"
  })
}

# CloudWatch Log Group
resource "aws_cloudwatch_log_group" "lambda_logs" {
  name              = "/aws/lambda/${local.function_name}"
  retention_in_days = var.log_retention_days

  tags = local.common_tags
}

# Lambda Function
resource "aws_lambda_function" "poll_infra_worker" {
  function_name = local.function_name
  role          = aws_iam_role.lambda_execution_role.arn
  handler       = "index.handler"
  runtime       = var.runtime
  timeout       = var.timeout
  memory_size   = var.memory_size
  
  # Use local file for deployment package
  filename         = "${path.root}/lambda-packages/poll-infra-worker.zip"
  source_code_hash = filebase64sha256("${path.root}/lambda-packages/poll-infra-worker.zip")

  environment {
    variables = {
      NODE_ENV                   = var.environment
      LOG_LEVEL                 = var.log_level
      TENANT_REGISTRY_TABLE_NAME = var.tenant_registry_table_name
      TENANT_ACCOUNT_ROLE_NAME  = var.tenant_account_role_name
    }
  }

  tracing_config {
    mode = "PassThrough"
  }

  depends_on = [
    aws_iam_role_policy_attachment.lambda_basic_execution,
    aws_cloudwatch_log_group.lambda_logs
  ]

  tags = local.common_tags
}

# IAM role for Lambda execution
resource "aws_iam_role" "lambda_execution_role" {
  name = "${local.function_name}-execution-role"

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

  tags = merge(local.common_tags, {
    Name = "${local.function_name}-execution-role"
    Type = "IAMRole"
  })
}

# Attach basic execution role (Lambda outside VPC)
resource "aws_iam_role_policy_attachment" "lambda_basic_execution" {
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
  role       = aws_iam_role.lambda_execution_role.name
}

# Custom IAM policy for poll infra operations
resource "aws_iam_role_policy" "lambda_custom_policy" {
  name = "${local.function_name}-custom-policy"
  role = aws_iam_role.lambda_execution_role.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = concat([
      {
        Effect = "Allow"
        Action = [
          "dynamodb:*"  # Full DynamoDB access for all operations
        ]
        Resource = [
          "arn:aws:dynamodb:${data.aws_region.current.name}:${data.aws_caller_identity.current.account_id}:table/${var.tenant_registry_table_name}",
          "arn:aws:dynamodb:${data.aws_region.current.name}:${data.aws_caller_identity.current.account_id}:table/${var.tenant_registry_table_name}/index/*"
        ]
      },
      {
        Effect = "Allow"
        Action = [
          "logs:CreateLogGroup",
          "logs:CreateLogStream",
          "logs:PutLogEvents"
        ]
        Resource = "arn:aws:logs:${data.aws_region.current.name}:${data.aws_caller_identity.current.account_id}:log-group:/aws/lambda/${local.function_name}*"
      },
      {
        Effect = "Allow"
        Action = [
          "sts:AssumeRole"
        ]
        Resource = "arn:aws:iam::*:role/${var.tenant_account_role_name}"
      }
    ], var.additional_permissions)
  })
}