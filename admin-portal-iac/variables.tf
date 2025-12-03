# Variables for admin portal infrastructure

# Workspace Configuration
variable "workspace_prefix" {
  description = "Workspace prefix for resource naming (dev|qa|prd|uat)"
  type        = string
  
  validation {
    condition     = contains(["dev", "qa", "prd", "uat"], var.workspace_prefix)
    error_message = "Workspace prefix must be one of: dev, qa, prd, uat."
  }
}

# Account Configuration
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

variable "aws_region" {
  description = "AWS region for resources"
  type        = string
  default     = "us-east-1"
}

variable "aws_profile" {
  description = "AWS profile to use for authentication"
  type        = string
  default     = "admin"
}

variable "project_name" {
  description = "Project name for resource naming"
  type        = string
  default     = "admin-portal"
}

variable "environment" {
  description = "Environment name (dev, staging, prod)"
  type        = string
  default     = "dev"
  
  validation {
    condition     = contains(["dev", "staging", "prod"], var.environment)
    error_message = "Environment must be dev, staging, or prod."
  }
}

# Networking Configuration
variable "vpc_cidr" {
  description = "CIDR block for VPC"
  type        = string
  default     = "10.1.0.0/16"
}

variable "public_subnet_cidrs" {
  description = "CIDR blocks for public subnets"
  type        = list(string)
  default     = ["10.1.1.0/24", "10.1.2.0/24"]
}

variable "private_subnet_cidrs" {
  description = "CIDR blocks for private subnets"
  type        = list(string)
  default     = ["10.1.11.0/24", "10.1.12.0/24"]
}

variable "enable_nat_gateway" {
  description = "Enable NAT Gateway for private subnet internet access"
  type        = bool
  default     = true
}

variable "enable_flow_logs" {
  description = "Enable VPC Flow Logs"
  type        = bool
  default     = false
}

variable "enable_dns_hostnames" {
  description = "Enable DNS hostnames in VPC"
  type        = bool
  default     = true
}

variable "enable_dns_support" {
  description = "Enable DNS support in VPC"
  type        = bool
  default     = true
}

# Lambda Configuration
variable "lambda_runtime" {
  description = "Runtime for Lambda functions"
  type        = string
  default     = "nodejs18.x"
}

variable "lambda_timeout" {
  description = "Timeout for Lambda functions in seconds"
  type        = number
  default     = 30
}

variable "lambda_memory_size" {
  description = "Memory size for Lambda functions in MB"
  type        = number
  default     = 512
}

# API Gateway Configuration
variable "enable_api_gateway" {
  description = "Enable API Gateway creation (disable if SCP restrictions)"
  type        = bool
  default     = false  # Set to false due to SCP restrictions
}

variable "api_gateway_type" {
  description = "Type of API Gateway (PRIVATE, REGIONAL, EDGE)"
  type        = string
  default     = "PRIVATE"
  validation {
    condition     = contains(["PRIVATE", "REGIONAL", "EDGE"], var.api_gateway_type)
    error_message = "API Gateway type must be PRIVATE, REGIONAL, or EDGE."
  }
}

variable "api_gateway_stage_name" {
  description = "API Gateway stage name"
  type        = string
  default     = "prod"
}

# S3 Configuration
variable "s3_admin_portal_bucket_name" {
  description = "Custom S3 bucket name for admin portal (leave empty for auto-generated)"
  type        = string
  default     = ""
}

# Alternative Access Method (when API Gateway is disabled)
variable "enable_lambda_function_urls" {
  description = "Enable Lambda Function URLs for direct access"
  type        = bool
  default     = true
}

variable "lambda_function_url_cors" {
  description = "CORS configuration for Lambda Function URLs"
  type = object({
    allow_credentials = bool
    allow_origins     = list(string)
    allow_methods     = list(string)
    allow_headers     = list(string)
    expose_headers    = list(string)
    max_age          = number
  })
  default = {
    allow_credentials = false
    allow_origins     = ["*"]
    allow_methods     = ["GET", "POST", "PUT", "DELETE", "OPTIONS"]
    allow_headers     = ["*"]
    expose_headers    = []
    max_age          = 300
  }
}

# VPC Endpoints Configuration
variable "enable_vpc_endpoints" {
  description = "Enable VPC endpoints for AWS services"
  type        = bool
  default     = true
}

variable "vpc_endpoint_services" {
  description = "List of AWS services to create VPC endpoints for"
  type        = list(string)
  default = [
    "s3",
    "dynamodb",
    "lambda",
    "states",  # Step Functions
    "ssm",
    "kms"
  ]
}

# External Dependencies (independent configuration)
variable "tenant_registry_table_name" {
  description = "Name of the DynamoDB tenant registry table (can be independent or reference existing)"
  type        = string
  default     = ""  # Will be auto-generated if empty
}

variable "tenant_public_table_name" {
  description = "Name of the DynamoDB table in tenant account for public tenant data"
  type        = string
  default     = "TENANT_PUBLIC"
}

variable "step_functions_arn" {
  description = "ARN of Step Functions state machine for tenant operations (optional - legacy)"
  type        = string
  default     = ""
}

variable "create_tenant_step_function_arn" {
  description = "ARN of the Create Tenant Step Functions state machine"
  type        = string
  default     = ""
}

variable "delete_tenant_step_function_arn" {
  description = "ARN of the Delete Tenant Step Functions state machine"
  type        = string
  default     = ""
}

