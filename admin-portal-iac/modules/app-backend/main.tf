# Sys App Backend Lambda Module
# Handles API requests for Sys App - mirrors admin-backend pattern
# Source: https://github.com/tripleh1701-dev/ppp-be

# Data sources
data "aws_caller_identity" "current" {}
data "aws_region" "current" {}

# Random suffix for unique resource naming
resource "random_id" "suffix" {
  byte_length = 4
}

# Local values
locals {
  function_name = "sys-app-${var.environment}-backend"
  role_name     = "sys-app-${var.environment}-backend-execution-role"
}

# Lambda function for Sys App backend API
resource "aws_lambda_function" "app_backend" {
  function_name = local.function_name
  role         = aws_iam_role.lambda_execution_role.arn
  handler      = "index.handler"  # Updated to match consistent Lambda handler naming
  runtime      = var.runtime
  timeout      = var.timeout
  memory_size  = var.memory_size

  # Use local file for deployment package (temporary for infrastructure setup)
  filename         = "${path.root}/lambda-packages/sys-app-be.zip"
  source_code_hash = fileexists("${path.root}/lambda-packages/sys-app-be.zip") ? filebase64sha256("${path.root}/lambda-packages/sys-app-be.zip") : null

  environment {
    variables = {
      NODE_ENV                         = var.environment
      LOG_LEVEL                        = var.log_level
      ACCOUNT_REGISTRY_TABLE_NAME       = var.account_registry_table_name

      # Cross-account access configuration
      ADMIN_ACCOUNT_ID                 = var.admin_account_id
      ACCOUNT_ACCOUNT_ID                = var.account_account_id
      CROSS_ACCOUNT_ROLE_NAME          = var.cross_account_role_name
      WORKSPACE                        = var.workspace_prefix
      AWS_REGION_NAME                  = var.aws_region

      # IMS API URL for Cognito authentication
      # This allows the backend to proxy auth requests to the IMS service
      IMS_API_URL                      = var.ims_api_url
      STORAGE_MODE                     = "dynamodb"
    }
  }

  tracing_config {
    mode = var.enable_xray ? "Active" : "PassThrough"
  }

  tags = merge(var.common_tags, {
    Name      = local.function_name
    Type      = "Lambda"
    Purpose   = "SysAppBackendAPI"
    Component = "Backend"
  })

  depends_on = [
    aws_iam_role_policy_attachment.lambda_basic_execution,
    aws_iam_role_policy.lambda_custom_policy,
    aws_cloudwatch_log_group.lambda_logs
  ]

  lifecycle {
    ignore_changes = [
      filename,
      source_code_hash,
    ]
  }
}

# S3 bucket for Lambda deployment package
resource "aws_s3_bucket" "lambda_code" {
  bucket_prefix = "sys-app-${var.environment}-backend-code-"
  force_destroy = true

  tags = merge(var.common_tags, {
    Name    = "sys-app-${var.environment}-backend-lambda-code"
    Purpose = "Lambda Deployment Packages"
    Type    = "S3Bucket"
  })
}

resource "aws_s3_bucket_versioning" "lambda_code" {
  bucket = aws_s3_bucket.lambda_code.id
  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "lambda_code" {
  bucket = aws_s3_bucket.lambda_code.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

# Lambda Function URL for direct access (alternative to API Gateway)
resource "aws_lambda_function_url" "app_backend" {
  count              = var.enable_function_url ? 1 : 0
  function_name      = aws_lambda_function.app_backend.function_name
  authorization_type = "NONE"  # Public access

  cors {
    allow_credentials = var.cors_config.allow_credentials
    allow_origins     = var.cors_config.allow_origins
    allow_methods     = var.cors_config.allow_methods
    allow_headers     = var.cors_config.allow_headers
    expose_headers    = var.cors_config.expose_headers
    max_age          = var.cors_config.max_age
  }
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

  tags = merge(var.common_tags, {
    Name    = "${local.function_name}-execution-role"
    Purpose = "LambdaExecution"
    Type    = "IAMRole"
  })
}

# Attach basic Lambda execution policy
resource "aws_iam_role_policy_attachment" "lambda_basic_execution" {
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
  role       = aws_iam_role.lambda_execution_role.name
}

# Custom policy for backend operations
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
          "arn:aws:dynamodb:${data.aws_region.current.name}:${data.aws_caller_identity.current.account_id}:table/${var.account_registry_table_name}",
          "arn:aws:dynamodb:${data.aws_region.current.name}:${data.aws_caller_identity.current.account_id}:table/${var.account_registry_table_name}/index/*",
          "arn:aws:dynamodb:${data.aws_region.current.name}:${data.aws_caller_identity.current.account_id}:table/sys-app*",
          "arn:aws:dynamodb:${data.aws_region.current.name}:${data.aws_caller_identity.current.account_id}:table/sys-app*/index/*"
        ]
      },
      {
        Effect = "Allow"
        Action = [
          "s3:*"  # Full S3 access for all operations
        ]
        Resource = "*"  # Access to all S3 buckets and objects
      }],
      [{
        Effect = "Allow"
        Action = [
          "sts:AssumeRole"
        ]
        Resource = "arn:aws:iam::${var.account_account_id}:role/${var.cross_account_role_name}"
      }],
      [{
        Effect = "Allow"
        Action = [
          "logs:CreateLogGroup",
          "logs:CreateLogStream",
          "logs:PutLogEvents"
        ]
        Resource = "arn:aws:logs:${data.aws_region.current.name}:${data.aws_caller_identity.current.account_id}:log-group:/aws/lambda/${local.function_name}*"
      }]
    )
  })
}

# CloudWatch Log Group
resource "aws_cloudwatch_log_group" "lambda_logs" {
  name              = "/aws/lambda/${local.function_name}"
  retention_in_days = var.log_retention_days

  tags = merge(var.common_tags, {
    Name = "${local.function_name}-logs"
    Type = "LogGroup"
  })
}
