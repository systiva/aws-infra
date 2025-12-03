# Admin Portal Web Server Lambda Module
# Serves React UI and handles static file requests

# Data sources
data "aws_caller_identity" "current" {}
data "aws_region" "current" {}

# Random suffix for unique resource naming
resource "random_id" "suffix" {
  byte_length = 4
}

locals {
  function_name = "${var.project_name}-${var.environment}-web-server"
}

# Lambda function for serving React UI
resource "aws_lambda_function" "admin_portal_web_server" {
  function_name = local.function_name
  role         = aws_iam_role.lambda_execution_role.arn
  handler      = "index.handler"
  runtime      = var.runtime
  timeout      = var.timeout
  memory_size  = var.memory_size
  
  # Use local file for deployment package (temporary for infrastructure setup)
  filename         = "${path.root}/lambda-packages/admin-portal-web-server.zip"
  source_code_hash = filebase64sha256("${path.root}/lambda-packages/admin-portal-web-server.zip")

  environment {
    variables = {
      NODE_ENV                = var.environment
      LOG_LEVEL              = "info"
      S3_BUCKET_NAME         = var.portal_bucket_name  # Fixed: was PORTAL_BUCKET_NAME
      ADMIN_BACKEND_URL      = var.admin_backend_url
      CORS_ORIGIN            = "*"
      STATIC_FILES_PREFIX    = "static/"
    }
  }

  tracing_config {
    mode = var.enable_xray ? "Active" : "PassThrough"
  }

  tags = merge(var.common_tags, {
    Name        = local.function_name
    Type        = "Lambda"
    Purpose     = "AdminPortalWebServer"
    Component   = "UI"
  })

  depends_on = [
    aws_iam_role_policy_attachment.lambda_basic_execution,
    aws_iam_role_policy.lambda_custom_policy,
    aws_cloudwatch_log_group.lambda_logs
  ]
}

# S3 bucket for Lambda deployment package
resource "aws_s3_bucket" "lambda_code" {
  bucket_prefix = "admin-${var.environment}-portal-code-"
  force_destroy = true

  tags = merge(var.common_tags, {
    Name    = "${var.project_name}-${var.environment}-portal-lambda-code"
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
resource "aws_lambda_function_url" "admin_portal_web_server" {
  count              = var.enable_function_url ? 1 : 0
  function_name      = aws_lambda_function.admin_portal_web_server.function_name
  authorization_type = "NONE"  # Public access

  cors {
    allow_credentials = var.cors_config.allow_credentials
    allow_origins     = var.cors_config.allow_origins
    allow_methods     = ["GET", "POST", "PUT", "DELETE", "OPTIONS"]
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

# Custom policy for S3 access to portal bucket
resource "aws_iam_role_policy" "lambda_custom_policy" {
  name = "${local.function_name}-custom-policy"
  role = aws_iam_role.lambda_execution_role.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "s3:GetObject",
          "s3:ListBucket"
        ]
        Resource = [
          "arn:aws:s3:::${var.portal_bucket_name}",
          "arn:aws:s3:::${var.portal_bucket_name}/*"
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
      }
    ]
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