# QA environment configuration for tenant infrastructure
workspace_prefix = "qa"
environment     = "qa"
aws_region      = "us-east-1"

# Tenant-specific configuration
project_name      = "admin-portal"

# DynamoDB Configuration
dynamodb_billing_mode   = "PAY_PER_REQUEST"
point_in_time_recovery  = true
server_side_encryption  = true
deletion_protection     = true

# Common tags
common_tags = {
  Environment = "qa"
  Project     = "admin-portal"
  ManagedBy   = "terraform"
  Owner       = "platform-team"
}
