const jwtAuthorizerMiddleware = require('./jwt-authorizer');
const { authenticateToken } = require('./auth');
const logger = require('../../logger');

/**
 * Conditional authentication middleware for protected routes
 * Uses embedded JWT authorizer for local development only
 * Uses header-based auth for all Lambda deployments (dev, qa, prod)
 * Returns 401 errors when authentication fails
 */
const conditionalAuthProtected = (req, res, next) => {
  // Only use local auth when running locally (not in Lambda)
  const useLocalAuth = process.env.NODE_ENV === 'development' && !process.env.AWS_LAMBDA_FUNCTION_NAME;

  if (useLocalAuth) {
    logger.debug('Using local JWT authorizer middleware (protected) - Local development mode');
    return jwtAuthorizerMiddleware(req, res, next);
  } else {
    logger.debug('Using header-based authentication (Lambda deployment) - API Gateway handles auth');
    return authenticateToken(req, res, next);
  }
};

module.exports = { conditionalAuthProtected };