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
resource "random_password" "platform_admin_password" {
  length      = 16
  special     = true
  upper       = true
  lower       = true
  numeric     = true
  min_numeric = 1
  min_upper   = 1
  min_lower   = 1
  min_special = 1
}

# Generate unique 8-character platform ID
resource "random_integer" "platform_id" {
  min = 10000000  # 8-digit minimum
  max = 99999999  # 8-digit maximum
}

# Generate UUIDs for entities
resource "random_uuid" "platform_admin_group_id" {}
resource "random_uuid" "tenant_admin_group_id" {}
resource "random_uuid" "infra_manager_role_id" {}
resource "random_uuid" "platform_admin_manager_role_id" {}
resource "random_uuid" "tenant_admin_manager_role_id" {}
resource "random_uuid" "user_manager_role_id" {}
resource "random_uuid" "user_group_manager_role_id" {}
resource "random_uuid" "user_role_manager_role_id" {}
resource "random_uuid" "user_permission_manager_role_id" {}

# Generate UUIDs for permissions
resource "random_uuid" "permission_ids" {
  for_each = {
    # Infrastructure management permissions (4)
    "onboard-tenant" = {}
    "suspend-tenant" = {}
    "resume-tenant" = {}
    "offboard-tenant" = {}
    # Platform admin management permissions (6)
    "create-platform-admin" = {}
    "get-platform-admin" = {}
    "update-platform-admin" = {}
    "delete-platform-admin" = {}
    "resume-platform-admin" = {}
    "suspend-platform-admin" = {}
    # Tenant admin management permissions (5)
    "create-tenant-admin" = {}
    "update-tenant-admin" = {}
    "delete-tenant-admin" = {}
    "suspend-tenant-admin" = {}
    "resume-tenant-admin" = {}
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
    "get-tenant-permission" = {}
    "delete-tenant-permission" = {}
    "update-tenant-permission" = {}
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
}

# ==============================================
# Cognito User Creation
# ==============================================

# Create platform admin user in Cognito
resource "aws_cognito_user" "platform_admin" {
  user_pool_id = var.user_pool_id
  username     = local.platform_admin_username
  
  attributes = {
    email              = local.platform_admin_email
    email_verified     = "true"
    "custom:tenant_id" = local.platform_id
  }
  
  # Set temporary password initially
  temporary_password = random_password.platform_admin_password.result
  message_action     = "SUPPRESS"  # Don't send welcome email
  
  # Ensure the platform ID is generated first
  depends_on = [random_integer.platform_id]
}

# ==============================================
# DynamoDB RBAC Entries
# ==============================================

# Create platform tenant entity
resource "aws_dynamodb_table_item" "platform_tenant" {
  table_name = var.rbac_table_name
  hash_key   = var.rbac_table_hash_key
  range_key  = var.rbac_table_range_key
  
  item = jsonencode({
    PK = {
      S = "TENANT#${local.platform_id}"
    }
    SK = {
      S = "METADATA"
    }
    entityType = {
      S = "TENANT"
    }
    tenantId = {
      S = local.platform_id
    }
    tenantName = {
      S = "Platform"
    }
    email = {
      S = local.platform_admin_email
    }
    status = {
      S = "ACTIVE"
    }
    subscriptionTier = {
      S = "platform"
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
      S = "TENANT#${local.platform_id}"
    }
    SK = {
      S = "GROUP#${random_uuid.platform_admin_group_id.result}"
    }
    entityType = {
      S = "GROUP"
    }
    tenantId = {
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

# Create tenant-admin group
resource "aws_dynamodb_table_item" "tenant_admin_group" {
  table_name = var.rbac_table_name
  hash_key   = var.rbac_table_hash_key
  range_key  = var.rbac_table_range_key
  
  item = jsonencode({
    PK = {
      S = "TENANT#${local.platform_id}"
    }
    SK = {
      S = "GROUP#${random_uuid.tenant_admin_group_id.result}"
    }
    entityType = {
      S = "GROUP"
    }
    tenantId = {
      S = local.platform_id
    }
    groupId = {
      S = random_uuid.tenant_admin_group_id.result
    }
    name = {
      S = "tenant-admin"
    }
    description = {
      S = "Tenant administrator group for user, role, and permission management capabilities"
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
      S = "TENANT#${local.platform_id}"
    }
    SK = {
      S = "ROLE#${random_uuid.infra_manager_role_id.result}"
    }
    entityType = {
      S = "ROLE"
    }
    tenantId = {
      S = local.platform_id
    }
    roleId = {
      S = random_uuid.infra_manager_role_id.result
    }
    name = {
      S = "infra-manager"
    }
    description = {
      S = "Infrastructure management role for tenant onboarding, suspension, resumption, and offboarding"
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
      S = "TENANT#${local.platform_id}"
    }
    SK = {
      S = "ROLE#${random_uuid.platform_admin_manager_role_id.result}"
    }
    entityType = {
      S = "ROLE"
    }
    tenantId = {
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

# Create tenant-admin-manager role
resource "aws_dynamodb_table_item" "tenant_admin_manager_role" {
  table_name = var.rbac_table_name
  hash_key   = var.rbac_table_hash_key
  range_key  = var.rbac_table_range_key
  
  item = jsonencode({
    PK = {
      S = "TENANT#${local.platform_id}"
    }
    SK = {
      S = "ROLE#${random_uuid.tenant_admin_manager_role_id.result}"
    }
    entityType = {
      S = "ROLE"
    }
    tenantId = {
      S = local.platform_id
    }
    roleId = {
      S = random_uuid.tenant_admin_manager_role_id.result
    }
    name = {
      S = "tenant-admin-manager"
    }
    description = {
      S = "Tenant administrator management role for creating, updating, and managing tenant admins"
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
      S = "TENANT#${local.platform_id}"
    }
    SK = {
      S = "ROLE#${random_uuid.user_manager_role_id.result}"
    }
    entityType = {
      S = "ROLE"
    }
    tenantId = {
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
      S = "TENANT#${local.platform_id}"
    }
    SK = {
      S = "ROLE#${random_uuid.user_group_manager_role_id.result}"
    }
    entityType = {
      S = "ROLE"
    }
    tenantId = {
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
      S = "TENANT#${local.platform_id}"
    }
    SK = {
      S = "ROLE#${random_uuid.user_role_manager_role_id.result}"
    }
    entityType = {
      S = "ROLE"
    }
    tenantId = {
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
      S = "TENANT#${local.platform_id}"
    }
    SK = {
      S = "ROLE#${random_uuid.user_permission_manager_role_id.result}"
    }
    entityType = {
      S = "ROLE"
    }
    tenantId = {
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
    "onboard-tenant" = {
      description = "Permission to onboard new tenants to the platform"
      resource    = "tenant"
      action      = "onboard"
    }
    "suspend-tenant" = {
      description = "Permission to suspend tenant access"
      resource    = "tenant"
      action      = "suspend"
    }
    "resume-tenant" = {
      description = "Permission to resume tenant access"
      resource    = "tenant"
      action      = "resume"
    }
    "offboard-tenant" = {
      description = "Permission to offboard tenants from the platform"
      resource    = "tenant"
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
    # Tenant admin management permissions (5)
    "create-tenant-admin" = {
      description = "Permission to create tenant administrators"
      resource    = "tenant-admin"
      action      = "create"
    }
    "update-tenant-admin" = {
      description = "Permission to update tenant administrators"
      resource    = "tenant-admin"
      action      = "update"
    }
    "delete-tenant-admin" = {
      description = "Permission to delete tenant administrators"
      resource    = "tenant-admin"
      action      = "delete"
    }
    "suspend-tenant-admin" = {
      description = "Permission to suspend tenant administrators"
      resource    = "tenant-admin"
      action      = "suspend"
    }
    "resume-tenant-admin" = {
      description = "Permission to resume tenant administrators"
      resource    = "tenant-admin"
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
    "get-tenant-permission" = {
      description = "Permission to retrieve tenant permissions"
      resource    = "tenant-permission"
      action      = "get"
    }
    "delete-tenant-permission" = {
      description = "Permission to delete tenant permissions"
      resource    = "tenant-permission"
      action      = "delete"
    }
    "update-tenant-permission" = {
      description = "Permission to update tenant permissions"
      resource    = "tenant-permission"
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
      S = "TENANT#${local.platform_id}"
    }
    SK = {
      S = "PERMISSION#${random_uuid.permission_ids[each.key].result}"
    }
    entityType = {
      S = "PERMISSION"
    }
    tenantId = {
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
      S = "TENANT#${local.platform_id}"
    }
    SK = {
      S = "USER#${aws_cognito_user.platform_admin.sub}"
    }
    entityType = {
      S = "USER"
    }
    tenantId = {
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
  for_each = toset(["infra-manager", "platform-admin-manager", "tenant-admin-manager"])
  
  table_name = var.rbac_table_name
  hash_key   = var.rbac_table_hash_key
  range_key  = var.rbac_table_range_key
  
  item = jsonencode({
    PK = {
      S = "GROUP#${local.platform_id}#${random_uuid.platform_admin_group_id.result}#ROLES"
    }
    SK = {
      S = "ROLE#${each.value == "infra-manager" ? random_uuid.infra_manager_role_id.result : (each.value == "platform-admin-manager" ? random_uuid.platform_admin_manager_role_id.result : random_uuid.tenant_admin_manager_role_id.result)}"
    }
    entityType = {
      S = "GROUP_ROLE_MEMBERSHIP"
    }
    tenantId = {
      S = local.platform_id
    }
    groupId = {
      S = random_uuid.platform_admin_group_id.result
    }
    roleId = {
      S = each.value == "infra-manager" ? random_uuid.infra_manager_role_id.result : (each.value == "platform-admin-manager" ? random_uuid.platform_admin_manager_role_id.result : random_uuid.tenant_admin_manager_role_id.result)
    }
    createdAt = {
      S = local.current_timestamp
    }
  })
}

# Tenant-admin group -> roles mapping
resource "aws_dynamodb_table_item" "tenant_admin_group_role_mappings" {
  for_each = toset(["user-manager", "user-group-manager", "user-role-manager", "user-permission-manager"])
  
  table_name = var.rbac_table_name
  hash_key   = var.rbac_table_hash_key
  range_key  = var.rbac_table_range_key
  
  item = jsonencode({
    PK = {
      S = "GROUP#${local.platform_id}#${random_uuid.tenant_admin_group_id.result}#ROLES"
    }
    SK = {
      S = "ROLE#${each.value == "user-manager" ? random_uuid.user_manager_role_id.result : (each.value == "user-group-manager" ? random_uuid.user_group_manager_role_id.result : (each.value == "user-role-manager" ? random_uuid.user_role_manager_role_id.result : random_uuid.user_permission_manager_role_id.result))}"
    }
    entityType = {
      S = "GROUP_ROLE_MEMBERSHIP"
    }
    tenantId = {
      S = local.platform_id
    }
    groupId = {
      S = random_uuid.tenant_admin_group_id.result
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
  for_each = toset(["infra-manager", "platform-admin-manager", "tenant-admin-manager"])
  
  table_name = var.rbac_table_name
  hash_key   = var.rbac_table_hash_key
  range_key  = var.rbac_table_range_key
  
  item = jsonencode({
    PK = {
      S = "ROLE#${local.platform_id}#${each.value == "infra-manager" ? random_uuid.infra_manager_role_id.result : (each.value == "platform-admin-manager" ? random_uuid.platform_admin_manager_role_id.result : random_uuid.tenant_admin_manager_role_id.result)}#GROUPS"
    }
    SK = {
      S = "GROUP#${random_uuid.platform_admin_group_id.result}"
    }
    entityType = {
      S = "ROLE_GROUP_MEMBERSHIP"
    }
    tenantId = {
      S = local.platform_id
    }
    roleId = {
      S = each.value == "infra-manager" ? random_uuid.infra_manager_role_id.result : (each.value == "platform-admin-manager" ? random_uuid.platform_admin_manager_role_id.result : random_uuid.tenant_admin_manager_role_id.result)
    }
    groupId = {
      S = random_uuid.platform_admin_group_id.result
    }
    createdAt = {
      S = local.current_timestamp
    }
  })
}

# Roles -> tenant-admin group mappings
resource "aws_dynamodb_table_item" "tenant_admin_role_group_mappings" {
  for_each = toset(["user-manager", "user-group-manager", "user-role-manager", "user-permission-manager"])
  
  table_name = var.rbac_table_name
  hash_key   = var.rbac_table_hash_key
  range_key  = var.rbac_table_range_key
  
  item = jsonencode({
    PK = {
      S = "ROLE#${local.platform_id}#${each.value == "user-manager" ? random_uuid.user_manager_role_id.result : (each.value == "user-group-manager" ? random_uuid.user_group_manager_role_id.result : (each.value == "user-role-manager" ? random_uuid.user_role_manager_role_id.result : random_uuid.user_permission_manager_role_id.result))}#GROUPS"
    }
    SK = {
      S = "GROUP#${random_uuid.tenant_admin_group_id.result}"
    }
    entityType = {
      S = "ROLE_GROUP_MEMBERSHIP"
    }
    tenantId = {
      S = local.platform_id
    }
    roleId = {
      S = each.value == "user-manager" ? random_uuid.user_manager_role_id.result : (each.value == "user-group-manager" ? random_uuid.user_group_manager_role_id.result : (each.value == "user-role-manager" ? random_uuid.user_role_manager_role_id.result : random_uuid.user_permission_manager_role_id.result))
    }
    groupId = {
      S = random_uuid.tenant_admin_group_id.result
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
      "onboard-tenant",
      "suspend-tenant",
      "resume-tenant",
      "offboard-tenant"
    ]
    "platform-admin-manager" = [
      "create-platform-admin",
      "get-platform-admin",
      "update-platform-admin",
      "delete-platform-admin",
      "resume-platform-admin",
      "suspend-platform-admin"
    ]
    "tenant-admin-manager" = [
      "create-tenant-admin",
      "update-tenant-admin",
      "delete-tenant-admin",
      "suspend-tenant-admin",
      "resume-tenant-admin"
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
      "get-tenant-permission",
      "delete-tenant-permission",
      "update-tenant-permission",
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
            role == "tenant-admin-manager" ? random_uuid.tenant_admin_manager_role_id.result :
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
    tenantId = {
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
            role == "tenant-admin-manager" ? random_uuid.tenant_admin_manager_role_id.result :
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
    tenantId = {
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
    tenantId = {
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
    tenantId = {
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
