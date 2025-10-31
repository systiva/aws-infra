// User management routes for IMS Service - Merged with RBAC functionality
const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');

const { CognitoService } = require('../services/cognito-service');
const RBACService = require('../services/rbac_service');
const logger = require('../../logger');

const cognitoService = new CognitoService();
const rbacService = new RBACService();

// Helper function to get tenant ID from request
const getTenantId = (req) => {
  // Get tenant ID from user context or params
  return req.user?.tenantId || req.params.tenantId || req.query.tenantId;
};

const getCurrentUser = (req) => {
  // Try to get from authenticated user context first
  if (req.user) {
    return req.user.sub || req.user.username || req.user.email || 'authenticated-user';
  }
  
  // Fallback to generic identifier
  return 'system';
};

/**
 * GET /users - Get users based on strategy (tenantId, group, role) - Merged RBAC functionality
 * 
 * Query Parameters:
 * - group: Filter by group membership using group ID (uses GROUP#<tenant_id>#<group_id>#USERS access pattern)
 * - role: Filter by role assignment using role ID (gets users through role-group-user relationships)
 * - limit: Pagination limit (default: 20)
 * - paginationToken: Pagination token for next page
 * 
 * Strategy Patterns:
 * 1. tenantId only: PK = TENANT#<tenantId>, SK begins with USER#
 * 2. group filter: PK = GROUP#<tenant_id>#<group_id>#USERS, SK = USER#<userID>
 * 3. role filter: Multi-step query through role->groups->users relationships
 * 
 * Examples:
 * - GET /users (all users in authenticated user's tenant)
 * - GET /users?group=<group-uuid> (users in specific group)
 * - GET /users?role=<role-uuid> (users with specific role)
 */
router.get('/', async (req, res) => {
  try {
    const { group, role, limit = 20, paginationToken } = req.query;
    
    // Get tenantId from user context (JWT token)
    const tenantId = getTenantId(req);
    
    // Validate that tenantId is available (should come from authenticated user's JWT token)
    if (!tenantId) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Unable to determine tenant context. Please ensure you are properly authenticated.',
        supportedFilters: ['group', 'role']
      });
    }
    
    let users = [];
    let strategy = '';

    // Strategy 1: Filter by tenantId only
    if (tenantId && !group && !role) {
      strategy = 'tenantId';
      logger.info(`Using tenantId strategy for tenant: ${tenantId}`);
      users = await rbacService.getAllUsersInTenant(tenantId);
    }
    // Strategy 2: Filter by group
    else if (group) {
      strategy = 'group';
      
      logger.info(`Using group strategy for group ID: ${group} in tenant: ${tenantId}`);
      
      // Get group members using the group ID
      const groupMembers = await rbacService.getGroupMembers(tenantId, group);
      
      // Extract user IDs from group members and fetch user details
      const userIds = groupMembers.map(member => member.SK.replace('USER#', ''));
      
      // Fetch user details for each user ID in parallel
      const userPromises = userIds.map(userId => 
        rbacService.getUser(tenantId, userId)
      );
      
      const userResults = await Promise.all(userPromises);
      users = userResults.filter(user => user !== null);
    }
    // Strategy 3: Filter by role
    else if (role) {
      strategy = 'role';
      
      logger.info(`Using role strategy for role ID: ${role} in tenant: ${tenantId}`);
      
      // Get groups that have this role (using role ID)
      const roleGroups = await rbacService.getRoleGroups(tenantId, role);
      
      // For each group, get its members
      const allUserIds = new Set();
      for (const roleGroup of roleGroups) {
        const groupId = roleGroup.SK.replace('GROUP#', '');
        const groupMembers = await rbacService.getGroupMembers(tenantId, groupId);
        groupMembers.forEach(member => {
          const userId = member.SK.replace('USER#', '');
          allUserIds.add(userId);
        });
      }
      
      // Fetch user details for all unique user IDs in parallel
      const userPromises = Array.from(allUserIds).map(userId => 
        rbacService.getUser(tenantId, userId)
      );
      
      const userResults = await Promise.all(userPromises);
      users = userResults.filter(user => user !== null);
    }
    else {
      return res.status(400).json({ 
        error: 'Invalid filter combination',
        message: 'Use either tenantId alone, or tenantId with group, or tenantId with role',
        supportedFilters: ['tenantId', 'group', 'role']
      });
    }

    res.json({
      success: true,
      data: users,
      users: users, // Keep for backward compatibility
      strategy: strategy,
      filters: { tenantId, group, role },
      count: users.length,
      paginationToken: paginationToken // For future pagination implementation
    });

  } catch (error) {
    logger.error('List users failed', { error: error.message });
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to list users'
    });
  }
});

