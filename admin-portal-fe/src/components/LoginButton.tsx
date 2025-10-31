import React from 'react';
import { useAuth } from '../contexts/AuthContext';
import './LoginButton.css';

const LoginButton: React.FC = () => {
  const { state, logout, showAuthOverlay, setShowAuthOverlay } = useAuth();

  const handleLoginClick = () => {
    if (state.isAuthenticated) {
      logout();
    } else {
      setShowAuthOverlay(true);
    }
  };

  return (
    <div className="login-button-container">
      <button
        className={`login-button ${state.isAuthenticated ? 'authenticated' : ''}`}
        onClick={handleLoginClick}
        title={state.isAuthenticated ? `Logout (${state.user?.email})` : 'Login / Sign Up'}
      >
        <div className="login-button-icon">
          {state.isAuthenticated ? (
            // User icon when authenticated
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/>
            </svg>
          ) : (
            // Login icon when not authenticated
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
              <path d="M11 7L9.6 8.4l2.6 2.6H2v2h10.2l-2.6 2.6L11 17l5-5-5-5zm9 12h-8v2h8c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2h-8v2h8v14z"/>
            </svg>
          )}
        </div>
        <div className="login-button-text">
          {state.isAuthenticated ? 'Logout' : 'Login'}
        </div>
        {state.isAuthenticated && state.user && (
          <div className="user-info">
            <div className="user-email">{state.user.email}</div>
            {state.user.tenantId && (
              <div className="user-tenant">Tenant: {state.user.tenantId}</div>
            )}
            {state.user.userRoles && state.user.userRoles.length > 0 && (
              <div className="user-role">Roles: {state.user.userRoles.join(', ')}</div>
            )}
          </div>
        )}
      </button>
    </div>
  );
};

export default LoginButton;