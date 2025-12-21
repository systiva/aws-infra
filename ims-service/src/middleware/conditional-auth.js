const { authenticateToken } = require('./auth');
const logger = require('../../logger');

/**
 * Conditional authentication middleware for public routes
 * Uses embedded JWT authorizer for local development only
 * Uses header-based auth for all Lambda deployments (dev, qa, prod)
 * Continues execution even if authentication fails (for public routes)
 */
const conditionalAuth = (req, res, next) => {
  // Only use local auth when running locally (not in Lambda)
  const useLocalAuth = process.env.NODE_ENV === 'development' && !process.env.AWS_LAMBDA_FUNCTION_NAME;

  if (useLocalAuth) {
    logger.debug('Using local JWT authorizer middleware (public) - Local development mode');
    return conditionalAuthPublic(req, res, next);
  } else {
    logger.debug('Using header-based authentication (Lambda deployment) - API Gateway handles auth');
    return authenticateTokenPublic(req, res, next);
  }
};

/**
 * Public version of JWT authorizer that doesn't return 401 errors
 * Continues execution even if authentication fails
 */
const conditionalAuthPublic = async (req, res, next) => {
  try {
    logger.debug('JWT Authorizer Middleware (Public) - Processing request', { 
      method: req.method, 
      url: req.url 
    });

    // Extract token from Authorization header
    const authHeader = req.headers?.authorization || req.headers?.Authorization;
    if (!authHeader) {
      logger.debug('No token found in request - continuing as public');
      return next();
    }

    // If token exists, try to authenticate but don't fail if invalid
    const token = authHeader.startsWith('Bearer ') ? authHeader.substring(7) : authHeader;
    
    // Import the jwt verification functions
    const jwt = require('jsonwebtoken');
    const jwksClient = require('jwks-client').default || require('jwks-client');
    const config = require('../../config');

    // Initialize JWKS client for Cognito tokens
    const client = jwksClient({
      jwksUri: `https://cognito-idp.${config.AWS_REGION}.amazonaws.com/${config.USER_POOL_ID}/.well-known/jwks.json`,
      cache: true,
      cacheMaxEntries: 10,
      cacheMaxAge: 600000 // 10 minutes
    });

    // Decode token to determine type
    const decodedHeader = jwt.decode(token, { complete: true });
    if (!decodedHeader || !decodedHeader.header) {
      logger.debug('Invalid token format - continuing as public');
      return next();
    }

    // Check if this is an enhanced IMS token or Cognito token
    const payload = decodedHeader.payload;
    const isEnhancedToken = payload.iss === 'ims-service' || payload.token_type === 'enhanced_jwt';

    let userInfo = null;

    try {
      if (isEnhancedToken) {
        // Handle enhanced IMS JWT token
        const signingKey = config.JWT_SIGNING_KEY || 'default-secret-key';
        const decoded = jwt.verify(token, signingKey, {
          algorithms: ['HS256'],
          issuer: 'ims-service',
          audience: 'admin-portal'
        });

        userInfo = {
          userId: decoded.sub,
          email: decoded.email,
          username: decoded.username,
          accountId: decoded.account_id || decoded['custom:account_id'],
          userRole: decoded.user_role || decoded['custom:user_role'],
          permissions: decoded.permissions || (decoded['custom:permissions'] ? JSON.parse(decoded['custom:permissions']) : []),
          groups: decoded.groups || (decoded['custom:groups'] ? JSON.parse(decoded['custom:groups']) : []),
          tokenType: 'enhanced'
        };
      } else {
        // Handle Cognito JWT token
        if (decodedHeader.header.kid) {
          const key = await new Promise((resolve, reject) => {
            client.getSigningKey(decodedHeader.header.kid, (err, key) => {
              if (err) reject(err);
              else resolve(key.getPublicKey());
            });
          });

          const decoded = jwt.verify(token, key, {
            algorithms: ['RS256'],
            audience: config.USER_POOL_CLIENT_ID,
            issuer: `https://cognito-idp.${config.AWS_REGION}.amazonaws.com/${config.USER_POOL_ID}`
          });

          userInfo = {
            userId: decoded.sub,
            email: decoded.email,
            username: decoded['cognito:username'] || decoded.username,
            accountId: decoded['custom:account_id'] || null,
            userRole: decoded['custom:user_role'] || null,
            permissions: decoded['custom:permissions'] ? JSON.parse(decoded['custom:permissions']) : [],
            groups: decoded['custom:groups'] ? JSON.parse(decoded['custom:groups']) : [],
            tokenType: 'cognito'
          };
        }
      }
    } catch (verifyError) {
      logger.debug('Token verification failed - continuing as public', { error: verifyError.message });
      return next();
    }

    if (userInfo) {
      // Set user context headers
      req.headers['x-user-id'] = userInfo.userId;
      req.headers['x-user-name'] = userInfo.username || '';
      req.headers['x-user-email'] = userInfo.email || '';
      req.headers['x-account-id'] = userInfo.accountId || '';
      req.headers['x-user-role'] = userInfo.userRole || '';
      req.headers['x-user-groups'] = Array.isArray(userInfo.groups) ? userInfo.groups.join(',') : '';
      req.headers['x-user-permissions'] = Array.isArray(userInfo.permissions) ? JSON.stringify(userInfo.permissions) : '[]';
      req.headers['x-token-type'] = userInfo.tokenType || '';

      // Set req.user for backward compatibility
      req.user = {
        sub: userInfo.userId,
        username: userInfo.username,
        email: userInfo.email,
        accountId: userInfo.accountId,
        userRole: userInfo.userRole,
        roles: userInfo.groups || [],
        groups: userInfo.groups || [],
        permissions: userInfo.permissions || []
      };

      logger.debug('Token verified successfully for user (public)', { 
        userId: userInfo.userId,
        accountId: userInfo.accountId
      });
    }

    next();

  } catch (error) {
    logger.debug('JWT Authorizer Middleware (Public) error - continuing', { error: error.message });
    next();
  }
};

