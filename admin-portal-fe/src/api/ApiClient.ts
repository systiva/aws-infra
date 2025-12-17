/**
 * Global API Client with automatic authentication
 * Automatically injects Authorization header from AuthContext
 */

class ApiClient {
  private baseURL: string;
  private getToken: (() => string | null) | null = null;

  constructor(baseURL: string) {
    this.baseURL = baseURL;
  }

  /**
   * Allow AuthContext to inject token getter function
   * This enables automatic token injection for all requests
   */
  setTokenProvider(getToken: () => string | null) {
    this.getToken = getToken;
  }

  /**
   * Make authenticated API request
   * Automatically adds Authorization header if token is available
   */
  async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${this.baseURL}${endpoint}`;
    
    // Build headers with automatic token injection
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(options.headers as Record<string, string> || {}),
    };

    // Auto-inject Authorization header if token available
    if (this.getToken) {
      const token = this.getToken();
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }
    }

    const response = await fetch(url, {
      ...options,
      headers,
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`HTTP ${response.status}: ${errorText}`);
    }

    return response.json();
  }
}

// Export singleton instance
export const apiClient = new ApiClient(
  process.env.REACT_APP_API_BASE_URL || 'http://localhost:8080/api/v1'
);
