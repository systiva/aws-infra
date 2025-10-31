# Outputs for Cognito User Pool module

output "user_pool_id" {
  description = "ID of the Cognito User Pool"
  value       = aws_cognito_user_pool.admin_portal.id
}

output "user_pool_arn" {
  description = "ARN of the Cognito User Pool"
  value       = aws_cognito_user_pool.admin_portal.arn
}

output "user_pool_name" {
  description = "Name of the Cognito User Pool"
  value       = aws_cognito_user_pool.admin_portal.name
}

output "user_pool_endpoint" {
  description = "Endpoint name of the Cognito User Pool"
  value       = aws_cognito_user_pool.admin_portal.endpoint
}

output "user_pool_domain" {
  description = "Domain name of the Cognito User Pool"
  value       = aws_cognito_user_pool_domain.admin_portal.domain
}

output "user_pool_client_id" {
  description = "ID of the Cognito User Pool Client"
  value       = aws_cognito_user_pool_client.admin_portal_client.id
}

output "user_pool_client_secret" {
  description = "Secret of the Cognito User Pool Client"
  value       = aws_cognito_user_pool_client.admin_portal_client.client_secret
  sensitive   = true
}

output "user_pool_hosted_ui_url" {
  description = "URL of the Cognito Hosted UI"
  value       = "https://${aws_cognito_user_pool_domain.admin_portal.domain}.auth.${data.aws_region.current.name}.amazoncognito.com"
}

# Outputs for other services to use
output "cognito_sms_role_arn" {
  description = "ARN of the Cognito SMS role"
  value       = aws_iam_role.cognito_sms_role.arn
}

output "user_pool_jwks_url" {
  description = "URL for JWT verification keys"
  value       = "https://cognito-idp.${data.aws_region.current.name}.amazonaws.com/${aws_cognito_user_pool.admin_portal.id}/.well-known/jwks.json"
}