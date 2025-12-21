import React, { useState, useEffect } from 'react';
import { AccountApiClient } from '../api/AccountApiClient';
import { AccountData } from '../models/AccountModel';
import './Overview.css';

interface AccountStats {
  total: number;
  active: number;
  inactive: number;
  creating: number;
  pending: number;
  publicTier: number;
  privateTier: number;
}

export const Overview: React.FC = () => {
  const [accounts, setAccounts] = useState<AccountData[]>([]);
  const [stats, setStats] = useState<AccountStats>({
    total: 0,
    active: 0,
    inactive: 0,
    creating: 0,
    pending: 0,
    publicTier: 0,
    privateTier: 0
  });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadAccountsAndCalculateStats();
  }, []);

  const loadAccountsAndCalculateStats = async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      const apiClient = AccountApiClient.getInstance();
      const data = await apiClient.fetchAccounts();
      setAccounts(data);
      
      // Calculate statistics
      const newStats: AccountStats = {
        total: data.length,
        active: data.filter(t => t.provisioningState === 'active').length,
        inactive: data.filter(t => t.provisioningState === 'inactive').length,
        creating: data.filter(t => t.provisioningState === 'creating').length,
        pending: data.filter(t => t.provisioningState === 'pending').length,
        publicTier: data.filter(t => t.subscriptionTier === 'public').length,
        privateTier: data.filter(t => t.subscriptionTier === 'private').length
      };
      
      setStats(newStats);
    } catch (err) {
      console.error('Failed to load accounts:', err);
      setError(err instanceof Error ? err.message : 'Failed to load account data');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSuspendAccount = async (accountId: string) => {
    if (!window.confirm(`Are you sure you want to suspend account ${accountId}?`)) {
      return;
    }

    try {
      const apiClient = AccountApiClient.getInstance();
      await apiClient.suspendAccount(accountId);
      
      // Refresh the account list
      await loadAccountsAndCalculateStats();
      
      alert('Account suspended successfully!');
    } catch (err) {
      console.error('Failed to suspend account:', err);
      alert('Failed to suspend account: ' + (err instanceof Error ? err.message : 'Unknown error'));
    }
  };

  if (isLoading) {
    return (
      <div className="overview-view">
        <h1>Account Management Overview</h1>
        <div className="loading-state">Loading account statistics...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="overview-view">
        <h1>Account Management Overview</h1>
        <div className="error-state">
          <p>Error loading data: {error}</p>
          <button onClick={loadAccountsAndCalculateStats}>Retry</button>
        </div>
      </div>
    );
  }

  return (
    <div className="overview-view">
      <h1>Account Management Overview</h1>
      
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-value">{stats.total}</div>
          <div className="stat-label">Total Accounts</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{stats.active}</div>
          <div className="stat-label">Active</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{stats.inactive}</div>
          <div className="stat-label">Suspended</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{stats.creating}</div>
          <div className="stat-label">Provisioning</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{stats.pending}</div>
          <div className="stat-label">Pending</div>
        </div>
      </div>

      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-value">{stats.publicTier}</div>
          <div className="stat-label">Public Tier</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{stats.privateTier}</div>
          <div className="stat-label">Private Tier</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{stats.pending}</div>
          <div className="stat-label">Pending</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">
            {stats.total > 0 ? ((stats.active / stats.total) * 100).toFixed(1) : 0}%
          </div>
          <div className="stat-label">Active Rate</div>
        </div>
      </div>

      {stats.total > 0 && (
        <div className="recent-accounts">
          <h2>Recent Accounts</h2>
          <div className="account-table">
            <table>
              <thead>
                <tr>
                  <th>Account ID</th>
                  <th>Account Name</th>
                  <th>Email</th>
                  <th>Subscription Tier</th>
                  <th>Status</th>
                  <th>Created Date</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {accounts
                  .sort((a, b) => new Date(b.registeredOn).getTime() - new Date(a.registeredOn).getTime())
                  .slice(0, 10)
                  .map(account => (
                    <tr key={account.accountId}>
                      <td className="account-id">{account.accountId}</td>
                      <td className="account-name">{account.accountName}</td>
                      <td className="account-email">{account.email}</td>
                      <td>
                        <span className={`tier-badge ${account.subscriptionTier}`}>
                          {account.subscriptionTier}
                        </span>
                      </td>
                      <td>
                        <span className={`status-badge ${account.provisioningState}`}>
                          {account.provisioningState}
                        </span>
                      </td>
                      <td className="created-date">
                        {new Date(account.registeredOn).toLocaleDateString()}
                      </td>
                      <td className="actions-cell">
                        {account.provisioningState === 'active' && (
                          <button 
                            className="suspend-button"
                            onClick={() => handleSuspendAccount(account.accountId)}
                            title="Suspend account"
                          >
                            Suspend
                          </button>
                        )}
                        {account.provisioningState === 'inactive' && (
                          <span className="status-text inactive">Suspended</span>
                        )}
                        {!['active', 'inactive'].includes(account.provisioningState) && (
                          <span className="status-text">-</span>
                        )}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="info-section">
        <h3>Backend API Status:</h3>
        <div className="api-status">
          <span className="status-indicator online"></span>
          <span>Connected to backend at {process.env.REACT_APP_API_BASE_URL || 'http://localhost:8080/api/v1'}</span>
        </div>
      </div>
    </div>
  );
};
