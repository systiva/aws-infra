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