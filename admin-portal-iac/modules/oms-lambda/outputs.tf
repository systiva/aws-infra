output "lambda_function_arn" {
  description = "ARN of the OMS Lambda function"
  value       = aws_lambda_function.oms_service.arn
}

output "lambda_function_name" {
  description = "Name of the OMS Lambda function"
  value       = aws_lambda_function.oms_service.function_name
}

output "lambda_function_invoke_arn" {
  description = "Invoke ARN of the OMS Lambda function"
  value       = aws_lambda_function.oms_service.invoke_arn
}

output "lambda_role_arn" {
  description = "ARN of the Lambda execution role"
  value       = aws_iam_role.oms_lambda_role.arn
}

output "lambda_role_name" {
  description = "Name of the Lambda execution role"
  value       = aws_iam_role.oms_lambda_role.name
}

output "cloudwatch_log_group_name" {
  description = "Name of the CloudWatch log group"
  value       = aws_cloudwatch_log_group.oms_service.name
}
