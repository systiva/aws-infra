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
  # Pipeline Routes (Sys App Backend)
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
  # Sys App Frontend - Images & Fonts (for assets without /ui prefix)
  # These routes handle hardcoded paths like /images/... and /fonts/...
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
