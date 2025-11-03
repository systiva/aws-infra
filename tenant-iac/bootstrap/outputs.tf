output "state_bucket_name" {
  description = "Name of the Terraform state bucket (if created)"
  value       = length(aws_s3_bucket.tenant_terraform_state) > 0 ? aws_s3_bucket.tenant_terraform_state[0].bucket : null
}

output "lock_table_name" {
  description = "Name of the Terraform lock table (if created)"
  value       = length(aws_dynamodb_table.tenant_terraform_lock) > 0 ? aws_dynamodb_table.tenant_terraform_lock[0].name : null
}

output "is_same_account" {
  description = "Whether admin and tenant accounts are the same"
  value       = local.is_same_account
}

output "bootstrap_created" {
  description = "Whether bootstrap resources were created"
  value       = !local.is_same_account
}

output "workspace_prefix" {
  description = "Workspace prefix used"
  value       = var.workspace_prefix
}