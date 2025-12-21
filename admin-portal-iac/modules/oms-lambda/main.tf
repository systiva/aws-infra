# OMS Service Lambda Function
resource "aws_lambda_function" "oms_service" {
  filename         = "${path.module}/../../lambda-packages/oms-service.zip"
  function_name    = "oms-service-${var.environment}"
  role            = aws_iam_role.oms_lambda_role.arn
  handler         = "index.handler"
  source_code_hash = filebase64sha256("${path.module}/../../lambda-packages/oms-service.zip")
  runtime         = "nodejs18.x"
  timeout         = 30
  memory_size     = 512

  environment {
    variables = {
      NODE_ENV                          = var.environment
      AWS_ACCOUNT_ID                    = data.aws_caller_identity.current.account_id
      ACCOUNT_REGISTRY_TABLE             = var.account_registry_table_name
      CROSS_ACCOUNT_ROLE_NAME          = "${var.environment}-${var.cross_account_role_name}"
      CROSS_ACCOUNT_EXTERNAL_ID        = "account-provisioning"
      CROSS_ACCOUNT_ROLE_SESSION_NAME  = "oms-service-session"
      LOG_LEVEL                        = var.log_level
      API_PREFIX                       = "/api/v1/oms"
    }
  }

  tags = {
    Name        = "oms-service-${var.environment}"
    Environment = var.environment
    Service     = "OMS"
    ManagedBy   = "Terraform"
  }
}

# CloudWatch Log Group
resource "aws_cloudwatch_log_group" "oms_service" {
  name              = "/aws/lambda/oms-service-${var.environment}"
  retention_in_days = var.log_retention_days

  tags = {
    Name        = "oms-service-logs-${var.environment}"
    Environment = var.environment
    Service     = "OMS"
    ManagedBy   = "Terraform"
  }
}

# Lambda IAM Role
resource "aws_iam_role" "oms_lambda_role" {
  name = "oms-service-lambda-role-${var.environment}"

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

  tags = {
    Name        = "oms-service-lambda-role-${var.environment}"
    Environment = var.environment
    Service     = "OMS"
    ManagedBy   = "Terraform"
  }
}

# Lambda IAM Policy
resource "aws_iam_role_policy" "oms_lambda_policy" {
  name = "oms-service-lambda-policy-${var.environment}"
  role = aws_iam_role.oms_lambda_role.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      # CloudWatch Logs
      {
        Effect = "Allow"
        Action = [
          "logs:CreateLogGroup",
          "logs:CreateLogStream",
          "logs:PutLogEvents"
        ]
        Resource = [
          "arn:aws:logs:${var.aws_region}:${data.aws_caller_identity.current.account_id}:log-group:/aws/lambda/oms-service-${var.environment}:*"
        ]
      },
      # Account Registry DynamoDB Access
      {
        Effect = "Allow"
        Action = [
          "dynamodb:GetItem",
          "dynamodb:Query"
        ]
        Resource = [
          "arn:aws:dynamodb:${var.aws_region}:${data.aws_caller_identity.current.account_id}:table/${var.account_registry_table_name}"
        ]
      },
      # STS AssumeRole for cross-account access
      {
        Effect = "Allow"
        Action = [
          "sts:AssumeRole"
        ]
        Resource = [
          "arn:aws:iam::*:role/${var.environment}-${var.cross_account_role_name}"
        ]
      }
    ]
  })
}

# Lambda Permission for API Gateway
resource "aws_lambda_permission" "api_gateway" {
  statement_id  = "AllowAPIGatewayInvoke"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.oms_service.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${var.api_gateway_execution_arn}/*/*"
}

# Data source for current AWS account
data "aws_caller_identity" "current" {}
