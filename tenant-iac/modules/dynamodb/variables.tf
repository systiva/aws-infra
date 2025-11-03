variable "workspace_prefix" {
  description = "Workspace prefix for resource naming"
  type        = string
}

variable "project_name" {
  description = "Project name"
  type        = string
}

variable "environment" {
  description = "Environment"
  type        = string
}

variable "tenant_id" {
  description = "Tenant identifier"
  type        = string
}

variable "table_name_suffix" {
  description = "Additional suffix for table names (used when admin and tenant accounts are same)"
  type        = string
  default     = ""
}

variable "common_tags" {
  description = "Common tags to apply to all resources"
  type        = map(string)
  default     = {}
}

variable "admin_account_id" {
  description = "Admin account ID for comparison"
  type        = string
}

variable "tenant_account_id" {
  description = "Tenant account ID for comparison"
  type        = string
}