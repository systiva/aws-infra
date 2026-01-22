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

# Permission for /images path (static assets served by app frontend Lambda - workflow 09)
resource "aws_lambda_permission" "app_frontend_images" {
  count         = var.app_frontend_lambda_function_name != "" ? 1 : 0
  statement_id  = "AllowAPIGateway-AppFrontend-Images"
  action        = "lambda:InvokeFunction"
  function_name = var.app_frontend_lambda_function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_api_gateway_rest_api.admin_api.execution_arn}/*/*/images/*"
}

# Permission for /fonts path (static assets served by app frontend Lambda - workflow 09)
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
# User Management Routes (Sys App Backend)
# Routes: /api/v1/user-management/* - Users, Groups, Roles APIs
# ==============================================

# Permission 6: /api/v1/user-management (base endpoint)
resource "aws_lambda_permission" "app_backend_user_management_base" {
  count         = var.app_backend_lambda_function_name != "" ? 1 : 0
  statement_id  = "AllowAPIGateway-UserManagementBase"
  action        = "lambda:InvokeFunction"
  function_name = var.app_backend_lambda_function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_api_gateway_rest_api.admin_api.execution_arn}/*/*/api/v1/user-management"
}

# Permission 7: /api/v1/user-management/* (all user management endpoints)
resource "aws_lambda_permission" "app_backend_user_management_all" {
  count         = var.app_backend_lambda_function_name != "" ? 1 : 0
  statement_id  = "AllowAPIGateway-UserManagementAll"
  action        = "lambda:InvokeFunction"
  function_name = var.app_backend_lambda_function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_api_gateway_rest_api.admin_api.execution_arn}/*/*/api/v1/user-management/*"
}

# Permission 8: /api/v1/user-management/users (users endpoint)
resource "aws_lambda_permission" "app_backend_users" {
  count         = var.app_backend_lambda_function_name != "" ? 1 : 0
  statement_id  = "AllowAPIGateway-UserManagementUsers"
  action        = "lambda:InvokeFunction"
  function_name = var.app_backend_lambda_function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_api_gateway_rest_api.admin_api.execution_arn}/*/*/api/v1/user-management/users"
}

# Permission 9: /api/v1/user-management/users/* (users with path params)
resource "aws_lambda_permission" "app_backend_users_proxy" {
  count         = var.app_backend_lambda_function_name != "" ? 1 : 0
  statement_id  = "AllowAPIGateway-UserManagementUsersProxy"
  action        = "lambda:InvokeFunction"
  function_name = var.app_backend_lambda_function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_api_gateway_rest_api.admin_api.execution_arn}/*/*/api/v1/user-management/users/*"
}

# Permission 10: /api/v1/user-management/groups (groups endpoint)
resource "aws_lambda_permission" "app_backend_groups" {
  count         = var.app_backend_lambda_function_name != "" ? 1 : 0
  statement_id  = "AllowAPIGateway-UserManagementGroups"
  action        = "lambda:InvokeFunction"
  function_name = var.app_backend_lambda_function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_api_gateway_rest_api.admin_api.execution_arn}/*/*/api/v1/user-management/groups"
}

# Permission 11: /api/v1/user-management/groups/* (groups with path params)
resource "aws_lambda_permission" "app_backend_groups_proxy" {
  count         = var.app_backend_lambda_function_name != "" ? 1 : 0
  statement_id  = "AllowAPIGateway-UserManagementGroupsProxy"
  action        = "lambda:InvokeFunction"
  function_name = var.app_backend_lambda_function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_api_gateway_rest_api.admin_api.execution_arn}/*/*/api/v1/user-management/groups/*"
}

# Permission 12: /api/v1/user-management/roles (roles endpoint)
resource "aws_lambda_permission" "app_backend_roles" {
  count         = var.app_backend_lambda_function_name != "" ? 1 : 0
  statement_id  = "AllowAPIGateway-UserManagementRoles"
  action        = "lambda:InvokeFunction"
  function_name = var.app_backend_lambda_function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_api_gateway_rest_api.admin_api.execution_arn}/*/*/api/v1/user-management/roles"
}

