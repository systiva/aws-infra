const logger = require('../../logger');

/**
 * Extract and validate account ID from user context
 * Ensures account ID is present before proceeding
 */
const accountMiddleware = (req, res, next) => {
    try {
        const accountId = req.user?.accountId;
        
        if (!accountId) {
            logger.warn('AccountID missing in user context', { 
                userId: req.user?.userId 
            });
            return res.status(400).json({ 
                error: 'Bad Request', 
                message: 'AccountID missing in access token' 
            });
        }
        
        // Attach account ID to request for easy access
        req.accountId = accountId;
        
        logger.debug('Account validated', { accountId });
        
        next();
    } catch (error) {
        logger.error('Account middleware error', { error: error.message });
        return res.status(500).json({ 
            error: 'Internal Server Error', 
            message: 'Account validation failed' 
        });
    }
};

module.exports = accountMiddleware;
