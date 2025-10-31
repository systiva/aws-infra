const jwt = require('jsonwebtoken');
const jwksClient = require('jwks-client').default || require('jwks-client');
const config = require('../../config');
const logger = require('../../logger');

// Initialize JWKS client for Cognito tokens
const client = jwksClient({
  jwksUri: `https://cognito-idp.${config.AWS_REGION}.amazonaws.com/${config.USER_POOL_ID}/.well-known/jwks.json`,
  cache: true,
  cacheMaxEntries: 10,
  cacheMaxAge: 600000 // 10 minutes
});

/**
 * JWT Authorizer Middleware for local development
 * Adapts the Lambda authorizer logic for Express middleware
 */
const jwtAuthorizerMiddleware = async (req, res, next) => {
  try {
    logger.info('JWT Authorizer Middleware - Processing request', { 
      method: req.method, 
      url: req.url 
    });

    // Extract token from Authorization header
    const token = extractToken(req);
    if (!token) {
      logger.warn('No token found in request');
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'No authentication token provided'
      });
    }

    // Decode token to determine type
    const decodedHeader = jwt.decode(token, { complete: true });
    if (!decodedHeader || !decodedHeader.header) {
      logger.warn('Invalid token format');
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Invalid token format'
      });
    }

    // Check if this is an enhanced IMS token or Cognito token
    const payload = decodedHeader.payload;
    const isEnhancedToken = payload.iss === 'ims-service' || payload.token_type === 'enhanced_jwt';

    let userInfo;

    if (isEnhancedToken) {
      // Handle enhanced IMS JWT token
      userInfo = await verifyEnhancedToken(token);
    } else {
      // Handle Cognito JWT token (original flow)
      userInfo = await verifyCognitoToken(token, decodedHeader);
    }

    if (!userInfo) {
      logger.warn('Token verification failed');
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Token verification failed'
      });
    }

    logger.info('Token verified successfully for user', { 
      userId: userInfo.userId,
      tenantId: userInfo.tenantId,
      tokenType: userInfo.tokenType
    });

    // Set user context headers to simulate API Gateway behavior
    setUserContextHeaders(req, userInfo);

    // Also set req.user for backward compatibility
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

    next();

  } catch (error) {
    logger.error('JWT Authorizer Middleware error', { error: error.message });
    
    // Provide specific error messages based on JWT error types
    let errorMessage = 'Authentication failed';
    let errorDetails = error.message;
    
    if (error.name === 'TokenExpiredError') {
      errorMessage = 'JWT token has expired';
      errorDetails = 'Please login again to get a new token';
    } else if (error.name === 'JsonWebTokenError') {
      if (error.message.includes('invalid signature')) {
        errorMessage = 'Invalid JWT signature';
        errorDetails = 'Token signature verification failed';
      } else if (error.message.includes('jwt malformed')) {
        errorMessage = 'Malformed JWT token';
        errorDetails = 'Token format is invalid';
      } else if (error.message.includes('invalid token')) {
        errorMessage = 'Invalid JWT token';
        errorDetails = 'Token is not valid';
      } else {
        errorMessage = 'JWT validation failed';
        errorDetails = error.message;
      }
    } else if (error.name === 'NotBeforeError') {
      errorMessage = 'JWT token not active yet';
      errorDetails = 'Token is not yet valid';
    } else if (error.message.includes('audience')) {
      errorMessage = 'Invalid JWT audience';
      errorDetails = 'Token audience mismatch';
    } else if (error.message.includes('issuer')) {
      errorMessage = 'Invalid JWT issuer';
      errorDetails = 'Token issuer mismatch';
    }
    
    return res.status(401).json({
      error: 'Unauthorized',
      message: errorMessage,
      details: errorDetails
    });
  }
};

/**
 * Verify enhanced IMS JWT token
 */
