# Outputs for Create Infrastructure Worker Module

output "lambda_function_arn" {
  description = "ARN of the create infrastructure worker Lambda function"
  value       = aws_lambda_function.create_infra_worker.arn
}

output "lambda_function_name" {
  description = "Name of the create infrastructure worker Lambda function"
  value       = aws_lambda_function.create_infra_worker.function_name
}

output "lambda_function_invoke_arn" {
  description = "Invoke ARN of the create infrastructure worker Lambda function"
  value       = aws_lambda_function.create_infra_worker.invoke_arn
}