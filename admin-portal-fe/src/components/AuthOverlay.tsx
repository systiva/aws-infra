import React, { useState } from 'react';
import { useAuth, SignupData } from '../contexts/AuthContext';
import './AuthOverlay.css';

interface AuthOverlayProps {}

type AuthMode = 'signin' | 'signup' | 'forgot-password' | 'change-password' | 'new-password-required';

const AuthOverlay: React.FC<AuthOverlayProps> = () => {
  const { 
    showAuthOverlay, 
    setShowAuthOverlay, 
    state: authState, 
    login: authLogin, 
    signup: authSignup, 
    forgotPassword: authForgotPassword, 
    changePassword: authChangePassword,
    respondToChallenge: authRespondToChallenge,
    clearError 
  } = useAuth();

  const [mode, setMode] = useState<AuthMode>('signin');
  const [formData, setFormData] = useState({
    username: '',
    email: '',
    password: '',
    confirmPassword: '',
    currentPassword: '',
    newPassword: '',
    firstName: '',
    lastName: '',
    accountId: '',
  });
  const [localError, setLocalError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  // Auto-switch to challenge mode when NEW_PASSWORD_REQUIRED challenge is detected
  React.useEffect(() => {
    if (authState.challengeName === 'NEW_PASSWORD_REQUIRED') {
      setMode('new-password-required');
      setFormData(prev => ({
        ...prev,
        username: authState.username || ''
      }));
    }
  }, [authState.challengeName, authState.username]);

  // Auto-close overlay when user becomes authenticated
  React.useEffect(() => {
    if (authState.isAuthenticated && showAuthOverlay) {
      // Small delay to show success message
      setTimeout(() => {
        closeOverlay();
      }, 500);
    }
  }, [authState.isAuthenticated, showAuthOverlay]);

  const closeOverlay = () => {
    setShowAuthOverlay(false);
    setMode('signin');
    setFormData({
      username: '',
      email: '',
      password: '',
      confirmPassword: '',
      currentPassword: '',
      newPassword: '',
      firstName: '',
      lastName: '',
      accountId: '',
    });
    setLocalError('');
    setSuccessMessage('');
    clearError();
  };

  // Reset form when mode changes
  const handleModeChange = (newMode: AuthMode) => {
    setMode(newMode);
    setFormData({
      username: '',
      email: '',
      password: '',
      confirmPassword: '',
      currentPassword: '',
      newPassword: '',
      firstName: '',
      lastName: '',
      accountId: '',
    });
    setLocalError('');
    setSuccessMessage('');
    clearError();
  };

  // Handle input changes
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
    setLocalError('');
    setSuccessMessage('');
  };

  // Validate form
  const validateForm = (): boolean => {
    setLocalError('');

    switch (mode) {
      case 'signin':
        if (!formData.username || !formData.password) {
          setLocalError('Username and password are required');
          return false;
        }
        break;
      
      case 'signup':
        if (!formData.username || !formData.email || !formData.password || 
            !formData.firstName || !formData.lastName || !formData.accountId) {
          setLocalError('All fields are required');
          return false;
        }
        if (formData.password !== formData.confirmPassword) {
          setLocalError('Passwords do not match');
          return false;
        }
        if (formData.password.length < 8) {
          setLocalError('Password must be at least 8 characters long');
          return false;
        }
        break;
      
      case 'forgot-password':
        if (!formData.username) {
          setLocalError('Username is required');
          return false;
        }
        break;
      
      case 'change-password':
        if (!formData.currentPassword || !formData.newPassword || !formData.confirmPassword) {
          setLocalError('All password fields are required');
          return false;
        }
        if (formData.newPassword !== formData.confirmPassword) {
          setLocalError('New passwords do not match');
          return false;
        }
        if (formData.newPassword.length < 8) {
          setLocalError('New password must be at least 8 characters long');
          return false;
        }
        break;
      
      case 'new-password-required':
        if (!formData.newPassword || !formData.confirmPassword) {
          setLocalError('New password and confirmation are required');
          return false;
        }
        if (formData.newPassword !== formData.confirmPassword) {
          setLocalError('Passwords do not match');
          return false;
        }
        if (formData.newPassword.length < 8) {
          setLocalError('Password must be at least 8 characters long');
          return false;
        }
        break;
    }

    return true;
  };

  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }

    try {
      switch (mode) {
        case 'signin':
          const loginResult = await authLogin(formData.username, formData.password);
          // Only show success message if no challenge is required
          if (!loginResult.challengeRequired) {
            setSuccessMessage('Login successful!');
            // Overlay will be closed automatically by useEffect when authenticated
          }
          // If challenge is required, the useEffect will handle mode switching
          break;
        
        case 'signup':
          const signupData: SignupData = {
            username: formData.username,
            email: formData.email,
            password: formData.password,
            firstName: formData.firstName,
            lastName: formData.lastName,
            accountId: formData.accountId,
            userRole: 'viewer', // Default role
          };
          await authSignup(signupData);
          setSuccessMessage('Account created successfully! Please check your email.');
          setTimeout(() => {
            handleModeChange('signin');
          }, 2000);
          break;
        
        case 'forgot-password':
          await authForgotPassword(formData.username);
          setSuccessMessage('Password reset link sent to your email!');
          setTimeout(() => {
            handleModeChange('signin');
          }, 2000);
          break;
        
        case 'change-password':
          await authChangePassword(formData.currentPassword, formData.newPassword);
          setSuccessMessage('Password changed successfully!');
          setTimeout(() => closeOverlay(), 1000);
          break;
        
        case 'new-password-required':
          await authRespondToChallenge(formData.newPassword);
          setSuccessMessage('Password updated successfully!');
          // Overlay will be closed automatically by useEffect when authenticated
          break;
      }
    } catch (error: any) {
      setLocalError(error.message || 'An error occurred');
    }
  };

  // Handle overlay click (close when clicking outside)
  const handleOverlayClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      closeOverlay();
    }
  };

  if (!showAuthOverlay) return null;

  const displayError = localError || authState.error;
  const isJwtError = displayError && (
    displayError.includes('JWT token has expired') ||
    displayError.includes('jwt expired') ||
    displayError.includes('Session expired') ||
    displayError.includes('TokenExpiredError')
  );

  return (
    <div className="auth-overlay" onClick={handleOverlayClick}>
      <div className="auth-modal">
        <button className="auth-modal-close" onClick={closeOverlay}>
          ×
        </button>
        
        <div className="auth-modal-header">
          <h2>
            {mode === 'signin' && 'Sign In'}
            {mode === 'signup' && 'Sign Up'}
            {mode === 'forgot-password' && 'Forgot Password'}
            {mode === 'change-password' && 'Change Password'}
            {mode === 'new-password-required' && 'Set New Password'}
          </h2>
        </div>

        <form className="auth-form" onSubmit={handleSubmit}>
          {/* Sign In Form */}
          {mode === 'signin' && (
            <>
              <div className="form-group">
                <label htmlFor="username">Username</label>
                <input
                  type="text"
                  id="username"
                  name="username"
                  value={formData.username}
                  onChange={handleInputChange}
                  placeholder="Enter your username"
                  required
                />
              </div>
              
              <div className="form-group">
                <label htmlFor="password">Password</label>
                <input
                  type="password"
                  id="password"
                  name="password"
                  value={formData.password}
                  onChange={handleInputChange}
                  placeholder="Enter your password"
                  required
                />
              </div>
            </>
          )}

          {/* Sign Up Form */}
          {mode === 'signup' && (
            <>
              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="firstName">First Name</label>
                  <input
                    type="text"
                    id="firstName"
                    name="firstName"
                    value={formData.firstName}
                    onChange={handleInputChange}
                    placeholder="First name"
                    required
                  />
                </div>
                <div className="form-group">
                  <label htmlFor="lastName">Last Name</label>
                  <input
                    type="text"
                    id="lastName"
                    name="lastName"
                    value={formData.lastName}
                    onChange={handleInputChange}
                    placeholder="Last name"
                    required
                  />
                </div>
              </div>

              <div className="form-group">
                <label htmlFor="email">Email</label>
                <input
                  type="email"
                  id="email"
                  name="email"
                  value={formData.email}
                  onChange={handleInputChange}
                  placeholder="Enter your email"
                  required
                />
              </div>

              <div className="form-group">
                <label htmlFor="username">Username</label>
                <input
                  type="text"
                  id="username"
                  name="username"
                  value={formData.username}
                  onChange={handleInputChange}
                  placeholder="Choose a username"
                  required
                />
              </div>

              <div className="form-group">
                <label htmlFor="accountId">Account ID</label>
                <input
                  type="text"
                  id="accountId"
                  name="accountId"
                  value={formData.accountId}
                  onChange={handleInputChange}
                  placeholder="Enter account ID"
                  required
                />
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="password">Password</label>
                  <input
                    type="password"
                    id="password"
                    name="password"
                    value={formData.password}
                    onChange={handleInputChange}
                    placeholder="Create password"
                    required
                  />
                </div>
                <div className="form-group">
                  <label htmlFor="confirmPassword">Confirm Password</label>
                  <input
                    type="password"
                    id="confirmPassword"
                    name="confirmPassword"
                    value={formData.confirmPassword}
                    onChange={handleInputChange}
                    placeholder="Confirm password"
                    required
                  />
                </div>
              </div>
            </>
          )}

          {/* Forgot Password Form */}
          {mode === 'forgot-password' && (
            <div className="form-group">
              <label htmlFor="username">Username</label>
              <input
                type="text"
                id="username"
                name="username"
                value={formData.username}
                onChange={handleInputChange}
                placeholder="Enter your username"
                required
              />
              <small className="form-help">
                We'll send a password reset link to your registered email.
              </small>
            </div>
          )}

          {/* Change Password Form */}
          {mode === 'change-password' && (
            <>
              <div className="form-group">
                <label htmlFor="currentPassword">Current Password</label>
                <input
                  type="password"
                  id="currentPassword"
                  name="currentPassword"
                  value={formData.currentPassword}
                  onChange={handleInputChange}
                  placeholder="Enter current password"
                  required
                />
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="newPassword">New Password</label>
                  <input
                    type="password"
                    id="newPassword"
                    name="newPassword"
                    value={formData.newPassword}
                    onChange={handleInputChange}
                    placeholder="Enter new password"
                    required
                  />
                </div>
                <div className="form-group">
                  <label htmlFor="confirmPassword">Confirm New Password</label>
                  <input
                    type="password"
                    id="confirmPassword"
                    name="confirmPassword"
                    value={formData.confirmPassword}
                    onChange={handleInputChange}
                    placeholder="Confirm new password"
                    required
                  />
                </div>
              </div>
            </>
          )}

          {/* New Password Required Form */}
          {mode === 'new-password-required' && (
            <>
              <div className="info-message">
                <p>You need to set a new password for your account.</p>
                <p><strong>Username:</strong> {authState.username}</p>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="newPassword">New Password</label>
                  <input
                    type="password"
                    id="newPassword"
                    name="newPassword"
                    value={formData.newPassword}
                    onChange={handleInputChange}
                    placeholder="Enter new password"
                    required
                  />
                </div>
                <div className="form-group">
                  <label htmlFor="confirmPassword">Confirm New Password</label>
                  <input
                    type="password"
                    id="confirmPassword"
                    name="confirmPassword"
                    value={formData.confirmPassword}
                    onChange={handleInputChange}
                    placeholder="Confirm new password"
                    required
                  />
                </div>
              </div>
            </>
          )}

          {/* Error and Success Messages */}
          {displayError && (
            <div className={`error-message ${isJwtError ? 'jwt-error' : ''}`}>
              {isJwtError && (
                <div className="jwt-error-icon">🔒</div>
              )}
              <div className="error-content">
                {isJwtError && <strong>Session Expired</strong>}
                <div>{displayError}</div>
              </div>
            </div>
          )}

          {successMessage && (
            <div className="success-message">
              {successMessage}
            </div>
          )}

          {/* Submit Button */}
          <button 
            type="submit" 
            className="auth-submit-btn"
            disabled={authState.loading}
          >
            {authState.loading ? 'Processing...' : (
              mode === 'signin' ? 'Sign In' :
              mode === 'signup' ? 'Create Account' :
              mode === 'forgot-password' ? 'Send Reset Link' :
              mode === 'change-password' ? 'Change Password' :
              mode === 'new-password-required' ? 'Set New Password' :
              'Submit'
            )}
          </button>
        </form>

        {/* Navigation Buttons */}
        <div className="auth-navigation">
          {mode === 'signin' && (
            <>
              <button 
                type="button" 
                className="auth-nav-btn"
                onClick={() => handleModeChange('signup')}
              >
                Don't have an account? Sign Up
              </button>
              <button 
                type="button" 
                className="auth-nav-btn"
                onClick={() => handleModeChange('forgot-password')}
              >
                Forgot Password?
              </button>
              {authState.isAuthenticated && (
                <button 
                  type="button" 
                  className="auth-nav-btn"
                  onClick={() => handleModeChange('change-password')}
                >
                  Change Password
                </button>
              )}
            </>
          )}

          {mode === 'signup' && (
            <button 
              type="button" 
              className="auth-nav-btn"
              onClick={() => handleModeChange('signin')}
            >
              Already have an account? Sign In
            </button>
          )}

          {(mode === 'forgot-password' || mode === 'change-password') && (
            <button 
              type="button" 
              className="auth-nav-btn"
              onClick={() => handleModeChange('signin')}
            >
              Back to Sign In
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default AuthOverlay;