/**
 * Public version of API Gateway authorizer context extraction that doesn't return 401 errors
 * Extracts user context from API Gateway authorizer or falls back to headers
 */
const authenticateTokenPublic = (req, res, next) => {
  try {
    // Primary: Extract user context from API Gateway authorizer context
    let userId, username, email, accountId, userRole, roles, groups, permissions;
    
    if (req.apiGateway?.event?.requestContext?.authorizer) {
      const authorizer = req.apiGateway.event.requestContext.authorizer;
      
      userId = authorizer.userId || authorizer.sub;
      username = authorizer.username;
      email = authorizer.email;
      accountId = authorizer.accountId;
      userRole = authorizer.userRole;
      
      // Parse roles if it's a JSON string
      if (authorizer.roles) {
        roles = typeof authorizer.roles === 'string' ? JSON.parse(authorizer.roles) : authorizer.roles;
      }
      
      // Parse groups if it's a JSON string
      if (authorizer.groups) {
        groups = typeof authorizer.groups === 'string' ? JSON.parse(authorizer.groups) : authorizer.groups;
      }
      
      // Parse permissions if it's a JSON string
      if (authorizer.permissions) {
        permissions = typeof authorizer.permissions === 'string' ? JSON.parse(authorizer.permissions) : authorizer.permissions;
      }
      
      logger.debug('User context extracted from API Gateway authorizer (public)', { userId, username, accountId });
    } else {
      // Fallback: Extract from headers (for backward compatibility or direct Lambda invocation)
      userId = req.headers['x-user-id'] || req.headers['x-user-sub'];
      username = req.headers['x-user-name'] || req.headers['x-username'];
      email = req.headers['x-user-email'];
      accountId = req.headers['x-account-id'];
      userRole = req.headers['x-user-role'];
      roles = req.headers['x-user-roles'] ? req.headers['x-user-roles'].split(',') : [];
      groups = req.headers['x-user-groups'] ? req.headers['x-user-groups'].split(',') : [];
      
      if (userId) {
        logger.debug('User context extracted from headers (public)', { userId, username, accountId });
      }
    }

    // If we have user context from authorizer, use it
    if (userId || username || email) {
      req.user = {
        sub: userId,
        username: username,
        email: email,
        accountId: accountId,
        userRole: userRole,
        roles: roles || [],
        groups: groups || [],
        permissions: permissions || []
      };

      logger.debug('User context available (public)', { 
        userId: req.user.sub, 
        username: req.user.username,
        accountId: req.user.accountId 
      });
    } else {
      logger.debug('No user context found - continuing as public');
    }

    next();
  } catch (error) {
    logger.debug('Authentication middleware (public) error - continuing', { error: error.message });
    next();
  }
};

module.exports = { conditionalAuth };