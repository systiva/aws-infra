# Variables for VPC Endpoints Module

variable "project_name" {
  description = "Name of the project"
  type        = string
  default     = "admin-portal"
}

variable "environment" {
  description = "Environment (dev, qa, uat, prod)"
  type        = string
  validation {
    condition     = contains(["dev", "qa", "uat", "prod"], var.environment)
    error_message = "Environment must be one of: dev, qa, uat, prod."
  }
}

variable "vpc_id" {
  description = "ID of the VPC where endpoints will be created"
  type        = string
}

variable "private_subnet_ids" {
  description = "List of private subnet IDs for interface endpoints"
  type        = list(string)
}

variable "vpc_endpoint_services" {
  description = "List of AWS services to create VPC endpoints for"
  type        = list(string)
  default     = ["s3", "dynamodb", "lambda", "states", "ssm", "kms"]
  validation {
    condition = alltrue([
      for service in var.vpc_endpoint_services :
      contains(["s3", "dynamodb", "lambda", "states", "sts", "ssm", "kms", "execute-api"], service)
    ])
    error_message = "VPC endpoint services must be one of: s3, dynamodb, lambda, states, sts, ssm, kms, execute-api."
  }
}

variable "enable_dns_hostnames" {
  description = "Enable DNS hostnames for interface endpoints"
  type        = bool
  default     = true
}

variable "enable_dns_support" {
  description = "Enable DNS support for interface endpoints"
  type        = bool
  default     = true
}

variable "common_tags" {
  description = "Common tags to apply to all resources"
  type        = map(string)
  default     = {}
}