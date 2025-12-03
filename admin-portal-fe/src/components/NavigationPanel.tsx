import React, { useState } from 'react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useRBAC } from '../hooks/useRBAC';
import { PermissionGuard } from './PermissionGuard';
import { TenantInfoOverlay } from './TenantInfoOverlay';
import './NavigationPanel.css';

export const NavigationPanel: React.FC = () => {
  const { state, logout, setShowAuthOverlay } = useAuth();
  const rbac = useRBAC();
  const [showTenantOverlay, setShowTenantOverlay] = useState(false);

  const navigationItems = rbac.getVisibleNavigationItems();

  return (
    <aside className="navigation-panel">
      <div className="nav-header">
        <h2>Tenant Portal</h2>
      </div>
      <nav className="nav-menu">
        {navigationItems.map((item) => (
          <PermissionGuard 
            key={item.path}
            requiredRoles={item.requiredRoles}
            requiredPermissions={item.requiredPermissions}
          >
            <NavLink 
              to={item.path} 
              className={({ isActive }) => isActive ? 'nav-item active' : 'nav-item'}
            >
              {item.label}
            </NavLink>
          </PermissionGuard>
        ))}
      </nav>
      <div className="nav-footer">
        {state.isAuthenticated ? (
          <div className="user-info">
            <div className="user-avatar">
              {state.user?.username?.charAt(0).toUpperCase()}
            </div>
            <div className="user-details">
              <span className="username">{state.user?.username}</span>
              <span 
                className="tenant-id clickable" 
                onClick={() => setShowTenantOverlay(true)}
                title="Click to view tenant details"
              >
                Tenant: {state.user?.tenantId}
              </span>
              <span className="user-groups">
                {state.user?.groups?.length || 0} groups
              </span>
            </div>
            <button 
              className="logout-button"
              onClick={logout}
              title="Sign Out"
            >
              <svg className="logout-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
                <polyline points="16,17 21,12 16,7"></polyline>
                <line x1="21" y1="12" x2="9" y2="12"></line>
              </svg>
            </button>
          </div>
        ) : (
          <button 
            className="login-button"
            onClick={() => setShowAuthOverlay(true)}
            title="Sign In"
          >
            <span className="login-icon">👤</span>
            <span className="login-text">Sign In</span>
          </button>
        )}
      </div>
      
      {showTenantOverlay && state.user?.tenantId && (
        <TenantInfoOverlay 
          tenantId={state.user.tenantId} 
          isOpen={showTenantOverlay}
          onClose={() => setShowTenantOverlay(false)}
        />
      )}
    </aside>
  );
};
