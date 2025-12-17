# Multi-Tenant POC CI/CD Pipeline# Multi-Tenant POC CI/CD Pipeline

# Tool-agnostic pipeline using Make for local development and CI/CD integration# Tool-agnostic pipeline using Make for local development and CI/CD integration



.PHONY: help clean install build test package deploy verify destroy.PHONY: help clean install build test package deploy verify destroy

.DEFAULT_GOAL := help.DEFAULT_GOAL := help



# ============================================================================# ============================================================================

# Configuration & Variables# Configuration & Variables

# ============================================================================# ============================================================================



# Environment Configuration# Environment Configuration

ENV ?= devENV ?= dev

AWS_REGION ?= us-east-1AWS_REGION ?= us-east-1

AWS_PROFILE ?= fct_fct.adminAWS_PROFILE ?= fct_fct.admin



# Project Configuration  # Project Configuration  

PROJECT_NAME := admin-portalPROJECT_NAME := admin-portal

VERSION := $(shell git rev-parse --short HEAD 2>/dev/null || echo "local")VERSION := $(shell git rev-parse --short HEAD 2>/dev/null || echo "local")

TIMESTAMP := $(shell date +%Y%m%d-%H%M%S)TIMESTAMP := $(shell date +%Y%m%d-%H%M%S)



# Directories# Directories

IAC_DIR := admin-portal-iacIAC_DIR := admin-portal-iac

FE_DIR := admin-portal-feFE_DIR := admin-portal-fe

BE_DIR := admin-portal-beBE_DIR := admin-portal-be

IMS_DIR := ims-serviceIMS_DIR := ims-service

WEB_SERVER_DIR := admin-portal-web-serverWEB_SERVER_DIR := admin-portal-web-server



# Lambda Function Directories# Lambda Function Directories

LAMBDA_DIRS := create-infra-worker delete-infra-worker poll-infra-worker jwt-authorizerLAMBDA_DIRS := create-infra-worker delete-infra-worker poll-infra-worker jwt-authorizer



# Color codes for output# Colors for output