# Permission 13: /api/v1/user-management/roles/* (roles with path params)
resource "aws_lambda_permission" "app_backend_roles_proxy" {
  count         = var.app_backend_lambda_function_name != "" ? 1 : 0
  statement_id  = "AllowAPIGateway-UserManagementRolesProxy"
  action        = "lambda:InvokeFunction"
  function_name = var.app_backend_lambda_function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_api_gateway_rest_api.admin_api.execution_arn}/*/*/api/v1/user-management/roles/*"
}

# ==============================================
# Global Settings Routes (Sys App Backend)
# Routes: /api/v1/global-settings - Global Settings APIs
# ==============================================

# Permission 14: /api/v1/global-settings (base endpoint)
resource "aws_lambda_permission" "app_backend_global_settings" {
  count         = var.app_backend_lambda_function_name != "" ? 1 : 0
  statement_id  = "AllowAPIGateway-GlobalSettings"
  action        = "lambda:InvokeFunction"
  function_name = var.app_backend_lambda_function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_api_gateway_rest_api.admin_api.execution_arn}/*/*/api/v1/global-settings"
}

# Permission 15: /api/v1/global-settings/* (with path params)
resource "aws_lambda_permission" "app_backend_global_settings_proxy" {
  count         = var.app_backend_lambda_function_name != "" ? 1 : 0
  statement_id  = "AllowAPIGateway-GlobalSettingsProxy"
  action        = "lambda:InvokeFunction"
  function_name = var.app_backend_lambda_function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_api_gateway_rest_api.admin_api.execution_arn}/*/*/api/v1/global-settings/*"
}

# Permission 16: /api/v1/app/api/global-settings (legacy path)
resource "aws_lambda_permission" "app_backend_global_settings_legacy" {
  count         = var.app_backend_lambda_function_name != "" ? 1 : 0
  statement_id  = "AllowAPIGateway-GlobalSettingsLegacy"
  action        = "lambda:InvokeFunction"
  function_name = var.app_backend_lambda_function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_api_gateway_rest_api.admin_api.execution_arn}/*/*/api/v1/app/api/global-settings"
}

# Permission 17: /api/v1/app/api/global-settings/* (legacy path with path params)
resource "aws_lambda_permission" "app_backend_global_settings_legacy_proxy" {
  count         = var.app_backend_lambda_function_name != "" ? 1 : 0
  statement_id  = "AllowAPIGateway-GlobalSettingsLegacyProxy"
  action        = "lambda:InvokeFunction"
  function_name = var.app_backend_lambda_function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_api_gateway_rest_api.admin_api.execution_arn}/*/*/api/v1/app/api/global-settings/*"
}

# ==============================================
# Credentials Routes (Sys App Backend)
# Routes: /api/v1/app/api/credentials - Credentials Management
# ==============================================

# Permission 18: /api/v1/app/api/credentials (credentials base endpoint)
resource "aws_lambda_permission" "app_backend_credentials" {
  count         = var.app_backend_lambda_function_name != "" ? 1 : 0
  statement_id  = "AllowAPIGateway-Credentials"
  action        = "lambda:InvokeFunction"
  function_name = var.app_backend_lambda_function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_api_gateway_rest_api.admin_api.execution_arn}/*/*/api/v1/app/api/credentials"
}

# Permission 19: /api/v1/app/api/credentials/* (credentials with path params)
resource "aws_lambda_permission" "app_backend_credentials_proxy" {
  count         = var.app_backend_lambda_function_name != "" ? 1 : 0
  statement_id  = "AllowAPIGateway-CredentialsProxy"
  action        = "lambda:InvokeFunction"
  function_name = var.app_backend_lambda_function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_api_gateway_rest_api.admin_api.execution_arn}/*/*/api/v1/app/api/credentials/*"
}

# ==============================================
# Accounts Routes (Sys App Backend)
# Routes: /api/v1/app/api/accounts - Account Management
# ==============================================

resource "aws_lambda_permission" "app_backend_accounts" {
  count         = var.app_backend_lambda_function_name != "" ? 1 : 0
  statement_id  = "AllowAPIGateway-Accounts"
  action        = "lambda:InvokeFunction"
  function_name = var.app_backend_lambda_function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_api_gateway_rest_api.admin_api.execution_arn}/*/*/api/v1/app/api/accounts"
}

resource "aws_lambda_permission" "app_backend_accounts_proxy" {
  count         = var.app_backend_lambda_function_name != "" ? 1 : 0
  statement_id  = "AllowAPIGateway-AccountsProxy"
  action        = "lambda:InvokeFunction"
  function_name = var.app_backend_lambda_function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_api_gateway_rest_api.admin_api.execution_arn}/*/*/api/v1/app/api/accounts/*"
}

# ==============================================
# Enterprises Routes (Sys App Backend)
# Routes: /api/v1/app/api/enterprises - Enterprise Management
# ==============================================

resource "aws_lambda_permission" "app_backend_enterprises_api" {
  count         = var.app_backend_lambda_function_name != "" ? 1 : 0
  statement_id  = "AllowAPIGateway-EnterprisesApi"
  action        = "lambda:InvokeFunction"
  function_name = var.app_backend_lambda_function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_api_gateway_rest_api.admin_api.execution_arn}/*/*/api/v1/app/api/enterprises"
}

