# Variables for Platform Bootstrap module

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

# Cognito Configuration
variable "user_pool_id" {
  description = "ID of the Cognito User Pool"
  type        = string
}

# DynamoDB Configuration
variable "rbac_table_name" {
  description = "Name of the RBAC DynamoDB table"
  type        = string
}

variable "rbac_table_hash_key" {
  description = "Hash key of the RBAC DynamoDB table"
  type        = string
  default     = "PK"
}

variable "rbac_table_range_key" {
  description = "Range key of the RBAC DynamoDB table"
  type        = string
  default     = "SK"
}

# Platform Admin Configuration
variable "platform_admin_email" {
  description = "Email address for the platform admin user"
  type        = string
}

variable "platform_admin_username" {
  description = "Username for the platform admin user"
  type        = string
  default     = "admin"
}

variable "platform_admin_first_name" {
  description = "First name for the platform admin user"
  type        = string
  default     = "Demo"
}

variable "platform_admin_last_name" {
  description = "Last name for the platform admin user"
  type        = string
  default     = "Platform Admin"
}

variable "temporary_password" {
  description = "Temporary password for platform admin user"
  type        = string
  sensitive   = true
}
