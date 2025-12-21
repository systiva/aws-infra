const express = require('express');
const router = express.Router();
const RBACService = require('../services/rbac_service');
const logger = require('../../logger');

const rbacService = new RBACService();

// Helper function to get account ID from request
const getAccountId = (req) => {
  // Get account ID from user context or params
  return req.user?.accountId || req.params.accountId || req.query.accountId;
};

const getCurrentUser = (req) => {
  // Try to get from authenticated user context first
  if (req.user) {
    return req.user.sub || req.user.username || req.user.email || 'authenticated-user';
  }
  
  // Fallback to generic identifier
  return 'system';
};

// ===== GROUP ROUTES =====

// GET /rbac/groups - Get all groups in account
router.get('/groups', async (req, res) => {
  try {
    const accountId = getAccountId(req);
    if (!accountId) {
      return res.status(400).json({ error: 'Account ID is required' });
    }

    const groups = await rbacService.getAllGroupsInAccount(accountId);
    res.json({ success: true, data: groups });
  } catch (error) {
    logger.error(`Error getting groups: ${error.message}`);
    res.status(500).json({ error: 'Failed to get groups', details: error.message });
  }
});

// GET /rbac/groups/:groupId - Get specific group
router.get('/groups/:groupId', async (req, res) => {
  try {
    const accountId = getAccountId(req);
    const { groupId } = req.params;

    if (!accountId) {
      return res.status(400).json({ error: 'Account ID is required' });
    }

    const group = await rbacService.getGroup(accountId, groupId);
    if (!group) {
      return res.status(404).json({ error: 'Group not found' });
    }

    res.json({ success: true, data: group });
  } catch (error) {
    logger.error(`Error getting group: ${error.message}`);
    res.status(500).json({ error: 'Failed to get group', details: error.message });
  }
});

// POST /rbac/groups - Create new group
router.post('/groups', async (req, res) => {
  try {
    const accountId = getAccountId(req);
    const currentUser = getCurrentUser(req);

    if (!accountId) {
      return res.status(400).json({ error: 'Account ID is required' });
    }

    const groupData = {
      ...req.body,
      created_by: currentUser
    };

    const group = await rbacService.createGroup(accountId, groupData);
    res.status(201).json({ success: true, data: group });
  } catch (error) {
    logger.error(`Error creating group: ${error.message}`);
    res.status(500).json({ error: 'Failed to create group', details: error.message });
  }
});

// PUT /rbac/groups/:groupId - Update group
router.put('/groups/:groupId', async (req, res) => {
  try {
    const accountId = getAccountId(req);
    const { groupId } = req.params;
    const currentUser = getCurrentUser(req);

    if (!accountId) {
      return res.status(400).json({ error: 'Account ID is required' });
    }

    const updateData = {
      ...req.body,
      updated_by: currentUser
    };

    const group = await rbacService.updateGroup(accountId, groupId, updateData);
    res.json({ success: true, data: group });
  } catch (error) {
    logger.error(`Error updating group: ${error.message}`);
    res.status(500).json({ error: 'Failed to update group', details: error.message });
  }
});

// DELETE /rbac/groups/:groupId - Delete group
router.delete('/groups/:groupId', async (req, res) => {
  try {
    const accountId = getAccountId(req);
    const { groupId } = req.params;
    const currentUser = getCurrentUser(req);

    if (!accountId) {
      return res.status(400).json({ error: 'Account ID is required' });
    }

    const result = await rbacService.deleteGroup(accountId, groupId, currentUser);
    res.json({ success: true, data: result });
  } catch (error) {
    logger.error(`Error deleting group: ${error.message}`);
    res.status(500).json({ error: 'Failed to delete group', details: error.message });
  }
});

// ===== ROLE ROUTES =====

// GET /rbac/roles - Get all roles in account
router.get('/roles', async (req, res) => {
  try {
    const accountId = getAccountId(req);
    if (!accountId) {
      return res.status(400).json({ error: 'Account ID is required' });
    }

    const roles = await rbacService.getAllRolesInAccount(accountId);
    res.json({ success: true, data: roles });
  } catch (error) {
    logger.error(`Error getting roles: ${error.message}`);
    res.status(500).json({ error: 'Failed to get roles', details: error.message });
  }
});

