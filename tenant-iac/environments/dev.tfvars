# Development environment configuration for tenant infrastructure
workspace_prefix = "dev"
environment     = "dev"
aws_region      = "us-east-1"

# Tenant-specific configuration
tenant_aws_profile = "tenant"
project_name      = "tenant-infra"

# Common tags
common_tags = {
  Environment = "dev"
  Project     = "multi-tenant-poc"
  ManagedBy   = "terraform"
  Owner       = "platform-team"
}