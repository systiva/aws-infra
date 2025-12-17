# Outputs for IMS Service module

output "lambda_function_arn" {
  description = "ARN of the IMS Service Lambda function"
  value       = aws_lambda_function.ims_service.arn
}

output "lambda_function_name" {
  description = "Name of the IMS Service Lambda function"
  value       = aws_lambda_function.ims_service.function_name
}

output "lambda_function_invoke_arn" {
  description = "Invoke ARN of the IMS Service Lambda function"
  value       = aws_lambda_function.ims_service.invoke_arn
}

output "lambda_function_qualified_arn" {
  description = "Qualified ARN of the IMS Service Lambda function"
  value       = aws_lambda_function.ims_service.qualified_arn
}

output "lambda_role_arn" {
  description = "ARN of the IMS Service Lambda execution role"
  value       = aws_iam_role.ims_service_role.arn
}

output "lambda_function_url" {
  description = "Function URL of the IMS Service Lambda (if enabled)"
  value       = var.enable_function_url ? aws_lambda_function_url.ims_service_url[0].function_url : null
}

output "cloudwatch_log_group_name" {
  description = "Name of the CloudWatch log group"
  value       = aws_cloudwatch_log_group.ims_service_logs.name
}