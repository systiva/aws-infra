# SSM Outputs Module
# Automatically stores Terraform outputs in AWS Systems Manager Parameter Store

terraform {
  required_providers {
    time = {
      source  = "hashicorp/time"
      version = "~> 0.9"
    }
  }
}

locals {
  ssm_prefix = "/admin-portal/${var.workspace}/${var.account_type}/${var.category}"
  
  # Flatten nested maps for parameter creation
  flattened_outputs = {
    for key, value in var.outputs :
    replace(key, "_", "-") => (
      # Store as plain string to avoid double-quoting
      can(tostring(value)) ? tostring(value) : jsonencode(value)
    )
  }
}

# Add delay to avoid AWS SSM rate limiting
resource "time_sleep" "wait_for_rate_limit" {
  count = var.enabled ? 1 : 0
  
  create_duration = "2s"
}

# Store each output as SSM parameter
resource "aws_ssm_parameter" "outputs" {
  for_each = var.enabled ? local.flattened_outputs : {}
  
  name = "${local.ssm_prefix}/${each.key}"
  type = can(regex("(password|secret|key-id|client-id|kms-key)", each.key)) ? "SecureString" : "String"
  
  value     = tostring(each.value)
  overwrite = true
  
  # Add tags for organization
  tags = {
    Workspace   = var.workspace
    AccountType = var.account_type
    Category    = var.category
    ManagedBy   = "Terraform"
    Module      = "ssm-outputs"
  }
  
  depends_on = [time_sleep.wait_for_rate_limit]
}

# Metadata parameters
resource "aws_ssm_parameter" "deployed_at" {
  count = var.enabled ? 1 : 0
  
  name      = "${local.ssm_prefix}/metadata/deployed-at"
  type      = "String"
  value     = timestamp()
  overwrite = true
  
  tags = {
    Workspace   = var.workspace
    AccountType = var.account_type
    Category    = var.category
    ManagedBy   = "Terraform"
  }
  
  depends_on = [aws_ssm_parameter.outputs]
}

resource "aws_ssm_parameter" "version" {
  count = var.enabled ? 1 : 0
  
  name      = "${local.ssm_prefix}/metadata/version"
  type      = "String"
  value     = "1.0"
  overwrite = true
  
  tags = {
    Workspace   = var.account_type
    AccountType = var.account_type
    Category    = var.category
    ManagedBy   = "Terraform"
  }
  
  depends_on = [aws_ssm_parameter.deployed_at]
}

resource "aws_ssm_parameter" "status" {
  count = var.enabled ? 1 : 0
  
  name      = "${local.ssm_prefix}/status"
  type      = "String"
  value     = "completed"
  overwrite = true
  
  tags = {
    Workspace   = var.workspace
    AccountType = var.account_type
    Category    = var.category
    ManagedBy   = "Terraform"
  }
  
  depends_on = [aws_ssm_parameter.version]
}
