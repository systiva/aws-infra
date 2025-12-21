const logger = require('../../logger');

/**
 * Authentication middleware to extract user context from API Gateway authorizer
 * Supports both Lambda (via req.apiGateway.event) and header-based auth
 */
const authenticateToken = (req, res, next) => {
  try {
    let userContext = null;

    // Method 1: Extract from API Gateway authorizer context (Lambda with serverless-http)
    if (req.apiGateway && req.apiGateway.event) {
      const event = req.apiGateway.event;
      const authorizer = event.requestContext?.authorizer;
      
      if (authorizer) {
        userContext = {
          sub: authorizer.userId || authorizer.sub,
          username: authorizer.username || authorizer['cognito:username'],
          email: authorizer.email,
          accountId: authorizer.accountId || authorizer['custom:account_id'],
          userRole: authorizer.userRole || authorizer['custom:user_role'],
          roles: authorizer.roles ? (typeof authorizer.roles === 'string' ? JSON.parse(authorizer.roles) : authorizer.roles) : [],
          groups: authorizer.groups ? (typeof authorizer.groups === 'string' ? JSON.parse(authorizer.groups) : authorizer.groups) : [],
          permissions: authorizer.permissions ? (typeof authorizer.permissions === 'string' ? JSON.parse(authorizer.permissions) : authorizer.permissions) : []
        };
        
        logger.debug('User context from API Gateway authorizer', { 
          userId: userContext.sub,
          accountId: userContext.accountId
        });
      }
    }
    
    // Method 2: Fallback to headers (for backward compatibility or custom setups)
    if (!userContext) {
      const userId = req.headers['x-user-id'] || req.headers['x-user-sub'];
      const username = req.headers['x-user-name'] || req.headers['x-username'];
      const email = req.headers['x-user-email'];
      const accountId = req.headers['x-account-id'];
      const roles = req.headers['x-user-roles'] ? req.headers['x-user-roles'].split(',') : [];
      const groups = req.headers['x-user-groups'] ? req.headers['x-user-groups'].split(',') : [];

      if (userId || username || email) {
        userContext = {
          sub: userId,
          username: username,
          email: email,
          accountId: accountId,
          roles: roles,
          groups: groups
        };
        
        logger.debug('User context from headers', { 
          userId: userContext.sub,
          accountId: userContext.accountId
        });
      }
    }

    // If we have user context, set it on req.user
    if (userContext) {
      req.user = userContext;

      logger.info('User context from authorizer', { 
        userId: req.user.sub, 
        username: req.user.username,
        accountId: req.user.accountId 
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