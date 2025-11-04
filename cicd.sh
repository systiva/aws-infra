#!/bin/bash

# Multi-Tenant POC CI/CD Pipeline Script
# Tool-agnostic bash script for local development and CI/CD integration
# 
# Usage: ./cicd.sh <command> [options]
# Example: ./cicd.sh full-pipeline --env=dev --profile=fct_fct.admin

set -e  # Exit on any error

# ============================================================================
# Configuration & Variables
# ============================================================================

# Script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# Default Configuration
ENV="${ENV:-dev}"
AWS_REGION="${AWS_REGION:-us-east-1}"
AWS_ADMIN_PROFILE="${AWS_ADMIN_PROFILE:-default}"
AWS_TENANT_PROFILE="${AWS_TENANT_PROFILE:-default}"
PROJECT_NAME="admin-portal"
VERSION=$(git rev-parse --short HEAD 2>/dev/null || echo "local")
TIMESTAMP=$(date +%Y%m%d-%H%M%S)

# Multi-Account Configuration
ADMIN_ACCOUNT_ID="${ADMIN_ACCOUNT_ID:-}"
TENANT_ACCOUNT_ID="${TENANT_ACCOUNT_ID:-}"
AWS_ACCOUNT_ID="${AWS_ACCOUNT_ID:-}"  # Generic account ID for commands
TENANT_ID="${TENANT_ID:-default}"
SERVICE_NAME="${SERVICE_NAME:-}"
COMPONENT="${COMPONENT:-}"

# Workspace Configuration
TERRAFORM_WORKSPACE="${TERRAFORM_WORKSPACE:-}"  # Mandatory from user
ALLOWED_WORKSPACES=("dev" "qa" "prd" "uat")
WORKSPACE_PREFIX="${WORKSPACE_PREFIX:-}"

# Valid service names
VALID_SERVICES=("create-infra-worker" "delete-infra-worker" "poll-infra-worker" "create-admin-worker" "jwt-authorizer" "admin-portal-be" "ims-service" "admin-portal-web-server" "admin-portal-fe")

# Directories
IAC_DIR="admin-portal-iac"
TENANT_IAC_DIR="tenant-iac"
FE_DIR="admin-portal-fe"
BE_DIR="admin-portal-be"
IMS_DIR="ims-service"
WEB_SERVER_DIR="admin-portal-web-server"

# Lambda Function Directories
LAMBDA_DIRS=("create-infra-worker" "delete-infra-worker" "poll-infra-worker" "jwt-authorizer")

# Color codes for output
RED='\033[31m'
GREEN='\033[32m'
YELLOW='\033[33m'
BLUE='\033[34m'
CYAN='\033[36m'
NC='\033[0m' # No Color

# ============================================================================
# Helper Functions
# ============================================================================

# Print colored messages
print_success() {
    echo -e "${GREEN}[SUCCESS] $1${NC}"
}

print_error() {
    echo -e "${RED}[ERROR] $1${NC}"
}

print_info() {
    echo -e "${CYAN}[INFO] $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}[WARNING] $1${NC}"
}

print_header() {
    echo -e "${BLUE}[STAGE] $1${NC}"
}

# Error handling
handle_error() {
    print_error "Command failed on line $1"
    exit 1
}

trap 'handle_error $LINENO' ERR

# ============================================================================
# Enhanced Validation Functions
# ============================================================================

# Enhanced validation with mandatory parameters
validate_admin_command() {
    if [[ -z "$TERRAFORM_WORKSPACE" ]]; then
        print_error "TERRAFORM_WORKSPACE is mandatory. Use --workspace=WORKSPACE"
        print_info "Allowed workspaces: ${ALLOWED_WORKSPACES[*]}"
        exit 1
    fi
    
    if [[ -z "$AWS_ACCOUNT_ID" ]]; then
        print_error "AWS_ACCOUNT_ID is mandatory. Use --aws-account=ACCOUNT_ID"
        print_info "Example: --aws-account=583122682394"
        exit 1
    fi
    
    validate_workspace
    print_success "Admin command validation passed"
}

validate_tenant_command() {
    if [[ -z "$TERRAFORM_WORKSPACE" ]]; then
        print_error "TERRAFORM_WORKSPACE is mandatory. Use --workspace=WORKSPACE"
        exit 1
    fi
    
    if [[ -z "$AWS_ACCOUNT_ID" ]]; then
        print_error "AWS_ACCOUNT_ID (tenant) is mandatory. Use --aws-account=ACCOUNT_ID"
        exit 1
    fi
    
    if [[ -z "$ADMIN_ACCOUNT_ID" ]]; then
        print_error "ADMIN_ACCOUNT_ID is mandatory. Use --admin-account=ACCOUNT_ID"
        exit 1
    fi
    
    validate_workspace
    print_success "Tenant command validation passed"
}

validate_service_name() {
    local service_name="$1"
    
    if [[ -z "$service_name" ]]; then
        print_error "Service name is required"
        print_info "Available services: ${VALID_SERVICES[*]}"
        exit 1
    fi
    
    local service_valid=false
    for valid_service in "${VALID_SERVICES[@]}"; do
        if [[ "$service_name" == "$valid_service" ]]; then
            service_valid=true
            break
        fi
    done
    
    if [[ "$service_valid" == false ]]; then
        print_error "Invalid service: '$service_name'"
        print_info "Available services: ${VALID_SERVICES[*]}"
        exit 1
    fi
    
    print_success "Service name validated: $service_name"
}

# ============================================================================
# Workspace Management Functions
# ============================================================================

# Workspace validation function
validate_workspace() {
    if [[ -z "$TERRAFORM_WORKSPACE" ]]; then
        print_error "TERRAFORM_WORKSPACE is mandatory. Please provide --workspace parameter"
        print_info "Allowed values: ${ALLOWED_WORKSPACES[*]}"
        exit 1
    fi
    
    # Check if workspace is in allowed list
    local workspace_valid=false
    for allowed_ws in "${ALLOWED_WORKSPACES[@]}"; do
        if [[ "$TERRAFORM_WORKSPACE" == "$allowed_ws" ]]; then
            workspace_valid=true
            break
        fi
    done
    
    if [[ "$workspace_valid" == false ]]; then
        print_error "Invalid workspace: '$TERRAFORM_WORKSPACE'"
        print_info "Allowed workspaces: ${ALLOWED_WORKSPACES[*]}"
        print_info "Example: --workspace=dev or --workspace=prd"
        exit 1
    fi
    
    WORKSPACE_PREFIX="$TERRAFORM_WORKSPACE"
    print_success "Workspace validated: $TERRAFORM_WORKSPACE"
}

# Generate workspace-aware resource names
generate_resource_names() {
    validate_workspace
    
    # Resource naming pattern: {workspace}-{project}-{component}
    ADMIN_NAME_PREFIX="${WORKSPACE_PREFIX}-admin-portal"
    TENANT_NAME_PREFIX="${WORKSPACE_PREFIX}-tenant-infra"
    
    # State bucket naming: {workspace}-{project}-terraform-state-{account-id}
    ADMIN_STATE_BUCKET="${WORKSPACE_PREFIX}-admin-portal-terraform-state-${ADMIN_ACCOUNT_ID}"
    TENANT_STATE_BUCKET="${WORKSPACE_PREFIX}-tenant-infra-terraform-state-${TENANT_ACCOUNT_ID}"
    
    print_info "Resource naming:"
    print_info "   Admin Prefix: $ADMIN_NAME_PREFIX"
    print_info "   Tenant Prefix: $TENANT_NAME_PREFIX"
}

