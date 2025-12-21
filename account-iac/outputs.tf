# Outputs for account infrastructure
output "cross_account_role_arn" {
  description = "ARN of the cross-account account role (if created)"
  value       = length(aws_iam_role.cross_account_account_role) > 0 ? aws_iam_role.cross_account_account_role[0].arn : null
}

output "account_public_table_name" {
  description = "Name of the account public DynamoDB table"
  value       = module.account_dynamodb.account_public_table_name
}

output "account_public_table_arn" {
  description = "ARN of the account public DynamoDB table"
  value       = module.account_dynamodb.account_public_table_arn
}

output "table_schema" {
  description = "DynamoDB table schema information"
  value       = module.account_dynamodb.table_schema
}

output "workspace_prefix" {
  description = "Workspace prefix used for resource naming"
  value       = var.workspace_prefix
}

output "account_id" {
  description = "Account identifier"
  value       = local.account_id
}

output "is_same_account" {
  description = "Whether admin and account accounts are the same"
  value       = local.is_same_account
}

output "deployment_summary" {
  description = "Summary of what was deployed"
  value = {
    workspace_prefix           = var.workspace_prefix
    account_id                 = local.account_id
    admin_account_id          = var.admin_account_id
    account_account_id         = var.account_account_id
    is_same_account           = local.is_same_account
    cross_account_role_created = length(aws_iam_role.cross_account_account_role) > 0
    account_public_table        = module.account_dynamodb.account_public_table_name
  }
}