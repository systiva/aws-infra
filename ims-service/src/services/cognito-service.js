// Cognito Service for user management
const AWS = require('aws-sdk');
const crypto = require('crypto');
const config = require('../../config');
const logger = require('../../logger');

// Custom error classes
class AuthenticationError extends Error {
  constructor(message) {
    super(message);
    this.name = 'AuthenticationError';
    this.statusCode = 401;
  }
}

class AuthorizationError extends Error {
  constructor(message) {
    super(message);
    this.name = 'AuthorizationError';
    this.statusCode = 403;
  }
}

class ValidationError extends Error {
  constructor(message) {
    super(message);
    this.name = 'ValidationError';
    this.statusCode = 400;
  }
}

class CognitoService {
  constructor() {
    this.cognito = new AWS.CognitoIdentityServiceProvider({
      region: config.AWS_REGION
    });
    this.userPoolId = config.USER_POOL_ID;
    this.clientId = config.USER_POOL_CLIENT_ID;
    this.clientSecret = config.USER_POOL_CLIENT_SECRET;
  }

  /**
   * Generate SECRET_HASH for Cognito authentication
   */
  generateSecretHash(username) {
    const message = username + this.clientId;
    return crypto.createHmac('sha256', this.clientSecret)
                 .update(message)
                 .digest('base64');
  }

  /**
   * Authenticate user with username and password
   */
  async authenticateUser(username, password) {
    try {
      logger.info('Authenticating user', { username });

      const params = {
        AuthFlow: 'ADMIN_USER_PASSWORD_AUTH',
        UserPoolId: this.userPoolId,
        ClientId: this.clientId,
        AuthParameters: {
          USERNAME: username,
          PASSWORD: password,
          SECRET_HASH: this.generateSecretHash(username)
        }
      };

      const result = await this.cognito.adminInitiateAuth(params).promise();
      
      logger.info('User authenticated successfully', { username });
      return {
        success: true,
        tokens: result.AuthenticationResult,
        challengeName: result.ChallengeName,
        session: result.Session
      };
    } catch (error) {
      logger.error('Authentication failed', { username, error: error.message });
      
      // Check for specific Cognito error codes
      if (error.code === 'NotAuthorizedException' || 
          error.code === 'UserNotFoundException' ||
          error.message.includes('Incorrect username or password') ||
          error.message.includes('User does not exist')) {
        throw new AuthenticationError('Invalid username or password');
      } else if (error.code === 'UserNotConfirmedException') {
        throw new AuthenticationError('User account not confirmed');
      } else if (error.code === 'PasswordResetRequiredException') {
        throw new AuthenticationError('Password reset required');
      } else if (error.code === 'UserNotFoundException') {
        throw new AuthenticationError('User not found');
      } else {
        // For other errors, throw as server error
        logger.error('Cognito service error', { error: error.code, message: error.message });
        throw new Error(`Authentication service error: ${error.message}`);
      }
    }
  }

  /**
   * Respond to NEW_PASSWORD_REQUIRED challenge
   */
  async respondToNewPasswordChallenge(username, newPassword, session) {
    try {
      logger.info('Responding to NEW_PASSWORD_REQUIRED challenge', { username });

      const params = {
        ChallengeName: 'NEW_PASSWORD_REQUIRED',
        ClientId: this.clientId,
        Session: session,
        ChallengeResponses: {
          USERNAME: username,
          NEW_PASSWORD: newPassword,
          SECRET_HASH: this.generateSecretHash(username)
        }
      };

      const result = await this.cognito.respondToAuthChallenge(params).promise();
      
      logger.info('NEW_PASSWORD_REQUIRED challenge completed successfully', { username });
      return {
        success: true,
        tokens: result.AuthenticationResult,
        message: 'Password updated successfully'
      };
    } catch (error) {
      logger.error('NEW_PASSWORD_REQUIRED challenge failed', { username, error: error.message });
      
      // Handle specific password-related errors
      if (error.code === 'InvalidPasswordException' ||
          error.message.includes('Password did not conform with password policy') ||
          error.message.includes('Password not long enough') ||
          error.message.includes('Password must have')) {
        throw new ValidationError(error.message);
      } else if (error.code === 'NotAuthorizedException') {
        throw new ValidationError('Invalid session or authentication failed');
      } else if (error.code === 'InvalidParameterException') {
        throw new ValidationError(error.message);
      } else {
        logger.error('Cognito new password challenge service error', { error: error.code, message: error.message });
        throw new Error(`New password challenge service error: ${error.message}`);
      }
    }
  }

