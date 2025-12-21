// Authentication routes for IMS Service
const express = require('express');
const router = express.Router();

const { CognitoService } = require('../services/cognito-service');
const RBACService = require('../services/rbac_service');
const JWTService = require('../services/jwt-service');
const logger = require('../../logger');

const cognitoService = new CognitoService();
const rbacService = new RBACService();
const jwtService = new JWTService();

/**
 * POST /auth/login
 * Authenticate user with username and password
 */
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Username and password are required'
      });
    }

    logger.info('Login attempt', { username });

    // Authenticate with Cognito
    const authResult = await cognitoService.authenticateUser(username, password);

    if (!authResult.success) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Invalid credentials'
      });
    }

    // Handle challenge responses (e.g., NEW_PASSWORD_REQUIRED)
    if (authResult.challengeName) {
      logger.info('Authentication challenge required', { username, challengeName: authResult.challengeName });
      
      return res.json({
        success: false,
        requiresPasswordChange: authResult.challengeName === 'NEW_PASSWORD_REQUIRED',
        challengeName: authResult.challengeName,
        session: authResult.session,
        message: authResult.challengeName === 'NEW_PASSWORD_REQUIRED' ? 
          'Password change required on first login' : 
          'Authentication challenge required',
        user: {
          username: username
        }
      });
    }

    // Normal authentication success - get user details and permissions
    const user = await cognitoService.getUser(username);
    if (!user) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'User not found'
      });
    }

    logger.info('Retrieved user details for RBAC context', {
      username,
      userSub: user.sub,
      userEmail: user.email,
      accountId: user.customAttributes.accountId,
      cognitoRole: user.customAttributes.userRole, // DEPRECATED: Ignored in favor of DynamoDB RBAC
      note: 'RBAC data will be fetched from DynamoDB, not Cognito'
    });

    // Create user context with RBAC from DynamoDB (ignore Cognito RBAC)
    const userContext = await rbacService.createUserContext(
      user.customAttributes.accountId,
      user.sub, // use the actual Cognito sub as user ID
      user.email,
      user.username
    );

    logger.info('Created user context from RBAC', {
      username,
      userRole: userContext.userRole,
      permissions: userContext.permissions,
      groups: userContext.groups,
      permissionsCount: userContext.permissions?.length || 0,
      groupsCount: userContext.groups?.length || 0
    });

    // Generate enhanced JWT tokens with RBAC information
    const enhancedTokens = jwtService.generateEnhancedTokens(
      {
        ...userContext, // Use complete RBAC context
        userId: user.username, // Override with Cognito username for consistency
        username: user.username,
        email: user.email,
        accountId: user.customAttributes.accountId
      },
      authResult.tokens // Original Cognito tokens for reference
    );

    logger.info('Login successful with enhanced JWT tokens', { 
      username, 
      userRoles: userContext.userRoles, // Use RBAC-derived roles
      permissionsCount: userContext.permissions?.length || 0,
      groupsCount: userContext.groups?.length || 0
    });

    res.json({
      success: true,
      message: 'Authentication successful',
      tokens: enhancedTokens,
      user: {
        username: user.username,
        email: user.email,
        userRoles: userContext.userRoles, // Use RBAC-derived roles
        accountId: user.customAttributes.accountId,
        permissions: userContext.permissions,
        groups: userContext.groups || []
      }
    });

  } catch (error) {
    logger.error('Login failed', { error: error.message });
    
    // Handle custom authentication errors
    if (error.name === 'AuthenticationError') {
      return res.status(401).json({
        error: 'Unauthorized',
        message: error.message
      });
    } else if (error.name === 'ValidationError') {
      return res.status(400).json({
        error: 'Bad Request',
        message: error.message
      });
    } else {
      // Server errors
      return res.status(500).json({
        error: 'Internal Server Error',
        message: 'Authentication failed'
      });
    }
  }
});

/**
 * POST /auth/complete-new-password-challenge
 * Complete the NEW_PASSWORD_REQUIRED challenge for first-time login
 */
