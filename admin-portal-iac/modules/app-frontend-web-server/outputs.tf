output "lambda_function_arn" {
  description = "ARN of the Lambda function"
  value       = aws_lambda_function.app_frontend_web_server.arn
}

output "lambda_function_name" {
  description = "Name of the Lambda function"
  value       = aws_lambda_function.app_frontend_web_server.function_name
}

output "lambda_function_invoke_arn" {
  description = "Invoke ARN for API Gateway integration"
  value       = aws_lambda_function.app_frontend_web_server.invoke_arn
}

output "lambda_role_arn" {
  description = "ARN of the Lambda execution role"
  value       = aws_iam_role.lambda_execution_role.arn
}

