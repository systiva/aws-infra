# Variables for tenant infrastructure
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

variable "tenant_id" {
  description = "Unique tenant identifier"
  type        = string
  
  validation {
    condition     = can(regex("^[a-zA-Z0-9-_]+$", var.tenant_id))
    error_message = "Tenant ID can only contain alphanumeric characters, hyphens, and underscores."
  }
}

variable "aws_region" {
  description = "AWS region for tenant resources"
  type        = string
  default     = "us-east-1"
}

variable "tenant_aws_profile" {
  description = "AWS profile for tenant account authentication"
  type        = string
  default     = "tenant"
}

variable "project_name" {
  description = "Project name for resource naming"
  type        = string
  default     = "tenant-infra"
}

variable "environment" {
  description = "Environment (dev, staging, prod)"
  type        = string
  default     = "dev"
  
  validation {
    condition     = contains(["dev", "staging", "prod"], var.environment)
    error_message = "Environment must be dev, staging, or prod."
  }
}

variable "force_bootstrap" {
  description = "Force bootstrap creation even in same account"
  type        = bool
  default     = false
}

# Common tags
variable "common_tags" {
  description = "Common tags to apply to all resources"
  type        = map(string)
  default     = {}
}