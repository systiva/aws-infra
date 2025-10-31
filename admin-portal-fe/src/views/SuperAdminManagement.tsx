import React, { useState, useEffect } from 'react';
import { userApiClient, User, CreateUserRequest } from '../api/UserApiClient';
import { TenantApiClient } from '../api/TenantApiClient';
import { TenantData } from '../models/TenantModel';
import { RoleGuard } from '../components/RoleGuard';
import { useAuth } from '../contexts/AuthContext';
import { getCommonGroupId } from '../utils/groupHelper';
import './SuperAdminManagement.css';

// Using User interface from UserApiClient

export const SuperAdminManagement: React.FC = () => {
  const [superAdmins, setSuperAdmins] = useState<User[]>([]);
  const [tenants, setTenants] = useState<TenantData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [selectedAdmin, setSelectedAdmin] = useState<User | null>(null);
  const [showEditForm, setShowEditForm] = useState(false);

  const { state } = useAuth();
  const token = state.tokens?.accessToken || '';

  // Fetch real data from APIs
  useEffect(() => {
    console.log('SuperAdminManagement: Component mounted/updated');
    console.log('SuperAdminManagement: Auth state:', {
      isAuthenticated: state.isAuthenticated,
      user: state.user,
      hasTokens: !!state.tokens,
      hasAccessToken: !!state.tokens?.accessToken
    });
    console.log('SuperAdminManagement: Token length:', token.length);
    
    const fetchData = async () => {
      // Wait for auth to be properly initialized
      if (state.loading) {
        console.log('SuperAdminManagement: Auth still loading, waiting...');
        return;
      }
      
      if (!state.isAuthenticated) {
        console.log('SuperAdminManagement: User not authenticated');
        setLoading(false);
        setError('Please log in to access this page');
        return;
      }
      
      if (!token) {
        console.log('SuperAdminManagement: No access token available');
        setLoading(false);
        setError('No access token available. Please log in again.');
        return;
      }
      
      try {
        setLoading(true);
        setError(null);
        
        console.log('SuperAdminManagement: Starting API calls...');
        console.log('SuperAdminManagement: Using token:', token.substring(0, 20) + '...');
        
        // Fetch tenants and super admins separately with individual error handling
        let tenantsData: TenantData[] = [];
        let usersData: User[] = [];
        
        // Try to fetch tenants from admin-portal-be
        try {
          console.log('SuperAdminManagement: Calling fetchTenantsWithAuth from admin-portal-be...');
          const tenantClient = TenantApiClient.getInstance();
          tenantsData = await tenantClient.fetchTenantsWithAuth(token);
          console.log('SuperAdminManagement: Fetched tenants:', tenantsData);
        } catch (tenantError) {
          console.warn('SuperAdminManagement: Failed to fetch tenants, showing empty list:', tenantError);
          // Continue with empty tenants list instead of failing completely
        }
        
        // Try to fetch users from IMS service
        try {
          console.log('SuperAdminManagement: Calling getUsers from IMS service...');
          
          // Find the super-admin group ID from current user's groups
          const groupId = getCommonGroupId(state.user?.groups || [], 'SUPER_ADMIN');
          
          if (groupId) {
            console.log('SuperAdminManagement: Using group ID:', groupId);
            usersData = await userApiClient.getUsers(token, { group: groupId });
          } else {
            console.warn('SuperAdminManagement: super-admin group ID not found in user context');
            // Try to get all users instead since we can't filter by group
            usersData = await userApiClient.getUsers(token);
          }
          
          console.log('SuperAdminManagement: Fetched users:', usersData);
        } catch (userError) {
          console.warn('SuperAdminManagement: Failed to fetch users, showing empty list:', userError);
          // Continue with empty users list instead of failing completely
        }
        
        setTenants(tenantsData);
        setSuperAdmins(usersData);
      } catch (err) {
        console.error('SuperAdminManagement: Unexpected error:', err);
        setError(err instanceof Error ? err.message : 'Failed to load data');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [state.isAuthenticated, state.loading, token]);

  const handleCreateSuperAdmin = async (adminData: SuperAdminFormData) => {
    if (!token) {
      setError('Not authenticated');
      return;
    }

    try {
      setLoading(true);
      
      // Log the form data to verify correct values
      console.log('Creating user with data:', {
        username: adminData.username,
        email: adminData.email,
        userRole: adminData.userGroup,
        userGroup: adminData.userGroup,
        tenantId: adminData.tenantId,
        groups: [adminData.userGroup || 'super-admin']
      });
      
      // Create user via API
      const newUser = await userApiClient.createUser({
        username: adminData.username,
        email: adminData.email,
        userRole: adminData.userGroup || 'super-admin', // Map userGroup to userRole for API
        tenantId: adminData.tenantId,
        firstName: adminData.firstName,
        lastName: adminData.lastName,
        temporaryPassword: adminData.temporaryPassword,
        groups: [adminData.userGroup || 'super-admin'] // Use the selected group from dropdown
      }, token);
      
      // Add new admin to state
      setSuperAdmins(prev => [...prev, newUser]);
      setShowCreateForm(false);
      alert('User created successfully!');
      
    } catch (err) {
      console.error('Error creating user:', err);
      setError(err instanceof Error ? err.message : 'Failed to create user');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateSuperAdmin = async (adminData: Partial<User> & { firstName?: string; lastName?: string }) => {
    if (!selectedAdmin) return;
    
    try {
      setLoading(true);
      
      // Update user via API
      await userApiClient.updateUser(selectedAdmin.id, {
        email: adminData.email,
        firstName: adminData.firstName,
        lastName: adminData.lastName
      }, token);
      
      // Update state
      setSuperAdmins(prev => 
        prev.map(admin => 
          admin.username === selectedAdmin.username 
            ? { 
                ...admin, 
                ...adminData
              }
            : admin
        )
      );
      
      setShowEditForm(false);
      setSelectedAdmin(null);
      
    } catch (err) {
      console.error('Error updating user:', err);
      setError(err instanceof Error ? err.message : 'Failed to update user');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteSuperAdmin = async (username: string) => {
    if (window.confirm('Are you sure you want to delete this super admin?')) {
      try {
        setLoading(true);
        
        await userApiClient.deleteUser(username, token);
        setSuperAdmins(prev => prev.filter(admin => admin.username !== username));
        
      } catch (err) {
        console.error('Error deleting user:', err);
        setError(err instanceof Error ? err.message : 'Failed to delete user');
      } finally {
        setLoading(false);
      }
    }
  };

  const handleStatusToggle = async (username: string) => {
    const admin = superAdmins.find(a => a.username === username);
    if (!admin) return;
    
    try {
      setLoading(true);
      
      const newEnabledStatus = !admin.enabled;
      await userApiClient.enableUser(admin.id, newEnabledStatus, token);
      
      setSuperAdmins(prev => 
        prev.map(a => 
          a.username === username 
            ? { ...a, enabled: newEnabledStatus }
            : a
        )
      );
      
    } catch (err) {
      console.error('Error toggling user status:', err);
      setError(err instanceof Error ? err.message : 'Failed to update user status');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="super-admin-loading">
        <div className="loading-spinner"></div>
        <p>Loading Super Admins...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="super-admin-error">
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
    <div className="super-admin-management">
      <div className="super-admin-header">
        <h1>Super Admin Management</h1>
          <button 
            className="create-admin-btn"
            onClick={() => setShowCreateForm(true)}
          >
            Create Super Admin
          </button>
      </div>

      <div className="super-admin-table-container">
        <table className="super-admin-table">
          <thead>
            <tr>
              <th>Username</th>
              <th>Email</th>
              <th>Name</th>
              <th>Tenant</th>
              <th>Group</th>
              <th>Status</th>
              <th>Created</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {superAdmins.length === 0 ? (
              <tr>
                <td colSpan={8} className="empty-state">
                  <div>
                    <h3>No Super Admins Found</h3>
                    <p>Create your first super admin to get started</p>
                  </div>
                </td>
              </tr>
            ) : (
              superAdmins.map(admin => (
                <tr key={admin.username}>
                  <td>{admin.username}</td>
                  <td>{admin.email}</td>
                  <td>{admin.firstName && admin.lastName ? `${admin.firstName} ${admin.lastName}` : 'N/A'}</td>
                  <td>{tenants.find(t => t.tenantId === admin.tenantId)?.tenantName || admin.tenantId || 'N/A'}</td>
                  <td>
                    <span className="group-badge">
                      {admin.userRole}
                    </span>
                  </td>
                  <td>
                    <span className={`status-badge status-${admin.enabled ? 'active' : 'suspended'}`}>
                      {admin.enabled ? 'Active' : 'Suspended'}
                    </span>
                  </td>
                  <td>{new Date(admin.createdAt).toLocaleDateString()}</td>
                  <td>
                    <div className="action-buttons">
                        <button 
                          className="edit-btn"
                          onClick={() => {
                            setSelectedAdmin(admin);
                            setShowEditForm(true);
                          }}
                        >
                          Edit
                        </button>
                        <button 
                          className="toggle-status-btn"
                          onClick={() => handleStatusToggle(admin.username)}
                        >
                          {admin.enabled ? 'Suspend' : 'Activate'}
                        </button>
                        <button 
                          className="delete-btn"
                          onClick={() => handleDeleteSuperAdmin(admin.username)}
                        >
                          Delete
                        </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Create Super Admin Modal */}
      {showCreateForm && (
        <SuperAdminForm
          title="Create Super Admin"
          onSubmit={handleCreateSuperAdmin}
          onCancel={() => setShowCreateForm(false)}
          tenants={tenants}
        />
      )}

      {/* Edit Super Admin Modal */}
      {showEditForm && selectedAdmin && (
        <SuperAdminForm
          title="Edit Super Admin"
          initialData={selectedAdmin}
          onSubmit={handleUpdateSuperAdmin}
          onCancel={() => {
            setShowEditForm(false);
            setSelectedAdmin(null);
          }}
          tenants={tenants}
        />
      )}
    </div>
  );
};

// Form data interface
interface SuperAdminFormData {
  username: string;
  email: string;
  firstName?: string;
  lastName?: string;
  userGroup: string;
  tenantId: string;
  enabled: boolean;
  temporaryPassword?: string;
}

// Super Admin Form Component
interface SuperAdminFormProps {
  title: string;
  initialData?: User;
  onSubmit: (data: SuperAdminFormData) => void;
  onCancel: () => void;
  tenants: TenantData[];
}

const SuperAdminForm: React.FC<SuperAdminFormProps> = ({
  title,
  initialData,
  onSubmit,
  onCancel,
  tenants
}) => {
  const [formData, setFormData] = useState<SuperAdminFormData>({
    username: initialData?.username || '',
    email: initialData?.email || '',
    firstName: initialData?.firstName || '',
    lastName: initialData?.lastName || '',
    userGroup: initialData?.userRole || 'super-admin', // Changed from userRole to userGroup
    tenantId: initialData?.tenantId || '',
    enabled: initialData?.enabled !== undefined ? initialData.enabled : true,
    temporaryPassword: ''
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(formData);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content">
        <div className="modal-header">
          <h2>{title}</h2>
          <button className="modal-close" onClick={onCancel}>&times;</button>
        </div>
        
        <form onSubmit={handleSubmit} className="super-admin-form">
          <div className="form-group">
            <label htmlFor="username">Username *</label>
            <input
              type="text"
              id="username"
              name="username"
              value={formData.username}
              onChange={handleChange}
              required
              disabled={!!initialData} // Disable username editing for existing users
            />
          </div>

          <div className="form-group">
            <label htmlFor="email">Email *</label>
            <input
              type="email"
              id="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="firstName">First Name *</label>
            <input
              type="text"
              id="firstName"
              name="firstName"
              value={formData.firstName}
              onChange={handleChange}
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="lastName">Last Name *</label>
            <input
              type="text"
              id="lastName"
              name="lastName"
              value={formData.lastName}
              onChange={handleChange}
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="tenantId">Tenant *</label>
            <select
              id="tenantId"
              name="tenantId"
              value={formData.tenantId}
              onChange={handleChange}
              required
            >
              <option value="">Select a tenant...</option>
              {tenants.map(tenant => (
                <option key={tenant.tenantId} value={tenant.tenantId}>
                  {tenant.tenantName} ({tenant.tenantId})
                </option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label htmlFor="userGroup">Group *</label>
            <select
              id="userGroup"
              name="userGroup"
              value={formData.userGroup}
              onChange={handleChange}
              required
            >
              <option value="super-admin">Super Admin</option>
              <option value="platform-admin">Platform Admin</option>
            </select>
          </div>

          {!initialData && (
            <div className="form-group">
              <label htmlFor="temporaryPassword">Temporary Password</label>
              <input
                type="password"
                id="temporaryPassword"
                name="temporaryPassword"
                value={formData.temporaryPassword}
                onChange={handleChange}
                placeholder="Leave empty for auto-generated password"
              />
            </div>
          )}

          {initialData && (
            <div className="form-group">
              <label htmlFor="enabled">Status</label>
              <select
                id="enabled"
                name="enabled"
                value={formData.enabled.toString()}
                onChange={(e) => setFormData(prev => ({ ...prev, enabled: e.target.value === 'true' }))}
              >
                <option value="true">Active</option>
                <option value="false">Suspended</option>
              </select>
            </div>
          )}

          <div className="form-actions">
            <button type="button" onClick={onCancel} className="cancel-btn">
              Cancel
            </button>
            <button type="submit" className="submit-btn">
              {initialData ? 'Update' : 'Create'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};