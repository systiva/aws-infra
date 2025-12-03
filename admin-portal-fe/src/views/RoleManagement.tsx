import React, { useState, useEffect } from 'react';
import { rbacApiClient, RBACRole, RBACPermission, CreateRoleRequest } from '../api/RBACApiClient';
import { useAuth } from '../contexts/AuthContext';
import './RoleManagement.css';

export const RoleManagement: React.FC = () => {
  const [roles, setRoles] = useState<RBACRole[]>([]);
  const [permissions, setPermissions] = useState<RBACPermission[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingRole, setEditingRole] = useState<RBACRole | null>(null);
  const [formData, setFormData] = useState<CreateRoleRequest>({
    name: '',
    description: '',
    permissions: []
  });

  const { state } = useAuth();
  const token = state.tokens?.accessToken || '';
  const currentUserTenantId = state.user?.tenantId;

  useEffect(() => {
    if (currentUserTenantId && currentUserTenantId !== 'platform') {
      rbacApiClient.setTenantId(currentUserTenantId);
      loadData();
    }
  }, [currentUserTenantId, token]);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);
      const [rolesData, permissionsData] = await Promise.all([
        rbacApiClient.getRoles(token),
        rbacApiClient.getPermissions(token)
      ]);
      setRoles(rolesData);
      setPermissions(permissionsData);
    } catch (error) {
      console.error('Failed to load data:', error);
      setError(error instanceof Error ? error.message : 'Failed to load roles and permissions');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateRole = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setError(null);
      await rbacApiClient.createRole(formData, token);
      setFormData({ name: '', description: '', permissions: [] });
      setShowCreateForm(false);
      await loadData();
    } catch (error) {
      console.error('Failed to create role:', error);
      setError(error instanceof Error ? error.message : 'Failed to create role');
      // Close the form and reset state even on error
      setFormData({ name: '', description: '', permissions: [] });
      setShowCreateForm(false);
    }
  };

  const handleUpdateRole = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingRole) return;

    try {
      setError(null);
      await rbacApiClient.updateRole(editingRole.roleId, formData, token);
      setFormData({ name: '', description: '', permissions: [] });
      setEditingRole(null);
      setShowCreateForm(false);
      await loadData();
    } catch (error) {
      console.error('Failed to update role:', error);
      setError(error instanceof Error ? error.message : 'Failed to update role');
      // Close the form and reset state even on error
      setFormData({ name: '', description: '', permissions: [] });
      setEditingRole(null);
      setShowCreateForm(false);
    }
  };

  const handleDeleteRole = async (roleId: string) => {
    if (!window.confirm('Are you sure you want to delete this role? This will remove all role assignments.')) return;

    try {
      setError(null);
      await rbacApiClient.deleteRole(roleId, token);
      await loadData();
    } catch (error) {
      console.error('Failed to delete role:', error);
      setError(error instanceof Error ? error.message : 'Failed to delete role');
    }
  };

  const handleEditRole = (role: RBACRole) => {
    setEditingRole(role);
    setFormData({
      name: role.name,
      description: role.description,
      permissions: role.permissions || []
    });
    setShowCreateForm(true);
  };

  const handleCancelEdit = () => {
    setEditingRole(null);
    setFormData({ name: '', description: '', permissions: [] });
    setShowCreateForm(false);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handlePermissionToggle = (permissionId: string) => {
    setFormData(prev => {
      const currentPermissions = prev.permissions || [];
      const newPermissions = currentPermissions.includes(permissionId)
        ? currentPermissions.filter(p => p !== permissionId)
        : [...currentPermissions, permissionId];
      
      return {
        ...prev,
        permissions: newPermissions
      };
    });
  };

  if (loading) {
    return (
      <div className="role-management-loading">
        <div className="loading-spinner"></div>
        <p>Loading Roles...</p>
      </div>
    );
  }

  return (
    <div className="role-management">
      <div className="role-management-header">
        <h1>Role Management</h1>
        <button
          className="btn btn-primary"
          onClick={() => setShowCreateForm(true)}
          disabled={showCreateForm}
        >
          Add New Role
        </button>
      </div>

      {error && (
        <div className="error-message">
          <strong>Error:</strong> {error}
          <button onClick={() => setError(null)} className="close-btn">&times;</button>
        </div>
      )}

      {showCreateForm && (
        <div className="role-form-overlay">
          <div className="role-form-container">
            <div className="role-form-header">
              <h2>{editingRole ? 'Edit Role' : 'Create New Role'}</h2>
              <button onClick={handleCancelEdit} className="close-btn">&times;</button>
            </div>
            
            <form onSubmit={editingRole ? handleUpdateRole : handleCreateRole} className="role-form">
              <div className="form-group">
                <label htmlFor="name">Role Name *</label>
                <input
                  type="text"
                  id="name"
                  name="name"
                  value={formData.name}
                  onChange={handleInputChange}
                  required
                  placeholder="Enter role name"
                />
              </div>

              <div className="form-group">
                <label htmlFor="description">Description</label>
                <textarea
                  id="description"
                  name="description"
                  value={formData.description}
                  onChange={handleInputChange}
                  placeholder="Enter role description"
                  rows={3}
                />
              </div>

              <div className="form-group">
                <label>Permissions</label>
                <div className="permissions-grid">
                  {permissions.length === 0 ? (
                    <p className="no-permissions">No permissions available. Create permissions first.</p>
                  ) : (
                    permissions.map(permission => (
                      <div key={permission.permissionId} className="permission-checkbox-simple">
                        <input
                          type="checkbox"
                          id={`permission-${permission.permissionId}`}
                          checked={formData.permissions?.includes(permission.permissionId) || false}
                          onChange={(e) => {
                            e.stopPropagation();
                            handlePermissionToggle(permission.permissionId);
                          }}
                        />
                        <label htmlFor={`permission-${permission.permissionId}`} className="permission-name-simple">
                          {permission.name}
                        </label>
                      </div>
                    ))
                  )}
                </div>
              </div>

              <div className="form-actions">
                <button type="button" onClick={handleCancelEdit} className="btn btn-secondary">
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  {editingRole ? 'Update Role' : 'Create Role'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <div className="roles-table-container">
        {roles.length === 0 ? (
          <div className="no-roles">
            <p>No roles found. Create your first role to get started.</p>
          </div>
        ) : (
          <table className="roles-table">
            <thead>
              <tr>
                <th>Role Name</th>
                <th>Description</th>
                <th>Permissions</th>
                <th>Created</th>
                <th>Created By</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {roles.map(role => (
                <tr key={role.roleId}>
                  <td>{role.name}</td>
                  <td>{role.description || 'No description'}</td>
                  <td>
                    {(() => {
                      const validPermissions = role.permissions?.filter(permId => 
                        permissions.find(p => p.permissionId === permId)
                      ) || [];
                      const count = validPermissions.length;
                      return `${count} permission${count !== 1 ? 's' : ''}`;
                    })()}
                    {role.permissions && role.permissions.length > 0 && (
                      <div className="permissions-preview">
                        {role.permissions.slice(0, 2).map(permId => {
                          const perm = permissions.find(p => p.permissionId === permId);
                          return perm ? (
                            <span key={permId} className="permission-tag">
                              {perm.name}
                            </span>
                          ) : null;
                        }).filter(Boolean)}
                        {(() => {
                          const validPermissions = role.permissions.filter(permId => 
                            permissions.find(p => p.permissionId === permId)
                          );
                          return validPermissions.length > 2 && (
                            <span className="permission-tag more">+{validPermissions.length - 2} more</span>
                          );
                        })()}
                      </div>
                    )}
                  </td>
                  <td>{new Date(role.created_at).toLocaleDateString()}</td>
                  <td>{role.created_by || 'system'}</td>
                  <td>
                    <div className="action-buttons">
                      <button
                        onClick={() => handleEditRole(role)}
                        className="btn btn-sm btn-outline"
                        title="Edit Role"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleDeleteRole(role.roleId)}
                        className="btn btn-sm btn-danger"
                        title="Delete Role"
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};