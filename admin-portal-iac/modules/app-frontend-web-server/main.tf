# App Frontend Web Server Lambda Module
# Serves React/Next.js UI from S3 bucket

data "aws_caller_identity" "current" {}
data "aws_region" "current" {}

locals {
  function_name = "app-fe-${var.environment}-web-server"
}

# Lambda function for serving frontend from S3
resource "aws_lambda_function" "app_frontend_web_server" {
  function_name = local.function_name
  role          = aws_iam_role.lambda_execution_role.arn
  handler       = "index.handler"
  runtime       = var.runtime
  timeout       = var.timeout
  memory_size   = var.memory_size

  filename         = "${path.root}/lambda-packages/app-frontend-web-server.zip"
  source_code_hash = fileexists("${path.root}/lambda-packages/app-frontend-web-server.zip") ? filebase64sha256("${path.root}/lambda-packages/app-frontend-web-server.zip") : null

  environment {
    variables = {
      NODE_ENV       = var.environment
      S3_BUCKET_NAME = var.s3_bucket_name
      LOG_LEVEL      = var.log_level
    }
  }

  tags = merge(var.common_tags, {
    Name    = local.function_name
    Purpose = "AppFrontendWebServer"
  })

  depends_on = [
    aws_iam_role_policy_attachment.lambda_basic_execution,
    aws_iam_role_policy.lambda_s3_policy,
    aws_cloudwatch_log_group.lambda_logs
  ]

  lifecycle {
    ignore_changes = [
      filename,
      source_code_hash,
    ]
  }
}

# IAM role for Lambda
resource "aws_iam_role" "lambda_execution_role" {
  name = "${local.function_name}-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Action = "sts:AssumeRole"
      Effect = "Allow"
      Principal = {
        Service = "lambda.amazonaws.com"
      }
    }]
  })

  tags = var.common_tags
}

# Basic Lambda execution policy
resource "aws_iam_role_policy_attachment" "lambda_basic_execution" {
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
  role       = aws_iam_role.lambda_execution_role.name
}

# S3 access policy
resource "aws_iam_role_policy" "lambda_s3_policy" {
  name = "${local.function_name}-s3-policy"
  role = aws_iam_role.lambda_execution_role.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect = "Allow"
      Action = [
        "s3:GetObject",
        "s3:ListBucket"
      ]
      Resource = [
        "arn:aws:s3:::${var.s3_bucket_name}",
        "arn:aws:s3:::${var.s3_bucket_name}/*"
      ]
    }]
  })
}

# CloudWatch Log Group
resource "aws_cloudwatch_log_group" "lambda_logs" {
  name              = "/aws/lambda/${local.function_name}"
  retention_in_days = var.log_retention_days

  tags = var.common_tags
}

