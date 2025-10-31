const jwtAuthorizerMiddleware = require('./jwt-authorizer');
const { authenticateToken } = require('./auth');
const logger = require('../../logger');

/**
 * Conditional authentication middleware for protected routes
 * Uses embedded JWT authorizer for local development
 * Uses header-based auth for production (expects API Gateway authorizer headers)
 * Returns 401 errors when authentication fails
 */
const conditionalAuthProtected = (req, res, next) => {
  const useLocalAuth = process.env.NODE_ENV === 'development' || 
                      process.env.USE_LOCAL_AUTH === 'true';

  if (useLocalAuth) {
    logger.debug('Using local JWT authorizer middleware (protected)');
    return jwtAuthorizerMiddleware(req, res, next);
  } else {
    logger.debug('Using header-based authentication (production mode, protected)');
    return authenticateToken(req, res, next);
  }
};

module.exports = { conditionalAuthProtected };