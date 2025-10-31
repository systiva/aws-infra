import React, { useState, useEffect } from 'react';
import { rbacApiClient, RBACPermission, CreatePermissionRequest } from '../api/RBACApiClient';
import { useAuth } from '../contexts/AuthContext';
import './PermissionManagement.css';

export const PermissionManagement: React.FC = () => {
  const [permissions, setPermissions] = useState<RBACPermission[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingPermission, setEditingPermission] = useState<RBACPermission | null>(null);
  const [formData, setFormData] = useState<CreatePermissionRequest>({
    name: '',
    description: ''
  });

  const { state } = useAuth();
  const token = state.tokens?.accessToken || '';
  const currentUserTenantId = state.user?.tenantId;

  useEffect(() => {
    if (currentUserTenantId && currentUserTenantId !== 'platform') {
      rbacApiClient.setTenantId(currentUserTenantId);
      loadPermissions();
    }
  }, [currentUserTenantId, token]);

  const loadPermissions = async () => {
    try {
      setLoading(true);
      setError(null);
      const permissionsData = await rbacApiClient.getPermissions(token);
      setPermissions(permissionsData);
    } catch (error) {
      console.error('Failed to load permissions:', error);
      setError(error instanceof Error ? error.message : 'Failed to load permissions');
    } finally {
      setLoading(false);
    }
  };

  const handleCreatePermission = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setError(null);
      await rbacApiClient.createPermission(formData, token);
      setFormData({ name: '', description: '' });
      setShowCreateForm(false);
      await loadPermissions();
    } catch (error) {
      console.error('Failed to create permission:', error);
      setError(error instanceof Error ? error.message : 'Failed to create permission');
      // Close the form and reset state even on error
      setFormData({ name: '', description: '' });
      setShowCreateForm(false);
    }
  };

  const handleUpdatePermission = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingPermission) return;

    try {
      setError(null);
      await rbacApiClient.updatePermission(editingPermission.permission_id, formData, token);
      setFormData({ name: '', description: '' });
      setEditingPermission(null);
      setShowCreateForm(false);
      await loadPermissions();
    } catch (error) {
      console.error('Failed to update permission:', error);
      setError(error instanceof Error ? error.message : 'Failed to update permission');
      // Close the form and reset state even on error
      setFormData({ name: '', description: '' });
      setEditingPermission(null);
      setShowCreateForm(false);
    }
  };

  const handleDeletePermission = async (permissionId: string) => {
    if (!window.confirm('Are you sure you want to delete this permission?')) return;

    try {
      setError(null);
      await rbacApiClient.deletePermission(permissionId, token);
      await loadPermissions();
    } catch (error) {
      console.error('Failed to delete permission:', error);
      setError(error instanceof Error ? error.message : 'Failed to delete permission');
    }
  };

  const handleEditPermission = (permission: RBACPermission) => {
    setEditingPermission(permission);
    setFormData({
      name: permission.name,
      description: permission.description || ''
    });
    setShowCreateForm(true);
  };

  const handleCancelEdit = () => {
    setEditingPermission(null);
    setFormData({ name: '', description: '' });
    setShowCreateForm(false);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  if (loading) {
    return (
      <div className="permission-management-loading">
        <div className="loading-spinner"></div>
        <p>Loading Permissions...</p>
      </div>
    );
  }

  return (
    <div className="permission-management">
      <div className="permission-management-header">
        <h1>Permission Management</h1>
        <button
          className="btn btn-primary"
          onClick={() => setShowCreateForm(true)}
          disabled={showCreateForm}
        >
          Add New Permission
        </button>
      </div>

      {error && (
        <div className="error-message">
          <strong>Error:</strong> {error}
          <button onClick={() => setError(null)} className="close-btn">&times;</button>
        </div>
      )}

      {showCreateForm && (
        <div className="permission-form-overlay">
          <div className="permission-form-container">
            <div className="permission-form-header">
              <h2>{editingPermission ? 'Edit Permission' : 'Create New Permission'}</h2>
              <button onClick={handleCancelEdit} className="close-btn">&times;</button>
            </div>
            
            <form onSubmit={editingPermission ? handleUpdatePermission : handleCreatePermission} className="permission-form">
              <div className="form-group">
                <label htmlFor="name">Permission Name *</label>
                <input
                  type="text"
                  id="name"
                  name="name"
                  value={formData.name}
                  onChange={handleInputChange}
                  required
                  placeholder="Enter permission name"
                />
              </div>

              <div className="form-group">
                <label htmlFor="description">Description</label>
                <textarea
                  id="description"
                  name="description"
                  value={formData.description}
                  onChange={handleInputChange}
                  placeholder="Describe what this permission allows"
                  rows={3}
                />
              </div>

              <div className="form-actions">
                <button type="button" onClick={handleCancelEdit} className="btn btn-secondary">
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  {editingPermission ? 'Update Permission' : 'Create Permission'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <div className="permissions-table-container">
        {!permissions || permissions.length === 0 ? (
          <div className="no-permissions">
            <p>No permissions found. Create your first permission to get started.</p>
          </div>
        ) : (
          <table className="permissions-table">
            <thead>
              <tr>
                <th>Permission Name</th>
                <th>Description</th>
                <th>Created By</th>
                <th>Created</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {permissions.map(permission => (
                <tr key={permission.permission_id}>
                  <td>{permission.name}</td>
                  <td>{permission.description || 'No description'}</td>
                  <td>{permission.created_by || 'Unknown'}</td>
                  <td>{new Date(permission.created_at).toLocaleDateString()}</td>
                  <td>
                    <div className="action-buttons">
                      <button
                        onClick={() => handleEditPermission(permission)}
                        className="btn btn-sm btn-outline"
                        title="Edit Permission"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleDeletePermission(permission.permission_id)}
                        className="btn btn-sm btn-danger"
                        title="Delete Permission"
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