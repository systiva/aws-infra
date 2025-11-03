# Outputs for Create Admin Worker Lambda

output "function_name" {
  description = "Name of the Lambda function"
  value       = aws_lambda_function.create_admin_worker.function_name
}

output "function_arn" {
  description = "ARN of the Lambda function"
  value       = aws_lambda_function.create_admin_worker.arn
}

output "function_invoke_arn" {
  description = "Invoke ARN of the Lambda function"
  value       = aws_lambda_function.create_admin_worker.invoke_arn
}

output "function_role_arn" {
  description = "ARN of the Lambda execution role"
  value       = aws_iam_role.create_admin_worker_role.arn
}

output "log_group_name" {
  description = "Name of the CloudWatch Log Group"
  value       = aws_cloudwatch_log_group.create_admin_worker_logs.name
}

output "log_group_arn" {
  description = "ARN of the CloudWatch Log Group"
  value       = aws_cloudwatch_log_group.create_admin_worker_logs.arn
}