async function verifyEnhancedToken(token) {
  try {
    // For enhanced tokens, we use the shared secret
    const signingKey = config.JWT_SIGNING_KEY || 'default-secret-key';
    
    const decoded = jwt.verify(token, signingKey, {
      algorithms: ['HS256'],
      issuer: 'ims-service',
      audience: 'admin-portal'
    });

    return {
      userId: decoded.sub,
      email: decoded.email,
      username: decoded.username,
      tenantId: decoded.tenant_id || decoded['custom:tenant_id'],
      userRole: decoded.user_role || decoded['custom:user_role'],
      permissions: decoded.permissions || (decoded['custom:permissions'] ? JSON.parse(decoded['custom:permissions']) : []),
      groups: decoded.groups || (decoded['custom:groups'] ? JSON.parse(decoded['custom:groups']) : []),
      tokenType: 'enhanced'
    };
  } catch (error) {
    logger.error('Enhanced token verification failed', { error: error.message });
    // Re-throw the error with context so the main catch block can handle it
    throw new Error(`Enhanced token verification: ${error.message}`);
  }
}

/**
 * Verify Cognito JWT token (original flow)
 */
async function verifyCognitoToken(token, decodedHeader) {
  try {
    if (!decodedHeader.header.kid) {
      logger.warn('Cognito token missing kid');
      return null;
    }

    // Get signing key for Cognito token
    const key = await getSigningKey(decodedHeader.header.kid);
    
    // Verify Cognito token
    const decoded = jwt.verify(token, key, {
      algorithms: ['RS256'],
      audience: config.USER_POOL_CLIENT_ID,
      issuer: `https://cognito-idp.${config.AWS_REGION}.amazonaws.com/${config.USER_POOL_ID}`
    });

    return {
      userId: decoded.sub,
      email: decoded.email,
      username: decoded['cognito:username'] || decoded.username,
      tenantId: decoded['custom:tenant_id'] || null,
      userRole: decoded['custom:user_role'] || null,
      permissions: decoded['custom:permissions'] ? JSON.parse(decoded['custom:permissions']) : [],
      groups: decoded['custom:groups'] ? JSON.parse(decoded['custom:groups']) : [],
      tokenType: 'cognito'
    };
  } catch (error) {
    logger.error('Cognito token verification failed', { error: error.message });
    // Re-throw the error with context so the main catch block can handle it
    throw new Error(`Cognito token verification: ${error.message}`);
  }
}

/**
 * Extract JWT token from request
 */
function extractToken(req) {
  const authHeader = req.headers?.authorization || req.headers?.Authorization;
  
  if (!authHeader) {
    return null;
  }

  // Support both "Bearer <token>" and just "<token>" formats
  if (authHeader.startsWith('Bearer ')) {
    return authHeader.substring(7);
  }
  
  return authHeader;
}

/**
 * Get signing key from JWKS
 */
async function getSigningKey(kid) {
  return new Promise((resolve, reject) => {
    client.getSigningKey(kid, (err, key) => {
      if (err) {
        reject(err);
      } else {
        const signingKey = key.getPublicKey();
        resolve(signingKey);
      }
    });
  });
}

/**
 * Set user context headers to simulate API Gateway behavior
 */
function setUserContextHeaders(req, userInfo) {
  req.headers['x-user-id'] = userInfo.userId;
  req.headers['x-user-name'] = userInfo.username || '';
  req.headers['x-user-email'] = userInfo.email || '';
  req.headers['x-tenant-id'] = userInfo.tenantId || '';
  req.headers['x-user-role'] = userInfo.userRole || '';
  req.headers['x-user-groups'] = Array.isArray(userInfo.groups) ? userInfo.groups.join(',') : '';
  req.headers['x-user-permissions'] = Array.isArray(userInfo.permissions) ? JSON.stringify(userInfo.permissions) : '[]';
  req.headers['x-token-type'] = userInfo.tokenType || '';
}

module.exports = jwtAuthorizerMiddleware;