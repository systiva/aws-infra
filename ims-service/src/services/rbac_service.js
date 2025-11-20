const { v4: uuidv4 } = require('uuid');
const moment = require('moment');
const logger = require('../../logger');
const { 
    UserManagement, 
    RoleManagement, 
    GroupManagement, 
    PermissionManagement 
} = require('../db/access-patterns');

class RBACService {
  constructor() {
    logger.info('RBAC Service initialized using Dynamoose access patterns');
  }

  // ===== USER OPERATIONS =====
  
  async createUser(tenantId, userData) {
    try {
      logger.info(`Creating user in tenant: ${tenantId}`);
      
      // userId must be provided (typically Cognito sub)
      const userId = userData.userId;
      if (!userId) {
        throw new Error('userId is required for user creation');
      }
      
      const userToCreate = {
        userId,
        email: userData.email,
        firstName: userData.firstName || userData.name?.split(' ')[0],
        lastName: userData.lastName || userData.name?.split(' ').slice(1).join(' '),
        status: userData.status || 'ACTIVE',
        cognito_username: userData.cognito_username || null,
        cognito_sub: userData.cognito_sub || null,
        password_status: userData.password_status || 'UNKNOWN',
        first_login_completed: userData.first_login_completed || false,
        metadata: userData.metadata || {},
        created_by: userData.created_by || 'system'
      };

      const result = await UserManagement.createUser(tenantId, userToCreate);
      await this.createAuditLog(tenantId, 'CREATE_USER', 'USER', userId, userData.created_by);
      
      return {
        ...result,
        user_id: userId,
        entity_id: userId
      };
    } catch (error) {
      logger.error(`Error creating user: ${error.message}`);
      throw error;
    }
  }

  async updateUser(tenantId, userId, updateData) {
    try {
      logger.info(`Updating user: ${userId} in tenant: ${tenantId}`);
      
      const result = await UserManagement.updateUser(tenantId, userId, updateData);
      await this.createAuditLog(tenantId, 'UPDATE_USER', 'USER', userId, updateData.updated_by);
      
      return result;
    } catch (error) {
      logger.error(`Error updating user: ${error.message}`);
      throw error;
    }
  }

  async deleteUser(tenantId, userId, deletedBy) {
    try {
      logger.info(`Deleting user: ${userId} from tenant: ${tenantId}`);
      
      // Delete user record and all related group memberships
      await UserManagement.deleteUser(tenantId, userId);

      await this.createAuditLog(tenantId, 'DELETE_USER', 'USER', userId, deletedBy);
      return { message: 'User deleted successfully', userId };
    } catch (error) {
      logger.error(`Error deleting user: ${error.message}`);
      throw error;
    }
  }

  async getUser(tenantId, userId) {
    try {
      logger.info(`Getting user: ${userId} from tenant: ${tenantId}`);
      return await UserManagement.getUser(tenantId, userId);
    } catch (error) {
      logger.error(`Error getting user: ${error.message}`);
      throw error;
    }
  }

  async getAllUsersInTenant(tenantId) {
    try {
      logger.info(`Getting all users in tenant: ${tenantId}`);
      return await UserManagement.getAllUsersInTenant(tenantId);
    } catch (error) {
      logger.error(`Error getting users in tenant: ${error.message}`);
      throw error;
    }
  }

  async getUserByCognitoSub(tenantId, cognitoSub) {
    try {
      logger.info(`Finding user by cognito sub: ${cognitoSub} in tenant: ${tenantId}`);
      
      // Directly query by user ID (which should be the cognito sub)
      const user = await UserManagement.getUser(tenantId, cognitoSub);
      
      if (!user) {
        logger.warn(`User with cognito sub ${cognitoSub} not found in tenant ${tenantId}`);
        return null;
      }
      
      logger.info(`Found user: ${user.userId} with cognito sub: ${cognitoSub}`);
      return user;
    } catch (error) {
      logger.error(`Error finding user by cognito sub: ${error.message}`);
      throw error;
    }
  }