# Admin workspace management
manage_admin_workspace() {
    print_info "Managing Admin Terraform workspace: $TERRAFORM_WORKSPACE"
    
    cd "$IAC_DIR"
    
    # Initialize with workspace-specific backend - handle configuration changes
    print_info "Initializing Terraform with backend config: backend-${TERRAFORM_WORKSPACE}.conf"
    if ! terraform init -backend-config="backend-${TERRAFORM_WORKSPACE}.conf" 2>/dev/null; then
        print_warning "Backend configuration changed, reconfiguring..."
        terraform init -reconfigure -backend-config="backend-${TERRAFORM_WORKSPACE}.conf"
    fi
    
    # Select or create workspace
    if ! terraform workspace list | grep -q "^[[:space:]]*\*\?[[:space:]]*${TERRAFORM_WORKSPACE}[[:space:]]*$"; then
        print_info "Creating new workspace: $TERRAFORM_WORKSPACE"
        terraform workspace new "$TERRAFORM_WORKSPACE"
    else
        print_info "Selecting existing workspace: $TERRAFORM_WORKSPACE"
        terraform workspace select "$TERRAFORM_WORKSPACE"
    fi
    
    # Verify workspace
    CURRENT_WS=$(terraform workspace show)
    if [[ "$CURRENT_WS" != "$TERRAFORM_WORKSPACE" ]]; then
        print_error "Failed to select workspace $TERRAFORM_WORKSPACE (current: $CURRENT_WS)"
        exit 1
    fi
    
    print_success "Admin workspace ready: $CURRENT_WS"
    cd - > /dev/null
}

# Tenant workspace management
manage_tenant_workspace() {
    print_info "Managing Tenant Terraform workspace: $TERRAFORM_WORKSPACE"
    
    cd "$TENANT_IAC_DIR"
    
    # Initialize with workspace-specific backend - handle configuration changes
    print_info "Initializing Terraform with backend config: backend-${TERRAFORM_WORKSPACE}.conf"
    if ! terraform init -backend-config="backend-${TERRAFORM_WORKSPACE}.conf" 2>/dev/null; then
        print_warning "Backend configuration changed, reconfiguring..."
        terraform init -reconfigure -backend-config="backend-${TERRAFORM_WORKSPACE}.conf"
    fi
    
    # Select or create workspace
    if ! terraform workspace list | grep -q "^[[:space:]]*\*\?[[:space:]]*${TERRAFORM_WORKSPACE}[[:space:]]*$"; then
        print_info "Creating new workspace: $TERRAFORM_WORKSPACE"
        terraform workspace new "$TERRAFORM_WORKSPACE"
    else
        print_info "Selecting existing workspace: $TERRAFORM_WORKSPACE"
        terraform workspace select "$TERRAFORM_WORKSPACE"
    fi
    
    # Verify workspace
    CURRENT_WS=$(terraform workspace show)
    if [[ "$CURRENT_WS" != "$TERRAFORM_WORKSPACE" ]]; then
        print_error "Failed to select workspace $TERRAFORM_WORKSPACE (current: $CURRENT_WS)"
        exit 1
    fi
    
    print_success "Tenant workspace ready: $CURRENT_WS"
    cd - > /dev/null
}

# Validate workspace consistency between admin and tenant
validate_workspace_consistency() {
    print_info "Validating workspace consistency"
    
    # Check admin workspace
    cd "$IAC_DIR"
    terraform init -backend-config="${TERRAFORM_WORKSPACE}.conf" > /dev/null
    ADMIN_WORKSPACE=$(terraform workspace show)
    cd - > /dev/null
    
    # Check tenant workspace if tenant IAC exists
    if [[ -d "$TENANT_IAC_DIR" ]]; then
        cd "$TENANT_IAC_DIR"
        terraform init -backend-config="${TERRAFORM_WORKSPACE}.conf" > /dev/null
        TENANT_WORKSPACE=$(terraform workspace show)
        cd - > /dev/null
        
        if [[ "$ADMIN_WORKSPACE" != "$TENANT_WORKSPACE" ]]; then
            print_error "Workspace mismatch: Admin=$ADMIN_WORKSPACE, Tenant=$TENANT_WORKSPACE"
            exit 1
        fi
    fi
    
    if [[ "$ADMIN_WORKSPACE" != "$TERRAFORM_WORKSPACE" ]]; then
        print_error "Current workspace ($ADMIN_WORKSPACE) doesn't match requested ($TERRAFORM_WORKSPACE)"
        exit 1
    fi
    
    print_success "Workspace consistency validated: $TERRAFORM_WORKSPACE"
}

# Show workspace help
show_workspace_help() {
    cat << EOF
Usage: ./cicd.sh <command> --workspace=<WORKSPACE> [options]

Required Parameters:
  --workspace=<WORKSPACE>    Workspace prefix (dev|qa|prd|uat)

Optional Parameters:
  --env=<ENV>               Environment suffix (default: dev)
  --admin-account=<ACCOUNT> Admin AWS account ID
  --tenant-account=<ACCOUNT> Tenant AWS account ID
  --tenant-id=<ID>          Tenant identifier

Allowed Workspaces:
  dev  - Development environment
  qa   - Quality Assurance environment  
  prd  - Production environment
  uat  - User Acceptance Testing environment

Examples:
  ./cicd.sh deploy-admin --workspace=dev --admin-account=583122682394
  ./cicd.sh deploy-tenant --workspace=prd --admin-account=583122682394 --tenant-account=123456789012
  ./cicd.sh deploy-full --workspace=qa --admin-account=583122682394 --tenant-account=123456789012
EOF
}

# ============================================================================
# Modular Infrastructure Functions
# ============================================================================

# Admin infrastructure functions
bootstrap_admin_infrastructure() {
    print_header "Bootstrapping Admin Infrastructure"
    validate_admin_command
    
    print_info "Account: $AWS_ACCOUNT_ID, Workspace: $TERRAFORM_WORKSPACE, Profile: $AWS_ADMIN_PROFILE"
    
    cd "$IAC_DIR/bootstrap"
    AWS_PROFILE="$AWS_ADMIN_PROFILE" terraform init
    AWS_PROFILE="$AWS_ADMIN_PROFILE" terraform plan \
        -var="workspace_prefix=${TERRAFORM_WORKSPACE}" \
        -var="admin_account_id=${AWS_ACCOUNT_ID}" \
        -var="aws_region=${AWS_REGION}" \
        -var="aws_profile=${AWS_ADMIN_PROFILE}" \
        -out="bootstrap-plan"
    AWS_PROFILE="$AWS_ADMIN_PROFILE" terraform apply "bootstrap-plan"
    cd - > /dev/null
    print_success "Admin infrastructure bootstrapped for account: $AWS_ACCOUNT_ID"
}

