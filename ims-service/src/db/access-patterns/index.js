/**
 * Access Patterns Index
 * Exports all RBAC access pattern modules
 */

const UserManagement = require('./user_management');
const RoleManagement = require('./role_management');
const GroupManagement = require('./group_management');
const PermissionManagement = require('./permission_management');

module.exports = {
    UserManagement,
    RoleManagement,
    GroupManagement,
    PermissionManagement
};