variable "environment" {
  description = "Environment name (dev, prod, etc.)"
  type        = string
}

variable "aws_region" {
  description = "AWS region"
  type        = string
  default     = "us-east-1"
}

variable "tenant_registry_table_name" {
  description = "Name of the Tenant Registry DynamoDB table"
  type        = string
}

variable "cross_account_role_name" {
  description = "Name of the cross-account IAM role in tenant accounts"
  type        = string
  default     = "OMS-CrossAccountRole"
}

variable "log_level" {
  description = "Log level for the Lambda function"
  type        = string
  default     = "info"
}

variable "log_retention_days" {
  description = "CloudWatch log retention in days"
  type        = number
  default     = 7
}

variable "api_gateway_execution_arn" {
  description = "Execution ARN of the API Gateway"
  type        = string
}
