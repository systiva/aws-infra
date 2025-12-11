# Admin Portal Infrastructure - Private Architecture with Lambda Web Server
terraform {
  required_version = ">= 1.5"
  
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
    random = {
      source  = "hashicorp/random"
      version = "~> 3.4"
    }
    archive = {
      source  = "hashicorp/archive"
      version = "~> 2.4"
    }
  }

  # Backend configuration for remote state
  backend "s3" {
    # Configuration will be provided via backend config file
  }
}

# Configure AWS Provider - No default tags due to SCP restrictions
provider "aws" {
  region = var.aws_region
  
  # Only use profile for local development
  # GitHub Actions and CI/CD use environment variables
  profile = var.aws_profile != "default" ? var.aws_profile : null
}

# Random suffix for unique resource names
resource "random_id" "suffix" {
  byte_length = 4
}

# Generate random JWT signing key for enhanced tokens
resource "random_password" "jwt_signing_key" {
  count   = var.enable_ims_service && var.enable_cognito ? 1 : 0
  length  = 64
  special = true
}

# Data sources
data "aws_caller_identity" "current" {}
data "aws_region" "current" {}

# Retrieve Step Functions ARN from SSM (created by admin bootstrap)
data "aws_ssm_parameter" "step_functions_arn" {
  name = "/admin-portal/${var.workspace_prefix}/admin/bootstrap/step-functions-arn"
}

# Retrieve Tenant Registry Table Name from SSM (created by admin bootstrap)
data "aws_ssm_parameter" "tenant_registry_table_name" {
  name = "/admin-portal/${var.workspace_prefix}/admin/bootstrap/tenant-registry-table"
}

# Local values for resource naming and configuration
locals {
  # Account comparison logic
  admin_account_id  = var.admin_account_id
  tenant_account_id = var.tenant_account_id
  is_same_account   = local.admin_account_id == local.tenant_account_id
  
  account_id = data.aws_caller_identity.current.account_id
  region     = data.aws_region.current.name
  
  # Workspace-based naming (consistent with bootstrap module)
  workspace_prefix = var.workspace_prefix
  name_prefix = "${var.project_name}-${local.workspace_prefix}"
  
  # DynamoDB table naming - uses naming convention instead of SSM parameter
  # SSM parameter is stored in tenant account (cross-account access not supported)
  # Convention: {project_name}-{workspace_prefix}-tenant-public
  tenant_public_table_name = "${var.project_name}-${local.workspace_prefix}-tenant-public"
  
  # Step Functions ARN - retrieved from admin bootstrap SSM
  step_functions_arn = data.aws_ssm_parameter.step_functions_arn.value
  
  # Tenant Registry Table - retrieved from admin bootstrap SSM
  tenant_registry_table_name = data.aws_ssm_parameter.tenant_registry_table_name.value
  
  # S3 bucket names (must be globally unique)
  admin_portal_bucket_name = var.s3_admin_portal_bucket_name != "" ? var.s3_admin_portal_bucket_name : "${local.name_prefix}-portal-${random_id.suffix.hex}"
  
  # Enhanced tagging with workspace information
  common_tags = merge(var.common_tags, {
    Workspace         = terraform.workspace
    WorkspacePrefix   = local.workspace_prefix
    Environment       = local.workspace_prefix
    Project           = var.project_name
    Region            = var.aws_region
    AdminAccount      = local.admin_account_id
    TenantAccount     = local.tenant_account_id
    SameAccount       = local.is_same_account
    AccountId         = local.account_id
    TerraformPath     = basename(abspath(path.root))
    ComponentType     = "admin-infrastructure"
    ManagedBy         = "terraform"
  })
}



# Networking infrastructure (VPC, subnets, gateways)
module "networking" {
  source = "./modules/networking"
  
  # Basic configuration
  project_name = var.project_name
  environment  = var.workspace_prefix
  
  # Network configuration
  vpc_cidr             = var.vpc_cidr
  public_subnet_cidrs  = var.public_subnet_cidrs
  private_subnet_cidrs = var.private_subnet_cidrs
  
  # Features
  enable_nat_gateway   = var.enable_nat_gateway
  enable_flow_logs     = var.enable_flow_logs
  enable_dns_hostnames = var.enable_dns_hostnames
  enable_dns_support   = var.enable_dns_support
  
