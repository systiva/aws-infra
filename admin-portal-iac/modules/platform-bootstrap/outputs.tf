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
  value       = random_password.platform_admin_password.result
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
    password = random_password.platform_admin_password.result
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
    tenant_admin_group_id = random_uuid.tenant_admin_group_id.result
    # Roles
    infra_manager_role_id = random_uuid.infra_manager_role_id.result
    platform_admin_manager_role_id = random_uuid.platform_admin_manager_role_id.result
    tenant_admin_manager_role_id = random_uuid.tenant_admin_manager_role_id.result
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
    roles_created  = ["tenant-gov", "tenant-super-admin", "tenant-admin"]
    permissions_created = [
      "tenant-onboarding",
      "tenant-suspension", 
      "tenant-offboarding",
      "tenant-super-admin-create",
      "tenant-super-admin-update",
      "tenant-super-admin-delete",
      "tenant-super-admin-deactivate",
      "tenant-super-admin-reactivate",
      "tenant-user-create",
      "tenant-user-update",
      "tenant-user-get",
      "tenant-user-delete",
      "tenant-role-create",
      "tenant-role-get",
      "tenant-role-update",
      "tenant-role-delete",
      "tenant-role-assign",
      "tenant-permission-create",
      "tenant-permission-delete",
      "tenant-permission-update",
      "tenant-permission-get",
      "tenant-permission-assign"
    ]
    user_assigned_to_group = "platform-admin"
    access_pattern = "TENANT#PLATFORM with UUID-based SKs"
    storage_approach = "Single-table design with proper access patterns"
    entity_types = ["USER", "GROUP", "ROLE", "PERMISSION"]
    relationship_types = ["USER_GROUP_MEMBERSHIP", "GROUP_ROLE_MEMBERSHIP", "ROLE_PERMISSION_MEMBERSHIP"]
  }
}