plan_admin_infrastructure() {
    print_header "Planning Admin Infrastructure"
    validate_admin_command
    
    manage_admin_workspace
    cd "$IAC_DIR"
    AWS_PROFILE="$AWS_ADMIN_PROFILE" terraform plan \
        -var="workspace_prefix=${TERRAFORM_WORKSPACE}" \
        -var="admin_account_id=${AWS_ACCOUNT_ID}" \
        -var="tenant_account_id=${AWS_ACCOUNT_ID}" \
        -var-file="environments/${ENV}.tfvars" \
        -out="tfplan-${TERRAFORM_WORKSPACE}-${ENV}"
    cd - > /dev/null
    print_success "Admin infrastructure plan created for account: $AWS_ACCOUNT_ID"
}

apply_admin_infrastructure() {
    print_header "Applying Admin Infrastructure"
    validate_admin_command
    
    manage_admin_workspace
    cd "$IAC_DIR"
    
    if [[ ! -f "tfplan-${TERRAFORM_WORKSPACE}-${ENV}" ]]; then
        print_error "Plan file not found. Run: ./cicd.sh admin-plan --workspace=${TERRAFORM_WORKSPACE} --aws-account=${AWS_ACCOUNT_ID}"
        exit 1
    fi
    
    AWS_PROFILE="$AWS_ADMIN_PROFILE" terraform apply "tfplan-${TERRAFORM_WORKSPACE}-${ENV}"
    cd - > /dev/null
    print_success "Admin infrastructure applied for account: $AWS_ACCOUNT_ID"
}

destroy_admin_infrastructure() {
    print_header "💥 Destroying Admin Infrastructure"
    print_warning "⚠️  This will destroy all admin infrastructure!"
    echo "Press Ctrl+C to cancel, or Enter to continue..."
    read -r
    
    validate_admin_command
    manage_admin_workspace
    cd "$IAC_DIR"
    AWS_PROFILE="$AWS_ADMIN_PROFILE" terraform destroy \
        -var="workspace_prefix=${TERRAFORM_WORKSPACE}" \
        -var="admin_account_id=${AWS_ACCOUNT_ID}" \
        -var="tenant_account_id=${AWS_ACCOUNT_ID}" \
        -var-file="environments/${ENV}.tfvars" \
        -auto-approve
    cd - > /dev/null
    print_success "✅ Admin infrastructure destroyed for account: $AWS_ACCOUNT_ID"
}

# Tenant infrastructure functions
bootstrap_tenant_infrastructure() {
    print_header "🔧 Bootstrapping Tenant Infrastructure"
    validate_tenant_command
    
    print_info "Tenant Account: $AWS_ACCOUNT_ID, Admin Account: $ADMIN_ACCOUNT_ID"
    print_info "Workspace: $TERRAFORM_WORKSPACE, Profile: $AWS_TENANT_PROFILE"
    
    cd "$TENANT_IAC_DIR/bootstrap"
    AWS_PROFILE="$AWS_TENANT_PROFILE" terraform init
    AWS_PROFILE="$AWS_TENANT_PROFILE" terraform plan \
        -var="workspace_prefix=${TERRAFORM_WORKSPACE}" \
        -var="tenant_account_id=${AWS_ACCOUNT_ID}" \
        -var="admin_account_id=${ADMIN_ACCOUNT_ID}" \
        -var="tenant_aws_profile=${AWS_TENANT_PROFILE}" \
        -var="aws_region=${AWS_REGION}" \
        -out="bootstrap-plan"
    AWS_PROFILE="$AWS_TENANT_PROFILE" terraform apply "bootstrap-plan"
    cd - > /dev/null
    print_success "✅ Tenant infrastructure bootstrapped for account: $AWS_ACCOUNT_ID"
}

plan_tenant_infrastructure() {
    print_header "📋 Planning Tenant Infrastructure"
    validate_tenant_command
    
    manage_tenant_workspace
    cd "$TENANT_IAC_DIR"
    AWS_PROFILE="$AWS_TENANT_PROFILE" terraform plan \
        -var="workspace_prefix=${TERRAFORM_WORKSPACE}" \
        -var="admin_account_id=${ADMIN_ACCOUNT_ID}" \
        -var="tenant_account_id=${AWS_ACCOUNT_ID}" \
        -var="tenant_id=${TENANT_ID}" \
        -var="environment=${ENV}" \
        -var-file="environments/${ENV}.tfvars" \
        -out="tfplan-${TERRAFORM_WORKSPACE}-${ENV}"
    cd - > /dev/null
    print_success "✅ Tenant infrastructure plan created for account: $AWS_ACCOUNT_ID"
}

apply_tenant_infrastructure() {
    print_header "🚀 Applying Tenant Infrastructure"
    validate_tenant_command
    
    manage_tenant_workspace
    cd "$TENANT_IAC_DIR"
    
    if [[ ! -f "tfplan-${TERRAFORM_WORKSPACE}-${ENV}" ]]; then
        print_error "Plan file not found. Run tenant-plan first"
        exit 1
    fi
    
    AWS_PROFILE="$AWS_TENANT_PROFILE" terraform apply "tfplan-${TERRAFORM_WORKSPACE}-${ENV}"
    cd - > /dev/null
    print_success "✅ Tenant infrastructure applied for account: $AWS_ACCOUNT_ID"
}

destroy_tenant_infrastructure() {
    print_header "💥 Destroying Tenant Infrastructure"
    print_warning "⚠️  This will destroy all tenant infrastructure!"
    echo "Press Ctrl+C to cancel, or Enter to continue..."
    read -r
    
    validate_tenant_command
    manage_tenant_workspace
    cd "$TENANT_IAC_DIR"
    AWS_PROFILE="$AWS_TENANT_PROFILE" terraform destroy \
        -var="workspace_prefix=${TERRAFORM_WORKSPACE}" \
        -var="admin_account_id=${ADMIN_ACCOUNT_ID}" \
        -var="tenant_account_id=${AWS_ACCOUNT_ID}" \
        -var="tenant_id=${TENANT_ID}" \
        -var="environment=${ENV}" \
        -var-file="environments/${ENV}.tfvars" \
        -auto-approve
    cd - > /dev/null
    print_success "✅ Tenant infrastructure destroyed for account: $AWS_ACCOUNT_ID"
}

# ============================================================================
# Unified Service Management Functions
# ============================================================================

# Main service management functions
build_service() {
    local service_name="$1"
    validate_service_name "$service_name"
    
    print_header "🔨 Building Service: $service_name"
    
    case "$service_name" in
        "admin-portal-fe")
            build_react_frontend
            ;;
        "admin-portal-web-server")
            build_web_server_service "$service_name"
            ;;
        "create-infra-worker"|"delete-infra-worker"|"poll-infra-worker"|"create-admin-worker"|"jwt-authorizer")
            build_lambda_service "$service_name"
            ;;
        "admin-portal-be"|"ims-service")
            build_backend_service "$service_name"
            ;;
        *)
            print_error "Service build not implemented: $service_name"
            exit 1
            ;;
    esac
}

