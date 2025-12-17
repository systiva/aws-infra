# DynamoDB table for tenant public data
# Simple table with PK/SK for multi-tenant data storage
resource "aws_dynamodb_table" "tenant_public" {
  name             = "${var.project_name}-${var.environment}-tenant-public"
  billing_mode     = var.billing_mode
  read_capacity    = var.billing_mode == "PROVISIONED" ? var.read_capacity : null
  write_capacity   = var.billing_mode == "PROVISIONED" ? var.write_capacity : null
  hash_key         = "PK"
  range_key        = "SK"
  
  deletion_protection_enabled = false  # Allow deletion for all environments

  # Primary key attributes
  attribute {
    name = "PK"
    type = "S"
  }

  attribute {
    name = "SK"
    type = "S"
  }

  # Time To Live
  ttl {
    attribute_name = "ttl"
    enabled        = true
  }

  # Point-in-time recovery
  point_in_time_recovery {
    enabled = var.point_in_time_recovery
  }

  # Server-side encryption - using AWS-owned default encryption
  # This provides encryption at rest with no additional cost
  # and no KMS key management overhead
  server_side_encryption {
    enabled = true
  }

  tags = merge(var.common_tags, {
    Name        = "${var.project_name}-${var.environment}-tenant-public"
    Purpose     = "Multi-Tenant Public Data"
    DataPattern = "Single Table Design with PK/SK"
  })
}