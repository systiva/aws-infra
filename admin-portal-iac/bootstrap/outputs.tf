# Outputs for Bootstrap Infrastructure

output "terraform_state_bucket_name" {
  description = "Name of the S3 bucket for Terraform state"
  value       = aws_s3_bucket.terraform_state.bucket
}

output "terraform_state_bucket_arn" {
  description = "ARN of the S3 bucket for Terraform state"
  value       = aws_s3_bucket.terraform_state.arn
}

output "terraform_lock_table_name" {
  description = "Name of the DynamoDB table for Terraform state locking"
  value       = aws_dynamodb_table.terraform_lock.name
}

output "terraform_lock_table_arn" {
  description = "ARN of the DynamoDB table for Terraform state locking"
  value       = aws_dynamodb_table.terraform_lock.arn
}

output "tenant_registry_table_name" {
  description = "Name of the DynamoDB tenant registry table"
  value       = aws_dynamodb_table.tenant_registry.name
}

output "tenant_registry_table_arn" {
  description = "ARN of the DynamoDB tenant registry table"
  value       = aws_dynamodb_table.tenant_registry.arn
}

output "step_functions_arn" {
  description = "ARN of the Step Functions state machine"
  value       = aws_sfn_state_machine.tenant_operations.arn
}

output "step_functions_name" {
  description = "Name of the Step Functions state machine"
  value       = aws_sfn_state_machine.tenant_operations.name
}

output "backend_config_file" {
  description = "Path to the generated backend configuration file"
  value       = local_file.backend_config.filename
}

# Instructions for next steps
output "next_steps" {
  description = "Instructions for using the bootstrap resources"
  value = <<-EOT
    Bootstrap completed successfully!
    
    Next steps:
    1. Navigate to the admin-portal-iac directory
    2. Initialize Terraform with the generated backend config:
       terraform init -backend-config="${local_file.backend_config.filename}"
    3. Deploy the main infrastructure:
       terraform plan -var-file="environments/${var.workspace_prefix}.tfvars"
       terraform apply -var-file="environments/${var.workspace_prefix}.tfvars"
    
    Backend Configuration:
    - S3 Bucket: ${aws_s3_bucket.terraform_state.bucket}
    - DynamoDB Table: ${aws_dynamodb_table.terraform_lock.name}
    - Tenant Registry: ${aws_dynamodb_table.tenant_registry.name}
  EOT
}