output "account_public_table_name" {
  description = "Name of the account public DynamoDB table"
  value       = aws_dynamodb_table.account_public.name
}

output "account_public_table_id" {
  description = "ID of the account public DynamoDB table"
  value       = aws_dynamodb_table.account_public.id
}

output "account_public_table_arn" {
  description = "ARN of the account public DynamoDB table"
  value       = aws_dynamodb_table.account_public.arn
}

# Table schema information for applications
output "table_schema" {
  description = "Table schema information for application reference"
  value = {
    table_name = aws_dynamodb_table.account_public.name
    hash_key   = "PK"
    range_key  = "SK"
    
    attributes = {
      PK = "S"  # String - Partition Key
      SK = "S"  # String - Sort Key
    }
    
    ttl_attribute = "ttl"
  }
}