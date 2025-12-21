const { RBACModel } = require('../db');
const logger = require('../../../logger');

/**
 * User Management Access Patterns
 */
class UserManagement {
    
    /**
     * Create a new user
     */
    static async createUser(accountId, userData) {
        try {

            
            const userPK = `ACCOUNT#${accountId}`;
            const userSK = `USER#${userData.userId}`;
            
            const userItem = {
                PK: userPK,
                SK: userSK,
                entityType: 'USER',
                accountId,
                userId: userData.userId,
                email: userData.email,
                firstName: userData.firstName,
                lastName: userData.lastName,
                status: userData.status || 'ACTIVE',
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
                ...userData
            };
            return await RBACModel.create(userItem);
        } catch (error) {
            logger.error('Error creating user:', error);
            throw error;
        }
    }

    /**
     * Get user by ID
     */
    static async getUser(accountId, userId) {
        try {

            
            const userPK = `ACCOUNT#${accountId}`;
            const userSK = `USER#${userId}`;
            const result = await RBACModel.get({
                PK: userPK,
                SK: userSK
            });
            
            return this.cleanUserResponse(result);
        } catch (error) {
            if (error.name === 'DocumentNotFoundError') {
                return null;
            }
            logger.error('Error getting user:', error);
            throw error;
        }
    }

    /**
     * Get user by email
     */
    static async getUserByEmail(accountId, email) {
        try {

            
            const userPK = `ACCOUNT#${accountId}`;
            const users = await RBACModel.query("PK").eq(userPK)
                .where('SK').beginsWith('USER#')
                .filter('email').eq(email)
                .exec();
            
            if (users && users.length > 0) {
                return this.cleanUserResponse(users[0]);
            }
            return null;
        } catch (error) {
            logger.error('Error getting user by email:', error);
            throw error;
        }
    }

    /**
     * Update user
     */
    static async updateUser(accountId, userId, updateData) {
        try {

            
            const userPK = `ACCOUNT#${accountId}`;
            const userSK = `USER#${userId}`;
            
            const updateItem = {
                ...updateData,
                updatedAt: new Date().toISOString()
            };
            const result = await RBACModel.update(
                { PK: userPK, SK: userSK },
                { $SET: updateItem }
            );
            
            return this.cleanUserResponse(result);
        } catch (error) {
            logger.error('Error updating user:', error);
            throw error;
        }
    }

    /**
     * Delete user
     */
    static async deleteUser(accountId, userId) {
        try {

            
            const userPK = `ACCOUNT#${accountId}`;
            const userSK = `USER#${userId}`;
            return await RBACModel.delete({
                PK: userPK,
                SK: userSK
            });
        } catch (error) {
            logger.error('Error deleting user:', error);
            throw error;
        }
    }

    /**
     * Get all users in a account
     */
    static async getAllUsersInAccount(accountId) {
        try {

            
            const userPK = `ACCOUNT#${accountId}`;
            const users = await RBACModel.query("PK").eq(userPK)
                .where('SK').beginsWith('USER#')
                .exec();
            
            return users.map(user => this.cleanUserResponse(user));
        } catch (error) {
            logger.error('Error getting all users in account:', error);
            throw error;
        }
    }

    /**
     * Get user groups
     */
    static async getUserGroups(accountId, userId) {
        try {
            // PK: USER#<account_id>#<user_id>#GROUPS, SK: GROUP#<groupID>
            const userGroupsPK = `USER#${accountId}#${userId}#GROUPS`;
            
            logger.info(`Querying user groups with PK: ${userGroupsPK}`);
            const memberships = await RBACModel.query("PK").eq(userGroupsPK).exec();
            
            logger.info(`Found ${memberships.length} group memberships for user ${userId}`);
            return memberships.map(membership => this.cleanUserResponse(membership));
        } catch (error) {
            logger.error('Error getting user groups:', error);
            
            // If it's an index error, return empty array instead of throwing
            if (error.message && error.message.includes("Index can't be found")) {
                logger.warn(`No group memberships found for user ${userId} - returning empty array`);
                return [];
            }
            
            throw error;
        }
    }

    /**
     * Add user to group
     */
    static async addUserToGroup(accountId, userId, groupId) {
        try {
            // User's group mapping: PK: USER#<account_id>#<user_id>#GROUPS, SK: GROUP#<groupID>
            const userGroupPK = `USER#${accountId}#${userId}#GROUPS`;
            const userGroupSK = `GROUP#${groupId}`;
            
            const userGroupItem = {
                PK: userGroupPK,
                SK: userGroupSK,
                entityType: 'USER_GROUP_MEMBERSHIP',
                accountId,
                userId,
                groupId,
                createdAt: new Date().toISOString()
            };

            // Group's user mapping: PK: GROUP#<account_id>#<group_id>#USERS, SK: USER#<userID>
            const groupUserPK = `GROUP#${accountId}#${groupId}#USERS`;
            const groupUserSK = `USER#${userId}`;
            
            const groupUserItem = {
                PK: groupUserPK,
                SK: groupUserSK,
                entityType: 'GROUP_USER_MEMBERSHIP',
                accountId,
                userId,
                groupId,
                createdAt: new Date().toISOString()
            };
            
            // Create both mappings in parallel
            await Promise.all([
                RBACModel.create(userGroupItem),
                RBACModel.create(groupUserItem)
            ]);
            
            return { success: true, userGroupItem, groupUserItem };
        } catch (error) {
            logger.error('Error adding user to group:', error);
            throw error;
        }
    }

    /**
     * Remove user from group
     */
    static async removeUserFromGroup(accountId, userId, groupId) {
        try {
            // Remove both mappings in parallel
            const userGroupPK = `USER#${accountId}#${userId}#GROUPS`;
            const userGroupSK = `GROUP#${groupId}`;
            
            const groupUserPK = `GROUP#${accountId}#${groupId}#USERS`;
            const groupUserSK = `USER#${userId}`;
            
            await Promise.all([
                RBACModel.delete({ PK: userGroupPK, SK: userGroupSK }),
                RBACModel.delete({ PK: groupUserPK, SK: groupUserSK })
            ]);
            
            return { success: true };
        } catch (error) {
            logger.error('Error removing user from group:', error);
            throw error;
        }
    }

    /**
     * Clean user response by removing internal DynamoDB keys
     */
    static cleanUserResponse(user) {
        if (!user) return user;
        
        const cleanUser = { ...user };
        delete cleanUser.PK;
        delete cleanUser.SK;
        
        return cleanUser;
    }
}

module.exports = UserManagement;