# Create Admin Worker Configuration (Tenant Admin User Creation)
variable "ims_service_url" {
  description = "Base URL for IMS service (Identity Management Service). If enable_api_gateway is true, this is dynamically resolved from API Gateway outputs."
  type        = string
  default     = ""
}

variable "ims_timeout" {
  description = "IMS service timeout in milliseconds"
  type        = number
  default     = 30000
}

variable "tenant_platform_id" {
  description = "Platform tenant ID where admin users are created. Dynamically resolved from platform-bootstrap module."
  type        = string
  default     = "PLATFORM"
}

variable "tenant_admin_group_id" {
  description = "UUID of the tenant admin group in platform tenant. Dynamically resolved from platform-bootstrap module."
  type        = string
  default     = ""
}

# Cross-Account Access Configuration
variable "tenant_account_role_name" {
  description = "Role name to assume in tenant accounts"
  type        = string
  default     = "TenantAdminRole"
}

variable "trusted_tenant_account_ids" {
  description = "List of trusted tenant account IDs for cross-account access"
  type        = list(string)
  default     = []
}

# Monitoring and Logging
variable "enable_cloudwatch_logs" {
  description = "Enable CloudWatch logs for Lambda functions"
  type        = bool
  default     = true
}

variable "log_retention_days" {
  description = "CloudWatch logs retention period in days"
  type        = number
  default     = 14
}

variable "enable_xray_tracing" {
  description = "Enable AWS X-Ray tracing"
  type        = bool
  default     = false
}

# Security Configuration
variable "enable_waf" {
  description = "Enable AWS WAF for API protection"
  type        = bool
  default     = false  # Disabled due to API Gateway restrictions
}

# Common tags for all resources
variable "common_tags" {
  description = "Common tags to apply to all resources"
  type        = map(string)
  default = {
    ManagedBy    = "terraform"
    Owner        = "platform-team"
    CostCenter   = "engineering"
    Component    = "admin-portal"
  }
}

# Admin Account Infrastructure Reference
variable "admin_account_state_bucket" {
  description = "S3 bucket name containing admin account Terraform state"
  type        = string
  default     = ""  # Will be auto-calculated if not provided
}

variable "admin_account_state_key" {
  description = "S3 key for admin account Terraform state"
  type        = string
  default     = "admin-account-iac/terraform.tfstate"
}

# ==============================================
# Identity Management System Configuration
# ==============================================

# Cognito Configuration
variable "enable_cognito" {
  description = "Enable Cognito User Pool for authentication"
  type        = bool
  default     = true
}

variable "cognito_admin_create_user_only" {
  description = "Only allow administrators to create users in Cognito"
  type        = bool
  default     = true
}

variable "cognito_access_token_validity_minutes" {
  description = "Access token validity in minutes"
  type        = number
  default     = 60  # 1 hour
}

variable "cognito_id_token_validity_minutes" {
  description = "ID token validity in minutes"
  type        = number
  default     = 60  # 1 hour
}

variable "cognito_refresh_token_validity_days" {
  description = "Refresh token validity in days"
  type        = number
  default     = 30  # 30 days
}

variable "cognito_callback_urls" {
  description = "List of allowed callback URLs for OAuth"
  type        = list(string)
  default     = []
}

variable "cognito_logout_urls" {
  description = "List of allowed logout URLs for OAuth"
  type        = list(string)
  default     = []
}

# JWT Authorizer Configuration
variable "enable_jwt_authorizer" {
  description = "Enable JWT Authorizer Lambda for API Gateway"
  type        = bool
  default     = true
}

variable "jwt_authorizer_log_level" {
  description = "Log level for JWT Authorizer"
  type        = string
  default     = "INFO"
}

# IMS (Identity Management Service) Configuration
variable "enable_ims_service" {
  description = "Enable Identity Management Service Lambda"
  type        = bool
  default     = true
}

variable "ims_lambda_timeout" {
  description = "IMS Lambda timeout in seconds"
  type        = number
  default     = 30
}

variable "ims_lambda_memory_size" {
  description = "IMS Lambda memory size in MB"
  type        = number
  default     = 512
}

variable "ims_log_level" {
  description = "Log level for IMS Service"
  type        = string
  default     = "INFO"
}

# ==============================================
# OMS (Order Management Service) Configuration
# ==============================================

variable "enable_oms_service" {
  description = "Enable Order Management Service Lambda"
  type        = bool
  default     = true
}

variable "oms_cross_account_role_name" {
  description = "Name of the cross-account IAM role in tenant accounts for OMS"
  type        = string
  default     = "CrossAccountTenantRole"
}

variable "oms_log_level" {
  description = "Log level for OMS Service"
  type        = string
  default     = "INFO"
}

# ==============================================
# Platform Bootstrap Configuration
# ==============================================

# Platform Bootstrap Configuration
variable "enable_platform_bootstrap" {
  description = "Enable platform admin user creation and RBAC bootstrap"
  type        = bool
  default     = true
}

variable "platform_admin_email" {
  description = "Email address for the platform admin user"
  type        = string
  default     = "demo_platform_admin@platform.com"
}

variable "temporary_password" {
  description = "Temporary password for platform admin user"
  type        = string
  sensitive   = true
  
  validation {
    condition     = length(var.temporary_password) >= 8
    error_message = "Temporary password must be at least 8 characters long."
  }
}