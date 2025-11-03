# API Gateway Module for Admin Portal
# Creates an API Gateway that can be PRIVATE (VPC-only) or REGIONAL (internet-accessible)

# Data sources
data "aws_caller_identity" "current" {}
data "aws_region" "current" {}

# Local values
locals {
  api_name = "${var.project_name}-${var.environment}-api"
  
  common_tags = merge(var.common_tags, {
    Name = local.api_name
    Type = "APIGateway"
  })
}

# API Gateway (supports both PRIVATE and REGIONAL)
resource "aws_api_gateway_rest_api" "admin_api" {
  name        = local.api_name
  description = var.api_gateway_type == "PRIVATE" ? "Private API Gateway for Admin Portal - No internet access required" : "Regional API Gateway for Admin Portal - Internet accessible"
  
  endpoint_configuration {
    types            = [var.api_gateway_type]
    vpc_endpoint_ids = var.api_gateway_type == "PRIVATE" ? [var.vpc_endpoint_id] : null
  }
  
  # Policy: VPC-only for PRIVATE, no policy for REGIONAL (allows all access)
  policy = var.api_gateway_type == "PRIVATE" ? jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Principal = "*"
        Action = "execute-api:Invoke"
        Resource = "*"
        Condition = {
          StringEquals = {
            "aws:SourceVpce" = var.vpc_endpoint_id
          }
        }
      }
    ]
  }) : null

  tags = local.common_tags
}