/**
 * GET /users/:userId
 * Get specific user details - Updated to use TenantRBACService
 */
router.get('/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const tenantId = getTenantId(req);

    logger.info('Getting user details', { userId, tenantId });

    // First try to get from Cognito
    let user;
    try {
      user = await cognitoService.getUser(userId);
    } catch (cognitoError) {
      // If not found in Cognito by username, try by user ID
      logger.info('User not found by username, trying by userId', { userId });
    }

    // Try to get user from RBAC system
    let rbacUser;
    if (tenantId) {
      rbacUser = await rbacService.getUser(tenantId, userId);
    } else {
      // Try platform tenant if no tenantId specified
      rbacUser = await rbacService.getUser('platform', userId);
    }
    
    if (!user && !rbacUser) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'User not found'
      });
    }

    // Merge Cognito and RBAC data
    const mergedUser = {
      ...user,
      ...rbacUser,
      id: userId
    };

    res.json({
      success: true,
      data: mergedUser,
      user: mergedUser // Keep for backward compatibility
    });

  } catch (error) {
    logger.error('Get user failed', { userId: req.params.userId, error: error.message });
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to get user'
    });
  }
});

/**
 * POST /users
 * Create a new user - Updated to use TenantRBACService and Cognito
 */
router.post('/', async (req, res) => {
  try {
    const { name, email, status = 'ACTIVE', created_by, userId, password } = req.body;
    const currentUser = getCurrentUser(req);

    if (!name || !email) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Name and email are required'
      });
    }

    if (!password) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Password is required'
      });
    }

    // Validate password meets minimum requirements
    if (password.length < 8) {
      return res.status(400).json({
        error: 'Invalid Password',
        message: 'Password must be at least 8 characters long'
      });
    }

    // Check for basic password complexity
    const hasUpper = /[A-Z]/.test(password);
    const hasLower = /[a-z]/.test(password);
    const hasNumber = /[0-9]/.test(password);
    const hasSymbol = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password);
    
    if (!hasUpper || !hasLower || !hasNumber || !hasSymbol) {
      return res.status(400).json({
        error: 'Invalid Password',
        message: 'Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character'
      });
    }

    const effectiveTenantId = getTenantId(req);
    if (!effectiveTenantId) {
      return res.status(400).json({ error: 'Tenant ID is required' });
    }

    logger.info('Creating new user', { name, email, status, userId, tenantId: effectiveTenantId });

    // Use provided password as temporary password for Cognito
    const temporaryPassword = password;
    
    // Use provided userId or generate unique username for Cognito
    const cognitoUsername = userId || uuidv4();
    
    // Create user in Cognito first
    let cognitoUser;
    try {
      cognitoUser = await cognitoService.createUser({
        username: cognitoUsername, // Use UUID as username
        email: email,
        temporaryPassword: temporaryPassword
        // Using only basic attributes - email and email_verified
      });
      logger.info('User created in Cognito', { email, cognitoUsername: cognitoUser.Username });
    } catch (cognitoError) {
      logger.error('Cognito user creation failed', { email, error: cognitoError.message });
      
      // Handle specific Cognito errors with clear messages
      if (cognitoError.code === 'UsernameExistsException' || 
          cognitoError.message.includes('already exists')) {
        return res.status(409).json({
          error: 'User Already Exists',
          message: 'A user with this email address or username already exists'
        });
      } else if (cognitoError.code === 'InvalidPasswordException') {
        return res.status(400).json({
          error: 'Invalid Password',
          message: cognitoError.message || 'Password does not meet security requirements'
        });
      } else if (cognitoError.message.includes('password policy')) {
        return res.status(400).json({
          error: 'Password Policy Violation',
          message: 'Password must be at least 8 characters with uppercase, lowercase, number, and special character'
        });
      } else if (cognitoError.message.includes('email format')) {
        return res.status(400).json({
          error: 'Invalid Email',
          message: 'Please provide a valid email address'
        });
      }
      
      return res.status(500).json({
        error: 'User Creation Failed',
        message: cognitoError.message || 'Failed to create user account. Please try again.'
      });
    }

    // Create user entry in RBAC system using TenantRBACService
    const userEntry = {
      name: name,
      email: email,
      status: status,
      created_by: created_by || currentUser,
      cognito_username: cognitoUsername, // Store the generated UUID username
      cognito_sub: cognitoUser.Username, // Store Cognito username (should be same as cognitoUsername)
      password_status: 'TEMPORARY',
      first_login_completed: false
    };

    let createdUser;
    try {
      createdUser = await rbacService.createUser(effectiveTenantId, userEntry);
      logger.info('User entry created in DynamoDB', { userId: createdUser.user_id, tenantId: effectiveTenantId });
    } catch (rbacError) {
      // Rollback: Delete user from Cognito if RBAC creation fails
      logger.error('RBAC user creation failed, rolling back Cognito user', { email, cognitoUsername, error: rbacError.message });
      try {
        await cognitoService.deleteUser(cognitoUsername);
        logger.info('Cognito user rolled back successfully', { email, cognitoUsername });
      } catch (rollbackError) {
        logger.error('Failed to rollback Cognito user', { email, cognitoUsername, error: rollbackError.message });
      }
      
      return res.status(500).json({
        error: 'User Profile Creation Failed',
        message: 'User account was created but failed to set up user profile. Please contact administrator.'
      });
    }

    logger.info('User created successfully', { name, email, userId: createdUser.user_id });

    res.status(201).json({
      success: true,
      message: 'User created successfully. Temporary credentials will be sent via email.',
      data: {
        ...createdUser,
        temporaryPasswordSent: true,
        requiresPasswordChange: true
      }
    });

  } catch (error) {
    logger.error('Create user failed', { error: error.message });
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to create user: ' + error.message
    });
  }
});

