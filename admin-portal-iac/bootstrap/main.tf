# Bootstrap Infrastructure for Admin Portal
# Creates DynamoDB tables and other foundational resources

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

# Configure AWS Provider
provider "aws" {
  region = var.aws_region

  # Only use profile for local development
  # GitHub Actions and CI/CD use environment variables
  profile = var.aws_profile != "default" ? var.aws_profile : null
}

# Random suffix for unique resource names - keepers ensure same suffix for same workspace
resource "random_id" "suffix" {
  byte_length = 4

  keepers = {
    # Ensures the same suffix is generated for the same workspace and account
    workspace  = var.workspace_prefix
    account_id = var.admin_account_id
  }
}

# Data sources
data "aws_caller_identity" "current" {}
data "aws_region" "current" {}

locals {
  account_id  = data.aws_caller_identity.current.account_id
  region      = data.aws_region.current.name
  name_prefix = "${var.project_name}-${var.workspace_prefix}"

  # Admin DynamoDB table name: systiva-admin-{workspace}
  admin_dynamodb_name = "systiva-admin-${var.workspace_prefix}"

  # Common tags for all resources
  common_tags = {
    Environment   = var.workspace_prefix
    Project       = var.project_name
    Region        = var.aws_region
    AccountId     = local.account_id
    AdminAccountId = var.admin_account_id
    ManagedBy     = "terraform"
    Component     = "bootstrap"
    Workspace     = var.workspace_prefix
  }
}

# S3 bucket for Terraform state
resource "aws_s3_bucket" "terraform_state" {
  bucket        = "${local.name_prefix}-terraform-state-${local.account_id}-${random_id.suffix.hex}"
  force_destroy = true  # Allow Terraform to delete bucket even if not empty

  tags = merge(local.common_tags, {
    Name    = "${local.name_prefix}-terraform-state"
    Purpose = "Terraform State Storage"
    Type    = "S3Bucket"
  })
}

resource "aws_s3_bucket_versioning" "terraform_state" {
  bucket = aws_s3_bucket.terraform_state.id
  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "terraform_state" {
  bucket = aws_s3_bucket.terraform_state.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
    bucket_key_enabled = true
  }
}

