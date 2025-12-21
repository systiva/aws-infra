# Outputs for admin portal infrastructure

# Networking Outputs
output "vpc_id" {
  description = "ID of the VPC"
  value       = module.networking.vpc_id
}

# ==============================================
# Identity Management System Outputs
# ==============================================

# Cognito Outputs
output "cognito_user_pool_id" {
  description = "ID of the Cognito User Pool"
  value       = var.enable_cognito ? module.cognito[0].user_pool_id : null
}

output "cognito_user_pool_arn" {
  description = "ARN of the Cognito User Pool"
  value       = var.enable_cognito ? module.cognito[0].user_pool_arn : null
}

output "cognito_user_pool_client_id" {
  description = "ID of the Cognito User Pool Client"
  value       = var.enable_cognito ? module.cognito[0].user_pool_client_id : null
}

output "cognito_user_pool_domain" {
  description = "Domain of the Cognito User Pool"
  value       = var.enable_cognito ? module.cognito[0].user_pool_domain : null
}

output "cognito_hosted_ui_url" {
  description = "URL of the Cognito Hosted UI"
  value       = var.enable_cognito ? module.cognito[0].user_pool_hosted_ui_url : null
}

output "cognito_jwks_url" {
  description = "URL for JWT verification keys"
  value       = var.enable_cognito ? module.cognito[0].user_pool_jwks_url : null
}

# JWT Authorizer Outputs
output "jwt_authorizer_function_arn" {
  description = "ARN of the JWT Authorizer Lambda function"
  value       = var.enable_jwt_authorizer && var.enable_cognito ? module.jwt_authorizer[0].lambda_function_arn : null
}

output "jwt_authorizer_function_name" {
  description = "Name of the JWT Authorizer Lambda function"
  value       = var.enable_jwt_authorizer && var.enable_cognito ? module.jwt_authorizer[0].lambda_function_name : null
}

# IMS Service Outputs
output "ims_service_function_arn" {
  description = "ARN of the IMS Service Lambda function"
  value       = var.enable_ims_service && var.enable_cognito ? module.ims_service[0].lambda_function_arn : null
}

output "ims_service_function_name" {
  description = "Name of the IMS Service Lambda function"
  value       = var.enable_ims_service && var.enable_cognito ? module.ims_service[0].lambda_function_name : null
}

output "ims_service_function_url" {
  description = "Function URL of the IMS Service Lambda (if enabled)"
  value       = var.enable_ims_service && var.enable_cognito && var.enable_lambda_function_urls ? module.ims_service[0].lambda_function_url : null
}

# OMS Service Outputs
output "oms_service_function_arn" {
  description = "ARN of the OMS Service Lambda function"
  value       = var.enable_oms_service ? module.oms_service[0].lambda_function_arn : null
}

output "oms_service_function_name" {
  description = "Name of the OMS Service Lambda function"
  value       = var.enable_oms_service ? module.oms_service[0].lambda_function_name : null
}

# ==============================================
# Sys App Backend Outputs (Workflow 10)
# Source: https://github.com/tripleh1701-dev/ppp-be
# ==============================================

output "app_backend_function_arn" {
  description = "ARN of the Sys App Backend Lambda function"
  value       = var.enable_app_backend ? module.app_backend[0].lambda_function_arn : null
}

output "app_backend_function_name" {
  description = "Name of the Sys App Backend Lambda function"
  value       = var.enable_app_backend ? module.app_backend[0].lambda_function_name : null
}

output "app_backend_function_url" {
  description = "Function URL of the Sys App Backend Lambda (if enabled)"
  value       = var.enable_app_backend && var.enable_lambda_function_urls ? module.app_backend[0].function_url : null
}

output "app_backend_api_url" {
  description = "API Gateway URL for Sys App Backend"
  value       = var.enable_api_gateway && var.enable_app_backend ? "${module.api_gateway[0].api_gateway_url}/api/v1/app" : null
}

# ==============================================
# Platform Bootstrap Outputs
# ==============================================

# Platform Admin Credentials
output "platform_admin_username" {
  description = "Username of the default platform administrator"
  value       = var.enable_platform_bootstrap && var.enable_cognito ? module.platform_bootstrap[0].platform_admin_username : null
}

output "platform_admin_password" {
  description = "Password of the default platform administrator"
  value       = var.enable_platform_bootstrap && var.enable_cognito ? module.platform_bootstrap[0].platform_admin_password : null
  sensitive   = true
}

output "platform_admin_email" {
  description = "Email of the default platform administrator"
  value       = var.enable_platform_bootstrap && var.enable_cognito ? module.platform_bootstrap[0].platform_admin_email : null
}