# API Gateway Deployment
resource "aws_api_gateway_deployment" "admin_api" {
  rest_api_id = aws_api_gateway_rest_api.admin_api.id
  stage_name  = var.stage_name

  triggers = {
    redeployment = sha1(jsonencode(concat([
      aws_api_gateway_rest_api.admin_api.body,
      aws_api_gateway_rest_api.admin_api.policy, # Include policy changes
      # Web server endpoints
      aws_api_gateway_method.root.id,
      aws_api_gateway_method.proxy_any.id,
      aws_api_gateway_method.proxy_options.id,
      aws_api_gateway_integration.root.id,
      aws_api_gateway_integration.proxy_any.id,
      aws_api_gateway_integration.proxy_options.id,
      # Backend API endpoints
      aws_api_gateway_resource.api.id,
      aws_api_gateway_resource.v1.id,
      aws_api_gateway_resource.tenants.id,
      aws_api_gateway_method.tenants_get.id,
      aws_api_gateway_integration.tenants_get.id,
      aws_api_gateway_resource.tenant_by_id.id,
      aws_api_gateway_method.tenant_by_id_get.id,
      aws_api_gateway_integration.tenant_by_id_get.id,
      aws_api_gateway_resource.offboard.id,
      aws_api_gateway_method.offboard_delete.id,
      aws_api_gateway_integration.offboard_delete.id,
      aws_api_gateway_resource.onboard.id,
      aws_api_gateway_method.onboard_post.id,
      aws_api_gateway_integration.onboard_post.id,
      aws_api_gateway_method.onboard_put.id,
      aws_api_gateway_integration.onboard_put.id,
      aws_api_gateway_resource.suspend.id,
      aws_api_gateway_method.suspend_put.id,
      aws_api_gateway_integration.suspend_put.id,
      # IMS Service endpoints
      aws_api_gateway_resource.auth.id,
      aws_api_gateway_resource.auth_proxy.id,
      aws_api_gateway_method.auth_any.id,
      aws_api_gateway_method.auth_proxy_any.id,
      aws_api_gateway_integration.auth_any.id,
      aws_api_gateway_integration.auth_proxy_any.id,
      aws_api_gateway_resource.users.id,
      aws_api_gateway_resource.users_proxy.id,
      aws_api_gateway_method.users_any.id,
      aws_api_gateway_method.users_proxy_any.id,
      aws_api_gateway_integration.users_any.id,
      aws_api_gateway_integration.users_proxy_any.id,
      aws_api_gateway_resource.roles.id,
      aws_api_gateway_resource.roles_proxy.id,
      aws_api_gateway_method.roles_any.id,
      aws_api_gateway_method.roles_proxy_any.id,
      aws_api_gateway_integration.roles_any.id,
      aws_api_gateway_integration.roles_proxy_any.id,
      aws_api_gateway_resource.rbac.id,
      aws_api_gateway_resource.rbac_proxy.id,
      aws_api_gateway_method.rbac_any.id,
      aws_api_gateway_method.rbac_proxy_any.id,
      aws_api_gateway_integration.rbac_any.id,
      aws_api_gateway_integration.rbac_proxy_any.id,
      aws_api_gateway_resource.context.id,
      aws_api_gateway_resource.context_proxy.id,
      aws_api_gateway_method.context_any.id,
      aws_api_gateway_method.context_proxy_any.id,
      aws_api_gateway_integration.context_any.id,
      aws_api_gateway_integration.context_proxy_any.id,
    ]
    )))
  }

  lifecycle {
    create_before_destroy = true
  }

  depends_on = [
    # Web server methods and integrations
    aws_api_gateway_method.root,
    aws_api_gateway_method.proxy_any,
    aws_api_gateway_method.proxy_options,
    aws_api_gateway_integration.root,
    aws_api_gateway_integration.proxy_any,
    aws_api_gateway_integration.proxy_options,
    # Backend API methods and integrations
    aws_api_gateway_method.tenants_get,
    aws_api_gateway_integration.tenants_get,
    aws_api_gateway_method.tenant_by_id_get,
    aws_api_gateway_integration.tenant_by_id_get,
    aws_api_gateway_method.offboard_delete,
    aws_api_gateway_integration.offboard_delete,
    aws_api_gateway_method.onboard_post,
    aws_api_gateway_integration.onboard_post,
    aws_api_gateway_method.onboard_put,
    aws_api_gateway_integration.onboard_put,
    aws_api_gateway_method.suspend_put,
    aws_api_gateway_integration.suspend_put,
    # IMS Service methods and integrations
    aws_api_gateway_method.auth_any,
    aws_api_gateway_method.auth_proxy_any,
    aws_api_gateway_integration.auth_any,
    aws_api_gateway_integration.auth_proxy_any,
    aws_api_gateway_method.users_any,
    aws_api_gateway_method.users_proxy_any,
    aws_api_gateway_integration.users_any,
    aws_api_gateway_integration.users_proxy_any,
    aws_api_gateway_method.roles_any,
    aws_api_gateway_method.roles_proxy_any,
    aws_api_gateway_integration.roles_any,
    aws_api_gateway_integration.roles_proxy_any,
    aws_api_gateway_method.rbac_any,
    aws_api_gateway_method.rbac_proxy_any,
    aws_api_gateway_integration.rbac_any,
    aws_api_gateway_integration.rbac_proxy_any,
    aws_api_gateway_method.context_any,
    aws_api_gateway_method.context_proxy_any,
    aws_api_gateway_integration.context_any,
    aws_api_gateway_integration.context_proxy_any,
  ]
}

# JWT Authorizer for API Gateway (optional)
resource "aws_api_gateway_authorizer" "jwt_authorizer" {
  count                            = var.enable_jwt_authorizer ? 1 : 0
  name                            = "${local.api_name}-jwt-authorizer"
  rest_api_id                     = aws_api_gateway_rest_api.admin_api.id
  authorizer_uri                  = var.jwt_authorizer_lambda_invoke_arn
  authorizer_credentials          = aws_iam_role.api_gateway_jwt_authorizer_role[0].arn
  type                           = "REQUEST"
  identity_source                = "method.request.header.Authorization"
  authorizer_result_ttl_in_seconds = 300  # 5 minutes cache
}

# IAM role for API Gateway to invoke JWT authorizer Lambda
resource "aws_iam_role" "api_gateway_jwt_authorizer_role" {
  count = var.enable_jwt_authorizer ? 1 : 0
  name  = "${local.api_name}-jwt-authorizer-invoke-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "apigateway.amazonaws.com"
        }
      }
    ]
  })

  tags = merge(local.common_tags, {
    Name        = "${local.api_name}-jwt-authorizer-invoke-role"
    Component   = "Authorization"
    Purpose     = "API Gateway JWT Authorizer Invocation"
  })
}

