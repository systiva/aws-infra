# Platform Bootstrap Module
# Creates default platform-admin user with RBAC setup

terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
    random = {
      source  = "hashicorp/random"
      version = "~> 3.4"
    }
  }
}

# Generate random password for platform admin
# Generate unique 8-character platform ID
resource "random_integer" "platform_id" {
  min = 10000000  # 8-digit minimum
  max = 99999999  # 8-digit maximum
}

# Generate UUIDs for entities
resource "random_uuid" "platform_admin_group_id" {}
resource "random_uuid" "account_admin_group_id" {}
resource "random_uuid" "infra_manager_role_id" {}
resource "random_uuid" "platform_admin_manager_role_id" {}
resource "random_uuid" "account_admin_manager_role_id" {}
resource "random_uuid" "user_manager_role_id" {}
resource "random_uuid" "user_group_manager_role_id" {}
resource "random_uuid" "user_role_manager_role_id" {}
resource "random_uuid" "user_permission_manager_role_id" {}

# Generate UUIDs for Systiva account entities
resource "random_uuid" "systiva_address_id" {}
resource "random_uuid" "systiva_technical_user_id" {}
resource "random_uuid" "systiva_license_id" {}

# Generate UUIDs for default Enterprise, Product, Service entities
# Enterprises
resource "random_uuid" "global_enterprise_id" {}
resource "random_uuid" "sap_enterprise_id" {}
resource "random_uuid" "oracle_enterprise_id" {}

# Products
resource "random_uuid" "platform_product_id" {}  # All Products
resource "random_uuid" "devops_product_id" {}
resource "random_uuid" "integration_factory_product_id" {}

# Services
resource "random_uuid" "all_services_service_id" {}
resource "random_uuid" "integration_service_id" {}
resource "random_uuid" "extension_service_id" {}

# Linkages
resource "random_uuid" "enterprise_product_service_linkage_id" {}  # Global -> All Products -> All Services
resource "random_uuid" "sap_devops_linkage_id" {}                  # SAP -> DevOps -> Integration, Extension
resource "random_uuid" "sap_integration_factory_linkage_id" {}     # SAP -> Integration Factory -> Integration, Extension
resource "random_uuid" "oracle_devops_linkage_id" {}               # Oracle -> DevOps -> Integration

# Generate UUIDs for permissions
resource "random_uuid" "permission_ids" {
  for_each = {
    # Infrastructure management permissions (4)
    "onboard-account" = {}
    "suspend-account" = {}
    "resume-account" = {}
    "offboard-account" = {}
    # Platform admin management permissions (6)
    "create-platform-admin" = {}
    "get-platform-admin" = {}
    "update-platform-admin" = {}
    "delete-platform-admin" = {}
    "resume-platform-admin" = {}
    "suspend-platform-admin" = {}
    # Account admin management permissions (5)
    "create-account-admin" = {}
    "update-account-admin" = {}
    "delete-account-admin" = {}
    "suspend-account-admin" = {}
    "resume-account-admin" = {}
    # User management permissions (6)
    "create-user" = {}
    "update-user" = {}
    "get-user" = {}
    "delete-user" = {}
    "resume-user" = {}
    "suspend-user" = {}
    # User group management permissions (5)
    "create-user-group" = {}
    "get-user-group" = {}
    "delete-user-group" = {}
    "update-user-group" = {}
    "assign-user-group" = {}
    # User role management permissions (5)
    "create-user-role" = {}
    "get-user-role" = {}
    "delete-user-role" = {}
    "update-user-role" = {}
    "assign-user-role" = {}
    # User permission management permissions (4)
    "create-user-permission" = {}
    "get-account-permission" = {}
    "delete-account-permission" = {}
    "update-account-permission" = {}
    "assign-permission-assign" = {}
  }
}

# Local values
locals {
  platform_id = tostring(random_integer.platform_id.result)
  platform_admin_username = var.platform_admin_username
  platform_admin_email = var.platform_admin_email
  platform_admin_first_name = var.platform_admin_first_name
  platform_admin_last_name = var.platform_admin_last_name
  current_timestamp = formatdate("YYYY-MM-DD'T'hh:mm:ss.000Z", timestamp())

  # License dates: start = now, end = now + license_duration_years
  license_start_date = formatdate("YYYY-MM-DD", timestamp())
  license_end_date = formatdate("YYYY-MM-DD", timeadd(timestamp(), "${var.license_duration_years * 365 * 24}h"))

  # Technical user configuration
  technical_user_first_name = var.technical_user_first_name
  technical_user_last_name = var.technical_user_last_name

  # Default account configuration
  default_account_name = var.default_account_name
  default_master_account_name = var.default_master_account_name
  default_cloud_type = var.default_cloud_type
  default_subscription_tier = var.default_subscription_tier
}

# ==============================================
# Cognito User Creation
# ==============================================

# Create platform admin user in Cognito with email attribute
resource "aws_cognito_user" "platform_admin" {
  user_pool_id = var.user_pool_id
  username     = local.platform_admin_username

  # Set email attribute directly - this is the proper way to link email
  attributes = {
    email          = local.platform_admin_email
    email_verified = "true"
  }

  # Set temporary password from variable (passed from GitHub secret)
  temporary_password = var.temporary_password
  message_action     = "SUPPRESS"  # Don't send welcome email

  # Ensure the platform ID is generated first
  depends_on = [random_integer.platform_id]

  # CRITICAL: Prevent Terraform from modifying user after creation
  lifecycle {
    ignore_changes = all  # Ignore all changes after initial creation
  }
}

# Set additional custom user attributes via AWS CLI (custom:account_id)
# Note: Email is now set directly in aws_cognito_user resource above
resource "null_resource" "set_platform_admin_custom_attributes" {
  triggers = {
    user_pool_id = var.user_pool_id
    username     = local.platform_admin_username
    platform_id  = local.platform_id
  }

  provisioner "local-exec" {
    command = <<-EOT
      aws cognito-idp admin-update-user-attributes \
        --user-pool-id ${var.user_pool_id} \
        --username ${local.platform_admin_username} \
        --user-attributes \
          Name=custom:account_id,Value=${local.platform_id}
    EOT
  }

  depends_on = [aws_cognito_user.platform_admin]
}

# ==============================================
# DynamoDB RBAC Entries
# ==============================================

# ==============================================
# Systiva Default Account (Main Account Entry)
# ==============================================
# This creates the complete Systiva account with all details
# that will be displayed on the Manage Accounts screen in ppp-fe

# Create Systiva account entity (ppp-be compatible format)
resource "aws_dynamodb_table_item" "systiva_account" {
  table_name = var.rbac_table_name
  hash_key   = var.rbac_table_hash_key
  range_key  = var.rbac_table_range_key

  item = jsonencode({
    PK = {
      S = "ACCOUNT#${local.platform_id}"
    }
    SK = {
      S = "ACCOUNT#${local.platform_id}"
    }
    entityType = {
      S = "ACCOUNT"
    }
    accountId = {
      S = local.platform_id
    }
    accountName = {
      S = local.default_account_name
    }
    masterAccount = {
      S = local.default_master_account_name
    }
    cloudType = {
      S = local.default_cloud_type
    }
    subscriptionTier = {
      S = local.default_subscription_tier
    }
    email = {
      S = local.platform_admin_email
    }
    firstName = {
      S = local.technical_user_first_name
    }
    lastName = {
      S = local.technical_user_last_name
    }
    status = {
      S = "Active"
    }
    provisioningState = {
      S = "active"
    }
    # Address details
    addressLine1 = {
      S = var.default_address_line1
    }
    addressLine2 = {
      S = var.default_address_line2
    }
    city = {
      S = var.default_city
    }
    state = {
      S = var.default_state
    }
    country = {
      S = var.default_country
    }
    pincode = {
      S = var.default_zip_code
    }
    # Embedded address details for frontend
    addressDetails = {
      M = {
        addressLine1 = { S = var.default_address_line1 }
        addressLine2 = { S = var.default_address_line2 }
        city = { S = var.default_city }
        state = { S = var.default_state }
        zipCode = { S = var.default_zip_code }
        country = { S = var.default_country }
      }
    }
    # Embedded technical user for frontend
    technicalUser = {
      M = {
        firstName = { S = local.technical_user_first_name }
        lastName = { S = local.technical_user_last_name }
        adminUsername = { S = local.platform_admin_username }
        adminEmail = { S = local.platform_admin_email }
        status = { S = "Active" }
        assignedUserGroup = { S = "platform-admin" }
        assignedRole = { S = "infra-manager" }
        assignmentStartDate = { S = local.license_start_date }
        assignmentEndDate = { S = local.license_end_date }
      }
    }
    # Embedded licenses array for frontend
    licenses = {
      L = [
        {
          M = {
            id = { S = random_uuid.systiva_license_id.result }
            enterprise = { S = "Global" }
            product = { S = "All Products" }
            service = { S = "All Services" }
            licenseStart = { S = local.license_start_date }
            licenseEnd = { S = local.license_end_date }
            users = { N = "100" }
            renewalNotice = { BOOL = true }
            noticePeriod = { N = "30" }
          }
        }
      ]
    }
    adminUsername = {
      S = local.platform_admin_username
    }
    registeredOn = {
      S = local.current_timestamp
    }
    createdAt = {
      S = local.current_timestamp
    }
    lastModified = {
      S = local.current_timestamp
    }
    updatedAt = {
      S = local.current_timestamp
    }
    created_by = {
      S = "terraform"
    }
  })

  # Ensure the platform ID is generated first
  depends_on = [random_integer.platform_id]
}

