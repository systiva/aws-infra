import React from 'react';
import { useAuth } from '../contexts/AuthContext';
import { LoginPage } from './LoginPage';

interface ProtectedRouteProps {
  children: React.ReactNode;
  requiredRole?: string;
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ 
  children, 
  requiredRole 
}) => {
  const { state } = useAuth();

  // If not authenticated, show login page
  if (!state.isAuthenticated) {
    return <LoginPage />;
  }

  // If role is required but user doesn't have it
  if (requiredRole && (!state.user?.userRoles || !state.user.userRoles.includes(requiredRole))) {
    return (
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        height: '400px',
        textAlign: 'center',
        padding: '20px'
      }}>
        <h2>Access Denied</h2>
        <p>You don't have permission to access this content.</p>
        <p>Required role: <strong>{requiredRole}</strong></p>
        <p>Your roles: <strong>{state.user?.userRoles?.join(', ') || 'None'}</strong></p>
      </div>
    );
  }

  // User is authenticated and has required role (if any)
  return <>{children}</>;
};