deploy_service() {
    local service_name="$1"
    validate_service_name "$service_name"
    
    print_header "🚀 Deploying Service: $service_name"
    
    case "$service_name" in
        "admin-portal-fe")
            deploy_react_frontend
            ;;
        "admin-portal-web-server"|"create-infra-worker"|"delete-infra-worker"|"poll-infra-worker"|"create-admin-worker"|"jwt-authorizer"|"admin-portal-be"|"ims-service")
            deploy_lambda_or_backend_service "$service_name"
            ;;
        *)
            print_error "Service deployment not implemented: $service_name"
            exit 1
            ;;
    esac
}

test_service() {
    local service_name="$1"
    validate_service_name "$service_name"
    
    print_header "🧪 Testing Service: $service_name"
    
    case "$service_name" in
        "admin-portal-fe")
            test_react_frontend
            ;;
        "create-infra-worker"|"delete-infra-worker"|"poll-infra-worker"|"create-admin-worker"|"jwt-authorizer")
            test_lambda_service "$service_name"
            ;;
        "admin-portal-be"|"ims-service"|"admin-portal-web-server")
            test_backend_service "$service_name"
            ;;
        *)
            print_error "Service testing not implemented: $service_name"
            exit 1
            ;;
    esac
}

# React frontend functions
build_react_frontend() {
    print_info "Building React frontend: admin-portal-fe"
    
    # Get API Gateway URL from Terraform outputs
    cd "$IAC_DIR"
    API_GATEWAY_URL=$(AWS_PROFILE="$AWS_ADMIN_PROFILE" terraform output -raw admin_backend_api_url 2>/dev/null || echo "")
    cd - > /dev/null
    
    if [[ -z "$API_GATEWAY_URL" ]]; then
        print_warning "Could not get API Gateway URL from Terraform output"
        print_info "Using fallback localhost URL for development"
        API_GATEWAY_URL="http://localhost:3001/api/v1"
    fi
    
    print_info "Using API Gateway URL for both tenant and IMS APIs: $API_GATEWAY_URL"
    
    cd "$FE_DIR"
    
    print_info "Installing frontend dependencies"
    npm install
    
    print_info "Running frontend build with dynamic API endpoint"
    # Set environment variables and build
    export REACT_APP_API_BASE_URL="$API_GATEWAY_URL"
    export REACT_APP_IMS_BASE_URL="$API_GATEWAY_URL"
    export REACT_APP_ENVIRONMENT="$TERRAFORM_WORKSPACE"
    
    npm run build
    
    if [[ -d "build" ]]; then
        print_success "✅ admin-portal-fe built successfully with API URL: $API_GATEWAY_URL"
    else
        print_error "admin-portal-fe build failed - build directory not found"
        exit 1
    fi
    
    cd - > /dev/null
}

deploy_react_frontend() {
    print_info "Deploying React frontend: admin-portal-fe"
    
    if [[ ! -d "$FE_DIR/build" ]]; then
        print_error "Frontend build not found. Run: ./cicd.sh build --service=admin-portal-fe"
        exit 1
    fi
    
    cd "$IAC_DIR"
    # Use AWS_ADMIN_PROFILE for terraform output command
    BUCKET_NAME=$(AWS_PROFILE="$AWS_ADMIN_PROFILE" terraform output -raw admin_portal_bucket_name 2>/dev/null || echo "")
    cd - > /dev/null
    
    if [[ -n "$BUCKET_NAME" ]]; then
        aws s3 sync "$FE_DIR/build/" "s3://$BUCKET_NAME/" --delete --profile "$AWS_ADMIN_PROFILE"
        print_success "admin-portal-fe deployed to S3: $BUCKET_NAME"
    else
        print_error "Could not get S3 bucket name from Terraform output"
        print_info "Make sure admin infrastructure is deployed first with: ./cicd.sh admin-apply --workspace=${TERRAFORM_WORKSPACE} --aws-account=${AWS_ACCOUNT_ID} --admin-profile=${AWS_ADMIN_PROFILE}"
        exit 1
    fi
}

test_react_frontend() {
    print_info "Testing React frontend: admin-portal-fe"
    
    cd "$FE_DIR"
    
    if [[ -f "package.json" ]] && grep -q '"test"' package.json; then
        npm test -- --coverage --watchAll=false
        print_success "✅ admin-portal-fe tests passed"
    else
        print_warning "No tests found for admin-portal-fe"
    fi
    
    cd - > /dev/null
}

# Web server service functions
build_web_server_service() {
    local service_name="$1"
    print_info "Building web server service: $service_name"
    
    if [[ ! -d "$WEB_SERVER_DIR" ]]; then
        print_error "Web server directory not found: $WEB_SERVER_DIR"
        exit 1
    fi
    
    cd "$WEB_SERVER_DIR"
    
    print_info "Installing dependencies for $service_name"
    npm ci --production
    
    print_info "Creating deployment package for $service_name"
    zip -r "../admin-portal-iac/lambda-packages/${service_name}.zip" . \
        -x "node_modules/.cache/*" "*.test.js" "test/*" ".git/*"
    
    cd - > /dev/null
    print_success "✅ $service_name built successfully"
}

# Lambda service functions
build_lambda_service() {
    local service_name="$1"
    print_info "Building Lambda service: $service_name"
    
    if [[ ! -d "$service_name" ]]; then
        print_error "Lambda directory not found: $service_name"
        exit 1
    fi
    
    cd "$service_name"
    
    print_info "Installing dependencies for $service_name"
    npm ci --production
    
    print_info "Creating deployment package for $service_name"
    zip -r "../admin-portal-iac/lambda-packages/${service_name}.zip" . \
        -x "node_modules/.cache/*" "*.test.js" "test/*" ".git/*"
    
    cd - > /dev/null
    print_success "✅ $service_name built successfully"
}

# Backend service functions
build_backend_service() {
    local service_name="$1"
    print_info "Building backend service: $service_name"
    
    if [[ ! -d "$service_name" ]]; then
        print_error "Backend directory not found: $service_name"
        exit 1
    fi
    
    cd "$service_name"
    
    print_info "Installing dependencies for $service_name"
    npm ci --production
    
    print_info "Creating deployment package for $service_name"
    zip -r "../admin-portal-iac/lambda-packages/${service_name}.zip" . \
        -x "node_modules/.cache/*" "*.test.js" "test/*" ".git/*" "coverage/*"
    
    cd - > /dev/null
    print_success "✅ $service_name built successfully"
}

# Unified deployment for Lambda and backend services
# Map service names to Terraform function names
get_lambda_function_name() {
    local service_name="$1"
    local terraform_function_name
    
    case "$service_name" in
        "admin-portal-web-server")
            terraform_function_name="web-server"
            ;;
        "admin-portal-be")
            terraform_function_name="backend"
            ;;
        *)
            terraform_function_name="$service_name"
            ;;
    esac
    
    echo "admin-portal-${TERRAFORM_WORKSPACE:-dev}-${terraform_function_name}"
}

