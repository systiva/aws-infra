// Role management routes for IMS Service
const express = require('express');
const router = express.Router();

const RBACService = require('../services/rbac_service');
const logger = require('../../logger');

const rbacService = new RBACService();

/**
 * GET /roles
 * Get all available roles
 */
router.get('/', async (req, res) => {
  try {
    logger.info('Getting all roles');

    const roles = rbacService.getRoles();

    res.json({
      success: true,
      roles: Object.keys(roles).map(key => ({
        id: key,
        name: roles[key].name,
        description: roles[key].description,
        permissions: roles[key].permissions
      }))
    });

  } catch (error) {
    logger.error('Get roles failed', { error: error.message });
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to get roles'
    });
  }
});

/**
 * GET /roles/:roleName
 * Get specific role details
 */
router.get('/:roleName', async (req, res) => {
  try {
    const { roleName } = req.params;

    logger.info('Getting role details', { roleName });

    const role = rbacService.getRole(roleName);
    
    if (!role) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Role not found'
      });
    }

    res.json({
      success: true,
      role: {
        id: roleName,
        name: role.name,
        description: role.description,
        permissions: role.permissions
      }
    });

  } catch (error) {
    logger.error('Get role failed', { roleName: req.params.roleName, error: error.message });
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to get role'
    });
  }
});

/**
 * GET /roles/:roleName/permissions
 * Get permissions for a specific role
 */
router.get('/:roleName/permissions', async (req, res) => {
  try {
    const { roleName } = req.params;

    logger.info('Getting role permissions', { roleName });

    const permissions = rbacService.getRolePermissions(roleName);
    
    if (!permissions.length && !rbacService.isValidRole(roleName)) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Role not found'
      });
    }

    res.json({
      success: true,
      roleName,
      permissions
    });

  } catch (error) {
    logger.error('Get role permissions failed', { roleName: req.params.roleName, error: error.message });
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to get role permissions'
    });
  }
});

/**
 * POST /roles/:roleName/validate
 * Validate if user has specific permissions for a role
 */
router.post('/:roleName/validate', async (req, res) => {
  try {
    const { roleName } = req.params;
    const { permissions } = req.body;

    if (!permissions || !Array.isArray(permissions)) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Permissions array is required'
      });
    }

    logger.info('Validating role permissions', { roleName, permissions });

    if (!rbacService.isValidRole(roleName)) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Role not found'
      });
    }

    const rolePermissions = rbacService.getRolePermissions(roleName);
    const hasAllPermissions = permissions.every(permission => 
      rolePermissions.includes(permission)
    );

    const missingPermissions = permissions.filter(permission => 
      !rolePermissions.includes(permission)
    );

    res.json({
      success: true,
      roleName,
      hasAllPermissions,
      missingPermissions,
      rolePermissions
    });

  } catch (error) {
    logger.error('Validate role permissions failed', { 
      roleName: req.params.roleName, 
      error: error.message 
    });
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to validate role permissions'
    });
  }
});

/**
 * GET /roles/permissions/all
 * Get all available permissions in the system
 */
router.get('/permissions/all', async (req, res) => {
  try {
    logger.info('Getting all system permissions');

    const roles = rbacService.getRoles();
    const allPermissions = new Set();

    // Collect all permissions from all roles
    Object.values(roles).forEach(role => {
      role.permissions.forEach(permission => {
        allPermissions.add(permission);
      });
    });

    const permissionList = Array.from(allPermissions).sort();

    // Group permissions by category
    const categorizedPermissions = permissionList.reduce((acc, permission) => {
      const [category] = permission.split(':');
      if (!acc[category]) {
        acc[category] = [];
      }
      acc[category].push(permission);
      return acc;
    }, {});

    res.json({
      success: true,
      permissions: permissionList,
      categorized: categorizedPermissions,
      total: permissionList.length
    });

  } catch (error) {
    logger.error('Get all permissions failed', { error: error.message });
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to get all permissions'
    });
  }
});

module.exports = router;