// GET /rbac/roles/:roleId - Get specific role
router.get('/roles/:roleId', async (req, res) => {
  try {
    const accountId = getAccountId(req);
    const { roleId } = req.params;

    if (!accountId) {
      return res.status(400).json({ error: 'Account ID is required' });
    }

    const role = await rbacService.getRole(accountId, roleId);
    if (!role) {
      return res.status(404).json({ error: 'Role not found' });
    }

    res.json({ success: true, data: role });
  } catch (error) {
    logger.error(`Error getting role: ${error.message}`);
    res.status(500).json({ error: 'Failed to get role', details: error.message });
  }
});

// POST /rbac/roles - Create new role
router.post('/roles', async (req, res) => {
  try {
    const accountId = getAccountId(req);
    const currentUser = getCurrentUser(req);

    if (!accountId) {
      return res.status(400).json({ error: 'Account ID is required' });
    }

    const roleData = {
      ...req.body,
      created_by: currentUser
    };

    const role = await rbacService.createRole(accountId, roleData);
    res.status(201).json({ success: true, data: role });
  } catch (error) {
    logger.error(`Error creating role: ${error.message}`);
    res.status(500).json({ error: 'Failed to create role', details: error.message });
  }
});

// PUT /rbac/roles/:roleId - Update role
router.put('/roles/:roleId', async (req, res) => {
  try {
    const accountId = getAccountId(req);
    const { roleId } = req.params;
    const currentUser = getCurrentUser(req);

    if (!accountId) {
      return res.status(400).json({ error: 'Account ID is required' });
    }

    const updateData = {
      ...req.body,
      updated_by: currentUser
    };

    const role = await rbacService.updateRole(accountId, roleId, updateData);
    res.json({ success: true, data: role });
  } catch (error) {
    logger.error(`Error updating role: ${error.message}`);
    res.status(500).json({ error: 'Failed to update role', details: error.message });
  }
});

// DELETE /rbac/roles/:roleId - Delete role
router.delete('/roles/:roleId', async (req, res) => {
  try {
    const accountId = getAccountId(req);
    const { roleId } = req.params;
    const currentUser = getCurrentUser(req);

    if (!accountId) {
      return res.status(400).json({ error: 'Account ID is required' });
    }

    const result = await rbacService.deleteRole(accountId, roleId, currentUser);
    res.json({ success: true, data: result });
  } catch (error) {
    logger.error(`Error deleting role: ${error.message}`);
    res.status(500).json({ error: 'Failed to delete role', details: error.message });
  }
});

// ===== PERMISSION ROUTES =====

// GET /rbac/permissions - Get all permissions in account
router.get('/permissions', async (req, res) => {
  try {
    const accountId = getAccountId(req);
    if (!accountId) {
      return res.status(400).json({ error: 'Account ID is required' });
    }

    const permissions = await rbacService.getAllPermissionsInAccount(accountId);
    res.json({ success: true, data: permissions });
  } catch (error) {
    logger.error(`Error getting permissions: ${error.message}`);
    res.status(500).json({ error: 'Failed to get permissions', details: error.message });
  }
});

// GET /rbac/permissions/:permissionId - Get specific permission
router.get('/permissions/:permissionId', async (req, res) => {
  try {
    const accountId = getAccountId(req);
    const { permissionId } = req.params;

    if (!accountId) {
      return res.status(400).json({ error: 'Account ID is required' });
    }

    const permission = await rbacService.getPermission(accountId, permissionId);
    if (!permission) {
      return res.status(404).json({ error: 'Permission not found' });
    }

    res.json({ success: true, data: permission });
  } catch (error) {
    logger.error(`Error getting permission: ${error.message}`);
    res.status(500).json({ error: 'Failed to get permission', details: error.message });
  }
});

