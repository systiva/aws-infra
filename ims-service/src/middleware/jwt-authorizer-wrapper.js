const jwtAuthorizer = require('jwt-authorizer');
const logger = require('../../logger');

/**
 * Express middleware wrapper for JWT Lambda Authorizer
 * Adapts the Lambda authorizer to work as Express middleware
 */
const jwtAuthorizerMiddleware = async (req, res, next) => {
  try {
    logger.info('JWT Authorizer Middleware - Processing request', { 
      method: req.method, 
      url: req.url 
    });

    // Create Lambda-like event object from Express request
    const lambdaEvent = createLambdaEvent(req);

    // Call the Lambda authorizer handler
    const authResult = await jwtAuthorizer.handler(lambdaEvent);

    if (authResult.policyDocument.Statement[0].Effect === 'Allow') {
      // Authorization successful - extract user context
      const context = authResult.context || {};
      
      // Set user context headers to simulate API Gateway behavior
      setUserContextHeaders(req, context);

      // Also set req.user for backward compatibility
      req.user = {
        sub: context.userId,
        username: extractUsernameFromContext(context),
        email: context.email || '',
        tenantId: context.tenantId || '',
        userRole: context.userRole || '',
        roles: parseJsonSafely(context.permissions) || [],
        groups: parseJsonSafely(context.groups) || [],
        permissions: parseJsonSafely(context.permissions) || []
      };

      logger.info('User authenticated via Lambda authorizer', { 
        userId: req.user.sub,
        tenantId: req.user.tenantId
      });
      
      next();
    } else {
      logger.warn('Authorization denied by Lambda authorizer');
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Access denied'
      });
    }

  } catch (error) {
    logger.error('JWT Authorizer Middleware error', { error: error.message });
    return res.status(401).json({
      error: 'Unauthorized',
      message: 'Authentication failed'
    });
  }
};

/**
 * Create Lambda event object from Express request
 */
function createLambdaEvent(req) {
  return {
    type: 'REQUEST',
    methodArn: `arn:aws:execute-api:us-east-1:123456789012:api/dev/${req.method}${req.path}`,
    resource: req.path,
    path: req.path,
    httpMethod: req.method,
    headers: {
      ...req.headers,
      // Normalize header case for Lambda compatibility
      Authorization: req.headers.authorization || req.headers.Authorization
    },
    queryStringParameters: req.query,
    requestContext: {
      accountId: '123456789012',
      apiId: 'local-api',
      stage: 'dev',
      requestId: `local-${Date.now()}`,
      identity: {
        sourceIp: req.ip || '127.0.0.1'
      }
    }
  };
}

/**
 * Set user context headers to simulate API Gateway behavior
 */
function setUserContextHeaders(req, context) {
  req.headers['x-user-id'] = context.userId || '';
  req.headers['x-user-name'] = extractUsernameFromContext(context);
  req.headers['x-user-email'] = context.email || '';
  req.headers['x-tenant-id'] = context.tenantId || '';
  req.headers['x-user-role'] = context.userRole || '';
  
  // Handle permissions and groups (they might be JSON strings)
  const permissions = parseJsonSafely(context.permissions) || [];
  const groups = parseJsonSafely(context.groups) || [];
  
  req.headers['x-user-groups'] = Array.isArray(groups) ? groups.join(',') : '';
  req.headers['x-user-permissions'] = JSON.stringify(permissions);
}

/**
 * Extract username from context (could be in various fields)
 */
function extractUsernameFromContext(context) {
  return context.username || context.email || context.userId || '';
}

/**
 * Safely parse JSON string, return null if invalid
 */
function parseJsonSafely(jsonString) {
  if (!jsonString) return null;
  if (typeof jsonString !== 'string') return jsonString;
  
  try {
    return JSON.parse(jsonString);
  } catch (error) {
    logger.debug('Failed to parse JSON', { jsonString, error: error.message });
    return null;
  }
}

module.exports = jwtAuthorizerMiddleware;