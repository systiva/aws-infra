const { RBACModel } = require('../db');
const logger = require('../../../logger');

/**
 * Permission Management Access Patterns
 */
class PermissionManagement {
    
    /**
     * Create a new permission
     */
    static async createPermission(tenantId, permissionData) {
        try {

            
            const permissionPK = `TENANT#${tenantId}`;
            const permissionSK = `PERMISSION#${permissionData.permissionId}`;
            
            const permissionItem = {
                PK: permissionPK,
                SK: permissionSK,
                entityType: 'PERMISSION',
                tenantId,
                permissionId: permissionData.permissionId,
                name: permissionData.name,
                description: permissionData.description,
                resource: permissionData.resource,
                action: permissionData.action,
                status: permissionData.status || 'ACTIVE',
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
                ...permissionData
            };

            logger.info(`Creating permission: ${permissionData.permissionId} in tenant: ${tenantId}`);
            return await RBACModel.create(permissionItem);
        } catch (error) {
            logger.error('Error creating permission:', error);
            throw error;
        }
    }

    /**
     * Get permission by ID
     */
    static async getPermission(tenantId, permissionId) {
        try {

            
            const permissionPK = `TENANT#${tenantId}`;
            const permissionSK = `PERMISSION#${permissionId}`;
            
            logger.info(`Getting permission: ${permissionId} from tenant: ${tenantId}`);
            const result = await RBACModel.get({
                PK: permissionPK,
                SK: permissionSK
            });
            
            return this.cleanPermissionResponse(result);
        } catch (error) {
            if (error.name === 'DocumentNotFoundError') {
                return null;
            }
            logger.error('Error getting permission:', error);
            throw error;
        }
    }

    /**
     * Update permission
     */
    static async updatePermission(tenantId, permissionId, updateData) {
        try {

            
            const permissionPK = `TENANT#${tenantId}`;
            const permissionSK = `PERMISSION#${permissionId}`;
            
            const updateItem = {
                ...updateData,
                updatedAt: new Date().toISOString()
            };

            logger.info(`Updating permission: ${permissionId} in tenant: ${tenantId}`);
            const result = await RBACModel.update(
                { PK: permissionPK, SK: permissionSK },
                { $SET: updateItem }
            );
            
            return this.cleanPermissionResponse(result);
        } catch (error) {
            logger.error('Error updating permission:', error);
            throw error;
        }
    }

    /**
     * Delete permission
     */
    static async deletePermission(tenantId, permissionId) {
        try {

            
            const permissionPK = `TENANT#${tenantId}`;
            const permissionSK = `PERMISSION#${permissionId}`;
            
            logger.info(`Deleting permission: ${permissionId} from tenant: ${tenantId}`);
            return await RBACModel.delete({
                PK: permissionPK,
                SK: permissionSK
            });
        } catch (error) {
            logger.error('Error deleting permission:', error);
            throw error;
        }
    }

    /**
     * Get all permissions in a tenant
     */
    static async getAllPermissionsInTenant(tenantId) {
        try {

            
            const permissionPK = `TENANT#${tenantId}`;
            
            logger.info(`Getting all permissions from tenant: ${tenantId}`);
            const permissions = await RBACModel.query("PK").eq(permissionPK)
                .where('SK').beginsWith('PERMISSION#')
                .exec();
            
            return permissions.map(permission => this.cleanPermissionResponse(permission));
        } catch (error) {
            logger.error('Error getting all permissions in tenant:', error);
            throw error;
        }
    }

    /**
     * Get permissions by resource
     */
    static async getPermissionsByResource(tenantId, resource) {
        try {

            
            const permissionPK = `TENANT#${tenantId}`;
            
            logger.info(`Getting permissions for resource: ${resource} in tenant: ${tenantId}`);
            const permissions = await RBACModel.query("PK").eq(permissionPK)
                .where('SK').beginsWith('PERMISSION#')
                .filter('resource').eq(resource)
                .exec();
            
            return permissions.map(permission => this.cleanPermissionResponse(permission));
        } catch (error) {
            logger.error('Error getting permissions by resource:', error);
            throw error;
        }
    }

    /**
     * Get permissions by action
     */
    static async getPermissionsByAction(tenantId, action) {
        try {

            
            const permissionPK = `TENANT#${tenantId}`;
            
            logger.info(`Getting permissions for action: ${action} in tenant: ${tenantId}`);
            const permissions = await RBACModel.query("PK").eq(permissionPK)
                .where('SK').beginsWith('PERMISSION#')
                .filter('action').eq(action)
                .exec();
            
            return permissions.map(permission => this.cleanPermissionResponse(permission));
        } catch (error) {
            logger.error('Error getting permissions by action:', error);
            throw error;
        }
    }

