output "tenant_public_table_name" {
  description = "Name of the tenant public DynamoDB table"
  value       = aws_dynamodb_table.tenant_public.name
}

output "tenant_public_table_id" {
  description = "ID of the tenant public DynamoDB table"
  value       = aws_dynamodb_table.tenant_public.id
}

output "tenant_public_table_arn" {
  description = "ARN of the tenant public DynamoDB table"
  value       = aws_dynamodb_table.tenant_public.arn
}

output "kms_key_id" {
  description = "The globally unique identifier for the KMS key (if encryption is enabled)"
  value       = var.server_side_encryption ? aws_kms_key.dynamodb[0].key_id : null
}

output "kms_key_arn" {
  description = "The Amazon Resource Name (ARN) of the KMS key (if encryption is enabled)"
  value       = var.server_side_encryption ? aws_kms_key.dynamodb[0].arn : null
}

output "kms_alias_name" {
  description = "The display name of the KMS key alias (if encryption is enabled)"
  value       = var.server_side_encryption ? aws_kms_alias.dynamodb[0].name : null
}

# Table schema information for applications
output "table_schema" {
  description = "Table schema information for application reference"
  value = {
    table_name = aws_dynamodb_table.tenant_public.name
    hash_key   = "PK"
    range_key  = "SK"
    
    attributes = {
      PK = "S"  # String - Partition Key
      SK = "S"  # String - Sort Key
    }
    
    ttl_attribute = "ttl"
  }
}