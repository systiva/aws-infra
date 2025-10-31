const jwtAuthorizerMiddleware = require('./jwt-authorizer-wrapper');
const { authenticateToken } = require('./auth');
const logger = require('../../logger');

/**
 * Conditional authentication middleware for public routes
 * Uses embedded JWT authorizer for local development
 * Uses header-based auth for production (expects API Gateway authorizer headers)
 * Continues execution even if authentication fails (for public routes)
 */
const conditionalAuth = (req, res, next) => {
  const useLocalAuth = process.env.NODE_ENV === 'development' || 
                      process.env.USE_LOCAL_AUTH === 'true';

  if (useLocalAuth) {
    logger.debug('Using local JWT authorizer middleware (public)');
    return conditionalAuthPublic(req, res, next);
  } else {
    logger.debug('Using header-based authentication (production mode, public)');
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
          tenantId: decoded.tenant_id || decoded['custom:tenant_id'],
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
            tenantId: decoded['custom:tenant_id'] || null,
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
      req.headers['x-tenant-id'] = userInfo.tenantId || '';
      req.headers['x-user-role'] = userInfo.userRole || '';
      req.headers['x-user-groups'] = Array.isArray(userInfo.groups) ? userInfo.groups.join(',') : '';
      req.headers['x-user-permissions'] = Array.isArray(userInfo.permissions) ? JSON.stringify(userInfo.permissions) : '[]';
      req.headers['x-token-type'] = userInfo.tokenType || '';

      // Set req.user for backward compatibility
      req.user = {
        sub: userInfo.userId,
        username: userInfo.username,
        email: userInfo.email,
        tenantId: userInfo.tenantId,
        userRole: userInfo.userRole,
        roles: userInfo.groups || [],
        groups: userInfo.groups || [],
        permissions: userInfo.permissions || []
      };

      logger.debug('Token verified successfully for user (public)', { 
        userId: userInfo.userId,
        tenantId: userInfo.tenantId
      });
    }

    next();

  } catch (error) {
    logger.debug('JWT Authorizer Middleware (Public) error - continuing', { error: error.message });
    next();
  }
};

/**
 * Public version of header-based auth that doesn't return 401 errors
 */
const authenticateTokenPublic = (req, res, next) => {
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

      logger.debug('User context from authorizer (public)', { 
        userId: req.user.sub, 
        username: req.user.username,
        tenantId: req.user.tenantId 
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