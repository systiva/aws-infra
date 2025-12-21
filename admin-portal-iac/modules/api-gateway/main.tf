# API Gateway Module for Admin Portal
# Uses OpenAPI/Swagger specification for API definition

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

  # Generate OpenAPI spec from template
  openapi_spec = templatefile("${path.module}/swagger.yml.tpl", {
    api_name                  = local.api_name
    admin_portal_lambda_uri   = var.admin_portal_lambda_invoke_arn
    admin_backend_lambda_uri  = var.admin_backend_lambda_invoke_arn
    ims_service_lambda_uri    = var.ims_service_lambda_invoke_arn
    oms_service_lambda_uri    = var.oms_service_lambda_invoke_arn
    app_frontend_lambda_uri   = var.app_frontend_lambda_invoke_arn
    app_backend_lambda_uri    = var.app_backend_lambda_invoke_arn
    jwt_authorizer_uri        = var.enable_jwt_authorizer ? var.jwt_authorizer_lambda_invoke_arn : ""
    jwt_authorizer_enabled    = var.enable_jwt_authorizer
  })
}

# API Gateway REST API defined via OpenAPI/Swagger
resource "aws_api_gateway_rest_api" "admin_api" {
  name        = local.api_name
  description = var.api_gateway_type == "PRIVATE" ? "Private API Gateway for Admin Portal - No internet access required" : "Regional API Gateway for Admin Portal - Internet accessible"

  body = local.openapi_spec

  # Binary media types for serving images, fonts, etc.
  binary_media_types = [
    "image/*",
    "font/*",
    "application/octet-stream",
    "application/font-woff",
    "application/font-woff2",
    "*/*"
  ]

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

  triggers = {
    # Redeploy when OpenAPI spec changes
    redeployment = sha1(jsonencode([
      local.openapi_spec,
      aws_api_gateway_rest_api.admin_api.body,
      aws_api_gateway_rest_api.admin_api.policy,
    ]))
  }

  lifecycle {
    create_before_destroy = true
  }
}

# API Gateway Stage
resource "aws_api_gateway_stage" "admin_api" {
  deployment_id = aws_api_gateway_deployment.admin_api.id
  rest_api_id   = aws_api_gateway_rest_api.admin_api.id
  stage_name    = var.stage_name

  # Enable CloudWatch Logs
  access_log_settings {
    destination_arn = aws_cloudwatch_log_group.api_gateway.arn
    format = jsonencode({
      requestId      = "$context.requestId"
      ip             = "$context.identity.sourceIp"
      caller         = "$context.identity.caller"
      user           = "$context.identity.user"
      requestTime    = "$context.requestTime"
      httpMethod     = "$context.httpMethod"
      resourcePath   = "$context.resourcePath"
      status         = "$context.status"
      protocol       = "$context.protocol"
      responseLength = "$context.responseLength"
    })
  }

  tags = local.common_tags
}

# CloudWatch Log Group for API Gateway
resource "aws_cloudwatch_log_group" "api_gateway" {
  name              = "/aws/apigateway/${local.api_name}"
  retention_in_days = 7
  tags              = local.common_tags
}

# ==============================================
# Lambda Permissions for API Gateway
# Explicit permissions for each endpoint to match Swagger configuration
# ==============================================

# ==============================================
# Admin Portal Lambda - Frontend Web Server
# ==============================================

# Permission for frontend (all methods, all paths via /{proxy+})
resource "aws_lambda_permission" "admin_portal_frontend" {
  statement_id  = "AllowAPIGateway-Frontend"
  action        = "lambda:InvokeFunction"
  function_name = var.admin_portal_lambda_function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_api_gateway_rest_api.admin_api.execution_arn}/*/*/*"
}

# ==============================================
# Admin Backend Lambda - Account Management APIs
# ==============================================

# Permission 1: GET /api/v1/accounts
resource "aws_lambda_permission" "admin_backend_get_accounts" {
  statement_id  = "AllowAPIGateway-GetAccounts"
  action        = "lambda:InvokeFunction"
  function_name = var.admin_backend_lambda_function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_api_gateway_rest_api.admin_api.execution_arn}/*/GET/api/v1/accounts"
}

# Permission 2: GET /api/v1/accounts/{accountId}
resource "aws_lambda_permission" "admin_backend_get_account_by_id" {
  statement_id  = "AllowAPIGateway-GetAccountById"
  action        = "lambda:InvokeFunction"
  function_name = var.admin_backend_lambda_function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_api_gateway_rest_api.admin_api.execution_arn}/*/GET/api/v1/accounts/*"
}

# Permission 3: POST /api/v1/accounts/onboard
resource "aws_lambda_permission" "admin_backend_post_onboard" {
  statement_id  = "AllowAPIGateway-PostOnboard"
  action        = "lambda:InvokeFunction"
  function_name = var.admin_backend_lambda_function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_api_gateway_rest_api.admin_api.execution_arn}/*/POST/api/v1/accounts/onboard"
}

