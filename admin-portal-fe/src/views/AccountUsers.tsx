import React, { useState, useEffect } from 'react';
import { userApiClient, User } from '../api/UserApiClient';
import { AccountApiClient } from '../api/AccountApiClient';
import { AccountData } from '../models/AccountModel';
import { useAuth } from '../contexts/AuthContext';
import './AccountUsers.css';

export const AccountUsers: React.FC = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [accountInfo, setAccountInfo] = useState<AccountData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const { state } = useAuth();
  const token = state.tokens?.accessToken || '';

  // Get current user's account ID
  const currentUserAccountId = state.user?.accountId;

  useEffect(() => {
    const fetchAccountUsers = async () => {
      if (!state.isAuthenticated || !token) {
        setLoading(false);
        setError('Not authenticated');
        return;
      }

      if (!currentUserAccountId || currentUserAccountId === 'platform') {
        setLoading(false);
        setError('No account associated with this user');
        return;
      }

      try {
        setLoading(true);
        setError(null);

        // Fetch account information
        try {
          const accountClient = AccountApiClient.getInstance();
          const accountsData = await accountClient.fetchAccounts();
          const currentAccount = accountsData.find(account => account.accountId === currentUserAccountId);
          setAccountInfo(currentAccount || null);
        } catch (accountError) {
          console.warn('Failed to fetch account info:', accountError);
        }

        // Load users for the current user's account
        await loadUsersForAccount(currentUserAccountId);

      } catch (err) {
        console.error('Error loading account users:', err);
        setError(err instanceof Error ? err.message : 'Failed to load account users');
      } finally {
        setLoading(false);
      }
    };

    fetchAccountUsers();
  }, [state.isAuthenticated, token, currentUserAccountId]);

  const loadUsersForAccount = async (accountId: string) => {
    if (!accountId) {
      setUsers([]);
      return;
    }

    try {
      setLoading(true);
      // This would need to be implemented in the backend to get users for a specific account
      // For now, we'll show super-admin users as a placeholder
      const usersData = await userApiClient.getUsers(token, { group: 'super-admin' });
      setUsers(usersData.filter(user => user.accountId === accountId));
    } catch (error) {
      console.error('Failed to load users for account:', error);
      setError('Failed to load users');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="account-users-loading">
        <div className="loading-spinner"></div>
        <p>Loading Users...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="account-users-error">
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
    <div className="account-users">
      <div className="account-users-header">
        <h1>Users</h1>
        {accountInfo && (
          <div className="account-info">
            <span className="account-label">Account:</span>
            <span className="account-name">{accountInfo.accountName}</span>
            <span className="account-id">({accountInfo.accountId})</span>
          </div>
        )}
      </div>

      <div className="account-users-content">
        {users.length === 0 ? (
          <div className="no-users">
            <p>No users found for your account.</p>
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