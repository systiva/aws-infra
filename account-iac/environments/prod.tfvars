# Production environment configuration for account infrastructure
workspace_prefix = "prod"
environment     = "prod"
aws_region      = "us-east-1"

# Account-specific configuration
project_name      = "admin-portal"

# DynamoDB Configuration
dynamodb_billing_mode   = "PAY_PER_REQUEST"
point_in_time_recovery  = true
server_side_encryption  = true
deletion_protection     = true

# Common tags
common_tags = {
  Environment = "prod"
  Project     = "admin-portal"
  ManagedBy   = "terraform"
  Owner       = "platform-team"
}