# Permission 4: PUT /api/v1/accounts/onboard
resource "aws_lambda_permission" "admin_backend_put_onboard" {
  statement_id  = "AllowAPIGateway-PutOnboard"
  action        = "lambda:InvokeFunction"
  function_name = var.admin_backend_lambda_function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_api_gateway_rest_api.admin_api.execution_arn}/*/PUT/api/v1/accounts/onboard"
}

# Permission 5: DELETE /api/v1/accounts/offboard
resource "aws_lambda_permission" "admin_backend_delete_offboard" {
  statement_id  = "AllowAPIGateway-DeleteOffboard"
  action        = "lambda:InvokeFunction"
  function_name = var.admin_backend_lambda_function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_api_gateway_rest_api.admin_api.execution_arn}/*/DELETE/api/v1/accounts/offboard"
}

# Permission 6: PUT /api/v1/accounts/suspend
resource "aws_lambda_permission" "admin_backend_put_suspend" {
  statement_id  = "AllowAPIGateway-PutSuspend"
  action        = "lambda:InvokeFunction"
  function_name = var.admin_backend_lambda_function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_api_gateway_rest_api.admin_api.execution_arn}/*/PUT/api/v1/accounts/suspend"
}

# ==============================================
# IMS Service Lambda - Identity & Access Management APIs
# ==============================================

# Permission 1: /api/v1/auth/* (public - login, signup, etc.)
resource "aws_lambda_permission" "ims_auth_endpoints" {
  count         = var.ims_service_lambda_function_name != "" ? 1 : 0
  statement_id  = "AllowAPIGateway-Auth"
  action        = "lambda:InvokeFunction"
  function_name = var.ims_service_lambda_function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_api_gateway_rest_api.admin_api.execution_arn}/*/*/api/v1/auth/*"
}

# Permission 2: GET/POST/PUT/DELETE /api/v1/users (base endpoint)
resource "aws_lambda_permission" "ims_users_base_endpoint" {
  count         = var.ims_service_lambda_function_name != "" ? 1 : 0
  statement_id  = "AllowAPIGateway-UsersBase"
  action        = "lambda:InvokeFunction"
  function_name = var.ims_service_lambda_function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_api_gateway_rest_api.admin_api.execution_arn}/*/*/api/v1/users"
}

# Permission 3: /api/v1/users/* (protected - user management with path params)
resource "aws_lambda_permission" "ims_users_endpoints" {
  count         = var.ims_service_lambda_function_name != "" ? 1 : 0
  statement_id  = "AllowAPIGateway-Users"
  action        = "lambda:InvokeFunction"
  function_name = var.ims_service_lambda_function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_api_gateway_rest_api.admin_api.execution_arn}/*/*/api/v1/users/*"
}

# Permission 4: GET/POST/PUT/DELETE /api/v1/roles (base endpoint)
resource "aws_lambda_permission" "ims_roles_base_endpoint" {
  count         = var.ims_service_lambda_function_name != "" ? 1 : 0
  statement_id  = "AllowAPIGateway-RolesBase"
  action        = "lambda:InvokeFunction"
  function_name = var.ims_service_lambda_function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_api_gateway_rest_api.admin_api.execution_arn}/*/*/api/v1/roles"
}

# Permission 5: /api/v1/roles/* (protected - role management with path params)
resource "aws_lambda_permission" "ims_roles_endpoints" {
  count         = var.ims_service_lambda_function_name != "" ? 1 : 0
  statement_id  = "AllowAPIGateway-Roles"
  action        = "lambda:InvokeFunction"
  function_name = var.ims_service_lambda_function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_api_gateway_rest_api.admin_api.execution_arn}/*/*/api/v1/roles/*"
}

# Permission 6: GET/POST/PUT/DELETE /api/v1/rbac (base endpoint)
resource "aws_lambda_permission" "ims_rbac_base_endpoint" {
  count         = var.ims_service_lambda_function_name != "" ? 1 : 0
  statement_id  = "AllowAPIGateway-RBACBase"
  action        = "lambda:InvokeFunction"
  function_name = var.ims_service_lambda_function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_api_gateway_rest_api.admin_api.execution_arn}/*/*/api/v1/rbac"
}

