const logger = require('../../logger');

/**
 * Extract and validate tenant ID from user context
 * Ensures tenant ID is present before proceeding
 */
const tenantMiddleware = (req, res, next) => {
    try {
        const tenantId = req.user?.tenantId;
        
        if (!tenantId) {
            logger.warn('TenantID missing in user context', { 
                userId: req.user?.userId 
            });
            return res.status(400).json({ 
                error: 'Bad Request', 
                message: 'TenantID missing in access token' 
            });
        }
        
        // Attach tenant ID to request for easy access
        req.tenantId = tenantId;
        
        logger.debug('Tenant validated', { tenantId });
        
        next();
    } catch (error) {
        logger.error('Tenant middleware error', { error: error.message });
        return res.status(500).json({ 
            error: 'Internal Server Error', 
            message: 'Tenant validation failed' 
        });
    }
};

module.exports = tenantMiddleware;
