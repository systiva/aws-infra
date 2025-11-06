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
      authorizerResultTtlInSeconds: 300
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