# Create address entity for Systiva account
resource "aws_dynamodb_table_item" "systiva_address" {
  table_name = var.rbac_table_name
  hash_key   = var.rbac_table_hash_key
  range_key  = var.rbac_table_range_key

  item = jsonencode({
    PK = {
      S = "ACCOUNT#${local.platform_id}"
    }
    SK = {
      S = "ADDRESS#${random_uuid.systiva_address_id.result}"
    }
    entityType = {
      S = "ADDRESS"
    }
    id = {
      S = random_uuid.systiva_address_id.result
    }
    accountId = {
      S = local.platform_id
    }
    addressLine1 = {
      S = var.default_address_line1
    }
    addressLine2 = {
      S = var.default_address_line2
    }
    city = {
      S = var.default_city
    }
    state = {
      S = var.default_state
    }
    zipCode = {
      S = var.default_zip_code
    }
    country = {
      S = var.default_country
    }
    isPrimary = {
      BOOL = true
    }
    createdAt = {
      S = local.current_timestamp
    }
    updatedAt = {
      S = local.current_timestamp
    }
  })

  depends_on = [aws_dynamodb_table_item.systiva_account]
}

# Create technical user entity for Systiva account
resource "aws_dynamodb_table_item" "systiva_technical_user" {
  table_name = var.rbac_table_name
  hash_key   = var.rbac_table_hash_key
  range_key  = var.rbac_table_range_key

  item = jsonencode({
    PK = {
      S = "ACCOUNT#${local.platform_id}"
    }
    SK = {
      S = "TECHNICAL_USER#${random_uuid.systiva_technical_user_id.result}"
    }
    entityType = {
      S = "TECHNICAL_USER"
    }
    id = {
      S = random_uuid.systiva_technical_user_id.result
    }
    accountId = {
      S = local.platform_id
    }
    firstName = {
      S = local.technical_user_first_name
    }
    lastName = {
      S = local.technical_user_last_name
    }
    adminUsername = {
      S = local.platform_admin_username
    }
    adminEmail = {
      S = local.platform_admin_email
    }
    status = {
      S = "Active"
    }
    assignedUserGroup = {
      S = "platform-admin"
    }
    assignedRole = {
      S = "infra-manager"
    }
    assignmentStartDate = {
      S = local.license_start_date
    }
    assignmentEndDate = {
      S = local.license_end_date
    }
    createdAt = {
      S = local.current_timestamp
    }
    updatedAt = {
      S = local.current_timestamp
    }
  })

  depends_on = [aws_dynamodb_table_item.systiva_account]
}

# Create license entity for Systiva account
resource "aws_dynamodb_table_item" "systiva_license" {
  table_name = var.rbac_table_name
  hash_key   = var.rbac_table_hash_key
  range_key  = var.rbac_table_range_key

  item = jsonencode({
    PK = {
      S = "ACCOUNT#${local.platform_id}"
    }
    SK = {
      S = "LICENSE#${random_uuid.systiva_license_id.result}"
    }
    entityType = {
      S = "LICENSE"
    }
    id = {
      S = random_uuid.systiva_license_id.result
    }
    accountId = {
      S = local.platform_id
    }
    enterprise = {
      S = "Global"
    }
    product = {
      S = "All Products"
    }
    service = {
      S = "All Services"
    }
    licenseStart = {
      S = local.license_start_date
    }
    licenseEnd = {
      S = local.license_end_date
    }
    users = {
      N = "100"
    }
    renewalNotice = {
      BOOL = true
    }
    noticePeriod = {
      N = "30"
    }
    contactDetails = {
      M = {
        firstName = { S = local.technical_user_first_name }
        lastName = { S = local.technical_user_last_name }
        email = { S = local.platform_admin_email }
        company = { S = local.default_master_account_name }
      }
    }
    createdAt = {
      S = local.current_timestamp
    }
    updatedAt = {
      S = local.current_timestamp
    }
  })

  depends_on = [aws_dynamodb_table_item.systiva_account]
}

# ==============================================
# Default Enterprise, Product, Service & Linkage
# ==============================================
# These entities will appear in the Enterprise Configuration screen

# Create "Global" Enterprise entity
resource "aws_dynamodb_table_item" "global_enterprise" {
  table_name = var.rbac_table_name
  hash_key   = var.rbac_table_hash_key
  range_key  = var.rbac_table_range_key

  item = jsonencode({
    PK = {
      S = "SYSTIVA#${random_uuid.global_enterprise_id.result}"
    }
    SK = {
      S = "ENTERPRISE#${random_uuid.global_enterprise_id.result}"
    }
    id = {
      S = random_uuid.global_enterprise_id.result
    }
    enterprise_name = {
      S = "Global"
    }
    name = {
      S = "Global"
    }
    entity_type = {
      S = "enterprise"
    }
    accountId = {
      S = local.platform_id
    }
    created_date = {
      S = local.current_timestamp
    }
    createdAt = {
      S = local.current_timestamp
    }
    updated_date = {
      S = local.current_timestamp
    }
    updatedAt = {
      S = local.current_timestamp
    }
  })

  depends_on = [aws_dynamodb_table_item.systiva_account]
}

# Create "SAP" Enterprise entity
resource "aws_dynamodb_table_item" "sap_enterprise" {
  table_name = var.rbac_table_name
  hash_key   = var.rbac_table_hash_key
  range_key  = var.rbac_table_range_key

  item = jsonencode({
    PK = {
      S = "SYSTIVA#${random_uuid.sap_enterprise_id.result}"
    }
    SK = {
      S = "ENTERPRISE#${random_uuid.sap_enterprise_id.result}"
    }
    id = {
      S = random_uuid.sap_enterprise_id.result
    }
    enterprise_name = {
      S = "SAP"
    }
    name = {
      S = "SAP"
    }
    entity_type = {
      S = "enterprise"
    }
    accountId = {
      S = local.platform_id
    }
    created_date = {
      S = local.current_timestamp
    }
    createdAt = {
      S = local.current_timestamp
    }
    updated_date = {
      S = local.current_timestamp
    }
    updatedAt = {
      S = local.current_timestamp
    }
  })

  depends_on = [aws_dynamodb_table_item.systiva_account]
}

# Create "Oracle" Enterprise entity
resource "aws_dynamodb_table_item" "oracle_enterprise" {
  table_name = var.rbac_table_name
  hash_key   = var.rbac_table_hash_key
  range_key  = var.rbac_table_range_key

  item = jsonencode({
    PK = {
      S = "SYSTIVA#${random_uuid.oracle_enterprise_id.result}"
    }
    SK = {
      S = "ENTERPRISE#${random_uuid.oracle_enterprise_id.result}"
    }
    id = {
      S = random_uuid.oracle_enterprise_id.result
    }
    enterprise_name = {
      S = "Oracle"
    }
    name = {
      S = "Oracle"
    }
    entity_type = {
      S = "enterprise"
    }
    accountId = {
      S = local.platform_id
    }
    created_date = {
      S = local.current_timestamp
    }
    createdAt = {
      S = local.current_timestamp
    }
    updated_date = {
      S = local.current_timestamp
    }
    updatedAt = {
      S = local.current_timestamp
    }
  })

  depends_on = [aws_dynamodb_table_item.systiva_account]
}

# Create "All Products" Product entity
resource "aws_dynamodb_table_item" "platform_product" {
  table_name = var.rbac_table_name
  hash_key   = var.rbac_table_hash_key
  range_key  = var.rbac_table_range_key

  item = jsonencode({
    PK = {
      S = "SYSTIVA#${random_uuid.platform_product_id.result}"
    }
    SK = {
      S = "PRODUCT#${random_uuid.platform_product_id.result}"
    }
    id = {
      S = random_uuid.platform_product_id.result
    }
    product_name = {
      S = "All Products"
    }
    name = {
      S = "All Products"
    }
    entity_type = {
      S = "product"
    }
    accountId = {
      S = local.platform_id
    }
    created_date = {
      S = local.current_timestamp
    }
    createdAt = {
      S = local.current_timestamp
    }
    updated_date = {
      S = local.current_timestamp
    }
    updatedAt = {
      S = local.current_timestamp
    }
  })

  depends_on = [aws_dynamodb_table_item.systiva_account]
}

