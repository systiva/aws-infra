const AWS = require('aws-sdk');
const config = require('../../config');
const logger = require('../../logger');

// Initialize DynamoDB client
const dynamodb = new AWS.DynamoDB.DocumentClient({
    region: config.AWS_REGION
});

/**
 * Tenant Registry Service
 * Queries tenant information from TenantRegistry table in admin account
 */
class TenantRegistryService {
    
    /**
     * Get tenant information by tenant ID
     * @param {string} tenantId - Tenant identifier
     * @returns {Promise<Object|null>} Tenant information or null if not found
     */
    async getTenantInfo(tenantId) {
        try {
            logger.debug('Querying tenant registry', { tenantId });
            
            const params = {
                TableName: config.TENANT_REGISTRY_TABLE,
                Key: {
                    PK: `TENANT#${tenantId}`,
                    SK: 'METADATA'
                }
            };
            
            const result = await dynamodb.get(params).promise();
            
            if (!result.Item) {
                logger.warn('Tenant not found in registry', { tenantId });
                return null;
            }
            
            const tenant = result.Item;
            
            // Validate required fields
            if (!tenant.tenantAccountId) {
                logger.error('Tenant missing tenantAccountId', { tenantId });
                throw new Error('Invalid tenant configuration: missing AWS account ID');
            }
            
            // Calculate table name based on subscription tier
            // Public tier: TENANT_PUBLIC (shared table)
            // Private tier: TENANT_<tenantId> (dedicated table)
            const subscriptionTier = tenant.subscriptionTier || 'private';
            const orderTableName = subscriptionTier === 'public' 
                ? 'TENANT_PUBLIC' 
                : `TENANT_${tenant.tenantId}`;
            
            logger.debug('Tenant info retrieved successfully', { 
                tenantId,
                awsAccountId: tenant.tenantAccountId,
                subscriptionTier,
                orderTableName
            });
            
            return {
                tenantId: tenant.tenantId,
                name: tenant.name,
                awsAccountId: tenant.tenantAccountId,
                orderTableName: orderTableName,
                subscriptionTier: subscriptionTier,
                status: tenant.status || 'ACTIVE',
                metadata: tenant.metadata || {}
            };
            
        } catch (error) {
            logger.error('Error fetching tenant info from registry', { 
                error: error.message,
                tenantId,
                stack: error.stack
            });
            throw error;
        }
    }
    
    /**
     * Check if tenant exists and is active
     * @param {string} tenantId - Tenant identifier
     * @returns {Promise<boolean>} True if tenant exists and is active
     */
    async isTenantActive(tenantId) {
        try {
            const tenantInfo = await this.getTenantInfo(tenantId);
            return tenantInfo && tenantInfo.status === 'ACTIVE';
        } catch (error) {
            logger.error('Error checking tenant status', { error: error.message, tenantId });
            return false;
        }
    }
}

module.exports = new TenantRegistryService();