  # Tags
  common_tags = local.common_tags
}
module "admin_portal_web_server" {
  source = "./modules/admin-portal-web-server"
  
  # Basic configuration
  project_name = var.project_name
  environment  = var.workspace_prefix
  
  # Lambda configuration
  runtime     = var.lambda_runtime
  timeout     = var.lambda_timeout
  memory_size = var.lambda_memory_size
  
  # Function URL configuration
  enable_function_url = var.enable_lambda_function_urls
  
  # S3 configuration for React build files
  portal_bucket_name = local.admin_portal_bucket_name
  
  # Backend API URL (placeholder - will be updated via API Gateway)
  admin_backend_url = "/api/v1"  # Relative URL - API Gateway will handle routing
  
  # Tags
  common_tags = local.common_tags
  
  depends_on = [module.networking]
}

# Admin Backend Lambda (API endpoints)
module "admin_backend" {
  source = "./modules/admin-backend"
  
  # Basic configuration
  project_name = var.project_name
  environment  = var.workspace_prefix
  
  # Lambda configuration
  runtime     = var.lambda_runtime
  timeout     = var.lambda_timeout
  memory_size = var.lambda_memory_size
  
  # Function URL configuration  
  enable_function_url = var.enable_lambda_function_urls
  
  # DynamoDB table names from bootstrap
  tenant_registry_table_name = local.tenant_registry_table_name
  step_functions_arn         = local.step_functions_arn
  
  # Step Functions ARNs for tenant lifecycle management (both use the same state machine)
  create_tenant_step_function_arn = local.step_functions_arn
  delete_tenant_step_function_arn = local.step_functions_arn
  
  # Cross-account access
  tenant_account_role_name = var.tenant_account_role_name
  
  # Tags
  common_tags = local.common_tags
  
  depends_on = [module.networking]
}

# Worker Lambda Functions for Infrastructure Operations
module "create_infra_worker" {
  source = "./modules/create-infra-worker"
  
  # Basic configuration
  project_name = var.project_name
  environment  = var.workspace_prefix
  
  # Lambda configuration
  runtime     = var.lambda_runtime
  timeout     = 300  # 5 minutes for infrastructure operations
  memory_size = 512
  
  # DynamoDB tables
  tenant_registry_table_name = local.tenant_registry_table_name
  tenant_public_table_name   = local.tenant_public_table_name
  
  # Cross-account access
  tenant_account_role_name = var.tenant_account_role_name
  
  # Tags
  common_tags = local.common_tags
  
  depends_on = [module.networking]
}

module "delete_infra_worker" {
  source = "./modules/delete-infra-worker"
  
  # Basic configuration
  project_name = var.project_name
  environment  = var.workspace_prefix
  
  # Lambda configuration
  runtime     = var.lambda_runtime
  timeout     = 300  # 5 minutes for infrastructure operations
  memory_size = 512
  
  # DynamoDB tables
  tenant_registry_table_name = local.tenant_registry_table_name
  tenant_public_table_name   = local.tenant_public_table_name
  
  # Cross-account access
  tenant_account_role_name = var.tenant_account_role_name
  
  # Tags
  common_tags = local.common_tags
  
  depends_on = [module.networking]
}

module "poll_infra_worker" {
  source = "./modules/poll-infra-worker"
  
  # Basic configuration
  project_name = var.project_name
  environment  = var.workspace_prefix
  
  # Lambda configuration
  runtime     = var.lambda_runtime
  timeout     = 60   # 1 minute for polling operations
  memory_size = 256
  
  # DynamoDB tables
  tenant_registry_table_name = local.tenant_registry_table_name
  tenant_public_table_name   = local.tenant_public_table_name
  
  # Cross-account access
  tenant_account_role_name = var.tenant_account_role_name
  
  # Tags
  common_tags = local.common_tags
  
  depends_on = [module.networking]
}

# Setup RBAC Worker Lambda (Default RBAC Creation for New Tenants via IMS)
module "setup_rbac_worker" {
  source = "./modules/setup-rbac-worker"
  
  # Basic configuration
  project_name = var.project_name
  environment  = var.workspace_prefix
  
  # Lambda configuration
  runtime     = var.lambda_runtime
  timeout     = 180  # 3 minutes for RBAC setup operations
  memory_size = 256
  
