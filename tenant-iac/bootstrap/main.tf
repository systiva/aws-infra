# Bootstrap Infrastructure for Tenant Account
terraform {
  required_version = ">= 1.5"
  
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
    random = {
      source  = "hashicorp/random"
      version = "~> 3.4"
    }
  }
}

# AWS Provider with tenant profile
provider "aws" {
  region = var.aws_region
  
  # Only use profile for local development
  # GitHub Actions and CI/CD use environment variables
  profile = var.tenant_aws_profile != "default" ? var.tenant_aws_profile : null
}

# Random suffix for unique resource names
resource "random_id" "suffix" {
  byte_length = 4
}

# Get current account ID to validate
data "aws_caller_identity" "current" {}
data "aws_region" "current" {}

locals {
  current_account_id = data.aws_caller_identity.current.account_id
  admin_account_id   = var.admin_account_id
  tenant_account_id  = var.tenant_account_id
  is_same_account    = local.admin_account_id == local.tenant_account_id
  
  workspace_prefix = var.workspace_prefix
  name_prefix      = "${local.workspace_prefix}-tenant-infra"
  
  # Validation - ensure we're deploying to the intended tenant account
  account_validation_passed = local.current_account_id == local.tenant_account_id
  
  common_tags = {
    Workspace         = local.workspace_prefix
    Environment       = var.environment
    Project           = "tenant-infra"
    AccountId         = local.current_account_id
    AccountType       = local.is_same_account ? "admin-tenant-shared" : "tenant-only"
    ManagedBy         = "terraform"
    Component         = "tenant-bootstrap"
  }
}

# Account validation check
resource "null_resource" "validate_tenant_account" {
  lifecycle {
    precondition {
      condition     = local.account_validation_passed
      error_message = "ERROR: Currently authenticated to account ${local.current_account_id}, but target tenant account is ${local.tenant_account_id}. Please check your AWS profile '${var.tenant_aws_profile}' configuration."
    }
  }
}

# Conditional S3 Bucket - Only if different account
resource "aws_s3_bucket" "tenant_terraform_state" {
  count  = local.is_same_account ? 0 : 1
  bucket = "${local.workspace_prefix}-tenant-infra-terraform-state-${local.tenant_account_id}-${random_id.suffix.hex}"
  
  tags = merge(local.common_tags, {
    Name    = "${local.name_prefix}-terraform-state"
    Purpose = "Tenant Terraform State Storage"
  })
}

resource "aws_s3_bucket_versioning" "tenant_terraform_state" {
  count  = local.is_same_account ? 0 : 1
  bucket = aws_s3_bucket.tenant_terraform_state[0].id
  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "tenant_terraform_state" {
  count  = local.is_same_account ? 0 : 1
  bucket = aws_s3_bucket.tenant_terraform_state[0].id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
    bucket_key_enabled = true
  }
}

# Conditional DynamoDB Lock Table - Only if different account  
resource "aws_dynamodb_table" "tenant_terraform_lock" {
  count        = local.is_same_account ? 0 : 1
  name         = "${local.name_prefix}-terraform-lock"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "LockID"

  attribute {
    name = "LockID"
    type = "S"
  }

  tags = merge(local.common_tags, {
    Name    = "${local.name_prefix}-terraform-lock"
    Purpose = "Tenant Terraform State Locking"
  })
}

# Generate backend configuration file
resource "local_file" "backend_config" {
  filename = "../backend-${var.workspace_prefix}.conf"
  content = local.is_same_account ? templatefile("${path.module}/templates/same-account-backend.conf.tpl", {
    admin_bucket     = "${var.workspace_prefix}-admin-portal-terraform-state-${var.admin_account_id}"
    admin_lock_table = "${var.workspace_prefix}-admin-portal-terraform-lock-${var.admin_account_id}"
    aws_region       = var.aws_region
    aws_profile      = var.tenant_aws_profile
  }) : templatefile("${path.module}/templates/separate-account-backend.conf.tpl", {
    tenant_bucket     = aws_s3_bucket.tenant_terraform_state[0].bucket
    tenant_lock_table = aws_dynamodb_table.tenant_terraform_lock[0].name
    aws_region        = var.aws_region
    aws_profile       = var.tenant_aws_profile
  })
}