// POST /rbac/permissions - Create new permission
router.post('/permissions', async (req, res) => {
  try {
    const accountId = getAccountId(req);
    const currentUser = getCurrentUser(req);

    if (!accountId) {
      return res.status(400).json({ error: 'Account ID is required' });
    }

    const permissionData = {
      ...req.body,
      created_by: currentUser
    };

    const permission = await rbacService.createPermission(accountId, permissionData);
    res.status(201).json({ success: true, data: permission });
  } catch (error) {
    logger.error(`Error creating permission: ${error.message}`);
    res.status(500).json({ error: 'Failed to create permission', details: error.message });
  }
});

// PUT /rbac/permissions/:permissionId - Update permission
router.put('/permissions/:permissionId', async (req, res) => {
  try {
    const accountId = getAccountId(req);
    const { permissionId } = req.params;
    const currentUser = getCurrentUser(req);

    if (!accountId) {
      return res.status(400).json({ error: 'Account ID is required' });
    }

    const updateData = {
      ...req.body,
      updated_by: currentUser
    };

    const permission = await rbacService.updatePermission(accountId, permissionId, updateData);
    res.json({ success: true, data: permission });
  } catch (error) {
    logger.error(`Error updating permission: ${error.message}`);
    res.status(500).json({ error: 'Failed to update permission', details: error.message });
  }
});

// DELETE /rbac/permissions/:permissionId - Delete permission
router.delete('/permissions/:permissionId', async (req, res) => {
  try {
    const accountId = getAccountId(req);
    const { permissionId } = req.params;
    const currentUser = getCurrentUser(req);

    if (!accountId) {
      return res.status(400).json({ error: 'Account ID is required' });
    }

    const result = await rbacService.deletePermission(accountId, permissionId, currentUser);
    res.json({ success: true, data: result });
  } catch (error) {
    logger.error(`Error deleting permission: ${error.message}`);
    res.status(500).json({ error: 'Failed to delete permission', details: error.message });
  }
});

// ===== ASSIGNMENT ROUTES =====

// POST /rbac/users/:userId/groups - Add user to group  
router.post('/users/:userId/groups', async (req, res) => {
  try {
    const { userId } = req.params;
    const { groupId, accountId } = req.body;
    const currentUser = getCurrentUser(req);
    
    // Prefer accountId from request body (for worker calls) over context (for API Gateway calls)
    const effectiveAccountId = accountId || getAccountId(req);

    if (!effectiveAccountId) {
      return res.status(400).json({ error: 'Account ID is required' });
    }
    if (!groupId) {
      return res.status(400).json({ error: 'Group ID is required' });
    }

    logger.info('Adding user to group', { userId, groupId, accountId: effectiveAccountId });

    const result = await rbacService.addUserToGroup(effectiveAccountId, userId, groupId, currentUser);
    res.json({ success: true, data: result });
  } catch (error) {
    logger.error(`Error adding user to group: ${error.message}`);
    res.status(500).json({ error: 'Failed to add user to group', details: error.message });
  }
});

// DELETE /rbac/users/:userId/groups/:groupId - Remove user from group
router.delete('/users/:userId/groups/:groupId', async (req, res) => {
  try {
    const accountId = getAccountId(req);
    const { userId, groupId } = req.params;
    const currentUser = getCurrentUser(req);

    if (!accountId) {
      return res.status(400).json({ error: 'Account ID is required' });
    }

    const result = await rbacService.removeUserFromGroup(accountId, userId, groupId, currentUser);
    res.json({ success: true, data: result });
  } catch (error) {
    logger.error(`Error removing user from group: ${error.message}`);
    res.status(500).json({ error: 'Failed to remove user from group', details: error.message });
  }
});

