import React from 'react';
import { useAuth } from '../contexts/AuthContext';
import AuthOverlay from './AuthOverlay';
import './LoginPage.css';

export const LoginPage: React.FC = () => {
  const { setShowAuthOverlay } = useAuth();

  // Auto-show the auth overlay when login page loads
  React.useEffect(() => {
    setShowAuthOverlay(true);
  }, [setShowAuthOverlay]);

  return (
    <div className="login-page">
      <div className="login-container">
        <div className="login-header">
          <h1>Account Portal</h1>
          <p>Secure Multi-Account Management Platform</p>
        </div>
        
        <div className="login-content">
          <div className="welcome-section">
            <h2>Welcome</h2>
            <p>Please sign in to access your account management dashboard.</p>
            
            <div className="features-list">
              <div className="feature-item">
                <span className="feature-icon">🏢</span>
                <span>Manage Multiple Accounts</span>
              </div>
              <div className="feature-item">
                <span className="feature-icon">👥</span>
                <span>User & Role Management</span>
              </div>
              <div className="feature-item">
                <span className="feature-icon">🔒</span>
                <span>Secure Access Control</span>
              </div>
              <div className="feature-item">
                <span className="feature-icon">📊</span>
                <span>Analytics & Monitoring</span>
              </div>
            </div>
          </div>
          
          <div className="login-prompt">
            <button 
              className="signin-cta-button"
              onClick={() => setShowAuthOverlay(true)}
            >
              Sign In to Continue
            </button>
            
            <p className="signup-prompt">
              Don't have an account? 
              <button 
                className="signup-link"
                onClick={() => setShowAuthOverlay(true)}
              >
                Sign up here
              </button>
            </p>
          </div>
        </div>
      </div>
      
      <AuthOverlay />
    </div>
  );
};