  /**
   * Respond to authentication challenges
   */
  async respondToAuthChallenge(challengeName, username, newPassword, session) {
    try {
      logger.info('Responding to auth challenge', { username, challengeName });

      const params = {
        ChallengeName: challengeName,
        ClientId: this.clientId,
        Session: session,
        ChallengeResponses: {
          USERNAME: username,
          NEW_PASSWORD: newPassword,
          SECRET_HASH: this.generateSecretHash(username)
        }
      };

      const result = await this.cognito.respondToAuthChallenge(params).promise();
      
      logger.info('Challenge response successful', { username });
      return {
        success: true,
        tokens: result.AuthenticationResult,
        challengeName: result.ChallengeName,
        session: result.Session
      };
    } catch (error) {
      logger.error('Challenge response failed', { username, error: error.message });
      
      // Check for specific Cognito error codes
      if (error.code === 'NotAuthorizedException' || 
          error.code === 'InvalidPasswordException' ||
          error.message.includes('Invalid session') ||
          error.message.includes('Password did not conform')) {
        throw new AuthenticationError('Invalid challenge response or password requirements not met');
      } else {
        // For other errors, throw as server error
        logger.error('Cognito challenge service error', { error: error.code, message: error.message });
        throw new Error(`Challenge response service error: ${error.message}`);
      }
    }
  }

  /**
   * Create a new user in Cognito
   */
  async createUser(userData) {
    try {
      const { username, email, password, temporaryPassword, customAttributes = {}, standardAttributes = {} } = userData;
      
      logger.info('Creating new user', { username, email });

      const userAttributes = [
        { Name: 'email', Value: email },
        { Name: 'email_verified', Value: 'true' }
      ];

      // Add standard attributes
      Object.entries(standardAttributes).forEach(([key, value]) => {
        userAttributes.push({
          Name: key,
          Value: value
        });
      });

      // Add custom attributes
      Object.entries(customAttributes).forEach(([key, value]) => {
        userAttributes.push({
          Name: `custom:${key}`,
          Value: value
        });
      });

      const params = {
        UserPoolId: this.userPoolId,
        Username: username,
        UserAttributes: userAttributes,
        TemporaryPassword: temporaryPassword || password,
        MessageAction: 'SUPPRESS', // Don't send welcome email, we'll handle it
        DesiredDeliveryMediums: ['EMAIL']
      };

      const result = await this.cognito.adminCreateUser(params).promise();
      
      // If this is a signup (password provided), set permanent password
      if (password && !temporaryPassword) {
        await this.setUserPassword(username, password, true);
        logger.info('Permanent password set for signup user', { username });
      }
      
      logger.info('User created successfully', { username, email });
      return result.User;
    } catch (error) {
      logger.error('User creation failed', { error: error.message });
      
      // Handle specific Cognito error codes for client errors
      if (error.code === 'InvalidPasswordException' ||
          error.message.includes('Password did not conform with password policy') ||
          error.message.includes('Password not long enough') ||
          error.message.includes('Password must have') ||
          error.message.includes('password policy')) {
        throw new ValidationError(error.message);
      } else if (error.code === 'UsernameExistsException') {
        throw new ValidationError('Username already exists');
      } else if (error.code === 'InvalidParameterException') {
        throw new ValidationError(error.message);
      } else {
        // Server errors
        throw new Error(`User creation failed: ${error.message}`);
      }
    }
  }

  /**
   * User self-registration (signup)
   */
  async signUpUser(userData) {
    try {
      const { username, email, password, customAttributes = {} } = userData;
      
      logger.info('User self-registration', { username, email });

      const userAttributes = [
        { Name: 'email', Value: email }
      ];

      // Add custom attributes
      Object.entries(customAttributes).forEach(([key, value]) => {
        userAttributes.push({
          Name: `custom:${key}`,
          Value: value
        });
      });

      const params = {
        ClientId: this.clientId,
        Username: username,
        Password: password,
        UserAttributes: userAttributes,
        SecretHash: this.generateSecretHash(username)
      };

      const result = await this.cognito.signUp(params).promise();
      
      logger.info('User signed up successfully', { username, email });
      return result;
    } catch (error) {
      logger.error('User signup failed', { error: error.message });
      
      // Handle specific Cognito error codes for client errors
      if (error.code === 'InvalidPasswordException' ||
          error.message.includes('Password did not conform with password policy') ||
          error.message.includes('Password not long enough') ||
          error.message.includes('Password must have') ||
          error.message.includes('password policy')) {
        throw new ValidationError(error.message);
      } else if (error.code === 'UsernameExistsException') {
        throw new ValidationError('Username already exists');
      } else if (error.code === 'InvalidParameterException') {
        throw new ValidationError(error.message);
      } else {
        // Preserve original error for other cases
        throw error;
      }
    }
  }

