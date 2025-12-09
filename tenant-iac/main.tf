# Main Terraform configuration for tenant infrastructure
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

  backend "s3" {
    # Configuration provided via backend config file
  }
}

# AWS Provider with tenant profile
provider "aws" {
  region = var.aws_region
  
  # Only use profile for local development
  # GitHub Actions and CI/CD use environment variables
  profile = var.tenant_aws_profile != "default" ? var.tenant_aws_profile : null
}

# Get current account ID to validate we're in the right account
data "aws_caller_identity" "current" {}
data "aws_region" "current" {}

# Validation to ensure we're deploying to the correct account
resource "null_resource" "account_validation" {
  lifecycle {
    precondition {
      condition     = data.aws_caller_identity.current.account_id == var.tenant_account_id
      error_message = "Current AWS account (${data.aws_caller_identity.current.account_id}) does not match specified tenant account (${var.tenant_account_id}). Check your AWS profile configuration."
    }
  }
}

locals {
  # Account comparison logic
  admin_account_id  = var.admin_account_id
  tenant_account_id = var.tenant_account_id
  current_account   = data.aws_caller_identity.current.account_id
  is_same_account   = local.admin_account_id == local.tenant_account_id
  
  # Workspace-based naming
  workspace_prefix = var.workspace_prefix
  name_prefix = "${local.workspace_prefix}-tenant-infra"
  
  # Conditional resource creation
  should_create_cross_account_role = !local.is_same_account
  should_create_separate_state = !local.is_same_account
  
  # Validation
  account_mismatch = local.current_account != local.tenant_account_id
  
  common_tags = merge(var.common_tags, {
    Workspace         = terraform.workspace
    WorkspacePrefix   = local.workspace_prefix
    Environment       = var.environment
    Project           = var.project_name
    AdminAccount      = local.admin_account_id
    TenantAccount     = local.tenant_account_id
    TenantId          = var.tenant_id
    SameAccount       = local.is_same_account
    ComponentType     = "tenant-infrastructure"
    ManagedBy         = "terraform"
  })
}

# CrossAccountTenantRole - only for different accounts
resource "aws_iam_role" "cross_account_tenant_role" {
  count = local.should_create_cross_account_role ? 1 : 0
  name  = "${local.workspace_prefix}-CrossAccountTenantRole"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Principal = {
          AWS = "arn:aws:iam::${local.admin_account_id}:root"
        }
        Action = "sts:AssumeRole"
        Condition = {}
      }
    ]
  })

  tags = merge(local.common_tags, {
    Name         = "${local.workspace_prefix}-CrossAccountTenantRole"
    Purpose      = "Cross-account access from admin account"
    AdminAccount = local.admin_account_id
  })
}

# Full access policies for CrossAccountTenantRole
resource "aws_iam_role_policy" "cross_account_permissions" {
  count = local.should_create_cross_account_role ? 1 : 0
  name  = "CrossAccountFullAccess"
  role  = aws_iam_role.cross_account_tenant_role[0].id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "dynamodb:*",
          "s3:*", 
          "cloudformation:*",
          "logs:*"
        ]
        Resource = "*"
      }
    ]
  })
}

# Tenant-specific DynamoDB Table (Always Created)
module "tenant_dynamodb" {
  source = "./modules/dynamodb"
  
  project_name = var.project_name
  environment  = var.workspace_prefix
  
  # DynamoDB configuration
  billing_mode           = var.dynamodb_billing_mode
  point_in_time_recovery = var.point_in_time_recovery
  server_side_encryption = var.server_side_encryption
  deletion_protection    = var.deletion_protection
  
  common_tags = local.common_tags
}

# Store infrastructure outputs in SSM Parameter Store
module "infrastructure_ssm_outputs" {
  source = "../admin-portal-iac/modules/ssm-outputs"
  
  workspace    = var.workspace_prefix
  account_type = "tenant"
  category     = "infrastructure"
  aws_region   = var.aws_region
  
  outputs = {
    # DynamoDB Table
    "tenant_public_table_name" = module.tenant_dynamodb.tenant_public_table_name
    "tenant_public_table_arn"  = module.tenant_dynamodb.tenant_public_table_arn
    
    # Cross-account role (if created)
    "cross_account_role_arn" = length(aws_iam_role.cross_account_tenant_role) > 0 ? aws_iam_role.cross_account_tenant_role[0].arn : "not-created"
    
    # Metadata
    "tenant_id" = var.tenant_id
    "status"    = "completed"
  }
  
  depends_on = [
    module.tenant_dynamodb,
    aws_iam_role.cross_account_tenant_role
  ]
}