router.post('/complete-new-password-challenge', async (req, res) => {
  try {
    const { username, newPassword, session } = req.body;

    if (!username || !newPassword || !session) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Username, new password, and session are required'
      });
    }

    logger.info('Completing new password challenge', { username });

    // Complete the challenge with Cognito
    const challengeResult = await cognitoService.respondToNewPasswordChallenge(
      username,
      newPassword,
      session
    );

    if (!challengeResult.success) {
      return res.status(400).json({
        error: 'Bad Request',
        message: challengeResult.message || 'Failed to update password'
      });
    }

    // Update user status in RBAC system
    try {
      const userDetails = await cognitoService.getUser(username);
      const accountId = userDetails.customAttributes.accountId;
      
      if (accountId) {
        // Find user by email in RBAC system and update password status
        const rbacUsers = await rbacService.getAllUsersInAccount(accountId);
        const rbacUser = rbacUsers.find(user => user.email === username);
        
        if (rbacUser) {
          await rbacService.updateUser(accountId, rbacUser.user_id, {
            password_status: 'PERMANENT',
            first_login_completed: true,
            updated_by: username
          });
          logger.info('Updated user password status in RBAC', { username, userId: rbacUser.user_id });
        }
      }
    } catch (rbacError) {
      logger.warn('Failed to update RBAC user status, but password change succeeded', { 
        username, 
        error: rbacError.message 
      });
    }

    // Get user details and permissions for successful login
    const user = await cognitoService.getUser(username);
    if (!user) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'User not found'
      });
    }

    // Create user context with RBAC from DynamoDB
    const userContext = await rbacService.createUserContext(
      user.customAttributes.accountId,
      user.sub,
      user.email,
      user.username
    );

    // Generate enhanced JWT tokens
    const enhancedTokens = jwtService.generateEnhancedTokens(
      {
        ...userContext,
        userId: user.username,
        username: user.username,
        email: user.email,
        accountId: user.customAttributes.accountId
      },
      challengeResult.tokens
    );

    logger.info('Password changed successfully, user logged in', { username });

    res.json({
      success: true,
      message: 'Password updated successfully',
      tokens: enhancedTokens,
      user: {
        username: user.username,
        email: user.email,
        userRoles: userContext.userRoles,
        accountId: user.customAttributes.accountId,
        permissions: userContext.permissions,
        groups: userContext.groups || [],
        firstLoginCompleted: true
      }
    });

  } catch (error) {
    logger.error('Complete new password challenge failed', { error: error.message });
    
    if (error.name === 'ValidationError') {
      return res.status(400).json({
        error: 'Bad Request',
        message: error.message
      });
    } else {
      return res.status(500).json({
        error: 'Internal Server Error',
        message: 'Failed to update password'
      });
    }
  }
});

/**
 * POST /auth/signup
 * Register a new user
 */
router.post('/signup', async (req, res) => {
  try {
    const { username, email, password, firstName, lastName, accountId, userRole = 'viewer' } = req.body;

    // Validate required fields including accountId
    if (!username || !email || !password || !firstName || !lastName || !accountId) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Username, email, password, first name, last name, and account ID are required'
      });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Invalid email format'
      });
    }

    // Validate password strength
    if (password.length < 8) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Password must be at least 8 characters long'
      });
    }

    // Validate role
    if (!rbacService.isValidRole(userRole)) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Invalid user role'
      });
    }

    // Validate accountId format (basic validation)
    if (accountId.trim().length === 0) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Account ID cannot be empty'
      });
    }

    logger.info('User signup attempt', { username, email, accountId, userRole });

    // Check if user already exists
    try {
      const existingUser = await cognitoService.getUser(username);
      if (existingUser) {
        return res.status(409).json({
          error: 'Conflict',
          message: 'User already exists'
        });
      }
    } catch (error) {
      // User doesn't exist, which is what we want for signup
    }

    // Create user in Cognito
    const userData = {
      username,
      email,
      password,
      // Note: Only using standard attributes, custom attributes would need to be configured in User Pool
      standardAttributes: {
        given_name: firstName,
        family_name: lastName,
        name: `${firstName} ${lastName}`
      }
    };

    const user = await cognitoService.createUser(userData);

    logger.info('User signup successful', { username, email, accountId });

    res.status(201).json({
      success: true,
      message: 'User registered successfully. Please check your email for verification.',
      user: {
        username,
        email,
        firstName,
        lastName,
        accountId,
        userRole,
        userStatus: 'UNCONFIRMED' // New signups are unconfirmed until email verification
      }
    });

  } catch (error) {
    logger.error('Signup failed', { error: error.message });
    
    // Handle custom error classes
    if (error.name === 'ValidationError') {
      return res.status(400).json({
        error: 'Bad Request',
        message: error.message
      });
    }
    
    // Handle specific Cognito errors for client validation
    if (error.code === 'UsernameExistsException') {
      return res.status(409).json({
        error: 'Conflict',
        message: 'Username already exists'
      });
    }
    
    if (error.code === 'InvalidPasswordException' ||
        error.message?.includes('Password did not conform with password policy') ||
        error.message?.includes('Password not long enough') ||
        error.message?.includes('Password must have')) {
      return res.status(400).json({
        error: 'Bad Request',
        message: error.message || 'Password does not meet requirements'
      });
    }
    
    if (error.code === 'InvalidParameterException') {
      return res.status(400).json({
        error: 'Bad Request',
        message: error.message
      });
    }

    return res.status(500).json({
      error: 'Internal Server Error',
      message: 'Registration failed'
    });
  }
});

