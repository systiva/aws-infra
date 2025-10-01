# Outputs for admin portal infrastructure

# Networking Outputs
output "vpc_id" {
  description = "ID of the VPC"
  value       = module.networking.vpc_id
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
  description = "Function URL for admin backend (if enabled)"
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
      admin_backend = var.enable_lambda_function_urls ? module.admin_backend.function_url : null
    }
  }
}

# Independent Infrastructure Summary
output "infrastructure_summary" {
  description = "Summary of created independent infrastructure"
  value = {
    vpc_id                = module.networking.vpc_id
    private_subnet_ids    = module.networking.private_subnet_ids
    tenant_registry_table = var.tenant_registry_table_name
    lambda_functions      = {
      admin_portal        = module.admin_portal_web_server.lambda_function_name
      admin_backend       = module.admin_backend.lambda_function_name
      create_infra_worker = module.create_infra_worker.lambda_function_name
      delete_infra_worker = module.delete_infra_worker.lambda_function_name
      poll_infra_worker   = module.poll_infra_worker.lambda_function_name
    }
  }
}

# Resource Counts
output "resource_counts" {
  description = "Count of resources by type"
  value = {
    networking_resources  = "15+ (VPC, subnets, gateways, route tables, security groups)"
    lambda_functions     = 5  # Updated count
    s3_buckets           = 2
    vpc_endpoints        = length(var.vpc_endpoint_services)
    dynamodb_tables      = "Created in bootstrap"
  }
}

# Deployment Summary
output "deployment_summary" {
  description = "Summary of deployed resources and access information"
  value = {
    vpc_created               = module.networking.vpc_id
    lambda_functions_deployed = [
      module.admin_portal_web_server.lambda_function_name,
      module.admin_backend.lambda_function_name,
      module.create_infra_worker.lambda_function_name,
      module.delete_infra_worker.lambda_function_name,
      module.poll_infra_worker.lambda_function_name
    ]
    access_url = var.enable_lambda_function_urls ? module.admin_portal_web_server.function_url : "No public access configured"
    tenant_registry_table = var.tenant_registry_table_name
    vpc_endpoints_created = module.vpc_endpoints.endpoint_services_created
    architecture_type = "Independent Lambda-based with Step Functions orchestration"
  }
}