# Create "DevOps" Product entity
resource "aws_dynamodb_table_item" "devops_product" {
  table_name = var.rbac_table_name
  hash_key   = var.rbac_table_hash_key
  range_key  = var.rbac_table_range_key

  item = jsonencode({
    PK = {
      S = "SYSTIVA#${random_uuid.devops_product_id.result}"
    }
    SK = {
      S = "PRODUCT#${random_uuid.devops_product_id.result}"
    }
    id = {
      S = random_uuid.devops_product_id.result
    }
    product_name = {
      S = "DevOps"
    }
    name = {
      S = "DevOps"
    }
    entity_type = {
      S = "product"
    }
    accountId = {
      S = local.platform_id
    }
    created_date = {
      S = local.current_timestamp
    }
    createdAt = {
      S = local.current_timestamp
    }
    updated_date = {
      S = local.current_timestamp
    }
    updatedAt = {
      S = local.current_timestamp
    }
  })

  depends_on = [aws_dynamodb_table_item.systiva_account]
}

# Create "Integration Factory" Product entity
resource "aws_dynamodb_table_item" "integration_factory_product" {
  table_name = var.rbac_table_name
  hash_key   = var.rbac_table_hash_key
  range_key  = var.rbac_table_range_key

  item = jsonencode({
    PK = {
      S = "SYSTIVA#${random_uuid.integration_factory_product_id.result}"
    }
    SK = {
      S = "PRODUCT#${random_uuid.integration_factory_product_id.result}"
    }
    id = {
      S = random_uuid.integration_factory_product_id.result
    }
    product_name = {
      S = "Integration Factory"
    }
    name = {
      S = "Integration Factory"
    }
    entity_type = {
      S = "product"
    }
    accountId = {
      S = local.platform_id
    }
    created_date = {
      S = local.current_timestamp
    }
    createdAt = {
      S = local.current_timestamp
    }
    updated_date = {
      S = local.current_timestamp
    }
    updatedAt = {
      S = local.current_timestamp
    }
  })

  depends_on = [aws_dynamodb_table_item.systiva_account]
}

# Create "All Services" Service entity
resource "aws_dynamodb_table_item" "all_services_service" {
  table_name = var.rbac_table_name
  hash_key   = var.rbac_table_hash_key
  range_key  = var.rbac_table_range_key

  item = jsonencode({
    PK = {
      S = "SYSTIVA#${random_uuid.all_services_service_id.result}"
    }
    SK = {
      S = "SERVICE#${random_uuid.all_services_service_id.result}"
    }
    id = {
      S = random_uuid.all_services_service_id.result
    }
    service_name = {
      S = "All Services"
    }
    name = {
      S = "All Services"
    }
    entity_type = {
      S = "service"
    }
    accountId = {
      S = local.platform_id
    }
    created_date = {
      S = local.current_timestamp
    }
    createdAt = {
      S = local.current_timestamp
    }
    updated_date = {
      S = local.current_timestamp
    }
    updatedAt = {
      S = local.current_timestamp
    }
  })

  depends_on = [aws_dynamodb_table_item.systiva_account]
}

# Create "Integration" Service entity
resource "aws_dynamodb_table_item" "integration_service" {
  table_name = var.rbac_table_name
  hash_key   = var.rbac_table_hash_key
  range_key  = var.rbac_table_range_key

  item = jsonencode({
    PK = {
      S = "SYSTIVA#${random_uuid.integration_service_id.result}"
    }
    SK = {
      S = "SERVICE#${random_uuid.integration_service_id.result}"
    }
    id = {
      S = random_uuid.integration_service_id.result
    }
    service_name = {
      S = "Integration"
    }
    name = {
      S = "Integration"
    }
    entity_type = {
      S = "service"
    }
    accountId = {
      S = local.platform_id
    }
    created_date = {
      S = local.current_timestamp
    }
    createdAt = {
      S = local.current_timestamp
    }
    updated_date = {
      S = local.current_timestamp
    }
    updatedAt = {
      S = local.current_timestamp
    }
  })

  depends_on = [aws_dynamodb_table_item.systiva_account]
}

# Create "Extension" Service entity
resource "aws_dynamodb_table_item" "extension_service" {
  table_name = var.rbac_table_name
  hash_key   = var.rbac_table_hash_key
  range_key  = var.rbac_table_range_key

  item = jsonencode({
    PK = {
      S = "SYSTIVA#${random_uuid.extension_service_id.result}"
    }
    SK = {
      S = "SERVICE#${random_uuid.extension_service_id.result}"
    }
    id = {
      S = random_uuid.extension_service_id.result
    }
    service_name = {
      S = "Extension"
    }
    name = {
      S = "Extension"
    }
    entity_type = {
      S = "service"
    }
    accountId = {
      S = local.platform_id
    }
    created_date = {
      S = local.current_timestamp
    }
    createdAt = {
      S = local.current_timestamp
    }
    updated_date = {
      S = local.current_timestamp
    }
    updatedAt = {
      S = local.current_timestamp
    }
  })

  depends_on = [aws_dynamodb_table_item.systiva_account]
}

# ===========================================
# LINKAGES
# ===========================================

# Linkage 1: Global -> All Products -> All Services
resource "aws_dynamodb_table_item" "enterprise_product_service_linkage" {
  table_name = var.rbac_table_name
  hash_key   = var.rbac_table_hash_key
  range_key  = var.rbac_table_range_key

  item = jsonencode({
    PK = {
      S = "SYSTIVA#${random_uuid.enterprise_product_service_linkage_id.result}"
    }
    SK = {
      S = "LINKAGE#${random_uuid.enterprise_product_service_linkage_id.result}"
    }
    id = {
      S = random_uuid.enterprise_product_service_linkage_id.result
    }
    enterprise_id = {
      S = random_uuid.global_enterprise_id.result
    }
    product_id = {
      S = random_uuid.platform_product_id.result
    }
    service_ids = {
      L = [
        { S = random_uuid.all_services_service_id.result }
      ]
    }
    entity_type = {
      S = "enterprise_product_service"
    }
    accountId = {
      S = local.platform_id
    }
    created_date = {
      S = local.current_timestamp
    }
    createdAt = {
      S = local.current_timestamp
    }
    updated_date = {
      S = local.current_timestamp
    }
    updatedAt = {
      S = local.current_timestamp
    }
  })

  depends_on = [
    aws_dynamodb_table_item.global_enterprise,
    aws_dynamodb_table_item.platform_product,
    aws_dynamodb_table_item.all_services_service
  ]
}

# Enterprise lookup record for easier querying
resource "aws_dynamodb_table_item" "enterprise_linkage_lookup" {
  table_name = var.rbac_table_name
  hash_key   = var.rbac_table_hash_key
  range_key  = var.rbac_table_range_key

  item = jsonencode({
    PK = {
      S = "SYSTIVA#${random_uuid.global_enterprise_id.result}"
    }
    SK = {
      S = "LINKAGE#${random_uuid.enterprise_product_service_linkage_id.result}"
    }
    linkage_id = {
      S = random_uuid.enterprise_product_service_linkage_id.result
    }
    product_id = {
      S = random_uuid.platform_product_id.result
    }
    service_ids = {
      L = [
        { S = random_uuid.all_services_service_id.result }
      ]
    }
    entity_type = {
      S = "enterprise_linkage"
    }
    created_date = {
      S = local.current_timestamp
    }
  })

  depends_on = [aws_dynamodb_table_item.enterprise_product_service_linkage]
}

# Product lookup record for easier querying
resource "aws_dynamodb_table_item" "product_linkage_lookup" {
  table_name = var.rbac_table_name
  hash_key   = var.rbac_table_hash_key
  range_key  = var.rbac_table_range_key

  item = jsonencode({
    PK = {
      S = "SYSTIVA#${random_uuid.platform_product_id.result}"
    }
    SK = {
      S = "LINKAGE#${random_uuid.enterprise_product_service_linkage_id.result}"
    }
    linkage_id = {
      S = random_uuid.enterprise_product_service_linkage_id.result
    }
    enterprise_id = {
      S = random_uuid.global_enterprise_id.result
    }
    service_ids = {
      L = [
        { S = random_uuid.all_services_service_id.result }
      ]
    }
    entity_type = {
      S = "product_linkage"
    }
    created_date = {
      S = local.current_timestamp
    }
  })

  depends_on = [aws_dynamodb_table_item.enterprise_product_service_linkage]
}