/**
 * POST /auth/challenge
 * Respond to authentication challenges (e.g., NEW_PASSWORD_REQUIRED)
 */
router.post('/challenge', async (req, res) => {
  try {
    const { username, newPassword, session, challengeName } = req.body;

    if (!username || !newPassword || !session || !challengeName) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Username, newPassword, session, and challengeName are required'
      });
    }

    if (challengeName !== 'NEW_PASSWORD_REQUIRED') {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Only NEW_PASSWORD_REQUIRED challenge is supported'
      });
    }

    logger.info('Challenge response attempt', { username, challengeName });

    // Respond to the challenge
    const challengeResult = await cognitoService.respondToAuthChallenge(
      challengeName,
      username,
      newPassword,
      session
    );

    if (!challengeResult.success) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Challenge response failed'
      });
    }

    // Get user details after successful challenge response
    const user = await cognitoService.getUser(username);
    if (!user) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'User not found'
      });
    }

    // Create user context with RBAC
    const userContext = await rbacService.createUserContext(
      user.customAttributes.accountId,
      user.sub || user.username, // use sub if available
      user.email,
      user.username
    );

    // Generate enhanced JWT tokens with RBAC information
    const enhancedTokens = jwtService.generateEnhancedTokens(
      {
        ...userContext, // Use complete RBAC context
        userId: user.username, // Override with Cognito username for consistency
        username: user.username,
        email: user.email,
        accountId: user.customAttributes.accountId
      },
      challengeResult.tokens // Original Cognito tokens for reference
    );

    logger.info('Challenge response successful with enhanced JWT tokens', { 
      username, 
      userRoles: userContext.userRoles,
      permissionsCount: userContext.permissions?.length || 0,
      groupsCount: userContext.groups?.length || 0
    });

    res.json({
      success: true,
      message: 'Challenge completed successfully',
      tokens: enhancedTokens,
      user: {
        username: user.username,
        email: user.email,
        userRoles: userContext.userRoles,
        accountId: user.customAttributes.accountId,
        permissions: userContext.permissions,
        groups: userContext.groups || []
      }
    });

  } catch (error) {
    logger.error('Challenge response failed', { error: error.message });
    
    // Handle custom authentication errors
    if (error.name === 'AuthenticationError') {
      return res.status(401).json({
        error: 'Unauthorized',
        message: error.message
      });
    } else if (error.name === 'ValidationError') {
      return res.status(400).json({
        error: 'Bad Request',
        message: error.message
      });
    } else {
      // Server errors
      return res.status(500).json({
        error: 'Internal Server Error',
        message: 'Challenge response failed'
      });
    }
  }
});

/**
 * POST /auth/logout
 * Logout user (placeholder for token invalidation if needed)
 */
router.post('/logout', async (req, res) => {
  try {
    // In a JWT-based system, logout is typically handled client-side
    // by removing the token. Server-side logout would require token blacklisting
    // which could be implemented with DynamoDB or Redis if needed.
    
    logger.info('User logged out');
    
    res.json({
      success: true,
      message: 'Logout successful'
    });

  } catch (error) {
    logger.error('Logout failed', { error: error.message });
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Logout failed'
    });
  }
});

/**
 * POST /auth/refresh
 * Refresh access token using refresh token
 */
