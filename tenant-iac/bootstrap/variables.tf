variable "workspace_prefix" {
  description = "Workspace prefix for resource naming (dev|qa|prd|uat)"
  type        = string
  
  validation {
    condition     = contains(["dev", "qa", "prd", "uat"], var.workspace_prefix)
    error_message = "Workspace prefix must be one of: dev, qa, prd, uat."
  }
}

variable "admin_account_id" {
  description = "AWS account ID for admin account"
  type        = string
  
  validation {
    condition     = can(regex("^[0-9]{12}$", var.admin_account_id))
    error_message = "Admin account ID must be a 12-digit number."
  }
}

variable "tenant_account_id" {
  description = "AWS account ID for tenant account"
  type        = string
  
  validation {
    condition     = can(regex("^[0-9]{12}$", var.tenant_account_id))
    error_message = "Tenant account ID must be a 12-digit number."
  }
}

variable "tenant_aws_profile" {
  description = "AWS profile for tenant account authentication (only for local development, CI/CD uses environment variables)"
  type        = string
  default     = "default"
}

variable "aws_region" {
  description = "AWS region for tenant resources"
  type        = string
  default     = "us-east-1"
}

variable "environment" {
  description = "Environment (dev, staging, prod)"
  type        = string
  default     = "dev"
}