# Service lookup record for easier querying
resource "aws_dynamodb_table_item" "service_linkage_lookup" {
  table_name = var.rbac_table_name
  hash_key   = var.rbac_table_hash_key
  range_key  = var.rbac_table_range_key

  item = jsonencode({
    PK = {
      S = "SYSTIVA#${random_uuid.all_services_service_id.result}"
    }
    SK = {
      S = "LINKAGE#${random_uuid.enterprise_product_service_linkage_id.result}"
    }
    linkage_id = {
      S = random_uuid.enterprise_product_service_linkage_id.result
    }
    enterprise_id = {
      S = random_uuid.global_enterprise_id.result
    }
    product_id = {
      S = random_uuid.platform_product_id.result
    }
    entity_type = {
      S = "service_linkage"
    }
    created_date = {
      S = local.current_timestamp
    }
  })

  depends_on = [aws_dynamodb_table_item.enterprise_product_service_linkage]
}

# ===========================================
# Linkage 2: SAP -> DevOps -> Integration, Extension
# ===========================================

resource "aws_dynamodb_table_item" "sap_devops_linkage" {
  table_name = var.rbac_table_name
  hash_key   = var.rbac_table_hash_key
  range_key  = var.rbac_table_range_key

  item = jsonencode({
    PK = {
      S = "SYSTIVA#${random_uuid.sap_devops_linkage_id.result}"
    }
    SK = {
      S = "LINKAGE#${random_uuid.sap_devops_linkage_id.result}"
    }
    id = {
      S = random_uuid.sap_devops_linkage_id.result
    }
    enterprise_id = {
      S = random_uuid.sap_enterprise_id.result
    }
    product_id = {
      S = random_uuid.devops_product_id.result
    }
    service_ids = {
      L = [
        { S = random_uuid.integration_service_id.result },
        { S = random_uuid.extension_service_id.result }
      ]
    }
    entity_type = {
      S = "enterprise_product_service"
    }
    created_date = {
      S = local.current_timestamp
    }
    createdAt = {
      S = local.current_timestamp
    }
    updated_date = {
      S = local.current_timestamp
    }
    updatedAt = {
      S = local.current_timestamp
    }
  })

  depends_on = [
    aws_dynamodb_table_item.sap_enterprise,
    aws_dynamodb_table_item.devops_product,
    aws_dynamodb_table_item.integration_service,
    aws_dynamodb_table_item.extension_service
  ]
}

# SAP-DevOps Enterprise lookup
resource "aws_dynamodb_table_item" "sap_devops_enterprise_lookup" {
  table_name = var.rbac_table_name
  hash_key   = var.rbac_table_hash_key
  range_key  = var.rbac_table_range_key

  item = jsonencode({
    PK = {
      S = "SYSTIVA#${random_uuid.sap_enterprise_id.result}"
    }
    SK = {
      S = "LINKAGE#${random_uuid.sap_devops_linkage_id.result}"
    }
    linkage_id = {
      S = random_uuid.sap_devops_linkage_id.result
    }
    product_id = {
      S = random_uuid.devops_product_id.result
    }
    service_ids = {
      L = [
        { S = random_uuid.integration_service_id.result },
        { S = random_uuid.extension_service_id.result }
      ]
    }
    entity_type = {
      S = "enterprise_linkage"
    }
    created_date = {
      S = local.current_timestamp
    }
  })

  depends_on = [aws_dynamodb_table_item.sap_devops_linkage]
}

# SAP-DevOps Product lookup
resource "aws_dynamodb_table_item" "sap_devops_product_lookup" {
  table_name = var.rbac_table_name
  hash_key   = var.rbac_table_hash_key
  range_key  = var.rbac_table_range_key

  item = jsonencode({
    PK = {
      S = "SYSTIVA#${random_uuid.devops_product_id.result}"
    }
    SK = {
      S = "LINKAGE#${random_uuid.sap_devops_linkage_id.result}"
    }
    linkage_id = {
      S = random_uuid.sap_devops_linkage_id.result
    }
    enterprise_id = {
      S = random_uuid.sap_enterprise_id.result
    }
    service_ids = {
      L = [
        { S = random_uuid.integration_service_id.result },
        { S = random_uuid.extension_service_id.result }
      ]
    }
    entity_type = {
      S = "product_linkage"
    }
    created_date = {
      S = local.current_timestamp
    }
  })

  depends_on = [aws_dynamodb_table_item.sap_devops_linkage]
}

# SAP-DevOps Integration service lookup
resource "aws_dynamodb_table_item" "sap_devops_integration_lookup" {
  table_name = var.rbac_table_name
  hash_key   = var.rbac_table_hash_key
  range_key  = var.rbac_table_range_key

  item = jsonencode({
    PK = {
      S = "SYSTIVA#${random_uuid.integration_service_id.result}"
    }
    SK = {
      S = "LINKAGE#${random_uuid.sap_devops_linkage_id.result}"
    }
    linkage_id = {
      S = random_uuid.sap_devops_linkage_id.result
    }
    enterprise_id = {
      S = random_uuid.sap_enterprise_id.result
    }
    product_id = {
      S = random_uuid.devops_product_id.result
    }
    entity_type = {
      S = "service_linkage"
    }
    created_date = {
      S = local.current_timestamp
    }
  })

  depends_on = [aws_dynamodb_table_item.sap_devops_linkage]
}

# SAP-DevOps Extension service lookup
resource "aws_dynamodb_table_item" "sap_devops_extension_lookup" {
  table_name = var.rbac_table_name
  hash_key   = var.rbac_table_hash_key
  range_key  = var.rbac_table_range_key

  item = jsonencode({
    PK = {
      S = "SYSTIVA#${random_uuid.extension_service_id.result}"
    }
    SK = {
      S = "LINKAGE#${random_uuid.sap_devops_linkage_id.result}"
    }
    linkage_id = {
      S = random_uuid.sap_devops_linkage_id.result
    }
    enterprise_id = {
      S = random_uuid.sap_enterprise_id.result
    }
    product_id = {
      S = random_uuid.devops_product_id.result
    }
    entity_type = {
      S = "service_linkage"
    }
    created_date = {
      S = local.current_timestamp
    }
  })

  depends_on = [aws_dynamodb_table_item.sap_devops_linkage]
}

# ===========================================
# Linkage 3: SAP -> Integration Factory -> Integration, Extension
# ===========================================

resource "aws_dynamodb_table_item" "sap_integration_factory_linkage" {
  table_name = var.rbac_table_name
  hash_key   = var.rbac_table_hash_key
  range_key  = var.rbac_table_range_key

  item = jsonencode({
    PK = {
      S = "SYSTIVA#${random_uuid.sap_integration_factory_linkage_id.result}"
    }
    SK = {
      S = "LINKAGE#${random_uuid.sap_integration_factory_linkage_id.result}"
    }
    id = {
      S = random_uuid.sap_integration_factory_linkage_id.result
    }
    enterprise_id = {
      S = random_uuid.sap_enterprise_id.result
    }
    product_id = {
      S = random_uuid.integration_factory_product_id.result
    }
    service_ids = {
      L = [
        { S = random_uuid.integration_service_id.result },
        { S = random_uuid.extension_service_id.result }
      ]
    }
    entity_type = {
      S = "enterprise_product_service"
    }
    created_date = {
      S = local.current_timestamp
    }
    createdAt = {
      S = local.current_timestamp
    }
    updated_date = {
      S = local.current_timestamp
    }
    updatedAt = {
      S = local.current_timestamp
    }
  })

  depends_on = [
    aws_dynamodb_table_item.sap_enterprise,
    aws_dynamodb_table_item.integration_factory_product,
    aws_dynamodb_table_item.integration_service,
    aws_dynamodb_table_item.extension_service
  ]
}

# SAP-IntegrationFactory Enterprise lookup
resource "aws_dynamodb_table_item" "sap_if_enterprise_lookup" {
  table_name = var.rbac_table_name
  hash_key   = var.rbac_table_hash_key
  range_key  = var.rbac_table_range_key

  item = jsonencode({
    PK = {
      S = "SYSTIVA#${random_uuid.sap_enterprise_id.result}"
    }
    SK = {
      S = "LINKAGE#${random_uuid.sap_integration_factory_linkage_id.result}"
    }
    linkage_id = {
      S = random_uuid.sap_integration_factory_linkage_id.result
    }
    product_id = {
      S = random_uuid.integration_factory_product_id.result
    }
    service_ids = {
      L = [
        { S = random_uuid.integration_service_id.result },
        { S = random_uuid.extension_service_id.result }
      ]
    }
    entity_type = {
      S = "enterprise_linkage"
    }
    created_date = {
      S = local.current_timestamp
    }
  })

  depends_on = [aws_dynamodb_table_item.sap_integration_factory_linkage]
}