# IAM policy for API Gateway to invoke JWT authorizer Lambda
resource "aws_iam_role_policy" "api_gateway_jwt_authorizer_policy" {
  count = var.enable_jwt_authorizer ? 1 : 0
  name  = "${local.api_name}-jwt-authorizer-invoke-policy"
  role  = aws_iam_role.api_gateway_jwt_authorizer_role[0].id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "lambda:InvokeFunction"
        ]
        Resource = var.jwt_authorizer_lambda_invoke_arn
      }
    ]
  })
}

# Lambda permission for API Gateway to invoke JWT authorizer
resource "aws_lambda_permission" "jwt_authorizer_permission" {
  count         = var.enable_jwt_authorizer ? 1 : 0
  statement_id  = "AllowAPIGatewayInvokeJWTAuthorizer"
  action        = "lambda:InvokeFunction"
  function_name = var.jwt_authorizer_lambda_function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_api_gateway_rest_api.admin_api.execution_arn}/*"
}

# Resources and methods for web server (root path and proxy)

# Root resource method (/)
resource "aws_api_gateway_method" "root" {
  rest_api_id   = aws_api_gateway_rest_api.admin_api.id
  resource_id   = aws_api_gateway_rest_api.admin_api.root_resource_id
  http_method   = "ANY"
  authorization = "NONE"
}

# Root integration to web server
resource "aws_api_gateway_integration" "root" {
  rest_api_id = aws_api_gateway_rest_api.admin_api.id
  resource_id = aws_api_gateway_rest_api.admin_api.root_resource_id
  http_method = aws_api_gateway_method.root.http_method

  integration_http_method = "POST"
  type                   = "AWS_PROXY"
  uri                    = var.admin_portal_lambda_invoke_arn
}

# Proxy resource for web server ({proxy+})
resource "aws_api_gateway_resource" "proxy" {
  rest_api_id = aws_api_gateway_rest_api.admin_api.id
  parent_id   = aws_api_gateway_rest_api.admin_api.root_resource_id
  path_part   = "{proxy+}"
}

# Proxy method (ANY)
resource "aws_api_gateway_method" "proxy_any" {
  rest_api_id   = aws_api_gateway_rest_api.admin_api.id
  resource_id   = aws_api_gateway_resource.proxy.id
  http_method   = "ANY"
  authorization = "NONE"
}

# Proxy method (OPTIONS)
resource "aws_api_gateway_method" "proxy_options" {
  rest_api_id   = aws_api_gateway_rest_api.admin_api.id
  resource_id   = aws_api_gateway_resource.proxy.id
  http_method   = "OPTIONS"
  authorization = "NONE"
}

# Proxy integration (ANY)
resource "aws_api_gateway_integration" "proxy_any" {
  rest_api_id = aws_api_gateway_rest_api.admin_api.id
  resource_id = aws_api_gateway_resource.proxy.id
  http_method = aws_api_gateway_method.proxy_any.http_method

  integration_http_method = "POST"
  type                   = "AWS_PROXY"
  uri                    = var.admin_portal_lambda_invoke_arn
}

# Proxy integration (OPTIONS)
resource "aws_api_gateway_integration" "proxy_options" {
  rest_api_id = aws_api_gateway_rest_api.admin_api.id
  resource_id = aws_api_gateway_resource.proxy.id
  http_method = aws_api_gateway_method.proxy_options.http_method

  integration_http_method = "POST"
  type                   = "AWS_PROXY"
  uri                    = var.admin_portal_lambda_invoke_arn
}

# API resources for backend Lambda

# /api resource
resource "aws_api_gateway_resource" "api" {
  rest_api_id = aws_api_gateway_rest_api.admin_api.id
  parent_id   = aws_api_gateway_rest_api.admin_api.root_resource_id
  path_part   = "api"
}

# /api/v1 resource
resource "aws_api_gateway_resource" "v1" {
  rest_api_id = aws_api_gateway_rest_api.admin_api.id
  parent_id   = aws_api_gateway_resource.api.id
  path_part   = "v1"
}

# /api/v1/tenants resource
resource "aws_api_gateway_resource" "tenants" {
  rest_api_id = aws_api_gateway_rest_api.admin_api.id
  parent_id   = aws_api_gateway_resource.v1.id
  path_part   = "tenants"
}

# /api/v1/tenants GET method
resource "aws_api_gateway_method" "tenants_get" {
  rest_api_id   = aws_api_gateway_rest_api.admin_api.id
  resource_id   = aws_api_gateway_resource.tenants.id
  http_method   = "GET"
  authorization = var.enable_jwt_authorizer ? "CUSTOM" : "NONE"
  authorizer_id = var.enable_jwt_authorizer ? aws_api_gateway_authorizer.jwt_authorizer[0].id : null
}

# /api/v1/tenants GET integration
resource "aws_api_gateway_integration" "tenants_get" {
  rest_api_id = aws_api_gateway_rest_api.admin_api.id
  resource_id = aws_api_gateway_resource.tenants.id
  http_method = aws_api_gateway_method.tenants_get.http_method

  integration_http_method = "POST"
  type                   = "AWS_PROXY"
  uri                    = var.admin_backend_lambda_invoke_arn
}

# /api/v1/tenants/{tenantId} resource
resource "aws_api_gateway_resource" "tenant_by_id" {
  rest_api_id = aws_api_gateway_rest_api.admin_api.id
  parent_id   = aws_api_gateway_resource.tenants.id
  path_part   = "{tenantId}"
}

# /api/v1/tenants/{tenantId} GET method
resource "aws_api_gateway_method" "tenant_by_id_get" {
  rest_api_id   = aws_api_gateway_rest_api.admin_api.id
  resource_id   = aws_api_gateway_resource.tenant_by_id.id
  http_method   = "GET"
  authorization = var.enable_jwt_authorizer ? "CUSTOM" : "NONE"
  authorizer_id = var.enable_jwt_authorizer ? aws_api_gateway_authorizer.jwt_authorizer[0].id : null
  
  request_parameters = {
    "method.request.path.tenantId" = true
  }
}

# /api/v1/tenants/{tenantId} GET integration
resource "aws_api_gateway_integration" "tenant_by_id_get" {
  rest_api_id = aws_api_gateway_rest_api.admin_api.id
  resource_id = aws_api_gateway_resource.tenant_by_id.id
  http_method = aws_api_gateway_method.tenant_by_id_get.http_method

  integration_http_method = "POST"
  type                   = "AWS_PROXY"
  uri                    = var.admin_backend_lambda_invoke_arn
  
  request_parameters = {
    "integration.request.path.tenantId" = "method.request.path.tenantId"
  }
}

# /api/v1/tenants/offboard resource
resource "aws_api_gateway_resource" "offboard" {
  rest_api_id = aws_api_gateway_rest_api.admin_api.id
  parent_id   = aws_api_gateway_resource.tenants.id
  path_part   = "offboard"
}

# /api/v1/tenants/offboard DELETE method
resource "aws_api_gateway_method" "offboard_delete" {
  rest_api_id   = aws_api_gateway_rest_api.admin_api.id
  resource_id   = aws_api_gateway_resource.offboard.id
  http_method   = "DELETE"
  authorization = var.enable_jwt_authorizer ? "CUSTOM" : "NONE"
  authorizer_id = var.enable_jwt_authorizer ? aws_api_gateway_authorizer.jwt_authorizer[0].id : null
}

# /api/v1/tenants/offboard DELETE integration
resource "aws_api_gateway_integration" "offboard_delete" {
  rest_api_id = aws_api_gateway_rest_api.admin_api.id
  resource_id = aws_api_gateway_resource.offboard.id
  http_method = aws_api_gateway_method.offboard_delete.http_method

  integration_http_method = "POST"
  type                   = "AWS_PROXY"
  uri                    = var.admin_backend_lambda_invoke_arn
}

# /api/v1/tenants/onboard resource
resource "aws_api_gateway_resource" "onboard" {
  rest_api_id = aws_api_gateway_rest_api.admin_api.id
  parent_id   = aws_api_gateway_resource.tenants.id
  path_part   = "onboard"
}

# /api/v1/tenants/onboard POST method
resource "aws_api_gateway_method" "onboard_post" {
  rest_api_id   = aws_api_gateway_rest_api.admin_api.id
  resource_id   = aws_api_gateway_resource.onboard.id
  http_method   = "POST"
  authorization = var.enable_jwt_authorizer ? "CUSTOM" : "NONE"
  authorizer_id = var.enable_jwt_authorizer ? aws_api_gateway_authorizer.jwt_authorizer[0].id : null
}

# /api/v1/tenants/onboard PUT method
resource "aws_api_gateway_method" "onboard_put" {
  rest_api_id   = aws_api_gateway_rest_api.admin_api.id
  resource_id   = aws_api_gateway_resource.onboard.id
  http_method   = "PUT"
  authorization = var.enable_jwt_authorizer ? "CUSTOM" : "NONE"
  authorizer_id = var.enable_jwt_authorizer ? aws_api_gateway_authorizer.jwt_authorizer[0].id : null
}

# /api/v1/tenants/onboard POST integration
resource "aws_api_gateway_integration" "onboard_post" {
  rest_api_id = aws_api_gateway_rest_api.admin_api.id
  resource_id = aws_api_gateway_resource.onboard.id
  http_method = aws_api_gateway_method.onboard_post.http_method

  integration_http_method = "POST"
  type                   = "AWS_PROXY"
  uri                    = var.admin_backend_lambda_invoke_arn
}

# /api/v1/tenants/onboard PUT integration
resource "aws_api_gateway_integration" "onboard_put" {
  rest_api_id = aws_api_gateway_rest_api.admin_api.id
  resource_id = aws_api_gateway_resource.onboard.id
  http_method = aws_api_gateway_method.onboard_put.http_method

  integration_http_method = "POST"
  type                   = "AWS_PROXY"
  uri                    = var.admin_backend_lambda_invoke_arn
}

# /api/v1/tenants/suspend resource
resource "aws_api_gateway_resource" "suspend" {
  rest_api_id = aws_api_gateway_rest_api.admin_api.id
  parent_id   = aws_api_gateway_resource.tenants.id
  path_part   = "suspend"
}

# /api/v1/tenants/suspend PUT method
resource "aws_api_gateway_method" "suspend_put" {
  rest_api_id   = aws_api_gateway_rest_api.admin_api.id
  resource_id   = aws_api_gateway_resource.suspend.id
  http_method   = "PUT"
  authorization = var.enable_jwt_authorizer ? "CUSTOM" : "NONE"
  authorizer_id = var.enable_jwt_authorizer ? aws_api_gateway_authorizer.jwt_authorizer[0].id : null
}

# /api/v1/tenants/suspend PUT integration
resource "aws_api_gateway_integration" "suspend_put" {
  rest_api_id = aws_api_gateway_rest_api.admin_api.id
  resource_id = aws_api_gateway_resource.suspend.id
  http_method = aws_api_gateway_method.suspend_put.http_method

  integration_http_method = "POST"
  type                   = "AWS_PROXY"
  uri                    = var.admin_backend_lambda_invoke_arn
}

# ==============================================
# IMS Service Routes
# ==============================================

# /api/v1/auth resource (PUBLIC - no authorization)
resource "aws_api_gateway_resource" "auth" {
  rest_api_id = aws_api_gateway_rest_api.admin_api.id
  parent_id   = aws_api_gateway_resource.v1.id
  path_part   = "auth"
}

# /api/v1/auth proxy resource for all auth routes
resource "aws_api_gateway_resource" "auth_proxy" {
  rest_api_id = aws_api_gateway_rest_api.admin_api.id
  parent_id   = aws_api_gateway_resource.auth.id
  path_part   = "{proxy+}"
}

# /api/v1/auth ANY method (public)
resource "aws_api_gateway_method" "auth_any" {
  rest_api_id   = aws_api_gateway_rest_api.admin_api.id
  resource_id   = aws_api_gateway_resource.auth.id
  http_method   = "ANY"
  authorization = "NONE"
}

# /api/v1/auth proxy ANY method (public)
resource "aws_api_gateway_method" "auth_proxy_any" {
  rest_api_id   = aws_api_gateway_rest_api.admin_api.id
  resource_id   = aws_api_gateway_resource.auth_proxy.id
  http_method   = "ANY"
  authorization = "NONE"
}

# /api/v1/auth integration
resource "aws_api_gateway_integration" "auth_any" {
  rest_api_id = aws_api_gateway_rest_api.admin_api.id
  resource_id = aws_api_gateway_resource.auth.id
  http_method = aws_api_gateway_method.auth_any.http_method

  integration_http_method = "POST"
  type                   = "AWS_PROXY"
  uri                    = var.ims_service_lambda_invoke_arn
}

# /api/v1/auth proxy integration
resource "aws_api_gateway_integration" "auth_proxy_any" {
  rest_api_id = aws_api_gateway_rest_api.admin_api.id
  resource_id = aws_api_gateway_resource.auth_proxy.id
  http_method = aws_api_gateway_method.auth_proxy_any.http_method

  integration_http_method = "POST"
  type                   = "AWS_PROXY"
  uri                    = var.ims_service_lambda_invoke_arn
}

# /api/v1/users resource (PROTECTED)
resource "aws_api_gateway_resource" "users" {
  rest_api_id = aws_api_gateway_rest_api.admin_api.id
  parent_id   = aws_api_gateway_resource.v1.id
  path_part   = "users"
}

# /api/v1/users proxy resource
resource "aws_api_gateway_resource" "users_proxy" {
  rest_api_id = aws_api_gateway_rest_api.admin_api.id
  parent_id   = aws_api_gateway_resource.users.id
  path_part   = "{proxy+}"
}

# /api/v1/users ANY method (protected)
resource "aws_api_gateway_method" "users_any" {
  rest_api_id   = aws_api_gateway_rest_api.admin_api.id
  resource_id   = aws_api_gateway_resource.users.id
  http_method   = "ANY"
  authorization = var.enable_jwt_authorizer ? "CUSTOM" : "NONE"
  authorizer_id = var.enable_jwt_authorizer ? aws_api_gateway_authorizer.jwt_authorizer[0].id : null
}

# /api/v1/users proxy ANY method (protected)
resource "aws_api_gateway_method" "users_proxy_any" {
  rest_api_id   = aws_api_gateway_rest_api.admin_api.id
  resource_id   = aws_api_gateway_resource.users_proxy.id
  http_method   = "ANY"
  authorization = var.enable_jwt_authorizer ? "CUSTOM" : "NONE"
  authorizer_id = var.enable_jwt_authorizer ? aws_api_gateway_authorizer.jwt_authorizer[0].id : null
}

# /api/v1/users integration
resource "aws_api_gateway_integration" "users_any" {
  rest_api_id = aws_api_gateway_rest_api.admin_api.id
  resource_id = aws_api_gateway_resource.users.id
  http_method = aws_api_gateway_method.users_any.http_method

  integration_http_method = "POST"
  type                   = "AWS_PROXY"
  uri                    = var.ims_service_lambda_invoke_arn
}

# /api/v1/users proxy integration
resource "aws_api_gateway_integration" "users_proxy_any" {
  rest_api_id = aws_api_gateway_rest_api.admin_api.id
  resource_id = aws_api_gateway_resource.users_proxy.id
  http_method = aws_api_gateway_method.users_proxy_any.http_method

  integration_http_method = "POST"
  type                   = "AWS_PROXY"
  uri                    = var.ims_service_lambda_invoke_arn
}

# /api/v1/roles resource (PROTECTED)
resource "aws_api_gateway_resource" "roles" {
  rest_api_id = aws_api_gateway_rest_api.admin_api.id
  parent_id   = aws_api_gateway_resource.v1.id
  path_part   = "roles"
}

# /api/v1/roles proxy resource
resource "aws_api_gateway_resource" "roles_proxy" {
  rest_api_id = aws_api_gateway_rest_api.admin_api.id
  parent_id   = aws_api_gateway_resource.roles.id
  path_part   = "{proxy+}"
}

# /api/v1/roles ANY method (protected)
resource "aws_api_gateway_method" "roles_any" {
  rest_api_id   = aws_api_gateway_rest_api.admin_api.id
  resource_id   = aws_api_gateway_resource.roles.id
  http_method   = "ANY"
  authorization = var.enable_jwt_authorizer ? "CUSTOM" : "NONE"
  authorizer_id = var.enable_jwt_authorizer ? aws_api_gateway_authorizer.jwt_authorizer[0].id : null
}

# /api/v1/roles proxy ANY method (protected)
resource "aws_api_gateway_method" "roles_proxy_any" {
  rest_api_id   = aws_api_gateway_rest_api.admin_api.id
  resource_id   = aws_api_gateway_resource.roles_proxy.id
  http_method   = "ANY"
  authorization = var.enable_jwt_authorizer ? "CUSTOM" : "NONE"
  authorizer_id = var.enable_jwt_authorizer ? aws_api_gateway_authorizer.jwt_authorizer[0].id : null
}

# /api/v1/roles integration
resource "aws_api_gateway_integration" "roles_any" {
  rest_api_id = aws_api_gateway_rest_api.admin_api.id
  resource_id = aws_api_gateway_resource.roles.id
  http_method = aws_api_gateway_method.roles_any.http_method

  integration_http_method = "POST"
  type                   = "AWS_PROXY"
  uri                    = var.ims_service_lambda_invoke_arn
}

# /api/v1/roles proxy integration
resource "aws_api_gateway_integration" "roles_proxy_any" {
  rest_api_id = aws_api_gateway_rest_api.admin_api.id
  resource_id = aws_api_gateway_resource.roles_proxy.id
  http_method = aws_api_gateway_method.roles_proxy_any.http_method

  integration_http_method = "POST"
  type                   = "AWS_PROXY"
  uri                    = var.ims_service_lambda_invoke_arn
}

# /api/v1/rbac resource (PROTECTED)
resource "aws_api_gateway_resource" "rbac" {
  rest_api_id = aws_api_gateway_rest_api.admin_api.id
  parent_id   = aws_api_gateway_resource.v1.id
  path_part   = "rbac"
}

# /api/v1/rbac proxy resource
resource "aws_api_gateway_resource" "rbac_proxy" {
  rest_api_id = aws_api_gateway_rest_api.admin_api.id
  parent_id   = aws_api_gateway_resource.rbac.id
  path_part   = "{proxy+}"
}

# /api/v1/rbac ANY method (protected)
resource "aws_api_gateway_method" "rbac_any" {
  rest_api_id   = aws_api_gateway_rest_api.admin_api.id
  resource_id   = aws_api_gateway_resource.rbac.id
  http_method   = "ANY"
  authorization = var.enable_jwt_authorizer ? "CUSTOM" : "NONE"
  authorizer_id = var.enable_jwt_authorizer ? aws_api_gateway_authorizer.jwt_authorizer[0].id : null
}

# /api/v1/rbac proxy ANY method (protected)
resource "aws_api_gateway_method" "rbac_proxy_any" {
  rest_api_id   = aws_api_gateway_rest_api.admin_api.id
  resource_id   = aws_api_gateway_resource.rbac_proxy.id
  http_method   = "ANY"
  authorization = var.enable_jwt_authorizer ? "CUSTOM" : "NONE"
  authorizer_id = var.enable_jwt_authorizer ? aws_api_gateway_authorizer.jwt_authorizer[0].id : null
}

# /api/v1/rbac integration
resource "aws_api_gateway_integration" "rbac_any" {
  rest_api_id = aws_api_gateway_rest_api.admin_api.id
  resource_id = aws_api_gateway_resource.rbac.id
  http_method = aws_api_gateway_method.rbac_any.http_method

  integration_http_method = "POST"
  type                   = "AWS_PROXY"
  uri                    = var.ims_service_lambda_invoke_arn
}

# /api/v1/rbac proxy integration
resource "aws_api_gateway_integration" "rbac_proxy_any" {
  rest_api_id = aws_api_gateway_rest_api.admin_api.id
  resource_id = aws_api_gateway_resource.rbac_proxy.id
  http_method = aws_api_gateway_method.rbac_proxy_any.http_method

  integration_http_method = "POST"
  type                   = "AWS_PROXY"
  uri                    = var.ims_service_lambda_invoke_arn
}

# /api/v1/context resource (PROTECTED)
resource "aws_api_gateway_resource" "context" {
  rest_api_id = aws_api_gateway_rest_api.admin_api.id
  parent_id   = aws_api_gateway_resource.v1.id
  path_part   = "context"
}

# /api/v1/context proxy resource
resource "aws_api_gateway_resource" "context_proxy" {
  rest_api_id = aws_api_gateway_rest_api.admin_api.id
  parent_id   = aws_api_gateway_resource.context.id
  path_part   = "{proxy+}"
}

# /api/v1/context ANY method (protected)
resource "aws_api_gateway_method" "context_any" {
  rest_api_id   = aws_api_gateway_rest_api.admin_api.id
  resource_id   = aws_api_gateway_resource.context.id
  http_method   = "ANY"
  authorization = var.enable_jwt_authorizer ? "CUSTOM" : "NONE"
  authorizer_id = var.enable_jwt_authorizer ? aws_api_gateway_authorizer.jwt_authorizer[0].id : null
}

# /api/v1/context proxy ANY method (protected)
resource "aws_api_gateway_method" "context_proxy_any" {
  rest_api_id   = aws_api_gateway_rest_api.admin_api.id
  resource_id   = aws_api_gateway_resource.context_proxy.id
  http_method   = "ANY"
  authorization = var.enable_jwt_authorizer ? "CUSTOM" : "NONE"
  authorizer_id = var.enable_jwt_authorizer ? aws_api_gateway_authorizer.jwt_authorizer[0].id : null
}

# /api/v1/context integration
resource "aws_api_gateway_integration" "context_any" {
  rest_api_id = aws_api_gateway_rest_api.admin_api.id
  resource_id = aws_api_gateway_resource.context.id
  http_method = aws_api_gateway_method.context_any.http_method

  integration_http_method = "POST"
  type                   = "AWS_PROXY"
  uri                    = var.ims_service_lambda_invoke_arn
}

# /api/v1/context proxy integration
resource "aws_api_gateway_integration" "context_proxy_any" {
  rest_api_id = aws_api_gateway_rest_api.admin_api.id
  resource_id = aws_api_gateway_resource.context_proxy.id
  http_method = aws_api_gateway_method.context_proxy_any.http_method

  integration_http_method = "POST"
  type                   = "AWS_PROXY"
  uri                    = var.ims_service_lambda_invoke_arn
}

# Lambda permissions for API Gateway
resource "aws_lambda_permission" "admin_portal_api_gateway" {
  statement_id  = "AllowExecutionFromAPIGateway"
  action        = "lambda:InvokeFunction"
  function_name = var.admin_portal_lambda_function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_api_gateway_rest_api.admin_api.execution_arn}/*/*/*"
}

resource "aws_lambda_permission" "admin_backend_api_gateway" {
  statement_id  = "AllowExecutionFromAPIGateway"
  action        = "lambda:InvokeFunction"
  function_name = var.admin_backend_lambda_function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_api_gateway_rest_api.admin_api.execution_arn}/*/*/*"
}

# Lambda permission for IMS service
resource "aws_lambda_permission" "ims_service_api_gateway" {
  count         = var.ims_service_lambda_function_name != "" ? 1 : 0
  statement_id  = "AllowExecutionFromAPIGateway"
  action        = "lambda:InvokeFunction"
  function_name = var.ims_service_lambda_function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_api_gateway_rest_api.admin_api.execution_arn}/*/*/*"
}