# Outputs for JWT Authorizer module

output "lambda_function_arn" {
  description = "ARN of the JWT Authorizer Lambda function"
  value       = aws_lambda_function.jwt_authorizer.arn
}

output "lambda_function_name" {
  description = "Name of the JWT Authorizer Lambda function"
  value       = aws_lambda_function.jwt_authorizer.function_name
}

output "lambda_function_invoke_arn" {
  description = "Invoke ARN of the JWT Authorizer Lambda function"
  value       = aws_lambda_function.jwt_authorizer.invoke_arn
}

output "lambda_function_qualified_arn" {
  description = "Qualified ARN of the JWT Authorizer Lambda function"
  value       = aws_lambda_function.jwt_authorizer.qualified_arn
}

output "lambda_role_arn" {
  description = "ARN of the JWT Authorizer Lambda execution role"
  value       = aws_iam_role.jwt_authorizer_role.arn
}