# SAP-IntegrationFactory Product lookup
resource "aws_dynamodb_table_item" "sap_if_product_lookup" {
  table_name = var.rbac_table_name
  hash_key   = var.rbac_table_hash_key
  range_key  = var.rbac_table_range_key

  item = jsonencode({
    PK = {
      S = "SYSTIVA#${random_uuid.integration_factory_product_id.result}"
    }
    SK = {
      S = "LINKAGE#${random_uuid.sap_integration_factory_linkage_id.result}"
    }
    linkage_id = {
      S = random_uuid.sap_integration_factory_linkage_id.result
    }
    enterprise_id = {
      S = random_uuid.sap_enterprise_id.result
    }
    service_ids = {
      L = [
        { S = random_uuid.integration_service_id.result },
        { S = random_uuid.extension_service_id.result }
      ]
    }
    entity_type = {
      S = "product_linkage"
    }
    created_date = {
      S = local.current_timestamp
    }
  })

  depends_on = [aws_dynamodb_table_item.sap_integration_factory_linkage]
}

# SAP-IntegrationFactory Integration service lookup
resource "aws_dynamodb_table_item" "sap_if_integration_lookup" {
  table_name = var.rbac_table_name
  hash_key   = var.rbac_table_hash_key
  range_key  = var.rbac_table_range_key

  item = jsonencode({
    PK = {
      S = "SYSTIVA#${random_uuid.integration_service_id.result}"
    }
    SK = {
      S = "LINKAGE#${random_uuid.sap_integration_factory_linkage_id.result}"
    }
    linkage_id = {
      S = random_uuid.sap_integration_factory_linkage_id.result
    }
    enterprise_id = {
      S = random_uuid.sap_enterprise_id.result
    }
    product_id = {
      S = random_uuid.integration_factory_product_id.result
    }
    entity_type = {
      S = "service_linkage"
    }
    created_date = {
      S = local.current_timestamp
    }
  })

  depends_on = [aws_dynamodb_table_item.sap_integration_factory_linkage]
}

# SAP-IntegrationFactory Extension service lookup
resource "aws_dynamodb_table_item" "sap_if_extension_lookup" {
  table_name = var.rbac_table_name
  hash_key   = var.rbac_table_hash_key
  range_key  = var.rbac_table_range_key

  item = jsonencode({
    PK = {
      S = "SYSTIVA#${random_uuid.extension_service_id.result}"
    }
    SK = {
      S = "LINKAGE#${random_uuid.sap_integration_factory_linkage_id.result}"
    }
    linkage_id = {
      S = random_uuid.sap_integration_factory_linkage_id.result
    }
    enterprise_id = {
      S = random_uuid.sap_enterprise_id.result
    }
    product_id = {
      S = random_uuid.integration_factory_product_id.result
    }
    entity_type = {
      S = "service_linkage"
    }
    created_date = {
      S = local.current_timestamp
    }
  })

  depends_on = [aws_dynamodb_table_item.sap_integration_factory_linkage]
}

# ===========================================
# Linkage 4: Oracle -> DevOps -> Integration
# ===========================================

resource "aws_dynamodb_table_item" "oracle_devops_linkage" {
  table_name = var.rbac_table_name
  hash_key   = var.rbac_table_hash_key
  range_key  = var.rbac_table_range_key

  item = jsonencode({
    PK = {
      S = "SYSTIVA#${random_uuid.oracle_devops_linkage_id.result}"
    }
    SK = {
      S = "LINKAGE#${random_uuid.oracle_devops_linkage_id.result}"
    }
    id = {
      S = random_uuid.oracle_devops_linkage_id.result
    }
    enterprise_id = {
      S = random_uuid.oracle_enterprise_id.result
    }
    product_id = {
      S = random_uuid.devops_product_id.result
    }
    service_ids = {
      L = [
        { S = random_uuid.integration_service_id.result }
      ]
    }
    entity_type = {
      S = "enterprise_product_service"
    }
    created_date = {
      S = local.current_timestamp
    }
    createdAt = {
      S = local.current_timestamp
    }
    updated_date = {
      S = local.current_timestamp
    }
    updatedAt = {
      S = local.current_timestamp
    }
  })

  depends_on = [
    aws_dynamodb_table_item.oracle_enterprise,
    aws_dynamodb_table_item.devops_product,
    aws_dynamodb_table_item.integration_service
  ]
}

# Oracle-DevOps Enterprise lookup
resource "aws_dynamodb_table_item" "oracle_devops_enterprise_lookup" {
  table_name = var.rbac_table_name
  hash_key   = var.rbac_table_hash_key
  range_key  = var.rbac_table_range_key

  item = jsonencode({
    PK = {
      S = "SYSTIVA#${random_uuid.oracle_enterprise_id.result}"
    }
    SK = {
      S = "LINKAGE#${random_uuid.oracle_devops_linkage_id.result}"
    }
    linkage_id = {
      S = random_uuid.oracle_devops_linkage_id.result
    }
    product_id = {
      S = random_uuid.devops_product_id.result
    }
    service_ids = {
      L = [
        { S = random_uuid.integration_service_id.result }
      ]
    }
    entity_type = {
      S = "enterprise_linkage"
    }
    created_date = {
      S = local.current_timestamp
    }
  })

  depends_on = [aws_dynamodb_table_item.oracle_devops_linkage]
}

# Oracle-DevOps Product lookup
resource "aws_dynamodb_table_item" "oracle_devops_product_lookup" {
  table_name = var.rbac_table_name
  hash_key   = var.rbac_table_hash_key
  range_key  = var.rbac_table_range_key

  item = jsonencode({
    PK = {
      S = "SYSTIVA#${random_uuid.devops_product_id.result}"
    }
    SK = {
      S = "LINKAGE#${random_uuid.oracle_devops_linkage_id.result}"
    }
    linkage_id = {
      S = random_uuid.oracle_devops_linkage_id.result
    }
    enterprise_id = {
      S = random_uuid.oracle_enterprise_id.result
    }
    service_ids = {
      L = [
        { S = random_uuid.integration_service_id.result }
      ]
    }
    entity_type = {
      S = "product_linkage"
    }
    created_date = {
      S = local.current_timestamp
    }
  })

  depends_on = [aws_dynamodb_table_item.oracle_devops_linkage]
}

# Oracle-DevOps Integration service lookup
resource "aws_dynamodb_table_item" "oracle_devops_integration_lookup" {
  table_name = var.rbac_table_name
  hash_key   = var.rbac_table_hash_key
  range_key  = var.rbac_table_range_key

  item = jsonencode({
    PK = {
      S = "SYSTIVA#${random_uuid.integration_service_id.result}"
    }
    SK = {
      S = "LINKAGE#${random_uuid.oracle_devops_linkage_id.result}"
    }
    linkage_id = {
      S = random_uuid.oracle_devops_linkage_id.result
    }
    enterprise_id = {
      S = random_uuid.oracle_enterprise_id.result
    }
    product_id = {
      S = random_uuid.devops_product_id.result
    }
    entity_type = {
      S = "service_linkage"
    }
    created_date = {
      S = local.current_timestamp
    }
  })

  depends_on = [aws_dynamodb_table_item.oracle_devops_linkage]
}

# Legacy platform account entry (for backward compatibility with IMS)
resource "aws_dynamodb_table_item" "platform_account" {
  table_name = var.rbac_table_name
  hash_key   = var.rbac_table_hash_key
  range_key  = var.rbac_table_range_key

  item = jsonencode({
    PK = {
      S = "ACCOUNT#${local.platform_id}"
    }
    SK = {
      S = "METADATA"
    }
    entityType = {
      S = "ACCOUNT"
    }
    accountId = {
      S = local.platform_id
    }
    accountName = {
      S = local.default_account_name
    }
    email = {
      S = local.platform_admin_email
    }
    status = {
      S = "ACTIVE"
    }
    subscriptionTier = {
      S = local.default_subscription_tier
    }
    createdAt = {
      S = local.current_timestamp
    }
    updatedAt = {
      S = local.current_timestamp
    }
    created_by = {
      S = "terraform"
    }
  })

  # Ensure the platform ID is generated first
  depends_on = [random_integer.platform_id]
}

# Create platform admin group
resource "aws_dynamodb_table_item" "platform_admin_group" {
  table_name = var.rbac_table_name
  hash_key   = var.rbac_table_hash_key
  range_key  = var.rbac_table_range_key

  item = jsonencode({
    PK = {
      S = "ACCOUNT#${local.platform_id}"
    }
    SK = {
      S = "GROUP#${random_uuid.platform_admin_group_id.result}"
    }
    entityType = {
      S = "GROUP"
    }
    accountId = {
      S = local.platform_id
    }
    groupId = {
      S = random_uuid.platform_admin_group_id.result
    }
    name = {
      S = "platform-admin"
    }
    description = {
      S = "Platform administrator group with infrastructure and platform admin management capabilities"
    }
    status = {
      S = "ACTIVE"
    }
    createdAt = {
      S = local.current_timestamp
    }
    updatedAt = {
      S = local.current_timestamp
    }
  })
}

