const accountRegistryService = require('../services/account-registry');
const stsService = require('../services/sts-service');
const logger = require('../../logger');

/**
 * Assume cross-account role to access account's DynamoDB table
 * Middleware flow:
 * 1. Query account registry to get AWS account ID and table name
 * 2. Assume cross-account role in account account
 * 3. Store credentials and table info in request context
 */
const assumeRoleMiddleware = async (req, res, next) => {
    try {
        const accountId = req.accountId;
        
        logger.debug('Fetching account information from registry', { accountId });
        
        // Get account information from registry
        const accountInfo = await accountRegistryService.getAccountInfo(accountId);
        
        if (!accountInfo) {
            logger.warn('Account not found in registry', { accountId });
            return res.status(404).json({ 
                error: 'Not Found', 
                message: 'Account not found in registry' 
            });
        }
        
        // Check if account is active
        if (accountInfo.status !== 'ACTIVE') {
            logger.warn('Account is not active', { accountId, status: accountInfo.status });
            return res.status(403).json({ 
                error: 'Forbidden', 
                message: `Account is ${accountInfo.status}. Access denied.` 
            });
        }
        
        logger.debug('Account info retrieved', { 
            accountId, 
            awsAccountId: accountInfo.awsAccountId,
            orderTableName: accountInfo.orderTableName 
        });
        
        // Assume cross-account role
        logger.debug('Assuming cross-account role', { 
            accountId, 
            awsAccountId: accountInfo.awsAccountId 
        });
        
        const credentials = await stsService.assumeAccountRole(
            accountInfo.awsAccountId,
            accountId
        );
        
        logger.debug('Cross-account role assumed successfully', { accountId });
        
        // Store account context in request
        req.accountContext = {
            accountId: accountInfo.accountId,
            awsAccountId: accountInfo.awsAccountId,
            orderTableName: accountInfo.orderTableName,
            tableType: accountInfo.tableType,
            credentials: credentials
        };
        
        next();
    } catch (error) {
        logger.error({
            msg: 'Assume role middleware error',
            errorMessage: error.message,
            errorCode: error.code,
            errorName: error.name,
            accountId: req.accountId,
            stack: error.stack
        });
        
        if (error.code === 'AccessDenied') {
            return res.status(403).json({ 
                error: 'Forbidden', 
                message: 'Cross-account access denied' 
            });
        }
        
        return res.status(500).json({ 
            error: 'Internal Server Error', 
            message: 'Failed to establish cross-account access' 
        });
    }
};

module.exports = assumeRoleMiddleware;