  # IMS Lambda Configuration (calls IMS APIs instead of direct DynamoDB)
  ims_lambda_function_name = var.enable_ims_service ? module.ims_service[0].lambda_function_name : ""
  ims_lambda_arn           = var.enable_ims_service ? module.ims_service[0].lambda_function_arn : ""
  ims_timeout              = var.ims_timeout
  
  # Tags
  common_tags = local.common_tags
  
  depends_on = [module.networking, module.ims_service]
}

# Create Admin Worker Lambda (Tenant Admin User Creation)
module "create_admin_worker" {
  source = "./modules/create-admin-worker"
  
  # Basic configuration
  project_name = var.project_name
  environment  = var.workspace_prefix
  
  # Lambda configuration
  runtime     = var.lambda_runtime
  timeout     = 180  # 3 minutes for user creation operations
  memory_size = 256
  
  # IMS Lambda Configuration (Direct Invocation) - dynamically from IMS module outputs
  ims_lambda_function_name = var.enable_ims_service ? module.ims_service[0].lambda_function_name : ""
  ims_lambda_arn           = var.enable_ims_service ? module.ims_service[0].lambda_function_arn : ""
  ims_timeout              = var.ims_timeout
  
  # Tags
  common_tags = local.common_tags
  
  depends_on = [module.networking, module.ims_service, module.platform_bootstrap, module.setup_rbac_worker]
}

# OMS Service Lambda
module "oms_service" {
  count  = var.enable_oms_service ? 1 : 0
  source = "./modules/oms-lambda"
  
  # Basic configuration
  environment  = var.workspace_prefix
  aws_region   = var.aws_region
  
  # Lambda configuration
  tenant_registry_table_name = local.tenant_registry_table_name
  cross_account_role_name    = var.oms_cross_account_role_name
  log_level                  = var.oms_log_level
  log_retention_days         = var.log_retention_days
  
  # API Gateway reference (will be updated after API Gateway is created)
  api_gateway_execution_arn  = var.enable_api_gateway ? module.api_gateway[0].api_gateway_execution_arn : ""
  
  depends_on = [module.networking]
}

# Private API Gateway for application access
module "api_gateway" {
  count  = var.enable_api_gateway ? 1 : 0
  source = "./modules/api-gateway"
  
  # Basic configuration
  project_name = var.project_name
  environment  = var.workspace_prefix
  
  # API Gateway configuration
  stage_name        = var.api_gateway_stage_name
  api_gateway_type  = var.api_gateway_type
  
  # VPC Endpoint for private API Gateway access (only needed for PRIVATE type)
  vpc_endpoint_id = var.api_gateway_type == "PRIVATE" ? module.vpc_endpoints.vpc_endpoint_ids["execute-api"] : null
  
  # Lambda integrations
  admin_portal_lambda_invoke_arn      = module.admin_portal_web_server.lambda_function_invoke_arn
  admin_backend_lambda_invoke_arn     = module.admin_backend.lambda_function_invoke_arn
  admin_portal_lambda_function_name   = module.admin_portal_web_server.lambda_function_name
  admin_backend_lambda_function_name  = module.admin_backend.lambda_function_name
  
  # JWT Authorizer configuration
  enable_jwt_authorizer                   = var.enable_jwt_authorizer && var.enable_cognito
  jwt_authorizer_lambda_invoke_arn       = var.enable_jwt_authorizer && var.enable_cognito ? module.jwt_authorizer[0].lambda_function_invoke_arn : ""
  jwt_authorizer_lambda_function_name    = var.enable_jwt_authorizer && var.enable_cognito ? module.jwt_authorizer[0].lambda_function_name : ""
  
  # IMS Service configuration
  ims_service_lambda_invoke_arn       = var.enable_ims_service && var.enable_cognito ? module.ims_service[0].lambda_function_invoke_arn : ""
  ims_service_lambda_function_name    = var.enable_ims_service && var.enable_cognito ? module.ims_service[0].lambda_function_name : ""
  
  # OMS Service configuration
  oms_service_lambda_invoke_arn       = var.enable_oms_service ? module.oms_service[0].lambda_function_invoke_arn : ""
  oms_service_lambda_function_name    = var.enable_oms_service ? module.oms_service[0].lambda_function_name : ""
  
  # Tags
  common_tags = local.common_tags
}
#   common_tags = local.common_tags
# }

# VPC Endpoints for AWS services (private access)
module "vpc_endpoints" {
  source = "./modules/vpc-endpoints"
  