router.post('/refresh', async (req, res) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Refresh token is required'
      });
    }

    // Extract user context from refresh token and refresh with latest RBAC data
    const userContext = jwtService.extractUserContext(refreshToken);
    
    // Get updated user context from RBAC system to include any permission changes
    const updatedUserContext = await rbacService.createUserContext(
      userContext.accountId,
      userContext.sub || userContext.username, // use sub if available
      userContext.email,
      userContext.username
    );

    // Merge the contexts (keep user info, update RBAC info)
    const finalUserContext = {
      ...userContext,
      permissions: updatedUserContext.permissions,
      groups: updatedUserContext.groups || []
    };

    // Generate new access token with updated RBAC information
    const newTokens = jwtService.refreshAccessToken(refreshToken, finalUserContext);

    logger.info('Token refreshed successfully', {
      userId: userContext.username,
      accountId: userContext.accountId,
      permissionsCount: finalUserContext.permissions?.length || 0
    });

    res.json({
      success: true,
      message: 'Token refreshed successfully',
      tokens: {
        AccessToken: newTokens.AccessToken,
        TokenType: newTokens.TokenType,
        ExpiresIn: newTokens.ExpiresIn,
        // Keep original refresh token
        RefreshToken: refreshToken
      }
    });

  } catch (error) {
    logger.error('Token refresh failed', { error: error.message });
    
    if (error.message === 'Invalid token') {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Invalid refresh token'
      });
    }
    
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Token refresh failed'
    });
  }
});

/**
 * POST /auth/change-password
 * Change user password
 */
router.post('/change-password', async (req, res) => {
  try {
    const { username, currentPassword, newPassword } = req.body;

    if (!username || !currentPassword || !newPassword) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Username, current password, and new password are required'
      });
    }

    // Validate current password first
    const authResult = await cognitoService.authenticateUser(username, currentPassword);
    if (!authResult.success) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Current password is incorrect'
      });
    }

    // Set new password
    await cognitoService.setUserPassword(username, newPassword, true);

    logger.info('Password changed successfully', { username });

    res.json({
      success: true,
      message: 'Password changed successfully'
    });

  } catch (error) {
    logger.error('Password change failed', { error: error.message });
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Password change failed'
    });
  }
});

/**
 * POST /auth/forgot-password
 * Initiate forgot password flow
 */
router.post('/forgot-password', async (req, res) => {
  try {
    const { username } = req.body;

    if (!username) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Username is required'
      });
    }

    // This would trigger Cognito's forgot password flow
    // For now, returning a placeholder response
    
    res.status(501).json({
      error: 'Not Implemented',
      message: 'Forgot password flow not yet implemented'
    });

  } catch (error) {
    logger.error('Forgot password failed', { error: error.message });
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Forgot password failed'
    });
  }
});

/**
 * POST /auth/validate
 * Validate JWT token and return user context
 */
router.post('/validate', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Bearer token required'
      });
    }

    const token = authHeader.substring(7);
    
    // Validate and extract user context from JWT
    const userContext = jwtService.extractUserContext(token);

    logger.info('Token validated successfully', {
      userId: userContext.username,
      accountId: userContext.accountId
    });

    res.json({
      success: true,
      message: 'Token is valid',
      user: {
        username: userContext.username,
        email: userContext.email,
        userRole: userContext.userRole,
        accountId: userContext.accountId,
        permissions: userContext.permissions,
        groups: userContext.groups
      }
    });

  } catch (error) {
    logger.error('Token validation failed', { error: error.message });
    
    if (error.message === 'Invalid token') {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Invalid or expired token'
      });
    }
    
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Token validation failed'
    });
  }
});

/**
 * GET /auth/me
 * Get current user information from JWT token
 */
router.get('/me', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Bearer token required'
      });
    }

    const token = authHeader.substring(7);
    
    // Extract user context from JWT
    const userContext = jwtService.extractUserContext(token);

    // Get fresh user context from RBAC system for most up-to-date permissions
    const freshUserContext = await rbacService.createUserContext(
      userContext.accountId,
      userContext.sub || userContext.username, // use sub if available
      userContext.email,
      userContext.username
    );

    logger.info('User info retrieved', {
      userId: userContext.username,
      accountId: userContext.accountId
    });

    res.json({
      success: true,
      user: {
        username: userContext.username,
        email: userContext.email,
        userRole: userContext.userRole,
        accountId: userContext.accountId,
        permissions: freshUserContext.permissions,
        groups: freshUserContext.groups || []
      }
    });

  } catch (error) {
    logger.error('Get user info failed', { error: error.message });
    
    if (error.message === 'Invalid token') {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Invalid or expired token'
      });
    }
    
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to get user information'
    });
  }
});

module.exports = router;