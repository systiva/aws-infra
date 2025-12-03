# JWT Authorizer Lambda for API Gateway
terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

# Local values
locals {
  name_prefix    = "${var.project_name}-${var.environment}"
  function_name  = "${local.name_prefix}-jwt-authorizer"
}

# IAM role for the Lambda function
resource "aws_iam_role" "jwt_authorizer_role" {
  name = "${local.name_prefix}-jwt-authorizer-role"

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
    Name        = "${local.name_prefix}-jwt-authorizer-role"
    Component   = "Authorization"
    Purpose     = "JWT Token Validation"
  })
}

# IAM policy for Lambda basic execution
resource "aws_iam_role_policy_attachment" "jwt_authorizer_basic" {
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
  role       = aws_iam_role.jwt_authorizer_role.name
}

# IAM policy for Cognito access
resource "aws_iam_role_policy" "jwt_authorizer_cognito" {
  name = "${local.name_prefix}-jwt-authorizer-cognito-policy"
  role = aws_iam_role.jwt_authorizer_role.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "cognito-idp:GetUser",
          "cognito-idp:DescribeUserPool",
          "cognito-idp:ListUsers"
        ]
        Resource = var.user_pool_arn
      }
    ]
  })
}

# CloudWatch Log Group for the Lambda function
resource "aws_cloudwatch_log_group" "jwt_authorizer_logs" {
  name              = "/aws/lambda/${local.function_name}"
  retention_in_days = var.log_retention_days

  tags = merge(var.common_tags, {
    Name        = "${local.function_name}-logs"
    Component   = "Authorization"
    Purpose     = "JWT Authorizer Logs"
  })
}

# Lambda function
resource "aws_lambda_function" "jwt_authorizer" {
  filename         = var.lambda_zip_path
  function_name    = local.function_name
  role            = aws_iam_role.jwt_authorizer_role.arn
  handler         = "index.handler"
  runtime         = var.runtime
  timeout         = var.timeout
  memory_size     = var.memory_size

  environment {
    variables = {
      USER_POOL_ID        = var.user_pool_id
      USER_POOL_CLIENT_ID = var.user_pool_client_id
      JWT_SIGNING_KEY     = var.jwt_signing_key
      LOG_LEVEL          = var.log_level
    }
  }

  depends_on = [
    aws_iam_role_policy_attachment.jwt_authorizer_basic,
    aws_iam_role_policy.jwt_authorizer_cognito,
    aws_cloudwatch_log_group.jwt_authorizer_logs
  ]

  tags = merge(var.common_tags, {
    Name        = local.function_name
    Component   = "Authorization"
    Purpose     = "JWT Token Validation"
  })
}

# Data sources
data "aws_region" "current" {}
data "aws_caller_identity" "current" {}