resource "aws_lambda_permission" "app_backend_enterprises_api_proxy" {
  count         = var.app_backend_lambda_function_name != "" ? 1 : 0
  statement_id  = "AllowAPIGateway-EnterprisesApiProxy"
  action        = "lambda:InvokeFunction"
  function_name = var.app_backend_lambda_function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_api_gateway_rest_api.admin_api.execution_arn}/*/*/api/v1/app/api/enterprises/*"
}

# ==============================================
# Products Routes (Sys App Backend)
# Routes: /api/v1/app/api/products - Product Management
# ==============================================

resource "aws_lambda_permission" "app_backend_products" {
  count         = var.app_backend_lambda_function_name != "" ? 1 : 0
  statement_id  = "AllowAPIGateway-Products"
  action        = "lambda:InvokeFunction"
  function_name = var.app_backend_lambda_function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_api_gateway_rest_api.admin_api.execution_arn}/*/*/api/v1/app/api/products"
}

resource "aws_lambda_permission" "app_backend_products_proxy" {
  count         = var.app_backend_lambda_function_name != "" ? 1 : 0
  statement_id  = "AllowAPIGateway-ProductsProxy"
  action        = "lambda:InvokeFunction"
  function_name = var.app_backend_lambda_function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_api_gateway_rest_api.admin_api.execution_arn}/*/*/api/v1/app/api/products/*"
}

# ==============================================
# Services Routes (Sys App Backend)
# Routes: /api/v1/app/api/services - Service Management
# ==============================================

resource "aws_lambda_permission" "app_backend_services" {
  count         = var.app_backend_lambda_function_name != "" ? 1 : 0
  statement_id  = "AllowAPIGateway-Services"
  action        = "lambda:InvokeFunction"
  function_name = var.app_backend_lambda_function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_api_gateway_rest_api.admin_api.execution_arn}/*/*/api/v1/app/api/services"
}

resource "aws_lambda_permission" "app_backend_services_proxy" {
  count         = var.app_backend_lambda_function_name != "" ? 1 : 0
  statement_id  = "AllowAPIGateway-ServicesProxy"
  action        = "lambda:InvokeFunction"
  function_name = var.app_backend_lambda_function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_api_gateway_rest_api.admin_api.execution_arn}/*/*/api/v1/app/api/services/*"
}

# ==============================================
# Users Routes (Sys App Backend)
# Routes: /api/v1/app/api/users - User Management
# ==============================================

resource "aws_lambda_permission" "app_backend_app_users" {
  count         = var.app_backend_lambda_function_name != "" ? 1 : 0
  statement_id  = "AllowAPIGateway-AppUsers"
  action        = "lambda:InvokeFunction"
  function_name = var.app_backend_lambda_function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_api_gateway_rest_api.admin_api.execution_arn}/*/*/api/v1/app/api/users"
}

resource "aws_lambda_permission" "app_backend_app_users_proxy" {
  count         = var.app_backend_lambda_function_name != "" ? 1 : 0
  statement_id  = "AllowAPIGateway-AppUsersProxy"
  action        = "lambda:InvokeFunction"
  function_name = var.app_backend_lambda_function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_api_gateway_rest_api.admin_api.execution_arn}/*/*/api/v1/app/api/users/*"
}

# ==============================================
# User Groups Routes (Sys App Backend)
# Routes: /api/v1/app/api/user-groups - User Group Management
# ==============================================

resource "aws_lambda_permission" "app_backend_user_groups" {
  count         = var.app_backend_lambda_function_name != "" ? 1 : 0
  statement_id  = "AllowAPIGateway-UserGroups"
  action        = "lambda:InvokeFunction"
  function_name = var.app_backend_lambda_function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_api_gateway_rest_api.admin_api.execution_arn}/*/*/api/v1/app/api/user-groups"
}