# Permission 7: /api/v1/rbac/* (protected - RBAC management with path params)
resource "aws_lambda_permission" "ims_rbac_endpoints" {
  count         = var.ims_service_lambda_function_name != "" ? 1 : 0
  statement_id  = "AllowAPIGateway-RBAC"
  action        = "lambda:InvokeFunction"
  function_name = var.ims_service_lambda_function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_api_gateway_rest_api.admin_api.execution_arn}/*/*/api/v1/rbac/*"
}

# Permission 8: GET/POST/PUT/DELETE /api/v1/context (base endpoint)
resource "aws_lambda_permission" "ims_context_base_endpoint" {
  count         = var.ims_service_lambda_function_name != "" ? 1 : 0
  statement_id  = "AllowAPIGateway-ContextBase"
  action        = "lambda:InvokeFunction"
  function_name = var.ims_service_lambda_function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_api_gateway_rest_api.admin_api.execution_arn}/*/*/api/v1/context"
}

# Permission 9: /api/v1/context/* (protected - context management with path params)
resource "aws_lambda_permission" "ims_context_endpoints" {
  count         = var.ims_service_lambda_function_name != "" ? 1 : 0
  statement_id  = "AllowAPIGateway-Context"
  action        = "lambda:InvokeFunction"
  function_name = var.ims_service_lambda_function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_api_gateway_rest_api.admin_api.execution_arn}/*/*/api/v1/context/*"
}

# ==============================================
# OMS Service Lambda Permissions
# ==============================================

# Permission 1: /api/v1/oms/customers (base endpoint)
resource "aws_lambda_permission" "oms_customers_base" {
  count         = var.oms_service_lambda_function_name != "" ? 1 : 0
  statement_id  = "AllowAPIGateway-OMSCustomersBase"
  action        = "lambda:InvokeFunction"
  function_name = var.oms_service_lambda_function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_api_gateway_rest_api.admin_api.execution_arn}/*/*/api/v1/oms/customers"
}

# Permission 2: /api/v1/oms/customers/* (with path params)
resource "aws_lambda_permission" "oms_customers_endpoints" {
  count         = var.oms_service_lambda_function_name != "" ? 1 : 0
  statement_id  = "AllowAPIGateway-OMSCustomers"
  action        = "lambda:InvokeFunction"
  function_name = var.oms_service_lambda_function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_api_gateway_rest_api.admin_api.execution_arn}/*/*/api/v1/oms/customers/*"
}

# Permission 3: /api/v1/oms/products (base endpoint)
resource "aws_lambda_permission" "oms_products_base" {
  count         = var.oms_service_lambda_function_name != "" ? 1 : 0
  statement_id  = "AllowAPIGateway-OMSProductsBase"
  action        = "lambda:InvokeFunction"
  function_name = var.oms_service_lambda_function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_api_gateway_rest_api.admin_api.execution_arn}/*/*/api/v1/oms/products"
}

# Permission 4: /api/v1/oms/products/* (with path params)
resource "aws_lambda_permission" "oms_products_endpoints" {
  count         = var.oms_service_lambda_function_name != "" ? 1 : 0
  statement_id  = "AllowAPIGateway-OMSProducts"
  action        = "lambda:InvokeFunction"
  function_name = var.oms_service_lambda_function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_api_gateway_rest_api.admin_api.execution_arn}/*/*/api/v1/oms/products/*"
}

# Permission 5: /api/v1/oms/orders (base endpoint)
resource "aws_lambda_permission" "oms_orders_base" {
  count         = var.oms_service_lambda_function_name != "" ? 1 : 0
  statement_id  = "AllowAPIGateway-OMSOrdersBase"
  action        = "lambda:InvokeFunction"
  function_name = var.oms_service_lambda_function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_api_gateway_rest_api.admin_api.execution_arn}/*/*/api/v1/oms/orders"
}

# Permission 6: /api/v1/oms/orders/* (with path params)
resource "aws_lambda_permission" "oms_orders_endpoints" {
  count         = var.oms_service_lambda_function_name != "" ? 1 : 0
  statement_id  = "AllowAPIGateway-OMSOrders"
  action        = "lambda:InvokeFunction"
  function_name = var.oms_service_lambda_function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_api_gateway_rest_api.admin_api.execution_arn}/*/*/api/v1/oms/orders/*"
}

# Permission 7: /api/v1/oms/inventory (base endpoint)
resource "aws_lambda_permission" "oms_inventory_base" {
  count         = var.oms_service_lambda_function_name != "" ? 1 : 0
  statement_id  = "AllowAPIGateway-OMSInventoryBase"
  action        = "lambda:InvokeFunction"
  function_name = var.oms_service_lambda_function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_api_gateway_rest_api.admin_api.execution_arn}/*/*/api/v1/oms/inventory"
}

