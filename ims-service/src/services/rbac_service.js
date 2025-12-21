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
  
  async createUser(accountId, userData) {
    try {
      logger.info(`Creating user in account: ${accountId}`);
      
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

      const result = await UserManagement.createUser(accountId, userToCreate);
      await this.createAuditLog(accountId, 'CREATE_USER', 'USER', userId, userData.created_by);
      
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

  async updateUser(accountId, userId, updateData) {
    try {
      logger.info(`Updating user: ${userId} in account: ${accountId}`);
      
      const result = await UserManagement.updateUser(accountId, userId, updateData);
      await this.createAuditLog(accountId, 'UPDATE_USER', 'USER', userId, updateData.updated_by);
      
      return result;
    } catch (error) {
      logger.error(`Error updating user: ${error.message}`);
      throw error;
    }
  }

  async deleteUser(accountId, userId, deletedBy) {
    try {
      logger.info(`Deleting user: ${userId} from account: ${accountId}`);
      
      // Step 1: Delete all user-group mappings
      try {
        const userGroupsPK = `USER#${accountId}#${userId}#GROUPS`;
        const { RBACModel } = require('../db/db');
        const groupMappings = await RBACModel.query("PK").eq(userGroupsPK).exec();
        
        if (groupMappings && groupMappings.length > 0) {
          logger.info(`Removing ${groupMappings.length} user-group mappings for user ${userId}`);
          for (const mapping of groupMappings) {
            const groupId = mapping.SK.replace('GROUP#', '');
            try {
              await UserManagement.removeUserFromGroup(accountId, userId, groupId);
              logger.debug(`Removed user ${userId} from group ${groupId}`);
            } catch (err) {
              logger.error(`Error removing user ${userId} from group ${groupId}: ${err.message}`);
            }
          }
        }
      } catch (err) {
        logger.error(`Error cleaning up user-group mappings for user ${userId}: ${err.message}`);
      }
      
      // Step 2: Delete the user entity itself
      await UserManagement.deleteUser(accountId, userId);

      await this.createAuditLog(accountId, 'DELETE_USER', 'USER', userId, deletedBy);
      return { message: 'User deleted successfully', userId };
    } catch (error) {
      logger.error(`Error deleting user: ${error.message}`);
      throw error;
    }
  }

  async getUser(accountId, userId) {
    try {
      logger.info(`Getting user: ${userId} from account: ${accountId}`);
      return await UserManagement.getUser(accountId, userId);
    } catch (error) {
      logger.error(`Error getting user: ${error.message}`);
      throw error;
    }
  }

  async getAllUsersInAccount(accountId) {
    try {
      logger.info(`Getting all users in account: ${accountId}`);
      return await UserManagement.getAllUsersInAccount(accountId);
    } catch (error) {
      logger.error(`Error getting users in account: ${error.message}`);
      throw error;
    }
  }

  async getUserByCognitoSub(accountId, cognitoSub) {
    try {
      logger.info(`Finding user by cognito sub: ${cognitoSub} in account: ${accountId}`);
      
      // Directly query by user ID (which should be the cognito sub)
      const user = await UserManagement.getUser(accountId, cognitoSub);
      
      if (!user) {
        logger.warn(`User with cognito sub ${cognitoSub} not found in account ${accountId}`);
        return null;
      }
      
      logger.info(`Found user: ${user.userId} with cognito sub: ${cognitoSub}`);
      return user;
    } catch (error) {
      logger.error(`Error finding user by cognito sub: ${error.message}`);
      throw error;
    }
  }

  async createUserContext(accountId, userSub, email, cognitoUsername = null) {
    try {
      logger.info(`Creating user context for cognito sub: ${userSub} in account: ${accountId}`);
      
      // Find user in RBAC system using cognito sub as user ID
      const user = await this.getUserByCognitoSub(accountId, userSub);
      if (!user) {
        logger.warn(`User not found in RBAC system: ${userSub}`);
        return {
          userId: null,
          username: cognitoUsername || userSub,
          email: email,
          accountId: accountId,
          userRoles: [],
          permissions: [],
          groups: [],
          sub: userSub,
          rbacUser: null
        };
      }
      
      // Get user's groups
      const userGroups = await this.getUserGroups(accountId, user.userId);
      logger.info(userGroups, "User Groups:")
      logger.info(`Found ${userGroups.length} groups for user: ${user.userId}`);
      
      // Get roles from all groups
      const allRoles = [];
      const allPermissions = [];
      const groupDetails = [];
      
      for (const groupRel of userGroups) {
        const groupId = groupRel.groupId;
        const group = await this.getGroup(accountId, groupId);
        
        if (group) {
          groupDetails.push({
            id: group.groupId,
            name: group.name,
            description: group.description
          });
          
          // Get roles for this group
          const groupRoles = await this.getGroupRoles(accountId, groupId);
          for (const roleRel of groupRoles) {
            const role = await this.getRole(accountId, roleRel.roleId);
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
        accountId: accountId,
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

  async createGroup(accountId, groupData) {
    try {
      logger.info(`Creating group in account: ${accountId}`);
      const groupId = groupData.groupId || uuidv4();
      
      const groupToCreate = {
        groupId,
        name: groupData.name,
        description: groupData.description || '',
        metadata: groupData.metadata || {},
        created_by: groupData.created_by || 'system'
      };

      const result = await GroupManagement.createGroup(accountId, groupToCreate);
      await this.createAuditLog(accountId, 'CREATE_GROUP', 'GROUP', groupId, groupData.created_by);
      
      return result;
    } catch (error) {
      logger.error(`Error creating group: ${error.message}`);
      throw error;
    }
  }

  async updateGroup(accountId, groupId, updateData) {
    try {
      logger.info(`Updating group: ${groupId} in account: ${accountId}`);
      
      const result = await GroupManagement.updateGroup(accountId, groupId, updateData);
      await this.createAuditLog(accountId, 'UPDATE_GROUP', 'GROUP', groupId, updateData.updated_by);
      
      return result;
    } catch (error) {
      logger.error(`Error updating group: ${error.message}`);
      throw error;
    }
  }

  async deleteGroup(accountId, groupId, deletedBy) {
    try {
      logger.info(`Deleting group: ${groupId} from account: ${accountId}`);
      
      // Step 1: Delete all group-role mappings
      try {
        const groupRolesPK = `GROUP#${accountId}#${groupId}#ROLES`;
        const { RBACModel } = require('../db/db');
        const roleMappings = await RBACModel.query("PK").eq(groupRolesPK).exec();
        
        if (roleMappings && roleMappings.length > 0) {
          logger.info(`Removing ${roleMappings.length} group-role mappings for group ${groupId}`);
          for (const mapping of roleMappings) {
            const roleId = mapping.SK.replace('ROLE#', '');
            try {
              await GroupManagement.removeRoleFromGroup(accountId, groupId, roleId);
              logger.debug(`Removed role ${roleId} from group ${groupId}`);
            } catch (err) {
              logger.error(`Error removing role ${roleId} from group ${groupId}: ${err.message}`);
            }
          }
        }
      } catch (err) {
        logger.error(`Error cleaning up group-role mappings for group ${groupId}: ${err.message}`);
      }
      
      // Step 2: Delete all group-user mappings
      try {
        const groupUsersPK = `GROUP#${accountId}#${groupId}#USERS`;
        const { RBACModel } = require('../db/db');
        const userMappings = await RBACModel.query("PK").eq(groupUsersPK).exec();
        
        if (userMappings && userMappings.length > 0) {
          logger.info(`Removing ${userMappings.length} group-user mappings for group ${groupId}`);
          for (const mapping of userMappings) {
            const userId = mapping.SK.replace('USER#', '');
            try {
              await UserManagement.removeUserFromGroup(accountId, userId, groupId);
              logger.debug(`Removed user ${userId} from group ${groupId}`);
            } catch (err) {
              logger.error(`Error removing user ${userId} from group ${groupId}: ${err.message}`);
            }
          }
        }
      } catch (err) {
        logger.error(`Error cleaning up group-user mappings for group ${groupId}: ${err.message}`);
      }
      
      // Step 3: Delete the group entity itself
      await GroupManagement.deleteGroup(accountId, groupId);

      await this.createAuditLog(accountId, 'DELETE_GROUP', 'GROUP', groupId, deletedBy);
      return { success: true, message: 'Group deleted successfully' };
    } catch (error) {
      logger.error(`Error deleting group: ${error.message}`);
      throw error;
    }
  }

  async getGroup(accountId, groupId) {
    try {
      logger.info(`Getting group: ${groupId} from account: ${accountId}`);
      return await GroupManagement.getGroup(accountId, groupId);
    } catch (error) {
      logger.error(`Error getting group: ${error.message}`);
      throw error;
    }
  }

  async getAllGroupsInAccount(accountId) {
    try {
      logger.info(`Getting all groups in account: ${accountId}`);
      return await GroupManagement.getAllGroupsInAccount(accountId);
    } catch (error) {
      logger.error(`Error getting groups in account: ${error.message}`);
      throw error;
    }
  }

  // ===== ROLE OPERATIONS =====

  async createRole(accountId, roleData) {
    try {
      logger.info(`Creating role in account: ${accountId}`);
      const roleId = roleData.roleId || uuidv4();
      
      const roleToCreate = {
        roleId,
        name: roleData.name,
        description: roleData.description || '',
        permissions: roleData.permissions || [],
        metadata: roleData.metadata || {},
        created_by: roleData.created_by || 'system'
      };

      // Step 1: Create the role entity
      const result = await RoleManagement.createRole(accountId, roleToCreate);
      
      // Step 2: Create bidirectional permission-role mappings for each permission
      const permissions = roleData.permissions || [];
      if (permissions.length > 0) {
        logger.info(`Creating permission-role mappings for role ${roleId} with ${permissions.length} permissions`);
        
        for (const permissionId of permissions) {
          try {
            await RoleManagement.addPermissionToRole(accountId, roleId, permissionId);
            logger.debug(`Permission ${permissionId} mapped to role ${roleId} in account ${accountId}`);
          } catch (mappingError) {
            logger.error(`Error mapping permission ${permissionId} to role ${roleId}: ${mappingError.message}`);
            // Continue with other permissions even if one fails
          }
        }
      }
      
      await this.createAuditLog(accountId, 'CREATE_ROLE', 'ROLE', roleId, roleData.created_by);
      
      return result;
    } catch (error) {
      logger.error(`Error creating role: ${error.message}`);
      throw error;
    }
  }

  async updateRole(accountId, roleId, updateData) {
    try {
      logger.info(`Updating role: ${roleId} in account: ${accountId}`);
      
      // If permissions are being updated, sync the permission-role mappings
      if (updateData.permissions) {
        logger.info(`Syncing permission-role mappings for role ${roleId}`);
        
        // Get current role to find existing permissions
        const currentRole = await RoleManagement.getRole(accountId, roleId);
        const currentPermissions = currentRole?.permissions || [];
        const newPermissions = updateData.permissions || [];
        
        // Find permissions to add and remove
        const permissionsToAdd = newPermissions.filter(p => !currentPermissions.includes(p));
        const permissionsToRemove = currentPermissions.filter(p => !newPermissions.includes(p));
        
        // Remove old mappings
        for (const permissionId of permissionsToRemove) {
          try {
            await RoleManagement.removePermissionFromRole(accountId, roleId, permissionId);
            logger.debug(`Removed permission ${permissionId} from role ${roleId}`);
          } catch (err) {
            logger.error(`Error removing permission ${permissionId} from role ${roleId}: ${err.message}`);
          }
        }
        
        // Add new mappings
        for (const permissionId of permissionsToAdd) {
          try {
            await RoleManagement.addPermissionToRole(accountId, roleId, permissionId);
            logger.debug(`Added permission ${permissionId} to role ${roleId}`);
          } catch (err) {
            logger.error(`Error adding permission ${permissionId} to role ${roleId}: ${err.message}`);
          }
        }
      }
      
      const result = await RoleManagement.updateRole(accountId, roleId, updateData);
      await this.createAuditLog(accountId, 'UPDATE_ROLE', 'ROLE', roleId, updateData.updated_by);
      
      return result;
    } catch (error) {
      logger.error(`Error updating role: ${error.message}`);
      throw error;
    }
  }

  async deleteRole(accountId, roleId, deletedBy) {
    try {
      logger.info(`Deleting role: ${roleId} from account: ${accountId}`);
      
      // Step 1: Get the role to find its permissions
      const role = await RoleManagement.getRole(accountId, roleId);
      const permissions = role?.permissions || [];
      
      // Step 2: Delete all permission-role mappings
      if (permissions.length > 0) {
        logger.info(`Removing ${permissions.length} permission-role mappings for role ${roleId}`);
        for (const permissionId of permissions) {
          try {
            await RoleManagement.removePermissionFromRole(accountId, roleId, permissionId);
            logger.debug(`Removed permission ${permissionId} mapping from role ${roleId}`);
          } catch (err) {
            logger.error(`Error removing permission ${permissionId} from role ${roleId}: ${err.message}`);
            // Continue with other permissions
          }
        }
      }
      
      // Step 3: Delete all role-group mappings (roles assigned to groups)
      // Query for all groups that have this role
      try {
        const roleGroupsPK = `ROLE#${accountId}#${roleId}#GROUPS`;
        const { RBACModel } = require('../db/db');
        const groupMappings = await RBACModel.query("PK").eq(roleGroupsPK).exec();
        
        if (groupMappings && groupMappings.length > 0) {
          logger.info(`Removing ${groupMappings.length} role-group mappings for role ${roleId}`);
          for (const mapping of groupMappings) {
            const groupId = mapping.SK.replace('GROUP#', '');
            try {
              await GroupManagement.removeRoleFromGroup(accountId, groupId, roleId);
              logger.debug(`Removed role ${roleId} from group ${groupId}`);
            } catch (err) {
              logger.error(`Error removing role ${roleId} from group ${groupId}: ${err.message}`);
              // Continue with other groups
            }
          }
        }
      } catch (err) {
        logger.error(`Error cleaning up role-group mappings for role ${roleId}: ${err.message}`);
      }
      
      // Step 4: Delete the role entity itself
      await RoleManagement.deleteRole(accountId, roleId);

      await this.createAuditLog(accountId, 'DELETE_ROLE', 'ROLE', roleId, deletedBy);
      return { success: true, message: 'Role deleted successfully' };
    } catch (error) {
      logger.error(`Error deleting role: ${error.message}`);
      throw error;
    }
  }

  async getRole(accountId, roleId) {
    try {
      logger.info(`Getting role: ${roleId} from account: ${accountId}`);
      return await RoleManagement.getRole(accountId, roleId);
    } catch (error) {
      logger.error(`Error getting role: ${error.message}`);
      throw error;
    }
  }

  async getAllRolesInAccount(accountId) {
    try {
      logger.info(`Getting all roles in account: ${accountId}`);
      return await RoleManagement.getAllRolesInAccount(accountId);
    } catch (error) {
      logger.error(`Error getting roles in account: ${error.message}`);
      throw error;
    }
  }

  // ===== PERMISSION OPERATIONS =====

  async createPermission(accountId, permissionData) {
    try {
      logger.info(`Creating permission in account: ${accountId}`);
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

      const result = await PermissionManagement.createPermission(accountId, permissionToCreate);
      await this.createAuditLog(accountId, 'CREATE_PERMISSION', 'PERMISSION', permissionId, permissionData.created_by);
      
      return result;
    } catch (error) {
      logger.error(`Error creating permission: ${error.message}`);
      throw error;
    }
  }

  async updatePermission(accountId, permissionId, updateData) {
    try {
      logger.info(`Updating permission: ${permissionId} in account: ${accountId}`);
      
      const result = await PermissionManagement.updatePermission(accountId, permissionId, updateData);
      await this.createAuditLog(accountId, 'UPDATE_PERMISSION', 'PERMISSION', permissionId, updateData.updated_by);
      
      return result;
    } catch (error) {
      logger.error(`Error updating permission: ${error.message}`);
      throw error;
    }
  }

  async deletePermission(accountId, permissionId, deletedBy) {
    try {
      logger.info(`Deleting permission: ${permissionId} from account: ${accountId}`);
      
      await PermissionManagement.deletePermission(accountId, permissionId);
      await this.createAuditLog(accountId, 'DELETE_PERMISSION', 'PERMISSION', permissionId, deletedBy);
      
      return { success: true, message: 'Permission deleted successfully' };
    } catch (error) {
      logger.error(`Error deleting permission: ${error.message}`);
      throw error;
    }
  }

  async getPermission(accountId, permissionId) {
    try {
      logger.info(`Getting permission: ${permissionId} from account: ${accountId}`);
      return await PermissionManagement.getPermission(accountId, permissionId);
    } catch (error) {
      logger.error(`Error getting permission: ${error.message}`);
      throw error;
    }
  }

  async getAllPermissionsInAccount(accountId) {
    try {
      logger.info(`Getting all permissions in account: ${accountId}`);
      return await PermissionManagement.getAllPermissionsInAccount(accountId);
    } catch (error) {
      logger.error(`Error getting permissions in account: ${error.message}`);
      throw error;
    }
  }

  // ===== ASSIGNMENT OPERATIONS =====

  async addUserToGroup(accountId, userId, groupId, assignedBy) {
    try {
      logger.info(`Adding user ${userId} to group ${groupId} in account ${accountId}`);
      
      await UserManagement.addUserToGroup(accountId, userId, groupId);
      await this.createAuditLog(accountId, 'ADD_USER_TO_GROUP', 'USER_GROUP', `${userId}-${groupId}`, assignedBy);
      
      return { success: true, message: 'User added to group successfully', userId, groupId };
    } catch (error) {
      logger.error(`Error adding user to group: ${error.message}`);
      throw error;
    }
  }

  async removeUserFromGroup(accountId, userId, groupId, removedBy) {
    try {
      logger.info(`Removing user ${userId} from group ${groupId} in account ${accountId}`);
      
      await UserManagement.removeUserFromGroup(accountId, userId, groupId);
      await this.createAuditLog(accountId, 'REMOVE_USER_FROM_GROUP', 'USER_GROUP', `${userId}-${groupId}`, removedBy);
      
      return { success: true, message: 'User removed from group successfully', userId, groupId };
    } catch (error) {
      logger.error(`Error removing user from group: ${error.message}`);
      throw error;
    }
  }

  async assignRoleToGroup(accountId, groupId, roleId, assignedBy) {
    try {
      logger.info(`Assigning role ${roleId} to group ${groupId} in account ${accountId}`);
      
      await GroupManagement.addRoleToGroup(accountId, groupId, roleId);
      await this.createAuditLog(accountId, 'ASSIGN_ROLE_TO_GROUP', 'GROUP_ROLE', `${groupId}-${roleId}`, assignedBy);
      
      return { success: true, message: 'Role assigned to group successfully', groupId, roleId };
    } catch (error) {
      logger.error(`Error assigning role to group: ${error.message}`);
      throw error;
    }
  }

  async removeRoleFromGroup(accountId, groupId, roleId, removedBy) {
    try {
      logger.info(`Removing role ${roleId} from group ${groupId} in account ${accountId}`);
      
      await GroupManagement.removeRoleFromGroup(accountId, groupId, roleId);
      await this.createAuditLog(accountId, 'REMOVE_ROLE_FROM_GROUP', 'GROUP_ROLE', `${groupId}-${roleId}`, removedBy);
      
      return { success: true, message: 'Role removed from group successfully', groupId, roleId };
    } catch (error) {
      logger.error(`Error removing role from group: ${error.message}`);
      throw error;
    }
  }

  // ===== QUERY OPERATIONS =====

  async getUserGroups(accountId, userId) {
    try {
      logger.info(`Getting groups for user ${userId} in account ${accountId}`);
      return await UserManagement.getUserGroups(accountId, userId);
    } catch (error) {
      logger.error(`Error getting user groups: ${error.message}`);
      throw error;
    }
  }

  async getGroupMembers(accountId, groupId) {
    try {
      logger.info(`Getting members for group ${groupId} in account ${accountId}`);
      return await GroupManagement.getGroupMembers(accountId, groupId);
    } catch (error) {
      logger.error(`Error getting group members: ${error.message}`);
      throw error;
    }
  }

  async getGroupRoles(accountId, groupId) {
    try {
      logger.info(`Getting roles for group ${groupId} in account ${accountId}`);
      return await GroupManagement.getGroupRoles(accountId, groupId);
    } catch (error) {
      logger.error(`Error getting group roles: ${error.message}`);
      throw error;
    }
  }

  async getRoleGroups(accountId, roleId) {
    try {
      logger.info(`Getting groups for role ${roleId} in account ${accountId}`);
      // Note: This method would need to be implemented in RoleManagement or GroupManagement
      // For now, using GroupManagement to get groups by role
      const groups = await GroupManagement.getAllGroupsInAccount(accountId);
      const groupsWithRole = [];
      
      for (const group of groups) {
        const groupRoles = await GroupManagement.getGroupRoles(accountId, group.groupId);
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

  async createAuditLog(accountId, action, entityType, entityId, performedBy, details = {}) {
    try {
      const { RBACModel } = require('../db/db');
      const auditId = uuidv4();
      const timestamp = moment().toISOString();
      
      const auditRecord = {
        PK: `ACCOUNT#${accountId}#AUDIT`,
        SK: `${timestamp}#${auditId}`,
        entity_type: 'AUDIT_LOG',
        account_id: accountId,
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