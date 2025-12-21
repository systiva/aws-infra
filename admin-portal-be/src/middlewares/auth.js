/**
 * Authentication Middleware
 * Extracts JWT claims from API Gateway authorizer context and injects user context
 */

const Logger = require('../../logger');

/**
 * Extract JWT claims from API Gateway request context
 * API Gateway custom authorizer adds validated JWT claims to requestContext.authorizer
 */
const extractJwtFromApiGateway = (req) => {
  try {
    // Check if request came through serverless-http (Lambda)
    if (req.apiGateway && req.apiGateway.event) {
      const event = req.apiGateway.event;
      
      // Extract claims from authorizer context
      const authorizer = event.requestContext?.authorizer;
      
      if (authorizer) {
        Logger.debug({ authorizer }, 'JWT claims from API Gateway authorizer');
        
        return {
          // JWT authorizer sends 'userId' not 'sub'
          sub: authorizer.userId || authorizer.sub,
          email: authorizer.email,
          // JWT authorizer sends 'username' directly, not 'cognito:username'
          username: authorizer.username || authorizer['cognito:username'],
          // JWT authorizer sends 'accountId' directly, not 'custom:account_id'
          accountId: authorizer.accountId || authorizer['custom:account_id'],
          groups: authorizer.groups ? (typeof authorizer.groups === 'string' ? JSON.parse(authorizer.groups) : authorizer.groups) : [],
          permissions: authorizer.permissions ? (typeof authorizer.permissions === 'string' ? JSON.parse(authorizer.permissions) : authorizer.permissions) : []
        };
      }
    }

    // Fallback: Try to extract from Authorization header (for local development)
    const authHeader = req.headers.authorization || req.headers.Authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      Logger.debug('JWT token found in Authorization header (local mode)');
      
      // In production, API Gateway handles JWT validation
      // In local development, we'd need to decode the JWT here
      // For now, just log that we found it
      return {
        sub: 'local-dev-user',
        email: 'dev@example.com',
        username: 'local-dev',
        accountId: 'local-account',
        groups: [],
        permissions: []
      };
    }

    return null;
  } catch (error) {
    Logger.error({ error }, 'Error extracting JWT claims');
    return null;
  }
};

/**
 * Authentication middleware
 * Injects user context from JWT claims into req.user
 */
const authMiddleware = (req, res, next) => {
  try {
    const userClaims = extractJwtFromApiGateway(req);
    
    if (!userClaims) {
      Logger.warn({ 
        path: req.path, 
        method: req.method,
        headers: req.headers 
      }, 'No JWT claims found in request - unauthorized access attempt');
      
      return res.status(401).json({
        result: 'failed',
        msg: 'Unauthorized - No authentication token provided'
      });
    }

    // Validate required fields
    if (!userClaims.sub || !userClaims.email) {
      Logger.warn({ userClaims }, 'Invalid JWT claims - missing required fields');
      
      return res.status(401).json({
        result: 'failed',
        msg: 'Unauthorized - Invalid authentication token'
      });
    }

    // Inject user context into request
    req.user = {
      userId: userClaims.sub,
      email: userClaims.email,
      username: userClaims.username || userClaims.email,
      accountId: userClaims.accountId,
      groups: userClaims.groups || [],
      permissions: userClaims.permissions || []
    };

    Logger.debug({ 
      user: req.user,
      path: req.path,
      method: req.method
    }, 'User authenticated successfully');
    
    next();
  } catch (error) {
    Logger.error({ error }, 'Authentication middleware error');
    
    return res.status(500).json({
      result: 'failed',
      msg: 'Internal server error during authentication'
    });
  }
};

/**
 * Optional auth middleware
 * Attempts to inject user context but doesn't fail if not present
 * Useful for endpoints that work with or without authentication
 */
const optionalAuthMiddleware = (req, res, next) => {
  try {
    const userClaims = extractJwtFromApiGateway(req);
    
    if (userClaims && userClaims.sub && userClaims.email) {
      req.user = {
        userId: userClaims.sub,
        email: userClaims.email,
        username: userClaims.username || userClaims.email,
        accountId: userClaims.accountId,
        groups: userClaims.groups || [],
        permissions: userClaims.permissions || []
      };
      
      Logger.debug({ user: req.user }, 'Optional auth: User authenticated');
    } else {
      Logger.debug('Optional auth: No valid JWT claims - proceeding without authentication');
    }
    
    next();
  } catch (error) {
    Logger.error({ error }, 'Optional auth middleware error');
    // Don't fail the request, just log the error
    next();
  }
};

module.exports = {
  authMiddleware,
  optionalAuthMiddleware
};