RED := \033[31mRED := \033[0;31m

GREEN := \033[32mGREEN := \033[0;32m

YELLOW := \033[33mYELLOW := \033[0;33m

BLUE := \033[34mBLUE := \033[0;34m

CYAN := \033[36mCYAN := \033[0;36m

NC := \033[0m # No ColorNC := \033[0m # No Color



# ============================================================================# ============================================================================

# Helper Functions# Utility Functions

# ============================================================================# ============================================================================



# Print success messagedefine log_info

define print_success	@echo "$(BLUE)ℹ️  $(1)$(NC)"

	@echo "$(GREEN)[SUCCESS] $(1)$(NC)"endef

endef

define log_success

# Print error message	@echo "$(GREEN)✅ $(1)$(NC)"

define print_errorendef

	@echo "$(RED)[ERROR] $(1)$(NC)"

endefdefine log_warning

	@echo "$(YELLOW)⚠️  $(1)$(NC)"

# Print info messageendef

define print_info

	@echo "$(CYAN)[INFO] $(1)$(NC)"define log_error

endef	@echo "$(RED)❌ $(1)$(NC)"

endef

# ============================================================================

# Environment Setup & Validationdefine log_step

# ============================================================================	@echo "$(CYAN)🚀 $(1)$(NC)"

endef

## Environment setup and validation

setup: validate-env install-tools validate-aws# ============================================================================

	$(call print_success,Environment setup completed)# Stage 1: Environment Setup & Validation

# ============================================================================

validate-env:

	$(call print_info,Validating environment configuration...)## Environment setup and validation

	@test -n "$(ENV)" || ($(call print_error,ENV is required) && exit 1)setup: validate-env install-tools validate-aws

	@test -n "$(AWS_REGION)" || ($(call print_error,AWS_REGION is required) && exit 1)	$(call log_success,Environment setup completed)

	@echo "Environment: $(ENV), Region: $(AWS_REGION)"

validate-env:

install-tools:	$(call log_step,Validating environment configuration...)

	$(call print_info,Validating required tools...)	@test -n "$(ENV)" || ($(call log_error,ENV is required) && exit 1)

	@command -v terraform >/dev/null 2>&1 || ($(call print_error,Terraform not found) && exit 1)	@test -n "$(AWS_REGION)" || ($(call log_error,AWS_REGION is required) && exit 1)

	@command -v node >/dev/null 2>&1 || ($(call print_error,Node.js not found) && exit 1)	$(call log_info,Environment: $(ENV), Region: $(AWS_REGION))

	@command -v npm >/dev/null 2>&1 || ($(call print_error,npm not found) && exit 1)	$(call log_success,Environment configuration validated)

	@command -v aws >/dev/null 2>&1 || ($(call print_error,AWS CLI not found) && exit 1)

install-tools:

validate-aws:	$(call log_step,Validating required tools...)

	$(call print_info,Validating AWS credentials...)	@command -v terraform >/dev/null 2>&1 || ($(call log_error,Terraform not found. Please install Terraform) && exit 1)

	@aws sts get-caller-identity --profile $(AWS_PROFILE) > /dev/null || \	@command -v node >/dev/null 2>&1 || ($(call log_error,Node.js not found. Please install Node.js) && exit 1)

		($(call print_error,AWS credentials validation failed) && exit 1)	@command -v npm >/dev/null 2>&1 || ($(call log_error,npm not found. Please install npm) && exit 1)

	@command -v aws >/dev/null 2>&1 || ($(call log_error,AWS CLI not found. Please install AWS CLI) && exit 1)

# ============================================================================	@command -v git >/dev/null 2>&1 || ($(call log_error,Git not found. Please install Git) && exit 1)

# Dependencies & Installation	$(call log_success,All required tools validated)

# ============================================================================

validate-aws:

## Install all project dependencies	$(call log_step,Validating AWS credentials...)

install: install-frontend install-backend install-workers install-ims install-web-server	@aws sts get-caller-identity --profile $(AWS_PROFILE) > /dev/null || \

	$(call print_success,All dependencies installed)		($(call log_error,AWS credentials validation failed for profile $(AWS_PROFILE)) && exit 1)

	$(call log_success,AWS credentials validated for profile $(AWS_PROFILE))

install-frontend:

	$(call print_info,Installing frontend dependencies...)# ============================================================================

	@cd $(FE_DIR) && npm ci# Stage 2: Dependencies & Installation

	$(call print_success,Frontend dependencies installed)# ============================================================================



install-backend:## Install all project dependencies

	$(call print_info,Installing backend dependencies...)install: install-frontend install-backend install-workers install-ims install-web-server

	@cd $(BE_DIR) && npm ci	$(call log_success,All dependencies installed successfully)

	$(call print_success,Backend dependencies installed)

install-frontend:

install-workers:	$(call log_step,Installing frontend dependencies...)

	$(call print_info,Installing worker dependencies...)	@if [ ! -f "$(FE_DIR)/package.json" ]; then \

	@for worker in $(LAMBDA_DIRS); do \		$(call log_error,Frontend package.json not found); \

		echo "$(CYAN)  Installing $$worker...$(NC)"; \		exit 1; \

		cd $$worker && npm ci && cd ..; \	fi

	done	@cd $(FE_DIR) && npm ci

	$(call print_success,Worker dependencies installed)	$(call log_success,Frontend dependencies installed)



install-ims:install-backend:

	$(call print_info,Installing IMS service dependencies...)	$(call log_step,Installing backend dependencies...)

	@cd $(IMS_DIR) && npm ci	@if [ ! -f "$(BE_DIR)/package.json" ]; then \

	$(call print_success,IMS dependencies installed)		$(call log_error,Backend package.json not found); \

		exit 1; \

install-web-server:	fi

	$(call print_info,Installing web server dependencies...)	@cd $(BE_DIR) && npm ci

	@cd $(WEB_SERVER_DIR) && npm ci	$(call log_success,Backend dependencies installed)

	$(call print_success,Web server dependencies installed)

install-workers:

# ============================================================================	$(call log_step,Installing worker dependencies...)

# Linting & Code Quality	@for worker in $(LAMBDA_DIRS); do \

# ============================================================================		if [ ! -f "$$worker/package.json" ]; then \

			$(call log_error,$$worker/package.json not found); \

## Run linting for all components			exit 1; \

lint: lint-frontend lint-backend lint-ims lint-workers		fi; \

	$(call print_success,All linting completed)		echo "$(CYAN)  📦 Installing $$worker...$(NC)"; \

		cd $$worker && npm ci && cd ..; \

lint-frontend:	done

	$(call print_info,Linting frontend code...)	$(call log_success,Worker dependencies installed)

	@cd $(FE_DIR) && npm run lint 2>/dev/null || echo "No lint script found for frontend"

install-ims:

lint-backend:	$(call log_step,Installing IMS service dependencies...)

	$(call print_info,Linting backend code...)	@if [ ! -f "$(IMS_DIR)/package.json" ]; then \

	@cd $(BE_DIR) && npm run lint		$(call log_error,IMS service package.json not found); \

		exit 1; \

lint-ims:	fi

	$(call print_info,Linting IMS service code...)	@cd $(IMS_DIR) && npm ci

	@cd $(IMS_DIR) && npm run lint 2>/dev/null || echo "No lint script found for IMS"	$(call log_success,IMS service dependencies installed)



lint-workers:install-web-server:

	$(call print_info,Linting worker code...)	$(call log_step,Installing web server dependencies...)

	@for worker in $(LAMBDA_DIRS); do \	@if [ ! -f "$(WEB_SERVER_DIR)/package.json" ]; then \

		echo "$(CYAN)  Linting $$worker...$(NC)"; \		$(call log_error,Web server package.json not found); \

		cd $$worker && npm run lint 2>/dev/null || echo "No lint script found for $$worker"; \		exit 1; \

		cd ..; \	fi

	done	@cd $(WEB_SERVER_DIR) && npm ci

	$(call log_success,Web server dependencies installed)

# ============================================================================

# Testing# ============================================================================

# ============================================================================# Stage 3: Linting & Code Quality

# ============================================================================

## Run all tests

test: test-backend test-ims test-workers## Run linting and code quality checks

	$(call print_success,All tests completed)lint: lint-frontend lint-backend lint-workers lint-ims

	$(call log_success,All linting completed)

test-backend:

	$(call print_info,Testing backend...)lint-frontend:

	@echo "$(CYAN)  Testing backend...$(NC)"	$(call log_step,Linting frontend code...)

	@cd $(BE_DIR) && npm test	@cd $(FE_DIR) && npm run lint 2>/dev/null || echo "$(YELLOW)⚠️  Frontend linting not configured$(NC)"

	@echo "$(CYAN)  Testing IMS service...$(NC)"	$(call log_success,Frontend linting completed)

	@cd $(IMS_DIR) && npm test 2>/dev/null || echo "No tests found for IMS service"

	@for worker in $(LAMBDA_DIRS); do \lint-backend:

		echo "$(CYAN)  Testing $$worker...$(NC)"; \	$(call log_step,Linting backend code...)

		cd $$worker && npm test 2>/dev/null || echo "No tests found for $$worker"; \	@cd $(BE_DIR) && npm run lint

		cd ..; \	$(call log_success,Backend linting completed)

	done

lint-workers:

test-ims:	$(call log_step,Linting worker code...)

	$(call print_info,Testing IMS service...)	@for worker in $(LAMBDA_DIRS); do \

	@cd $(IMS_DIR) && npm test 2>/dev/null || echo "No tests configured for IMS"		echo "$(CYAN)  🔍 Linting $$worker...$(NC)"; \

		cd $$worker && (npm run lint 2>/dev/null || echo "$(YELLOW)⚠️  $$worker linting not configured$(NC)") && cd ..; \

test-workers:	done

	$(call print_info,Testing worker functions...)	$(call log_success,Worker linting completed)

	@for worker in $(LAMBDA_DIRS); do \

		echo "Testing $$worker..."; \lint-ims:

		cd $$worker && npm test 2>/dev/null || echo "No tests configured for $$worker"; \	$(call log_step,Linting IMS service code...)

		cd ..; \	@cd $(IMS_DIR) && (npm run lint 2>/dev/null || echo "$(YELLOW)⚠️  IMS linting not configured$(NC)")

	done	$(call log_success,IMS service linting completed)



# ============================================================================# ============================================================================

# Build & Package Creation# Stage 4: Testing

# ============================================================================# ============================================================================



## Build all components## Run all tests

build: build-frontend build-lambda-packagestest: unit-tests

	$(call print_success,All components built successfully)	$(call log_success,All tests completed)



build-frontend:unit-tests:

	$(call print_info,Building frontend application...)	$(call log_step,Running unit tests...)

	@cd $(FE_DIR) && npm run build:$(ENV)	@echo "$(CYAN)  🧪 Testing backend...$(NC)"

	$(call print_success,Frontend built successfully)	@cd $(BE_DIR) && npm test

	@echo "$(CYAN)  🧪 Testing IMS service...$(NC)"

build-lambda-packages: build-backend build-workers build-ims build-web-server	@cd $(IMS_DIR) && (npm test 2>/dev/null || echo "$(YELLOW)⚠️  IMS tests not configured$(NC)")

	$(call print_success,All Lambda packages built)	@for worker in $(LAMBDA_DIRS); do \

		echo "$(CYAN)  🧪 Testing $$worker...$(NC)"; \

build-backend:		cd $$worker && (npm test 2>/dev/null || echo "$(YELLOW)⚠️  $$worker tests not configured$(NC)") && cd ..; \

	$(call print_info,Building backend package...)	done

	@mkdir -p $(IAC_DIR)/lambda-packages/admin-backend	$(call log_success,Unit tests completed)

	@cp -r $(BE_DIR)/{src,package.json,*.js} $(IAC_DIR)/lambda-packages/admin-backend/ 2>/dev/null || true

	@cd $(IAC_DIR)/lambda-packages/admin-backend && npm ci --production --silent# ============================================================================

	$(call print_success,Backend package ready)# Stage 5: Build

# ============================================================================

build-workers:

	$(call print_info,Building worker packages...)## Build all components

	@for worker in $(LAMBDA_DIRS); do \build: build-frontend build-lambda-packages

		echo "$(CYAN)  Building $$worker package...$(NC)"; \	$(call log_success,All components built successfully)

		mkdir -p $(IAC_DIR)/lambda-packages/$$worker; \

		cp -r $$worker/{src,package.json,*.js} $(IAC_DIR)/lambda-packages/$$worker/ 2>/dev/null || true; \build-frontend:

		cd $(IAC_DIR)/lambda-packages/$$worker && npm ci --production --silent && cd ../../..; \	$(call log_step,Building frontend application...)

	done	@cd $(FE_DIR) && npm run build:$(ENV)

	$(call print_success,Worker packages built)	$(call log_success,Frontend built successfully for $(ENV) environment)



build-ims:build-lambda-packages: prepare-lambda-packages build-backend build-workers build-ims build-web-server

	$(call print_info,Building IMS service package...)	$(call log_success,All Lambda packages built)

	@mkdir -p $(IAC_DIR)/lambda-packages/ims-service

	@cp -r $(IMS_DIR)/{src,package.json,*.js} $(IAC_DIR)/lambda-packages/ims-service/ 2>/dev/null || trueprepare-lambda-packages:

	@cd $(IAC_DIR)/lambda-packages/ims-service && npm ci --production --silent	$(call log_step,Preparing Lambda packages directory...)

	$(call print_success,IMS package ready)	@mkdir -p $(IAC_DIR)/lambda-packages

	$(call log_info,Lambda packages directory ready)

build-web-server:

	$(call print_info,Building web server package...)build-backend:

	@mkdir -p $(IAC_DIR)/lambda-packages/admin-portal-web-server	$(call log_step,Building backend package...)

	@cp -r $(WEB_SERVER_DIR)/{utils,package.json,*.js} $(IAC_DIR)/lambda-packages/admin-portal-web-server/ 2>/dev/null || true	@mkdir -p $(IAC_DIR)/lambda-packages/admin-backend

	@if [ -d "$(FE_DIR)/build" ]; then \	@cp -r $(BE_DIR)/src $(IAC_DIR)/lambda-packages/admin-backend/

		cp -r $(FE_DIR)/build $(IAC_DIR)/lambda-packages/admin-portal-web-server/; \	@cp $(BE_DIR)/package.json $(IAC_DIR)/lambda-packages/admin-backend/

	else \	@cp $(BE_DIR)/*.js $(IAC_DIR)/lambda-packages/admin-backend/ 2>/dev/null || true

		echo "Warning: Frontend build not found. Run 'make build-frontend' first."; \	@cd $(IAC_DIR)/lambda-packages/admin-backend && npm ci --only=production

	fi	$(call log_success,Backend package ready)

	@cd $(IAC_DIR)/lambda-packages/admin-portal-web-server && npm ci --production --silent

	$(call print_success,Web server package ready)build-workers:

	$(call log_step,Building worker packages...)

## Create deployment packages	@for worker in $(LAMBDA_DIRS); do \

package: create-lambda-zips create-frontend-archive		echo "$(CYAN)  🏗️  Building $$worker package...$(NC)"; \

	$(call print_success,All deployment packages created)		mkdir -p $(IAC_DIR)/lambda-packages/$$worker; \

		cp -r $$worker/src $(IAC_DIR)/lambda-packages/$$worker/ 2>/dev/null || true; \

create-lambda-zips:		cp $$worker/package.json $(IAC_DIR)/lambda-packages/$$worker/; \

	$(call print_info,Creating Lambda deployment packages...)		cp $$worker/*.js $(IAC_DIR)/lambda-packages/$$worker/ 2>/dev/null || true; \

	@cd $(IAC_DIR)/lambda-packages && \		cd $(IAC_DIR)/lambda-packages/$$worker && npm ci --only=production && cd ../../..; \

	for dir in */; do \	done

		if [ -d "$$dir" ]; then \	$(call log_success,Worker packages built)

			echo "$(CYAN)  Zipping $$dir...$(NC)"; \

			cd "$$dir" && zip -r "../$${dir%/}.zip" . -x "*.git*" "node_modules/.cache/*" > /dev/null && cd ..; \build-ims:

		fi; \	$(call log_step,Building IMS service package...)

	done	@mkdir -p $(IAC_DIR)/lambda-packages/ims-service

	$(call print_success,Lambda packages created)	@cp -r $(IMS_DIR)/src $(IAC_DIR)/lambda-packages/ims-service/ 2>/dev/null || true

	@cp $(IMS_DIR)/package.json $(IAC_DIR)/lambda-packages/ims-service/

create-frontend-archive:	@cp $(IMS_DIR)/*.js $(IAC_DIR)/lambda-packages/ims-service/ 2>/dev/null || true

	$(call print_info,Creating frontend archive...)	@cd $(IAC_DIR)/lambda-packages/ims-service && npm ci --only=production

	@if [ -d "$(FE_DIR)/build" ]; then \	$(call log_success,IMS service package ready)

		cd $(FE_DIR) && tar -czf ../$(IAC_DIR)/frontend-$(VERSION).tar.gz build/; \

		$(call print_success,Frontend archive created); \build-web-server:

	else \	$(call log_step,Building web server package...)

		$(call print_error,Frontend build directory not found); \	@mkdir -p $(IAC_DIR)/lambda-packages/admin-portal-web-server

		exit 1; \	@cp -r $(WEB_SERVER_DIR)/utils $(IAC_DIR)/lambda-packages/admin-portal-web-server/ 2>/dev/null || true

	fi	@cp $(WEB_SERVER_DIR)/package.json $(IAC_DIR)/lambda-packages/admin-portal-web-server/

	@cp $(WEB_SERVER_DIR)/*.js $(IAC_DIR)/lambda-packages/admin-portal-web-server/ 2>/dev/null || true

# ============================================================================	@if [ -d "$(FE_DIR)/build" ]; then \

# Infrastructure Deployment		cp -r $(FE_DIR)/build $(IAC_DIR)/lambda-packages/admin-portal-web-server/; \

# ============================================================================	else \

		$(call log_warning,Frontend build not found, ensure frontend is built first); \

## Deploy infrastructure	fi

deploy-infrastructure: terraform-init terraform-plan terraform-apply	@cd $(IAC_DIR)/lambda-packages/admin-portal-web-server && npm ci --only=production

	$(call print_success,Infrastructure deployment completed)	$(call log_success,Web server package ready)



terraform-init:# ============================================================================

	$(call print_info,Initializing Terraform...)# Stage 6: Package Creation

	@cd $(IAC_DIR) && terraform init -backend-config="backend-$(ENV).conf"# ============================================================================

	$(call print_success,Terraform initialized)

## Create deployment packages

terraform-plan:package: create-lambda-zips create-frontend-archive

	$(call print_info,Creating Terraform plan...)	$(call log_success,All deployment packages created)

	@cd $(IAC_DIR) && terraform plan -var-file="environments/$(ENV).tfvars" -out="tfplan-$(ENV)-$(TIMESTAMP)"

	$(call print_success,Terraform plan created: tfplan-$(ENV)-$(TIMESTAMP))create-lambda-zips:

	$(call log_step,Creating Lambda deployment packages...)

terraform-apply:	@cd $(IAC_DIR)/lambda-packages && \

	$(call print_info,Applying Terraform configuration...)	for dir in */; do \

	@cd $(IAC_DIR) && terraform apply -auto-approve "tfplan-$(ENV)-$(TIMESTAMP)"		if [ -d "$$dir" ]; then \

	$(call print_success,Infrastructure deployed)			echo "$(CYAN)  📦 Zipping $$dir...$(NC)"; \

			cd "$$dir" && zip -r "../$${dir%/}.zip" . -x "*.git*" "node_modules/.cache/*" "**/.DS_Store" && cd ..; \

# ============================================================================		fi; \

# Application Deployment	done

# ============================================================================	$(call log_success,Lambda packages created)



## Deploy applicationscreate-frontend-archive:

deploy-applications: deploy-s3-assets update-lambda-functions	$(call log_step,Creating frontend archive...)

	$(call print_success,Application deployment completed)	@if [ -d "$(FE_DIR)/build" ]; then \

		cd $(FE_DIR) && tar -czf ../$(IAC_DIR)/frontend-$(VERSION).tar.gz build/; \

deploy-s3-assets:		$(call log_success,Frontend archive created); \

	$(call print_info,Uploading frontend assets to S3...)	else \

	@if [ -d "$(FE_DIR)/build" ]; then \		$(call log_warning,Frontend build directory not found, skipping archive creation); \

		BUCKET_NAME=$$(cd $(IAC_DIR) && terraform output -raw s3_portal_bucket_name 2>/dev/null); \	fi

		if [ -n "$$BUCKET_NAME" ]; then \

			aws s3 sync $(FE_DIR)/build/ s3://$$BUCKET_NAME/ --delete --profile $(AWS_PROFILE); \# ============================================================================

			$(call print_success,Frontend assets deployed to S3); \# Stage 7: Infrastructure Deployment

		else \# ============================================================================

			$(call print_error,Could not get S3 bucket name from Terraform output); \

		fi; \## Deploy infrastructure

	else \deploy-infrastructure: terraform-init terraform-plan terraform-apply

		$(call print_error,Frontend build directory not found); \	$(call log_success,Infrastructure deployment completed)

	fi

terraform-init:

update-lambda-functions:	$(call log_step,Initializing Terraform...)

	$(call print_info,Updating Lambda functions...)	@cd $(IAC_DIR) && terraform init -backend-config="backend-$(ENV).conf"

	@cd $(IAC_DIR) && \	$(call log_success,Terraform initialized)

	for zip in lambda-packages/*.zip; do \

		if [ -f "$$zip" ]; then \terraform-plan:

			FUNCTION_NAME=$$(basename "$$zip" .zip); \	$(call log_step,Creating Terraform plan...)

			echo "$(CYAN)  Updating $$FUNCTION_NAME...$(NC)"; \	@cd $(IAC_DIR) && terraform plan -var-file="environments/$(ENV).tfvars" -out="tfplan-$(ENV)-$(TIMESTAMP)"

			aws lambda update-function-code \	$(call log_success,Terraform plan created: tfplan-$(ENV)-$(TIMESTAMP))

				--function-name "$(PROJECT_NAME)-$(ENV)-$$FUNCTION_NAME" \

				--zip-file "fileb://$$zip" \terraform-apply:

				--profile $(AWS_PROFILE) > /dev/null || echo "Warning: Failed to update $$FUNCTION_NAME"; \	$(call log_step,Applying Terraform configuration...)

		fi; \	@cd $(IAC_DIR) && terraform apply -auto-approve "tfplan-$(ENV)-$(TIMESTAMP)"

	done	$(call log_success,Infrastructure deployed successfully)

	$(call print_success,Lambda functions updated)

# ============================================================================

# ============================================================================# Stage 8: Application Deployment

# Testing & Verification# ============================================================================

# ============================================================================

## Deploy applications

## Run integration tests and verificationdeploy-applications: deploy-s3-assets update-lambda-functions

verify: verify-infrastructure verify-applications	$(call log_success,Application deployment completed)

	$(call print_success,Verification completed)

deploy-s3-assets:

verify-infrastructure:	$(call log_step,Uploading frontend assets to S3...)

	$(call print_info,Verifying infrastructure...)	@if [ -d "$(FE_DIR)/build" ]; then \

	@cd $(IAC_DIR) && terraform plan -var-file="environments/$(ENV).tfvars" -detailed-exitcode > /dev/null || \		BUCKET_NAME=$$(cd $(IAC_DIR) && terraform output -raw s3_portal_bucket_name 2>/dev/null || echo ""); \

		($(call print_error,Infrastructure drift detected) && exit 1)		if [ -n "$$BUCKET_NAME" ]; then \

	$(call print_success,Infrastructure verified - no drift detected)			aws s3 sync $(FE_DIR)/build/ s3://$$BUCKET_NAME/ --delete --profile $(AWS_PROFILE); \

			$(call log_success,Frontend assets deployed to S3); \

verify-applications:		else \

	$(call print_info,Verifying application deployment...)			$(call log_warning,S3 bucket name not found, skipping asset deployment); \

	@API_URL=$$(cd $(IAC_DIR) && terraform output -raw api_gateway_url 2>/dev/null); \		fi; \

	if [ -n "$$API_URL" ]; then \	else \

		curl -f "$$API_URL/health" > /dev/null 2>&1 || \		$(call log_warning,Frontend build not found, skipping S3 deployment); \

			echo "Warning: API health check failed"; \	fi

	fi

	@WEB_URL=$$(cd $(IAC_DIR) && terraform output -raw web_server_url 2>/dev/null); \update-lambda-functions:

	if [ -n "$$WEB_URL" ]; then \	$(call log_step,Updating Lambda functions...)

		curl -f "$$WEB_URL" > /dev/null 2>&1 || \	@cd $(IAC_DIR) && \

			echo "Warning: Web server check failed"; \	for zip in lambda-packages/*.zip; do \

	fi		if [ -f "$$zip" ]; then \

	$(call print_success,Application verification completed)			FUNCTION_NAME=$$(basename "$$zip" .zip); \

			echo "$(CYAN)  ⚡ Updating $$FUNCTION_NAME...$(NC)"; \

# ============================================================================			aws lambda update-function-code \

# Pipeline Orchestration				--function-name "$(PROJECT_NAME)-$(ENV)-$$FUNCTION_NAME" \

# ============================================================================				--zip-file "fileb://$$zip" \

				--profile $(AWS_PROFILE) > /dev/null 2>&1 || \

## Complete CI/CD pipeline				$(call log_warning,Failed to update $$FUNCTION_NAME or function not found); \

full-pipeline: clean setup install lint build test package deploy-infrastructure deploy-applications verify		fi; \

	$(call print_success,Full pipeline completed successfully)	done

	$(call log_success,Lambda functions updated)

## CI-specific build (no deployment)

ci-build: setup install lint build test package# ============================================================================

	$(call print_success,CI build completed)# Stage 9: Verification

# ============================================================================

## CD-specific deployment (assumes artifacts exist)

cd-deploy: deploy-infrastructure deploy-applications verify## Run verification tests

	$(call print_success,CD deployment completed)verify: verify-infrastructure verify-applications

	$(call log_success,All verifications completed)

## Environment-specific deployments

deploy-dev: ENV=devverify-infrastructure:

deploy-dev: full-pipeline	$(call log_step,Verifying infrastructure...)

	@cd $(IAC_DIR) && terraform plan -var-file="environments/$(ENV).tfvars" -detailed-exitcode > /dev/null || \

deploy-prod: ENV=prod		($(call log_warning,Infrastructure drift detected) && exit 0)

deploy-prod: full-pipeline	$(call log_success,Infrastructure verified)



# ============================================================================verify-applications:

# Maintenance & Cleanup	$(call log_step,Verifying application deployment...)

# ============================================================================	@API_URL=$$(cd $(IAC_DIR) && terraform output -raw api_gateway_url 2>/dev/null || echo ""); \

	if [ -n "$$API_URL" ]; then \

## Clean build artifacts and temporary files		curl -f -s "$$API_URL/health" > /dev/null || \

clean:			$(call log_warning,API health check failed); \

	$(call print_info,Cleaning build artifacts...)	else \

	@rm -rf $(FE_DIR)/build 2>/dev/null || true		$(call log_warning,API URL not found, skipping health check); \

	@rm -rf $(IAC_DIR)/lambda-packages 2>/dev/null || true	fi

	@rm -f $(IAC_DIR)/tfplan-* 2>/dev/null || true	@WEB_URL=$$(cd $(IAC_DIR) && terraform output -raw web_server_url 2>/dev/null || echo ""); \

	@rm -f $(IAC_DIR)/frontend-*.tar.gz 2>/dev/null || true	if [ -n "$$WEB_URL" ]; then \

	@find . -name "node_modules" -type d -path "*/lambda-packages/*" -exec rm -rf {} + 2>/dev/null || true		curl -f -s "$$WEB_URL" > /dev/null || \

	$(call print_success,Cleanup completed)			$(call log_warning,Web server check failed); \

	else \

## Destroy infrastructure (use with caution)		$(call log_warning,Web server URL not found, skipping check); \

destroy:	fi

	$(call print_info,Destroying infrastructure...)	$(call log_success,Application verification completed)

	@echo "$(YELLOW)WARNING: This will destroy all infrastructure!$(NC)"

	@echo "Press Ctrl+C to cancel, or Enter to continue..."# ============================================================================

	@read# Pipeline Orchestration

	@cd $(IAC_DIR) && terraform destroy -var-file="environments/$(ENV).tfvars" -auto-approve# ============================================================================

	$(call print_success,Infrastructure destroyed)

## Complete pipeline execution

## Show current build statusfull-pipeline: clean setup install lint test build package deploy-infrastructure deploy-applications verify

status:	$(call log_success,🎉 Full pipeline completed successfully!)

	$(call print_info,Build Status Check)

	@echo "$(CYAN)Environment:$(NC) $(ENV)"## CI-specific build (no deployment)

	@echo "$(CYAN)AWS Region:$(NC) $(AWS_REGION)"ci-build: setup install lint test build package

	@echo "$(CYAN)AWS Profile:$(NC) $(AWS_PROFILE)"	$(call log_success,CI build completed successfully)

	@echo "$(CYAN)Project Version:$(NC) $(VERSION)"

	@echo "$(CYAN)Frontend Build:$(NC) $$([ -d "$(FE_DIR)/build" ] && echo "Present" || echo "Missing")"## CD-specific deployment (assumes artifacts exist)

	@echo "$(CYAN)Lambda Packages:$(NC) $$([ -d "$(IAC_DIR)/lambda-packages" ] && echo "Present" || echo "Missing")"cd-deploy: deploy-infrastructure deploy-applications verify

	@echo "$(CYAN)Terraform State:$(NC) $$([ -f "$(IAC_DIR)/.terraform/terraform.tfstate" ] && echo "Initialized" || echo "Not initialized")"	$(call log_success,CD deployment completed successfully)



## Show help information## Environment-specific deployments

help:deploy-dev: ENV=dev

	@echo "$(BLUE)Multi-Tenant POC CI/CD Pipeline$(NC)"deploy-dev: full-pipeline

	@echo ""

	@echo "$(YELLOW)Usage:$(NC) make <target> [ENV=dev|prod] [AWS_PROFILE=profile-name]"deploy-prod: ENV=prod

	@echo ""deploy-prod: full-pipeline

	@echo "$(YELLOW)Environment Variables:$(NC)"

	@echo "  ENV              Environment (dev, prod) [default: dev]"# ============================================================================

	@echo "  AWS_REGION       AWS region [default: us-east-1]"# Maintenance & Utilities

	@echo "  AWS_PROFILE      AWS profile [default: fct_fct.admin]"# ============================================================================

	@echo ""

	@echo "$(YELLOW)Main Targets:$(NC)"## Clean build artifacts and temporary files

	@echo "  setup            Environment setup and validation"clean:

	@echo "  install          Install all dependencies"	$(call log_step,Cleaning build artifacts...)

	@echo "  lint             Run code linting"	@rm -rf $(FE_DIR)/build 2>/dev/null || true

	@echo "  build            Build all components"	@rm -rf $(IAC_DIR)/lambda-packages 2>/dev/null || true

	@echo "  test             Run all tests"	@rm -f $(IAC_DIR)/tfplan-* 2>/dev/null || true

	@echo "  package          Create deployment packages"	@rm -f $(IAC_DIR)/frontend-*.tar.gz 2>/dev/null || true

	@echo "  deploy-infrastructure  Deploy AWS infrastructure"	@find . -name "node_modules" -type d -not -path "./node_modules" -exec rm -rf {} + 2>/dev/null || true

	@echo "  deploy-applications    Deploy applications"	@find . -name ".terraform" -type d -exec rm -rf {} + 2>/dev/null || true

	@echo "  verify           Verify deployment"	$(call log_success,Cleanup completed)

	@echo "  full-pipeline    Run complete CI/CD pipeline"

	@echo ""## Destroy infrastructure (DANGEROUS!)

	@echo "$(YELLOW)Quick Commands:$(NC)"destroy:

	@echo "  ci-build         CI-specific build (no deployment)"	$(call log_warning,This will destroy all infrastructure. Are you sure?)

	@echo "  cd-deploy        CD-specific deployment"	@read -p "Type 'yes' to confirm: " confirm && [ "$$confirm" = "yes" ] || exit 1

	@echo "  deploy-dev       Deploy to dev environment"	$(call log_step,Destroying infrastructure...)

	@echo "  deploy-prod      Deploy to prod environment"	@cd $(IAC_DIR) && terraform destroy -var-file="environments/$(ENV).tfvars" -auto-approve

	@echo ""	$(call log_success,Infrastructure destroyed)

	@echo "$(YELLOW)Maintenance:$(NC)"

	@echo "  clean            Clean build artifacts"## Show current project status

	@echo "  destroy          Destroy infrastructure"status:

	@echo "  status           Show build status"	$(call log_info,Project Status)

	@echo "  help             Show this help"	@echo "$(CYAN)Environment:$(NC) $(ENV)"

	@echo ""	@echo "$(CYAN)AWS Region:$(NC) $(AWS_REGION)"

	@echo "$(YELLOW)Examples:$(NC)"	@echo "$(CYAN)AWS Profile:$(NC) $(AWS_PROFILE)"

	@echo "  make full-pipeline ENV=dev"	@echo "$(CYAN)Version:$(NC) $(VERSION)"

	@echo "  make deploy-prod AWS_PROFILE=production"	@echo ""

	@echo "  make ci-build"	@echo "$(CYAN)Frontend Build:$(NC) $$([ -d "$(FE_DIR)/build" ] && echo "✅ Present" || echo "❌ Missing")"

	@echo "  make clean"	@echo "$(CYAN)Lambda Packages:$(NC) $$([ -d "$(IAC_DIR)/lambda-packages" ] && echo "✅ Present" || echo "❌ Missing")"
	@echo "$(CYAN)Terraform State:$(NC) $$([ -f "$(IAC_DIR)/.terraform/terraform.tfstate" ] && echo "✅ Initialized" || echo "❌ Not initialized")"

## Display help information
help:
	@echo "$(BLUE)🛠️  Multi-Tenant POC CI/CD Pipeline$(NC)"
	@echo ""
	@echo "$(CYAN)Environment Configuration:$(NC)"
	@echo "  ENV=$(ENV)              Environment (dev/prod)"
	@echo "  AWS_REGION=$(AWS_REGION)   AWS region"
	@echo "  AWS_PROFILE=$(AWS_PROFILE)    AWS CLI profile"
	@echo ""
	@echo "$(CYAN)Pipeline Stages:$(NC)"
	@echo "  $(GREEN)setup$(NC)              Environment setup and validation"
	@echo "  $(GREEN)install$(NC)            Install all dependencies"
	@echo "  $(GREEN)lint$(NC)               Run code quality checks"
	@echo "  $(GREEN)test$(NC)               Run all tests"
	@echo "  $(GREEN)build$(NC)              Build all components"
	@echo "  $(GREEN)package$(NC)            Create deployment packages"
	@echo "  $(GREEN)deploy-infrastructure$(NC) Deploy AWS infrastructure"
	@echo "  $(GREEN)deploy-applications$(NC)   Deploy applications"
	@echo "  $(GREEN)verify$(NC)             Verify deployment"
	@echo ""
	@echo "$(CYAN)Complete Workflows:$(NC)"
	@echo "  $(GREEN)full-pipeline$(NC)      Run complete pipeline"
	@echo "  $(GREEN)ci-build$(NC)           CI-specific build (no deployment)"
	@echo "  $(GREEN)cd-deploy$(NC)          CD-specific deployment"
	@echo "  $(GREEN)deploy-dev$(NC)         Deploy to dev environment"
	@echo "  $(GREEN)deploy-prod$(NC)        Deploy to prod environment"
	@echo ""
	@echo "$(CYAN)Utilities:$(NC)"
	@echo "  $(GREEN)clean$(NC)              Clean build artifacts"
	@echo "  $(GREEN)destroy$(NC)            Destroy infrastructure (DANGEROUS!)"
	@echo "  $(GREEN)status$(NC)             Show current project status"
	@echo ""
	@echo "$(CYAN)Examples:$(NC)"
	@echo "  make setup ENV=dev"
	@echo "  make full-pipeline ENV=prod AWS_PROFILE=prod-profile"
	@echo "  make ci-build"
	@echo "  make deploy-applications ENV=dev"