resource "aws_lambda_permission" "app_backend_user_groups_proxy" {
  count         = var.app_backend_lambda_function_name != "" ? 1 : 0
  statement_id  = "AllowAPIGateway-UserGroupsProxy"
  action        = "lambda:InvokeFunction"
  function_name = var.app_backend_lambda_function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_api_gateway_rest_api.admin_api.execution_arn}/*/*/api/v1/app/api/user-groups/*"
}

# ==============================================
# Groups Routes (Sys App Backend)
# Routes: /api/v1/app/api/groups - Group Management
# ==============================================

resource "aws_lambda_permission" "app_backend_app_groups" {
  count         = var.app_backend_lambda_function_name != "" ? 1 : 0
  statement_id  = "AllowAPIGateway-AppGroups"
  action        = "lambda:InvokeFunction"
  function_name = var.app_backend_lambda_function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_api_gateway_rest_api.admin_api.execution_arn}/*/*/api/v1/app/api/groups"
}

resource "aws_lambda_permission" "app_backend_app_groups_proxy" {
  count         = var.app_backend_lambda_function_name != "" ? 1 : 0
  statement_id  = "AllowAPIGateway-AppGroupsProxy"
  action        = "lambda:InvokeFunction"
  function_name = var.app_backend_lambda_function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_api_gateway_rest_api.admin_api.execution_arn}/*/*/api/v1/app/api/groups/*"
}

# ==============================================
# Roles Routes (Sys App Backend)
# Routes: /api/v1/app/api/roles - Role Management
# ==============================================

resource "aws_lambda_permission" "app_backend_app_roles" {
  count         = var.app_backend_lambda_function_name != "" ? 1 : 0
  statement_id  = "AllowAPIGateway-AppRoles"
  action        = "lambda:InvokeFunction"
  function_name = var.app_backend_lambda_function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_api_gateway_rest_api.admin_api.execution_arn}/*/*/api/v1/app/api/roles"
}

resource "aws_lambda_permission" "app_backend_app_roles_proxy" {
  count         = var.app_backend_lambda_function_name != "" ? 1 : 0
  statement_id  = "AllowAPIGateway-AppRolesProxy"
  action        = "lambda:InvokeFunction"
  function_name = var.app_backend_lambda_function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_api_gateway_rest_api.admin_api.execution_arn}/*/*/api/v1/app/api/roles/*"
}

# ==============================================
# Entities Routes (Sys App Backend)
# Routes: /api/v1/app/api/entities - Entity Management
# ==============================================

resource "aws_lambda_permission" "app_backend_entities" {
  count         = var.app_backend_lambda_function_name != "" ? 1 : 0
  statement_id  = "AllowAPIGateway-Entities"
  action        = "lambda:InvokeFunction"
  function_name = var.app_backend_lambda_function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_api_gateway_rest_api.admin_api.execution_arn}/*/*/api/v1/app/api/entities"
}

resource "aws_lambda_permission" "app_backend_entities_proxy" {
  count         = var.app_backend_lambda_function_name != "" ? 1 : 0
  statement_id  = "AllowAPIGateway-EntitiesProxy"
  action        = "lambda:InvokeFunction"
  function_name = var.app_backend_lambda_function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_api_gateway_rest_api.admin_api.execution_arn}/*/*/api/v1/app/api/entities/*"
}

# ==============================================
# Enterprise Products Services Routes (Sys App Backend)
# ==============================================

resource "aws_lambda_permission" "app_backend_eps" {
  count         = var.app_backend_lambda_function_name != "" ? 1 : 0
  statement_id  = "AllowAPIGateway-EPS"
  action        = "lambda:InvokeFunction"
  function_name = var.app_backend_lambda_function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_api_gateway_rest_api.admin_api.execution_arn}/*/*/api/v1/app/api/enterprise-products-services"
}

resource "aws_lambda_permission" "app_backend_eps_proxy" {
  count         = var.app_backend_lambda_function_name != "" ? 1 : 0
  statement_id  = "AllowAPIGateway-EPSProxy"
  action        = "lambda:InvokeFunction"
  function_name = var.app_backend_lambda_function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_api_gateway_rest_api.admin_api.execution_arn}/*/*/api/v1/app/api/enterprise-products-services/*"
}

# ==============================================
# Pipeline Canvas Routes (Sys App Backend)
# ==============================================

resource "aws_lambda_permission" "app_backend_pipeline_canvas" {
  count         = var.app_backend_lambda_function_name != "" ? 1 : 0
  statement_id  = "AllowAPIGateway-PipelineCanvas"
  action        = "lambda:InvokeFunction"
  function_name = var.app_backend_lambda_function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_api_gateway_rest_api.admin_api.execution_arn}/*/*/api/v1/app/api/pipeline-canvas"
}