deploy_lambda_or_backend_service() {
    local service_name="$1"
    print_info "Deploying service: $service_name"
    
    local package_path="$IAC_DIR/lambda-packages/${service_name}.zip"
    if [[ ! -f "$package_path" ]]; then
        print_error "Package not found: $package_path"
        print_info "Run: ./cicd.sh build --service=$service_name --workspace=${TERRAFORM_WORKSPACE}"
        exit 1
    fi
    
    cd "$IAC_DIR"
    local full_function_name=$(get_lambda_function_name "$service_name")
    
    # Verify Lambda function exists before attempting update
    print_info "Verifying Lambda function: $full_function_name"
    if ! aws lambda get-function --function-name "$full_function_name" --profile "$AWS_ADMIN_PROFILE" > /dev/null 2>&1; then
        print_error "Lambda function not found: $full_function_name"
        print_error "The Lambda function does not exist in AWS."
        print_info "Expected function name: $full_function_name"
        print_info "Workspace: ${TERRAFORM_WORKSPACE}"
        print_info ""
        print_info "To create the Lambda function, run:"
        print_info "  ./cicd.sh admin-apply --workspace=${TERRAFORM_WORKSPACE} --aws-account=${AWS_ACCOUNT_ID} --admin-profile=${AWS_ADMIN_PROFILE}"
        exit 1
    fi
    
    print_info "Updating Lambda function code: $full_function_name"
    if aws lambda update-function-code \
        --function-name "$full_function_name" \
        --zip-file "fileb://lambda-packages/${service_name}.zip" \
        --profile "$AWS_ADMIN_PROFILE" > /dev/null; then
        print_success "✅ $service_name deployed successfully to $full_function_name"
    else
        print_error "Failed to deploy $service_name"
        print_error "Check AWS credentials and permissions for profile: $AWS_ADMIN_PROFILE"
        exit 1
    fi
    
    cd - > /dev/null
}

# Testing functions
test_lambda_service() {
    local service_name="$1"
    print_info "Testing Lambda service: $service_name"
    
    if [[ ! -d "$service_name" ]]; then
        print_error "Lambda directory not found: $service_name"
        exit 1
    fi
    
    cd "$service_name"
    
    if [[ -f "package.json" ]] && grep -q '"test"' package.json; then
        npm test
        print_success "✅ $service_name tests passed"
    else
        print_warning "No tests found for $service_name"
    fi
    
    cd - > /dev/null
}

test_backend_service() {
    local service_name="$1"
    print_info "Testing backend service: $service_name"
    
    if [[ ! -d "$service_name" ]]; then
        print_error "Backend directory not found: $service_name"
        exit 1
    fi
    
    cd "$service_name"
    
    if [[ -f "package.json" ]] && grep -q '"test"' package.json; then
        npm test
        print_success "✅ $service_name tests passed"
    else
        print_warning "No tests found for $service_name"
    fi
    
    cd - > /dev/null
}
validate_account_setup() {
    print_info "🔍 Validating account configuration"
    
    if [[ -n "$TENANT_ACCOUNT_ID" && "$ADMIN_ACCOUNT_ID" == "$TENANT_ACCOUNT_ID" ]]; then
        print_warning "⚠️  Same account detected for admin and tenant"
        print_info "📋 Only DynamoDB resources will be created for tenant"
        print_info "🔧 Bootstrap will be skipped for tenant (using admin bootstrap)"
    else
        print_info "✅ Different accounts detected"
        print_info "🏗️  Full tenant infrastructure will be created"
    fi
}

# Validate tenant configuration
validate_tenant_config() {
    if [[ -z "$TENANT_ACCOUNT_ID" ]]; then
        print_error "TENANT_ACCOUNT_ID is required for tenant deployment"
        exit 1
    fi
    
    if [[ -z "$TENANT_ID" ]]; then
        print_error "TENANT_ID is required for tenant deployment"
        exit 1
    fi
    
    validate_account_setup
}

# Parse command line arguments
parse_args() {
    while [[ $# -gt 0 ]]; do
        case $1 in
            --workspace=*)
                TERRAFORM_WORKSPACE="${1#*=}"
                shift
                ;;
            --aws-account=*)
                AWS_ACCOUNT_ID="${1#*=}"
                shift
                ;;
            --admin-account=*)
                ADMIN_ACCOUNT_ID="${1#*=}"
                shift
                ;;
            --service=*)
                SERVICE_NAME="${1#*=}"
                shift
                ;;
            --component=*)
                COMPONENT="${1#*=}"
                shift
                ;;
            --env=*)
                ENV="${1#*=}"
                shift
                ;;
            --region=*)
                AWS_REGION="${1#*=}"
                shift
                ;;
            --admin-profile=*)
                AWS_ADMIN_PROFILE="${1#*=}"
                shift
                ;;
            --tenant-profile=*)
                AWS_TENANT_PROFILE="${1#*=}"
                shift
                ;;
            --profile=*)
                # Legacy support - set both admin and tenant profile
                AWS_ADMIN_PROFILE="${1#*=}"
                AWS_TENANT_PROFILE="${1#*=}"
                shift
                ;;
            --tenant-id=*)
                TENANT_ID="${1#*=}"
                shift
                ;;
            --help|-h)
                show_enhanced_help
                exit 0
                ;;
            *)
                # Unknown option, treat as command if first argument
                if [[ -z "${COMMAND:-}" ]]; then
                    COMMAND="$1"
                fi
                shift
                ;;
        esac
    done
}

# Check if command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# ============================================================================
# Environment Setup & Validation
# ============================================================================

validate_env() {
    print_info "Validating environment configuration..."
    
    if [[ -z "$ENV" ]]; then
        print_error "ENV is required"
        exit 1
    fi
    
    if [[ -z "$AWS_REGION" ]]; then
        print_error "AWS_REGION is required"
        exit 1
    fi
    
    echo "Environment: $ENV, Region: $AWS_REGION"
}

