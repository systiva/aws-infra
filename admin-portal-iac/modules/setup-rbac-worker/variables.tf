# Variables for Setup RBAC Worker Lambda

variable "project_name" {
  description = "Name of the project"
  type        = string
}

variable "environment" {
  description = "Environment (dev, prod)"
  type        = string
}

variable "runtime" {
  description = "Lambda runtime"
  type        = string
  default     = "nodejs18.x"
}

variable "timeout" {
  description = "Lambda timeout in seconds"
  type        = number
  default     = 180
}

variable "memory_size" {
  description = "Lambda memory size in MB"
  type        = number
  default     = 256
}

variable "log_retention_days" {
  description = "CloudWatch log retention in days"
  type        = number
  default     = 14
}

variable "enable_xray" {
  description = "Enable X-Ray tracing"
  type        = bool
  default     = true
}

# DynamoDB Configuration
variable "ims_lambda_function_name" {
  description = "Name of the IMS Lambda function to invoke"
  type        = string
}

variable "ims_lambda_arn" {
  description = "ARN of the IMS Lambda function for IAM permissions"
  type        = string
}

variable "ims_timeout" {
  description = "IMS Lambda invocation timeout in milliseconds"
  type        = number
  default     = 30000
}

# VPC Configuration (optional)
variable "vpc_config" {
  description = "VPC configuration for Lambda"
  type = object({
    subnet_ids         = list(string)
    security_group_ids = list(string)
  })
  default = null
}

# Tags
variable "common_tags" {
  description = "Common tags to apply to all resources"
  type        = map(string)
  default     = {}
}
