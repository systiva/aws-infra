import React, { createContext, useContext, useReducer, useEffect, useState, ReactNode } from 'react';
import { Group } from '../utils/rbac';
import { apiClient } from '../api/ApiClient';

// Types
export interface User {
  username: string;
  email: string;
  userRoles: string[]; // All user roles
  tenantId: string;
  permissions: string[];
  groups: Group[];
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  idToken: string;
}

export interface AuthState {
  isAuthenticated: boolean;
  user: User | null;
  tokens: AuthTokens | null;
  loading: boolean;
  error: string | null;
  challengeName?: string;
  session?: string;
  username?: string;
}

// Actions
type AuthAction =
  | { type: 'AUTH_START' }
  | { type: 'AUTH_SUCCESS'; payload: { user: User; tokens: AuthTokens } }
  | { type: 'AUTH_FAILURE'; payload: string }
  | { type: 'AUTH_CHALLENGE'; payload: { challengeName: string; session: string; username: string } }
  | { type: 'AUTH_LOGOUT' }
  | { type: 'CLEAR_ERROR' };

// Initial state
const initialState: AuthState = {
  isAuthenticated: false,
  user: null,
  tokens: null,
  loading: false,
  error: null,
  challengeName: undefined,
  session: undefined,
  username: undefined,
};

// Reducer
const authReducer = (state: AuthState, action: AuthAction): AuthState => {
  switch (action.type) {
    case 'AUTH_START':
      return {
        ...state,
        loading: true,
        error: null,
      };
    case 'AUTH_SUCCESS':
      return {
        ...state,
        isAuthenticated: true,
        user: action.payload.user,
        tokens: action.payload.tokens,
        loading: false,
        error: null,
        challengeName: undefined,
        session: undefined,
        username: undefined,
      };
    case 'AUTH_CHALLENGE':
      return {
        ...state,
        isAuthenticated: false,
        user: null,
        tokens: null,
        loading: false,
        error: null,
        challengeName: action.payload.challengeName,
        session: action.payload.session,
        username: action.payload.username,
      };
    case 'AUTH_FAILURE':
      return {
        ...state,
        isAuthenticated: false,
        user: null,
        tokens: null,
        loading: false,
        error: action.payload,
        challengeName: undefined,
        session: undefined,
        username: undefined,
      };
    case 'AUTH_LOGOUT':
      return {
        ...state,
        isAuthenticated: false,
        user: null,
        tokens: null,
        loading: false,
        error: null,
        challengeName: undefined,
        session: undefined,
        username: undefined,
      };
    case 'CLEAR_ERROR':
      return {
        ...state,
        error: null,
      };
    default:
      return state;
  }
};

// Context
interface AuthContextType {
  state: AuthState;
  showAuthOverlay: boolean;
  setShowAuthOverlay: (show: boolean) => void;
  login: (username: string, password: string) => Promise<{ challengeRequired?: boolean }>;
  signup: (userData: SignupData) => Promise<void>;
  logout: () => void;
  forgotPassword: (username: string) => Promise<void>;
  changePassword: (currentPassword: string, newPassword: string) => Promise<void>;
  respondToChallenge: (newPassword: string) => Promise<void>;
  clearError: () => void;
}

export interface SignupData {
  username: string;
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  tenantId?: string;
  userRole?: string;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Custom hook
export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

// Provider component
interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [state, dispatch] = useReducer(authReducer, initialState);
  const [showAuthOverlay, setShowAuthOverlay] = useState(false);

  // Storage keys
  const TOKEN_STORAGE_KEY = 'admin_portal_tokens';
  const USER_STORAGE_KEY = 'admin_portal_user';