  async createUserContext(tenantId, userSub, email, cognitoUsername = null) {
    try {
      logger.info(`Creating user context for cognito sub: ${userSub} in tenant: ${tenantId}`);
      
      // Find user in RBAC system using cognito sub as user ID
      const user = await this.getUserByCognitoSub(tenantId, userSub);
      if (!user) {
        logger.warn(`User not found in RBAC system: ${userSub}`);
        return {
          userId: null,
          username: cognitoUsername || userSub,
          email: email,
          tenantId: tenantId,
          userRoles: [],
          permissions: [],
          groups: [],
          sub: userSub,
          rbacUser: null
        };
      }
      
      // Get user's groups
      const userGroups = await this.getUserGroups(tenantId, user.userId);
      logger.info(userGroups, "User Groups:")
      logger.info(`Found ${userGroups.length} groups for user: ${user.userId}`);
      
      // Get roles from all groups
      const allRoles = [];
      const allPermissions = [];
      const groupDetails = [];
      
      for (const groupRel of userGroups) {
        const groupId = groupRel.groupId;
        const group = await this.getGroup(tenantId, groupId);
        
        if (group) {
          groupDetails.push({
            id: group.groupId,
            name: group.name,
            description: group.description
          });
          
          // Get roles for this group
          const groupRoles = await this.getGroupRoles(tenantId, groupId);
          for (const roleRel of groupRoles) {
            const role = await this.getRole(tenantId, roleRel.roleId);
            if (role) {
              allRoles.push({
                id: role.roleId,
                name: role.name,
                description: role.description,
                permissions: role.permissions || []
              });
              
              // Add role permissions to user permissions
              if (role.permissions) {
                allPermissions.push(...role.permissions);
              }
            }
          }
        }
      }
      
      const userContext = {
        userId: user.userId,
        username: cognitoUsername || user.cognito_username || userSub,
        email: email || user.email,
        tenantId: tenantId,
        userRoles: allRoles,
        permissions: [...new Set(allPermissions)], // Remove duplicates
        groups: groupDetails,
        sub: userSub,
        rbacUser: user
      };
      
      logger.info(`Created user context for ${userSub}:`, {
        userId: userContext.userId,
        groupsCount: groupDetails.length,
        rolesCount: allRoles.length,
        permissionsCount: userContext.permissions.length
      });
      
      return userContext;
    } catch (error) {
      logger.error(`Error creating user context: ${error.message}`);
      throw error;
    }
  }

  // ===== GROUP OPERATIONS =====

  async createGroup(tenantId, groupData) {
    try {
      logger.info(`Creating group in tenant: ${tenantId}`);
      const groupId = groupData.groupId || uuidv4();
      
      const groupToCreate = {
        groupId,
        name: groupData.name,
        description: groupData.description || '',
        metadata: groupData.metadata || {},
        created_by: groupData.created_by || 'system'
      };

      const result = await GroupManagement.createGroup(tenantId, groupToCreate);
      await this.createAuditLog(tenantId, 'CREATE_GROUP', 'GROUP', groupId, groupData.created_by);
      
      return result;
    } catch (error) {
      logger.error(`Error creating group: ${error.message}`);
      throw error;
    }
  }

  async updateGroup(tenantId, groupId, updateData) {
    try {
      logger.info(`Updating group: ${groupId} in tenant: ${tenantId}`);
      
      const result = await GroupManagement.updateGroup(tenantId, groupId, updateData);
      await this.createAuditLog(tenantId, 'UPDATE_GROUP', 'GROUP', groupId, updateData.updated_by);
      
      return result;
    } catch (error) {
      logger.error(`Error updating group: ${error.message}`);
      throw error;
    }
  }

  async deleteGroup(tenantId, groupId, deletedBy) {
    try {
      logger.info(`Deleting group: ${groupId} from tenant: ${tenantId}`);
      
      // Delete group record and all related memberships
      await GroupManagement.deleteGroup(tenantId, groupId);

      await this.createAuditLog(tenantId, 'DELETE_GROUP', 'GROUP', groupId, deletedBy);
      return { success: true, message: 'Group deleted successfully' };
    } catch (error) {
      logger.error(`Error deleting group: ${error.message}`);
      throw error;
    }
  }

  async getGroup(tenantId, groupId) {
    try {
      logger.info(`Getting group: ${groupId} from tenant: ${tenantId}`);
      return await GroupManagement.getGroup(tenantId, groupId);
    } catch (error) {
      logger.error(`Error getting group: ${error.message}`);
      throw error;
    }
  }

  async getAllGroupsInTenant(tenantId) {
    try {
      logger.info(`Getting all groups in tenant: ${tenantId}`);
      return await GroupManagement.getAllGroupsInTenant(tenantId);
    } catch (error) {
      logger.error(`Error getting groups in tenant: ${error.message}`);
      throw error;
    }
  }

  // ===== ROLE OPERATIONS =====

  async createRole(tenantId, roleData) {
    try {
      logger.info(`Creating role in tenant: ${tenantId}`);
      const roleId = roleData.roleId || uuidv4();
      
      const roleToCreate = {
        roleId,
        name: roleData.name,
        description: roleData.description || '',
        permissions: roleData.permissions || [],
        metadata: roleData.metadata || {},
        created_by: roleData.created_by || 'system'
      };

      const result = await RoleManagement.createRole(tenantId, roleToCreate);
      await this.createAuditLog(tenantId, 'CREATE_ROLE', 'ROLE', roleId, roleData.created_by);
      
      return result;
    } catch (error) {
      logger.error(`Error creating role: ${error.message}`);
      throw error;
    }
  }

