import axios, { AxiosInstance, AxiosResponse } from 'axios';

// Types for API responses
export interface LoginResponse {
  success: boolean;
  message: string;
  tokens: {
    accessToken: string;
    refreshToken: string;
    idToken: string;
  };
  user: {
    username: string;
    email: string;
    userRole: string;
    accountId: string;
    permissions: string[];
  };
  challengeName?: string;
  session?: string;
}

export interface SignupResponse {
  success: boolean;
  message: string;
  requiresConfirmation?: boolean;
  tokens?: {
    accessToken: string;
    refreshToken: string;
    idToken: string;
  };
  user?: {
    username: string;
    email: string;
    userRole: string;
    accountId: string;
    permissions: string[];
  };
}

export interface ForgotPasswordResponse {
  success: boolean;
  message: string;
}

export interface ChangePasswordResponse {
  success: boolean;
  message: string;
}

export interface SignupRequest {
  username: string;
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  accountId: string;
  userRole?: string;
}

export interface LoginRequest {
  username: string;
  password: string;
}

export interface ForgotPasswordRequest {
  username: string;
}

export interface ChangePasswordRequest {
  username: string;
  currentPassword: string;
  newPassword: string;
}

class AuthApiService {
  private api: AxiosInstance;

  constructor() {
    this.api = axios.create({
      baseURL: process.env.REACT_APP_IMS_BASE_URL,
      timeout: 10000,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // Request interceptor
    this.api.interceptors.request.use(
      (config) => {
        // Add auth token if available
        const tokens = localStorage.getItem('admin_portal_tokens');
        if (tokens) {
          try {
            const parsedTokens = JSON.parse(tokens);
            if (parsedTokens.accessToken) {
              config.headers.Authorization = `Bearer ${parsedTokens.accessToken}`;
            }
          } catch (error) {
            console.error('Failed to parse stored tokens:', error);
          }
        }
        return config;
      },
      (error) => {
        return Promise.reject(error);
      }
    );

    // Response interceptor
    this.api.interceptors.response.use(
      (response) => {
        return response;
      },
      (error) => {
        if (error.response?.status === 401) {
          // Token expired or invalid, clear local storage
          localStorage.removeItem('admin_portal_tokens');
          localStorage.removeItem('admin_portal_user');
          // Optionally redirect to login
        }
        return Promise.reject(error);
      }
    );
  }

  /**
   * Login user with username and password
   */
  async login(credentials: LoginRequest): Promise<LoginResponse> {
    try {
      const response: AxiosResponse<LoginResponse> = await this.api.post(
        '/auth/login',
        credentials
      );
      return response.data;
    } catch (error: any) {
      if (error.response?.data) {
        throw new Error(error.response.data.message || 'Login failed');
      }
      throw new Error('Network error. Please try again.');
    }
  }

  /**
   * Register new user
   */
  async signup(userData: SignupRequest): Promise<SignupResponse> {
    try {
      const response: AxiosResponse<SignupResponse> = await this.api.post(
        '/auth/signup',
        userData
      );
      return response.data;
    } catch (error: any) {
      if (error.response?.data) {
        throw new Error(error.response.data.message || 'Signup failed');
      }
      throw new Error('Network error. Please try again.');
    }
  }

  /**
   * Initiate forgot password flow
   */
  async forgotPassword(request: ForgotPasswordRequest): Promise<ForgotPasswordResponse> {
    try {
      const response: AxiosResponse<ForgotPasswordResponse> = await this.api.post(
        '/auth/forgot-password',
        request
      );
      return response.data;
    } catch (error: any) {
      if (error.response?.data) {
        throw new Error(error.response.data.message || 'Password reset failed');
      }
      throw new Error('Network error. Please try again.');
    }
  }

  /**
   * Change user password
   */
  async changePassword(request: ChangePasswordRequest): Promise<ChangePasswordResponse> {
    try {
      const response: AxiosResponse<ChangePasswordResponse> = await this.api.post(
        '/auth/change-password',
        request
      );
      return response.data;
    } catch (error: any) {
      if (error.response?.data) {
        throw new Error(error.response.data.message || 'Password change failed');
      }
      throw new Error('Network error. Please try again.');
    }
  }

  /**
   * Refresh access token using refresh token
   */
  async refreshToken(refreshToken: string): Promise<LoginResponse> {
    try {
      const response: AxiosResponse<LoginResponse> = await this.api.post(
        '/auth/refresh',
        { refreshToken }
      );
      return response.data;
    } catch (error: any) {
      if (error.response?.data) {
        throw new Error(error.response.data.message || 'Token refresh failed');
      }
      throw new Error('Network error. Please try again.');
    }
  }

  /**
   * Logout user (invalidate tokens if server supports it)
   */
  async logout(): Promise<void> {
    try {
      await this.api.post('/auth/logout');
    } catch (error) {
      // Logout can fail, but we should still clear local tokens
      console.warn('Server logout failed, but clearing local tokens');
    }
  }

  /**
   * Get current user info (if needed)
   */
  async getCurrentUser(): Promise<any> {
    try {
      const response = await this.api.get('/auth/me');
      return response.data;
    } catch (error: any) {
      if (error.response?.data) {
        throw new Error(error.response.data.message || 'Failed to get user info');
      }
      throw new Error('Network error. Please try again.');
    }
  }
}

// Export singleton instance
export const authApiService = new AuthApiService();
export default authApiService;