# Outputs for admin portal web server module

output "lambda_function_arn" {
  description = "ARN of the admin portal web server Lambda function"
  value       = aws_lambda_function.admin_portal_web_server.arn
}

output "lambda_function_name" {
  description = "Name of the admin portal web server Lambda function"
  value       = aws_lambda_function.admin_portal_web_server.function_name
}

output "lambda_function_invoke_arn" {
  description = "Invoke ARN of the admin portal web server Lambda function"
  value       = aws_lambda_function.admin_portal_web_server.invoke_arn
}

output "function_url" {
  description = "Function URL for direct access to admin portal (if enabled)"
  value       = var.enable_function_url ? aws_lambda_function_url.admin_portal_web_server[0].function_url : null
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