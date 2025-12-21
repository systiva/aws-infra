const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const config = require('../../config');
const logger = require('../../logger');

/**
 * JWT Service for generating enhanced JWT tokens with RBAC information
 * This service creates custom JWT tokens that include comprehensive user context
 * including groups, roles, and permissions from the RBAC system
 */
class JWTService {
  constructor() {
    // Generate or use configured JWT signing key
    this.signingKey = config.JWT_SIGNING_KEY || this.generateSigningKey();
    this.algorithm = config.JWT_ALGORITHM || 'HS256';
    this.issuer = config.JWT_ISSUER || 'ims-service';
    this.audience = config.JWT_AUDIENCE || 'admin-portal';
    
    // Token validity periods
    this.accessTokenExpiresIn = config.JWT_ACCESS_TOKEN_EXPIRES_IN || '1h';
    this.refreshTokenExpiresIn = config.JWT_REFRESH_TOKEN_EXPIRES_IN || '7d';
  }

  /**
   * Generate a secure signing key for JWT tokens
   */
  generateSigningKey() {
    return crypto.randomBytes(64).toString('hex');
  }

  /**
   * Generate enhanced JWT tokens with RBAC information
   * @param {Object} userContext - User context from RBAC service
   * @param {Object} cognitoTokens - Original Cognito tokens (optional)
   * @returns {Object} Enhanced JWT tokens
   */
  generateEnhancedTokens(userContext, cognitoTokens = null) {
    try {
      const now = Math.floor(Date.now() / 1000);
      
      // Base payload with user information
      const basePayload = {
        // Standard JWT claims
        iss: this.issuer,
        aud: this.audience,
        iat: now,
        
        // User identification
        sub: userContext.userId || userContext.username,
        email: userContext.email,
        username: userContext.username,
        
        // Account context
        'custom:account_id': userContext.accountId,
        account_id: userContext.accountId,
        
        // RBAC information - only use userRoles array
        'custom:user_roles': JSON.stringify(userContext.userRoles || []),
        'custom:permissions': JSON.stringify(userContext.permissions || []),
        'custom:groups': JSON.stringify(userContext.groups || []),
        
        // Enhanced user context - only use userRoles array
        user_roles: userContext.userRoles || [],
        permissions: userContext.permissions || [],
        groups: userContext.groups || [],
        
        // Token metadata
        token_type: 'enhanced_jwt',
        auth_provider: 'cognito',
        rbac_version: '1.0'
      };

      // Generate access token
      const accessTokenPayload = {
        ...basePayload,
        exp: now + this.parseExpiresIn(this.accessTokenExpiresIn),
        token_use: 'access'
      };

      const accessToken = jwt.sign(accessTokenPayload, this.signingKey, {
        algorithm: this.algorithm
      });

      // Generate refresh token
      const refreshTokenPayload = {
        ...basePayload,
        exp: now + this.parseExpiresIn(this.refreshTokenExpiresIn),
        token_use: 'refresh'
      };

      const refreshToken = jwt.sign(refreshTokenPayload, this.signingKey, {
        algorithm: this.algorithm
      });

      // Generate ID token (similar to access token but for identification)
      const idTokenPayload = {
        ...basePayload,
        exp: now + this.parseExpiresIn(this.accessTokenExpiresIn),
        token_use: 'id'
      };

      const idToken = jwt.sign(idTokenPayload, this.signingKey, {
        algorithm: this.algorithm
      });

      logger.info('Enhanced JWT tokens generated', {
        userId: userContext.userId || userContext.username,
        accountId: userContext.accountId,
        userRoles: userContext.userRoles,
        permissionsCount: userContext.permissions?.length || 0,
        groupsCount: userContext.groups?.length || 0,
        fullUserContext: JSON.stringify(userContext, null, 2)
      });

      return {
        AccessToken: accessToken,
        RefreshToken: refreshToken,
        IdToken: idToken,
        TokenType: 'Bearer',
        ExpiresIn: this.parseExpiresIn(this.accessTokenExpiresIn),
        // Include original Cognito tokens for reference if provided
        ...(cognitoTokens && { OriginalCognitoTokens: cognitoTokens })
      };

    } catch (error) {
      logger.error('Failed to generate enhanced JWT tokens', { 
        error: error.message,
        userId: userContext.userId || userContext.username 
      });
      throw new Error('Token generation failed');
    }
  }