/**
 * PUT /users/:userId
 * Update user - Updated to use TenantRBACService
 */
router.put('/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const { firstName, lastName, userRole, tenantId, enabled } = req.body;
    const currentUser = getCurrentUser(req);
    const effectiveTenantId = tenantId || getTenantId(req);
    
    if (!effectiveTenantId) {
      return res.status(400).json({ error: 'Tenant ID is required' });
    }

    logger.info('Updating user', { userId, tenantId: effectiveTenantId });

    // Update in Cognito first
    const updateData = {};
    if (firstName !== undefined) updateData.firstName = firstName;
    if (lastName !== undefined) updateData.lastName = lastName;
    if (userRole !== undefined) updateData.userRole = userRole;
    if (enabled !== undefined) updateData.enabled = enabled;

    // Update Cognito user
    await cognitoService.updateUser(userId, updateData);
    
    // Update RBAC user using TenantRBACService
    const rbacUpdateData = {
      firstName: firstName || '',
      lastName: lastName || '',
      userRole: userRole || 'viewer',
      enabled: enabled !== undefined ? enabled : true,
      updated_by: currentUser
    };
    
    const updatedUser = await rbacService.updateUser(effectiveTenantId, userId, rbacUpdateData);

    logger.info('User updated successfully', { userId, tenantId: effectiveTenantId });

    res.json({
      success: true,
      message: 'User updated successfully',
      data: updatedUser,
      user: updatedUser // Keep for backward compatibility
    });

  } catch (error) {
    logger.error('Update user failed', { userId: req.params.userId, error: error.message });
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to update user: ' + error.message
    });
  }
});

/**
 * DELETE /users/:userId
 * Delete user - Updated to use TenantRBACService
 */
