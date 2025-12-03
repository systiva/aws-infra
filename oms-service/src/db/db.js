const AWS = require('aws-sdk');
const dynamoose = require('dynamoose');
const config = require('../../config');
const logger = require('../../logger');

/**
 * Create DynamoDB DocumentClient with tenant-specific credentials
 * Uses AWS SDK directly like create-infra-worker for cross-account operations
 * 
 * @param {Object} credentials - Temporary AWS credentials from STS
 * @param {string} tableName - DynamoDB table name  
 * @param {string} region - AWS region
 * @returns {Object} AWS DocumentClient configured with tenant credentials
 */
function createTenantDynamooseInstance(credentials, tableName, region = config.AWS_REGION) {
    try {
        logger.debug({ tableName, region }, 'Creating tenant DynamoDB DocumentClient');
        
        // Use AWS SDK DocumentClient directly with assumed role credentials
        // This is the same pattern as create-infra-worker for cross-account operations
        const docClient = new AWS.DynamoDB.DocumentClient({
            region: region,
            accessKeyId: credentials.accessKeyId,
            secretAccessKey: credentials.secretAccessKey,
            sessionToken: credentials.sessionToken
        });
        
        logger.debug('Tenant DynamoDB DocumentClient created successfully');
        
        return {
            tableName,
            docClient
        };
        
    } catch (error) {
        logger.error({ 
            error: error.message,
            tableName,
            stack: error.stack
        }, 'Error creating tenant DynamoDB DocumentClient');
        throw error;
    }
}

/**
 * Initialize default Dynamoose configuration (for admin account operations)
 * Similar to admin-portal-be pattern
 */
function initializeDefaultDynamoose() {
    try {
        logger.debug('Initializing default Dynamoose configuration');
        
        const ddbConfig = {
            region: config.AWS_REGION
        };
        
        const ddb = new dynamoose.aws.ddb.DynamoDB(ddbConfig);
        dynamoose.aws.ddb.set(ddb);
        
        logger.info({ region: config.AWS_REGION }, 'Default Dynamoose initialized');
        
    } catch (error) {
        logger.error({ 
            error: error.message,
            stack: error.stack
        }, 'Error initializing default Dynamoose');
        throw error;
    }
}

module.exports = {
    dynamoose,
    createTenantDynamooseInstance,
    initializeDefaultDynamoose
};
