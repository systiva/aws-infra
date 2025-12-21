// Context and authorization routes for IMS Service
const express = require('express');
const router = express.Router();

const { CognitoService } = require('../services/cognito-service');
const RBACService = require('../services/rbac_service');
const logger = require('../../logger');

const cognitoService = new CognitoService();
const rbacService = new RBACService();

/**
 * GET /context/user/:username
 * Get user context with permissions
 */
router.get('/user/:username', async (req, res) => {
  try {
    const { username } = req.params;

    logger.info('Getting user context', { username });

    // Get user details
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
      user.sub || user.username, // use sub if available as user ID
      user.email,
      user.username
    );

    res.json({
      success: true,
      userContext
    });

  } catch (error) {
    logger.error('Get user context failed', { username: req.params.username, error: error.message });
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to get user context'
    });
  }
});

/**
 * POST /context/authorize
 * Check if user has specific permissions
 */
router.post('/authorize', async (req, res) => {
  try {
    const { username, permissions, accountId, requireAll = false } = req.body;

    if (!username || !permissions || !Array.isArray(permissions)) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Username and permissions array are required'
      });
    }

    logger.info('Checking authorization', { username, permissions, accountId, requireAll });

    // Get user details
    const user = await cognitoService.getUser(username);
    
    if (!user) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'User not found'
      });
    }

    const userRole = user.customAttributes.userRole || 'viewer';
    const userAccountId = user.customAttributes.accountId;

    // Check permissions
    let hasPermission = false;
    let checkedPermissions = [];

    if (requireAll) {
      // User must have ALL specified permissions
      hasPermission = await rbacService.hasAllPermissions(
        username, 
        accountId || userAccountId, 
        userRole, 
        permissions
      );
      
      // Check each permission individually for details
      for (const permission of permissions) {
        const hasThis = await rbacService.hasPermission(
          username, 
          accountId || userAccountId, 
          userRole, 
          permission
        );
        checkedPermissions.push({
          permission,
          granted: hasThis
        });
      }
    } else {
      // User must have ANY of the specified permissions
      hasPermission = await rbacService.hasAnyPermission(
        username, 
        accountId || userAccountId, 
        userRole, 
        permissions
      );
      
      // Check each permission individually for details
      for (const permission of permissions) {
        const hasThis = await rbacService.hasPermission(
          username, 
          accountId || userAccountId, 
          userRole, 
          permission
        );
        checkedPermissions.push({
          permission,
          granted: hasThis
        });
        
        // For ANY check, we can break early if we find a granted permission
        if (hasThis && !requireAll) {
          break;
        }
      }
    }

    res.json({
      success: true,
      authorized: hasPermission,
      username,
      userRole,
      accountId: accountId || userAccountId,
      checkedPermissions,
      requireAll
    });

  } catch (error) {
    logger.error('Authorization check failed', { error: error.message });
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Authorization check failed'
    });
  }
});

/**
 * POST /context/permission-check
 * Detailed permission check with context
 */
router.post('/permission-check', async (req, res) => {
  try {
    const { username, permission, accountId } = req.body;

    if (!username || !permission) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Username and permission are required'
      });
    }

    logger.info('Detailed permission check', { username, permission, accountId });

    // Get user details
    const user = await cognitoService.getUser(username);
    
    if (!user) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'User not found'
      });
    }

    const userRole = user.customAttributes.userRole || 'viewer';
    const userAccountId = user.customAttributes.accountId;
    const effectiveAccountId = accountId || userAccountId;

    // Check permission
    const hasPermission = await rbacService.hasPermission(
      username, 
      effectiveAccountId, 
      userRole, 
      permission
    );

    // Get all user permissions for context
    const allPermissions = await rbacService.getUserPermissions(
      username,
      effectiveAccountId,
      userRole
    );

    // Get role details
    const roleDetails = rbacService.getRole(userRole);

    res.json({
      success: true,
      hasPermission,
      permission,
      user: {
        username,
        email: user.email,
        userRole,
        accountId: effectiveAccountId,
        userStatus: user.userStatus,
        enabled: user.enabled
      },
      roleDetails,
      allPermissions,
      context: {
        checkTime: new Date().toISOString(),
        effectiveAccountId
      }
    });

  } catch (error) {
    logger.error('Permission check failed', { error: error.message });
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Permission check failed'
    });
  }
});

/**
 * GET /context/account/:accountId/users
 * Get all users for a specific account
 */
router.get('/account/:accountId/users', async (req, res) => {
  try {
    const { accountId } = req.params;
    const { limit = 20, paginationToken } = req.query;

    logger.info('Getting account users', { accountId });

    // Use filter to get users with specific account_id
    const filter = `custom:account_id = "${accountId}"`;
    
    const result = await cognitoService.listUsers({
      limit: parseInt(limit),
      paginationToken,
      filter
    });

    // Enhance users with permission context
    const enhancedUsers = await Promise.all(
      result.users.map(async (user) => {
        try {
          const userContext = await rbacService.createUserContext(
            user.customAttributes.accountId,
            user.sub || user.username, // use sub if available as user ID
            user.email,
            user.username
          );
          
          return {
            ...user,
            permissions: userContext.permissions
          };
        } catch (error) {
          logger.warn('Failed to get permissions for user', { 
            username: user.username, 
            error: error.message 
          });
          return user;
        }
      })
    );

    res.json({
      success: true,
      accountId,
      users: enhancedUsers,
      paginationToken: result.paginationToken,
      count: enhancedUsers.length
    });

  } catch (error) {
    logger.error('Get account users failed', { accountId: req.params.accountId, error: error.message });
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to get account users'
    });
  }
});

/**
 * GET /context/stats
 * Get authorization statistics
 */
router.get('/stats', async (req, res) => {
  try {
    logger.info('Getting authorization stats');

    // Get all users
    const usersResult = await cognitoService.listUsers({ limit: 60 });
    
    // Analyze user distribution
    const stats = {
      totalUsers: usersResult.users.length,
      usersByRole: {},
      usersByAccount: {},
      usersByStatus: {},
      enabledUsers: 0,
      disabledUsers: 0
    };

    usersResult.users.forEach(user => {
      const role = user.customAttributes.userRole || 'viewer';
      const accountId = user.customAttributes.accountId || 'no-account';
      const status = user.userStatus;
      
      // Count by role
      stats.usersByRole[role] = (stats.usersByRole[role] || 0) + 1;
      
      // Count by account
      stats.usersByAccount[accountId] = (stats.usersByAccount[accountId] || 0) + 1;
      
      // Count by status
      stats.usersByStatus[status] = (stats.usersByStatus[status] || 0) + 1;
      
      // Count enabled/disabled
      if (user.enabled) {
        stats.enabledUsers++;
      } else {
        stats.disabledUsers++;
      }
    });

    // Get role information
    const roles = rbacService.getRoles();
    stats.availableRoles = Object.keys(roles).length;
    stats.totalPermissions = new Set(
      Object.values(roles).flatMap(role => role.permissions)
    ).size;

    res.json({
      success: true,
      stats,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    logger.error('Get stats failed', { error: error.message });
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to get authorization stats'
    });
  }
});

module.exports = router;