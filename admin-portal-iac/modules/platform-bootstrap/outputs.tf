# Outputs for Platform Bootstrap module

output "platform_id" {
  description = "Generated 8-character platform ID"
  value       = local.platform_id
}

output "platform_admin_username" {
  description = "Username of the platform administrator"
  value       = local.platform_admin_username
}

output "platform_admin_password" {
  description = "Password of the platform administrator"
  value       = var.temporary_password
  sensitive   = true
}

output "platform_admin_email" {
  description = "Email of the platform administrator"
  value       = local.platform_admin_email
}

output "platform_admin_cognito_user_id" {
  description = "Cognito User ID (UUID) of the platform administrator"
  value       = aws_cognito_user.platform_admin.sub
}

output "platform_admin_credentials" {
  description = "Platform administrator login credentials"
  value = {
    username = local.platform_admin_username
    password = var.temporary_password
    email    = local.platform_admin_email
    user_id  = aws_cognito_user.platform_admin.sub
  }
  sensitive = true
}

# Generated UUIDs for entities
output "entity_uuids" {
  description = "Generated UUIDs for platform entities"
  value = {
    # Groups
    platform_admin_group_id = random_uuid.platform_admin_group_id.result
    account_admin_group_id = random_uuid.account_admin_group_id.result
    # Roles
    infra_manager_role_id = random_uuid.infra_manager_role_id.result
    platform_admin_manager_role_id = random_uuid.platform_admin_manager_role_id.result
    account_admin_manager_role_id = random_uuid.account_admin_manager_role_id.result
    user_manager_role_id = random_uuid.user_manager_role_id.result
    user_group_manager_role_id = random_uuid.user_group_manager_role_id.result
    user_role_manager_role_id = random_uuid.user_role_manager_role_id.result
    user_permission_manager_role_id = random_uuid.user_permission_manager_role_id.result
    # Permissions
    permission_ids = {
      for k, v in random_uuid.permission_ids : k => v.result
    }
  }
}

output "rbac_setup_summary" {
  description = "Summary of RBAC setup for platform admin"
  value = {
    groups_created = ["platform-admin", "super-admin"]
    roles_created  = ["account-gov", "account-super-admin", "account-admin"]
    permissions_created = [
      "account-onboarding",
      "account-suspension",
      "account-offboarding",
      "account-super-admin-create",
      "account-super-admin-update",
      "account-super-admin-delete",
      "account-super-admin-deactivate",
      "account-super-admin-reactivate",
      "account-user-create",
      "account-user-update",
      "account-user-get",
      "account-user-delete",
      "account-role-create",
      "account-role-get",
      "account-role-update",
      "account-role-delete",
      "account-role-assign",
      "account-permission-create",
      "account-permission-delete",
      "account-permission-update",
      "account-permission-get",
      "account-permission-assign"
    ]
    user_assigned_to_group = "platform-admin"
    access_pattern = "ACCOUNT#PLATFORM with UUID-based SKs"
    storage_approach = "Single-table design with proper access patterns"
    entity_types = ["USER", "GROUP", "ROLE", "PERMISSION"]
    relationship_types = ["USER_GROUP_MEMBERSHIP", "GROUP_ROLE_MEMBERSHIP", "ROLE_PERMISSION_MEMBERSHIP"]
  }
}

# Create Admin Worker Configuration Outputs
output "account_admin_group_id" {
  description = "UUID of the account-super-admin group for create-admin-worker"
  value       = random_uuid.account_admin_group_id.result
}

output "platform_account_id" {
  description = "Platform account ID for admin users"
  value       = local.platform_id
}

# ==============================================
# Systiva Default Account Outputs
# ==============================================

output "systiva_account_details" {
  description = "Systiva default account details created during bootstrap"
  value = {
    account_id             = local.platform_id
    account_name           = local.default_account_name
    master_account_name    = local.default_master_account_name
    cloud_type             = local.default_cloud_type
    subscription_tier      = local.default_subscription_tier
    admin_email            = local.platform_admin_email
    admin_username         = local.platform_admin_username
    address_id             = random_uuid.systiva_address_id.result
    technical_user_id      = random_uuid.systiva_technical_user_id.result
    license_id             = random_uuid.systiva_license_id.result
    license_start_date     = local.license_start_date
    license_end_date       = local.license_end_date
    assigned_group         = "platform-admin"
    assigned_role          = "infra-manager"
  }
}

output "systiva_address" {
  description = "Address details for Systiva account"
  value = {
    address_line1 = var.default_address_line1
    address_line2 = var.default_address_line2
    city          = var.default_city
    state         = var.default_state
    zip_code      = var.default_zip_code
    country       = var.default_country
  }
}

# ==============================================
# Default Enterprise Configuration Outputs
# ==============================================

output "default_enterprise_config" {
  description = "Default enterprise, product, service, and linkage IDs"
  value = {
    enterprise_id   = random_uuid.global_enterprise_id.result
    enterprise_name = "Global"
    product_id      = random_uuid.platform_product_id.result
    product_name    = "Platform"
    service_id      = random_uuid.all_services_service_id.result
    service_name    = "All Services"
    linkage_id      = random_uuid.enterprise_product_service_linkage_id.result
  }
}
