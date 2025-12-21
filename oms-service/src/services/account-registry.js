const AWS = require('aws-sdk');
const config = require('../../config');
const logger = require('../../logger');

// Initialize DynamoDB client
const dynamodb = new AWS.DynamoDB.DocumentClient({
    region: config.AWS_REGION
});

/**
 * Account Registry Service
 * Queries account information from AccountRegistry table in admin account
 */
class AccountRegistryService {
    
    /**
     * Get account information by account ID
     * @param {string} accountId - Account identifier
     * @returns {Promise<Object|null>} Account information or null if not found
     */
    async getAccountInfo(accountId) {
        try {
            logger.debug('Querying account registry', { accountId });
            
            const params = {
                TableName: config.ACCOUNT_REGISTRY_TABLE,
                Key: {
                    PK: `ACCOUNT#${accountId}`,
                    SK: 'METADATA'
                }
            };
            
            const result = await dynamodb.get(params).promise();
            
            if (!result.Item) {
                logger.warn('Account not found in registry', { accountId });
                return null;
            }
            
            const account = result.Item;
            
            // Validate required fields
            if (!account.accountAccountId) {
                logger.error('Account missing accountAccountId', { accountId });
                throw new Error('Invalid account configuration: missing AWS account ID');
            }
            
            // Calculate table name based on subscription tier
            // Public tier: ACCOUNT_PUBLIC (shared table)
            // Private tier: ACCOUNT_<accountId> (dedicated table)
            const subscriptionTier = account.subscriptionTier || 'private';
            const orderTableName = subscriptionTier === 'public' 
                ? 'ACCOUNT_PUBLIC' 
                : `ACCOUNT_${account.accountId}`;
            
            logger.debug('Account info retrieved successfully', { 
                accountId,
                awsAccountId: account.accountAccountId,
                subscriptionTier,
                orderTableName
            });
            
            return {
                accountId: account.accountId,
                name: account.name,
                awsAccountId: account.accountAccountId,
                orderTableName: orderTableName,
                subscriptionTier: subscriptionTier,
                status: account.status || 'ACTIVE',
                metadata: account.metadata || {}
            };
            
        } catch (error) {
            logger.error('Error fetching account info from registry', { 
                error: error.message,
                accountId,
                stack: error.stack
            });
            throw error;
        }
    }
    
    /**
     * Check if account exists and is active
     * @param {string} accountId - Account identifier
     * @returns {Promise<boolean>} True if account exists and is active
     */
    async isAccountActive(accountId) {
        try {
            const accountInfo = await this.getAccountInfo(accountId);
            return accountInfo && accountInfo.status === 'ACTIVE';
        } catch (error) {
            logger.error('Error checking account status', { error: error.message, accountId });
            return false;
        }
    }
}

module.exports = new AccountRegistryService();
