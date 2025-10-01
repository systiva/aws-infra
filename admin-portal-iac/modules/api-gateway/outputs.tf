# Outputs for API Gateway Module

output "api_gateway_id" {
  description = "ID of the API Gateway"
  value       = aws_api_gateway_rest_api.admin_api.id
}

output "api_gateway_arn" {
  description = "ARN of the API Gateway"
  value       = aws_api_gateway_rest_api.admin_api.arn
}

output "api_gateway_execution_arn" {
  description = "Execution ARN of the API Gateway"
  value       = aws_api_gateway_rest_api.admin_api.execution_arn
}

output "api_gateway_url" {
  description = "Base URL of the API Gateway (private - accessible only from VPC)"
  value       = "https://${aws_api_gateway_rest_api.admin_api.id}.execute-api.${data.aws_region.current.name}.amazonaws.com/${aws_api_gateway_deployment.admin_api.stage_name}"
}

output "admin_portal_url" {
  description = "URL for admin portal web application"
  value       = "https://${aws_api_gateway_rest_api.admin_api.id}.execute-api.${data.aws_region.current.name}.amazonaws.com/${aws_api_gateway_deployment.admin_api.stage_name}/"
}

output "admin_backend_base_url" {
  description = "Base URL for admin backend API"
  value       = "https://${aws_api_gateway_rest_api.admin_api.id}.execute-api.${data.aws_region.current.name}.amazonaws.com/${aws_api_gateway_deployment.admin_api.stage_name}/api/v1"
}

output "api_endpoints" {
  description = "Available API endpoints"
  value = {
    # Web application endpoints
    web_app           = "https://${aws_api_gateway_rest_api.admin_api.id}.execute-api.${data.aws_region.current.name}.amazonaws.com/${aws_api_gateway_deployment.admin_api.stage_name}/"
    web_app_proxy     = "https://${aws_api_gateway_rest_api.admin_api.id}.execute-api.${data.aws_region.current.name}.amazonaws.com/${aws_api_gateway_deployment.admin_api.stage_name}/{proxy+}"
    
    # Backend API endpoints
    tenants_get       = "https://${aws_api_gateway_rest_api.admin_api.id}.execute-api.${data.aws_region.current.name}.amazonaws.com/${aws_api_gateway_deployment.admin_api.stage_name}/api/v1/tenants"
    offboard_delete   = "https://${aws_api_gateway_rest_api.admin_api.id}.execute-api.${data.aws_region.current.name}.amazonaws.com/${aws_api_gateway_deployment.admin_api.stage_name}/api/v1/offboard"
    onboard_post      = "https://${aws_api_gateway_rest_api.admin_api.id}.execute-api.${data.aws_region.current.name}.amazonaws.com/${aws_api_gateway_deployment.admin_api.stage_name}/api/v1/onboard"
    onboard_put       = "https://${aws_api_gateway_rest_api.admin_api.id}.execute-api.${data.aws_region.current.name}.amazonaws.com/${aws_api_gateway_deployment.admin_api.stage_name}/api/v1/onboard"
    suspend_put       = "https://${aws_api_gateway_rest_api.admin_api.id}.execute-api.${data.aws_region.current.name}.amazonaws.com/${aws_api_gateway_deployment.admin_api.stage_name}/api/v1/suspend"
  }
}

output "stage_name" {
  description = "Stage name of the API Gateway deployment"
  value       = aws_api_gateway_deployment.admin_api.stage_name
}