  /**
   * Get user details by username
   */
  async getUser(username) {
    try {
      const params = {
        UserPoolId: this.userPoolId,
        Username: username
      };

      const result = await this.cognito.adminGetUser(params).promise();
      
      // Parse user attributes
      const attributes = {};
      result.UserAttributes.forEach(attr => {
        const key = attr.Name.startsWith('custom:') 
          ? attr.Name.replace('custom:', '') 
          : attr.Name;
        attributes[key] = attr.Value;
      });

      return {
        username: result.Username,
        sub: attributes.sub, // Add the unique Cognito user identifier
        email: attributes.email,
        emailVerified: attributes.email_verified === 'true',
        userStatus: result.UserStatus,
        enabled: result.Enabled,
        created: result.UserCreateDate,
        modified: result.UserLastModifiedDate,
        customAttributes: {
          tenantId: attributes.tenant_id,
          userRole: attributes.user_role,
          permissions: attributes.permissions ? JSON.parse(attributes.permissions) : []
        }
      };
    } catch (error) {
      if (error.code === 'UserNotFoundException') {
        return null;
      }
      logger.error('Get user failed', { username, error: error.message });
      throw new Error(`Get user failed: ${error.message}`);
    }
  }

  /**
   * Update user attributes
   */
  async updateUser(username, attributes) {
    try {
      logger.info('Updating user', { username });

      const userAttributes = [];
      
      // Handle standard attributes
      if (attributes.email) {
        userAttributes.push({ Name: 'email', Value: attributes.email });
      }

      // Handle custom attributes
      if (attributes.customAttributes) {
        Object.entries(attributes.customAttributes).forEach(([key, value]) => {
          userAttributes.push({
            Name: `custom:${key}`,
            Value: typeof value === 'object' ? JSON.stringify(value) : value
          });
        });
      }

      if (userAttributes.length > 0) {
        const params = {
          UserPoolId: this.userPoolId,
          Username: username,
          UserAttributes: userAttributes
        };

        await this.cognito.adminUpdateUserAttributes(params).promise();
      }

      logger.info('User updated successfully', { username });
      return true;
    } catch (error) {
      logger.error('User update failed', { username, error: error.message });
      throw new Error(`User update failed: ${error.message}`);
    }
  }

  /**
   * Delete user
   */
  async deleteUser(username) {
    try {
      logger.info('Deleting user', { username });

      const params = {
        UserPoolId: this.userPoolId,
        Username: username
      };

      await this.cognito.adminDeleteUser(params).promise();
      
      logger.info('User deleted successfully', { username });
      return true;
    } catch (error) {
      logger.error('User deletion failed', { username, error: error.message });
      throw new Error(`User deletion failed: ${error.message}`);
    }
  }

  /**
   * List users with pagination
   */
  async listUsers(options = {}) {
    try {
      const { limit = 60, paginationToken, filter } = options;

      const params = {
        UserPoolId: this.userPoolId,
        Limit: limit
      };

      if (paginationToken) {
        params.PaginationToken = paginationToken;
      }

      if (filter) {
        params.Filter = filter;
      }

      const result = await this.cognito.listUsers(params).promise();

      // Format users
      const users = result.Users.map(user => {
        const attributes = {};
        user.UserAttributes.forEach(attr => {
          const key = attr.Name.startsWith('custom:') 
            ? attr.Name.replace('custom:', '') 
            : attr.Name;
          attributes[key] = attr.Value;
        });

        return {
          username: user.Username,
          email: attributes.email,
          userStatus: user.UserStatus,
          enabled: user.Enabled,
          created: user.UserCreateDate,
          modified: user.UserLastModifiedDate,
          customAttributes: {
            tenantId: attributes.tenant_id,
            userRole: attributes.user_role,
            permissions: attributes.permissions ? JSON.parse(attributes.permissions) : []
          }
        };
      });

      return {
        users,
        paginationToken: result.PaginationToken
      };
    } catch (error) {
      logger.error('List users failed', { error: error.message });
      throw new Error(`List users failed: ${error.message}`);
    }
  }

  /**
   * Set user password
   */
  async setUserPassword(username, password, permanent = false) {
    try {
      logger.info('Setting user password', { username, permanent });

      const params = {
        UserPoolId: this.userPoolId,
        Username: username,
        Password: password,
        Permanent: permanent
      };

      await this.cognito.adminSetUserPassword(params).promise();
      
      logger.info('Password set successfully', { username });
      return true;
    } catch (error) {
      logger.error('Set password failed', { username, error: error.message });
      throw new Error(`Set password failed: ${error.message}`);
    }
  }

  /**
   * Enable/disable user
   */
  async setUserStatus(username, enabled) {
    try {
      logger.info('Setting user status', { username, enabled });

      const action = enabled ? 'adminEnableUser' : 'adminDisableUser';
      const params = {
        UserPoolId: this.userPoolId,
        Username: username
      };

      await this.cognito[action](params).promise();
      
      logger.info('User status updated', { username, enabled });
      return true;
    } catch (error) {
      logger.error('Set user status failed', { username, error: error.message });
      throw new Error(`Set user status failed: ${error.message}`);
    }
  }
}

module.exports = { 
  CognitoService, 
  AuthenticationError, 
  AuthorizationError, 
  ValidationError 
};