  // Load stored authentication state on app start
  useEffect(() => {
    const storedTokens = localStorage.getItem(TOKEN_STORAGE_KEY);
    const storedUser = localStorage.getItem(USER_STORAGE_KEY);
    
    if (storedTokens && storedUser) {
      try {
        const tokens = JSON.parse(storedTokens);
        const user = JSON.parse(storedUser);
        
        // Check if tokens are expired (basic check)
        if (tokens.accessToken && !isTokenExpired(tokens.accessToken)) {
          dispatch({
            type: 'AUTH_SUCCESS',
            payload: { user, tokens }
          });
        } else {
          // Clear expired tokens
          localStorage.removeItem(TOKEN_STORAGE_KEY);
          localStorage.removeItem(USER_STORAGE_KEY);
        }
      } catch (error) {
        console.error('Failed to restore authentication state:', error);
        localStorage.removeItem(TOKEN_STORAGE_KEY);
        localStorage.removeItem(USER_STORAGE_KEY);
      }
    }

    // Listen for JWT expiration events from API calls
    const handleJwtExpired = (event: CustomEvent) => {
      console.warn('JWT expired during API call:', event.detail.message);
      // Clear tokens and show auth overlay with specific message
      localStorage.removeItem(TOKEN_STORAGE_KEY);
      localStorage.removeItem(USER_STORAGE_KEY);
      dispatch({ 
        type: 'AUTH_FAILURE', 
        payload: `Session expired: ${event.detail.message}. Please login again.` 
      });
      setShowAuthOverlay(true);
    };

    const handleAuthError = (event: CustomEvent) => {
      console.warn('Authentication error during API call:', event.detail.message);
      // Show auth overlay with specific error message
      dispatch({ 
        type: 'AUTH_FAILURE', 
        payload: `Authentication failed: ${event.detail.message}` 
      });
      setShowAuthOverlay(true);
    };

    // Add event listeners
    window.addEventListener('jwtExpired', handleJwtExpired as EventListener);
    window.addEventListener('authError', handleAuthError as EventListener);

    // Cleanup
    return () => {
      window.removeEventListener('jwtExpired', handleJwtExpired as EventListener);
      window.removeEventListener('authError', handleAuthError as EventListener);
    };
  }, []);

  // Inject token provider into API client whenever tokens change
  useEffect(() => {
    apiClient.setTokenProvider(() => state.tokens?.accessToken || null);
  }, [state.tokens]);