resource "aws_lambda_permission" "app_backend_pipeline_canvas_proxy" {
  count         = var.app_backend_lambda_function_name != "" ? 1 : 0
  statement_id  = "AllowAPIGateway-PipelineCanvasProxy"
  action        = "lambda:InvokeFunction"
  function_name = var.app_backend_lambda_function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_api_gateway_rest_api.admin_api.execution_arn}/*/*/api/v1/app/api/pipeline-canvas/*"
}

# ==============================================
# Account Licenses Routes (Sys App Backend)
# ==============================================

resource "aws_lambda_permission" "app_backend_account_licenses" {
  count         = var.app_backend_lambda_function_name != "" ? 1 : 0
  statement_id  = "AllowAPIGateway-AccountLicenses"
  action        = "lambda:InvokeFunction"
  function_name = var.app_backend_lambda_function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_api_gateway_rest_api.admin_api.execution_arn}/*/*/api/v1/app/api/account-licenses"
}

resource "aws_lambda_permission" "app_backend_account_licenses_proxy" {
  count         = var.app_backend_lambda_function_name != "" ? 1 : 0
  statement_id  = "AllowAPIGateway-AccountLicensesProxy"
  action        = "lambda:InvokeFunction"
  function_name = var.app_backend_lambda_function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_api_gateway_rest_api.admin_api.execution_arn}/*/*/api/v1/app/api/account-licenses/*"
}

# ==============================================
# User Management Routes (Sys App Backend)
# ==============================================

resource "aws_lambda_permission" "app_backend_user_management" {
  count         = var.app_backend_lambda_function_name != "" ? 1 : 0
  statement_id  = "AllowAPIGateway-UserManagement"
  action        = "lambda:InvokeFunction"
  function_name = var.app_backend_lambda_function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_api_gateway_rest_api.admin_api.execution_arn}/*/*/api/v1/app/api/user-management"
}

resource "aws_lambda_permission" "app_backend_user_management_proxy" {
  count         = var.app_backend_lambda_function_name != "" ? 1 : 0
  statement_id  = "AllowAPIGateway-UserManagementProxy"
  action        = "lambda:InvokeFunction"
  function_name = var.app_backend_lambda_function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_api_gateway_rest_api.admin_api.execution_arn}/*/*/api/v1/app/api/user-management/*"
}

# ==============================================
# User Preferences Routes (Sys App Backend)
# ==============================================

resource "aws_lambda_permission" "app_backend_user_preferences" {
  count         = var.app_backend_lambda_function_name != "" ? 1 : 0
  statement_id  = "AllowAPIGateway-UserPreferences"
  action        = "lambda:InvokeFunction"
  function_name = var.app_backend_lambda_function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_api_gateway_rest_api.admin_api.execution_arn}/*/*/api/v1/app/api/user-preferences"
}

resource "aws_lambda_permission" "app_backend_user_preferences_proxy" {
  count         = var.app_backend_lambda_function_name != "" ? 1 : 0
  statement_id  = "AllowAPIGateway-UserPreferencesProxy"
  action        = "lambda:InvokeFunction"
  function_name = var.app_backend_lambda_function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_api_gateway_rest_api.admin_api.execution_arn}/*/*/api/v1/app/api/user-preferences/*"
}

# ==============================================
# Environments Routes (Sys App Backend)
# Routes: /api/v1/app/api/environments - Environment Management
# ==============================================

# Permission 18a: /api/v1/app/api/environments (environments base endpoint)
resource "aws_lambda_permission" "app_backend_environments" {
  count         = var.app_backend_lambda_function_name != "" ? 1 : 0
  statement_id  = "AllowAPIGateway-Environments"
  action        = "lambda:InvokeFunction"
  function_name = var.app_backend_lambda_function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_api_gateway_rest_api.admin_api.execution_arn}/*/*/api/v1/app/api/environments"
}

