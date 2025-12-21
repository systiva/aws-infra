# Variables for Bootstrap Infrastructure

variable "project_name" {
  description = "Name of the project"
  type        = string
  default     = "admin-portal"
}

variable "environment" {
  description = "Environment (dev, prod)"
  type        = string
  default     = "dev"
  
  validation {
    condition     = contains(["dev", "staging", "prod"], var.environment)
    error_message = "Environment must be dev, staging, or prod."
  }
}

variable "workspace_prefix" {
  description = "Workspace prefix for resource naming"
  type        = string
  
  validation {
    condition     = contains(["dev", "qa", "prod", "uat"], var.workspace_prefix)
    error_message = "Workspace prefix must be dev, qa, prod, or uat."
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

variable "aws_region" {
  description = "AWS region"
  type        = string
  default     = "us-east-1"
}

variable "aws_profile" {
  description = "AWS profile to use (only for local development, CI/CD uses environment variables)"
  type        = string
  default     = "default"
}

variable "enable_session_storage" {
  description = "Enable DynamoDB table for admin session storage"
  type        = bool
  default     = true
}

variable "enable_step_functions" {
  description = "Enable Step Functions for account operations"
  type        = bool
  default     = false
}