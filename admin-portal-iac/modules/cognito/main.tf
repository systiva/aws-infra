# Cognito User Pool for Admin Portal Authentication
terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

# Local values for configuration
locals {
  name_prefix = "${var.project_name}-${var.environment}"
}

# Cognito User Pool
resource "aws_cognito_user_pool" "admin_portal" {
  name = "${local.name_prefix}-admin-pool"

  # User attributes
  alias_attributes = ["email"]
  
  # Username configuration
  username_configuration {
    case_sensitive = false
  }

  # Auto-verified attributes
  auto_verified_attributes = ["email"]

  # Password policy
  password_policy {
    minimum_length                   = 12
    require_lowercase               = true
    require_numbers                 = true
    require_symbols                 = true
    require_uppercase               = true
    temporary_password_validity_days = 7
  }

  # Account recovery
  account_recovery_setting {
    recovery_mechanism {
      name     = "verified_email"
      priority = 1
    }
  }

  # User pool add-ons (MFA)
  user_pool_add_ons {
    advanced_security_mode = "ENFORCED"
  }

  # MFA configuration
  mfa_configuration = "OPTIONAL"
  
  # SMS configuration for MFA
  sms_configuration {
    external_id    = "${local.name_prefix}-sms-external-id"
    sns_caller_arn = aws_iam_role.cognito_sms_role.arn
    sns_region     = data.aws_region.current.name
  }

  # Software token MFA configuration
  software_token_mfa_configuration {
    enabled = true
  }

  # Device configuration
  device_configuration {
    challenge_required_on_new_device      = true
    device_only_remembered_on_user_prompt = true
  }

  # Email configuration
  email_configuration {
    email_sending_account = "COGNITO_DEFAULT"
  }

  # Admin create user configuration
  admin_create_user_config {
    allow_admin_create_user_only = var.admin_create_user_only
    
    invite_message_template {
      email_message = "Welcome to the Admin Portal! Your username is {username} and temporary password is {####}. Please change it on first login."
      email_subject = "Your Admin Portal Account"
      sms_message   = "Your Admin Portal username is {username} and temporary password is {####}"
    }
  }

  # Custom attributes - managed externally to avoid Cognito schema modification errors
  # Schema changes are ignored via lifecycle rule to prevent deployment issues
  
  # The following custom attributes exist in the deployed user pool:
  # - custom:tenant_id (for tenant mapping)
  # - custom:user_role (DEPRECATED - ignore in application logic)
  # - custom:permissions (DEPRECATED - ignore in application logic)

  # Verification message template
  verification_message_template {
    default_email_option = "CONFIRM_WITH_CODE"
    email_message        = "Please confirm your account with this verification code: {####}"
    email_subject        = "Verify your Admin Portal account"
  }

  tags = merge(var.common_tags, {
    Name        = "${local.name_prefix}-admin-pool"
    Component   = "Authentication"
    Purpose     = "Admin Portal User Authentication"
  })

  lifecycle {
    prevent_destroy = true
    # Ignore schema changes to prevent Cognito errors
    ignore_changes = [schema]
  }
}

# Cognito User Pool Domain
resource "aws_cognito_user_pool_domain" "admin_portal" {
  domain       = "${local.name_prefix}-admin-portal-${random_id.domain_suffix.hex}"
  user_pool_id = aws_cognito_user_pool.admin_portal.id

  depends_on = [aws_cognito_user_pool.admin_portal]
}

# Random suffix for domain uniqueness
resource "random_id" "domain_suffix" {
  byte_length = 4
}

# Cognito User Pool Client for Admin Portal
resource "aws_cognito_user_pool_client" "admin_portal_client" {
  name         = "${local.name_prefix}-admin-client"
  user_pool_id = aws_cognito_user_pool.admin_portal.id

  # Client settings
  generate_secret                      = true
  prevent_user_existence_errors       = "ENABLED"
  enable_token_revocation             = true
  enable_propagate_additional_user_context_data = true

  # Token validity
  access_token_validity  = var.access_token_validity_minutes
  id_token_validity     = var.id_token_validity_minutes
  refresh_token_validity = var.refresh_token_validity_days

  token_validity_units {
    access_token  = "minutes"
    id_token      = "minutes"
    refresh_token = "days"
  }

  # Explicit authentication flows
  explicit_auth_flows = [
    "ALLOW_ADMIN_USER_PASSWORD_AUTH",
    "ALLOW_CUSTOM_AUTH",
    "ALLOW_USER_SRP_AUTH",
    "ALLOW_REFRESH_TOKEN_AUTH"
  ]

  # OAuth 2.0 configuration
  supported_identity_providers = ["COGNITO"]

  callback_urls = var.callback_urls
  logout_urls   = var.logout_urls

  allowed_oauth_flows_user_pool_client = true
  allowed_oauth_flows                  = ["code"]
  allowed_oauth_scopes                 = ["email", "openid", "profile"]

  # Read/write attributes
  read_attributes = [
    "email",
    "email_verified",
    "custom:tenant_id",
    "custom:user_role",     # DEPRECATED: Ignore in application logic
    "custom:permissions",   # DEPRECATED: Ignore in application logic
  ]

  write_attributes = [
    "email",
    "custom:tenant_id",
    "custom:user_role",     # DEPRECATED: Ignore in application logic
    "custom:permissions",   # DEPRECATED: Ignore in application logic
  ]

  depends_on = [aws_cognito_user_pool.admin_portal]
}

# IAM role for Cognito SMS
resource "aws_iam_role" "cognito_sms_role" {
  name = "${local.name_prefix}-cognito-sms-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "cognito-idp.amazonaws.com"
        }
        Condition = {
          StringEquals = {
            "sts:ExternalId" = "${local.name_prefix}-sms-external-id"
          }
        }
      }
    ]
  })

  tags = merge(var.common_tags, {
    Name        = "${local.name_prefix}-cognito-sms-role"
    Component   = "Authentication"
    Purpose     = "Cognito SMS MFA"
  })
}

# IAM policy for SNS SMS
resource "aws_iam_role_policy" "cognito_sms_policy" {
  name = "${local.name_prefix}-cognito-sms-policy"
  role = aws_iam_role.cognito_sms_role.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "sns:Publish"
        ]
        Resource = "*"
      }
    ]
  })
}

# Data sources
data "aws_region" "current" {}
data "aws_caller_identity" "current" {}