# Create account-admin group
resource "aws_dynamodb_table_item" "account_admin_group" {
  table_name = var.rbac_table_name
  hash_key   = var.rbac_table_hash_key
  range_key  = var.rbac_table_range_key

  item = jsonencode({
    PK = {
      S = "ACCOUNT#${local.platform_id}"
    }
    SK = {
      S = "GROUP#${random_uuid.account_admin_group_id.result}"
    }
    entityType = {
      S = "GROUP"
    }
    accountId = {
      S = local.platform_id
    }
    groupId = {
      S = random_uuid.account_admin_group_id.result
    }
    name = {
      S = "account-admin"
    }
    description = {
      S = "Account administrator group for user, role, and permission management capabilities"
    }
    status = {
      S = "ACTIVE"
    }
    createdAt = {
      S = local.current_timestamp
    }
    updatedAt = {
      S = local.current_timestamp
    }
  })
}

# Create infra-manager role
resource "aws_dynamodb_table_item" "infra_manager_role" {
  table_name = var.rbac_table_name
  hash_key   = var.rbac_table_hash_key
  range_key  = var.rbac_table_range_key

  item = jsonencode({
    PK = {
      S = "ACCOUNT#${local.platform_id}"
    }
    SK = {
      S = "ROLE#${random_uuid.infra_manager_role_id.result}"
    }
    entityType = {
      S = "ROLE"
    }
    accountId = {
      S = local.platform_id
    }
    roleId = {
      S = random_uuid.infra_manager_role_id.result
    }
    name = {
      S = "infra-manager"
    }
    description = {
      S = "Infrastructure management role for account onboarding, suspension, resumption, and offboarding"
    }
    status = {
      S = "ACTIVE"
    }
    permissions = {
      L = []
    }
    createdAt = {
      S = local.current_timestamp
    }
    updatedAt = {
      S = local.current_timestamp
    }
  })
}

# Create platform-admin-manager role
resource "aws_dynamodb_table_item" "platform_admin_manager_role" {
  table_name = var.rbac_table_name
  hash_key   = var.rbac_table_hash_key
  range_key  = var.rbac_table_range_key

  item = jsonencode({
    PK = {
      S = "ACCOUNT#${local.platform_id}"
    }
    SK = {
      S = "ROLE#${random_uuid.platform_admin_manager_role_id.result}"
    }
    entityType = {
      S = "ROLE"
    }
    accountId = {
      S = local.platform_id
    }
    roleId = {
      S = random_uuid.platform_admin_manager_role_id.result
    }
    name = {
      S = "platform-admin-manager"
    }
    description = {
      S = "Platform administrator management role for creating, updating, and managing platform admins"
    }
    status = {
      S = "ACTIVE"
    }
    permissions = {
      L = []
    }
    createdAt = {
      S = local.current_timestamp
    }
    updatedAt = {
      S = local.current_timestamp
    }
  })
}

# Create account-admin-manager role
resource "aws_dynamodb_table_item" "account_admin_manager_role" {
  table_name = var.rbac_table_name
  hash_key   = var.rbac_table_hash_key
  range_key  = var.rbac_table_range_key

  item = jsonencode({
    PK = {
      S = "ACCOUNT#${local.platform_id}"
    }
    SK = {
      S = "ROLE#${random_uuid.account_admin_manager_role_id.result}"
    }
    entityType = {
      S = "ROLE"
    }
    accountId = {
      S = local.platform_id
    }
    roleId = {
      S = random_uuid.account_admin_manager_role_id.result
    }
    name = {
      S = "account-admin-manager"
    }
    description = {
      S = "Account administrator management role for creating, updating, and managing account admins"
    }
    status = {
      S = "ACTIVE"
    }
    permissions = {
      L = []
    }
    createdAt = {
      S = local.current_timestamp
    }
    updatedAt = {
      S = local.current_timestamp
    }
  })
}

# Create user-manager role
resource "aws_dynamodb_table_item" "user_manager_role" {
  table_name = var.rbac_table_name
  hash_key   = var.rbac_table_hash_key
  range_key  = var.rbac_table_range_key

  item = jsonencode({
    PK = {
      S = "ACCOUNT#${local.platform_id}"
    }
    SK = {
      S = "ROLE#${random_uuid.user_manager_role_id.result}"
    }
    entityType = {
      S = "ROLE"
    }
    accountId = {
      S = local.platform_id
    }
    roleId = {
      S = random_uuid.user_manager_role_id.result
    }
    name = {
      S = "user-manager"
    }
    description = {
      S = "User management role for creating, updating, suspending, and managing users"
    }
    status = {
      S = "ACTIVE"
    }
    permissions = {
      L = []
    }
    createdAt = {
      S = local.current_timestamp
    }
    updatedAt = {
      S = local.current_timestamp
    }
  })
}

# Create user-group-manager role
resource "aws_dynamodb_table_item" "user_group_manager_role" {
  table_name = var.rbac_table_name
  hash_key   = var.rbac_table_hash_key
  range_key  = var.rbac_table_range_key

  item = jsonencode({
    PK = {
      S = "ACCOUNT#${local.platform_id}"
    }
    SK = {
      S = "ROLE#${random_uuid.user_group_manager_role_id.result}"
    }
    entityType = {
      S = "ROLE"
    }
    accountId = {
      S = local.platform_id
    }
    roleId = {
      S = random_uuid.user_group_manager_role_id.result
    }
    name = {
      S = "user-group-manager"
    }
    description = {
      S = "User group management role for creating, updating, and assigning user groups"
    }
    status = {
      S = "ACTIVE"
    }
    permissions = {
      L = []
    }
    createdAt = {
      S = local.current_timestamp
    }
    updatedAt = {
      S = local.current_timestamp
    }
  })
}

# Create user-role-manager role
resource "aws_dynamodb_table_item" "user_role_manager_role" {
  table_name = var.rbac_table_name
  hash_key   = var.rbac_table_hash_key
  range_key  = var.rbac_table_range_key

  item = jsonencode({
    PK = {
      S = "ACCOUNT#${local.platform_id}"
    }
    SK = {
      S = "ROLE#${random_uuid.user_role_manager_role_id.result}"
    }
    entityType = {
      S = "ROLE"
    }
    accountId = {
      S = local.platform_id
    }
    roleId = {
      S = random_uuid.user_role_manager_role_id.result
    }
    name = {
      S = "user-role-manager"
    }
    description = {
      S = "User role management role for creating, updating, and assigning user roles"
    }
    status = {
      S = "ACTIVE"
    }
    permissions = {
      L = []
    }
    createdAt = {
      S = local.current_timestamp
    }
    updatedAt = {
      S = local.current_timestamp
    }
  })
}

# Create user-permission-manager role
resource "aws_dynamodb_table_item" "user_permission_manager_role" {
  table_name = var.rbac_table_name
  hash_key   = var.rbac_table_hash_key
  range_key  = var.rbac_table_range_key

  item = jsonencode({
    PK = {
      S = "ACCOUNT#${local.platform_id}"
    }
    SK = {
      S = "ROLE#${random_uuid.user_permission_manager_role_id.result}"
    }
    entityType = {
      S = "ROLE"
    }
    accountId = {
      S = local.platform_id
    }
    roleId = {
      S = random_uuid.user_permission_manager_role_id.result
    }
    name = {
      S = "user-permission-manager"
    }
    description = {
      S = "User permission management role for creating, updating, and assigning user permissions"
    }
    status = {
      S = "ACTIVE"
    }
    permissions = {
      L = []
    }
    createdAt = {
      S = local.current_timestamp
    }
    updatedAt = {
      S = local.current_timestamp
    }
  })
}

