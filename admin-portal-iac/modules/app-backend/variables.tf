# Variables for Sys App backend module

variable "project_name" {
  description = "Project name for resource naming"
  type        = string
  default     = "sys-app"
}

variable "environment" {
  description = "Environment name (dev, staging, prod)"
  type        = string
}

variable "runtime" {
  description = "Runtime for Lambda function"
  type        = string
  default     = "nodejs18.x"
}

variable "timeout" {
  description = "Lambda function timeout in seconds"
  type        = number
  default     = 30
}

variable "memory_size" {
  description = "Lambda function memory size in MB"
  type        = number
  default     = 512
}

variable "log_level" {
  description = "Log level for the Lambda function"
  type        = string
  default     = "info"
}

variable "tenant_registry_table_name" {
  description = "Name of the DynamoDB table for tenant registry (optional)"
  type        = string
  default     = ""
}

variable "admin_account_id" {
  description = "Admin account ID (detected from workflow)"
  type        = string
}

variable "tenant_account_id" {
  description = "Tenant account ID (detected from workflow)"
  type        = string
}

variable "cross_account_role_name" {
  description = "Cross-account role name (e.g., qa-CrossAccountTenantRole)"
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

variable "trusted_tenant_account_ids" {
  description = "List of trusted tenant account IDs for cross-account access"
  type        = list(string)
  default     = []
}

variable "enable_function_url" {
  description = "Enable Lambda Function URL"
  type        = bool
  default     = true
}

variable "cors_config" {
  description = "CORS configuration for Lambda Function URL"
  type = object({
    allow_credentials = bool
    allow_origins     = list(string)
    allow_methods     = list(string)
    allow_headers     = list(string)
    expose_headers    = list(string)
    max_age          = number
  })
  default = {
    allow_credentials = false
    allow_origins     = ["*"]
    allow_methods     = ["GET", "POST", "PUT", "DELETE", "OPTIONS"]
    allow_headers     = ["*"]
    expose_headers    = []
    max_age          = 300
  }
}

variable "enable_xray" {
  description = "Enable AWS X-Ray tracing"
  type        = bool
  default     = false
}

variable "log_retention_days" {
  description = "CloudWatch logs retention period in days"
  type        = number
  default     = 14
}

variable "common_tags" {
  description = "Common tags to apply to all resources"
  type        = map(string)
  default     = {}
}
