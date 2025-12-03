# Variables for API Gateway Module

variable "project_name" {
  description = "Name of the project"
  type        = string
}

variable "environment" {
  description = "Environment (dev, prod)"
  type        = string
}

variable "stage_name" {
  description = "API Gateway stage name"
  type        = string
  default     = "prod"
}

variable "api_gateway_type" {
  description = "API Gateway endpoint type"
  type        = string
  default     = "REGIONAL"
  validation {
    condition     = contains(["PRIVATE", "REGIONAL", "EDGE"], var.api_gateway_type)
    error_message = "API Gateway type must be PRIVATE, REGIONAL, or EDGE."
  }
}

variable "vpc_endpoint_id" {
  description = "VPC Endpoint ID for API Gateway (required only for PRIVATE type)"
  type        = string
  default     = null
}

variable "admin_portal_lambda_invoke_arn" {
  description = "Invoke ARN for admin portal Lambda function"
  type        = string
}

variable "admin_backend_lambda_invoke_arn" {
  description = "Invoke ARN for admin backend Lambda function"
  type        = string
}

variable "admin_portal_lambda_function_name" {
  description = "Name of the admin portal Lambda function"
  type        = string
}

variable "admin_backend_lambda_function_name" {
  description = "Name of the admin backend Lambda function"
  type        = string
}

variable "common_tags" {
  description = "Common tags to apply to all resources"
  type        = map(string)
  default     = {}
}

# JWT Authorizer Configuration
variable "enable_jwt_authorizer" {
  description = "Enable JWT authorizer for API Gateway"
  type        = bool
  default     = false
}

variable "jwt_authorizer_lambda_invoke_arn" {
  description = "Invoke ARN for JWT authorizer Lambda function"
  type        = string
  default     = ""
}

variable "jwt_authorizer_lambda_function_name" {
  description = "Name of the JWT authorizer Lambda function"
  type        = string
  default     = ""
}

# IMS Service Configuration
variable "ims_service_lambda_invoke_arn" {
  description = "Invoke ARN for IMS service Lambda function"
  type        = string
  default     = ""
}

variable "ims_service_lambda_function_name" {
  description = "Name of the IMS service Lambda function"
  type        = string
  default     = ""
}

# OMS Service Configuration
variable "oms_service_lambda_invoke_arn" {
  description = "Invoke ARN for OMS service Lambda function"
  type        = string
  default     = ""
}

variable "oms_service_lambda_function_name" {
  description = "Name of the OMS service Lambda function"
  type        = string
  default     = ""
}