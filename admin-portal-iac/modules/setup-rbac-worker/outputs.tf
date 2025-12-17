# Outputs for Setup RBAC Worker Lambda

output "lambda_function_arn" {
  description = "ARN of the setup-rbac-worker Lambda function"
  value       = aws_lambda_function.setup_rbac_worker.arn
}

output "lambda_function_name" {
  description = "Name of the setup-rbac-worker Lambda function"
  value       = aws_lambda_function.setup_rbac_worker.function_name
}

output "lambda_role_arn" {
  description = "ARN of the setup-rbac-worker Lambda IAM role"
  value       = aws_iam_role.setup_rbac_worker_role.arn
}

output "lambda_role_name" {
  description = "Name of the setup-rbac-worker Lambda IAM role"
  value       = aws_iam_role.setup_rbac_worker_role.name
}

output "log_group_name" {
  description = "Name of the CloudWatch log group"
  value       = aws_cloudwatch_log_group.setup_rbac_worker_logs.name
}