router.delete('/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const { tenantId } = req.query;
    const effectiveTenantId = tenantId || getTenantId(req);
    
    if (!effectiveTenantId) {
      return res.status(400).json({ error: 'Tenant ID is required' });
    }

    logger.info('Deleting user', { userId, tenantId: effectiveTenantId });

    // First get user data from RBAC to find cognito_username
    let rbacUser;
    try {
      rbacUser = await rbacService.getUser(effectiveTenantId, userId);
    } catch (rbacError) {
      logger.warn('User not found in RBAC system', { userId, error: rbacError.message });
    }

    // Try to delete from Cognito using the stored cognito_username
    if (rbacUser && rbacUser.cognito_username) {
      try {
        await cognitoService.deleteUser(rbacUser.cognito_username);
        logger.info('User deleted from Cognito', { userId, cognitoUsername: rbacUser.cognito_username });
      } catch (cognitoError) {
        // User may not exist in Cognito or already deleted
        logger.info('User not found in Cognito or already deleted', { 
          userId, 
          cognitoUsername: rbacUser.cognito_username, 
          error: cognitoError.message 
        });
      }
    } else {
      logger.info('No Cognito username found for user, skipping Cognito deletion', { userId });
    }
    
    // Delete from RBAC system using TenantRBACService
    await rbacService.deleteUser(effectiveTenantId, userId, req.user?.email || 'system');

    logger.info('User deleted successfully', { userId, tenantId: effectiveTenantId });

    res.json({
      success: true,
      message: 'User deleted successfully',
      userId
    });

  } catch (error) {
    logger.error('Delete user failed', { userId: req.params.userId, error: error.message });
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to delete user: ' + error.message
    });
  }
});

/**
 * PUT /users/:username/password
 * Set user password
 */
router.put('/:username/password', async (req, res) => {
  try {
    const { username } = req.params;
    const { password, permanent = true } = req.body;

    if (!password) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Password is required'
      });
    }

    logger.info('Setting user password', { username, permanent });

    // Check if user exists
    const existingUser = await cognitoService.getUser(username);
    if (!existingUser) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'User not found'
      });
    }

    // Set password
    await cognitoService.setUserPassword(username, password, permanent);

    logger.info('Password set successfully', { username });

    res.json({
      success: true,
      message: 'Password set successfully'
    });

  } catch (error) {
    logger.error('Set password failed', { username: req.params.username, error: error.message });
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to set password'
    });
  }
});

/**
 * PUT /users/:username/status
 * Enable/disable user
 */
router.put('/:username/status', async (req, res) => {
  try {
    const { username } = req.params;
    const { enabled } = req.body;

    if (typeof enabled !== 'boolean') {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Enabled status must be a boolean'
      });
    }

    logger.info('Setting user status', { username, enabled });

    // Check if user exists
    const existingUser = await cognitoService.getUser(username);
    if (!existingUser) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'User not found'
      });
    }

    // Set user status
    await cognitoService.setUserStatus(username, enabled);

    logger.info('User status updated', { username, enabled });

    res.json({
      success: true,
      message: `User ${enabled ? 'enabled' : 'disabled'} successfully`
    });

  } catch (error) {
    logger.error('Set user status failed', { username: req.params.username, error: error.message });
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to update user status'
    });
  }
});

/**
 * Generate a temporary password that meets Cognito requirements
 */
function generateTemporaryPassword() {
  const uppercase = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const lowercase = 'abcdefghijklmnopqrstuvwxyz';
  const numbers = '0123456789';
  const symbols = '!@#$%^&*';
  const allChars = uppercase + lowercase + numbers + symbols;
  
  let password = '';
  
  // Ensure password meets Cognito requirements
  password += uppercase.charAt(Math.floor(Math.random() * uppercase.length)); // uppercase
  password += lowercase.charAt(Math.floor(Math.random() * lowercase.length)); // lowercase
  password += numbers.charAt(Math.floor(Math.random() * numbers.length)); // number
  password += symbols.charAt(Math.floor(Math.random() * symbols.length)); // symbol
  
  // Add random characters to reach desired length (12 characters total)
  for (let i = 4; i < 12; i++) {
    password += allChars.charAt(Math.floor(Math.random() * allChars.length));
  }
  
  // Shuffle the password to randomize character positions
  return password.split('').sort(() => Math.random() - 0.5).join('');
}

module.exports = router;