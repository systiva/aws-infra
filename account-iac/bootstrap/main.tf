# Bootstrap Infrastructure for Account Account
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

# AWS Provider with account profile
provider "aws" {
  region = var.aws_region
  
  # Only use profile for local development
  # GitHub Actions and CI/CD use environment variables
  profile = var.account_aws_profile != "default" ? var.account_aws_profile : null
}

# Random suffix for unique resource names - keepers ensure same suffix for same workspace
resource "random_id" "suffix" {
  byte_length = 4
  
  keepers = {
    # Ensures the same suffix is generated for the same workspace and accounts
    workspace        = var.workspace_prefix
    admin_account_id = var.admin_account_id
  }
}

# Get current account ID to validate
data "aws_caller_identity" "current" {}
data "aws_region" "current" {}

locals {
  current_account_id = data.aws_caller_identity.current.account_id
  admin_account_id   = var.admin_account_id
  account_account_id  = data.aws_caller_identity.current.account_id  # Auto-detect from credentials
  is_same_account    = local.admin_account_id == local.account_account_id
  
  workspace_prefix = var.workspace_prefix
  name_prefix      = "${local.workspace_prefix}-account-infra"
  
  common_tags = {
    Workspace         = local.workspace_prefix
    Environment       = var.environment
    Project           = "account-infra"
    AccountId         = local.current_account_id
    AccountType       = local.is_same_account ? "admin-account-shared" : "account-only"
    ManagedBy         = "terraform"
    Component         = "account-bootstrap"
  }
}

# Conditional S3 Bucket - Only if different account
resource "aws_s3_bucket" "account_terraform_state" {
  count         = local.is_same_account ? 0 : 1
  bucket        = "${var.project_name}-${local.workspace_prefix}-account-terraform-state-${local.account_account_id}-${random_id.suffix.hex}"
  force_destroy = true  # Allow Terraform to delete bucket even if not empty

  tags = merge(local.common_tags, {
    Name    = "${local.name_prefix}-terraform-state"
    Purpose = "Account Terraform State Storage"
  })
}

resource "aws_s3_bucket_versioning" "account_terraform_state" {
  count  = local.is_same_account ? 0 : 1
  bucket = aws_s3_bucket.account_terraform_state[0].id
  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "account_terraform_state" {
  count  = local.is_same_account ? 0 : 1
  bucket = aws_s3_bucket.account_terraform_state[0].id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
    bucket_key_enabled = true
  }
}

# Conditional DynamoDB Lock Table - Only if different account  
resource "aws_dynamodb_table" "account_terraform_lock" {
  count        = local.is_same_account ? 0 : 1
  name         = "${var.project_name}-${local.workspace_prefix}-account-terraform-lock"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "LockID"

  attribute {
    name = "LockID"
    type = "S"
  }

  tags = merge(local.common_tags, {
    Name    = "${local.name_prefix}-terraform-lock"
    Purpose = "Account Terraform State Locking"
  })
}

# Generate backend configuration file
resource "local_file" "backend_config" {
  filename = "../backend-${var.workspace_prefix}.conf"
  content = local.is_same_account ? templatefile("${path.module}/templates/same-account-backend.conf.tpl", {
    admin_bucket     = "${var.workspace_prefix}-admin-portal-terraform-state-${var.admin_account_id}"
    admin_lock_table = "${var.workspace_prefix}-admin-portal-terraform-lock-${var.admin_account_id}"
    aws_region       = var.aws_region
  }) : templatefile("${path.module}/templates/separate-account-backend.conf.tpl", {
    account_bucket     = aws_s3_bucket.account_terraform_state[0].bucket
    account_lock_table = aws_dynamodb_table.account_terraform_lock[0].name
    aws_region        = var.aws_region
  })
}

# Store bootstrap outputs in SSM Parameter Store
module "bootstrap_ssm_outputs" {
  source = "../../admin-portal-iac/modules/ssm-outputs"
  
  workspace    = var.workspace_prefix
  account_type = "account"
  category     = "bootstrap"
  aws_region   = var.aws_region
  
  outputs = {
    backend-bucket     = local.is_same_account ? "${var.workspace_prefix}-admin-portal-terraform-state-${var.admin_account_id}" : aws_s3_bucket.account_terraform_state[0].id
    backend-bucket-arn = local.is_same_account ? "shared-with-admin" : aws_s3_bucket.account_terraform_state[0].arn
    dynamodb-table     = local.is_same_account ? "${var.workspace_prefix}-admin-portal-terraform-lock-${var.admin_account_id}" : aws_dynamodb_table.account_terraform_lock[0].id
    dynamodb-table-arn = local.is_same_account ? "shared-with-admin" : aws_dynamodb_table.account_terraform_lock[0].arn
    account-id         = local.account_account_id
    region             = var.aws_region
    status             = "completed"
  }
  
  depends_on = [
    aws_s3_bucket.account_terraform_state,
    aws_dynamodb_table.account_terraform_lock
  ]
}