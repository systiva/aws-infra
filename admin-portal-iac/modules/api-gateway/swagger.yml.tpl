swagger: "2.0"
info:
  version: "1.0.0"
  title: "${api_name}"
  description: "Admin Portal API Gateway - Manages tenant operations and identity services"

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
  # Tenant Management Routes (Protected)
  # ==============================================
  /api/v1/tenants:
    get:
      summary: "Get all tenants"
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

  /api/v1/tenants/{tenantId}:
    get:
      summary: "Get tenant by ID"
      produces:
        - "application/json"
      security:
        - jwt-authorizer: []
      parameters:
        - name: "tenantId"
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

  /api/v1/tenants/onboard:
    post:
      summary: "Onboard new tenant"
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
      summary: "Update tenant onboarding"
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

  /api/v1/tenants/offboard:
    delete:
      summary: "Offboard tenant"
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

  /api/v1/tenants/suspend:
    put:
      summary: "Suspend tenant"
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