# Create permissions
resource "aws_dynamodb_table_item" "permissions" {
  for_each = {
    # Infrastructure management permissions (4)
    "onboard-account" = {
      description = "Permission to onboard new accounts to the platform"
      resource    = "account"
      action      = "onboard"
    }
    "suspend-account" = {
      description = "Permission to suspend account access"
      resource    = "account"
      action      = "suspend"
    }
    "resume-account" = {
      description = "Permission to resume account access"
      resource    = "account"
      action      = "resume"
    }
    "offboard-account" = {
      description = "Permission to offboard accounts from the platform"
      resource    = "account"
      action      = "offboard"
    }
    # Platform admin management permissions (6)
    "create-platform-admin" = {
      description = "Permission to create platform administrators"
      resource    = "platform-admin"
      action      = "create"
    }
    "get-platform-admin" = {
      description = "Permission to retrieve platform administrators"
      resource    = "platform-admin"
      action      = "get"
    }
    "update-platform-admin" = {
      description = "Permission to update platform administrators"
      resource    = "platform-admin"
      action      = "update"
    }
    "delete-platform-admin" = {
      description = "Permission to delete platform administrators"
      resource    = "platform-admin"
      action      = "delete"
    }
    "resume-platform-admin" = {
      description = "Permission to resume platform administrators"
      resource    = "platform-admin"
      action      = "resume"
    }
    "suspend-platform-admin" = {
      description = "Permission to suspend platform administrators"
      resource    = "platform-admin"
      action      = "suspend"
    }
    # Account admin management permissions (5)
    "create-account-admin" = {
      description = "Permission to create account administrators"
      resource    = "account-admin"
      action      = "create"
    }
    "update-account-admin" = {
      description = "Permission to update account administrators"
      resource    = "account-admin"
      action      = "update"
    }
    "delete-account-admin" = {
      description = "Permission to delete account administrators"
      resource    = "account-admin"
      action      = "delete"
    }
    "suspend-account-admin" = {
      description = "Permission to suspend account administrators"
      resource    = "account-admin"
      action      = "suspend"
    }
    "resume-account-admin" = {
      description = "Permission to resume account administrators"
      resource    = "account-admin"
      action      = "resume"
    }
    # User management permissions (6)
    "create-user" = {
      description = "Permission to create users"
      resource    = "user"
      action      = "create"
    }
    "update-user" = {
      description = "Permission to update users"
      resource    = "user"
      action      = "update"
    }
    "get-user" = {
      description = "Permission to retrieve users"
      resource    = "user"
      action      = "get"
    }
    "delete-user" = {
      description = "Permission to delete users"
      resource    = "user"
      action      = "delete"
    }
    "resume-user" = {
      description = "Permission to resume users"
      resource    = "user"
      action      = "resume"
    }
    "suspend-user" = {
      description = "Permission to suspend users"
      resource    = "user"
      action      = "suspend"
    }
    # User group management permissions (5)
    "create-user-group" = {
      description = "Permission to create user groups"
      resource    = "user-group"
      action      = "create"
    }
    "get-user-group" = {
      description = "Permission to retrieve user groups"
      resource    = "user-group"
      action      = "get"
    }
    "delete-user-group" = {
      description = "Permission to delete user groups"
      resource    = "user-group"
      action      = "delete"
    }
    "update-user-group" = {
      description = "Permission to update user groups"
      resource    = "user-group"
      action      = "update"
    }
    "assign-user-group" = {
      description = "Permission to assign user groups"
      resource    = "user-group"
      action      = "assign"
    }
    # User role management permissions (5)
    "create-user-role" = {
      description = "Permission to create user roles"
      resource    = "user-role"
      action      = "create"
    }
    "get-user-role" = {
      description = "Permission to retrieve user roles"
      resource    = "user-role"
      action      = "get"
    }
    "delete-user-role" = {
      description = "Permission to delete user roles"
      resource    = "user-role"
      action      = "delete"
    }
    "update-user-role" = {
      description = "Permission to update user roles"
      resource    = "user-role"
      action      = "update"
    }
    "assign-user-role" = {
      description = "Permission to assign user roles"
      resource    = "user-role"
      action      = "assign"
    }
    # User permission management permissions (5)
    "create-user-permission" = {
      description = "Permission to create user permissions"
      resource    = "user-permission"
      action      = "create"
    }
    "get-account-permission" = {
      description = "Permission to retrieve account permissions"
      resource    = "account-permission"
      action      = "get"
    }
    "delete-account-permission" = {
      description = "Permission to delete account permissions"
      resource    = "account-permission"
      action      = "delete"
    }
    "update-account-permission" = {
      description = "Permission to update account permissions"
      resource    = "account-permission"
      action      = "update"
    }
    "assign-permission-assign" = {
      description = "Permission to assign permission assignments"
      resource    = "permission"
      action      = "assign"
    }
  }

  table_name = var.rbac_table_name
  hash_key   = var.rbac_table_hash_key
  range_key  = var.rbac_table_range_key

  item = jsonencode({
    PK = {
      S = "ACCOUNT#${local.platform_id}"
    }
    SK = {
      S = "PERMISSION#${random_uuid.permission_ids[each.key].result}"
    }
    entityType = {
      S = "PERMISSION"
    }
    accountId = {
      S = local.platform_id
    }
    permissionId = {
      S = random_uuid.permission_ids[each.key].result
    }
    name = {
      S = each.key
    }
    description = {
      S = each.value.description
    }
    resource = {
      S = each.value.resource
    }
    action = {
      S = each.value.action
    }
    status = {
      S = "ACTIVE"
    }
    createdAt = {
      S = local.current_timestamp
    }
    updatedAt = {
      S = local.current_timestamp
    }
  })
}

# Create user profile in DynamoDB
resource "aws_dynamodb_table_item" "platform_admin_user" {
  table_name = var.rbac_table_name
  hash_key   = var.rbac_table_hash_key
  range_key  = var.rbac_table_range_key

  item = jsonencode({
    PK = {
      S = "ACCOUNT#${local.platform_id}"
    }
    SK = {
      S = "USER#${aws_cognito_user.platform_admin.sub}"
    }
    entityType = {
      S = "USER"
    }
    accountId = {
      S = local.platform_id
    }
    userId = {
      S = aws_cognito_user.platform_admin.sub
    }
    email = {
      S = local.platform_admin_email
    }
    firstName = {
      S = local.platform_admin_first_name
    }
    lastName = {
      S = local.platform_admin_last_name
    }
    status = {
      S = "ACTIVE"
    }
    cognito_username = {
      S = local.platform_admin_username
    }
    cognito_sub = {
      S = aws_cognito_user.platform_admin.sub
    }
    password_status = {
      S = "TEMP_PASSWORD"
    }
    first_login_completed = {
      BOOL = false
    }
    metadata = {
      M = {}
    }
    created_by = {
      S = "terraform"
    }
    createdAt = {
      S = local.current_timestamp
    }
    updatedAt = {
      S = local.current_timestamp
    }
  })
}

# ==============================================
# Group-Role Mappings (Bidirectional)
# ==============================================

# Group -> Roles mappings (platform-admin group to roles)
resource "aws_dynamodb_table_item" "platform_admin_group_role_mappings" {
  for_each = toset(["infra-manager", "platform-admin-manager", "account-admin-manager"])

  table_name = var.rbac_table_name
  hash_key   = var.rbac_table_hash_key
  range_key  = var.rbac_table_range_key

  item = jsonencode({
    PK = {
      S = "GROUP#${local.platform_id}#${random_uuid.platform_admin_group_id.result}#ROLES"
    }
    SK = {
      S = "ROLE#${each.value == "infra-manager" ? random_uuid.infra_manager_role_id.result : (each.value == "platform-admin-manager" ? random_uuid.platform_admin_manager_role_id.result : random_uuid.account_admin_manager_role_id.result)}"
    }
    entityType = {
      S = "GROUP_ROLE_MEMBERSHIP"
    }
    accountId = {
      S = local.platform_id
    }
    groupId = {
      S = random_uuid.platform_admin_group_id.result
    }
    roleId = {
      S = each.value == "infra-manager" ? random_uuid.infra_manager_role_id.result : (each.value == "platform-admin-manager" ? random_uuid.platform_admin_manager_role_id.result : random_uuid.account_admin_manager_role_id.result)
    }
    createdAt = {
      S = local.current_timestamp
    }
  })
}

# Account-admin group -> roles mapping
resource "aws_dynamodb_table_item" "account_admin_group_role_mappings" {
  for_each = toset(["user-manager", "user-group-manager", "user-role-manager", "user-permission-manager"])

  table_name = var.rbac_table_name
  hash_key   = var.rbac_table_hash_key
  range_key  = var.rbac_table_range_key

  item = jsonencode({
    PK = {
      S = "GROUP#${local.platform_id}#${random_uuid.account_admin_group_id.result}#ROLES"
    }
    SK = {
      S = "ROLE#${each.value == "user-manager" ? random_uuid.user_manager_role_id.result : (each.value == "user-group-manager" ? random_uuid.user_group_manager_role_id.result : (each.value == "user-role-manager" ? random_uuid.user_role_manager_role_id.result : random_uuid.user_permission_manager_role_id.result))}"
    }
    entityType = {
      S = "GROUP_ROLE_MEMBERSHIP"
    }
    accountId = {
      S = local.platform_id
    }
    groupId = {
      S = random_uuid.account_admin_group_id.result
    }
    roleId = {
      S = each.value == "user-manager" ? random_uuid.user_manager_role_id.result : (each.value == "user-group-manager" ? random_uuid.user_group_manager_role_id.result : (each.value == "user-role-manager" ? random_uuid.user_role_manager_role_id.result : random_uuid.user_permission_manager_role_id.result))
    }
    createdAt = {
      S = local.current_timestamp
    }
  })
}