// POST /rbac/groups/:groupId/roles - Assign role to group
router.post('/groups/:groupId/roles', async (req, res) => {
  try {
    const accountId = getAccountId(req);
    const { groupId } = req.params;
    const { roleId } = req.body;
    const currentUser = getCurrentUser(req);

    if (!accountId) {
      return res.status(400).json({ error: 'Account ID is required' });
    }
    if (!roleId) {
      return res.status(400).json({ error: 'Role ID is required' });
    }

    const result = await rbacService.assignRoleToGroup(accountId, groupId, roleId, currentUser);
    res.json({ success: true, data: result });
  } catch (error) {
    logger.error(`Error assigning role to group: ${error.message}`);
    res.status(500).json({ error: 'Failed to assign role to group', details: error.message });
  }
});

// DELETE /rbac/groups/:groupId/roles/:roleId - Remove role from group
router.delete('/groups/:groupId/roles/:roleId', async (req, res) => {
  try {
    const accountId = getAccountId(req);
    const { groupId, roleId } = req.params;
    const currentUser = getCurrentUser(req);

    if (!accountId) {
      return res.status(400).json({ error: 'Account ID is required' });
    }

    const result = await rbacService.removeRoleFromGroup(accountId, groupId, roleId, currentUser);
    res.json({ success: true, data: result });
  } catch (error) {
    logger.error(`Error removing role from group: ${error.message}`);
    res.status(500).json({ error: 'Failed to remove role from group', details: error.message });
  }
});

// ===== QUERY ROUTES =====

// GET /rbac/users/:userId/groups - Get user's groups
router.get('/users/:userId/groups', async (req, res) => {
  try {
    const accountId = getAccountId(req);
    const { userId } = req.params;

    if (!accountId) {
      return res.status(400).json({ error: 'Account ID is required' });
    }

    const groups = await rbacService.getUserGroups(accountId, userId);
    res.json({ success: true, data: groups });
  } catch (error) {
    logger.error(`Error getting user groups: ${error.message}`);
    res.status(500).json({ error: 'Failed to get user groups', details: error.message });
  }
});

// GET /rbac/groups/:groupId/members - Get group members
router.get('/groups/:groupId/members', async (req, res) => {
  try {
    const accountId = getAccountId(req);
    const { groupId } = req.params;

    if (!accountId) {
      return res.status(400).json({ error: 'Account ID is required' });
    }

    const members = await rbacService.getGroupMembers(accountId, groupId);
    res.json({ success: true, data: members });
  } catch (error) {
    logger.error(`Error getting group members: ${error.message}`);
    res.status(500).json({ error: 'Failed to get group members', details: error.message });
  }
});

// GET /rbac/groups/:groupId/roles - Get group roles
router.get('/groups/:groupId/roles', async (req, res) => {
  try {
    const accountId = getAccountId(req);
    const { groupId } = req.params;

    if (!accountId) {
      return res.status(400).json({ error: 'Account ID is required' });
    }

    const roles = await rbacService.getGroupRoles(accountId, groupId);
    res.json({ success: true, data: roles });
  } catch (error) {
    logger.error(`Error getting group roles: ${error.message}`);
    res.status(500).json({ error: 'Failed to get group roles', details: error.message });
  }
});

// GET /rbac/roles/:roleId/groups - Get role groups
router.get('/roles/:roleId/groups', async (req, res) => {
  try {
    const accountId = getAccountId(req);
    const { roleId } = req.params;

    if (!accountId) {
      return res.status(400).json({ error: 'Account ID is required' });
    }

    const groups = await rbacService.getRoleGroups(accountId, roleId);
    res.json({ success: true, data: groups });
  } catch (error) {
    logger.error(`Error getting role groups: ${error.message}`);
    res.status(500).json({ error: 'Failed to get role groups', details: error.message });
  }
});

// GET /rbac/audit - Get audit trail
router.get('/audit', async (req, res) => {
  try {
    const accountId = getAccountId(req);
    const limit = parseInt(req.query.limit) || 50;

    if (!accountId) {
      return res.status(400).json({ error: 'Account ID is required' });
    }

    const auditTrail = await rbacService.getAuditTrail(accountId, limit);
    res.json({ success: true, data: auditTrail });
  } catch (error) {
    logger.error(`Error getting audit trail: ${error.message}`);
    res.status(500).json({ error: 'Failed to get audit trail', details: error.message });
  }
});

module.exports = router;