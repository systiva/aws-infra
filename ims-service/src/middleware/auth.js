const logger = require('../../logger');

/**
 * Authentication middleware to extract user context from headers set by the authorizer service
 * This assumes the authorizer service has already validated the JWT and set user context headers
 */
const authenticateToken = (req, res, next) => {
  try {
    // Extract user context from headers set by the authorizer service
    const userId = req.headers['x-user-id'] || req.headers['x-user-sub'];
    const username = req.headers['x-user-name'] || req.headers['x-username'];
    const email = req.headers['x-user-email'];
    const tenantId = req.headers['x-tenant-id'];
    const roles = req.headers['x-user-roles'] ? req.headers['x-user-roles'].split(',') : [];
    const groups = req.headers['x-user-groups'] ? req.headers['x-user-groups'].split(',') : [];

    // If we have user context from authorizer, use it
    if (userId || username || email) {
      req.user = {
        sub: userId,
        username: username,
        email: email,
        tenantId: tenantId,
        roles: roles,
        groups: groups
      };

      logger.info('User context from authorizer', { 
        userId: req.user.sub, 
        username: req.user.username,
        tenantId: req.user.tenantId 
      });
    } else {
      // Check if Authorization header exists, if so, it should have been processed
      const authHeader = req.headers['authorization'];
      if (authHeader) {
        logger.warn('Authorization header present but no user context found');
        return res.status(401).json({
          error: 'Unauthorized',
          message: 'Invalid or expired authentication token'
        });
      }
      
      // No authorization header and no user context - might be a public endpoint
      logger.debug('No authorization header or user context found');
    }

    next();
  } catch (error) {
    logger.error('Authentication middleware error', { error: error.message });
    return res.status(401).json({
      error: 'Unauthorized',
      message: 'Authentication failed'
    });
  }
};

module.exports = { authenticateToken };

module.exports = { authenticateToken };