output "platform_admin_user_id" {
  description = "Cognito User ID (UUID) of the default platform administrator"
  value       = var.enable_platform_bootstrap && var.enable_cognito ? module.platform_bootstrap[0].platform_admin_cognito_user_id : null
}

# RBAC Setup Summary
output "rbac_setup_summary" {
  description = "Summary of RBAC configuration"
  value       = var.enable_platform_bootstrap && var.enable_cognito ? module.platform_bootstrap[0].rbac_setup_summary : null
}

# Deployment Summary (Updated)
output "deployment_summary" {
  description = "Summary of deployed resources"
  value = {
    vpc_created               = module.networking.vpc_id
    lambda_functions_deployed = concat([
      module.admin_portal_web_server.lambda_function_name,
      # module.admin_backend.lambda_function_name,  # COMMENTED OUT
      module.create_infra_worker.lambda_function_name,
      module.delete_infra_worker.lambda_function_name,
      module.poll_infra_worker.lambda_function_name
    ],
    var.enable_jwt_authorizer && var.enable_cognito ? [module.jwt_authorizer[0].lambda_function_name] : [],
    var.enable_ims_service && var.enable_cognito ? [module.ims_service[0].lambda_function_name] : []
    )
    access_url = var.enable_lambda_function_urls ? module.admin_portal_web_server.function_url : "No public access configured"
    account_registry_table = var.account_registry_table_name
    rbac_table = var.account_registry_table_name
    vpc_endpoints_created = module.vpc_endpoints.endpoint_services_created
    architecture_type = "Independent Lambda-based with Identity Management and JWT Authorization"
    identity_management = var.enable_cognito ? {
      cognito_user_pool_id = module.cognito[0].user_pool_id
      ims_service_enabled = var.enable_ims_service
      jwt_authorizer_enabled = var.enable_jwt_authorizer
      rbac_enabled = true
      platform_admin_created = var.enable_platform_bootstrap
      rbac_table_shared = "Using account registry table for RBAC data"
    } : null
  }
}

output "vpc_cidr_block" {
  description = "CIDR block of the VPC"
  value       = module.networking.vpc_cidr_block
}

output "public_subnet_ids" {
  description = "IDs of the public subnets"
  value       = module.networking.public_subnet_ids
}

output "private_subnet_ids" {
  description = "IDs of the private subnets"
  value       = module.networking.private_subnet_ids
}

output "internet_gateway_id" {
  description = "ID of the Internet Gateway"
  value       = module.networking.internet_gateway_id
}

output "nat_gateway_ids" {
  description = "IDs of the NAT Gateways"
  value       = module.networking.nat_gateway_ids
}

# Lambda Function Outputs
output "admin_portal_web_server_arn" {
  description = "ARN of the admin portal web server Lambda function"
  value       = module.admin_portal_web_server.lambda_function_arn
}

output "admin_portal_web_server_name" {
  description = "Name of the admin portal web server Lambda function"
  value       = module.admin_portal_web_server.lambda_function_name
}

output "admin_backend_arn" {
  description = "ARN of the admin backend Lambda function"
  value       = module.admin_backend.lambda_function_arn
}

output "admin_backend_name" {
  description = "Name of the admin backend Lambda function"
  value       = module.admin_backend.lambda_function_name
}

# Lambda Function URLs (Alternative to API Gateway)
output "admin_portal_function_url" {
  description = "Function URL for admin portal web server (if enabled)"
  value       = var.enable_lambda_function_urls ? module.admin_portal_web_server.function_url : null
}

output "admin_backend_function_url" {
  description = "Function URL for admin backend Lambda (if enabled)"
  value       = var.enable_lambda_function_urls ? module.admin_backend.function_url : null
}

# Private API Gateway Outputs
output "api_gateway_url" {
  description = "Base URL of the Private API Gateway (accessible only from VPC)"
  value       = var.enable_api_gateway ? module.api_gateway[0].api_gateway_url : null
}

output "admin_portal_web_url" {
  description = "URL for accessing the admin portal web application"
  value       = var.enable_api_gateway ? module.api_gateway[0].admin_portal_url : null
}

output "admin_backend_api_url" {
  description = "Base URL for the admin backend API"
  value       = var.enable_api_gateway ? module.api_gateway[0].admin_backend_base_url : null
}

output "api_endpoints" {
  description = "Complete list of available API endpoints"
  value       = var.enable_api_gateway ? module.api_gateway[0].api_endpoints : {}
}

# S3 Bucket Outputs
output "admin_portal_bucket_name" {
  description = "Name of the admin portal S3 bucket"
  value       = aws_s3_bucket.admin_portal.bucket
}

