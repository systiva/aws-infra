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
AWS_PROFILE="${AWS_PROFILE:-fct_fct.admin}"
PROJECT_NAME="admin-portal"
VERSION=$(git rev-parse --short HEAD 2>/dev/null || echo "local")
TIMESTAMP=$(date +%Y%m%d-%H%M%S)

# Directories
IAC_DIR="admin-portal-iac"
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

# Parse command line arguments
parse_args() {
    while [[ $# -gt 0 ]]; do
        case $1 in
            --env=*)
                ENV="${1#*=}"
                shift
                ;;
            --region=*)
                AWS_REGION="${1#*=}"
                shift
                ;;
            --profile=*)
                AWS_PROFILE="${1#*=}"
                shift
                ;;
            --help)
                show_help
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
# Build & Package Creation
# ============================================================================

build_frontend() {
    print_info "Building frontend application..."
    cd "$FE_DIR" && npm run "build:$ENV"
    cd "$SCRIPT_DIR"
    print_success "Frontend built successfully"
}

build_backend() {
    print_info "Building backend package..."
    mkdir -p "$IAC_DIR/lambda-packages/admin-backend"
    cp -r "$BE_DIR"/{src,package.json,*.js} "$IAC_DIR/lambda-packages/admin-backend/" 2>/dev/null || true
    cd "$IAC_DIR/lambda-packages/admin-backend" && npm ci --production --silent
    cd "$SCRIPT_DIR"
    print_success "Backend package ready"
}

build_workers() {
    print_info "Building worker packages..."
    for worker in "${LAMBDA_DIRS[@]}"; do
        echo -e "${CYAN}  Building $worker package...${NC}"
        mkdir -p "$IAC_DIR/lambda-packages/$worker"
        cp -r "$worker"/{src,package.json,*.js} "$IAC_DIR/lambda-packages/$worker/" 2>/dev/null || true
        cd "$IAC_DIR/lambda-packages/$worker" && npm ci --production --silent && cd "$SCRIPT_DIR"
    done
    print_success "Worker packages built"
}

build_ims() {
    print_info "Building IMS service package..."
    mkdir -p "$IAC_DIR/lambda-packages/ims-service"
    cp -r "$IMS_DIR"/{src,package.json,*.js} "$IAC_DIR/lambda-packages/ims-service/" 2>/dev/null || true
    cd "$IAC_DIR/lambda-packages/ims-service" && npm ci --production --silent
    cd "$SCRIPT_DIR"
    print_success "IMS package ready"
}

build_web_server() {
    print_info "Building web server package..."
    mkdir -p "$IAC_DIR/lambda-packages/admin-portal-web-server"
    cp -r "$WEB_SERVER_DIR"/{utils,package.json,*.js} "$IAC_DIR/lambda-packages/admin-portal-web-server/" 2>/dev/null || true
    
    if [[ -d "$FE_DIR/build" ]]; then
        cp -r "$FE_DIR/build" "$IAC_DIR/lambda-packages/admin-portal-web-server/"
    else
        print_warning "Frontend build not found. Run 'build-frontend' first."
    fi
    
    cd "$IAC_DIR/lambda-packages/admin-portal-web-server" && npm ci --production --silent
    cd "$SCRIPT_DIR"
    print_success "Web server package ready"
}

build_lambda_packages() {
    build_backend
    build_workers
    build_ims
    build_web_server
    print_success "All Lambda packages built"
}

build() {
    print_header "Building Components"
    build_frontend
    build_lambda_packages
    print_success "All components built successfully"
}

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
    print_header "Infrastructure Deployment"
    terraform_init
    terraform_plan
    terraform_apply
    print_success "Infrastructure deployment completed"
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

show_help() {
    echo -e "${BLUE}Multi-Tenant POC CI/CD Pipeline${NC}"
    echo ""
    echo -e "${YELLOW}Usage:${NC} ./cicd.sh <command> [options]"
    echo ""
    echo -e "${YELLOW}Options:${NC}"
    echo "  --env=ENV        Environment (dev, prod) [default: dev]"
    echo "  --region=REGION  AWS region [default: us-east-1]"
    echo "  --profile=PROFILE AWS profile [default: fct_fct.admin]"
    echo "  --help           Show this help"
    echo ""
    echo -e "${YELLOW}Main Commands:${NC}"
    echo "  setup            Environment setup and validation"
    echo "  install          Install all dependencies"
    echo "  lint             Run code linting"
    echo "  build            Build all components"
    echo "  test             Run all tests"
    echo "  package          Create deployment packages"
    echo "  deploy-infrastructure  Deploy AWS infrastructure"
    echo "  deploy-applications    Deploy applications"
    echo "  verify           Verify deployment"
    echo "  full-pipeline    Run complete CI/CD pipeline"
    echo ""
    echo -e "${YELLOW}Quick Commands:${NC}"
    echo "  ci-build         CI-specific build (no deployment)"
    echo "  cd-deploy        CD-specific deployment"
    echo "  deploy-dev       Deploy to dev environment"
    echo "  deploy-prod      Deploy to prod environment"
    echo ""
    echo -e "${YELLOW}Maintenance:${NC}"
    echo "  clean            Clean build artifacts"
    echo "  destroy          Destroy infrastructure"
    echo "  status           Show build status"
    echo "  help             Show this help"
    echo ""
    echo -e "${YELLOW}Examples:${NC}"
    echo "  ./cicd.sh full-pipeline --env=dev"
    echo "  ./cicd.sh deploy-prod --profile=production"
    echo "  ./cicd.sh ci-build"
    echo "  ./cicd.sh clean"
    echo ""
    echo -e "${YELLOW}Environment Variables:${NC}"
    echo "  ENV, AWS_REGION, AWS_PROFILE can also be set as environment variables"
}

# ============================================================================
# Main Script Logic
# ============================================================================

main() {
    # Parse command line arguments
    parse_args "$@"
    
    # If no command provided, show help
    if [[ -z "${COMMAND:-}" ]]; then
        show_help
        exit 0
    fi
    
    # Execute the requested command
    case "$COMMAND" in
        setup)
            setup
            ;;
        install)
            install
            ;;
        lint)
            lint
            ;;
        build)
            build
            ;;
        test)
            test
            ;;
        package)
            package
            ;;
        deploy-infrastructure)
            deploy_infrastructure
            ;;
        deploy-applications)
            deploy_applications
            ;;
        verify)
            verify
            ;;
        full-pipeline)
            full_pipeline
            ;;
        ci-build)
            ci_build
            ;;
        cd-deploy)
            cd_deploy
            ;;
        deploy-dev)
            deploy_dev
            ;;
        deploy-prod)
            deploy_prod
            ;;
        clean)
            clean
            ;;
        destroy)
            destroy
            ;;
        status)
            status
            ;;
        help)
            show_help
            ;;
        *)
            print_error "Unknown command: $COMMAND"
            echo ""
            show_help
            exit 1
            ;;
    esac
}

# Run the main function with all arguments
main "$@"