import React, { useState, useEffect } from 'react';
import { userApiClient, User } from '../api/UserApiClient';
import { TenantApiClient } from '../api/TenantApiClient';
import { TenantData } from '../models/TenantModel';
import { useAuth } from '../contexts/AuthContext';
import './TenantUsers.css';

export const TenantUsers: React.FC = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [tenantInfo, setTenantInfo] = useState<TenantData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const { state } = useAuth();
  const token = state.tokens?.accessToken || '';

  // Get current user's tenant ID
  const currentUserTenantId = state.user?.tenantId;

  useEffect(() => {
    const fetchTenantUsers = async () => {
      if (!state.isAuthenticated || !token) {
        setLoading(false);
        setError('Not authenticated');
        return;
      }

      if (!currentUserTenantId || currentUserTenantId === 'platform') {
        setLoading(false);
        setError('No tenant associated with this user');
        return;
      }

      try {
        setLoading(true);
        setError(null);

        // Fetch tenant information
        try {
          const tenantClient = TenantApiClient.getInstance();
          const tenantsData = await tenantClient.fetchTenants();
          const currentTenant = tenantsData.find(tenant => tenant.tenantId === currentUserTenantId);
          setTenantInfo(currentTenant || null);
        } catch (tenantError) {
          console.warn('Failed to fetch tenant info:', tenantError);
        }

        // Load users for the current user's tenant
        await loadUsersForTenant(currentUserTenantId);

      } catch (err) {
        console.error('Error loading tenant users:', err);
        setError(err instanceof Error ? err.message : 'Failed to load tenant users');
      } finally {
        setLoading(false);
      }
    };

    fetchTenantUsers();
  }, [state.isAuthenticated, token, currentUserTenantId]);

  const loadUsersForTenant = async (tenantId: string) => {
    if (!tenantId) {
      setUsers([]);
      return;
    }

    try {
      setLoading(true);
      // This would need to be implemented in the backend to get users for a specific tenant
      // For now, we'll show super-admin users as a placeholder
      const usersData = await userApiClient.getUsers(token, { group: 'super-admin' });
      setUsers(usersData.filter(user => user.tenantId === tenantId));
    } catch (error) {
      console.error('Failed to load users for tenant:', error);
      setError('Failed to load users');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="tenant-users-loading">
        <div className="loading-spinner"></div>
        <p>Loading Users...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="tenant-users-error">
        <h3>Unable to Load Data</h3>
        <p>{error}</p>
        <button 
          className="retry-btn"
          onClick={() => window.location.reload()}
        >
          Try Again
        </button>
      </div>
    );
  }

  return (
    <div className="tenant-users">
      <div className="tenant-users-header">
        <h1>Users</h1>
        {tenantInfo && (
          <div className="tenant-info">
            <span className="tenant-label">Tenant:</span>
            <span className="tenant-name">{tenantInfo.tenantName}</span>
            <span className="tenant-id">({tenantInfo.tenantId})</span>
          </div>
        )}
      </div>

      <div className="tenant-users-content">
        {users.length === 0 ? (
          <div className="no-users">
            <p>No users found for your tenant.</p>
          </div>
        ) : (
          <div className="users-table-container">
            <table className="users-table">
              <thead>
                <tr>
                  <th>Username</th>
                  <th>Email</th>
                  <th>Name</th>
                  <th>Role</th>
                  <th>Status</th>
                  <th>Created</th>
                </tr>
              </thead>
              <tbody>
                {users.map(user => (
                  <tr key={user.id}>
                    <td>{user.username}</td>
                    <td>{user.email}</td>
                    <td>
                      {user.firstName && user.lastName 
                        ? `${user.firstName} ${user.lastName}` 
                        : 'N/A'
                      }
                    </td>
                    <td>
                      <span className="role-badge">
                        {user.userRole}
                      </span>
                    </td>
                    <td>
                      <span className={`status-badge status-${user.enabled ? 'active' : 'inactive'}`}>
                        {user.enabled ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td>{new Date(user.createdAt).toLocaleDateString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};