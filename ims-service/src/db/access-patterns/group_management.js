const { RBACModel } = require('../db');
const logger = require('../../../logger');

/**
 * Group Management Access Patterns
 */
class GroupManagement {
    
    /**
     * Create a new group
     */
    static async createGroup(tenantId, groupData) {
        try {

            
            const groupPK = `TENANT#${tenantId}`;
            const groupSK = `GROUP#${groupData.groupId}`;
            
            const groupItem = {
                PK: groupPK,
                SK: groupSK,
                entityType: 'GROUP',
                tenantId,
                groupId: groupData.groupId,
                name: groupData.name,
                description: groupData.description,
                status: groupData.status || 'ACTIVE',
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
                ...groupData
            };
            return await RBACModel.create(groupItem);
        } catch (error) {
            logger.error('Error creating group:', error);
            throw error;
        }
    }

    /**
     * Get group by ID
     */
    static async getGroup(tenantId, groupId) {
        try {

            
            const groupPK = `TENANT#${tenantId}`;
            const groupSK = `GROUP#${groupId}`;
            const result = await RBACModel.get({
                PK: groupPK,
                SK: groupSK
            });
            
            return this.cleanGroupResponse(result);
        } catch (error) {
            if (error.name === 'DocumentNotFoundError') {
                return null;
            }
            logger.error('Error getting group:', error);
            throw error;
        }
    }

    /**
     * Update group
     */
    static async updateGroup(tenantId, groupId, updateData) {
        try {

            
            const groupPK = `TENANT#${tenantId}`;
            const groupSK = `GROUP#${groupId}`;
            
            const updateItem = {
                ...updateData,
                updatedAt: new Date().toISOString()
            };
            const result = await RBACModel.update(
                { PK: groupPK, SK: groupSK },
                { $SET: updateItem }
            );
            
            return this.cleanGroupResponse(result);
        } catch (error) {
            logger.error('Error updating group:', error);
            throw error;
        }
    }

    /**
     * Delete group
     */
    static async deleteGroup(tenantId, groupId) {
        try {

            
            const groupPK = `TENANT#${tenantId}`;
            const groupSK = `GROUP#${groupId}`;
            return await RBACModel.delete({
                PK: groupPK,
                SK: groupSK
            });
        } catch (error) {
            logger.error('Error deleting group:', error);
            throw error;
        }
    }

    /**
     * Get all groups in a tenant
     */
    static async getAllGroupsInTenant(tenantId) {
        try {

            
            const groupPK = `TENANT#${tenantId}`;
            const groups = await RBACModel.query("PK").eq(groupPK)
                .where('SK').beginsWith('GROUP#')
                .exec();
            
            return groups.map(group => this.cleanGroupResponse(group));
        } catch (error) {
            logger.error('Error getting all groups in tenant:', error);
            throw error;
        }
    }

    /**
     * Add role to group
     */
    static async addRoleToGroup(tenantId, groupId, roleId) {
        try {
            // Group's Role mapping: PK: GROUP#<tenant_id>#<group_id>#ROLES, SK: ROLE#<roleID>
            const groupRolePK = `GROUP#${tenantId}#${groupId}#ROLES`;
            const groupRoleSK = `ROLE#${roleId}`;
            
            const groupRoleItem = {
                PK: groupRolePK,
                SK: groupRoleSK,
                entityType: 'GROUP_ROLE_ASSIGNMENT',
                tenantId,
                groupId,
                roleId,
                createdAt: new Date().toISOString()
            };

            // Role's Group mapping: PK: ROLE#<tenant_id>#<role_id>#GROUPS, SK: GROUP#<groupID>
            const roleGroupPK = `ROLE#${tenantId}#${roleId}#GROUPS`;
            const roleGroupSK = `GROUP#${groupId}`;
            
            const roleGroupItem = {
                PK: roleGroupPK,
                SK: roleGroupSK,
                entityType: 'ROLE_GROUP_ASSIGNMENT',
                tenantId,
                groupId,
                roleId,
                createdAt: new Date().toISOString()
            };
            
            // Create both mappings in parallel
            await Promise.all([
                RBACModel.create(groupRoleItem),
                RBACModel.create(roleGroupItem)
            ]);
            
            return { success: true, groupRoleItem, roleGroupItem };
        } catch (error) {
            logger.error('Error adding role to group:', error);
            throw error;
        }
    }

    /**
     * Remove role from group
     */
    static async removeRoleFromGroup(tenantId, groupId, roleId) {
        try {
            // Remove both mappings in parallel
            const groupRolePK = `GROUP#${tenantId}#${groupId}#ROLES`;
            const groupRoleSK = `ROLE#${roleId}`;
            
            const roleGroupPK = `ROLE#${tenantId}#${roleId}#GROUPS`;
            const roleGroupSK = `GROUP#${groupId}`;
            
            await Promise.all([
                RBACModel.delete({ PK: groupRolePK, SK: groupRoleSK }),
                RBACModel.delete({ PK: roleGroupPK, SK: roleGroupSK })
            ]);
            
            return { success: true };
        } catch (error) {
            logger.error('Error removing role from group:', error);
            throw error;
        }
    }

