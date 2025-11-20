/**
 * Default RBAC schema for new tenants
 * This defines the base permissions, roles, and groups for each tenant
 */

const DEFAULT_PERMISSIONS = [
  // User Management Permissions (6)
  { name: "create-user", resource: "user", action: "create", description: "Create new users" },
  { name: "update-user", resource: "user", action: "update", description: "Update user details" },
  { name: "get-user", resource: "user", action: "get", description: "View user details" },
  { name: "delete-user", resource: "user", action: "delete", description: "Delete users" },
  { name: "resume-user", resource: "user", action: "resume", description: "Resume suspended users" },
  { name: "suspend-user", resource: "user", action: "suspend", description: "Suspend users" },
  
  // Group Management Permissions (5)
  { name: "create-user-group", resource: "user-group", action: "create", description: "Create user groups" },
  { name: "get-user-group", resource: "user-group", action: "get", description: "View user groups" },
  { name: "delete-user-group", resource: "user-group", action: "delete", description: "Delete user groups" },
  { name: "update-user-group", resource: "user-group", action: "update", description: "Update user groups" },
  { name: "assign-user-group", resource: "user-group", action: "assign", description: "Assign users to groups" },
  
  // Role Management Permissions (5)
  { name: "create-user-role", resource: "user-role", action: "create", description: "Create user roles" },
  { name: "get-user-role", resource: "user-role", action: "get", description: "View user roles" },
  { name: "delete-user-role", resource: "user-role", action: "delete", description: "Delete user roles" },
  { name: "update-user-role", resource: "user-role", action: "update", description: "Update user roles" },
  { name: "assign-user-role", resource: "user-role", action: "assign", description: "Assign roles to users" },
  
  // Permission Management Permissions (5)
  { name: "create-user-permission", resource: "user-permission", action: "create", description: "Create permissions" },
  { name: "get-tenant-permission", resource: "tenant-permission", action: "get", description: "View tenant permissions" },
  { name: "delete-tenant-permission", resource: "tenant-permission", action: "delete", description: "Delete permissions" },
  { name: "update-tenant-permission", resource: "tenant-permission", action: "update", description: "Update permissions" },
  { name: "assign-permission-assign", resource: "permission-assign", action: "assign", description: "Assign permissions to roles" }
];

const DEFAULT_ROLES = [
  {
    name: "user-manager",
    description: "Manage users in the tenant",
    permissions: [
      "create-user",
      "update-user",
      "get-user",
      "delete-user",
      "resume-user",
      "suspend-user"
    ]
  },
  {
    name: "user-group-manager",
    description: "Manage user groups in the tenant",
    permissions: [
      "create-user-group",
      "get-user-group",
      "delete-user-group",
      "update-user-group",
      "assign-user-group"
    ]
  },
  {
    name: "user-role-manager",
    description: "Manage user roles in the tenant",
    permissions: [
      "create-user-role",
      "get-user-role",
      "delete-user-role",
      "update-user-role",
      "assign-user-role"
    ]
  },
  {
    name: "user-permission-manager",
    description: "Manage permissions in the tenant",
    permissions: [
      "create-user-permission",
      "get-tenant-permission",
      "delete-tenant-permission",
      "update-tenant-permission",
      "assign-permission-assign"
    ]
  }
];

const DEFAULT_GROUPS = [
  {
    name: "tenant-admin",
    description: "Tenant administrator with full administrative access",
    roles: [
      "user-manager",
      "user-group-manager",
      "user-role-manager",
      "user-permission-manager"
    ]
  }
];

module.exports = {
  DEFAULT_PERMISSIONS,
  DEFAULT_ROLES,
  DEFAULT_GROUPS
};