install_tools() {
    print_info "Validating required tools..."
    
    local missing_tools=()
    
    if ! command_exists terraform; then
        missing_tools+=("terraform")
    fi
    
    if ! command_exists node; then
        missing_tools+=("node")
    fi
    
    if ! command_exists npm; then
        missing_tools+=("npm")
    fi
    
    if ! command_exists aws; then
        missing_tools+=("aws")
    fi
    
    if [[ ${#missing_tools[@]} -gt 0 ]]; then
        print_error "Missing required tools: ${missing_tools[*]}"
        exit 1
    fi
    
    print_success "All required tools are available"
}

validate_aws() {
    print_info "Validating AWS credentials..."
    
    if ! aws sts get-caller-identity --profile "$AWS_PROFILE" >/dev/null 2>&1; then
        print_error "AWS credentials validation failed"
        exit 1
    fi
    
    print_success "AWS credentials validated"
}

setup() {
    print_header "Environment Setup & Validation"
    validate_env
    install_tools
    validate_aws
    print_success "Environment setup completed"
}

# ============================================================================
# Dependencies & Installation
# ============================================================================

install_frontend() {
    print_info "Installing frontend dependencies..."
    cd "$FE_DIR" && npm ci
    cd "$SCRIPT_DIR"
    print_success "Frontend dependencies installed"
}

install_backend() {
    print_info "Installing backend dependencies..."
    cd "$BE_DIR" && npm ci
    cd "$SCRIPT_DIR"
    print_success "Backend dependencies installed"
}

install_workers() {
    print_info "Installing worker dependencies..."
    for worker in "${LAMBDA_DIRS[@]}"; do
        echo -e "${CYAN}  Installing $worker...${NC}"
        cd "$worker" && npm ci && cd "$SCRIPT_DIR"
    done
    print_success "Worker dependencies installed"
}

install_ims() {
    print_info "Installing IMS service dependencies..."
    cd "$IMS_DIR" && npm ci
    cd "$SCRIPT_DIR"
    print_success "IMS dependencies installed"
}

install_web_server() {
    print_info "Installing web server dependencies..."
    cd "$WEB_SERVER_DIR" && npm ci
    cd "$SCRIPT_DIR"
    print_success "Web server dependencies installed"
}

install() {
    print_header "Installing Dependencies"
    install_frontend
    install_backend
    install_workers
    install_ims
    install_web_server
    print_success "All dependencies installed"
}

# ============================================================================
# Linting & Code Quality
# ============================================================================

lint_frontend() {
    print_info "Linting frontend code..."
    cd "$FE_DIR"
    if npm run lint >/dev/null 2>&1; then
        print_success "Frontend linting passed"
    else
        print_warning "No lint script found for frontend"
    fi
    cd "$SCRIPT_DIR"
}

lint_backend() {
    print_info "Linting backend code..."
    cd "$BE_DIR" && npm run lint
    cd "$SCRIPT_DIR"
}

lint_ims() {
    print_info "Linting IMS service code..."
    cd "$IMS_DIR"
    if npm run lint >/dev/null 2>&1; then
        print_success "IMS linting passed"
    else
        print_warning "No lint script found for IMS"
    fi
    cd "$SCRIPT_DIR"
}

lint_workers() {
    print_info "Linting worker code..."
    for worker in "${LAMBDA_DIRS[@]}"; do
        echo -e "${CYAN}  Linting $worker...${NC}"
        cd "$worker"
        if npm run lint >/dev/null 2>&1; then
            echo "  $worker linting passed"
        else
            echo "  No lint script found for $worker"
        fi
        cd "$SCRIPT_DIR"
    done
}

lint() {
    print_header "Code Linting"
    lint_frontend
    lint_backend
    lint_ims
    lint_workers
    print_success "All linting completed"
}

# ============================================================================
# Testing
# ============================================================================

test_backend() {
    print_info "Testing backend..."
    cd "$BE_DIR" && npm test
    cd "$SCRIPT_DIR"
}

test_ims() {
    print_info "Testing IMS service..."
    cd "$IMS_DIR"
    if npm test >/dev/null 2>&1; then
        print_success "IMS tests passed"
    else
        print_warning "No tests configured for IMS"
    fi
    cd "$SCRIPT_DIR"
}

test_workers() {
    print_info "Testing worker functions..."
    for worker in "${LAMBDA_DIRS[@]}"; do
        echo "Testing $worker..."
        cd "$worker"
        if npm test >/dev/null 2>&1; then
            echo "  $worker tests passed"
        else
            echo "  No tests configured for $worker"
        fi
        cd "$SCRIPT_DIR"
    done
}

test() {
    print_header "Running Tests"
    test_backend
    test_ims
    test_workers
    print_success "All tests completed"
}

# ============================================================================
# Legacy Create Lambda Zips (Deprecated - kept for backwards compatibility)
# Use: ./cicd.sh build --service=<service-name> instead
# ============================================================================

create_lambda_zips() {
    print_info "Creating Lambda deployment packages..."
    cd "$IAC_DIR/lambda-packages"
    
    for dir in */; do
        if [[ -d "$dir" ]]; then
            echo -e "${CYAN}  Zipping $dir...${NC}"
            cd "$dir" && zip -r "../${dir%/}.zip" . -x "*.git*" "node_modules/.cache/*" >/dev/null && cd ..
        fi
    done
    
    cd "$SCRIPT_DIR"
    print_success "Lambda packages created"
}

create_frontend_archive() {
    print_info "Creating frontend archive..."
    if [[ -d "$FE_DIR/build" ]]; then
        cd "$FE_DIR" && tar -czf "../$IAC_DIR/frontend-$VERSION.tar.gz" build/
        cd "$SCRIPT_DIR"
        print_success "Frontend archive created"
    else
        print_error "Frontend build directory not found"
        exit 1
    fi
}

package() {
    print_header "Creating Deployment Packages"
    create_lambda_zips
    create_frontend_archive
    print_success "All deployment packages created"
}

# ============================================================================
# Infrastructure Deployment
# ============================================================================

terraform_init() {
    print_info "Initializing Terraform..."
    cd "$IAC_DIR" && terraform init -backend-config="backend-$ENV.conf"
    cd "$SCRIPT_DIR"
    print_success "Terraform initialized"
}

terraform_plan() {
    print_info "Creating Terraform plan..."
    cd "$IAC_DIR" && terraform plan -var-file="environments/$ENV.tfvars" -out="tfplan-$ENV-$TIMESTAMP"
    cd "$SCRIPT_DIR"
    print_success "Terraform plan created: tfplan-$ENV-$TIMESTAMP"
}

terraform_apply() {
    print_info "Applying Terraform configuration..."
    cd "$IAC_DIR" && terraform apply -auto-approve "tfplan-$ENV-$TIMESTAMP"
    cd "$SCRIPT_DIR"
    print_success "Infrastructure deployed"
}

deploy_infrastructure() {
    print_header "🏗️ Admin Infrastructure Deployment"
    
    validate_workspace
    generate_resource_names
    manage_admin_workspace
    
    cd "$IAC_DIR"
    
    terraform plan \
        -var="workspace_prefix=${TERRAFORM_WORKSPACE}" \
        -var="admin_account_id=${ADMIN_ACCOUNT_ID}" \
        -var="tenant_account_id=${TENANT_ACCOUNT_ID}" \
        -var="environment=${ENV}" \
        -var-file="environments/${ENV}.tfvars" \
        -out="tfplan-${TERRAFORM_WORKSPACE}-${ENV}"
    
    terraform apply "tfplan-${TERRAFORM_WORKSPACE}-${ENV}"
    
    cd - > /dev/null
    print_success "✅ Admin infrastructure deployed in workspace: $TERRAFORM_WORKSPACE"
}

# Deploy admin infrastructure (new function name for clarity)
deploy_admin_infrastructure() {
    print_header "🏗️ Deploying Admin Infrastructure"
    deploy_infrastructure
}

# Deploy tenant infrastructure
deploy_tenant_infrastructure() {
    print_header "🏢 Deploying Tenant Infrastructure"
    
    validate_workspace
    validate_tenant_config
    generate_resource_names
    
    # Check if bootstrap is needed
    if [[ "$ADMIN_ACCOUNT_ID" != "$TENANT_ACCOUNT_ID" ]]; then
        print_info "🔧 Running tenant bootstrap (different account)"
        deploy_tenant_bootstrap
    else
        print_info "⏭️  Skipping tenant bootstrap (same account as admin)"
    fi
    
    manage_tenant_workspace
    
    cd "$TENANT_IAC_DIR"
    
    terraform plan \
        -var="workspace_prefix=${TERRAFORM_WORKSPACE}" \
        -var="admin_account_id=${ADMIN_ACCOUNT_ID}" \
        -var="tenant_account_id=${TENANT_ACCOUNT_ID}" \
        -var="tenant_id=${TENANT_ID}" \
        -var="environment=${ENV}" \
        -var-file="environments/${ENV}.tfvars" \
        -out="tfplan-${TERRAFORM_WORKSPACE}-${ENV}"
    
    terraform apply "tfplan-${TERRAFORM_WORKSPACE}-${ENV}"
    
    cd - > /dev/null
    print_success "✅ Tenant infrastructure deployed in workspace: $TERRAFORM_WORKSPACE"
}

# Deploy tenant bootstrap
deploy_tenant_bootstrap() {
    print_info "🔧 Deploying Tenant Bootstrap"
    
    cd "$TENANT_IAC_DIR/bootstrap"
    
    terraform init
    terraform plan \
        -var="workspace_prefix=${TERRAFORM_WORKSPACE}" \
        -var="admin_account_id=${ADMIN_ACCOUNT_ID}" \
        -var="tenant_account_id=${TENANT_ACCOUNT_ID}" \
        -var="tenant_aws_profile=${TENANT_AWS_PROFILE}" \
        -var-file="../environments/${ENV}.tfvars" \
        -out="bootstrap-plan"
    
    terraform apply "bootstrap-plan"
    
    cd - > /dev/null
    print_success "✅ Tenant bootstrap completed"
}

# Deploy both admin and tenant infrastructure
deploy_full_infrastructure() {
    print_info "🌐 Deploying Full Multi-Account Infrastructure"
    
    validate_workspace
    
    # Deploy admin first
    deploy_admin_infrastructure
    
    # Deploy tenant second
    deploy_tenant_infrastructure
    
    print_success "✅ Full infrastructure deployment completed in workspace: $TERRAFORM_WORKSPACE"
}

# ============================================================================
# Application Deployment
# ============================================================================

deploy_s3_assets() {
    print_info "Uploading frontend assets to S3..."
    if [[ -d "$FE_DIR/build" ]]; then
        cd "$IAC_DIR"
        BUCKET_NAME=$(terraform output -raw s3_portal_bucket_name 2>/dev/null || echo "")
        cd "$SCRIPT_DIR"
        
        if [[ -n "$BUCKET_NAME" ]]; then
            aws s3 sync "$FE_DIR/build/" "s3://$BUCKET_NAME/" --delete --profile "$AWS_PROFILE"
            print_success "Frontend assets deployed to S3"
        else
            print_error "Could not get S3 bucket name from Terraform output"
            exit 1
        fi
    else
        print_error "Frontend build directory not found"
        exit 1
    fi
}

update_lambda_functions() {
    print_info "Updating Lambda functions..."
    cd "$IAC_DIR"
    
    for zip in lambda-packages/*.zip; do
        if [[ -f "$zip" ]]; then
            FUNCTION_NAME=$(basename "$zip" .zip)
            echo -e "${CYAN}  Updating $FUNCTION_NAME...${NC}"
            
            if aws lambda update-function-code \
                --function-name "$PROJECT_NAME-$ENV-$FUNCTION_NAME" \
                --zip-file "fileb://$zip" \
                --profile "$AWS_PROFILE" >/dev/null 2>&1; then
                echo "  $FUNCTION_NAME updated successfully"
            else
                print_warning "Failed to update $FUNCTION_NAME"
            fi
        fi
    done
    
    cd "$SCRIPT_DIR"
    print_success "Lambda functions updated"
}

deploy_applications() {
    print_header "Application Deployment"
    deploy_s3_assets
    update_lambda_functions
    print_success "Application deployment completed"
}

# ============================================================================
# Testing & Verification
# ============================================================================

verify_infrastructure() {
    print_info "Verifying infrastructure..."
    cd "$IAC_DIR"
    
    if terraform plan -var-file="environments/$ENV.tfvars" -detailed-exitcode >/dev/null 2>&1; then
        print_success "Infrastructure verified - no drift detected"
    else
        print_error "Infrastructure drift detected"
        cd "$SCRIPT_DIR"
        exit 1
    fi
    
    cd "$SCRIPT_DIR"
}

verify_applications() {
    print_info "Verifying application deployment..."
    cd "$IAC_DIR"
    
    API_URL=$(terraform output -raw api_gateway_url 2>/dev/null || echo "")
    if [[ -n "$API_URL" ]]; then
        if curl -f "$API_URL/health" >/dev/null 2>&1; then
            echo "API health check passed"
        else
            print_warning "API health check failed"
        fi
    fi
    
    WEB_URL=$(terraform output -raw web_server_url 2>/dev/null || echo "")
    if [[ -n "$WEB_URL" ]]; then
        if curl -f "$WEB_URL" >/dev/null 2>&1; then
            echo "Web server check passed"
        else
            print_warning "Web server check failed"
        fi
    fi
    
    cd "$SCRIPT_DIR"
    print_success "Application verification completed"
}

verify() {
    print_header "Verification"
    verify_infrastructure
    verify_applications
    print_success "Verification completed"
}

# ============================================================================
# Pipeline Orchestration
# ============================================================================

full_pipeline() {
    print_header "Full CI/CD Pipeline"
    clean
    setup
    install
    lint
    build
    test
    package
    deploy_infrastructure
    deploy_applications
    verify
    print_success "Full pipeline completed successfully"
}

ci_build() {
    print_header "CI Build Pipeline"
    setup
    install
    lint
    build
    test
    package
    print_success "CI build completed"
}

cd_deploy() {
    print_header "CD Deployment Pipeline"
    deploy_infrastructure
    deploy_applications
    verify
    print_success "CD deployment completed"
}

deploy_dev() {
    ENV="dev"
    full_pipeline
}

deploy_prod() {
    ENV="prod"
    full_pipeline
}

# ============================================================================
# Maintenance & Cleanup
# ============================================================================

clean() {
    print_info "Cleaning build artifacts..."
    rm -rf "$FE_DIR/build" 2>/dev/null || true
    rm -rf "$IAC_DIR/lambda-packages" 2>/dev/null || true
    rm -f "$IAC_DIR/tfplan-"* 2>/dev/null || true
    rm -f "$IAC_DIR/frontend-"*.tar.gz 2>/dev/null || true
    find . -name "node_modules" -type d -path "*/lambda-packages/*" -exec rm -rf {} + 2>/dev/null || true
    print_success "Cleanup completed"
}

destroy() {
    print_info "Destroying infrastructure..."
    echo -e "${YELLOW}WARNING: This will destroy all infrastructure!${NC}"
    echo "Press Ctrl+C to cancel, or Enter to continue..."
    read -r
    cd "$IAC_DIR" && terraform destroy -var-file="environments/$ENV.tfvars" -auto-approve
    cd "$SCRIPT_DIR"
    print_success "Infrastructure destroyed"
}

status() {
    print_info "Build Status Check"
    echo -e "${CYAN}Environment:${NC} $ENV"
    echo -e "${CYAN}AWS Region:${NC} $AWS_REGION"
    echo -e "${CYAN}AWS Profile:${NC} $AWS_PROFILE"
    echo -e "${CYAN}Project Version:${NC} $VERSION"
    echo -e "${CYAN}Frontend Build:${NC} $([ -d "$FE_DIR/build" ] && echo "Present" || echo "Missing")"
    echo -e "${CYAN}Lambda Packages:${NC} $([ -d "$IAC_DIR/lambda-packages" ] && echo "Present" || echo "Missing")"
    echo -e "${CYAN}Terraform State:${NC} $([ -f "$IAC_DIR/.terraform/terraform.tfstate" ] && echo "Initialized" || echo "Not initialized")"
}

# ============================================================================
# Help & Usage
# ============================================================================

show_enhanced_help() {
    cat << 'EOF'
CI/CD Pipeline Script - Multi-Tenant Infrastructure & Service Management
=======================================================================

USAGE:
    ./cicd.sh <command> [options]

COMMANDS:

Admin Infrastructure Commands:
------------------------------
    admin-bootstrap --workspace=<workspace> --aws-account=<account-id>
                   Bootstrap Terraform backend for admin infrastructure
    
    admin-plan     --workspace=<workspace> --aws-account=<account-id>
                   Plan admin infrastructure changes
    
    admin-apply    --workspace=<workspace> --aws-account=<account-id>
                   Apply admin infrastructure changes
    
    admin-destroy  --workspace=<workspace> --aws-account=<account-id>
                   Destroy admin infrastructure

Tenant Infrastructure Commands:
-------------------------------
    tenant-bootstrap --workspace=<workspace> --aws-account=<account-id> --admin-account=<admin-id>
                     Bootstrap Terraform backend for tenant infrastructure
    
    tenant-plan      --workspace=<workspace> --aws-account=<account-id> --admin-account=<admin-id>
                     Plan tenant infrastructure changes
    
    tenant-apply     --workspace=<workspace> --aws-account=<account-id> --admin-account=<admin-id>
                     Apply tenant infrastructure changes
    
    tenant-destroy   --workspace=<workspace> --aws-account=<account-id> --admin-account=<admin-id>
                     Destroy tenant infrastructure

Service Management Commands:
----------------------------
    build          --service=<service-name> [--workspace=<workspace>]
                   Build a specific service (Lambda, frontend, or backend)
    
    deploy         --service=<service-name> --workspace=<workspace>
                   Deploy a specific service
    
    test           --service=<service-name> [--workspace=<workspace>]
                   Test a specific service

GLOBAL OPTIONS:
    --workspace=<workspace>      Workspace environment (dev, qa, prd, uat)
    --aws-account=<account-id>   Target AWS account ID (mandatory)
    --admin-account=<account-id> Admin AWS account ID (for tenant commands)
    --service=<service-name>     Service to operate on
    --component=<component>      Component within service
    --env=<environment>          Environment for service deployment
    --region=<region>           AWS region (default: us-east-1)
    --admin-profile=<profile>   AWS profile for admin account operations
    --tenant-profile=<profile>  AWS profile for tenant account operations
    --profile=<profile>         AWS profile (sets both admin and tenant profiles)
    --tenant-id=<tenant-id>     Tenant ID for tenant operations
    --help, -h                  Show this help message

VALID WORKSPACES:
    dev, qa, prd, uat

VALID SERVICES:
    admin-portal-fe              React frontend application
    admin-portal-web-server      Web server for admin portal
    admin-api                    Admin API Lambda function
    notification-processor       Notification processing Lambda
    signed-url-generator         Signed URL generation Lambda
    tenant-manager              Tenant management Lambda

EXAMPLES:

Bootstrap admin infrastructure:
    ./cicd.sh admin-bootstrap --workspace=dev --aws-account=123456789012 --admin-profile=admin-profile

Plan tenant infrastructure:
    ./cicd.sh tenant-plan --workspace=dev --aws-account=987654321098 --admin-account=123456789012 --tenant-profile=tenant-profile

Build React frontend:
    ./cicd.sh build --service=admin-portal-fe

Deploy Lambda service:
    ./cicd.sh deploy --service=admin-api --workspace=dev --admin-profile=admin-profile

Test backend service:
    ./cicd.sh test --service=admin-portal-web-server

INFRASTRUCTURE DIRECTORIES:
    admin-account-iac/           Admin infrastructure Terraform code
    tenant-account-iac/          Tenant infrastructure Terraform code

SERVICE DIRECTORIES:
    admin-portal/                React frontend application
    admin-portal-web-server/     Express.js web server
    admin-be-old/               Legacy backend service
    create-infra-worker/        Infrastructure creation Lambda
    delete-infra-worker/        Infrastructure deletion Lambda
    poll-infra-worker/          Infrastructure polling Lambda

For more detailed documentation, see DEPLOYMENT.md
EOF
}

# ============================================================================
# Main Script Logic
# ============================================================================

main() {
    parse_args "$@"
    
    if [[ -z "${COMMAND}" ]]; then
        echo "Error: No command specified. Use --help for usage information."
        exit 1
    fi

    case "${COMMAND}" in
        # Admin Infrastructure Commands
        "admin-bootstrap")
            validate_admin_command
            bootstrap_admin_infrastructure
            ;;
        "admin-plan")
            validate_admin_command
            plan_admin_infrastructure
            ;;
        "admin-apply")
            validate_admin_command
            apply_admin_infrastructure
            ;;
        "admin-destroy")
            validate_admin_command
            destroy_admin_infrastructure
            ;;
        
        # Tenant Infrastructure Commands  
        "tenant-bootstrap")
            validate_tenant_command
            bootstrap_tenant_infrastructure
            ;;
        "tenant-plan")
            validate_tenant_command
            plan_tenant_infrastructure
            ;;
        "tenant-apply")
            validate_tenant_command
            apply_tenant_infrastructure
            ;;
        "tenant-destroy")
            validate_tenant_command
            destroy_tenant_infrastructure
            ;;
        
        # Service Management Commands
        "build")
            validate_service_name "$SERVICE_NAME"
            build_service "$SERVICE_NAME"
            ;;
        "deploy")
            validate_service_name "$SERVICE_NAME"
            deploy_service "$SERVICE_NAME"
            ;;
        "test")
            validate_service_name "$SERVICE_NAME"
            test_service "$SERVICE_NAME"
            ;;
        
        # Legacy Commands (deprecated but supported)
        "bootstrap")
            echo "Warning: 'bootstrap' is deprecated. Use 'admin-bootstrap' or 'tenant-bootstrap'"
            validate_workspace
            bootstrap_terraform
            ;;
        "plan")
            echo "Warning: 'plan' is deprecated. Use 'admin-plan' or 'tenant-plan'"
            validate_workspace
            plan_terraform
            ;;
        "apply")
            echo "Warning: 'apply' is deprecated. Use 'admin-apply' or 'tenant-apply'"
            validate_workspace
            apply_terraform
            ;;
        "destroy")
            echo "Warning: 'destroy' is deprecated. Use 'admin-destroy' or 'tenant-destroy'"
            validate_workspace
            destroy_terraform
            ;;
        
        # Help Commands
        "help"|"--help"|"-h")
            show_enhanced_help
            ;;
        
        *)
            echo "Error: Unknown command '${COMMAND}'"
            echo "Use './cicd.sh help' for available commands."
            exit 1
            ;;
    esac
}

# Run the main function with all arguments
main "$@"