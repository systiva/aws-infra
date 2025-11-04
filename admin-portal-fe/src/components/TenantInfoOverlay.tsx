import React, { useState, useEffect } from 'react';
import { TenantApiClient } from '../api/TenantApiClient';
import { TenantData } from '../models/TenantModel';
import './TenantInfoOverlay.css';

interface TenantInfoOverlayProps {
  tenantId: string;
  isOpen: boolean;
  onClose: () => void;
}

export const TenantInfoOverlay: React.FC<TenantInfoOverlayProps> = ({
  tenantId,
  isOpen,
  onClose
}) => {
  const [tenantData, setTenantData] = useState<TenantData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen && tenantId) {
      fetchTenantDetails();
    }
  }, [isOpen, tenantId]);

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

  const fetchTenantDetails = async () => {
    setIsLoading(true);
    setError(null);
    setTenantData(null);

    try {
      const apiClient = TenantApiClient.getInstance();
      const data = await apiClient.fetchTenantDetails(tenantId);
      setTenantData(data);
    } catch (error) {
      console.error('Failed to fetch tenant details:', error);
      setError(error instanceof Error ? error.message : 'Failed to fetch tenant details');
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
    <div className="tenant-overlay-backdrop" onClick={handleBackdropClick}>
      <div className="tenant-overlay-container">
        <div className="tenant-overlay-header">
          <h2>Tenant Information</h2>
          <button 
            className="tenant-overlay-close"
            onClick={onClose}
            title="Close"
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>

        <div className="tenant-overlay-content">
          {isLoading && (
            <div className="tenant-overlay-loading">
              <div className="loading-spinner"></div>
              <p>Loading tenant details...</p>
            </div>
          )}

          {error && (
            <div className="tenant-overlay-error">
              <div className="error-icon">⚠️</div>
              <p>Failed to load tenant information</p>
              <span className="error-details">{error}</span>
              <button 
                className="retry-button"
                onClick={fetchTenantDetails}
              >
                Retry
              </button>
            </div>
          )}

          {tenantData && !isLoading && !error && (
            <div className="tenant-details">
              <div className="detail-section">
                <h3>Basic Information</h3>
                <div className="detail-grid">
                  <div className="detail-item">
                    <label>Tenant ID</label>
                    <span className="detail-value">{tenantData.tenantId}</span>
                  </div>
                  <div className="detail-item">
                    <label>Tenant Name</label>
                    <span className="detail-value">{tenantData.tenantName}</span>
                  </div>
                  <div className="detail-item">
                    <label>Contact Email</label>
                    <span className="detail-value">{tenantData.email}</span>
                  </div>
                  <div className="detail-item">
                    <label>Subscription Tier</label>
                    <span className={`detail-value tier-badge ${tenantData.subscriptionTier}`}>
                      {tenantData.subscriptionTier}
                    </span>
                  </div>
                </div>
              </div>

              <div className="detail-section">
                <h3>Status & Timeline</h3>
                <div className="detail-grid">
                  <div className="detail-item">
                    <label>Provisioning State</label>
                    <span className={`detail-value status-badge ${tenantData.provisioningState}`}>
                      {tenantData.provisioningState}
                    </span>
                  </div>
                  <div className="detail-item">
                    <label>Registered On</label>
                    <span className="detail-value">{formatDate(tenantData.registeredOn)}</span>
                  </div>
                  {tenantData.lastModified && (
                    <div className="detail-item">
                      <label>Last Modified</label>
                      <span className="detail-value">{formatDate(tenantData.lastModified)}</span>
                    </div>
                  )}
                  {tenantData.createdBy && (
                    <div className="detail-item">
                      <label>Created By</label>
                      <span className="detail-value">{tenantData.createdBy}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="tenant-overlay-footer">
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