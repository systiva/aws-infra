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

# ==============================================
# Default Systiva Account Configuration
# ==============================================

variable "default_account_name" {
  description = "Default account name"
  type        = string
  default     = "Systiva"
}

variable "default_master_account_name" {
  description = "Default master account name"
  type        = string
  default     = "Systiva Labs Private Limited"
}

variable "default_cloud_type" {
  description = "Default cloud type (Public Cloud or Private Cloud)"
  type        = string
  default     = "Public Cloud"
}

variable "default_subscription_tier" {
  description = "Default subscription tier (public or private)"
  type        = string
  default     = "public"
}

# Default Address Configuration
variable "default_address_line1" {
  description = "Default address line 1"
  type        = string
  default     = "Hn J128 First Floor, Mayfield Gardens Sector 51, DLF Phase II, Gurgaon"
}

variable "default_address_line2" {
  description = "Default address line 2"
  type        = string
  default     = "Haryana, India, 122008"
}

variable "default_city" {
  description = "Default city"
  type        = string
  default     = "Gurgaon"
}

variable "default_state" {
  description = "Default state"
  type        = string
  default     = "Haryana"
}

variable "default_zip_code" {
  description = "Default ZIP code"
  type        = string
  default     = "122008"
}

variable "default_country" {
  description = "Default country"
  type        = string
  default     = "India"
}

# Default Technical User Configuration
variable "technical_user_first_name" {
  description = "Technical user first name"
  type        = string
  default     = "Nihar"
}

variable "technical_user_last_name" {
  description = "Technical user last name"
  type        = string
  default     = "Sharma"
}

# License Duration Configuration
variable "license_duration_years" {
  description = "License duration in years from creation date"
  type        = number
  default     = 2
}
