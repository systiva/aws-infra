# Variables for Cognito User Pool module

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

# User Pool Configuration
variable "admin_create_user_only" {
  description = "Only allow administrators to create users"
  type        = bool
  default     = true
}

variable "access_token_validity_minutes" {
  description = "Access token validity in minutes"
  type        = number
  default     = 60  # 1 hour
}

variable "id_token_validity_minutes" {
  description = "ID token validity in minutes"
  type        = number
  default     = 60  # 1 hour
}

variable "refresh_token_validity_days" {
  description = "Refresh token validity in days"
  type        = number
  default     = 30  # 30 days
}

# OAuth Configuration
variable "callback_urls" {
  description = "List of allowed callback URLs for OAuth"
  type        = list(string)
  default     = []
}

variable "logout_urls" {
  description = "List of allowed logout URLs for OAuth"
  type        = list(string)
  default     = []
}

# MFA Configuration
variable "enable_sms_mfa" {
  description = "Enable SMS MFA"
  type        = bool
  default     = true
}

variable "enable_software_token_mfa" {
  description = "Enable software token MFA (TOTP)"
  type        = bool
  default     = true
}