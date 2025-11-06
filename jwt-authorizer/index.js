const jwt = require('jsonwebtoken');
const jwksClient = require('jwks-rsa');
const AWS = require('aws-sdk');

// Initialize JWKS client for Cognito tokens
const client = jwksClient({
  jwksUri: `https://cognito-idp.${process.env.AWS_REGION}.amazonaws.com/${process.env.USER_POOL_ID}/.well-known/jwks.json`,
  cache: true,
  cacheMaxEntries: 10,
  cacheMaxAge: 600000 // 10 minutes
});

// Cognito client
const cognito = new AWS.CognitoIdentityServiceProvider();

/**
 * AWS Lambda JWT Authorizer for API Gateway
 * Validates JWT tokens from AWS Cognito User Pool and Enhanced IMS tokens
 */
exports.handler = async (event) => {
  console.log('JWT Authorizer event:', JSON.stringify(event, null, 2));
  
  try {
    // Extract token from Authorization header
    const token = extractToken(event);
    if (!token) {
      console.log('No token found in request');
      return generatePolicy('user', 'Deny', event.methodArn);
    }

    // Decode token to determine type
    const decodedHeader = jwt.decode(token, { complete: true });
    if (!decodedHeader || !decodedHeader.header) {
      console.log('Invalid token format');
      return generatePolicy('user', 'Deny', event.methodArn);
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
      console.log('Token verification failed');
      return generatePolicy('user', 'Deny', event.methodArn);
    }

    console.log('Token verified successfully for user:', userInfo.userId);

    // Generate policy with user context
    return generatePolicy(
      userInfo.userId, 
      'Allow', 
      event.methodArn, 
      userInfo
    );

  } catch (error) {
    console.error('JWT Authorization failed:', error.message);
    return generatePolicy('user', 'Deny', event.methodArn);
  }
};

/**
 * Verify enhanced IMS JWT token
 */
async function verifyEnhancedToken(token) {
  try {
    // For enhanced tokens, we use the shared secret
    const signingKey = process.env.JWT_SIGNING_KEY || 'your-jwt-secret-for-local-dev';
    
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
    console.error('Enhanced token verification failed:', error.message);
    return null;
  }
}

/**
 * Verify Cognito JWT token (original flow)
 */
async function verifyCognitoToken(token, decodedHeader) {
  try {
    if (!decodedHeader.header.kid) {
      console.log('Cognito token missing kid');
      return null;
    }

    // Get signing key for Cognito token
    const key = await getSigningKey(decodedHeader.header.kid);
    
    // Verify Cognito token
    const decoded = jwt.verify(token, key, {
      algorithms: ['RS256'],
      audience: process.env.USER_POOL_CLIENT_ID,
      issuer: `https://cognito-idp.${process.env.AWS_REGION}.amazonaws.com/${process.env.USER_POOL_ID}`
    });

    return {
      userId: decoded.sub,
      email: decoded.email,
      username: decoded['cognito:username'],
      tenantId: decoded['custom:tenant_id'] || null,
      userRole: decoded['custom:user_role'] || null,
      permissions: decoded['custom:permissions'] ? JSON.parse(decoded['custom:permissions']) : [],
      groups: decoded['custom:groups'] ? JSON.parse(decoded['custom:groups']) : [],
      tokenType: 'cognito'
    };
  } catch (error) {
    console.error('Cognito token verification failed:', error.message);
    return null;
  }
}

/**
 * Extract JWT token from event
 */
function extractToken(event) {
  // For Lambda authorizer events, token is in authorizationToken field
  if (event.authorizationToken) {
    const authHeader = event.authorizationToken;
    // Support both "Bearer <token>" and just "<token>" formats
    if (authHeader.startsWith('Bearer ')) {
      return authHeader.substring(7);
    }
    return authHeader;
  }
  
  // For direct Express requests, token is in headers
  const authHeader = event.headers?.Authorization || event.headers?.authorization;
  
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
 * Generate IAM policy for API Gateway
 * Uses wildcard to allow all methods and paths in the stage to avoid caching issues
 */
function generatePolicy(principalId, effect, resource, context = {}) {
  // Extract the API Gateway ARN base and create wildcard policy
  // From: arn:aws:execute-api:region:account:api-id/stage/method/path
  // To:   arn:aws:execute-api:region:account:api-id/stage/*/*
  const arnParts = resource.split('/');
  const apiGatewayArn = arnParts.slice(0, 2).join('/') + '/*/*';
  
  console.log('Generating policy:', {
    principalId,
    effect,
    originalResource: resource,
    wildcardResource: apiGatewayArn
  });

  const policy = {
    principalId: principalId,
    policyDocument: {
      Version: '2012-10-17',
      Statement: [
        {
          Action: 'execute-api:Invoke',
          Effect: effect,
          Resource: apiGatewayArn  // Use wildcard to allow all methods and paths
        }
      ]
    }
  };

  // Add user context if authorization is successful
  if (effect === 'Allow' && Object.keys(context).length > 0) {
    policy.context = {
      userId: context.userId,
      email: context.email || '',
      tenantId: context.tenantId || '',
      userRole: context.userRole || '',
      permissions: JSON.stringify(context.permissions || [])
    };
  }

  return policy;
}