  # Basic configuration
  project_name = var.project_name
  environment  = var.workspace_prefix
  
  # VPC configuration from new networking module
  vpc_id             = module.networking.vpc_id
  private_subnet_ids = module.networking.private_subnet_ids
  
  # VPC endpoint services to create
  vpc_endpoint_services = var.vpc_endpoint_services
  
  # Tags
  common_tags = local.common_tags
  
  depends_on = [module.networking]
}

# S3 bucket for React build files
resource "aws_s3_bucket" "admin_portal" {
  bucket        = local.admin_portal_bucket_name
  force_destroy = true  # Allow Terraform to delete bucket even if not empty

  tags = merge(local.common_tags, {
    Name        = "${local.name_prefix}-admin-portal"
    Purpose     = "Admin Portal React Build Files"
    Type        = "S3Bucket"
  })
}

resource "aws_s3_bucket_versioning" "admin_portal" {
  bucket = aws_s3_bucket.admin_portal.id
  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "admin_portal" {
  bucket = aws_s3_bucket.admin_portal.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

resource "aws_s3_bucket_public_access_block" "admin_portal" {
  bucket = aws_s3_bucket.admin_portal.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

# Lifecycle policy to expire old versions and delete markers
resource "aws_s3_bucket_lifecycle_configuration" "admin_portal" {
  bucket = aws_s3_bucket.admin_portal.id

  rule {
    id     = "expire-old-versions"
    status = "Enabled"

    noncurrent_version_expiration {
      noncurrent_days = 30
    }

    expiration {
      expired_object_delete_marker = true
    }
  }
}

# ==============================================
# Identity Management System Components
# ==============================================

# Cognito User Pool for Authentication
module "cognito" {
  count  = var.enable_cognito ? 1 : 0
  source = "./modules/cognito"
  
  # Basic configuration
  project_name = var.project_name
  environment  = var.workspace_prefix
  
  # Cognito configuration
  admin_create_user_only           = var.cognito_admin_create_user_only
  access_token_validity_minutes    = var.cognito_access_token_validity_minutes
  id_token_validity_minutes        = var.cognito_id_token_validity_minutes
  refresh_token_validity_days      = var.cognito_refresh_token_validity_days
  callback_urls                    = var.cognito_callback_urls
  logout_urls                      = var.cognito_logout_urls
  
  # Tags
  common_tags = local.common_tags
}

# JWT Authorizer Lambda
module "jwt_authorizer" {
  count  = var.enable_jwt_authorizer && var.enable_cognito ? 1 : 0
  source = "./modules/jwt-authorizer"
  
  # Basic configuration
  project_name = var.project_name
  environment  = var.workspace_prefix
  
  # Cognito configuration
  user_pool_id        = module.cognito[0].user_pool_id
  user_pool_arn       = module.cognito[0].user_pool_arn
  user_pool_client_id = module.cognito[0].user_pool_client_id
  jwt_signing_key     = random_password.jwt_signing_key[0].result
  
  # Lambda configuration
  lambda_zip_path     = "${path.root}/lambda-packages/jwt-authorizer.zip"
  runtime             = var.lambda_runtime
  timeout             = var.lambda_timeout
  memory_size         = 256
  log_retention_days  = var.log_retention_days
  log_level          = var.jwt_authorizer_log_level
  
  # Tags
  common_tags = local.common_tags
  
  depends_on = [module.cognito]
}

# ==============================================
# SSM Parameter Store Outputs
# ==============================================

# Store infrastructure outputs in SSM for cross-pipeline communication
module "infrastructure_ssm_outputs" {
  source = "./modules/ssm-outputs"
  
  workspace    = var.workspace_prefix
  account_type = "admin"
  category     = "infrastructure"
  aws_region   = var.aws_region
  
  outputs = {
    # Networking
    vpc-id               = module.networking.vpc_id
    vpc-cidr             = module.networking.vpc_cidr_block
    private-subnet-ids   = join(",", module.networking.private_subnet_ids)
    public-subnet-ids    = join(",", module.networking.public_subnet_ids)
    availability-zones   = join(",", module.networking.availability_zones)
    
    # Cognito
    cognito-user-pool-id        = var.enable_cognito ? module.cognito[0].user_pool_id : ""
    cognito-user-pool-arn       = var.enable_cognito ? module.cognito[0].user_pool_arn : ""
    cognito-user-pool-client-id = var.enable_cognito ? module.cognito[0].user_pool_client_id : ""
    cognito-user-pool-domain    = var.enable_cognito ? module.cognito[0].user_pool_domain : ""
    
    # API Gateway
    api-gateway-id           = var.enable_api_gateway ? module.api_gateway[0].api_gateway_id : ""
    api-gateway-url          = var.enable_api_gateway ? module.api_gateway[0].admin_backend_base_url : ""
    api-gateway-execution-arn = var.enable_api_gateway ? module.api_gateway[0].api_gateway_execution_arn : ""
    
    # Lambda
    jwt-authorizer-function-name = var.enable_jwt_authorizer && var.enable_cognito ? module.jwt_authorizer[0].lambda_function_name : ""
    jwt-authorizer-function-arn  = var.enable_jwt_authorizer && var.enable_cognito ? module.jwt_authorizer[0].lambda_function_arn : ""
    
    # Admin Portal Web Server
    admin-portal-web-server-function-name = module.admin_portal_web_server.lambda_function_name
    admin-portal-web-server-function-arn  = module.admin_portal_web_server.lambda_function_arn
    admin-portal-web-server-function-url  = module.admin_portal_web_server.function_url
    admin-portal-web-server-s3-bucket     = local.admin_portal_bucket_name
    
    # Platform Bootstrap
    platform-admin-user-id = var.enable_platform_bootstrap && var.enable_cognito ? module.platform_bootstrap[0].platform_admin_cognito_user_id : ""
    platform-tenant-id     = var.enable_platform_bootstrap && var.enable_cognito ? module.platform_bootstrap[0].platform_tenant_id : ""
    
    # Deployment Status
    status = "completed"
  }
  
  depends_on = [
    module.networking,
    module.cognito,
    module.api_gateway,
    module.jwt_authorizer,
    module.platform_bootstrap,
    module.admin_portal_web_server
  ]
}

# Identity Management Service (IMS) Lambda
module "ims_service" {
  count  = var.enable_ims_service && var.enable_cognito ? 1 : 0
  source = "./modules/ims-service"
  
  # Basic configuration
  project_name = var.project_name
  environment  = var.workspace_prefix
  
  # Lambda configuration
  lambda_zip_path   = "${path.root}/lambda-packages/ims-service.zip"
  handler           = "index.handler"
  runtime           = var.lambda_runtime
  timeout           = var.ims_lambda_timeout
  memory_size       = var.ims_lambda_memory_size
  log_retention_days = var.log_retention_days
  log_level         = var.ims_log_level
  
  # Function URL configuration
  enable_function_url = var.enable_lambda_function_urls
  
  # Cognito configuration
  user_pool_id        = module.cognito[0].user_pool_id
  user_pool_arn       = module.cognito[0].user_pool_arn
  user_pool_client_id = module.cognito[0].user_pool_client_id
  user_pool_client_secret = module.cognito[0].user_pool_client_secret
  jwt_signing_key     = random_password.jwt_signing_key[0].result
  
  # DynamoDB configuration
  tenant_registry_table_name = local.tenant_registry_table_name
  tenant_registry_table_arn  = "arn:aws:dynamodb:${local.region}:${local.account_id}:table/${local.tenant_registry_table_name}"
  
  # VPC configuration (optional)
  vpc_config = null  # Can be configured later if VPC access is needed
  
  # Tags
  common_tags = local.common_tags
  
  depends_on = [module.cognito, module.networking]
}

# Platform Bootstrap (Platform Admin User + RBAC Setup)
module "platform_bootstrap" {
  count  = var.enable_platform_bootstrap && var.enable_cognito ? 1 : 0
  source = "./modules/platform-bootstrap"
  
  # Basic configuration
  project_name = var.project_name
  environment  = var.workspace_prefix
  
  # Cognito configuration
  user_pool_id = module.cognito[0].user_pool_id
  
  # DynamoDB configuration (using tenant registry table)
  rbac_table_name      = local.tenant_registry_table_name
  rbac_table_hash_key  = "PK"
  rbac_table_range_key = "SK"
  
  # Platform admin configuration
  platform_admin_email = var.platform_admin_email
  temporary_password    = var.temporary_password
  
  # Tags
  common_tags = local.common_tags
  
  depends_on = [module.cognito]
}