  // Login function
  const login = async (username: string, password: string): Promise<{ challengeRequired?: boolean }> => {
    dispatch({ type: 'AUTH_START' });
    
    try {
      const response = await fetch(`${process.env.REACT_APP_IMS_BASE_URL}/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ username, password }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Login failed');
      }

      const data = await response.json();
      
      // Handle challenge response
      if (data.challengeName) {
        dispatch({
          type: 'AUTH_CHALLENGE',
          payload: {
            challengeName: data.challengeName,
            session: data.session,
            username: username
          }
        });
        return { challengeRequired: true };
      }
      
      // Handle successful login
      const backendTokens = data.tokens;
      const tokens: AuthTokens = {
        accessToken: backendTokens.AccessToken,
        refreshToken: backendTokens.RefreshToken,
        idToken: backendTokens.IdToken
      };
      const user: User = data.user;

      // Store in localStorage
      localStorage.setItem(TOKEN_STORAGE_KEY, JSON.stringify(tokens));
      localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(user));

      dispatch({
        type: 'AUTH_SUCCESS',
        payload: { user, tokens }
      });
      
      return { challengeRequired: false };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Login failed';
      dispatch({ type: 'AUTH_FAILURE', payload: errorMessage });
      throw error;
    }
  };

  // Challenge response function
  const respondToChallenge = async (newPassword: string): Promise<void> => {
    if (!state.challengeName || !state.session || !state.username) {
      throw new Error('No active challenge to respond to');
    }

    dispatch({ type: 'AUTH_START' });
    
    try {
      const response = await fetch(`${process.env.REACT_APP_IMS_BASE_URL}/auth/challenge`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          username: state.username,
          newPassword,
          session: state.session,
          challengeName: state.challengeName
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Challenge response failed');
      }

      const data = await response.json();
      const backendTokens = data.tokens;
      const tokens: AuthTokens = {
        accessToken: backendTokens.AccessToken,
        refreshToken: backendTokens.RefreshToken,
        idToken: backendTokens.IdToken
      };
      const user: User = data.user;

      // Store in localStorage
      localStorage.setItem(TOKEN_STORAGE_KEY, JSON.stringify(tokens));
      localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(user));

      dispatch({
        type: 'AUTH_SUCCESS',
        payload: { user, tokens }
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Challenge response failed';
      dispatch({ type: 'AUTH_FAILURE', payload: errorMessage });
      throw error;
    }
  };

  // Signup function
  const signup = async (userData: SignupData): Promise<void> => {
    dispatch({ type: 'AUTH_START' });
    
    try {
      const response = await fetch(`${process.env.REACT_APP_IMS_BASE_URL}/auth/signup`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(userData),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Signup failed');
      }

      const data = await response.json();
      
      // If signup is successful but requires confirmation, don't auto-login
      if (data.requiresConfirmation) {
        dispatch({ type: 'AUTH_FAILURE', payload: 'Please check your email to confirm your account' });
        return;
      }

      // If auto-login after signup
      if (data.tokens && data.user) {
        const backendTokens = data.tokens;
        const tokens: AuthTokens = {
          accessToken: backendTokens.AccessToken,
          refreshToken: backendTokens.RefreshToken,
          idToken: backendTokens.IdToken
        };
        const user: User = data.user;

        localStorage.setItem(TOKEN_STORAGE_KEY, JSON.stringify(tokens));
        localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(user));

        dispatch({
          type: 'AUTH_SUCCESS',
          payload: { user, tokens }
        });
      } else {
        dispatch({ type: 'AUTH_FAILURE', payload: 'Account created successfully. Please login.' });
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Signup failed';
      dispatch({ type: 'AUTH_FAILURE', payload: errorMessage });
      throw error;
    }
  };

  // Logout function
  const logout = (): void => {
    localStorage.removeItem(TOKEN_STORAGE_KEY);
    localStorage.removeItem(USER_STORAGE_KEY);
    dispatch({ type: 'AUTH_LOGOUT' });
  };

  // Forgot password function
  const forgotPassword = async (username: string): Promise<void> => {
    dispatch({ type: 'AUTH_START' });
    
    try {
      const response = await fetch(`${process.env.REACT_APP_IMS_BASE_URL}/auth/forgot-password`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ username }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Password reset failed');
      }

      dispatch({ type: 'CLEAR_ERROR' });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Password reset failed';
      dispatch({ type: 'AUTH_FAILURE', payload: errorMessage });
      throw error;
    }
  };

  // Change password function
  const changePassword = async (currentPassword: string, newPassword: string): Promise<void> => {
    if (!state.user || !state.tokens) {
      throw new Error('User not authenticated');
    }

    dispatch({ type: 'AUTH_START' });
    
    try {
      const response = await fetch(`${process.env.REACT_APP_IMS_BASE_URL}/auth/change-password`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${state.tokens.accessToken}`,
        },
        body: JSON.stringify({
          username: state.user.username,
          currentPassword,
          newPassword,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Password change failed');
      }

      dispatch({ type: 'CLEAR_ERROR' });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Password change failed';
      dispatch({ type: 'AUTH_FAILURE', payload: errorMessage });
      throw error;
    }
  };

  // Clear error function
  const clearError = (): void => {
    dispatch({ type: 'CLEAR_ERROR' });
  };

  // Helper function to check token expiration
  const isTokenExpired = (token: string): boolean => {
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      const currentTime = Date.now() / 1000;
      return payload.exp < currentTime;
    } catch {
      return true;
    }
  };

  const value: AuthContextType = {
    state,
    showAuthOverlay,
    setShowAuthOverlay,
    login,
    signup,
    logout,
    forgotPassword,
    changePassword,
    respondToChallenge,
    clearError,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};