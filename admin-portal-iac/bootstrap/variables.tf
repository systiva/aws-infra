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

variable "aws_region" {
  description = "AWS region"
  type        = string
  default     = "us-east-1"
}

variable "aws_profile" {
  description = "AWS profile to use"
  type        = string
  default     = "fct_fct.admin"
}

variable "terraform_state_key" {
  description = "S3 key for Terraform state file"
  type        = string
  default     = "admin-portal-iac/terraform.tfstate"
}

variable "enable_session_storage" {
  description = "Enable DynamoDB table for admin session storage"
  type        = bool
  default     = true
}

variable "enable_step_functions" {
  description = "Enable Step Functions for tenant operations"
  type        = bool
  default     = false
}