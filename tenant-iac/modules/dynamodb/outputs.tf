output "table_names" {
  description = "Names of the created DynamoDB tables"
  value = {
    tenant_data   = aws_dynamodb_table.tenant_data.name
    tenant_config = aws_dynamodb_table.tenant_config.name
  }
}

output "table_arns" {
  description = "ARNs of the created DynamoDB tables"
  value = {
    tenant_data   = aws_dynamodb_table.tenant_data.arn
    tenant_config = aws_dynamodb_table.tenant_config.arn
  }
}