# Permission 18b: /api/v1/app/api/environments/* (environments with path params)
resource "aws_lambda_permission" "app_backend_environments_proxy" {
  count         = var.app_backend_lambda_function_name != "" ? 1 : 0
  statement_id  = "AllowAPIGateway-EnvironmentsProxy"
  action        = "lambda:InvokeFunction"
  function_name = var.app_backend_lambda_function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_api_gateway_rest_api.admin_api.execution_arn}/*/*/api/v1/app/api/environments/*"
}

# ==============================================
# Connectors Routes (Sys App Backend)
# Routes: /api/v1/app/api/connectors - Connector Management
# ==============================================

# Permission 19a: /api/v1/app/api/connectors (connectors base endpoint)
resource "aws_lambda_permission" "app_backend_connectors" {
  count         = var.app_backend_lambda_function_name != "" ? 1 : 0
  statement_id  = "AllowAPIGateway-Connectors"
  action        = "lambda:InvokeFunction"
  function_name = var.app_backend_lambda_function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_api_gateway_rest_api.admin_api.execution_arn}/*/*/api/v1/app/api/connectors"
}

# Permission 19b: /api/v1/app/api/connectors/* (connectors with path params)
resource "aws_lambda_permission" "app_backend_connectors_proxy" {
  count         = var.app_backend_lambda_function_name != "" ? 1 : 0
  statement_id  = "AllowAPIGateway-ConnectorsProxy"
  action        = "lambda:InvokeFunction"
  function_name = var.app_backend_lambda_function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_api_gateway_rest_api.admin_api.execution_arn}/*/*/api/v1/app/api/connectors/*"
}

# ==============================================
# Build Integrations Routes (Sys App Backend)
# Routes: /api/v1/app/api/builds/integrations - Build Integrations Management
# ==============================================

# Permission 19c: /api/v1/app/api/builds/integrations (builds/integrations base endpoint)
resource "aws_lambda_permission" "app_backend_builds_integrations" {
  count         = var.app_backend_lambda_function_name != "" ? 1 : 0
  statement_id  = "AllowAPIGateway-BuildsIntegrations"
  action        = "lambda:InvokeFunction"
  function_name = var.app_backend_lambda_function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_api_gateway_rest_api.admin_api.execution_arn}/*/*/api/v1/app/api/builds/integrations"
}

# Permission 19d: /api/v1/app/api/builds/integrations/* (builds/integrations with path params)
resource "aws_lambda_permission" "app_backend_builds_integrations_proxy" {
  count         = var.app_backend_lambda_function_name != "" ? 1 : 0
  statement_id  = "AllowAPIGateway-BuildsIntegrationsProxy"
  action        = "lambda:InvokeFunction"
  function_name = var.app_backend_lambda_function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_api_gateway_rest_api.admin_api.execution_arn}/*/*/api/v1/app/api/builds/integrations/*"
}

# ==============================================
# Build Executions Routes (Sys App Backend)
# Routes: /api/v1/app/api/build-executions
# ==============================================

resource "aws_lambda_permission" "app_backend_build_executions" {
  count         = var.app_backend_lambda_function_name != "" ? 1 : 0
  statement_id  = "AllowAPIGateway-BuildExecutions"
  action        = "lambda:InvokeFunction"
  function_name = var.app_backend_lambda_function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_api_gateway_rest_api.admin_api.execution_arn}/*/*/api/v1/app/api/build-executions"
}

resource "aws_lambda_permission" "app_backend_build_executions_proxy" {
  count         = var.app_backend_lambda_function_name != "" ? 1 : 0
  statement_id  = "AllowAPIGateway-BuildExecutionsProxy"
  action        = "lambda:InvokeFunction"
  function_name = var.app_backend_lambda_function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_api_gateway_rest_api.admin_api.execution_arn}/*/*/api/v1/app/api/build-executions/*"
}

# ==============================================
# Pipelines Routes (Sys App Backend)
# Routes: /api/v1/app/api/pipelines
# ==============================================

resource "aws_lambda_permission" "app_backend_pipelines_api" {
  count         = var.app_backend_lambda_function_name != "" ? 1 : 0
  statement_id  = "AllowAPIGateway-PipelinesApi"
  action        = "lambda:InvokeFunction"
  function_name = var.app_backend_lambda_function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_api_gateway_rest_api.admin_api.execution_arn}/*/*/api/v1/app/api/pipelines"
}

resource "aws_lambda_permission" "app_backend_pipelines_api_proxy" {
  count         = var.app_backend_lambda_function_name != "" ? 1 : 0
  statement_id  = "AllowAPIGateway-PipelinesApiProxy"
  action        = "lambda:InvokeFunction"
  function_name = var.app_backend_lambda_function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_api_gateway_rest_api.admin_api.execution_arn}/*/*/api/v1/app/api/pipelines/*"
}

# ==============================================
# Pipeline Details Routes (Sys App Backend)
# Routes: /api/v1/app/api/pipeline-details
# ==============================================

resource "aws_lambda_permission" "app_backend_pipeline_details" {
  count         = var.app_backend_lambda_function_name != "" ? 1 : 0
  statement_id  = "AllowAPIGateway-PipelineDetails"
  action        = "lambda:InvokeFunction"
  function_name = var.app_backend_lambda_function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_api_gateway_rest_api.admin_api.execution_arn}/*/*/api/v1/app/api/pipeline-details"
}

