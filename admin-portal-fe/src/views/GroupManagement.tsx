import React, { useState, useEffect } from 'react';
import { rbacApiClient, RBACGroup, RBACUser, RBACRole, CreateGroupRequest } from '../api/RBACApiClient';
import { useAuth } from '../contexts/AuthContext';
import './GroupManagement.css';

export const GroupManagement: React.FC = () => {
  const [groups, setGroups] = useState<RBACGroup[]>([]);
  const [users, setUsers] = useState<RBACUser[]>([]);
  const [roles, setRoles] = useState<RBACRole[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingGroup, setEditingGroup] = useState<RBACGroup | null>(null);
  const [showAssignmentModal, setShowAssignmentModal] = useState(false);
  const [assignmentType, setAssignmentType] = useState<'users' | 'roles'>('users');
  const [selectedGroup, setSelectedGroup] = useState<RBACGroup | null>(null);
  const [groupMembers, setGroupMembers] = useState<any[]>([]);
  const [groupRoles, setGroupRoles] = useState<any[]>([]);
  const [allGroupRoles, setAllGroupRoles] = useState<any[]>([]);
  const [formData, setFormData] = useState<CreateGroupRequest>({
    name: '',
    description: '',
    roleIds: []
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
      const [groupsData, usersData, rolesData] = await Promise.all([
        rbacApiClient.getGroups(token),
        rbacApiClient.getUsers(token),
        rbacApiClient.getRoles(token)
      ]);
      setGroups(groupsData);
      setUsers(usersData);
      setRoles(rolesData);
      
      // Load all group role relationships
      const allRoles = [];
      for (const group of groupsData) {
        try {
          const roles = await rbacApiClient.getGroupRoles(group.group_id, token);
          allRoles.push(...roles.map(role => ({ ...role, group_id: group.group_id })));
        } catch (error) {
          console.warn(`Failed to load roles for group ${group.group_id}:`, error);
        }
      }
      setAllGroupRoles(allRoles);
    } catch (error) {
      console.error('Failed to load data:', error);
      setError(error instanceof Error ? error.message : 'Failed to load groups data');
    } finally {
      setLoading(false);
    }
  };

  const loadGroupDetails = async (group: RBACGroup) => {
    try {
      const [members, roles] = await Promise.all([
        rbacApiClient.getGroupMembers(group.group_id, token),
        rbacApiClient.getGroupRoles(group.group_id, token)
      ]);
      setGroupMembers(members);
      setGroupRoles(roles);
    } catch (error) {
      console.error('Failed to load group details:', error);
      setError(error instanceof Error ? error.message : 'Failed to load group details');
    }
  };

  const handleCreateGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setError(null);
      const createdGroup = await rbacApiClient.createGroup(formData, token);
      
      // Assign selected roles to the newly created group
      if (formData.roleIds && formData.roleIds.length > 0) {
        await Promise.all(
          formData.roleIds.map(roleId => 
            rbacApiClient.assignRoleToGroup(createdGroup.group_id, roleId, token)
          )
        );
      }
      
      setFormData({ name: '', description: '', roleIds: [] });
      setShowCreateForm(false);
      await loadData();
    } catch (error) {
      console.error('Failed to create group:', error);
      setError(error instanceof Error ? error.message : 'Failed to create group');
      // Close overlay even on error after a brief delay to show error
      setTimeout(() => {
        setShowCreateForm(false);
        setError(null);
      }, 3000);
    }
  };

  const handleUpdateGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingGroup) return;

    try {
      setError(null);
      
      // Update group basic info
      await rbacApiClient.updateGroup(editingGroup.group_id, formData, token);
      
      // Handle role assignments if roles were changed
      if (formData.roleIds) {
        // Get current roles
        const currentRoles = await rbacApiClient.getGroupRoles(editingGroup.group_id, token);
        const currentRoleIds = currentRoles.map(role => role.SK.replace('ROLE#', ''));
        
        // Find roles to add and remove
        const rolesToAdd = formData.roleIds.filter(roleId => !currentRoleIds.includes(roleId));
        const rolesToRemove = currentRoleIds.filter(roleId => !formData.roleIds!.includes(roleId));
        
        // Add new roles
        await Promise.all(
          rolesToAdd.map(roleId => 
            rbacApiClient.assignRoleToGroup(editingGroup.group_id, roleId, token)
          )
        );
        
        // Remove old roles
        await Promise.all(
          rolesToRemove.map(roleId => 
            rbacApiClient.removeRoleFromGroup(editingGroup.group_id, roleId, token)
          )
        );
      }
      
      setFormData({ name: '', description: '', roleIds: [] });
      setEditingGroup(null);
      setShowCreateForm(false);
      await loadData();
    } catch (error) {
      console.error('Failed to update group:', error);
      setError(error instanceof Error ? error.message : 'Failed to update group');
      // Close overlay even on error after a brief delay to show error
      setTimeout(() => {
        setShowCreateForm(false);
        setEditingGroup(null);
        setError(null);
      }, 3000);
    }
  };

  const handleDeleteGroup = async (groupId: string) => {
    if (!window.confirm('Are you sure you want to delete this group? This will remove all group assignments.')) return;

    try {
      setError(null);
      await rbacApiClient.deleteGroup(groupId, token);
      await loadData();
    } catch (error) {
      console.error('Failed to delete group:', error);
      setError(error instanceof Error ? error.message : 'Failed to delete group');
    }
  };

  const handleEditGroup = async (group: RBACGroup) => {
    setEditingGroup(group);
    try {
      // Load current roles for the group
      const currentRoles = await rbacApiClient.getGroupRoles(group.group_id, token);
      const currentRoleIds = currentRoles.map(role => role.SK.replace('ROLE#', ''));
      
      setFormData({
        name: group.name,
        description: group.description,
        roleIds: currentRoleIds
      });
    } catch (error) {
      console.error('Failed to load group roles:', error);
      setFormData({
        name: group.name,
        description: group.description,
        roleIds: []
      });
    }
    setShowCreateForm(true);
  };

  const handleManageAssignments = async (group: RBACGroup, type: 'users' | 'roles') => {
    setSelectedGroup(group);
    setAssignmentType(type);
    await loadGroupDetails(group);
    setShowAssignmentModal(true);
  };

  const handleAddUserToGroup = async (userId: string) => {
    if (!selectedGroup) return;

    try {
      setError(null);
      await rbacApiClient.addUserToGroup(userId, selectedGroup.group_id, token);
      await loadGroupDetails(selectedGroup);
    } catch (error) {
      console.error('Failed to add user to group:', error);
      setError(error instanceof Error ? error.message : 'Failed to add user to group');
    }
  };

  const handleRemoveUserFromGroup = async (userId: string) => {
    if (!selectedGroup) return;

    try {
      setError(null);
      await rbacApiClient.removeUserFromGroup(userId, selectedGroup.group_id, token);
      await loadGroupDetails(selectedGroup);
    } catch (error) {
      console.error('Failed to remove user from group:', error);
      setError(error instanceof Error ? error.message : 'Failed to remove user from group');
    }
  };

  const handleAssignRoleToGroup = async (roleId: string) => {
    if (!selectedGroup) return;

    try {
      setError(null);
      await rbacApiClient.assignRoleToGroup(selectedGroup.group_id, roleId, token);
      await loadGroupDetails(selectedGroup);
    } catch (error) {
      console.error('Failed to assign role to group:', error);
      setError(error instanceof Error ? error.message : 'Failed to assign role to group');
    }
  };

  const handleRemoveRoleFromGroup = async (roleId: string) => {
    if (!selectedGroup) return;

    try {
      setError(null);
      await rbacApiClient.removeRoleFromGroup(selectedGroup.group_id, roleId, token);
      await loadGroupDetails(selectedGroup);
    } catch (error) {
      console.error('Failed to remove role from group:', error);
      setError(error instanceof Error ? error.message : 'Failed to remove role from group');
    }
  };

  const handleCancelEdit = () => {
    setEditingGroup(null);
    setFormData({ name: '', description: '', roleIds: [] });
    setShowCreateForm(false);
  };

  const handleCloseAssignmentModal = () => {
    setShowAssignmentModal(false);
    setSelectedGroup(null);
    setGroupMembers([]);
    setGroupRoles([]);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleRoleSelectionChange = (roleId: string, isChecked: boolean) => {
    setFormData(prev => ({
      ...prev,
      roleIds: isChecked 
        ? [...(prev.roleIds || []), roleId]
        : (prev.roleIds || []).filter(id => id !== roleId)
    }));
  };

  const isUserInGroup = (userId: string) => {
    return groupMembers.some(member => member.SK === `USER#${userId}`);
  };

  const isRoleInGroup = (roleId: string) => {
    return groupRoles.some(role => role.SK === `ROLE#${roleId}`);
  };

  if (loading) {
    return (
      <div className="group-management-loading">
        <div className="loading-spinner"></div>
        <p>Loading Groups...</p>
      </div>
    );
  }

  return (
    <div className="group-management">
      <div className="group-management-header">
        <h1>Group Management</h1>
        <button
          className="btn btn-primary"
          onClick={() => setShowCreateForm(true)}
          disabled={showCreateForm}
        >
          Add New Group
        </button>
      </div>

      {error && (
        <div className="error-message">
          <strong>Error:</strong> {error}
          <button onClick={() => setError(null)} className="close-btn">&times;</button>
        </div>
      )}

      {showCreateForm && (
        <div className="group-form-overlay">
          <div className="group-form-container">
            <div className="group-form-header">
              <h2>{editingGroup ? 'Edit Group' : 'Create New Group'}</h2>
              <button onClick={handleCancelEdit} className="close-btn">&times;</button>
            </div>
            
            <form onSubmit={editingGroup ? handleUpdateGroup : handleCreateGroup} className="group-form">
              <div className="form-group">
                <label htmlFor="name">Group Name *</label>
                <input
                  type="text"
                  id="name"
                  name="name"
                  value={formData.name}
                  onChange={handleInputChange}
                  required
                  placeholder="Enter group name"
                />
              </div>

              <div className="form-group">
                <label htmlFor="description">Description</label>
                <textarea
                  id="description"
                  name="description"
                  value={formData.description}
                  onChange={handleInputChange}
                  placeholder="Enter group description"
                  rows={3}
                />
              </div>

              <div className="form-group">
                <label>Roles</label>
                <div className="roles-grid">
                  {roles.length === 0 ? (
                    <p className="no-roles">No roles available. Create roles first.</p>
                  ) : (
                    roles.map(role => (
                      <label key={role.role_id} className="role-checkbox-simple">
                        <input
                          type="checkbox"
                          checked={(formData.roleIds || []).includes(role.role_id)}
                          onChange={(e) => handleRoleSelectionChange(role.role_id, e.target.checked)}
                        />
                        <span className="role-name-simple">{role.name}</span>
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
                  {editingGroup ? 'Update Group' : 'Create Group'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showAssignmentModal && selectedGroup && (
        <div className="assignment-modal-overlay">
          <div className="assignment-modal-container">
            <div className="assignment-modal-header">
              <h2>
                Manage {assignmentType === 'users' ? 'Users' : 'Roles'} - {selectedGroup.name}
              </h2>
              <button onClick={handleCloseAssignmentModal} className="close-btn">&times;</button>
            </div>
            
            <div className="assignment-modal-content">
              {assignmentType === 'users' ? (
                <div className="assignment-section">
                  <h3>Available Users</h3>
                  <div className="assignment-list">
                    {users.filter(user => !isUserInGroup(user.user_id || user.cognitoUserId || '')).map(user => (
                      <div key={user.user_id || user.cognitoUserId} className="assignment-item">
                        <div className="assignment-info">
                          <span className="assignment-name">{user.name || `${user.firstName || ''} ${user.lastName || ''}`.trim() || 'N/A'}</span>
                          <span className="assignment-detail">{user.email}</span>
                        </div>
                        <button
                          onClick={() => handleAddUserToGroup(user.user_id || user.cognitoUserId || '')}
                          className="btn btn-sm btn-primary"
                        >
                          Add
                        </button>
                      </div>
                    ))}
                  </div>

                  <h3>Current Members</h3>
                  <div className="assignment-list">
                    {groupMembers.map(member => {
                      const userId = member.SK.replace('USER#', '');
                      const user = users.find(u => (u.user_id === userId) || (u.cognitoUserId === userId));
                      return user ? (
                        <div key={member.SK} className="assignment-item">
                          <div className="assignment-info">
                            <span className="assignment-name">{user.name || `${user.firstName || ''} ${user.lastName || ''}`.trim() || 'N/A'}</span>
                            <span className="assignment-detail">{user.email}</span>
                          </div>
                          <button
                            onClick={() => handleRemoveUserFromGroup(userId)}
                            className="btn btn-sm btn-danger"
                          >
                            Remove
                          </button>
                        </div>
                      ) : null;
                    })}
                    {groupMembers.length === 0 && (
                      <p className="no-assignments">No users assigned to this group.</p>
                    )}
                  </div>
                </div>
              ) : (
                <div className="assignment-section">
                  <h3>Available Roles</h3>
                  <div className="assignment-list">
                    {roles.filter(role => !isRoleInGroup(role.role_id)).map(role => (
                      <div key={role.role_id} className="assignment-item">
                        <div className="assignment-info">
                          <span className="assignment-name">{role.name}</span>
                          <span className="assignment-detail">{role.description}</span>
                        </div>
                        <button
                          onClick={() => handleAssignRoleToGroup(role.role_id)}
                          className="btn btn-sm btn-primary"
                        >
                          Assign
                        </button>
                      </div>
                    ))}
                  </div>

                  <h3>Assigned Roles</h3>
                  <div className="assignment-list">
                    {groupRoles.map(groupRole => {
                      const roleId = groupRole.SK.replace('ROLE#', '');
                      const role = roles.find(r => r.role_id === roleId);
                      return role ? (
                        <div key={groupRole.SK} className="assignment-item">
                          <div className="assignment-info">
                            <span className="assignment-name">{role.name}</span>
                            <span className="assignment-detail">{role.description || 'No description'}</span>
                          </div>
                          <button
                            onClick={() => handleRemoveRoleFromGroup(roleId)}
                            className="btn btn-sm btn-danger"
                          >
                            Remove
                          </button>
                        </div>
                      ) : null;
                    })}
                    {groupRoles.length === 0 && (
                      <p className="no-assignments">No roles assigned to this group.</p>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      <div className="groups-table-container">
        {groups.length === 0 ? (
          <div className="no-groups">
            <p>No groups found. Create your first group to get started.</p>
          </div>
        ) : (
          <table className="groups-table">
            <thead>
              <tr>
                <th>Group Name</th>
                <th>Description</th>
                <th>Roles</th>
                <th>Created</th>
                <th>Created By</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {groups.map(group => (
                <tr key={group.group_id}>
                  <td>{group.name}</td>
                  <td>{group.description || 'No description'}</td>
                  <td>
                    {(() => {
                      const groupRoleData = allGroupRoles.filter(gr => gr.group_id === group.group_id);
                      const count = groupRoleData.length;
                      return `${count} role${count !== 1 ? 's' : ''}`;
                    })()}
                    {(() => {
                      const groupRoleData = allGroupRoles.filter(gr => gr.group_id === group.group_id);
                      return groupRoleData.length > 0 && (
                        <div className="roles-preview">
                          {groupRoleData.slice(0, 2).map(gr => {
                            const roleId = gr.SK.replace('ROLE#', '');
                            const role = roles.find(r => r.role_id === roleId);
                            return role ? (
                              <span key={roleId} className="role-tag">
                                {role.name}
                              </span>
                            ) : null;
                          }).filter(Boolean)}
                          {groupRoleData.length > 2 && (
                            <span className="role-tag more">+{groupRoleData.length - 2} more</span>
                          )}
                        </div>
                      );
                    })()}
                  </td>
                  <td>{new Date(group.created_at).toLocaleDateString()}</td>
                  <td>{group.created_by || 'system'}</td>
                  <td>
                    <div className="action-buttons">
                      <button
                        onClick={() => handleEditGroup(group)}
                        className="btn btn-sm btn-outline"
                        title="Edit Group"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleDeleteGroup(group.group_id)}
                        className="btn btn-sm btn-danger"
                        title="Delete Group"
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