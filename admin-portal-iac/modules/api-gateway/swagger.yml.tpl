swagger: "2.0"
info:
  version: "1.0.0"
  title: "${api_name}"
  description: "Admin Portal API Gateway - Manages account operations and identity services"

schemes:
  - "https"

securityDefinitions:
  jwt-authorizer:
    type: "apiKey"
    name: "Authorization"
    in: "header"
    x-amazon-apigateway-authtype: "custom"
    x-amazon-apigateway-authorizer:
      authorizerUri: "${jwt_authorizer_uri}"
      authorizerResultTtlInSeconds: 0
      type: "token"

paths:
  # ==============================================
  # Frontend Web Server (Public)
  # ==============================================
  /{proxy+}:
    x-amazon-apigateway-any-method:
      summary: "Frontend web application (public)"
      produces:
        - "text/html"
        - "application/javascript"
        - "text/css"
        - "application/json"
      parameters:
        - name: "proxy"
          in: "path"
          required: true
          type: "string"
      responses:
        "200":
          description: "200 response"
      x-amazon-apigateway-integration:
        type: "aws_proxy"
        uri: "${admin_portal_lambda_uri}"
        httpMethod: "POST"
        passthroughBehavior: "when_no_match"

  # ==============================================
  # Account Management Routes (Protected)
  # ==============================================
  /api/v1/accounts:
    get:
      summary: "Get all accounts"
      produces:
        - "application/json"
      security:
        - jwt-authorizer: []
      responses:
        "200":
          description: "200 response"
      x-amazon-apigateway-integration:
        type: "aws_proxy"
        uri: "${admin_backend_lambda_uri}"
        httpMethod: "POST"
        passthroughBehavior: "when_no_match"

  /api/v1/accounts/{accountId}:
    get:
      summary: "Get account by ID"
      produces:
        - "application/json"
      security:
        - jwt-authorizer: []
      parameters:
        - name: "accountId"
          in: "path"
          required: true
          type: "string"
      responses:
        "200":
          description: "200 response"
      x-amazon-apigateway-integration:
        type: "aws_proxy"
        uri: "${admin_backend_lambda_uri}"
        httpMethod: "POST"
        passthroughBehavior: "when_no_match"

  /api/v1/accounts/onboard:
    post:
      summary: "Onboard new account"
      produces:
        - "application/json"
      security:
        - jwt-authorizer: []
      responses:
        "200":
          description: "200 response"
      x-amazon-apigateway-integration:
        type: "aws_proxy"
        uri: "${admin_backend_lambda_uri}"
        httpMethod: "POST"
        passthroughBehavior: "when_no_match"

    put:
      summary: "Update account onboarding"
      produces:
        - "application/json"
      security:
        - jwt-authorizer: []
      responses:
        "200":
          description: "200 response"
      x-amazon-apigateway-integration:
        type: "aws_proxy"
        uri: "${admin_backend_lambda_uri}"
        httpMethod: "POST"
        passthroughBehavior: "when_no_match"

  /api/v1/accounts/offboard:
    delete:
      summary: "Offboard account"
      produces:
        - "application/json"
      security:
        - jwt-authorizer: []
      responses:
        "200":
          description: "200 response"
      x-amazon-apigateway-integration:
        type: "aws_proxy"
        uri: "${admin_backend_lambda_uri}"
        httpMethod: "POST"
        passthroughBehavior: "when_no_match"

  /api/v1/accounts/suspend:
    put:
      summary: "Suspend account"
      produces:
        - "application/json"
      security:
        - jwt-authorizer: []
      responses:
        "200":
          description: "200 response"
      x-amazon-apigateway-integration:
        type: "aws_proxy"
        uri: "${admin_backend_lambda_uri}"
        httpMethod: "POST"
        passthroughBehavior: "when_no_match"

  # ==============================================
  # IMS Service Routes - Auth (Public)
  # ==============================================
  /api/v1/auth/{proxy+}:
    x-amazon-apigateway-any-method:
      summary: "Authentication endpoints (public)"
      produces:
        - "application/json"
      parameters:
        - name: "proxy"
          in: "path"
          required: true
          type: "string"
      responses:
        "200":
          description: "200 response"
      x-amazon-apigateway-integration:
        type: "aws_proxy"
        uri: "${ims_service_lambda_uri}"
        httpMethod: "POST"
        passthroughBehavior: "when_no_match"

  # ==============================================
  # IMS Service Routes - Users (Protected)
  # ==============================================
  /api/v1/users:
    x-amazon-apigateway-any-method:
      summary: "User management base endpoint (protected)"
      produces:
        - "application/json"
      security:
        - jwt-authorizer: []
      responses:
        "200":
          description: "200 response"
      x-amazon-apigateway-integration:
        type: "aws_proxy"
        uri: "${ims_service_lambda_uri}"
        httpMethod: "POST"
        passthroughBehavior: "when_no_match"

  /api/v1/users/{proxy+}:
    x-amazon-apigateway-any-method:
      summary: "User management endpoints (protected)"
      produces:
        - "application/json"
      security:
        - jwt-authorizer: []
      parameters:
        - name: "proxy"
          in: "path"
          required: true
          type: "string"
      responses:
        "200":
          description: "200 response"
      x-amazon-apigateway-integration:
        type: "aws_proxy"
        uri: "${ims_service_lambda_uri}"
        httpMethod: "POST"
        passthroughBehavior: "when_no_match"

  # ==============================================
  # IMS Service Routes - Roles (Protected)
  # ==============================================
  /api/v1/roles:
    x-amazon-apigateway-any-method:
      summary: "Role management base endpoint (protected)"
      produces:
        - "application/json"
      security:
        - jwt-authorizer: []
      responses:
        "200":
          description: "200 response"
      x-amazon-apigateway-integration:
        type: "aws_proxy"
        uri: "${ims_service_lambda_uri}"
        httpMethod: "POST"
        passthroughBehavior: "when_no_match"

  /api/v1/roles/{proxy+}:
    x-amazon-apigateway-any-method:
      summary: "Role management endpoints (protected)"
      produces:
        - "application/json"
      security:
        - jwt-authorizer: []
      parameters:
        - name: "proxy"
          in: "path"
          required: true
          type: "string"
      responses:
        "200":
          description: "200 response"
      x-amazon-apigateway-integration:
        type: "aws_proxy"
        uri: "${ims_service_lambda_uri}"
        httpMethod: "POST"
        passthroughBehavior: "when_no_match"

  # ==============================================
  # IMS Service Routes - RBAC (Protected)
  # ==============================================
  /api/v1/rbac:
    x-amazon-apigateway-any-method:
      summary: "RBAC base endpoint (protected)"
      produces:
        - "application/json"
      security:
        - jwt-authorizer: []
      responses:
        "200":
          description: "200 response"
      x-amazon-apigateway-integration:
        type: "aws_proxy"
        uri: "${ims_service_lambda_uri}"
        httpMethod: "POST"
        passthroughBehavior: "when_no_match"

  /api/v1/rbac/{proxy+}:
    x-amazon-apigateway-any-method:
      summary: "RBAC endpoints (protected)"
      produces:
        - "application/json"
      security:
        - jwt-authorizer: []
      parameters:
        - name: "proxy"
          in: "path"
          required: true
          type: "string"
      responses:
        "200":
          description: "200 response"
      x-amazon-apigateway-integration:
        type: "aws_proxy"
        uri: "${ims_service_lambda_uri}"
        httpMethod: "POST"
        passthroughBehavior: "when_no_match"

  # ==============================================
  # IMS Service Routes - Context (Protected)
  # ==============================================
  /api/v1/context:
    x-amazon-apigateway-any-method:
      summary: "Context base endpoint (protected)"
      produces:
        - "application/json"
      security:
        - jwt-authorizer: []
      responses:
        "200":
          description: "200 response"
      x-amazon-apigateway-integration:
        type: "aws_proxy"
        uri: "${ims_service_lambda_uri}"
        httpMethod: "POST"
        passthroughBehavior: "when_no_match"

  /api/v1/context/{proxy+}:
    x-amazon-apigateway-any-method:
      summary: "Context endpoints (protected)"
      produces:
        - "application/json"
      security:
        - jwt-authorizer: []
      parameters:
        - name: "proxy"
          in: "path"
          required: true
          type: "string"
      responses:
        "200":
          description: "200 response"
      x-amazon-apigateway-integration:
        type: "aws_proxy"
        uri: "${ims_service_lambda_uri}"
        httpMethod: "POST"
        passthroughBehavior: "when_no_match"

  # ==============================================
  # OMS Service Routes - Order Management (Protected)
  # ==============================================
  /api/v1/oms/customers:
    x-amazon-apigateway-any-method:
      summary: "Customer management (protected)"
      produces:
        - "application/json"
      security:
        - jwt-authorizer: []
      responses:
        "200":
          description: "200 response"
      x-amazon-apigateway-integration:
        type: "aws_proxy"
        uri: "${oms_service_lambda_uri}"
        httpMethod: "POST"
        passthroughBehavior: "when_no_match"

  /api/v1/oms/customers/{proxy+}:
    x-amazon-apigateway-any-method:
      summary: "Customer management endpoints (protected)"
      produces:
        - "application/json"
      security:
        - jwt-authorizer: []
      parameters:
        - name: "proxy"
          in: "path"
          required: true
          type: "string"
      responses:
        "200":
          description: "200 response"
      x-amazon-apigateway-integration:
        type: "aws_proxy"
        uri: "${oms_service_lambda_uri}"
        httpMethod: "POST"
        passthroughBehavior: "when_no_match"

  /api/v1/oms/products:
    x-amazon-apigateway-any-method:
      summary: "Product management (protected)"
      produces:
        - "application/json"
      security:
        - jwt-authorizer: []
      responses:
        "200":
          description: "200 response"
      x-amazon-apigateway-integration:
        type: "aws_proxy"
        uri: "${oms_service_lambda_uri}"
        httpMethod: "POST"
        passthroughBehavior: "when_no_match"

  /api/v1/oms/products/{proxy+}:
    x-amazon-apigateway-any-method:
      summary: "Product management endpoints (protected)"
      produces:
        - "application/json"
      security:
        - jwt-authorizer: []
      parameters:
        - name: "proxy"
          in: "path"
          required: true
          type: "string"
      responses:
        "200":
          description: "200 response"
      x-amazon-apigateway-integration:
        type: "aws_proxy"
        uri: "${oms_service_lambda_uri}"
        httpMethod: "POST"
        passthroughBehavior: "when_no_match"

  /api/v1/oms/orders:
    x-amazon-apigateway-any-method:
      summary: "Order management (protected)"
      produces:
        - "application/json"
      security:
        - jwt-authorizer: []
      responses:
        "200":
          description: "200 response"
      x-amazon-apigateway-integration:
        type: "aws_proxy"
        uri: "${oms_service_lambda_uri}"
        httpMethod: "POST"
        passthroughBehavior: "when_no_match"

  /api/v1/oms/orders/{proxy+}:
    x-amazon-apigateway-any-method:
      summary: "Order management endpoints (protected)"
      produces:
        - "application/json"
      security:
        - jwt-authorizer: []
      parameters:
        - name: "proxy"
          in: "path"
          required: true
          type: "string"
      responses:
        "200":
          description: "200 response"
      x-amazon-apigateway-integration:
        type: "aws_proxy"
        uri: "${oms_service_lambda_uri}"
        httpMethod: "POST"
        passthroughBehavior: "when_no_match"

  /api/v1/oms/inventory:
    x-amazon-apigateway-any-method:
      summary: "Inventory management (protected)"
      produces:
        - "application/json"
      security:
        - jwt-authorizer: []
      responses:
        "200":
          description: "200 response"
      x-amazon-apigateway-integration:
        type: "aws_proxy"
        uri: "${oms_service_lambda_uri}"
        httpMethod: "POST"
        passthroughBehavior: "when_no_match"

  /api/v1/oms/inventory/{proxy+}:
    x-amazon-apigateway-any-method:
      summary: "Inventory management endpoints (protected)"
      produces:
        - "application/json"
      security:
        - jwt-authorizer: []
      parameters:
        - name: "proxy"
          in: "path"
          required: true
          type: "string"
      responses:
        "200":
          description: "200 response"
      x-amazon-apigateway-integration:
        type: "aws_proxy"
        uri: "${oms_service_lambda_uri}"
        httpMethod: "POST"
        passthroughBehavior: "when_no_match"

  # ==============================================
  # Sys App Backend Routes (Workflow 10)
  # Source: https://github.com/tripleh1701-dev/ppp-be
  # Routes: /api/v1/app/* - Enterprise, Pipeline, Template APIs
  # ==============================================
  /api/v1/app:
    x-amazon-apigateway-any-method:
      summary: "Sys App Backend base endpoint (protected)"
      produces:
        - "application/json"
      security:
        - jwt-authorizer: []
      responses:
        "200":
          description: "200 response"
      x-amazon-apigateway-integration:
        type: "aws_proxy"
        uri: "${app_backend_lambda_uri}"
        httpMethod: "POST"
        passthroughBehavior: "when_no_match"

  /api/v1/app/{proxy+}:
    x-amazon-apigateway-any-method:
      summary: "Sys App Backend endpoints (protected)"
      produces:
        - "application/json"
      security:
        - jwt-authorizer: []
      parameters:
        - name: "proxy"
          in: "path"
          required: true
          type: "string"
      responses:
        "200":
          description: "200 response"
      x-amazon-apigateway-integration:
        type: "aws_proxy"
        uri: "${app_backend_lambda_uri}"
        httpMethod: "POST"
        passthroughBehavior: "when_no_match"

  /api/v1/app/enterprises:
    x-amazon-apigateway-any-method:
      summary: "Enterprise management base endpoint (protected)"
      produces:
        - "application/json"
      security:
        - jwt-authorizer: []
      responses:
        "200":
          description: "200 response"
      x-amazon-apigateway-integration:
        type: "aws_proxy"
        uri: "${app_backend_lambda_uri}"
        httpMethod: "POST"
        passthroughBehavior: "when_no_match"

  /api/v1/app/enterprises/{proxy+}:
    x-amazon-apigateway-any-method:
      summary: "Enterprise management endpoints (protected)"
      produces:
        - "application/json"
      security:
        - jwt-authorizer: []
      parameters:
        - name: "proxy"
          in: "path"
          required: true
          type: "string"
      responses:
        "200":
          description: "200 response"
      x-amazon-apigateway-integration:
        type: "aws_proxy"
        uri: "${app_backend_lambda_uri}"
        httpMethod: "POST"
        passthroughBehavior: "when_no_match"

  /api/v1/app/pipelines:
    x-amazon-apigateway-any-method:
      summary: "Pipeline management base endpoint (protected)"
      produces:
        - "application/json"
      security:
        - jwt-authorizer: []
      responses:
        "200":
          description: "200 response"
      x-amazon-apigateway-integration:
        type: "aws_proxy"
        uri: "${app_backend_lambda_uri}"
        httpMethod: "POST"
        passthroughBehavior: "when_no_match"

  /api/v1/app/pipelines/{proxy+}:
    x-amazon-apigateway-any-method:
      summary: "Pipeline management endpoints (protected)"
      produces:
        - "application/json"
      security:
        - jwt-authorizer: []
      parameters:
        - name: "proxy"
          in: "path"
          required: true
          type: "string"
      responses:
        "200":
          description: "200 response"
      x-amazon-apigateway-integration:
        type: "aws_proxy"
        uri: "${app_backend_lambda_uri}"
        httpMethod: "POST"
        passthroughBehavior: "when_no_match"

  /api/v1/app/templates:
    x-amazon-apigateway-any-method:
      summary: "Template management base endpoint (protected)"
      produces:
        - "application/json"
      security:
        - jwt-authorizer: []
      responses:
        "200":
          description: "200 response"
      x-amazon-apigateway-integration:
        type: "aws_proxy"
        uri: "${app_backend_lambda_uri}"
        httpMethod: "POST"
        passthroughBehavior: "when_no_match"

  /api/v1/app/templates/{proxy+}:
    x-amazon-apigateway-any-method:
      summary: "Template management endpoints (protected)"
      produces:
        - "application/json"
      security:
        - jwt-authorizer: []
      parameters:
        - name: "proxy"
          in: "path"
          required: true
          type: "string"
      responses:
        "200":
          description: "200 response"
      x-amazon-apigateway-integration:
        type: "aws_proxy"
        uri: "${app_backend_lambda_uri}"
        httpMethod: "POST"
        passthroughBehavior: "when_no_match"

  # ==============================================
  # User Management Routes (Sys App Backend)
  # Routes: /api/v1/user-management/* - Users, Groups, Roles APIs
  # ==============================================
  /api/v1/user-management:
    x-amazon-apigateway-any-method:
      summary: "User Management base endpoint (protected)"
      produces:
        - "application/json"
      security:
        - jwt-authorizer: []
      responses:
        "200":
          description: "200 response"
      x-amazon-apigateway-integration:
        type: "aws_proxy"
        uri: "${app_backend_lambda_uri}"
        httpMethod: "POST"
        passthroughBehavior: "when_no_match"

  /api/v1/user-management/{proxy+}:
    x-amazon-apigateway-any-method:
      summary: "User Management endpoints (protected)"
      produces:
        - "application/json"
      security:
        - jwt-authorizer: []
      parameters:
        - name: "proxy"
          in: "path"
          required: true
          type: "string"
      responses:
        "200":
          description: "200 response"
      x-amazon-apigateway-integration:
        type: "aws_proxy"
        uri: "${app_backend_lambda_uri}"
        httpMethod: "POST"
        passthroughBehavior: "when_no_match"

  /api/v1/user-management/users:
    x-amazon-apigateway-any-method:
      summary: "User management - Users base endpoint (protected)"
      produces:
        - "application/json"
      security:
        - jwt-authorizer: []
      responses:
        "200":
          description: "200 response"
      x-amazon-apigateway-integration:
        type: "aws_proxy"
        uri: "${app_backend_lambda_uri}"
        httpMethod: "POST"
        passthroughBehavior: "when_no_match"

  /api/v1/user-management/users/{proxy+}:
    x-amazon-apigateway-any-method:
      summary: "User management - Users endpoints (protected)"
      produces:
        - "application/json"
      security:
        - jwt-authorizer: []
      parameters:
        - name: "proxy"
          in: "path"
          required: true
          type: "string"
      responses:
        "200":
          description: "200 response"
      x-amazon-apigateway-integration:
        type: "aws_proxy"
        uri: "${app_backend_lambda_uri}"
        httpMethod: "POST"
        passthroughBehavior: "when_no_match"

  /api/v1/user-management/groups:
    x-amazon-apigateway-any-method:
      summary: "User management - Groups base endpoint (protected)"
      produces:
        - "application/json"
      security:
        - jwt-authorizer: []
      responses:
        "200":
          description: "200 response"
      x-amazon-apigateway-integration:
        type: "aws_proxy"
        uri: "${app_backend_lambda_uri}"
        httpMethod: "POST"
        passthroughBehavior: "when_no_match"

  /api/v1/user-management/groups/{proxy+}:
    x-amazon-apigateway-any-method:
      summary: "User management - Groups endpoints (protected)"
      produces:
        - "application/json"
      security:
        - jwt-authorizer: []
      parameters:
        - name: "proxy"
          in: "path"
          required: true
          type: "string"
      responses:
        "200":
          description: "200 response"
      x-amazon-apigateway-integration:
        type: "aws_proxy"
        uri: "${app_backend_lambda_uri}"
        httpMethod: "POST"
        passthroughBehavior: "when_no_match"

  /api/v1/user-management/roles:
    x-amazon-apigateway-any-method:
      summary: "User management - Roles base endpoint (protected)"
      produces:
        - "application/json"
      security:
        - jwt-authorizer: []
      responses:
        "200":
          description: "200 response"
      x-amazon-apigateway-integration:
        type: "aws_proxy"
        uri: "${app_backend_lambda_uri}"
        httpMethod: "POST"
        passthroughBehavior: "when_no_match"

  /api/v1/user-management/roles/{proxy+}:
    x-amazon-apigateway-any-method:
      summary: "User management - Roles endpoints (protected)"
      produces:
        - "application/json"
      security:
        - jwt-authorizer: []
      parameters:
        - name: "proxy"
          in: "path"
          required: true
          type: "string"
      responses:
        "200":
          description: "200 response"
      x-amazon-apigateway-integration:
        type: "aws_proxy"
        uri: "${app_backend_lambda_uri}"
        httpMethod: "POST"
        passthroughBehavior: "when_no_match"

  # ==============================================
  # Global Settings Routes (Sys App Backend)
  # Routes: /api/v1/global-settings - Global settings APIs
  # ==============================================
  /api/v1/global-settings:
    x-amazon-apigateway-any-method:
      summary: "Global settings base endpoint (protected)"
      produces:
        - "application/json"
      security:
        - jwt-authorizer: []
      responses:
        "200":
          description: "200 response"
      x-amazon-apigateway-integration:
        type: "aws_proxy"
        uri: "${app_backend_lambda_uri}"
        httpMethod: "POST"
        passthroughBehavior: "when_no_match"

  /api/v1/global-settings/{proxy+}:
    x-amazon-apigateway-any-method:
      summary: "Global settings endpoints (protected)"
      produces:
        - "application/json"
      security:
        - jwt-authorizer: []
      parameters:
        - name: "proxy"
          in: "path"
          required: true
          type: "string"
      responses:
        "200":
          description: "200 response"
      x-amazon-apigateway-integration:
        type: "aws_proxy"
        uri: "${app_backend_lambda_uri}"
        httpMethod: "POST"
        passthroughBehavior: "when_no_match"

  # Also support /api/v1/app/api/global-settings for backward compatibility
  /api/v1/app/api/global-settings:
    x-amazon-apigateway-any-method:
      summary: "Global settings base endpoint (protected) - legacy path"
      produces:
        - "application/json"
      security:
        - jwt-authorizer: []
      responses:
        "200":
          description: "200 response"
      x-amazon-apigateway-integration:
        type: "aws_proxy"
        uri: "${app_backend_lambda_uri}"
        httpMethod: "POST"
        passthroughBehavior: "when_no_match"

  /api/v1/app/api/global-settings/{proxy+}:
    x-amazon-apigateway-any-method:
      summary: "Global settings endpoints (protected) - legacy path"
      produces:
        - "application/json"
      security:
        - jwt-authorizer: []
      parameters:
        - name: "proxy"
          in: "path"
          required: true
          type: "string"
      responses:
        "200":
          description: "200 response"
      x-amazon-apigateway-integration:
        type: "aws_proxy"
        uri: "${app_backend_lambda_uri}"
        httpMethod: "POST"
        passthroughBehavior: "when_no_match"

  # ==============================================
  # Accounts Routes (Sys App Backend)
  # Routes: /api/v1/app/api/accounts - Account Management
  # ==============================================
  /api/v1/app/api/accounts:
    x-amazon-apigateway-any-method:
      summary: "Accounts base endpoint (protected)"
      produces:
        - "application/json"
      security:
        - jwt-authorizer: []
      responses:
        "200":
          description: "200 response"
      x-amazon-apigateway-integration:
        type: "aws_proxy"
        uri: "${app_backend_lambda_uri}"
        httpMethod: "POST"
        passthroughBehavior: "when_no_match"

  /api/v1/app/api/accounts/{proxy+}:
    x-amazon-apigateway-any-method:
      summary: "Accounts endpoints (protected)"
      produces:
        - "application/json"
      security:
        - jwt-authorizer: []
      parameters:
        - name: "proxy"
          in: "path"
          required: true
          type: "string"
      responses:
        "200":
          description: "200 response"
      x-amazon-apigateway-integration:
        type: "aws_proxy"
        uri: "${app_backend_lambda_uri}"
        httpMethod: "POST"
        passthroughBehavior: "when_no_match"

  # ==============================================
  # Enterprises Routes (Sys App Backend)
  # Routes: /api/v1/app/api/enterprises - Enterprise Management
  # ==============================================
  /api/v1/app/api/enterprises:
    x-amazon-apigateway-any-method:
      summary: "Enterprises base endpoint (protected)"
      produces:
        - "application/json"
      security:
        - jwt-authorizer: []
      responses:
        "200":
          description: "200 response"
      x-amazon-apigateway-integration:
        type: "aws_proxy"
        uri: "${app_backend_lambda_uri}"
        httpMethod: "POST"
        passthroughBehavior: "when_no_match"

  /api/v1/app/api/enterprises/{proxy+}:
    x-amazon-apigateway-any-method:
      summary: "Enterprises endpoints (protected)"
      produces:
        - "application/json"
      security:
        - jwt-authorizer: []
      parameters:
        - name: "proxy"
          in: "path"
          required: true
          type: "string"
      responses:
        "200":
          description: "200 response"
      x-amazon-apigateway-integration:
        type: "aws_proxy"
        uri: "${app_backend_lambda_uri}"
        httpMethod: "POST"
        passthroughBehavior: "when_no_match"

  # ==============================================
  # Products Routes (Sys App Backend)
  # Routes: /api/v1/app/api/products - Product Management
  # ==============================================
  /api/v1/app/api/products:
    x-amazon-apigateway-any-method:
      summary: "Products base endpoint (protected)"
      produces:
        - "application/json"
      security:
        - jwt-authorizer: []
      responses:
        "200":
          description: "200 response"
      x-amazon-apigateway-integration:
        type: "aws_proxy"
        uri: "${app_backend_lambda_uri}"
        httpMethod: "POST"
        passthroughBehavior: "when_no_match"

  /api/v1/app/api/products/{proxy+}:
    x-amazon-apigateway-any-method:
      summary: "Products endpoints (protected)"
      produces:
        - "application/json"
      security:
        - jwt-authorizer: []
      parameters:
        - name: "proxy"
          in: "path"
          required: true
          type: "string"
      responses:
        "200":
          description: "200 response"
      x-amazon-apigateway-integration:
        type: "aws_proxy"
        uri: "${app_backend_lambda_uri}"
        httpMethod: "POST"
        passthroughBehavior: "when_no_match"

  # ==============================================
  # Services Routes (Sys App Backend)
  # Routes: /api/v1/app/api/services - Service Management
  # ==============================================
  /api/v1/app/api/services:
    x-amazon-apigateway-any-method:
      summary: "Services base endpoint (protected)"
      produces:
        - "application/json"
      security:
        - jwt-authorizer: []
      responses:
        "200":
          description: "200 response"
      x-amazon-apigateway-integration:
        type: "aws_proxy"
        uri: "${app_backend_lambda_uri}"
        httpMethod: "POST"
        passthroughBehavior: "when_no_match"

  /api/v1/app/api/services/{proxy+}:
    x-amazon-apigateway-any-method:
      summary: "Services endpoints (protected)"
      produces:
        - "application/json"
      security:
        - jwt-authorizer: []
      parameters:
        - name: "proxy"
          in: "path"
          required: true
          type: "string"
      responses:
        "200":
          description: "200 response"
      x-amazon-apigateway-integration:
        type: "aws_proxy"
        uri: "${app_backend_lambda_uri}"
        httpMethod: "POST"
        passthroughBehavior: "when_no_match"

  # ==============================================
  # Users Routes (Sys App Backend)
  # Routes: /api/v1/app/api/users - User Management
  # ==============================================
  /api/v1/app/api/users:
    x-amazon-apigateway-any-method:
      summary: "Users base endpoint (protected)"
      produces:
        - "application/json"
      security:
        - jwt-authorizer: []
      responses:
        "200":
          description: "200 response"
      x-amazon-apigateway-integration:
        type: "aws_proxy"
        uri: "${app_backend_lambda_uri}"
        httpMethod: "POST"
        passthroughBehavior: "when_no_match"

  /api/v1/app/api/users/{proxy+}:
    x-amazon-apigateway-any-method:
      summary: "Users endpoints (protected)"
      produces:
        - "application/json"
      security:
        - jwt-authorizer: []
      parameters:
        - name: "proxy"
          in: "path"
          required: true
          type: "string"
      responses:
        "200":
          description: "200 response"
      x-amazon-apigateway-integration:
        type: "aws_proxy"
        uri: "${app_backend_lambda_uri}"
        httpMethod: "POST"
        passthroughBehavior: "when_no_match"

  # ==============================================
  # User Groups Routes (Sys App Backend)
  # Routes: /api/v1/app/api/user-groups - User Group Management
  # ==============================================
  /api/v1/app/api/user-groups:
    x-amazon-apigateway-any-method:
      summary: "User Groups base endpoint (protected)"
      produces:
        - "application/json"
      security:
        - jwt-authorizer: []
      responses:
        "200":
          description: "200 response"
      x-amazon-apigateway-integration:
        type: "aws_proxy"
        uri: "${app_backend_lambda_uri}"
        httpMethod: "POST"
        passthroughBehavior: "when_no_match"

  /api/v1/app/api/user-groups/{proxy+}:
    x-amazon-apigateway-any-method:
      summary: "User Groups endpoints (protected)"
      produces:
        - "application/json"
      security:
        - jwt-authorizer: []
      parameters:
        - name: "proxy"
          in: "path"
          required: true
          type: "string"
      responses:
        "200":
          description: "200 response"
      x-amazon-apigateway-integration:
        type: "aws_proxy"
        uri: "${app_backend_lambda_uri}"
        httpMethod: "POST"
        passthroughBehavior: "when_no_match"

  # ==============================================
  # Groups Routes (Sys App Backend)
  # Routes: /api/v1/app/api/groups - Group Management
  # ==============================================
  /api/v1/app/api/groups:
    x-amazon-apigateway-any-method:
      summary: "Groups base endpoint (protected)"
      produces:
        - "application/json"
      security:
        - jwt-authorizer: []
      responses:
        "200":
          description: "200 response"
      x-amazon-apigateway-integration:
        type: "aws_proxy"
        uri: "${app_backend_lambda_uri}"
        httpMethod: "POST"
        passthroughBehavior: "when_no_match"

  /api/v1/app/api/groups/{proxy+}:
    x-amazon-apigateway-any-method:
      summary: "Groups endpoints (protected)"
      produces:
        - "application/json"
      security:
        - jwt-authorizer: []
      parameters:
        - name: "proxy"
          in: "path"
          required: true
          type: "string"
      responses:
        "200":
          description: "200 response"
      x-amazon-apigateway-integration:
        type: "aws_proxy"
        uri: "${app_backend_lambda_uri}"
        httpMethod: "POST"
        passthroughBehavior: "when_no_match"

  # ==============================================
  # Roles Routes (Sys App Backend)
  # Routes: /api/v1/app/api/roles - Role Management
  # ==============================================
  /api/v1/app/api/roles:
    x-amazon-apigateway-any-method:
      summary: "Roles base endpoint (protected)"
      produces:
        - "application/json"
      security:
        - jwt-authorizer: []
      responses:
        "200":
          description: "200 response"
      x-amazon-apigateway-integration:
        type: "aws_proxy"
        uri: "${app_backend_lambda_uri}"
        httpMethod: "POST"
        passthroughBehavior: "when_no_match"

  /api/v1/app/api/roles/{proxy+}:
    x-amazon-apigateway-any-method:
      summary: "Roles endpoints (protected)"
      produces:
        - "application/json"
      security:
        - jwt-authorizer: []
      parameters:
        - name: "proxy"
          in: "path"
          required: true
          type: "string"
      responses:
        "200":
          description: "200 response"
      x-amazon-apigateway-integration:
        type: "aws_proxy"
        uri: "${app_backend_lambda_uri}"
        httpMethod: "POST"
        passthroughBehavior: "when_no_match"

  # ==============================================
  # Entities Routes (Sys App Backend)
  # Routes: /api/v1/app/api/entities - Entity Management
  # ==============================================
  /api/v1/app/api/entities:
    x-amazon-apigateway-any-method:
      summary: "Entities base endpoint (protected)"
      produces:
        - "application/json"
      security:
        - jwt-authorizer: []
      responses:
        "200":
          description: "200 response"
      x-amazon-apigateway-integration:
        type: "aws_proxy"
        uri: "${app_backend_lambda_uri}"
        httpMethod: "POST"
        passthroughBehavior: "when_no_match"

  /api/v1/app/api/entities/{proxy+}:
    x-amazon-apigateway-any-method:
      summary: "Entities endpoints (protected)"
      produces:
        - "application/json"
      security:
        - jwt-authorizer: []
      parameters:
        - name: "proxy"
          in: "path"
          required: true
          type: "string"
      responses:
        "200":
          description: "200 response"
      x-amazon-apigateway-integration:
        type: "aws_proxy"
        uri: "${app_backend_lambda_uri}"
        httpMethod: "POST"
        passthroughBehavior: "when_no_match"

  # ==============================================
  # Enterprise Products Services Routes (Sys App Backend)
  # Routes: /api/v1/app/api/enterprise-products-services
  # ==============================================
  /api/v1/app/api/enterprise-products-services:
    x-amazon-apigateway-any-method:
      summary: "Enterprise Products Services base endpoint (protected)"
      produces:
        - "application/json"
      security:
        - jwt-authorizer: []
      responses:
        "200":
          description: "200 response"
      x-amazon-apigateway-integration:
        type: "aws_proxy"
        uri: "${app_backend_lambda_uri}"
        httpMethod: "POST"
        passthroughBehavior: "when_no_match"

  /api/v1/app/api/enterprise-products-services/{proxy+}:
    x-amazon-apigateway-any-method:
      summary: "Enterprise Products Services endpoints (protected)"
      produces:
        - "application/json"
      security:
        - jwt-authorizer: []
      parameters:
        - name: "proxy"
          in: "path"
          required: true
          type: "string"
      responses:
        "200":
          description: "200 response"
      x-amazon-apigateway-integration:
        type: "aws_proxy"
        uri: "${app_backend_lambda_uri}"
        httpMethod: "POST"
        passthroughBehavior: "when_no_match"

  # ==============================================
  # Pipeline Canvas Routes (Sys App Backend)
  # Routes: /api/v1/app/api/pipeline-canvas
  # ==============================================
  /api/v1/app/api/pipeline-canvas:
    x-amazon-apigateway-any-method:
      summary: "Pipeline Canvas base endpoint (protected)"
      produces:
        - "application/json"
      security:
        - jwt-authorizer: []
      responses:
        "200":
          description: "200 response"
      x-amazon-apigateway-integration:
        type: "aws_proxy"
        uri: "${app_backend_lambda_uri}"
        httpMethod: "POST"
        passthroughBehavior: "when_no_match"

  /api/v1/app/api/pipeline-canvas/{proxy+}:
    x-amazon-apigateway-any-method:
      summary: "Pipeline Canvas endpoints (protected)"
      produces:
        - "application/json"
      security:
        - jwt-authorizer: []
      parameters:
        - name: "proxy"
          in: "path"
          required: true
          type: "string"
      responses:
        "200":
          description: "200 response"
      x-amazon-apigateway-integration:
        type: "aws_proxy"
        uri: "${app_backend_lambda_uri}"
        httpMethod: "POST"
        passthroughBehavior: "when_no_match"

  # ==============================================
  # Account Licenses Routes (Sys App Backend)
  # Routes: /api/v1/app/api/account-licenses
  # ==============================================
  /api/v1/app/api/account-licenses:
    x-amazon-apigateway-any-method:
      summary: "Account Licenses base endpoint (protected)"
      produces:
        - "application/json"
      security:
        - jwt-authorizer: []
      responses:
        "200":
          description: "200 response"
      x-amazon-apigateway-integration:
        type: "aws_proxy"
        uri: "${app_backend_lambda_uri}"
        httpMethod: "POST"
        passthroughBehavior: "when_no_match"

  /api/v1/app/api/account-licenses/{proxy+}:
    x-amazon-apigateway-any-method:
      summary: "Account Licenses endpoints (protected)"
      produces:
        - "application/json"
      security:
        - jwt-authorizer: []
      parameters:
        - name: "proxy"
          in: "path"
          required: true
          type: "string"
      responses:
        "200":
          description: "200 response"
      x-amazon-apigateway-integration:
        type: "aws_proxy"
        uri: "${app_backend_lambda_uri}"
        httpMethod: "POST"
        passthroughBehavior: "when_no_match"

  # ==============================================
  # User Management Routes (Sys App Backend)
  # Routes: /api/v1/app/api/user-management
  # ==============================================
  /api/v1/app/api/user-management:
    x-amazon-apigateway-any-method:
      summary: "User Management base endpoint (protected)"
      produces:
        - "application/json"
      security:
        - jwt-authorizer: []
      responses:
        "200":
          description: "200 response"
      x-amazon-apigateway-integration:
        type: "aws_proxy"
        uri: "${app_backend_lambda_uri}"
        httpMethod: "POST"
        passthroughBehavior: "when_no_match"

  /api/v1/app/api/user-management/{proxy+}:
    x-amazon-apigateway-any-method:
      summary: "User Management endpoints (protected)"
      produces:
        - "application/json"
      security:
        - jwt-authorizer: []
      parameters:
        - name: "proxy"
          in: "path"
          required: true
          type: "string"
      responses:
        "200":
          description: "200 response"
      x-amazon-apigateway-integration:
        type: "aws_proxy"
        uri: "${app_backend_lambda_uri}"
        httpMethod: "POST"
        passthroughBehavior: "when_no_match"

  # ==============================================
  # User Preferences Routes (Sys App Backend)
  # Routes: /api/v1/app/api/user-preferences
  # ==============================================
  /api/v1/app/api/user-preferences:
    x-amazon-apigateway-any-method:
      summary: "User Preferences base endpoint (protected)"
      produces:
        - "application/json"
      security:
        - jwt-authorizer: []
      responses:
        "200":
          description: "200 response"
      x-amazon-apigateway-integration:
        type: "aws_proxy"
        uri: "${app_backend_lambda_uri}"
        httpMethod: "POST"
        passthroughBehavior: "when_no_match"

  /api/v1/app/api/user-preferences/{proxy+}:
    x-amazon-apigateway-any-method:
      summary: "User Preferences endpoints (protected)"
      produces:
        - "application/json"
      security:
        - jwt-authorizer: []
      parameters:
        - name: "proxy"
          in: "path"
          required: true
          type: "string"
      responses:
        "200":
          description: "200 response"
      x-amazon-apigateway-integration:
        type: "aws_proxy"
        uri: "${app_backend_lambda_uri}"
        httpMethod: "POST"
        passthroughBehavior: "when_no_match"

  # ==============================================
  # Credentials Routes (Sys App Backend)
  # Routes: /api/v1/app/api/credentials - Credentials Management
  # ==============================================
  /api/v1/app/api/credentials:
    x-amazon-apigateway-any-method:
      summary: "Credentials base endpoint (protected)"
      produces:
        - "application/json"
      security:
        - jwt-authorizer: []
      responses:
        "200":
          description: "200 response"
      x-amazon-apigateway-integration:
        type: "aws_proxy"
        uri: "${app_backend_lambda_uri}"
        httpMethod: "POST"
        passthroughBehavior: "when_no_match"

  /api/v1/app/api/credentials/{proxy+}:
    x-amazon-apigateway-any-method:
      summary: "Credentials endpoints (protected)"
      produces:
        - "application/json"
      security:
        - jwt-authorizer: []
      parameters:
        - name: "proxy"
          in: "path"
          required: true
          type: "string"
      responses:
        "200":
          description: "200 response"
      x-amazon-apigateway-integration:
        type: "aws_proxy"
        uri: "${app_backend_lambda_uri}"
        httpMethod: "POST"
        passthroughBehavior: "when_no_match"

  # ==============================================
  # Environments Routes (Sys App Backend)
  # Routes: /api/v1/app/api/environments - Environment Management
  # Frontend: /security-governance/environments
  # ==============================================
  /api/v1/app/api/environments:
    x-amazon-apigateway-any-method:
      summary: "Environments base endpoint (protected)"
      produces:
        - "application/json"
      security:
        - jwt-authorizer: []
      responses:
        "200":
          description: "200 response"
      x-amazon-apigateway-integration:
        type: "aws_proxy"
        uri: "${app_backend_lambda_uri}"
        httpMethod: "POST"
        passthroughBehavior: "when_no_match"

  /api/v1/app/api/environments/{proxy+}:
    x-amazon-apigateway-any-method:
      summary: "Environments endpoints (protected)"
      produces:
        - "application/json"
      security:
        - jwt-authorizer: []
      parameters:
        - name: "proxy"
          in: "path"
          required: true
          type: "string"
      responses:
        "200":
          description: "200 response"
      x-amazon-apigateway-integration:
        type: "aws_proxy"
        uri: "${app_backend_lambda_uri}"
        httpMethod: "POST"
        passthroughBehavior: "when_no_match"

  # ==============================================
  # Connectors Routes (Sys App Backend)
  # Routes: /api/v1/app/api/connectors - Connector Management
  # Frontend: /security-governance/connectors
  # ==============================================
  /api/v1/app/api/connectors:
    x-amazon-apigateway-any-method:
      summary: "Connectors base endpoint (protected)"
      produces:
        - "application/json"
      security:
        - jwt-authorizer: []
      responses:
        "200":
          description: "200 response"
      x-amazon-apigateway-integration:
        type: "aws_proxy"
        uri: "${app_backend_lambda_uri}"
        httpMethod: "POST"
        passthroughBehavior: "when_no_match"

  /api/v1/app/api/connectors/{proxy+}:
    x-amazon-apigateway-any-method:
      summary: "Connectors endpoints (protected)"
      produces:
        - "application/json"
      security:
        - jwt-authorizer: []
      parameters:
        - name: "proxy"
          in: "path"
          required: true
          type: "string"
      responses:
        "200":
          description: "200 response"
      x-amazon-apigateway-integration:
        type: "aws_proxy"
        uri: "${app_backend_lambda_uri}"
        httpMethod: "POST"
        passthroughBehavior: "when_no_match"

  # ==============================================
  # Routes: /api/v1/app/api/builds/integrations - Build Integrations Management
  # Frontend: /builds/integrations
  # ==============================================
  /api/v1/app/api/builds/integrations:
    x-amazon-apigateway-any-method:
      summary: "Build Integrations base endpoint (protected)"
      produces:
        - "application/json"
      security:
        - jwt-authorizer: []
      responses:
        "200":
          description: "200 response"
      x-amazon-apigateway-integration:
        type: "aws_proxy"
        uri: "${app_backend_lambda_uri}"
        httpMethod: "POST"
        passthroughBehavior: "when_no_match"

  /api/v1/app/api/builds/integrations/{proxy+}:
    x-amazon-apigateway-any-method:
      summary: "Build Integrations endpoints (protected)"
      produces:
        - "application/json"
      security:
        - jwt-authorizer: []
      parameters:
        - name: "proxy"
          in: "path"
          required: true
          type: "string"
      responses:
        "200":
          description: "200 response"
      x-amazon-apigateway-integration:
        type: "aws_proxy"
        uri: "${app_backend_lambda_uri}"
        httpMethod: "POST"
        passthroughBehavior: "when_no_match"

  # ==============================================
  # Build Executions Routes (Sys App Backend)
  # Routes: /api/v1/app/api/build-executions
  # ==============================================
  /api/v1/app/api/build-executions:
    x-amazon-apigateway-any-method:
      summary: "Build Executions base endpoint (protected)"
      produces:
        - "application/json"
      security:
        - jwt-authorizer: []
      responses:
        "200":
          description: "200 response"
      x-amazon-apigateway-integration:
        type: "aws_proxy"
        uri: "${app_backend_lambda_uri}"
        httpMethod: "POST"
        passthroughBehavior: "when_no_match"

  /api/v1/app/api/build-executions/{proxy+}:
    x-amazon-apigateway-any-method:
      summary: "Build Executions endpoints (protected)"
      produces:
        - "application/json"
      security:
        - jwt-authorizer: []
      parameters:
        - name: "proxy"
          in: "path"
          required: true
          type: "string"
      responses:
        "200":
          description: "200 response"
      x-amazon-apigateway-integration:
        type: "aws_proxy"
        uri: "${app_backend_lambda_uri}"
        httpMethod: "POST"
        passthroughBehavior: "when_no_match"

  # ==============================================
  # Pipelines Routes (Sys App Backend)
  # Routes: /api/v1/app/api/pipelines
  # ==============================================
  /api/v1/app/api/pipelines:
    x-amazon-apigateway-any-method:
      summary: "Pipelines base endpoint (protected)"
      produces:
        - "application/json"
      security:
        - jwt-authorizer: []
      responses:
        "200":
          description: "200 response"
      x-amazon-apigateway-integration:
        type: "aws_proxy"
        uri: "${app_backend_lambda_uri}"
        httpMethod: "POST"
        passthroughBehavior: "when_no_match"

  /api/v1/app/api/pipelines/{proxy+}:
    x-amazon-apigateway-any-method:
      summary: "Pipelines endpoints (protected)"
      produces:
        - "application/json"
      security:
        - jwt-authorizer: []
      parameters:
        - name: "proxy"
          in: "path"
          required: true
          type: "string"
      responses:
        "200":
          description: "200 response"
      x-amazon-apigateway-integration:
        type: "aws_proxy"
        uri: "${app_backend_lambda_uri}"
        httpMethod: "POST"
        passthroughBehavior: "when_no_match"

  # ==============================================
  # Pipeline Details Routes (Sys App Backend)
  # Routes: /api/v1/app/api/pipeline-details
  # ==============================================
  /api/v1/app/api/pipeline-details:
    x-amazon-apigateway-any-method:
      summary: "Pipeline Details base endpoint (protected)"
      produces:
        - "application/json"
      security:
        - jwt-authorizer: []
      responses:
        "200":
          description: "200 response"
      x-amazon-apigateway-integration:
        type: "aws_proxy"
        uri: "${app_backend_lambda_uri}"
        httpMethod: "POST"
        passthroughBehavior: "when_no_match"

  /api/v1/app/api/pipeline-details/{proxy+}:
    x-amazon-apigateway-any-method:
      summary: "Pipeline Details endpoints (protected)"
      produces:
        - "application/json"
      security:
        - jwt-authorizer: []
      parameters:
        - name: "proxy"
          in: "path"
          required: true
          type: "string"
      responses:
        "200":
          description: "200 response"
      x-amazon-apigateway-integration:
        type: "aws_proxy"
        uri: "${app_backend_lambda_uri}"
        httpMethod: "POST"
        passthroughBehavior: "when_no_match"

  # ==============================================
  # Pipeline Services Routes (Sys App Backend)
  # Routes: /api/v1/app/api/pipeline-services
  # ==============================================
  /api/v1/app/api/pipeline-services:
    x-amazon-apigateway-any-method:
      summary: "Pipeline Services base endpoint (protected)"
      produces:
        - "application/json"
      security:
        - jwt-authorizer: []
      responses:
        "200":
          description: "200 response"
      x-amazon-apigateway-integration:
        type: "aws_proxy"
        uri: "${app_backend_lambda_uri}"
        httpMethod: "POST"
        passthroughBehavior: "when_no_match"

  /api/v1/app/api/pipeline-services/{proxy+}:
    x-amazon-apigateway-any-method:
      summary: "Pipeline Services endpoints (protected)"
      produces:
        - "application/json"
      security:
        - jwt-authorizer: []
      parameters:
        - name: "proxy"
          in: "path"
          required: true
          type: "string"
      responses:
        "200":
          description: "200 response"
      x-amazon-apigateway-integration:
        type: "aws_proxy"
        uri: "${app_backend_lambda_uri}"
        httpMethod: "POST"
        passthroughBehavior: "when_no_match"

  # ==============================================
  # Pipeline YAML Routes (Sys App Backend)
  # Routes: /api/v1/app/api/pipeline-yaml
  # ==============================================
  /api/v1/app/api/pipeline-yaml:
    x-amazon-apigateway-any-method:
      summary: "Pipeline YAML base endpoint (protected)"
      produces:
        - "application/json"
      security:
        - jwt-authorizer: []
      responses:
        "200":
          description: "200 response"
      x-amazon-apigateway-integration:
        type: "aws_proxy"
        uri: "${app_backend_lambda_uri}"
        httpMethod: "POST"
        passthroughBehavior: "when_no_match"

  /api/v1/app/api/pipeline-yaml/{proxy+}:
    x-amazon-apigateway-any-method:
      summary: "Pipeline YAML endpoints (protected)"
      produces:
        - "application/json"
      security:
        - jwt-authorizer: []
      parameters:
        - name: "proxy"
          in: "path"
          required: true
          type: "string"
      responses:
        "200":
          description: "200 response"
      x-amazon-apigateway-integration:
        type: "aws_proxy"
        uri: "${app_backend_lambda_uri}"
        httpMethod: "POST"
        passthroughBehavior: "when_no_match"

  # ==============================================
  # Pipeline Config Routes (Sys App Backend)
  # Routes: /api/v1/app/api/pipeline-config
  # ==============================================
  /api/v1/app/api/pipeline-config:
    x-amazon-apigateway-any-method:
      summary: "Pipeline Config base endpoint (protected)"
      produces:
        - "application/json"
      security:
        - jwt-authorizer: []
      responses:
        "200":
          description: "200 response"
      x-amazon-apigateway-integration:
        type: "aws_proxy"
        uri: "${app_backend_lambda_uri}"
        httpMethod: "POST"
        passthroughBehavior: "when_no_match"

  /api/v1/app/api/pipeline-config/{proxy+}:
    x-amazon-apigateway-any-method:
      summary: "Pipeline Config endpoints (protected)"
      produces:
        - "application/json"
      security:
        - jwt-authorizer: []
      parameters:
        - name: "proxy"
          in: "path"
          required: true
          type: "string"
      responses:
        "200":
          description: "200 response"
      x-amazon-apigateway-integration:
        type: "aws_proxy"
        uri: "${app_backend_lambda_uri}"
        httpMethod: "POST"
        passthroughBehavior: "when_no_match"

  # ==============================================
  # Pipeline Routes (Sys App Backend) - Legacy
  # Routes: /api/v1/pipelines, /api/v1/pipeline-canvas, etc.
  # ==============================================
  /api/v1/pipelines:
    x-amazon-apigateway-any-method:
      summary: "Pipelines base endpoint (protected)"
      produces:
        - "application/json"
      security:
        - jwt-authorizer: []
      responses:
        "200":
          description: "200 response"
      x-amazon-apigateway-integration:
        type: "aws_proxy"
        uri: "${app_backend_lambda_uri}"
        httpMethod: "POST"
        passthroughBehavior: "when_no_match"

  /api/v1/pipelines/{proxy+}:
    x-amazon-apigateway-any-method:
      summary: "Pipelines endpoints (protected)"
      produces:
        - "application/json"
      security:
        - jwt-authorizer: []
      parameters:
        - name: "proxy"
          in: "path"
          required: true
          type: "string"
      responses:
        "200":
          description: "200 response"
      x-amazon-apigateway-integration:
        type: "aws_proxy"
        uri: "${app_backend_lambda_uri}"
        httpMethod: "POST"
        passthroughBehavior: "when_no_match"

  /api/v1/pipeline-canvas:
    x-amazon-apigateway-any-method:
      summary: "Pipeline canvas base endpoint (protected)"
      produces:
        - "application/json"
      security:
        - jwt-authorizer: []
      responses:
        "200":
          description: "200 response"
      x-amazon-apigateway-integration:
        type: "aws_proxy"
        uri: "${app_backend_lambda_uri}"
        httpMethod: "POST"
        passthroughBehavior: "when_no_match"

  /api/v1/pipeline-canvas/{proxy+}:
    x-amazon-apigateway-any-method:
      summary: "Pipeline canvas endpoints (protected)"
      produces:
        - "application/json"
      security:
        - jwt-authorizer: []
      parameters:
        - name: "proxy"
          in: "path"
          required: true
          type: "string"
      responses:
        "200":
          description: "200 response"
      x-amazon-apigateway-integration:
        type: "aws_proxy"
        uri: "${app_backend_lambda_uri}"
        httpMethod: "POST"
        passthroughBehavior: "when_no_match"

  /api/v1/pipeline-details:
    x-amazon-apigateway-any-method:
      summary: "Pipeline details base endpoint (protected)"
      produces:
        - "application/json"
      security:
        - jwt-authorizer: []
      responses:
        "200":
          description: "200 response"
      x-amazon-apigateway-integration:
        type: "aws_proxy"
        uri: "${app_backend_lambda_uri}"
        httpMethod: "POST"
        passthroughBehavior: "when_no_match"

  /api/v1/pipeline-details/{proxy+}:
    x-amazon-apigateway-any-method:
      summary: "Pipeline details endpoints (protected)"
      produces:
        - "application/json"
      security:
        - jwt-authorizer: []
      parameters:
        - name: "proxy"
          in: "path"
          required: true
          type: "string"
      responses:
        "200":
          description: "200 response"
      x-amazon-apigateway-integration:
        type: "aws_proxy"
        uri: "${app_backend_lambda_uri}"
        httpMethod: "POST"
        passthroughBehavior: "when_no_match"

  /api/v1/pipeline-services:
    x-amazon-apigateway-any-method:
      summary: "Pipeline services base endpoint (protected)"
      produces:
        - "application/json"
      security:
        - jwt-authorizer: []
      responses:
        "200":
          description: "200 response"
      x-amazon-apigateway-integration:
        type: "aws_proxy"
        uri: "${app_backend_lambda_uri}"
        httpMethod: "POST"
        passthroughBehavior: "when_no_match"

  /api/v1/pipeline-services/{proxy+}:
    x-amazon-apigateway-any-method:
      summary: "Pipeline services endpoints (protected)"
      produces:
        - "application/json"
      security:
        - jwt-authorizer: []
      parameters:
        - name: "proxy"
          in: "path"
          required: true
          type: "string"
      responses:
        "200":
          description: "200 response"
      x-amazon-apigateway-integration:
        type: "aws_proxy"
        uri: "${app_backend_lambda_uri}"
        httpMethod: "POST"
        passthroughBehavior: "when_no_match"

  # ==============================================
  # AI Routes (Sys App Backend)
  # Routes: /api/v1/ai - AI insights and suggestions
  # ==============================================
  /api/v1/ai:
    x-amazon-apigateway-any-method:
      summary: "AI base endpoint (protected)"
      produces:
        - "application/json"
      security:
        - jwt-authorizer: []
      responses:
        "200":
          description: "200 response"
      x-amazon-apigateway-integration:
        type: "aws_proxy"
        uri: "${app_backend_lambda_uri}"
        httpMethod: "POST"
        passthroughBehavior: "when_no_match"

  /api/v1/ai/{proxy+}:
    x-amazon-apigateway-any-method:
      summary: "AI endpoints (protected)"
      produces:
        - "application/json"
      security:
        - jwt-authorizer: []
      parameters:
        - name: "proxy"
          in: "path"
          required: true
          type: "string"
      responses:
        "200":
          description: "200 response"
      x-amazon-apigateway-integration:
        type: "aws_proxy"
        uri: "${app_backend_lambda_uri}"
        httpMethod: "POST"
        passthroughBehavior: "when_no_match"

  # ==============================================
  # Sys App Frontend Routes
  # Serves React/Next.js UI from S3 via Lambda
  # ==============================================
  /ui:
    x-amazon-apigateway-any-method:
      summary: "Sys App Frontend root (public)"
      produces:
        - "text/html"
        - "application/javascript"
        - "text/css"
        - "application/json"
      responses:
        "200":
          description: "200 response"
      x-amazon-apigateway-integration:
        type: "aws_proxy"
        uri: "${app_frontend_lambda_uri}"
        httpMethod: "POST"
        passthroughBehavior: "when_no_match"

  /ui/{proxy+}:
    x-amazon-apigateway-any-method:
      summary: "Sys App Frontend (public)"
      produces:
        - "text/html"
        - "application/javascript"
        - "text/css"
        - "application/json"
      parameters:
        - name: "proxy"
          in: "path"
          required: true
          type: "string"
      responses:
        "200":
          description: "200 response"
      x-amazon-apigateway-integration:
        type: "aws_proxy"
        uri: "${app_frontend_lambda_uri}"
        httpMethod: "POST"
        passthroughBehavior: "when_no_match"

  # ==============================================
  # Sys App Frontend - Images & Fonts (Static Assets from Workflow 09)
  # These routes handle paths like /images/... and /fonts/...
  # Routed to app_frontend_lambda (ppp-fe-main frontend)
  # ==============================================
  /images/{proxy+}:
    x-amazon-apigateway-any-method:
      summary: "Sys App Frontend images (public)"
      produces:
        - "image/png"
        - "image/svg+xml"
        - "image/jpeg"
        - "image/gif"
        - "image/webp"
      parameters:
        - name: "proxy"
          in: "path"
          required: true
          type: "string"
      responses:
        "200":
          description: "200 response"
      x-amazon-apigateway-integration:
        type: "aws_proxy"
        uri: "${app_frontend_lambda_uri}"
        httpMethod: "POST"
        passthroughBehavior: "when_no_match"

  /fonts/{proxy+}:
    x-amazon-apigateway-any-method:
      summary: "Sys App Frontend fonts (public)"
      produces:
        - "font/woff"
        - "font/woff2"
        - "font/ttf"
      parameters:
        - name: "proxy"
          in: "path"
          required: true
          type: "string"
      responses:
        "200":
          description: "200 response"
      x-amazon-apigateway-integration:
        type: "aws_proxy"
        uri: "${app_frontend_lambda_uri}"
        httpMethod: "POST"
        passthroughBehavior: "when_no_match"
