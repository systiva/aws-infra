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

variable "tenant_registry_table_name" {
  description = "Name of the tenant registry DynamoDB table"
  type        = string
}

variable "tenant_account_role_name" {
  description = "Name of the role to assume in tenant accounts"
  type        = string
  default     = "CrossAccountTenantRole"
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