resource "aws_s3_bucket_public_access_block" "terraform_state" {
  bucket = aws_s3_bucket.terraform_state.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

# DynamoDB table for Terraform state locking
resource "aws_dynamodb_table" "terraform_lock" {
  name           = "${local.name_prefix}-terraform-lock"
  billing_mode   = "PAY_PER_REQUEST"
  hash_key       = "LockID"

  attribute {
    name = "LockID"
    type = "S"
  }

  point_in_time_recovery {
    enabled = true
  }

  tags = merge(local.common_tags, {
    Name    = "${local.name_prefix}-terraform-lock"
    Purpose = "Terraform State Locking"
    Type    = "DynamoDBTable"
  })
}

# DynamoDB table for account registry (independent)
# Naming: systiva-admin-{workspace} (e.g., systiva-admin-uat)
resource "aws_dynamodb_table" "account_registry" {
  name           = local.admin_dynamodb_name
  billing_mode   = "PAY_PER_REQUEST"
  hash_key       = "PK"
  range_key      = "SK"

  attribute {
    name = "PK"
    type = "S"
  }

  attribute {
    name = "SK"
    type = "S"
  }

  point_in_time_recovery {
    enabled = true
  }

  tags = merge(local.common_tags, {
    Name    = local.admin_dynamodb_name
    Purpose = "Account Registry and Configuration"
    Type    = "DynamoDBTable"
  })
}

# Step Functions State Machine for account operations
resource "aws_sfn_state_machine" "account_operations" {
  name     = "${local.name_prefix}-account-operations"
  role_arn = aws_iam_role.step_functions.arn

  definition = jsonencode({
    Comment = "Account lifecycle operations with orchestration and admin user creation"
    StartAt = "DetermineOperation"
    States = {
      DetermineOperation = {
        Type = "Choice"
        Choices = [
          {
            Variable = "$.operation"
            StringEquals = "CREATE"
            Next = "CreateInfrastructure"
          },
          {
            Variable = "$.operation"
            StringEquals = "DELETE"
            Next = "DeleteInfrastructure"
          }
        ]
        Default = "FailOperation"
      }
      CreateInfrastructure = {
        Type = "Task"
        Resource = "arn:aws:lambda:${local.region}:${local.account_id}:function:${local.name_prefix}-create-infra-worker"
        Next = "PollInfrastructure"
        Retry = [
          {
            ErrorEquals = ["States.TaskFailed"]
            IntervalSeconds = 30
            MaxAttempts = 3
            BackoffRate = 2.0
          }
        ]
      }
      DeleteInfrastructure = {
        Type = "Task"
        Resource = "arn:aws:lambda:${local.region}:${local.account_id}:function:${local.name_prefix}-delete-infra-worker"
        Next = "PollInfrastructure"
        Retry = [
          {
            ErrorEquals = ["States.TaskFailed"]
            IntervalSeconds = 30
            MaxAttempts = 3
            BackoffRate = 2.0
          }
        ]
      }
      PollInfrastructure = {
        Type = "Task"
        Resource = "arn:aws:lambda:${local.region}:${local.account_id}:function:${local.name_prefix}-poll-infra-worker"
        Next = "CheckStatus"
        Retry = [
          {
            ErrorEquals = ["States.TaskFailed"]
            IntervalSeconds = 10
            MaxAttempts = 5
            BackoffRate = 1.5
          }
        ]
      }
      CheckStatus = {
        Type = "Choice"
        Choices = [
          {
            Variable = "$.status"
            StringEquals = "COMPLETE"
            Next = "DetermineNextStep"
          },
          {
            Variable = "$.status"
            StringEquals = "FAILED"
            Next = "FailOperation"
          },
          {
            Variable = "$.status"
            StringEquals = "IN_PROGRESS"
            Next = "WaitAndPoll"
          }
        ]
        Default = "FailOperation"
      }
      WaitAndPoll = {
        Type = "Wait"
        Seconds = 30
        Next = "PollInfrastructure"
      }
      DetermineNextStep = {
        Type = "Choice"
        Choices = [
          {
            Variable = "$.operation"
            StringEquals = "CREATE"
            Next = "SetupDefaultRBAC"
          }
        ]
        Default = "SuccessState"
      }
      SetupDefaultRBAC = {
        Type = "Task"
        Resource = "arn:aws:lambda:${local.region}:${local.account_id}:function:${local.name_prefix}-setup-rbac-worker"
        Parameters = {
          "accountId.$": "$.accountId"
        }
        ResultPath = "$.rbacSetup"
        Next = "CreateAccountAdmin"
        Retry = [
          {
            ErrorEquals = ["States.TaskFailed"]
            IntervalSeconds = 15
            MaxAttempts = 2
            BackoffRate = 2.0
          }
        ]
        Catch = [
          {
            ErrorEquals = ["States.ALL"]
            ResultPath = "$.rbacSetupError"
            Next = "RBACSetupFailed"
          }
        ]
      }
      RBACSetupFailed = {
        Type = "Pass"
        Parameters = {
          "message": "Infrastructure created successfully but RBAC setup failed",
          "infrastructureStatus": "COMPLETE",
          "rbacSetupStatus": "FAILED",
          "error.$": "$.rbacSetupError"
        }
        End = true
      }
      CreateAccountAdmin = {
        Type = "Task"
        Resource = "arn:aws:lambda:${local.region}:${local.account_id}:function:${local.name_prefix}-create-admin-worker"
        Parameters = {
          "operation": "CREATE_ADMIN",
          "accountId.$": "$.accountId",
          "accountName.$": "$.accountName",
          "firstName.$": "$.firstName",
          "lastName.$": "$.lastName",
          "adminUsername.$": "$.adminUsername",
          "adminEmail.$": "$.adminEmail",
          "adminPassword.$": "$.adminPassword",
          "createdBy.$": "$.createdBy",
          "registeredOn.$": "$.registeredOn",
          "accountAdminGroupId.$": "$.rbacSetup.accountAdminGroupId"
        }
        ResultPath = "$.adminCreation"
        Next = "SuccessState"
        Retry = [
          {
            ErrorEquals = ["States.TaskFailed"]
            IntervalSeconds = 15
            MaxAttempts = 2
            BackoffRate = 2.0
          }
        ]
        Catch = [
          {
            ErrorEquals = ["States.ALL"]
            ResultPath = "$.adminCreationError"
            Next = "AdminCreationFailed"
          }
        ]
      }
      AdminCreationFailed = {
        Type = "Pass"
        Parameters = {
          "message": "Infrastructure created successfully but account admin creation failed",
          "infrastructureStatus": "COMPLETE",
          "adminCreationStatus": "FAILED",
          "error.$": "$.adminCreationError"
        }
        End = true
      }
      SuccessState = {
        Type = "Pass"
        Result = "Operation completed successfully"
        End = true
      }
      FailOperation = {
        Type = "Fail"
        Cause = "Operation failed or invalid operation type"
      }
    }
  })

  tags = merge(local.common_tags, {
    Name    = "${local.name_prefix}-account-operations"
    Purpose = "Account Infrastructure Lifecycle Management"
    Type    = "StepFunctions"
  })
}

# IAM role for Step Functions
resource "aws_iam_role" "step_functions" {
  name = "${local.name_prefix}-step-functions-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "states.amazonaws.com"
        }
      }
    ]
  })

  tags = merge(local.common_tags, {
    Name = "${local.name_prefix}-step-functions-role"
    Type = "IAMRole"
  })
}