resource "aws_lambda_permission" "app_backend_pipeline_details_proxy" {
  count         = var.app_backend_lambda_function_name != "" ? 1 : 0
  statement_id  = "AllowAPIGateway-PipelineDetailsProxy"
  action        = "lambda:InvokeFunction"
  function_name = var.app_backend_lambda_function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_api_gateway_rest_api.admin_api.execution_arn}/*/*/api/v1/app/api/pipeline-details/*"
}

# ==============================================
# Pipeline Services Routes (Sys App Backend)
# Routes: /api/v1/app/api/pipeline-services
# ==============================================

resource "aws_lambda_permission" "app_backend_pipeline_services" {
  count         = var.app_backend_lambda_function_name != "" ? 1 : 0
  statement_id  = "AllowAPIGateway-PipelineServices"
  action        = "lambda:InvokeFunction"
  function_name = var.app_backend_lambda_function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_api_gateway_rest_api.admin_api.execution_arn}/*/*/api/v1/app/api/pipeline-services"
}

resource "aws_lambda_permission" "app_backend_pipeline_services_proxy" {
  count         = var.app_backend_lambda_function_name != "" ? 1 : 0
  statement_id  = "AllowAPIGateway-PipelineServicesProxy"
  action        = "lambda:InvokeFunction"
  function_name = var.app_backend_lambda_function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_api_gateway_rest_api.admin_api.execution_arn}/*/*/api/v1/app/api/pipeline-services/*"
}

# ==============================================
# Pipeline YAML Routes (Sys App Backend)
# Routes: /api/v1/app/api/pipeline-yaml
# ==============================================

resource "aws_lambda_permission" "app_backend_pipeline_yaml" {
  count         = var.app_backend_lambda_function_name != "" ? 1 : 0
  statement_id  = "AllowAPIGateway-PipelineYaml"
  action        = "lambda:InvokeFunction"
  function_name = var.app_backend_lambda_function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_api_gateway_rest_api.admin_api.execution_arn}/*/*/api/v1/app/api/pipeline-yaml"
}

resource "aws_lambda_permission" "app_backend_pipeline_yaml_proxy" {
  count         = var.app_backend_lambda_function_name != "" ? 1 : 0
  statement_id  = "AllowAPIGateway-PipelineYamlProxy"
  action        = "lambda:InvokeFunction"
  function_name = var.app_backend_lambda_function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_api_gateway_rest_api.admin_api.execution_arn}/*/*/api/v1/app/api/pipeline-yaml/*"
}

# ==============================================
# Pipeline Config Routes (Sys App Backend)
# Routes: /api/v1/app/api/pipeline-config
# ==============================================

resource "aws_lambda_permission" "app_backend_pipeline_config" {
  count         = var.app_backend_lambda_function_name != "" ? 1 : 0
  statement_id  = "AllowAPIGateway-PipelineConfig"
  action        = "lambda:InvokeFunction"
  function_name = var.app_backend_lambda_function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_api_gateway_rest_api.admin_api.execution_arn}/*/*/api/v1/app/api/pipeline-config"
}

resource "aws_lambda_permission" "app_backend_pipeline_config_proxy" {
  count         = var.app_backend_lambda_function_name != "" ? 1 : 0
  statement_id  = "AllowAPIGateway-PipelineConfigProxy"
  action        = "lambda:InvokeFunction"
  function_name = var.app_backend_lambda_function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_api_gateway_rest_api.admin_api.execution_arn}/*/*/api/v1/app/api/pipeline-config/*"
}

# ==============================================
# Pipeline Routes (Sys App Backend) - Legacy
# Routes: /api/v1/pipelines, /api/v1/pipeline-canvas, etc.
# ==============================================

# Permission 20: /api/v1/pipelines
resource "aws_lambda_permission" "app_backend_v1_pipelines" {
  count         = var.app_backend_lambda_function_name != "" ? 1 : 0
  statement_id  = "AllowAPIGateway-V1Pipelines"
  action        = "lambda:InvokeFunction"
  function_name = var.app_backend_lambda_function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_api_gateway_rest_api.admin_api.execution_arn}/*/*/api/v1/pipelines"
}

