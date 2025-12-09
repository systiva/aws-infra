# Outputs for tenant infrastructure
output "cross_account_role_arn" {
  description = "ARN of the cross-account tenant role (if created)"
  value       = length(aws_iam_role.cross_account_tenant_role) > 0 ? aws_iam_role.cross_account_tenant_role[0].arn : null
}

output "tenant_public_table_name" {
  description = "Name of the tenant public DynamoDB table"
  value       = module.tenant_dynamodb.tenant_public_table_name
}

output "tenant_public_table_arn" {
  description = "ARN of the tenant public DynamoDB table"
  value       = module.tenant_dynamodb.tenant_public_table_arn
}

output "table_schema" {
  description = "DynamoDB table schema information"
  value       = module.tenant_dynamodb.table_schema
}

output "workspace_prefix" {
  description = "Workspace prefix used for resource naming"
  value       = var.workspace_prefix
}

output "tenant_id" {
  description = "Tenant identifier"
  value       = local.tenant_id
}

output "is_same_account" {
  description = "Whether admin and tenant accounts are the same"
  value       = local.is_same_account
}

output "deployment_summary" {
  description = "Summary of what was deployed"
  value = {
    workspace_prefix           = var.workspace_prefix
    tenant_id                 = local.tenant_id
    admin_account_id          = var.admin_account_id
    tenant_account_id         = var.tenant_account_id
    is_same_account           = local.is_same_account
    cross_account_role_created = length(aws_iam_role.cross_account_tenant_role) > 0
    tenant_public_table        = module.tenant_dynamodb.tenant_public_table_name
  }
}