# Permission 8: /api/v1/oms/inventory/* (with path params)
resource "aws_lambda_permission" "oms_inventory_endpoints" {
  count         = var.oms_service_lambda_function_name != "" ? 1 : 0
  statement_id  = "AllowAPIGateway-OMSInventory"
  action        = "lambda:InvokeFunction"
  function_name = var.oms_service_lambda_function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_api_gateway_rest_api.admin_api.execution_arn}/*/*/api/v1/oms/inventory/*"
}

# ==============================================
# Sys App Frontend Lambda Permissions
# ==============================================

# Permission for /ui, /images, /fonts and all subpaths
resource "aws_lambda_permission" "app_frontend" {
  count         = var.app_frontend_lambda_function_name != "" ? 1 : 0
  statement_id  = "AllowAPIGateway-AppFrontend"
  action        = "lambda:InvokeFunction"
  function_name = var.app_frontend_lambda_function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_api_gateway_rest_api.admin_api.execution_arn}/*/*/*"
}

# Permission for /images path (assets without /ui prefix)
resource "aws_lambda_permission" "app_frontend_images" {
  count         = var.app_frontend_lambda_function_name != "" ? 1 : 0
  statement_id  = "AllowAPIGateway-AppFrontend-Images"
  action        = "lambda:InvokeFunction"
  function_name = var.app_frontend_lambda_function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_api_gateway_rest_api.admin_api.execution_arn}/*/*/images/*"
}

# Permission for /fonts path (assets without /ui prefix)
resource "aws_lambda_permission" "app_frontend_fonts" {
  count         = var.app_frontend_lambda_function_name != "" ? 1 : 0
  statement_id  = "AllowAPIGateway-AppFrontend-Fonts"
  action        = "lambda:InvokeFunction"
  function_name = var.app_frontend_lambda_function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_api_gateway_rest_api.admin_api.execution_arn}/*/*/fonts/*"
}

# ==============================================
# Sys App Backend Lambda Permissions (Workflow 10)
# Routes: /api/v1/app/* - Sys App API endpoints
# ==============================================

# Permission 1: /api/v1/app (base endpoint)
resource "aws_lambda_permission" "app_backend_base" {
  count         = var.app_backend_lambda_function_name != "" ? 1 : 0
  statement_id  = "AllowAPIGateway-AppBackendBase"
  action        = "lambda:InvokeFunction"
  function_name = var.app_backend_lambda_function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_api_gateway_rest_api.admin_api.execution_arn}/*/*/api/v1/app"
}

# Permission 2: /api/v1/app/* (all sub-paths)
resource "aws_lambda_permission" "app_backend_all" {
  count         = var.app_backend_lambda_function_name != "" ? 1 : 0
  statement_id  = "AllowAPIGateway-AppBackendAll"
  action        = "lambda:InvokeFunction"
  function_name = var.app_backend_lambda_function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_api_gateway_rest_api.admin_api.execution_arn}/*/*/api/v1/app/*"
}

# Permission 3: /api/v1/app/enterprises (enterprise management)
resource "aws_lambda_permission" "app_backend_enterprises" {
  count         = var.app_backend_lambda_function_name != "" ? 1 : 0
  statement_id  = "AllowAPIGateway-AppBackendEnterprises"
  action        = "lambda:InvokeFunction"
  function_name = var.app_backend_lambda_function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_api_gateway_rest_api.admin_api.execution_arn}/*/*/api/v1/app/enterprises/*"
}

# Permission 4: /api/v1/app/pipelines (pipeline management)
resource "aws_lambda_permission" "app_backend_pipelines" {
  count         = var.app_backend_lambda_function_name != "" ? 1 : 0
  statement_id  = "AllowAPIGateway-AppBackendPipelines"
  action        = "lambda:InvokeFunction"
  function_name = var.app_backend_lambda_function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_api_gateway_rest_api.admin_api.execution_arn}/*/*/api/v1/app/pipelines/*"
}

# Permission 5: /api/v1/app/templates (template management)
resource "aws_lambda_permission" "app_backend_templates" {
  count         = var.app_backend_lambda_function_name != "" ? 1 : 0
  statement_id  = "AllowAPIGateway-AppBackendTemplates"
  action        = "lambda:InvokeFunction"
  function_name = var.app_backend_lambda_function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_api_gateway_rest_api.admin_api.execution_arn}/*/*/api/v1/app/templates/*"
}

# ==============================================
# JWT Authorizer Lambda
# ==============================================

# Lambda permission for JWT authorizer
resource "aws_lambda_permission" "jwt_authorizer" {
  count         = var.enable_jwt_authorizer ? 1 : 0
  statement_id  = "AllowExecutionFromAPIGateway-JWTAuthorizer"
  action        = "lambda:InvokeFunction"
  function_name = var.jwt_authorizer_lambda_function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_api_gateway_rest_api.admin_api.execution_arn}/authorizers/*"
}
