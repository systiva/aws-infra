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
  region  = var.aws_region
  profile = var.aws_profile
}

# Random suffix for unique resource names
resource "random_id" "suffix" {
  byte_length = 4
}

# Data sources
data "aws_caller_identity" "current" {}
data "aws_region" "current" {}

locals {
  account_id  = data.aws_caller_identity.current.account_id
  region      = data.aws_region.current.name
  name_prefix = "${var.project_name}-${var.environment}"
  
  # Common tags for all resources
  common_tags = {
    Environment   = var.environment
    Project       = var.project_name
    Region        = var.aws_region
    AccountId     = local.account_id
    ManagedBy     = "terraform"
    Component     = "bootstrap"
  }
}

# S3 bucket for Terraform state
resource "aws_s3_bucket" "terraform_state" {
  bucket        = "${local.name_prefix}-terraform-state-${local.account_id}-${random_id.suffix.hex}"
  force_destroy = var.environment == "dev" ? true : false

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

# DynamoDB table for tenant registry (independent)
resource "aws_dynamodb_table" "tenant_registry" {
  name           = "${local.name_prefix}-tenant-registry"
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

  attribute {
    name = "GSI1PK"
    type = "S"
  }

  attribute {
    name = "GSI1SK"
    type = "S"
  }

  # Global Secondary Index for query patterns
  global_secondary_index {
    name               = "GSI1"
    hash_key           = "GSI1PK"
    range_key          = "GSI1SK"
    projection_type    = "ALL"
  }

  point_in_time_recovery {
    enabled = true
  }

  tags = merge(local.common_tags, {
    Name    = "${local.name_prefix}-tenant-registry"
    Purpose = "Tenant Registry and Configuration"
    Type    = "DynamoDBTable"
  })
}

# Step Functions State Machine for tenant operations
resource "aws_sfn_state_machine" "tenant_operations" {
  name     = "${local.name_prefix}-tenant-operations"
  role_arn = aws_iam_role.step_functions.arn

  definition = jsonencode({
    Comment = "Tenant lifecycle operations with orchestration"
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
            Next = "SuccessState"
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
    Name    = "${local.name_prefix}-tenant-operations"
    Purpose = "Tenant Infrastructure Lifecycle Management"
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
          "arn:aws:lambda:${local.region}:${local.account_id}:function:${local.name_prefix}-poll-infra-worker"
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
  filename = "../backend-${var.environment}.conf"
  content = templatefile("${path.module}/backend-config.tftpl", {
    bucket         = aws_s3_bucket.terraform_state.bucket
    key            = "admin-portal-iac/terraform.tfstate"
    region         = var.aws_region
    dynamodb_table = aws_dynamodb_table.terraform_lock.name
    profile        = var.aws_profile
  })
}

# Backend configuration template
resource "local_file" "backend_template" {
  filename = "backend-config.tftpl"
  content  = <<-EOF
bucket         = "${aws_s3_bucket.terraform_state.bucket}"
key            = "${var.terraform_state_key}"
region         = "${var.aws_region}"
dynamodb_table = "${aws_dynamodb_table.terraform_lock.name}"
encrypt        = true
profile        = "${var.aws_profile}"
EOF
}