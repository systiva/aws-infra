const AWS = require('aws-sdk');
const config = require('../../config');
const logger = require('../../logger');

// Initialize STS client
const sts = new AWS.STS({
    region: config.AWS_REGION
});

/**
 * STS Service
 * Handles AWS STS operations for cross-account access
 */
class STSService {
    
    /**
     * Assume cross-account role in account AWS account
     * @param {string} accountAwsAccountId - Account's AWS account ID
     * @param {string} accountId - Account identifier (for session naming)
     * @returns {Promise<Object>} Temporary AWS credentials
     */
    async assumeAccountRole(accountAwsAccountId, accountId) {
        try {
            const roleArn = `arn:aws:iam::${accountAwsAccountId}:role/${config.CROSS_ACCOUNT_ROLE_NAME}`;
            const sessionName = `oms-${accountId}-${Date.now()}`;
            
            logger.debug('Assuming cross-account role', { 
                roleArn, 
                sessionName,
                accountId,
                accountAwsAccountId
            });
            
            const params = {
                RoleArn: roleArn,
                RoleSessionName: sessionName,
                DurationSeconds: config.ASSUME_ROLE_DURATION,
                ExternalId: config.CROSS_ACCOUNT_EXTERNAL_ID
            };
            
            const result = await sts.assumeRole(params).promise();
            
            if (!result.Credentials) {
                throw new Error('No credentials returned from STS AssumeRole');
            }
            
            logger.debug('Cross-account role assumed successfully', { 
                accountId,
                expiration: result.Credentials.Expiration
            });
            
            return {
                accessKeyId: result.Credentials.AccessKeyId,
                secretAccessKey: result.Credentials.SecretAccessKey,
                sessionToken: result.Credentials.SessionToken,
                expiration: result.Credentials.Expiration
            };
            
        } catch (error) {
            const roleArn = `arn:aws:iam::${accountAwsAccountId}:role/${config.CROSS_ACCOUNT_ROLE_NAME}`;
            logger.error({
                msg: 'Error assuming cross-account role',
                errorMessage: error.message,
                errorCode: error.code,
                errorName: error.name,
                accountId,
                accountAwsAccountId,
                roleArn,
                externalId: config.CROSS_ACCOUNT_EXTERNAL_ID,
                roleName: config.CROSS_ACCOUNT_ROLE_NAME,
                stack: error.stack
            });
            
            // Re-throw with more context
            if (error.code === 'AccessDenied') {
                const enhancedError = new Error(`Cross-account access denied for account ${accountId}`);
                enhancedError.code = 'AccessDenied';
                throw enhancedError;
            }
            
            throw error;
        }
    }
    
    /**
     * Get caller identity (for debugging)
     * @returns {Promise<Object>} Caller identity information
     */
    async getCallerIdentity() {
        try {
            const result = await sts.getCallerIdentity().promise();
            logger.debug('Caller identity', result);
            return result;
        } catch (error) {
            logger.error('Error getting caller identity', { error: error.message });
            throw error;
        }
    }
}

module.exports = new STSService();