output "admin_portal_bucket_arn" {
  description = "ARN of the admin portal S3 bucket"
  value       = aws_s3_bucket.admin_portal.arn
}

# VPC Endpoints Outputs
output "vpc_endpoints" {
  description = "VPC endpoints created"
  value = {
    endpoint_ids = module.vpc_endpoints.vpc_endpoint_ids
    services     = module.vpc_endpoints.endpoint_services_created
  }
}

# Access Methods
output "access_methods" {
  description = "Available access methods for the admin portal"
  value = {
    lambda_function_urls = {
      admin_portal = var.enable_lambda_function_urls ? module.admin_portal_web_server.function_url : null
      # admin_backend = var.enable_lambda_function_urls ? module.admin_backend.function_url : null  # COMMENTED OUT
    }
  }
}

# Independent Infrastructure Summary
output "infrastructure_summary" {
  description = "Summary of created independent infrastructure"
  value = {
    vpc_id                = module.networking.vpc_id
    private_subnet_ids    = module.networking.private_subnet_ids
    account_registry_table = var.account_registry_table_name
    rbac_table           = var.account_registry_table_name  # Same table used for RBAC
    lambda_functions      = {
      admin_portal        = module.admin_portal_web_server.lambda_function_name
      # admin_backend       = module.admin_backend.lambda_function_name  # COMMENTED OUT
      create_infra_worker = module.create_infra_worker.lambda_function_name
      delete_infra_worker = module.delete_infra_worker.lambda_function_name
      poll_infra_worker   = module.poll_infra_worker.lambda_function_name
      ims_service         = var.enable_ims_service && var.enable_cognito ? module.ims_service[0].lambda_function_name : null
      jwt_authorizer      = var.enable_jwt_authorizer && var.enable_cognito ? module.jwt_authorizer[0].lambda_function_name : null
    }
    identity_services = var.enable_cognito ? {
      cognito_user_pool_id = module.cognito[0].user_pool_id
      platform_admin_created = var.enable_platform_bootstrap
      rbac_system_ready = true
      rbac_table_shared = "RBAC data stored in account registry table"
    } : null
  }
}

# Resource Counts
output "resource_counts" {
  description = "Count of resources by type"
  value = {
    networking_resources  = "15+ (VPC, subnets, gateways, route tables, security groups)"
    lambda_functions     = var.enable_cognito ? (var.enable_ims_service && var.enable_jwt_authorizer ? 7 : 6) : 5
    s3_buckets           = 2
    vpc_endpoints        = length(var.vpc_endpoint_services)
    dynamodb_tables      = 1  # Account registry table (also used for RBAC)
    cognito_user_pools   = var.enable_cognito ? 1 : 0
    cognito_users        = var.enable_platform_bootstrap ? 1 : 0
    rbac_entries         = var.enable_platform_bootstrap ? "32+ (Groups, Roles, Permissions, Mappings)" : 0
  }
}

# ==============================================
# Platform Admin Quick Start Information
# ==============================================

output "platform_admin_quick_start" {
  description = "Quick start information for platform administrator"
  value = var.enable_platform_bootstrap && var.enable_cognito ? {
    message = "Platform administrator user has been created successfully!"
    login_instructions = {
      step_1 = "Use the username and password provided in the outputs"
      step_2 = "Access the admin portal via the provided URL"
      step_3 = "Login with the platform admin credentials"
      step_4 = "You will have full platform administration capabilities"
    }
    admin_capabilities = [
      "Account onboarding and offboarding",
      "Account suspension and reactivation",
      "Account super-admin management",
      "Platform-wide governance",
      "User and role management"
    ]
    rbac_storage = "RBAC data stored in account registry table (single-table design)"
    security_note = "Please change the default password after first login for security"
  } : null
}

# ==============================================
# Create Admin Worker Configuration
# ==============================================

output "create_admin_worker_config" {
  description = "Dynamic configuration for create-admin-worker Lambda"
  value = {
    lambda_function_name   = module.create_admin_worker.function_name
    lambda_function_arn    = module.create_admin_worker.function_arn
    ims_service_url        = var.enable_api_gateway ? module.api_gateway[0].ims_service_base_url : var.ims_service_url
    account_platform_id     = var.enable_platform_bootstrap ? module.platform_bootstrap[0].platform_account_id : "platform"
    account_admin_group_id  = var.enable_platform_bootstrap ? module.platform_bootstrap[0].account_admin_group_id : var.account_admin_group_id
    configuration_source   = "dynamically_resolved_from_terraform_outputs"
  }
}
