import React, { useState, useEffect } from 'react';
import { AccountApiClient } from '../api/AccountApiClient';
import { AccountData } from '../models/AccountModel';
import './AccountDirectory.css';

export const AccountDirectory: React.FC = () => {
  const [accounts, setAccounts] = useState<AccountData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    loadAccounts();
  }, []);

  const loadAccounts = async () => {
    setIsLoading(true);
    try {
      const apiClient = AccountApiClient.getInstance();
      const data = await apiClient.fetchAccounts();
      setAccounts(data);
    } catch (error) {
      console.error('Failed to load accounts:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSuspendAccount = async (account: AccountData) => {
    if (!window.confirm(`Are you sure you want to suspend account "${account.accountName}"?`)) {
      return;
    }

    const apiClient = AccountApiClient.getInstance();
    
    try {
      const updatedAccount = await apiClient.suspendAccount(account.accountId);
      setAccounts(prev => prev.map(t => 
        t.accountId === account.accountId 
          ? updatedAccount
          : t
      ));
      alert('Account suspended successfully');
    } catch (error) {
      console.error('Failed to suspend account:', error);
      alert('Failed to suspend account: ' + (error instanceof Error ? error.message : 'Unknown error'));
    }
  };

  const handleActivateAccount = async (account: AccountData) => {
    if (!window.confirm(`Are you sure you want to activate account "${account.accountName}"?`)) {
      return;
    }

    const apiClient = AccountApiClient.getInstance();
    
    try {
      const updatedAccount = await apiClient.updateAccount(account.accountId, { 
        provisioningState: 'active' 
      });
      setAccounts(prev => prev.map(t => 
        t.accountId === account.accountId 
          ? updatedAccount
          : t
      ));
      alert('Account activated successfully');
    } catch (error) {
      console.error('Failed to activate account:', error);
      alert('Failed to activate account: ' + (error instanceof Error ? error.message : 'Unknown error'));
    }
  };

  const handleDeleteAccount = async (account: AccountData) => {
    if (!window.confirm(`Are you sure you want to delete account "${account.accountName}"? This action cannot be undone.`)) {
      return;
    }

    const apiClient = AccountApiClient.getInstance();
    
    try {
      await apiClient.deleteAccount(account.accountId);
      setAccounts(prev => prev.filter(t => t.accountId !== account.accountId));
      alert('Account deleted successfully');
    } catch (error) {
      console.error('Failed to delete account:', error);
      alert('Failed to delete account');
    }
  };

  const filteredAccounts = accounts.filter(account =>
    account.accountName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    account.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (isLoading) {
    return <div className="loading-state">Loading account directory...</div>;
  }

  return (
    <div className="directory-view">
      <div className="directory-header">
        <h1>Account Directory</h1>
        <input
          type="text"
          className="search-input"
          placeholder="Search accounts..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      <div className="account-grid">
        {filteredAccounts.map((account) => (
          <div key={account.accountId} className="account-card">
            <div className="account-header">
              <h3>{account.accountName}</h3>
              <span className={`status-badge ${account.provisioningState}`}>
                {account.provisioningState}
              </span>
            </div>
            
            <div className="account-details">
              <div className="detail-row">
                <span className="detail-label">Account ID:</span>
                <span className="detail-value">{account.accountId}</span>
              </div>
              <div className="detail-row">
                <span className="detail-label">Email:</span>
                <span className="detail-value">{account.email}</span>
              </div>
              <div className="detail-row">
                <span className="detail-label">Tier:</span>
                <span className={`tier-badge ${account.subscriptionTier}`}>
                  {account.subscriptionTier}
                </span>
              </div>
              <div className="detail-row">
                <span className="detail-label">Registered:</span>
                <span className="detail-value">
                  {new Date(account.registeredOn).toLocaleDateString()}
                </span>
              </div>
              {account.lastModified && (
                <div className="detail-row">
                  <span className="detail-label">Last Modified:</span>
                  <span className="detail-value">
                    {new Date(account.lastModified).toLocaleDateString()}
                  </span>
                </div>
              )}
            </div>

            <div className="account-actions">
              {account.provisioningState === 'active' && (
                <button
                  className="action-btn suspend-btn"
                  onClick={() => handleSuspendAccount(account)}
                >
                  Suspend
                </button>
              )}
              {account.provisioningState === 'inactive' && (
                <button
                  className="action-btn activate-btn"
                  onClick={() => handleActivateAccount(account)}
                >
                  Activate
                </button>
              )}
              {!['active', 'inactive'].includes(account.provisioningState) && (
                <span className="status-text">
                  {account.provisioningState === 'creating' ? 'Provisioning...' : '-'}
                </span>
              )}
              <button 
                className="action-btn secondary"
                onClick={() => handleDeleteAccount(account)}
                disabled={account.provisioningState === 'creating'}
              >
                Delete
              </button>
            </div>
          </div>
        ))}
      </div>

      {filteredAccounts.length === 0 && !isLoading && (
        <div className="empty-state">
          <p>No accounts found matching your search criteria.</p>
        </div>
      )}
    </div>
  );
};