# Role -> Groups mappings (roles to platform-admin group)
resource "aws_dynamodb_table_item" "platform_admin_role_group_mappings" {
  for_each = toset(["infra-manager", "platform-admin-manager", "account-admin-manager"])

  table_name = var.rbac_table_name
  hash_key   = var.rbac_table_hash_key
  range_key  = var.rbac_table_range_key

  item = jsonencode({
    PK = {
      S = "ROLE#${local.platform_id}#${each.value == "infra-manager" ? random_uuid.infra_manager_role_id.result : (each.value == "platform-admin-manager" ? random_uuid.platform_admin_manager_role_id.result : random_uuid.account_admin_manager_role_id.result)}#GROUPS"
    }
    SK = {
      S = "GROUP#${random_uuid.platform_admin_group_id.result}"
    }
    entityType = {
      S = "ROLE_GROUP_MEMBERSHIP"
    }
    accountId = {
      S = local.platform_id
    }
    roleId = {
      S = each.value == "infra-manager" ? random_uuid.infra_manager_role_id.result : (each.value == "platform-admin-manager" ? random_uuid.platform_admin_manager_role_id.result : random_uuid.account_admin_manager_role_id.result)
    }
    groupId = {
      S = random_uuid.platform_admin_group_id.result
    }
    createdAt = {
      S = local.current_timestamp
    }
  })
}

# Roles -> account-admin group mappings
resource "aws_dynamodb_table_item" "account_admin_role_group_mappings" {
  for_each = toset(["user-manager", "user-group-manager", "user-role-manager", "user-permission-manager"])

  table_name = var.rbac_table_name
  hash_key   = var.rbac_table_hash_key
  range_key  = var.rbac_table_range_key

  item = jsonencode({
    PK = {
      S = "ROLE#${local.platform_id}#${each.value == "user-manager" ? random_uuid.user_manager_role_id.result : (each.value == "user-group-manager" ? random_uuid.user_group_manager_role_id.result : (each.value == "user-role-manager" ? random_uuid.user_role_manager_role_id.result : random_uuid.user_permission_manager_role_id.result))}#GROUPS"
    }
    SK = {
      S = "GROUP#${random_uuid.account_admin_group_id.result}"
    }
    entityType = {
      S = "ROLE_GROUP_MEMBERSHIP"
    }
    accountId = {
      S = local.platform_id
    }
    roleId = {
      S = each.value == "user-manager" ? random_uuid.user_manager_role_id.result : (each.value == "user-group-manager" ? random_uuid.user_group_manager_role_id.result : (each.value == "user-role-manager" ? random_uuid.user_role_manager_role_id.result : random_uuid.user_permission_manager_role_id.result))
    }
    groupId = {
      S = random_uuid.account_admin_group_id.result
    }
    createdAt = {
      S = local.current_timestamp
    }
  })
}

# ==============================================
# Role-Permission Mappings (Bidirectional)
# ==============================================

locals {
  role_permissions = {
    "infra-manager" = [
      "onboard-account",
      "suspend-account",
      "resume-account",
      "offboard-account"
    ]
    "platform-admin-manager" = [
      "create-platform-admin",
      "get-platform-admin",
      "update-platform-admin",
      "delete-platform-admin",
      "resume-platform-admin",
      "suspend-platform-admin"
    ]
    "account-admin-manager" = [
      "create-account-admin",
      "update-account-admin",
      "delete-account-admin",
      "suspend-account-admin",
      "resume-account-admin"
    ]
    "user-manager" = [
      "create-user",
      "update-user",
      "get-user",
      "delete-user",
      "resume-user",
      "suspend-user"
    ]
    "user-group-manager" = [
      "create-user-group",
      "get-user-group",
      "delete-user-group",
      "update-user-group",
      "assign-user-group"
    ]
    "user-role-manager" = [
      "create-user-role",
      "get-user-role",
      "delete-user-role",
      "update-user-role",
      "assign-user-role"
    ]
    "user-permission-manager" = [
      "create-user-permission",
      "get-account-permission",
      "delete-account-permission",
      "update-account-permission",
      "assign-permission-assign"
    ]
  }
}

# Role -> Permissions mappings
resource "aws_dynamodb_table_item" "role_permission_mappings" {
  for_each = {
    for item in flatten([
      for role, permissions in local.role_permissions : [
        for permission in permissions : {
          role       = role
          permission = permission
          role_id = (
            role == "infra-manager" ? random_uuid.infra_manager_role_id.result :
            role == "platform-admin-manager" ? random_uuid.platform_admin_manager_role_id.result :
            role == "account-admin-manager" ? random_uuid.account_admin_manager_role_id.result :
            role == "user-manager" ? random_uuid.user_manager_role_id.result :
            role == "user-group-manager" ? random_uuid.user_group_manager_role_id.result :
            role == "user-role-manager" ? random_uuid.user_role_manager_role_id.result :
            random_uuid.user_permission_manager_role_id.result
          )
          permission_id = random_uuid.permission_ids[permission].result
        }
      ]
    ]) : "${item.role}-${item.permission}" => item
  }

  table_name = var.rbac_table_name
  hash_key   = var.rbac_table_hash_key
  range_key  = var.rbac_table_range_key

  item = jsonencode({
    PK = {
      S = "ROLE#${local.platform_id}#${each.value.role_id}#PERMISSIONS"
    }
    SK = {
      S = "PERMISSION#${each.value.permission_id}"
    }
    entityType = {
      S = "ROLE_PERMISSION_MEMBERSHIP"
    }
    accountId = {
      S = local.platform_id
    }
    roleId = {
      S = each.value.role_id
    }
    permissionId = {
      S = each.value.permission_id
    }
    createdAt = {
      S = local.current_timestamp
    }
  })
}

# Permission -> Roles mappings
resource "aws_dynamodb_table_item" "permission_role_mappings" {
  for_each = {
    for item in flatten([
      for role, permissions in local.role_permissions : [
        for permission in permissions : {
          role       = role
          permission = permission
          role_id = (
            role == "infra-manager" ? random_uuid.infra_manager_role_id.result :
            role == "platform-admin-manager" ? random_uuid.platform_admin_manager_role_id.result :
            role == "account-admin-manager" ? random_uuid.account_admin_manager_role_id.result :
            role == "user-manager" ? random_uuid.user_manager_role_id.result :
            role == "user-group-manager" ? random_uuid.user_group_manager_role_id.result :
            role == "user-role-manager" ? random_uuid.user_role_manager_role_id.result :
            random_uuid.user_permission_manager_role_id.result
          )
          permission_id = random_uuid.permission_ids[permission].result
        }
      ]
    ]) : "${item.permission}-${item.role}" => item
  }

  table_name = var.rbac_table_name
  hash_key   = var.rbac_table_hash_key
  range_key  = var.rbac_table_range_key

  item = jsonencode({
    PK = {
      S = "PERMISSION#${local.platform_id}#${each.value.permission_id}#ROLES"
    }
    SK = {
      S = "ROLE#${each.value.role_id}"
    }
    entityType = {
      S = "PERMISSION_ROLE_MEMBERSHIP"
    }
    accountId = {
      S = local.platform_id
    }
    permissionId = {
      S = each.value.permission_id
    }
    roleId = {
      S = each.value.role_id
    }
    createdAt = {
      S = local.current_timestamp
    }
  })
}

# ==============================================
# User-Group Assignment (Bidirectional)
# ==============================================

# User -> Group mapping (platform admin user to platform-admin group)
resource "aws_dynamodb_table_item" "user_group_mapping" {
  table_name = var.rbac_table_name
  hash_key   = var.rbac_table_hash_key
  range_key  = var.rbac_table_range_key

  item = jsonencode({
    PK = {
      S = "USER#${local.platform_id}#${aws_cognito_user.platform_admin.sub}#GROUPS"
    }
    SK = {
      S = "GROUP#${random_uuid.platform_admin_group_id.result}"
    }
    entityType = {
      S = "USER_GROUP_MEMBERSHIP"
    }
    accountId = {
      S = local.platform_id
    }
    userId = {
      S = aws_cognito_user.platform_admin.sub
    }
    groupId = {
      S = random_uuid.platform_admin_group_id.result
    }
    createdAt = {
      S = local.current_timestamp
    }
  })
}

# Group -> User mapping (platform-admin group to platform admin user)
resource "aws_dynamodb_table_item" "group_user_mapping" {
  table_name = var.rbac_table_name
  hash_key   = var.rbac_table_hash_key
  range_key  = var.rbac_table_range_key

  item = jsonencode({
    PK = {
      S = "GROUP#${local.platform_id}#${random_uuid.platform_admin_group_id.result}#USERS"
    }
    SK = {
      S = "USER#${aws_cognito_user.platform_admin.sub}"
    }
    entityType = {
      S = "GROUP_USER_MEMBERSHIP"
    }
    accountId = {
      S = local.platform_id
    }
    groupId = {
      S = random_uuid.platform_admin_group_id.result
    }
    userId = {
      S = aws_cognito_user.platform_admin.sub
    }
    createdAt = {
      S = local.current_timestamp
    }
  })
}
