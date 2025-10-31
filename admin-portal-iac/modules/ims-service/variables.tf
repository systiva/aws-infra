# Variables for IMS Service module

variable "project_name" {
  description = "Project name for resource naming"
  type        = string
}

variable "environment" {
  description = "Environment name (dev, staging, prod)"
  type        = string
}

variable "common_tags" {
  description = "Common tags to apply to all resources"
  type        = map(string)
  default     = {}
}

# Lambda Configuration
variable "lambda_zip_path" {
  description = "Path to the Lambda ZIP file"
  type        = string
}

variable "handler" {
  description = "Lambda function handler"
  type        = string
  default     = "lambda.handler"
}

variable "runtime" {
  description = "Lambda runtime"
  type        = string
  default     = "nodejs18.x"
}

variable "timeout" {
  description = "Lambda timeout in seconds"
  type        = number
  default     = 30
}

variable "memory_size" {
  description = "Lambda memory size in MB"
  type        = number
  default     = 512
}

variable "log_retention_days" {
  description = "CloudWatch log retention in days"
  type        = number
  default     = 14
}

variable "log_level" {
  description = "Log level for the function"
  type        = string
  default     = "INFO"
}

variable "environment_variables" {
  description = "Additional environment variables"
  type        = map(string)
  default     = {}
}

# Function URL Configuration
variable "enable_function_url" {
  description = "Enable Lambda Function URL"
  type        = bool
  default     = false
}

# VPC Configuration
variable "vpc_config" {
  description = "VPC configuration for Lambda function"
  type = object({
    subnet_ids         = list(string)
    security_group_ids = list(string)
  })
  default = null
}

# Cognito Configuration
variable "user_pool_id" {
  description = "Cognito User Pool ID"
  type        = string
}

variable "user_pool_arn" {
  description = "Cognito User Pool ARN"
  type        = string
}

variable "user_pool_client_id" {
  description = "Cognito User Pool Client ID"
  type        = string
}

variable "user_pool_client_secret" {
  description = "Cognito User Pool Client Secret"
  type        = string
  sensitive   = true
}

# JWT Configuration
variable "jwt_signing_key" {
  description = "JWT signing key for enhanced tokens"
  type        = string
  sensitive   = true
  default     = null
}

# DynamoDB Configuration
variable "tenant_registry_table_name" {
  description = "DynamoDB table name for tenant registry"
  type        = string
}

variable "tenant_registry_table_arn" {
  description = "DynamoDB table ARN for tenant registry"
  type        = string
}