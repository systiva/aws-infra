const tenantRegistryService = require('../services/tenant-registry');
const stsService = require('../services/sts-service');
const logger = require('../../logger');

/**
 * Assume cross-account role to access tenant's DynamoDB table
 * Middleware flow:
 * 1. Query tenant registry to get AWS account ID and table name
 * 2. Assume cross-account role in tenant account
 * 3. Store credentials and table info in request context
 */
const assumeRoleMiddleware = async (req, res, next) => {
    try {
        const tenantId = req.tenantId;
        
        logger.debug('Fetching tenant information from registry', { tenantId });
        
        // Get tenant information from registry
        const tenantInfo = await tenantRegistryService.getTenantInfo(tenantId);
        
        if (!tenantInfo) {
            logger.warn('Tenant not found in registry', { tenantId });
            return res.status(404).json({ 
                error: 'Not Found', 
                message: 'Tenant not found in registry' 
            });
        }
        
        // Check if tenant is active
        if (tenantInfo.status !== 'ACTIVE') {
            logger.warn('Tenant is not active', { tenantId, status: tenantInfo.status });
            return res.status(403).json({ 
                error: 'Forbidden', 
                message: `Tenant is ${tenantInfo.status}. Access denied.` 
            });
        }
        
        logger.debug('Tenant info retrieved', { 
            tenantId, 
            awsAccountId: tenantInfo.awsAccountId,
            orderTableName: tenantInfo.orderTableName 
        });
        
        // Assume cross-account role
        logger.debug('Assuming cross-account role', { 
            tenantId, 
            awsAccountId: tenantInfo.awsAccountId 
        });
        
        const credentials = await stsService.assumeTenantRole(
            tenantInfo.awsAccountId,
            tenantId
        );
        
        logger.debug('Cross-account role assumed successfully', { tenantId });
        
        // Store tenant context in request
        req.tenantContext = {
            tenantId: tenantInfo.tenantId,
            awsAccountId: tenantInfo.awsAccountId,
            orderTableName: tenantInfo.orderTableName,
            tableType: tenantInfo.tableType,
            credentials: credentials
        };
        
        next();
    } catch (error) {
        logger.error({
            msg: 'Assume role middleware error',
            errorMessage: error.message,
            errorCode: error.code,
            errorName: error.name,
            tenantId: req.tenantId,
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