    /**
     * Get group roles
     */
    static async getGroupRoles(tenantId, groupId) {
        try {
            // PK: GROUP#<tenant_id>#<group_id>#ROLES, SK: ROLE#<roleID>
            const groupRolesPK = `GROUP#${tenantId}#${groupId}#ROLES`;
            const assignments = await RBACModel.query("PK").eq(groupRolesPK).exec();
            
            return assignments.map(assignment => this.cleanGroupResponse(assignment));
        } catch (error) {
            logger.error('Error getting group roles:', error);
            throw error;
        }
    }

    /**
     * Get group members (users)
     */
    static async getGroupMembers(tenantId, groupId) {
        try {
            // PK: GROUP#<tenant_id>#<group_id>#USERS, SK: USER#<userID>
            const groupUsersPK = `GROUP#${tenantId}#${groupId}#USERS`;
            const memberships = await RBACModel.query("PK").eq(groupUsersPK).exec();
            
            return memberships.map(membership => this.cleanGroupResponse(membership));
        } catch (error) {
            logger.error('Error getting group members:', error);
            throw error;
        }
    }

    /**
     * Check if user is member of group
     */
    static async isUserInGroup(tenantId, userId, groupId) {
        try {
            // Check using User's group mapping: PK: USER#<tenant_id>#<user_id>#GROUPS, SK: GROUP#<groupID>
            const userGroupPK = `USER#${tenantId}#${userId}#GROUPS`;
            const userGroupSK = `GROUP#${groupId}`;
            
            logger.info(`Checking if user: ${userId} is in group: ${groupId} in tenant: ${tenantId}`);
            const result = await RBACModel.get({
                PK: userGroupPK,
                SK: userGroupSK
            });
            
            return !!result;
        } catch (error) {
            if (error.name === 'DocumentNotFoundError') {
                return false;
            }
            logger.error('Error checking user group membership:', error);
            throw error;
        }
    }

    /**
     * Get groups by user ID (reverse lookup)
     */
    static async getGroupsByUser(tenantId, userId) {
        try {
            // PK: USER#<tenant_id>#<user_id>#GROUPS, SK: GROUP#<groupID>
            const userGroupsPK = `USER#${tenantId}#${userId}#GROUPS`;
            const memberships = await RBACModel.query("PK").eq(userGroupsPK).exec();
            
            if (!memberships || memberships.length === 0) {
                logger.info(`No groups found for user: ${userId} in tenant: ${tenantId}`);
                return [];
            }
            
            // Extract group IDs from SK format GROUP#<groupID> and fetch full group details (parallel execution)
            const groupQueries = memberships.map(async (membership) => {
                // SK format is GROUP#<groupID>
                const groupId = membership.SK.replace('GROUP#', '');
                
                try {
                    const group = await this.getGroup(tenantId, groupId);
                    return group;
                } catch (error) {
                    logger.warn(`Error getting group details for ${groupId}:`, error);
                    return null;
                }
            });
            
            const groupDetails = await Promise.all(groupQueries);
            
            // Filter out null groups
            const validGroups = groupDetails.filter(group => group !== null);
            
            logger.info(`Found ${validGroups.length} groups for user: ${userId} in tenant: ${tenantId}`);
            return validGroups;
        } catch (error) {
            logger.error('Error getting groups by user:', error);
            throw error;
        }
    }

    /**
     * Get group members (users in a group)
     * Query pattern: PK = GROUP#<tenant_id>#<group_id>#USERS, SK = USER#<userID>
     */
    static async getGroupMembers(tenantId, groupId) {
        try {
            // Query for group members using the documented access pattern
            const groupMembersPK = `GROUP#${tenantId}#${groupId}#USERS`;
            const members = await RBACModel.query("PK").eq(groupMembersPK).exec();
            
            if (!members || members.length === 0) {
                logger.info(`No members found for group: ${groupId} in tenant: ${tenantId}`);
                return [];
            }
            
            logger.info(`Found ${members.length} members for group: ${groupId} in tenant: ${tenantId}`);
            return members;
        } catch (error) {
            logger.error('Error getting group members:', error);
            throw error;
        }
    }

    /**
     * Clean group response by removing internal DynamoDB keys
     */
    static cleanGroupResponse(group) {
        if (!group) return group;
        
        const cleanGroup = { ...group };
        delete cleanGroup.PK;
        delete cleanGroup.SK;
        
        return cleanGroup;
    }
}

module.exports = GroupManagement;
