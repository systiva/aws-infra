const { RBACModel } = require('../db');
const logger = require('../../../logger');

/**
 * Role Management Access Patterns
 */
class RoleManagement {
    
    /**
     * Create a new role
     */
    static async createRole(tenantId, roleData) {
        try {

            
            const rolePK = `TENANT#${tenantId}`;
            const roleSK = `ROLE#${roleData.roleId}`;
            
            const roleItem = {
                PK: rolePK,
                SK: roleSK,
                entityType: 'ROLE',
                tenantId,
                roleId: roleData.roleId,
                name: roleData.name,
                description: roleData.description,
                status: roleData.status || 'ACTIVE',
                permissions: roleData.permissions || [],
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
                ...roleData
            };
            return await RBACModel.create(roleItem);
        } catch (error) {
            logger.error('Error creating role:', error);
            throw error;
        }
    }

    /**
     * Get role by ID
     */
    static async getRole(tenantId, roleId) {
        try {

            
            const rolePK = `TENANT#${tenantId}`;
            const roleSK = `ROLE#${roleId}`;
            const result = await RBACModel.get({
                PK: rolePK,
                SK: roleSK
            });
            
            return this.cleanRoleResponse(result);
        } catch (error) {
            if (error.name === 'DocumentNotFoundError') {
                return null;
            }
            logger.error('Error getting role:', error);
            throw error;
        }
    }

    /**
     * Update role
     */
    static async updateRole(tenantId, roleId, updateData) {
        try {

            
            const rolePK = `TENANT#${tenantId}`;
            const roleSK = `ROLE#${roleId}`;
            
            const updateItem = {
                ...updateData,
                updatedAt: new Date().toISOString()
            };
            const result = await RBACModel.update(
                { PK: rolePK, SK: roleSK },
                { $SET: updateItem }
            );
            
            return this.cleanRoleResponse(result);
        } catch (error) {
            logger.error('Error updating role:', error);
            throw error;
        }
    }

    /**
     * Delete role
     */
    static async deleteRole(tenantId, roleId) {
        try {

            
            const rolePK = `TENANT#${tenantId}`;
            const roleSK = `ROLE#${roleId}`;
            return await RBACModel.delete({
                PK: rolePK,
                SK: roleSK
            });
        } catch (error) {
            logger.error('Error deleting role:', error);
            throw error;
        }
    }

    /**
     * Get all roles in a tenant
     */
    static async getAllRolesInTenant(tenantId) {
        try {

            
            const rolePK = `TENANT#${tenantId}`;
            const roles = await RBACModel.query("PK").eq(rolePK)
                .where('SK').beginsWith('ROLE#')
                .exec();
            
            return roles.map(role => this.cleanRoleResponse(role));
        } catch (error) {
            logger.error('Error getting all roles in tenant:', error);
            throw error;
        }
    }

    /**
     * Add permission to role
     */
    static async addPermissionToRole(tenantId, roleId, permissionId) {
        try {
            // Role's Permission mapping: PK: ROLE#<tenant_id>#<role_id>#PERMISSION, SK: PERMISSION#<permissionID>
            const rolePermissionPK = `ROLE#${tenantId}#${roleId}#PERMISSIONS`;
            const rolePermissionSK = `PERMISSION#${permissionId}`;
            
            const rolePermissionItem = {
                PK: rolePermissionPK,
                SK: rolePermissionSK,
                entityType: 'ROLE_PERMISSION_ASSIGNMENT',
                tenantId,
                roleId,
                permissionId,
                createdAt: new Date().toISOString()
            };

            // Permission's Role mapping: PK: PERMISSION#<tenant_id>#<permission_id>#ROLES, SK: ROLE#<role_id>
            const permissionRolePK = `PERMISSION#${tenantId}#${permissionId}#ROLES`;
            const permissionRoleSK = `ROLE#${roleId}`;
            
            const permissionRoleItem = {
                PK: permissionRolePK,
                SK: permissionRoleSK,
                entityType: 'PERMISSION_ROLE_ASSIGNMENT',
                tenantId,
                roleId,
                permissionId,
                createdAt: new Date().toISOString()
            };
            
            // Create both mappings in parallel
            await Promise.all([
                RBACModel.create(rolePermissionItem),
                RBACModel.create(permissionRoleItem)
            ]);
            
            return { success: true, rolePermissionItem, permissionRoleItem };
        } catch (error) {
            logger.error('Error adding permission to role:', error);
            throw error;
        }
    }

    /**
     * Remove permission from role
     */
    static async removePermissionFromRole(tenantId, roleId, permissionId) {
        try {
            // Remove both mappings in parallel
            const rolePermissionPK = `ROLE#${tenantId}#${roleId}#PERMISSIONS`;
            const rolePermissionSK = `PERMISSION#${permissionId}`;
            
            const permissionRolePK = `PERMISSION#${tenantId}#${permissionId}#ROLES`;
            const permissionRoleSK = `ROLE#${roleId}`;
            
            await Promise.all([
                RBACModel.delete({ PK: rolePermissionPK, SK: rolePermissionSK }),
                RBACModel.delete({ PK: permissionRolePK, SK: permissionRoleSK })
            ]);
            
            return { success: true };
        } catch (error) {
            logger.error('Error removing permission from role:', error);
            throw error;
        }
    }

    /**
     * Clean role response by removing internal DynamoDB keys
     */
    static cleanRoleResponse(role) {
        if (!role) return role;
        
        const cleanRole = { ...role };
        delete cleanRole.PK;
        delete cleanRole.SK;
        
        return cleanRole;
    }
}

module.exports = RoleManagement;
