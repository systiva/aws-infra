# Identity Management Service (IMS) Lambda
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
  name_prefix   = "${var.project_name}-${var.environment}"
  function_name = "${local.name_prefix}-ims-service"
}

# IAM role for the IMS Lambda function
resource "aws_iam_role" "ims_service_role" {
  name = "${local.name_prefix}-ims-service-role"

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
    Name        = "${local.name_prefix}-ims-service-role"
    Component   = "IdentityManagement"
    Purpose     = "IMS Service Execution"
  })
}

# IAM policy for Lambda basic execution
resource "aws_iam_role_policy_attachment" "ims_service_basic" {
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
  role       = aws_iam_role.ims_service_role.name
}

# IAM policy for VPC access (if needed)
resource "aws_iam_role_policy_attachment" "ims_service_vpc" {
  count      = var.vpc_config != null ? 1 : 0
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaVPCAccessExecutionRole"
  role       = aws_iam_role.ims_service_role.name
}

# IAM policy for Cognito access
resource "aws_iam_role_policy" "ims_service_cognito" {
  name = "${local.name_prefix}-ims-service-cognito-policy"
  role = aws_iam_role.ims_service_role.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "cognito-idp:AdminCreateUser",
          "cognito-idp:AdminDeleteUser",
          "cognito-idp:AdminUpdateUserAttributes",
          "cognito-idp:AdminGetUser",
          "cognito-idp:AdminSetUserPassword",
          "cognito-idp:AdminSetUserMFAPreference",
          "cognito-idp:AdminListGroupsForUser",
          "cognito-idp:AdminAddUserToGroup",
          "cognito-idp:AdminRemoveUserFromGroup",
          "cognito-idp:ListUsers",
          "cognito-idp:ListGroups",
          "cognito-idp:CreateGroup",
          "cognito-idp:DeleteGroup",
          "cognito-idp:UpdateGroup",
          "cognito-idp:GetGroup",
          "cognito-idp:AdminInitiateAuth",
          "cognito-idp:AdminRespondToAuthChallenge"
        ]
        Resource = var.user_pool_arn
      }
    ]
  })
}

# IAM policy for DynamoDB access (RBAC tables)
resource "aws_iam_role_policy" "ims_service_dynamodb" {
  name = "${local.name_prefix}-ims-service-dynamodb-policy"
  role = aws_iam_role.ims_service_role.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "dynamodb:GetItem",
          "dynamodb:PutItem",
          "dynamodb:UpdateItem",
          "dynamodb:DeleteItem",
          "dynamodb:Query",
          "dynamodb:Scan"
        ]
        Resource = [
          var.tenant_registry_table_arn,
          "${var.tenant_registry_table_arn}/index/*"
        ]
      }
    ]
  })
}

# CloudWatch Log Group
resource "aws_cloudwatch_log_group" "ims_service_logs" {
  name              = "/aws/lambda/${local.function_name}"
  retention_in_days = var.log_retention_days

  tags = merge(var.common_tags, {
    Name        = "${local.function_name}-logs"
    Component   = "IdentityManagement"
    Purpose     = "IMS Service Logs"
  })
}

# Lambda function
resource "aws_lambda_function" "ims_service" {
  filename         = var.lambda_zip_path
  function_name    = local.function_name
  role            = aws_iam_role.ims_service_role.arn
  handler         = var.handler
  runtime         = var.runtime
  timeout         = var.timeout
  memory_size     = var.memory_size

  environment {
    variables = merge({
      NODE_ENV                     = var.environment
      LOG_LEVEL                   = var.log_level
      USER_POOL_ID                = var.user_pool_id
      USER_POOL_CLIENT_ID         = var.user_pool_client_id
      USER_POOL_CLIENT_SECRET     = var.user_pool_client_secret
      JWT_SIGNING_KEY             = var.jwt_signing_key
      REGION                      = data.aws_region.current.name
      TENANT_REGISTRY_TABLE_NAME  = var.tenant_registry_table_name
    }, var.environment_variables)
  }

  dynamic "vpc_config" {
    for_each = var.vpc_config != null ? [var.vpc_config] : []
    content {
      subnet_ids         = vpc_config.value.subnet_ids
      security_group_ids = vpc_config.value.security_group_ids
    }
  }

  depends_on = [
    aws_iam_role_policy_attachment.ims_service_basic,
    aws_iam_role_policy.ims_service_cognito,
    aws_iam_role_policy.ims_service_dynamodb,
    aws_cloudwatch_log_group.ims_service_logs
  ]

  tags = merge(var.common_tags, {
    Name        = local.function_name
    Component   = "IdentityManagement"
    Purpose     = "Identity and Authorization Service"
  })
}

# Lambda function URL (if enabled)
resource "aws_lambda_function_url" "ims_service_url" {
  count              = var.enable_function_url ? 1 : 0
  function_name      = aws_lambda_function.ims_service.function_name
  authorization_type = "NONE"

  cors {
    allow_credentials = true
    allow_origins     = ["*"]
    allow_methods     = ["*"]
    allow_headers     = ["date", "keep-alive"]
    expose_headers    = ["date", "keep-alive"]
    max_age          = 86400
  }
}

# Data sources
data "aws_region" "current" {}
data "aws_caller_identity" "current" {}