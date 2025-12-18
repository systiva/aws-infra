# Outputs for Sys App backend module

output "lambda_function_arn" {
  description = "ARN of the Sys App backend Lambda function"
  value       = aws_lambda_function.app_backend.arn
}

output "lambda_function_name" {
  description = "Name of the Sys App backend Lambda function"
  value       = aws_lambda_function.app_backend.function_name
}

output "lambda_function_invoke_arn" {
  description = "Invoke ARN of the Sys App backend Lambda function"
  value       = aws_lambda_function.app_backend.invoke_arn
}

output "function_url" {
  description = "Function URL for direct access to Sys App backend (if enabled)"
  value       = var.enable_function_url ? aws_lambda_function_url.app_backend[0].function_url : null
}

output "lambda_execution_role_arn" {
  description = "ARN of the Lambda execution role"
  value       = aws_iam_role.lambda_execution_role.arn
}

output "lambda_code_bucket_name" {
  description = "Name of the S3 bucket for Lambda deployment packages"
  value       = aws_s3_bucket.lambda_code.bucket
}

output "cloudwatch_log_group_name" {
  description = "Name of the CloudWatch log group"
  value       = aws_cloudwatch_log_group.lambda_logs.name
}