  /**
   * Verify and decode a JWT token
   * @param {string} token - JWT token to verify
   * @returns {Object} Decoded token payload
   */
  verifyToken(token) {
    try {
      const decoded = jwt.verify(token, this.signingKey, {
        algorithms: [this.algorithm],
        issuer: this.issuer,
        audience: this.audience
      });

      logger.debug('JWT token verified successfully', {
        userId: decoded.sub,
        tokenUse: decoded.token_use,
        expiresAt: new Date(decoded.exp * 1000).toISOString()
      });

      return decoded;
    } catch (error) {
      logger.error('JWT token verification failed', { error: error.message });
      throw new Error('Invalid token');
    }
  }

  /**
   * Refresh an access token using a refresh token
   * @param {string} refreshToken - Valid refresh token
   * @param {Object} updatedUserContext - Updated user context (optional)
   * @returns {Object} New access token
   */
  refreshAccessToken(refreshToken, updatedUserContext = null) {
    try {
      // Verify refresh token
      const decoded = this.verifyToken(refreshToken);
      
      if (decoded.token_use !== 'refresh') {
        throw new Error('Invalid token type for refresh');
      }

      // Use updated context if provided, otherwise use token context
      const userContext = updatedUserContext || {
        userId: decoded.sub,
        username: decoded.username,
        email: decoded.email,
        accountId: decoded.account_id,
        userRole: decoded.user_role,
        permissions: decoded.permissions,
        groups: decoded.groups
      };

      // Generate new access token
      const now = Math.floor(Date.now() / 1000);
      const accessTokenPayload = {
        iss: this.issuer,
        aud: this.audience,
        iat: now,
        exp: now + this.parseExpiresIn(this.accessTokenExpiresIn),
        sub: userContext.userId || userContext.username,
        email: userContext.email,
        username: userContext.username,
        'custom:account_id': userContext.accountId,
        account_id: userContext.accountId,
        'custom:user_role': userContext.userRole,
        'custom:permissions': JSON.stringify(userContext.permissions || []),
        'custom:groups': JSON.stringify(userContext.groups || []),
        user_role: userContext.userRole,
        permissions: userContext.permissions || [],
        groups: userContext.groups || [],
        token_type: 'enhanced_jwt',
        token_use: 'access',
        auth_provider: 'cognito',
        rbac_version: '1.0'
      };

      const newAccessToken = jwt.sign(accessTokenPayload, this.signingKey, {
        algorithm: this.algorithm
      });

      logger.info('Access token refreshed', {
        userId: userContext.userId || userContext.username,
        accountId: userContext.accountId
      });

      return {
        AccessToken: newAccessToken,
        TokenType: 'Bearer',
        ExpiresIn: this.parseExpiresIn(this.accessTokenExpiresIn)
      };

    } catch (error) {
      logger.error('Token refresh failed', { error: error.message });
      throw new Error('Token refresh failed');
    }
  }

  /**
   * Extract user context from JWT token
   * @param {string} token - JWT token
   * @returns {Object} User context
   */
  extractUserContext(token) {
    try {
      const decoded = this.verifyToken(token);
      
      return {
        userId: decoded.sub,
        username: decoded.username,
        email: decoded.email,
        accountId: decoded.account_id,
        userRole: decoded.user_role,
        permissions: decoded.permissions || [],
        groups: decoded.groups || []
      };
    } catch (error) {
      logger.error('Failed to extract user context from token', { error: error.message });
      throw new Error('Invalid token');
    }
  }

  /**
   * Parse expires in string to seconds
   * @param {string} expiresIn - Expires in string (e.g., '1h', '30m', '7d')
   * @returns {number} Seconds
   */
  parseExpiresIn(expiresIn) {
    const units = {
      s: 1,
      m: 60,
      h: 3600,
      d: 86400,
      w: 604800
    };

    const match = expiresIn.match(/^(\d+)([smhdw])$/);
    if (!match) {
      throw new Error(`Invalid expiresIn format: ${expiresIn}`);
    }

    const [, value, unit] = match;
    return parseInt(value) * units[unit];
  }

  /**
   * Generate JWKS (JSON Web Key Set) for token verification
   * @returns {Object} JWKS object
   */
  generateJWKS() {
    // This would be implemented for RSA keys if using RS256
    // For HS256, JWKS is not typically used as it's symmetric
    if (this.algorithm === 'HS256') {
      return {
        keys: [],
        note: 'JWKS not applicable for HMAC-based tokens'
      };
    }
    
    // For RSA implementation, would include public key information
    return {
      keys: []
    };
  }
}

module.exports = JWTService;