    /**
     * Get user permissions (through groups -> roles -> permissions)
     */
    static async getUserPermissions(tenantId, userId) {
        try {
            
            // Step 1: Get user's group assignments
            // PK: USER#<tenant_id>#<user_id>#GROUPS, SK: GROUP#<groupID>
            const userGroupsPK = `USER#${tenantId}#${userId}#GROUPS`;
            const userGroups = await RBACModel.query("PK").eq(userGroupsPK).exec();
            
            if (!userGroups || userGroups.length === 0) {
                return [];
            }
            
            // Step 2: Get all roles from user's groups (parallel execution)
            const roleQueries = userGroups.map(async (groupAssignment) => {
                // SK format is GROUP#<groupID>
                const groupId = groupAssignment.SK.replace('GROUP#', '');
                const groupRolesPK = `GROUP#${tenantId}#${groupId}#ROLES`;
                
                try {
                    const groupRoles = await RBACModel.query("PK").eq(groupRolesPK).exec();
                    return groupRoles || [];
                } catch (error) {
                    logger.warn(`Error getting roles for group ${groupId}:`, error);
                    return [];
                }
            });
            
            const allGroupRoles = await Promise.all(roleQueries);
            const flatRoles = allGroupRoles.flat();
            
            if (flatRoles.length === 0) {
                return [];
            }
            
            // Step 3: Get all permissions from roles (parallel execution)
            const permissionQueries = flatRoles.map(async (roleAssignment) => {
                // SK format is ROLE#<roleID>
                const roleId = roleAssignment.SK.replace('ROLE#', '');
                const rolePermissionsPK = `ROLE#${tenantId}#${roleId}#PERMISSION`;
                
                try {
                    const rolePermissions = await RBACModel.query("PK").eq(rolePermissionsPK).exec();
                    return rolePermissions || [];
                } catch (error) {
                    logger.warn(`Error getting permissions for role ${roleId}:`, error);
                    return [];
                }
            });
            
            const allRolePermissions = await Promise.all(permissionQueries);
            const flatPermissions = allRolePermissions.flat();
            
            // Step 4: Get full permission details (parallel execution) and deduplicate
            const uniquePermissionIds = new Set();
            const permissionDetailsQueries = [];
            
            flatPermissions.forEach(permissionAssignment => {
                // SK format is PERMISSION#<permissionID>
                const permissionId = permissionAssignment.SK.replace('PERMISSION#', '');
                if (permissionId && !uniquePermissionIds.has(permissionId)) {
                    uniquePermissionIds.add(permissionId);
                    permissionDetailsQueries.push(this.getPermission(tenantId, permissionId));
                }
            });
            
            const permissionDetails = await Promise.all(permissionDetailsQueries);
            
            // Filter out null permissions and return active ones
            const validPermissions = permissionDetails
                .filter(permission => permission && permission.status === 'ACTIVE');

            return validPermissions;        } catch (error) {
            logger.error('Error getting user permissions:', error);
            throw error;
        }
    }

    /**
     * Check if user has specific permission
     */
    static async hasPermission(tenantId, userId, resource, action) {
        try {
            const userPermissions = await this.getUserPermissions(tenantId, userId);
            
            return userPermissions.some(permission => 
                permission.resource === resource && 
                permission.action === action &&
                permission.status === 'ACTIVE'
            );
        } catch (error) {
            logger.error('Error checking user permission:', error);
            throw error;
        }
    }

    /**
     * Get role permissions
     */
    static async getRolePermissions(tenantId, roleId) {
        try {
            const rolePermissionsPK = `ROLE#${tenantId}#${roleId}#PERMISSION`;
            const permissionAssignments = await RBACModel.query("PK").eq(rolePermissionsPK).exec();
            
            if (!permissionAssignments || permissionAssignments.length === 0) {
                return [];
            }
            
            // Get full permission details for each permission (parallel execution)
            const permissionQueries = permissionAssignments.map(async (assignment) => {
                // SK format is PERMISSION#<permissionID>
                const permissionId = assignment.SK.replace('PERMISSION#', '');
                
                try {
                    const permission = await this.getPermission(tenantId, permissionId);
                    return permission;
                } catch (error) {
                    logger.warn(`Error getting permission details for ${permissionId}:`, error);
                    return null;
                }
            });
            
            const permissionDetails = await Promise.all(permissionQueries);
            
            // Filter out null permissions and return only active ones
            const validPermissions = permissionDetails
                .filter(permission => permission && permission.status === 'ACTIVE');

            return validPermissions;        } catch (error) {
            logger.error('Error getting role permissions:', error);
            throw error;
        }
    }

    /**
     * Clean permission response by removing internal DynamoDB keys
     */
    static cleanPermissionResponse(permission) {
        if (!permission) return permission;
        
        const cleanPermission = { ...permission };
        delete cleanPermission.PK;
        delete cleanPermission.SK;
        
        return cleanPermission;
    }
}

module.exports = PermissionManagement;
