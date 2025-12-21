const API_BASE_URL = process.env.REACT_APP_IMS_BASE_URL || 'http://localhost:3001/api/v1';

// User types
export interface User {
  id: string;
  username: string;
  email: string;
  firstName?: string;
  lastName?: string;
  accountId: string;
  userRole: string;
  status: 'CONFIRMED' | 'UNCONFIRMED' | 'FORCE_CHANGE_PASSWORD';
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateUserRequest {
  username: string;
  email: string;
  firstName?: string;
  lastName?: string;
  accountId: string;
  userRole: string;
  temporaryPassword?: string;
  groups?: string[];
}

export interface UpdateUserRequest {
  email?: string;
  firstName?: string;
  lastName?: string;
  userRole?: string;
}

interface UsersListResponse {
  users: User[];
  paginationToken?: string;
  count: number;
}

interface UserResponse {
  user: User;
}

class UserApiClient {
  private async makeRequest<T>(
    url: string,
    token: string,
    options: RequestInit = {}
  ): Promise<T> {
    const response = await fetch(url, {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
        ...options.headers,
      },
      ...options,
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`HTTP ${response.status}: ${errorText}`);
    }

    return response.json();
  }

  async getUsers(token: string, options: {
    limit?: number;
    paginationToken?: string;
    group?: string;
    role?: string;
  } = {}): Promise<User[]> {
    try {
      const params = new URLSearchParams();
      if (options.limit) params.append('limit', options.limit.toString());
      if (options.paginationToken) params.append('paginationToken', options.paginationToken);
      if (options.group) params.append('group', options.group);
      if (options.role) params.append('role', options.role);

      const url = `${API_BASE_URL}/users${params.toString() ? '?' + params.toString() : ''}`;
      
      const response = await this.makeRequest<UsersListResponse>(url, token);
      return response.users || [];
    } catch (error) {
      console.error('Failed to fetch users:', error);
      throw error;
    }
  }

  async getUserById(id: string, token: string): Promise<User> {
    try {
      const response = await this.makeRequest<UserResponse>(
        `${API_BASE_URL}/users/${id}`,
        token
      );
      return response.user;
    } catch (error) {
      console.error(`Failed to fetch user ${id}:`, error);
      throw error;
    }
  }

  async createUser(userData: CreateUserRequest, token: string): Promise<User> {
    try {
      const response = await this.makeRequest<UserResponse>(
        `${API_BASE_URL}/users`,
        token,
        {
          method: 'POST',
          body: JSON.stringify(userData),
        }
      );
      return response.user;
    } catch (error) {
      console.error('Failed to create user:', error);
      throw error;
    }
  }

  async updateUser(id: string, updateData: UpdateUserRequest, token: string): Promise<User> {
    try {
      const response = await this.makeRequest<UserResponse>(
        `${API_BASE_URL}/users/${id}`,
        token,
        {
          method: 'PUT',
          body: JSON.stringify(updateData),
        }
      );
      return response.user;
    } catch (error) {
      console.error(`Failed to update user ${id}:`, error);
      throw error;
    }
  }

  async deleteUser(id: string, token: string): Promise<void> {
    try {
      await this.makeRequest<void>(
        `${API_BASE_URL}/users/${id}`,
        token,
        {
          method: 'DELETE',
        }
      );
    } catch (error) {
      console.error(`Failed to delete user ${id}:`, error);
      throw error;
    }
  }

  async enableUser(id: string, enabled: boolean, token: string): Promise<User> {
    try {
      const response = await this.makeRequest<UserResponse>(
        `${API_BASE_URL}/users/${id}/enable`,
        token,
        {
          method: 'PUT',
          body: JSON.stringify({ enabled }),
        }
      );
      return response.user;
    } catch (error) {
      console.error(`Failed to ${enabled ? 'enable' : 'disable'} user ${id}:`, error);
      throw error;
    }
  }

  async resetPassword(id: string, password: string, permanent: boolean = false, token: string): Promise<User> {
    try {
      const response = await this.makeRequest<UserResponse>(
        `${API_BASE_URL}/users/${id}/reset-password`,
        token,
        {
          method: 'PUT',
          body: JSON.stringify({ password, permanent }),
        }
      );
      return response.user;
    } catch (error) {
      console.error(`Failed to reset password for user ${id}:`, error);
      throw error;
    }
  }
}

// Export singleton instance
export const userApiClient = new UserApiClient();
export default userApiClient;