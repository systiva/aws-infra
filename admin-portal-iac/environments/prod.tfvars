# Production environment configuration for admin portal
aws_region  = "us-east-1"

project_name = "admin-portal"
workspace_prefix  = "prod"

# Networking Configuration - Fully Private Architecture
vpc_cidr             = "10.4.0.0/16"
public_subnet_cidrs  = []  # No public subnets needed
private_subnet_cidrs = ["10.4.11.0/24", "10.4.12.0/24"]
enable_nat_gateway   = false  # No internet access needed
enable_flow_logs     = true   # Enable flow logs for production
enable_dns_hostnames = true
enable_dns_support   = true

# Lambda Configuration
lambda_runtime     = "nodejs18.x"
lambda_timeout     = 30
lambda_memory_size = 512

# API Gateway Configuration - Using Regional API Gateway via VPC Endpoint
enable_api_gateway     = true   # Regional API Gateway accessible via VPC endpoint
api_gateway_type       = "REGIONAL"  # Regional but accessed via VPC endpoint
api_gateway_stage_name = "prod"

# Alternative Access Method (disabled due to SCP restrictions)
enable_lambda_function_urls = false  # Disabled - requires Internet Gateway

# Lambda Function URLs CORS configuration
lambda_function_url_cors = {
  allow_credentials = false
  allow_origins     = ["*"]
  allow_methods     = ["GET", "POST", "PUT", "DELETE", "OPTIONS"]
  allow_headers     = ["*"]
  expose_headers    = []
  max_age          = 300
}

# External Dependencies (using bootstrap created tables)
account_registry_table_name = ""  # Auto-generated as systiva-admin-prod from bootstrap
step_functions_arn         = ""  # Optional - legacy

# Step Functions Configuration for Account Lifecycle Management
create_account_step_function_arn = ""  # To be updated after deployment
delete_account_step_function_arn = ""  # To be updated after deployment

# VPC Endpoints Configuration
vpc_endpoint_services = [
  "s3",
  "dynamodb",
  "lambda",
  "states",  # Step Functions
  "sts",     # Security Token Service for cross-account role assumption
  "ssm",
  "kms"
]

# Cross-Account Access
account_public_table_name = ""  # Auto-generated as account-admin-public-prod
trusted_account_account_ids = [
  # Add account account IDs here when available
]

# Monitoring and Logging
enable_cloudwatch_logs = true
log_retention_days     = 90   # Longer retention for production
enable_xray_tracing    = true # Enable X-Ray tracing for production

# Security
enable_waf = false  # Disabled due to API Gateway restrictions

# S3 Configuration (empty for auto-generated bucket name)
s3_admin_portal_bucket_name = ""

# Common tags
common_tags = {
  ManagedBy    = "terraform"
  Owner        = "platform-team"
  CostCenter   = "engineering"
}

# ==============================================
# Identity Management System Configuration
# ==============================================

# Cognito Configuration
enable_cognito                           = true
cognito_admin_create_user_only          = true
cognito_access_token_validity_minutes    = 60    # 1 hour
cognito_id_token_validity_minutes        = 60    # 1 hour
cognito_refresh_token_validity_days      = 30    # 30 days

# OAuth URLs for Production (update with actual production URLs)
cognito_callback_urls = [
  "https://admin-portal.example.com/auth/callback"
]
cognito_logout_urls = [
  "https://admin-portal.example.com/"
]

# JWT Authorizer Configuration
enable_jwt_authorizer     = true
jwt_authorizer_log_level  = "INFO"

# IMS (Identity Management Service) Configuration
enable_ims_service        = true
ims_lambda_timeout        = 30
ims_lambda_memory_size    = 512
ims_log_level            = "INFO"

# ==============================================
# Sys App Frontend Configuration (Workflow 09)
# ==============================================
enable_app_frontend = true

# ==============================================
# Sys App Backend Configuration (Workflow 10)
# Source: https://github.com/tripleh1701-dev/ppp-be
# ==============================================
enable_app_backend       = true
app_backend_timeout      = 30
app_backend_memory_size  = 1024  # Higher memory for production
app_backend_log_level    = "warn"
# Note: IMS_API_URL is automatically set by Terraform null_resource after API Gateway is created
