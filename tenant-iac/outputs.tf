# Outputs for tenant infrastructure
output "cross_account_role_arn" {
  description = "ARN of the cross-account tenant role (if created)"
  value       = length(aws_iam_role.cross_account_tenant_role) > 0 ? aws_iam_role.cross_account_tenant_role[0].arn : null
}

output "tenant_dynamodb_tables" {
  description = "DynamoDB tables created for tenant"
  value       = module.tenant_dynamodb.table_names
  sensitive   = false
}

output "workspace_prefix" {
  description = "Workspace prefix used for resource naming"
  value       = var.workspace_prefix
}

output "tenant_id" {
  description = "Tenant identifier"
  value       = var.tenant_id
}

output "is_same_account" {
  description = "Whether admin and tenant accounts are the same"
  value       = local.is_same_account
}

output "deployment_summary" {
  description = "Summary of what was deployed"
  value = {
    workspace_prefix           = var.workspace_prefix
    tenant_id                 = var.tenant_id
    admin_account_id          = var.admin_account_id
    tenant_account_id         = var.tenant_account_id
    is_same_account           = local.is_same_account
    cross_account_role_created = length(aws_iam_role.cross_account_tenant_role) > 0
    dynamodb_tables_created   = true
  }
}