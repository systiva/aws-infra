# Variables for SSM Outputs module

variable "workspace" {
  description = "Workspace name (dev, qa, uat, prod)"
  type        = string
  
  validation {
    condition     = contains(["dev", "qa", "uat", "prod"], var.workspace)
    error_message = "Workspace must be one of: dev, qa, uat, prod"
  }
}

variable "account_type" {
  description = "Account type (admin/account)"
  type        = string
  
  validation {
    condition     = contains(["admin", "account"], var.account_type)
    error_message = "Account type must be either 'admin' or 'account'"
  }
}

variable "category" {
  description = "Category (bootstrap/infrastructure)"
  type        = string
  
  validation {
    condition     = contains(["bootstrap", "infrastructure"], var.category)
    error_message = "Category must be either 'bootstrap' or 'infrastructure'"
  }
}

variable "outputs" {
  description = "Map of outputs to store in SSM"
  type        = map(any)
}

variable "aws_region" {
  description = "AWS region"
  type        = string
  default     = "us-east-1"
}

variable "enabled" {
  description = "Enable/disable SSM parameter creation"
  type        = bool
  default     = true
}
