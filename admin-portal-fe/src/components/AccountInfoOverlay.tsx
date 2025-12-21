import React, { useState, useEffect } from 'react';
import { AccountApiClient } from '../api/AccountApiClient';
import { AccountData } from '../models/AccountModel';
import './AccountInfoOverlay.css';

interface AccountInfoOverlayProps {
  accountId: string;
  isOpen: boolean;
  onClose: () => void;
}

export const AccountInfoOverlay: React.FC<AccountInfoOverlayProps> = ({
  accountId,
  isOpen,
  onClose
}) => {
  const [accountData, setAccountData] = useState<AccountData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen && accountId) {
      fetchAccountDetails();
    }
  }, [isOpen, accountId]);

  useEffect(() => {
    const handleEscapeKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleEscapeKey);
      document.body.style.overflow = 'hidden';
    }

    return () => {
      document.removeEventListener('keydown', handleEscapeKey);
      document.body.style.overflow = 'unset';
    };
  }, [isOpen, onClose]);

  const fetchAccountDetails = async () => {
    setIsLoading(true);
    setError(null);
    setAccountData(null);

    try {
      const apiClient = AccountApiClient.getInstance();
      const data = await apiClient.fetchAccountDetails(accountId);
      setAccountData(data);
    } catch (error) {
      console.error('Failed to fetch account details:', error);
      setError(error instanceof Error ? error.message : 'Failed to fetch account details');
    } finally {
      setIsLoading(false);
    }
  };

  const handleBackdropClick = (event: React.MouseEvent) => {
    if (event.target === event.currentTarget) {
      onClose();
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (!isOpen) {
    return null;
  }

  return (
    <div className="account-overlay-backdrop" onClick={handleBackdropClick}>
      <div className="account-overlay-container">
        <div className="account-overlay-header">
          <h2>Account Information</h2>
          <button 
            className="account-overlay-close"
            onClick={onClose}
            title="Close"
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>

        <div className="account-overlay-content">
          {isLoading && (
            <div className="account-overlay-loading">
              <div className="loading-spinner"></div>
              <p>Loading account details...</p>
            </div>
          )}

          {error && (
            <div className="account-overlay-error">
              <div className="error-icon">⚠️</div>
              <p>Failed to load account information</p>
              <span className="error-details">{error}</span>
              <button 
                className="retry-button"
                onClick={fetchAccountDetails}
              >
                Retry
              </button>
            </div>
          )}

          {accountData && !isLoading && !error && (
            <div className="account-details">
              <div className="detail-section">
                <h3>Basic Information</h3>
                <div className="detail-grid">
                  <div className="detail-item">
                    <label>Account ID</label>
                    <span className="detail-value">{accountData.accountId}</span>
                  </div>
                  <div className="detail-item">
                    <label>Account Name</label>
                    <span className="detail-value">{accountData.accountName}</span>
                  </div>
                  <div className="detail-item">
                    <label>Contact Email</label>
                    <span className="detail-value">{accountData.email}</span>
                  </div>
                  <div className="detail-item">
                    <label>Subscription Tier</label>
                    <span className={`detail-value tier-badge ${accountData.subscriptionTier}`}>
                      {accountData.subscriptionTier}
                    </span>
                  </div>
                </div>
              </div>

              <div className="detail-section">
                <h3>Status & Timeline</h3>
                <div className="detail-grid">
                  <div className="detail-item">
                    <label>Provisioning State</label>
                    <span className={`detail-value status-badge ${accountData.provisioningState}`}>
                      {accountData.provisioningState}
                    </span>
                  </div>
                  <div className="detail-item">
                    <label>Registered On</label>
                    <span className="detail-value">{formatDate(accountData.registeredOn)}</span>
                  </div>
                  {accountData.lastModified && (
                    <div className="detail-item">
                      <label>Last Modified</label>
                      <span className="detail-value">{formatDate(accountData.lastModified)}</span>
                    </div>
                  )}
                  {accountData.createdBy && (
                    <div className="detail-item">
                      <label>Created By</label>
                      <span className="detail-value">{accountData.createdBy}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="account-overlay-footer">
          <button 
            className="close-button"
            onClick={onClose}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};