  async updateRole(tenantId, roleId, updateData) {
    try {
      logger.info(`Updating role: ${roleId} in tenant: ${tenantId}`);
      
      const result = await RoleManagement.updateRole(tenantId, roleId, updateData);
      await this.createAuditLog(tenantId, 'UPDATE_ROLE', 'ROLE', roleId, updateData.updated_by);
      
      return result;
    } catch (error) {
      logger.error(`Error updating role: ${error.message}`);
      throw error;
    }
  }

  async deleteRole(tenantId, roleId, deletedBy) {
    try {
      logger.info(`Deleting role: ${roleId} from tenant: ${tenantId}`);
      
      // Delete role record and all related assignments
      await RoleManagement.deleteRole(tenantId, roleId);

      await this.createAuditLog(tenantId, 'DELETE_ROLE', 'ROLE', roleId, deletedBy);
      return { success: true, message: 'Role deleted successfully' };
    } catch (error) {
      logger.error(`Error deleting role: ${error.message}`);
      throw error;
    }
  }

  async getRole(tenantId, roleId) {
    try {
      logger.info(`Getting role: ${roleId} from tenant: ${tenantId}`);
      return await RoleManagement.getRole(tenantId, roleId);
    } catch (error) {
      logger.error(`Error getting role: ${error.message}`);
      throw error;
    }
  }

  async getAllRolesInTenant(tenantId) {
    try {
      logger.info(`Getting all roles in tenant: ${tenantId}`);
      return await RoleManagement.getAllRolesInTenant(tenantId);
    } catch (error) {
      logger.error(`Error getting roles in tenant: ${error.message}`);
      throw error;
    }
  }

  // ===== PERMISSION OPERATIONS =====

  async createPermission(tenantId, permissionData) {
    try {
      logger.info(`Creating permission in tenant: ${tenantId}`);
      const permissionId = permissionData.permissionId || uuidv4();
      
      const permissionToCreate = {
        permissionId,
        name: permissionData.name,
        description: permissionData.description || '',
        resource: permissionData.resource || '',
        action: permissionData.action || '',
        metadata: permissionData.metadata || {},
        created_by: permissionData.created_by || 'system'
      };

      const result = await PermissionManagement.createPermission(tenantId, permissionToCreate);
      await this.createAuditLog(tenantId, 'CREATE_PERMISSION', 'PERMISSION', permissionId, permissionData.created_by);
      
      return result;
    } catch (error) {
      logger.error(`Error creating permission: ${error.message}`);
      throw error;
    }
  }

  async updatePermission(tenantId, permissionId, updateData) {
    try {
      logger.info(`Updating permission: ${permissionId} in tenant: ${tenantId}`);
      
      const result = await PermissionManagement.updatePermission(tenantId, permissionId, updateData);
      await this.createAuditLog(tenantId, 'UPDATE_PERMISSION', 'PERMISSION', permissionId, updateData.updated_by);
      
      return result;
    } catch (error) {
      logger.error(`Error updating permission: ${error.message}`);
      throw error;
    }
  }

  async deletePermission(tenantId, permissionId, deletedBy) {
    try {
      logger.info(`Deleting permission: ${permissionId} from tenant: ${tenantId}`);
      
      await PermissionManagement.deletePermission(tenantId, permissionId);
      await this.createAuditLog(tenantId, 'DELETE_PERMISSION', 'PERMISSION', permissionId, deletedBy);
      
      return { success: true, message: 'Permission deleted successfully' };
    } catch (error) {
      logger.error(`Error deleting permission: ${error.message}`);
      throw error;
    }
  }

  async getPermission(tenantId, permissionId) {
    try {
      logger.info(`Getting permission: ${permissionId} from tenant: ${tenantId}`);
      return await PermissionManagement.getPermission(tenantId, permissionId);
    } catch (error) {
      logger.error(`Error getting permission: ${error.message}`);
      throw error;
    }
  }

  async getAllPermissionsInTenant(tenantId) {
    try {
      logger.info(`Getting all permissions in tenant: ${tenantId}`);
      return await PermissionManagement.getAllPermissionsInTenant(tenantId);
    } catch (error) {
      logger.error(`Error getting permissions in tenant: ${error.message}`);
      throw error;
    }
  }

  // ===== ASSIGNMENT OPERATIONS =====

  async addUserToGroup(tenantId, userId, groupId, assignedBy) {
    try {
      logger.info(`Adding user ${userId} to group ${groupId} in tenant ${tenantId}`);
      
      await UserManagement.addUserToGroup(tenantId, userId, groupId);
      await this.createAuditLog(tenantId, 'ADD_USER_TO_GROUP', 'USER_GROUP', `${userId}-${groupId}`, assignedBy);
      
      return { success: true, message: 'User added to group successfully', userId, groupId };
    } catch (error) {
      logger.error(`Error adding user to group: ${error.message}`);
      throw error;
    }
  }

