import React, { useState, useEffect } from 'react';
import { TenantApiClient } from '../api/TenantApiClient';
import { TenantData } from '../models/TenantModel';
import './Overview.css';

interface TenantStats {
  total: number;
  active: number;
  inactive: number;
  creating: number;
  pending: number;
  publicTier: number;
  privateTier: number;
}

export const Overview: React.FC = () => {
  const [tenants, setTenants] = useState<TenantData[]>([]);
  const [stats, setStats] = useState<TenantStats>({
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
    loadTenantsAndCalculateStats();
  }, []);

  const loadTenantsAndCalculateStats = async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      const apiClient = TenantApiClient.getInstance();
      const data = await apiClient.fetchTenants();
      setTenants(data);
      
      // Calculate statistics
      const newStats: TenantStats = {
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
      console.error('Failed to load tenants:', err);
      setError(err instanceof Error ? err.message : 'Failed to load tenant data');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSuspendTenant = async (tenantId: string) => {
    if (!window.confirm(`Are you sure you want to suspend tenant ${tenantId}?`)) {
      return;
    }

    try {
      const apiClient = TenantApiClient.getInstance();
      await apiClient.suspendTenant(tenantId);
      
      // Refresh the tenant list
      await loadTenantsAndCalculateStats();
      
      alert('Tenant suspended successfully!');
    } catch (err) {
      console.error('Failed to suspend tenant:', err);
      alert('Failed to suspend tenant: ' + (err instanceof Error ? err.message : 'Unknown error'));
    }
  };

  if (isLoading) {
    return (
      <div className="overview-view">
        <h1>Tenant Management Overview</h1>
        <div className="loading-state">Loading tenant statistics...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="overview-view">
        <h1>Tenant Management Overview</h1>
        <div className="error-state">
          <p>Error loading data: {error}</p>
          <button onClick={loadTenantsAndCalculateStats}>Retry</button>
        </div>
      </div>
    );
  }

  return (
    <div className="overview-view">
      <h1>Tenant Management Overview</h1>
      
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-value">{stats.total}</div>
          <div className="stat-label">Total Tenants</div>
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
        <div className="recent-tenants">
          <h2>Recent Tenants</h2>
          <div className="tenant-table">
            <table>
              <thead>
                <tr>
                  <th>Tenant ID</th>
                  <th>Tenant Name</th>
                  <th>Email</th>
                  <th>Subscription Tier</th>
                  <th>Status</th>
                  <th>Created Date</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {tenants
                  .sort((a, b) => new Date(b.registeredOn).getTime() - new Date(a.registeredOn).getTime())
                  .slice(0, 10)
                  .map(tenant => (
                    <tr key={tenant.tenantId}>
                      <td className="tenant-id">{tenant.tenantId}</td>
                      <td className="tenant-name">{tenant.tenantName}</td>
                      <td className="tenant-email">{tenant.email}</td>
                      <td>
                        <span className={`tier-badge ${tenant.subscriptionTier}`}>
                          {tenant.subscriptionTier}
                        </span>
                      </td>
                      <td>
                        <span className={`status-badge ${tenant.provisioningState}`}>
                          {tenant.provisioningState}
                        </span>
                      </td>
                      <td className="created-date">
                        {new Date(tenant.registeredOn).toLocaleDateString()}
                      </td>
                      <td className="actions-cell">
                        {tenant.provisioningState === 'active' && (
                          <button 
                            className="suspend-button"
                            onClick={() => handleSuspendTenant(tenant.tenantId)}
                            title="Suspend tenant"
                          >
                            Suspend
                          </button>
                        )}
                        {tenant.provisioningState === 'inactive' && (
                          <span className="status-text inactive">Suspended</span>
                        )}
                        {!['active', 'inactive'].includes(tenant.provisioningState) && (
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