# Permission 21: /api/v1/pipelines/*
resource "aws_lambda_permission" "app_backend_pipelines_proxy" {
  count         = var.app_backend_lambda_function_name != "" ? 1 : 0
  statement_id  = "AllowAPIGateway-PipelinesProxy"
  action        = "lambda:InvokeFunction"
  function_name = var.app_backend_lambda_function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_api_gateway_rest_api.admin_api.execution_arn}/*/*/api/v1/pipelines/*"
}

# Permission 22: /api/v1/pipeline-canvas
resource "aws_lambda_permission" "app_backend_v1_pipeline_canvas" {
  count         = var.app_backend_lambda_function_name != "" ? 1 : 0
  statement_id  = "AllowAPIGateway-V1PipelineCanvas"
  action        = "lambda:InvokeFunction"
  function_name = var.app_backend_lambda_function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_api_gateway_rest_api.admin_api.execution_arn}/*/*/api/v1/pipeline-canvas"
}

# Permission 23: /api/v1/pipeline-canvas/*
resource "aws_lambda_permission" "app_backend_v1_pipeline_canvas_proxy" {
  count         = var.app_backend_lambda_function_name != "" ? 1 : 0
  statement_id  = "AllowAPIGateway-V1PipelineCanvasProxy"
  action        = "lambda:InvokeFunction"
  function_name = var.app_backend_lambda_function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_api_gateway_rest_api.admin_api.execution_arn}/*/*/api/v1/pipeline-canvas/*"
}

# Permission 24: /api/v1/pipeline-details
resource "aws_lambda_permission" "app_backend_v1_pipeline_details" {
  count         = var.app_backend_lambda_function_name != "" ? 1 : 0
  statement_id  = "AllowAPIGateway-V1PipelineDetails"
  action        = "lambda:InvokeFunction"
  function_name = var.app_backend_lambda_function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_api_gateway_rest_api.admin_api.execution_arn}/*/*/api/v1/pipeline-details"
}

# Permission 25: /api/v1/pipeline-details/*
resource "aws_lambda_permission" "app_backend_v1_pipeline_details_proxy" {
  count         = var.app_backend_lambda_function_name != "" ? 1 : 0
  statement_id  = "AllowAPIGateway-V1PipelineDetailsProxy"
  action        = "lambda:InvokeFunction"
  function_name = var.app_backend_lambda_function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_api_gateway_rest_api.admin_api.execution_arn}/*/*/api/v1/pipeline-details/*"
}

# Permission 26: /api/v1/pipeline-services
resource "aws_lambda_permission" "app_backend_v1_pipeline_services" {
  count         = var.app_backend_lambda_function_name != "" ? 1 : 0
  statement_id  = "AllowAPIGateway-V1PipelineServices"
  action        = "lambda:InvokeFunction"
  function_name = var.app_backend_lambda_function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_api_gateway_rest_api.admin_api.execution_arn}/*/*/api/v1/pipeline-services"
}

# Permission 27: /api/v1/pipeline-services/*
resource "aws_lambda_permission" "app_backend_v1_pipeline_services_proxy" {
  count         = var.app_backend_lambda_function_name != "" ? 1 : 0
  statement_id  = "AllowAPIGateway-V1PipelineServicesProxy"
  action        = "lambda:InvokeFunction"
  function_name = var.app_backend_lambda_function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_api_gateway_rest_api.admin_api.execution_arn}/*/*/api/v1/pipeline-services/*"
}

# ==============================================
# AI Routes (Sys App Backend)
# Routes: /api/v1/ai - AI insights and suggestions
# ==============================================

# Permission 28: /api/v1/ai
resource "aws_lambda_permission" "app_backend_ai" {
  count         = var.app_backend_lambda_function_name != "" ? 1 : 0
  statement_id  = "AllowAPIGateway-AI"
  action        = "lambda:InvokeFunction"
  function_name = var.app_backend_lambda_function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_api_gateway_rest_api.admin_api.execution_arn}/*/*/api/v1/ai"
}

# Permission 29: /api/v1/ai/*
resource "aws_lambda_permission" "app_backend_ai_proxy" {
  count         = var.app_backend_lambda_function_name != "" ? 1 : 0
  statement_id  = "AllowAPIGateway-AIProxy"
  action        = "lambda:InvokeFunction"
  function_name = var.app_backend_lambda_function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_api_gateway_rest_api.admin_api.execution_arn}/*/*/api/v1/ai/*"
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