  async removeUserFromGroup(tenantId, userId, groupId, removedBy) {
    try {
      logger.info(`Removing user ${userId} from group ${groupId} in tenant ${tenantId}`);
      
      await UserManagement.removeUserFromGroup(tenantId, userId, groupId);
      await this.createAuditLog(tenantId, 'REMOVE_USER_FROM_GROUP', 'USER_GROUP', `${userId}-${groupId}`, removedBy);
      
      return { success: true, message: 'User removed from group successfully', userId, groupId };
    } catch (error) {
      logger.error(`Error removing user from group: ${error.message}`);
      throw error;
    }
  }

  async assignRoleToGroup(tenantId, groupId, roleId, assignedBy) {
    try {
      logger.info(`Assigning role ${roleId} to group ${groupId} in tenant ${tenantId}`);
      
      await GroupManagement.addRoleToGroup(tenantId, groupId, roleId);
      await this.createAuditLog(tenantId, 'ASSIGN_ROLE_TO_GROUP', 'GROUP_ROLE', `${groupId}-${roleId}`, assignedBy);
      
      return { success: true, message: 'Role assigned to group successfully', groupId, roleId };
    } catch (error) {
      logger.error(`Error assigning role to group: ${error.message}`);
      throw error;
    }
  }

  async removeRoleFromGroup(tenantId, groupId, roleId, removedBy) {
    try {
      logger.info(`Removing role ${roleId} from group ${groupId} in tenant ${tenantId}`);
      
      await GroupManagement.removeRoleFromGroup(tenantId, groupId, roleId);
      await this.createAuditLog(tenantId, 'REMOVE_ROLE_FROM_GROUP', 'GROUP_ROLE', `${groupId}-${roleId}`, removedBy);
      
      return { success: true, message: 'Role removed from group successfully', groupId, roleId };
    } catch (error) {
      logger.error(`Error removing role from group: ${error.message}`);
      throw error;
    }
  }

  // ===== QUERY OPERATIONS =====

  async getUserGroups(tenantId, userId) {
    try {
      logger.info(`Getting groups for user ${userId} in tenant ${tenantId}`);
      return await UserManagement.getUserGroups(tenantId, userId);
    } catch (error) {
      logger.error(`Error getting user groups: ${error.message}`);
      throw error;
    }
  }

  async getGroupMembers(tenantId, groupId) {
    try {
      logger.info(`Getting members for group ${groupId} in tenant ${tenantId}`);
      return await GroupManagement.getGroupMembers(tenantId, groupId);
    } catch (error) {
      logger.error(`Error getting group members: ${error.message}`);
      throw error;
    }
  }

  async getGroupRoles(tenantId, groupId) {
    try {
      logger.info(`Getting roles for group ${groupId} in tenant ${tenantId}`);
      return await GroupManagement.getGroupRoles(tenantId, groupId);
    } catch (error) {
      logger.error(`Error getting group roles: ${error.message}`);
      throw error;
    }
  }

  async getRoleGroups(tenantId, roleId) {
    try {
      logger.info(`Getting groups for role ${roleId} in tenant ${tenantId}`);
      // Note: This method would need to be implemented in RoleManagement or GroupManagement
      // For now, using GroupManagement to get groups by role
      const groups = await GroupManagement.getAllGroupsInTenant(tenantId);
      const groupsWithRole = [];
      
      for (const group of groups) {
        const groupRoles = await GroupManagement.getGroupRoles(tenantId, group.groupId);
        if (groupRoles.some(role => role.roleId === roleId)) {
          groupsWithRole.push(group);
        }
      }
      
      return groupsWithRole;
    } catch (error) {
      logger.error(`Error getting role groups: ${error.message}`);
      throw error;
    }
  }

  // ===== AUDIT LOG =====

  async createAuditLog(tenantId, action, entityType, entityId, performedBy, details = {}) {
    try {
      const { RBACModel } = require('../db/db');
      const auditId = uuidv4();
      const timestamp = moment().toISOString();
      
      const auditRecord = {
        PK: `TENANT#${tenantId}#AUDIT`,
        SK: `${timestamp}#${auditId}`,
        entity_type: 'AUDIT_LOG',
        tenant_id: tenantId,
        audit_id: auditId,
        action: action,
        entity_type_audited: entityType,
        entity_id: entityId,
        performed_by: performedBy || 'system',
        timestamp: timestamp,
        details: details
      };

      await RBACModel.create(auditRecord);
      logger.info(`Audit log created: ${action} on ${entityType}:${entityId}`);
    } catch (error) {
      logger.error(`Error creating audit log: ${error.message}`);
      // Don't throw error for audit logging failures
    }
  }
}

module.exports = RBACService;