# Enhanced policy for Step Functions to invoke Lambda functions
resource "aws_iam_role_policy" "step_functions" {
  name = "${local.name_prefix}-step-functions-policy"
  role = aws_iam_role.step_functions.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "lambda:InvokeFunction"
        ]
        Resource = [
          "arn:aws:lambda:${local.region}:${local.account_id}:function:${local.name_prefix}-create-infra-worker",
          "arn:aws:lambda:${local.region}:${local.account_id}:function:${local.name_prefix}-delete-infra-worker",
          "arn:aws:lambda:${local.region}:${local.account_id}:function:${local.name_prefix}-poll-infra-worker",
          "arn:aws:lambda:${local.region}:${local.account_id}:function:${local.name_prefix}-setup-rbac-worker",
          "arn:aws:lambda:${local.region}:${local.account_id}:function:${local.name_prefix}-create-admin-worker"
        ]
      },
      {
        Effect = "Allow"
        Action = [
          "logs:CreateLogDelivery",
          "logs:GetLogDelivery",
          "logs:UpdateLogDelivery",
          "logs:DeleteLogDelivery",
          "logs:ListLogDeliveries",
          "logs:PutResourcePolicy",
          "logs:DescribeResourcePolicies",
          "logs:DescribeLogGroups"
        ]
        Resource = "*"
      }
    ]
  })
}

# Generate backend configuration file
resource "local_file" "backend_config" {
  filename = "../backend-${var.workspace_prefix}.conf"
  content = <<-EOF
bucket         = "${aws_s3_bucket.terraform_state.bucket}"
key            = "admin-portal-iac/terraform.tfstate"
region         = "${var.aws_region}"
dynamodb_table = "${aws_dynamodb_table.terraform_lock.name}"
encrypt        = true
EOF
}

# Store bootstrap outputs in SSM Parameter Store
module "bootstrap_ssm_outputs" {
  source = "../modules/ssm-outputs"

  workspace    = var.workspace_prefix
  account_type = "admin"
  category     = "bootstrap"
  aws_region   = var.aws_region

  outputs = {
    backend-bucket           = aws_s3_bucket.terraform_state.id
    backend-bucket-arn       = aws_s3_bucket.terraform_state.arn
    dynamodb-table           = aws_dynamodb_table.terraform_lock.id
    dynamodb-table-arn       = aws_dynamodb_table.terraform_lock.arn
    account-registry-table    = aws_dynamodb_table.account_registry.id
    account-registry-table-arn = aws_dynamodb_table.account_registry.arn
    step-functions-arn       = aws_sfn_state_machine.account_operations.arn
    step-functions-name      = aws_sfn_state_machine.account_operations.name
    region                   = var.aws_region
    status                   = "completed"
  }

  depends_on = [
    aws_s3_bucket.terraform_state,
    aws_dynamodb_table.terraform_lock,
    aws_dynamodb_table.account_registry,
    aws_sfn_state_machine.account_operations
  ]
}
