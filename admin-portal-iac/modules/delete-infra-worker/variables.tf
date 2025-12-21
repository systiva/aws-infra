# Variables for Delete Infrastructure Worker Lambda Module

variable "project_name" {
  description = "Name of the project"
  type        = string
}

variable "environment" {
  description = "Environment (dev, prod)"
  type        = string
}

variable "runtime" {
  description = "Lambda runtime"
  type        = string
  default     = "nodejs18.x"
}

variable "timeout" {
  description = "Lambda timeout in seconds"
  type        = number
  default     = 300
}

variable "memory_size" {
  description = "Lambda memory size in MB"
  type        = number
  default     = 512
}

variable "log_level" {
  description = "Log level for Lambda function"
  type        = string
  default     = "INFO"
}

variable "log_retention_days" {
  description = "CloudWatch log retention in days"
  type        = number
  default     = 14
}

variable "account_registry_table_name" {
  description = "Name of the account registry DynamoDB table"
  type        = string
}

variable "account_public_table_name" {
  description = "Name of the account public DynamoDB table in account account"
  type        = string
}

variable "admin_account_id" {
  description = "Admin account ID (detected from workflow)"
  type        = string
}

variable "account_account_id" {
  description = "Account account ID (detected from workflow)"
  type        = string
}

variable "cross_account_role_name" {
  description = "Cross-account role name (e.g., qa-CrossAccountAccountRole)"
  type        = string
}

variable "workspace_prefix" {
  description = "Workspace prefix (e.g., qa, dev, prod)"
  type        = string
}

variable "aws_region" {
  description = "AWS region"
  type        = string
}

variable "additional_permissions" {
  description = "Additional IAM policy statements for specific infrastructure operations"
  type        = list(object({
    Effect   = string
    Action   = list(string)
    Resource = any
  }))
  default = [
    {
      Effect = "Allow"
      Action = [
        "cloudformation:DeleteStack",
        "cloudformation:DescribeStacks",
        "cloudformation:DescribeStackEvents",
        "cloudformation:ListStackResources"
      ]
      Resource = "*"
    }
  ]
}

variable "common_tags" {
  description = "Common tags to apply to all resources"
  type        = map(string)
  default     = {}
}