import React, { useState, useEffect } from 'react';
import { TenantApiClient } from '../api/TenantApiClient';
import { TenantData } from '../models/TenantModel';
import './TenantDirectory.css';

export const TenantDirectory: React.FC = () => {
  const [tenants, setTenants] = useState<TenantData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    loadTenants();
  }, []);

  const loadTenants = async () => {
    setIsLoading(true);
    try {
      const apiClient = TenantApiClient.getInstance();
      const data = await apiClient.fetchTenants();
      setTenants(data);
    } catch (error) {
      console.error('Failed to load tenants:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSuspendTenant = async (tenant: TenantData) => {
    if (!window.confirm(`Are you sure you want to suspend tenant "${tenant.tenantName}"?`)) {
      return;
    }

    const apiClient = TenantApiClient.getInstance();
    
    try {
      const updatedTenant = await apiClient.suspendTenant(tenant.tenantId);
      setTenants(prev => prev.map(t => 
        t.tenantId === tenant.tenantId 
          ? updatedTenant
          : t
      ));
      alert('Tenant suspended successfully');
    } catch (error) {
      console.error('Failed to suspend tenant:', error);
      alert('Failed to suspend tenant: ' + (error instanceof Error ? error.message : 'Unknown error'));
    }
  };

  const handleActivateTenant = async (tenant: TenantData) => {
    if (!window.confirm(`Are you sure you want to activate tenant "${tenant.tenantName}"?`)) {
      return;
    }

    const apiClient = TenantApiClient.getInstance();
    
    try {
      const updatedTenant = await apiClient.updateTenant(tenant.tenantId, { 
        provisioningState: 'active' 
      });
      setTenants(prev => prev.map(t => 
        t.tenantId === tenant.tenantId 
          ? updatedTenant
          : t
      ));
      alert('Tenant activated successfully');
    } catch (error) {
      console.error('Failed to activate tenant:', error);
      alert('Failed to activate tenant: ' + (error instanceof Error ? error.message : 'Unknown error'));
    }
  };

  const handleDeleteTenant = async (tenant: TenantData) => {
    if (!window.confirm(`Are you sure you want to delete tenant "${tenant.tenantName}"? This action cannot be undone.`)) {
      return;
    }

    const apiClient = TenantApiClient.getInstance();
    
    try {
      await apiClient.deleteTenant(tenant.tenantId);
      setTenants(prev => prev.filter(t => t.tenantId !== tenant.tenantId));
      alert('Tenant deleted successfully');
    } catch (error) {
      console.error('Failed to delete tenant:', error);
      alert('Failed to delete tenant');
    }
  };

  const filteredTenants = tenants.filter(tenant =>
    tenant.tenantName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    tenant.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (isLoading) {
    return <div className="loading-state">Loading tenant directory...</div>;
  }

  return (
    <div className="directory-view">
      <div className="directory-header">
        <h1>Tenant Directory</h1>
        <input
          type="text"
          className="search-input"
          placeholder="Search tenants..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      <div className="tenant-grid">
        {filteredTenants.map((tenant) => (
          <div key={tenant.tenantId} className="tenant-card">
            <div className="tenant-header">
              <h3>{tenant.tenantName}</h3>
              <span className={`status-badge ${tenant.provisioningState}`}>
                {tenant.provisioningState}
              </span>
            </div>
            
            <div className="tenant-details">
              <div className="detail-row">
                <span className="detail-label">Tenant ID:</span>
                <span className="detail-value">{tenant.tenantId}</span>
              </div>
              <div className="detail-row">
                <span className="detail-label">Email:</span>
                <span className="detail-value">{tenant.email}</span>
              </div>
              <div className="detail-row">
                <span className="detail-label">Tier:</span>
                <span className={`tier-badge ${tenant.subscriptionTier}`}>
                  {tenant.subscriptionTier}
                </span>
              </div>
              <div className="detail-row">
                <span className="detail-label">Registered:</span>
                <span className="detail-value">
                  {new Date(tenant.registeredOn).toLocaleDateString()}
                </span>
              </div>
              {tenant.lastModified && (
                <div className="detail-row">
                  <span className="detail-label">Last Modified:</span>
                  <span className="detail-value">
                    {new Date(tenant.lastModified).toLocaleDateString()}
                  </span>
                </div>
              )}
            </div>

            <div className="tenant-actions">
              {tenant.provisioningState === 'active' && (
                <button
                  className="action-btn suspend-btn"
                  onClick={() => handleSuspendTenant(tenant)}
                >
                  Suspend
                </button>
              )}
              {tenant.provisioningState === 'inactive' && (
                <button
                  className="action-btn activate-btn"
                  onClick={() => handleActivateTenant(tenant)}
                >
                  Activate
                </button>
              )}
              {!['active', 'inactive'].includes(tenant.provisioningState) && (
                <span className="status-text">
                  {tenant.provisioningState === 'creating' ? 'Provisioning...' : '-'}
                </span>
              )}
              <button 
                className="action-btn secondary"
                onClick={() => handleDeleteTenant(tenant)}
                disabled={tenant.provisioningState === 'creating'}
              >
                Delete
              </button>
            </div>
          </div>
        ))}
      </div>

      {filteredTenants.length === 0 && !isLoading && (
        <div className="empty-state">
          <p>No tenants found matching your search criteria.</p>
        </div>
      )}
    </div>
  );
};
