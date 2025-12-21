import React, { useState, useEffect } from 'react';
import { rbacApiClient, RBACUser, RBACGroup, CreateUserRequest } from '../api/RBACApiClient';
import { useAuth } from '../contexts/AuthContext';
import './UserManagement.css';

export const UserManagement: React.FC = () => {
  const [users, setUsers] = useState<RBACUser[]>([]);
  const [groups, setGroups] = useState<RBACGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingUser, setEditingUser] = useState<RBACUser | null>(null);
  const [formData, setFormData] = useState<CreateUserRequest>({
    firstName: '',
    lastName: '',
    userId: '',
    email: '',
    password: '',
    status: 'ACTIVE',
    groupIds: []
  });

  const { state } = useAuth();
  const token = state.tokens?.accessToken || '';
  const currentUserAccountId = state.user?.accountId;

  useEffect(() => {
    if (currentUserAccountId && currentUserAccountId !== 'platform') {
      rbacApiClient.setAccountId(currentUserAccountId);
      loadData();
    }
  }, [currentUserAccountId, token]);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);
      const [usersData, groupsData] = await Promise.all([
        rbacApiClient.getUsers(token),
        rbacApiClient.getGroups(token)
      ]);
      
      // Load user groups for each user and map to full group data
      const usersWithGroups = await Promise.all(
        usersData.map(async (user) => {
          try {
            const userGroupRels = await rbacApiClient.getUserGroups(user.user_id || user.cognitoUserId || '', token);
            // Map group relationships to full group objects
            const userGroups = userGroupRels.map(groupRel => {
              const groupId = groupRel.SK?.replace('GROUP#', '') || groupRel.groupId;
              return groupsData.find(group => group.groupId === groupId);
            }).filter(Boolean); // Remove any undefined values
            
            return { ...user, groups: userGroups };
          } catch (error) {
            console.warn(`Failed to load groups for user ${user.email}:`, error);
            return { ...user, groups: [] };
          }
        })
      );
      
      setUsers(usersWithGroups);
      setGroups(groupsData);
    } catch (error) {
      console.error('Error loading data:', error);
      setError(error instanceof Error ? error.message : 'Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Basic validation
    if (!formData.firstName?.trim() || !formData.lastName?.trim() || !formData.userId?.trim() || !formData.email?.trim()) {
      setError('First name, last name, user ID, and email are required fields');
      return;
    }
    
    try {
      setError(null);
      // Create user payload with frontend format
      const userPayload: CreateUserRequest = {
        firstName: formData.firstName,
        lastName: formData.lastName,
        userId: formData.userId,
        email: formData.email,
        password: formData.password,
        status: formData.status,
        groupIds: [] // Will be assigned separately
      };
      const newUser = await rbacApiClient.createUser(userPayload, token);
      
      // Assign selected groups to the user
      if (formData.groupIds && formData.groupIds.length > 0) {
        const userId = newUser.user_id || newUser.cognitoUserId || '';
        await Promise.all(
          formData.groupIds.map(groupId =>
            rbacApiClient.addUserToGroup(userId, groupId, token)
          )
        );
      }
      
      setFormData({ firstName: '', lastName: '', userId: '', email: '', password: '', status: 'ACTIVE', groupIds: [] });
      setShowCreateForm(false);
      await loadData();
    } catch (error) {
      console.error('Failed to create user:', error);
      
      // Extract error message from different error formats
      let errorMessage = 'Failed to create user';
      
      if (error instanceof Error) {
        errorMessage = error.message;
      } else if (typeof error === 'object' && error !== null) {
        // Handle API error responses
        if ('response' in error && error.response && typeof error.response === 'object') {
          const response = error.response as { data?: { message?: string; error?: string } };
          if (response.data?.message) {
            errorMessage = response.data.message;
          } else if (response.data?.error) {
            errorMessage = response.data.error;
          }
        } else if ('message' in error && typeof error.message === 'string') {
          errorMessage = error.message;
        }
      }
      
      setError(errorMessage);
      // Auto-hide error after 8 seconds for user to read
      setTimeout(() => setError(null), 8000);
    }
  };

  const handleUpdateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;

    // Basic validation
    if (!formData.firstName?.trim() || !formData.lastName?.trim() || !formData.email?.trim()) {
      setError('First name, last name, and email are required fields');
      return;
    }

    try {
      setError(null);
      const userId = editingUser.user_id || editingUser.cognitoUserId || '';
      
      // Update user payload without groupIds
      const updatePayload = {
        name: `${formData.firstName} ${formData.lastName}`.trim(),
        email: formData.email,
        status: formData.status,
        updated_by: state.user?.email || 'system'
      };
      await rbacApiClient.updateUser(userId, updatePayload, token);
      
      // Handle group assignments
      const currentGroupIds = editingUser.groups ? editingUser.groups.map((group: any) => group.groupId || group.id) : [];
      const newGroupIds = formData.groupIds || [];
      
      // Remove user from groups not in the new selection
      const groupsToRemove = currentGroupIds.filter(groupId => !newGroupIds.includes(groupId));
      await Promise.all(
        groupsToRemove.map(groupId =>
          rbacApiClient.removeUserFromGroup(userId, groupId, token)
        )
      );
      
      // Add user to new groups
      const groupsToAdd = newGroupIds.filter(groupId => !currentGroupIds.includes(groupId));
      await Promise.all(
        groupsToAdd.map(groupId =>
          rbacApiClient.addUserToGroup(userId, groupId, token)
        )
      );
      
      setFormData({ firstName: '', lastName: '', userId: '', email: '', password: '', status: 'ACTIVE', groupIds: [] });
      setEditingUser(null);
      setShowCreateForm(false);
      await loadData();
    } catch (error) {
      console.error('Failed to update user:', error);
      setError(error instanceof Error ? error.message : 'Failed to update user');
      // Auto-hide error after 5 seconds
      setTimeout(() => setError(null), 5000);
      // Close form on error after 3 seconds
      setTimeout(() => {
        setShowCreateForm(false);
        setEditingUser(null);
        setFormData({ firstName: '', lastName: '', userId: '', email: '', password: '', status: 'ACTIVE', groupIds: [] });
      }, 3000);
    }
  };

  const handleDeleteUser = async (userId: string) => {
    if (!window.confirm('Are you sure you want to delete this user?')) return;

    try {
      setError(null);
      await rbacApiClient.deleteUser(userId, token);
      await loadData();
    } catch (error) {
      console.error('Failed to delete user:', error);
      setError(error instanceof Error ? error.message : 'Failed to delete user');
    }
  };

  const handleEditUser = (user: RBACUser) => {
    setEditingUser(user);
    const userGroupIds = user.groups ? user.groups.map((group: any) => group.groupId || group.id) : [];
    const [firstName = '', lastName = ''] = (user.name || '').split(' ', 2);
    setFormData({
      firstName,
      lastName,
      userId: user.user_id || '',
      email: user.email,
      password: '', // Empty for editing
      status: user.status || (user.enabled ? 'ACTIVE' : 'INACTIVE'),
      groupIds: userGroupIds
    });
    setShowCreateForm(true);
  };

  const handleCancelEdit = () => {
    setEditingUser(null);
    setFormData({ firstName: '', lastName: '', userId: '', email: '', password: '', status: 'ACTIVE', groupIds: [] });
    setShowCreateForm(false);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleGroupSelectionChange = (groupId: string, isChecked: boolean) => {
    setFormData(prev => ({
      ...prev,
      groupIds: isChecked
        ? [...(prev.groupIds || []), groupId]
        : (prev.groupIds || []).filter(id => id !== groupId)
    }));
  };

  if (loading) {
    return (
      <div className="user-management-loading">
        <div className="loading-spinner"></div>
        <p>Loading Users...</p>
      </div>
    );
  }

  return (
    <div className="user-management">
      <div className="user-management-header">
        <h1>User Management</h1>
        <button
          className="btn btn-primary"
          onClick={() => setShowCreateForm(true)}
          disabled={showCreateForm}
        >
          Add New User
        </button>
      </div>

      {error && (
        <div className="error-message">
          <strong>Error:</strong> {error}
          <button onClick={() => setError(null)} className="close-btn">&times;</button>
        </div>
      )}

      {showCreateForm && (
        <div className="user-form-overlay">
          <div className="user-form-container">
            <div className="user-form-header">
              <h2>{editingUser ? 'Edit User' : 'Create New User'}</h2>
              <button onClick={handleCancelEdit} className="close-btn">&times;</button>
            </div>
            
            <form onSubmit={editingUser ? handleUpdateUser : handleCreateUser} className="user-form">
              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="firstName">First Name *</label>
                  <input
                    type="text"
                    id="firstName"
                    name="firstName"
                    value={formData.firstName}
                    onChange={handleInputChange}
                    required
                    placeholder="First name"
                  />
                </div>
                <div className="form-group">
                  <label htmlFor="lastName">Last Name *</label>
                  <input
                    type="text"
                    id="lastName"
                    name="lastName"
                    value={formData.lastName}
                    onChange={handleInputChange}
                    required
                    placeholder="Last name"
                  />
                </div>
              </div>

              <div className="form-group">
                <label htmlFor="userId">Username (User ID) *</label>
                <input
                  type="text"
                  id="userId"
                  name="userId"
                  value={formData.userId}
                  onChange={handleInputChange}
                  required
                  placeholder="Choose a username"
                  disabled={!!editingUser}
                />
              </div>

              <div className="form-group">
                <label htmlFor="email">Email Address *</label>
                <input
                  type="email"
                  id="email"
                  name="email"
                  value={formData.email}
                  onChange={handleInputChange}
                  required
                  placeholder="Enter email address"
                />
              </div>

              <div className="form-group">
                <label htmlFor="password">Default Password *</label>
                <input
                  type="password"
                  id="password"
                  name="password"
                  value={formData.password}
                  onChange={handleInputChange}
                  required={!editingUser}
                  placeholder="Enter default password (user will change on first login)"
                />
                {!editingUser && (
                  <small className="form-helper">User will be required to change this password on first login</small>
                )}
              </div>

              <div className="form-group">
                <label htmlFor="status">Status</label>
                <select
                  id="status"
                  name="status"
                  value={formData.status}
                  onChange={handleInputChange}
                >
                  <option value="ACTIVE">Active</option>
                  <option value="INACTIVE">Inactive</option>
                  <option value="SUSPENDED">Suspended</option>
                </select>
              </div>

              <div className="form-group">
                <label>Groups</label>
                <div className="groups-grid">
                  {groups.length === 0 ? (
                    <p className="no-groups">No groups available. Create groups first.</p>
                  ) : (
                    groups.map(group => (
                      <label key={group.groupId} className="group-checkbox-simple">
                        <input
                          type="checkbox"
                          checked={(formData.groupIds || []).includes(group.groupId)}
                          onChange={(e) => handleGroupSelectionChange(group.groupId, e.target.checked)}
                        />
                        <span className="group-name-simple">{group.name}</span>
                      </label>
                    ))
                  )}
                </div>
              </div>

              <div className="form-actions">
                <button type="button" onClick={handleCancelEdit} className="btn btn-secondary">
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  {editingUser ? 'Update User' : 'Create User'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <div className="users-table-container">
        {!users || users.length === 0 ? (
          <div className="no-users">
            <p>No users found. Create your first user to get started.</p>
          </div>
        ) : (
          <table className="users-table">
            <thead>
              <tr>
                <th>User ID</th>
                <th>User Name</th>
                <th>User Email</th>
                <th>Groups</th>
                <th>Created</th>
                <th>Created By</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {users?.map(user => (
                <tr key={user.user_id || user.cognitoUserId}>
                  <td>{user.cognitoUsername || user.username || user.user_id || 'N/A'}</td>
                  <td>{user.name || `${user.firstName || ''} ${user.lastName || ''}`.trim() || 'N/A'}</td>
                  <td>{user.email}</td>
                  <td>
                    {(() => {
                      const userGroups = user.groups || [];
                      const count = userGroups.length;
                      return `${count} group${count !== 1 ? 's' : ''}`;
                    })()}
                    {(() => {
                      const userGroups = user.groups || [];
                      return userGroups.length > 0 && (
                        <div className="groups-preview">
                          {userGroups.slice(0, 2).map((group: any, index: number) => (
                            <span key={index} className="group-tag">
                              {group.name || group.group_name}
                            </span>
                          ))}
                          {userGroups.length > 2 && (
                            <span className="group-tag more">+{userGroups.length - 2} more</span>
                          )}
                        </div>
                      );
                    })()}
                  </td>
                  <td>{new Date(user.created_at || user.createdAt || Date.now()).toLocaleDateString()}</td>
                  <td>{user.created_by || 'System'}</td>
                  <td>
                    <div className="action-buttons">
                      <button
                        onClick={() => handleEditUser(user)}
                        className="btn btn-sm btn-outline"
                        title="Edit User"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleDeleteUser(user.user_id || user.cognitoUserId || '')}
                        className="btn btn-sm btn-danger"
                        title="Delete User"
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