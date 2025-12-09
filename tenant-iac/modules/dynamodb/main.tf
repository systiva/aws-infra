# DynamoDB table for tenant public data
# Simple table with PK/SK for multi-tenant data storage
resource "aws_dynamodb_table" "tenant_public" {
  name             = "${var.project_name}-${var.environment}-tenant-public"
  billing_mode     = var.billing_mode
  read_capacity    = var.billing_mode == "PROVISIONED" ? var.read_capacity : null
  write_capacity   = var.billing_mode == "PROVISIONED" ? var.write_capacity : null
  hash_key         = "PK"
  range_key        = "SK"
  
  deletion_protection_enabled = var.deletion_protection

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

  # Server-side encryption
  dynamic "server_side_encryption" {
    for_each = var.server_side_encryption ? [1] : []
    content {
      enabled        = true
      kms_master_key_id = aws_kms_key.dynamodb[0].arn
    }
  }

  tags = merge(var.common_tags, {
    Name        = "${var.project_name}-${var.environment}-tenant-public"
    Purpose     = "Multi-Tenant Public Data"
    DataPattern = "Single Table Design with PK/SK"
  })

  lifecycle {
    prevent_destroy = true
  }
}

# KMS key for DynamoDB encryption
resource "aws_kms_key" "dynamodb" {
  count = var.server_side_encryption ? 1 : 0
  
  description             = "KMS key for DynamoDB encryption in ${var.project_name}-${var.environment}"
  deletion_window_in_days = 7
  enable_key_rotation     = true

  tags = merge(var.common_tags, {
    Name = "${var.project_name}-${var.environment}-dynamodb-key"
  })
}

# KMS key alias
resource "aws_kms_alias" "dynamodb" {
  count = var.server_side_encryption ? 1 : 0
  
  name          = "alias/${var.project_name}-${var.environment}-dynamodb"
  target_key_id = aws_kms_key.dynamodb[0].key_id
}