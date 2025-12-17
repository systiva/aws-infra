# Outputs for Delete Infrastructure Worker Module

output "lambda_function_arn" {
  description = "ARN of the delete infrastructure worker Lambda function"
  value       = aws_lambda_function.delete_infra_worker.arn
}

output "lambda_function_name" {
  description = "Name of the delete infrastructure worker Lambda function"
  value       = aws_lambda_function.delete_infra_worker.function_name
}

output "lambda_function_invoke_arn" {
  description = "Invoke ARN of the delete infrastructure worker Lambda function"
  value       = aws_lambda_function.delete_infra_worker.invoke_arn
}