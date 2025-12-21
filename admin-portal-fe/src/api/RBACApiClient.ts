interface RBACUser {
  // New AccountRBACService properties
  PK?: string;
  SK?: string;
  entity_type?: string;
  account_id?: string;
  entity_id?: string;
  user_id?: string;
  name?: string;
  email: string;
  status?: string;
  metadata?: any;
  created_at?: string;
  updated_at?: string;
  created_by?: string;
  groups?: any[];
  
  // Legacy IMS service properties (for backward compatibility)
  entityType?: string;
  cognitoUsername?: string;
  userRole?: string;
  lastName?: string;
  createdAt?: string;
  firstName?: string;
  enabled?: boolean;
  cognitoUserId?: string;
  updatedAt?: string;
  username?: string;
}

interface RBACGroup {
  PK: string;
  SK: string;
  entity_type: string;
  account_id: string;
  entity_id: string;
  groupId: string;  // Changed from group_id to match backend
  name: string;
  description: string;
  metadata?: any;
  created_at: string;
  updated_at: string;
  created_by: string;
}

interface RBACRole {
  PK: string;
  SK: string;
  entity_type: string;
  account_id: string;
  entity_id: string;
  roleId: string;  // Changed from role_id to match backend
  name: string;
  description: string;
  permissions: string[];
  metadata?: any;
  created_at: string;
  updated_at: string;
  created_by: string;
}

interface RBACPermission {
  PK: string;
  SK: string;
  entity_type: string;
  account_id: string;
  entity_id: string;
  permissionId: string;  // Changed from permission_id to match backend
  name: string;
  description: string;
  resource: string;
  action: string;
  metadata?: any;
  created_at: string;
  updated_at: string;
  created_by: string;
}

interface CreateUserRequest {
  firstName: string;
  lastName: string;
  userId: string;
  email: string;
  password: string;
  status?: string;
  metadata?: any;
  groupIds?: string[];
}

interface CreateGroupRequest {
  name: string;
  description?: string;
  metadata?: any;
  groupId?: string;
  roleIds?: string[];
}

interface CreateRoleRequest {
  name: string;
  description?: string;
  permissions?: string[];
  metadata?: any;
  roleId?: string;
}

interface CreatePermissionRequest {
  name: string;
  description?: string;
  metadata?: any;
  permissionId?: string;
}

interface APIResponse<T> {
  success: boolean;
  data: T;
  error?: string;
  details?: string;
}

class RBACApiClient {
  private rbacBaseUrl: string;
  private usersBaseUrl: string;
  private accountId: string | null = null;

  constructor(baseUrl: string = process.env.REACT_APP_IMS_BASE_URL || 'http://localhost:3001/api/v1') {
    this.rbacBaseUrl = `${baseUrl}/rbac`;
    this.usersBaseUrl = `${baseUrl}/users`;
  }

  setAccountId(accountId: string) {
    this.accountId = accountId;
  }

  private async makeRequest<T>(
    endpoint: string,
    method: 'GET' | 'POST' | 'PUT' | 'DELETE' = 'GET',
    token: string,
    body?: any,
    useUsersEndpoint: boolean = false
  ): Promise<T> {
    const baseUrl = useUsersEndpoint ? this.usersBaseUrl : this.rbacBaseUrl;
    const url = `${baseUrl}${endpoint}`;
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    };

    const config: RequestInit = {
      method,
      headers,
    };

    if (body && (method === 'POST' || method === 'PUT')) {
      config.body = JSON.stringify(body);
    }

    // Add account ID as query parameter if not in body
    const urlWithAccount = this.accountId ? 
      `${url}${url.includes('?') ? '&' : '?'}accountId=${this.accountId}` : 
      url;

    try {
      const response = await fetch(urlWithAccount, config);
      
      if (!response.ok) {
        try {
          const errorData = await response.json();
          // Extract detailed error message, prioritizing specific error details
          let errorMessage = `HTTP ${response.status}`;
          
          if (errorData.message && errorData.details) {
            errorMessage = `${errorData.message}: ${errorData.details}`;
          } else if (errorData.message) {
            errorMessage = errorData.message;
          } else if (errorData.details) {
            errorMessage = errorData.details;
          } else if (errorData.error) {
            errorMessage = errorData.error;
          }
          
          throw new Error(errorMessage);
        } catch (parseError) {
          // If response is not JSON, use status text
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
      }

      return await response.json();
    } catch (error) {
      console.error(`API Error [${method} ${url}]:`, error);
      
      // Handle JWT expiration and authentication errors
      if (error instanceof Error) {
        // Check if this is a JWT expiration error
        if (error.message.includes('JWT token has expired') || 
            error.message.includes('jwt expired') ||
            error.message.includes('TokenExpiredError')) {
          // Dispatch custom event for JWT expiration
          window.dispatchEvent(new CustomEvent('jwtExpired', {
            detail: { message: error.message }
          }));
        } else if (error.message.includes('Unauthorized') ||
                   error.message.includes('Authentication failed') ||
                   error.message.includes('Invalid JWT')) {
          // Dispatch custom event for authentication failure
          window.dispatchEvent(new CustomEvent('authError', {
            detail: { message: error.message }
          }));
        }
      }
      
      throw error;
    }
  }

  // ===== USER METHODS =====

  async getUsers(token: string): Promise<RBACUser[]> {
    const response = await this.makeRequest<APIResponse<RBACUser[]>>('/', 'GET', token, undefined, true);
    return response.data;
  }

  async getUser(userId: string, token: string): Promise<RBACUser> {
    const response = await this.makeRequest<APIResponse<RBACUser>>(`/${userId}`, 'GET', token, undefined, true);
    return response.data;
  }

  async createUser(userData: CreateUserRequest, token: string): Promise<RBACUser> {
    // Convert frontend format to backend format
    const backendPayload = {
      name: `${userData.firstName} ${userData.lastName}`.trim(),
      email: userData.email,
      userId: userData.userId,
      password: userData.password,
      status: userData.status || 'ACTIVE',
      created_by: 'admin' // Could be extracted from token if needed
    };
    
    const response = await this.makeRequest<APIResponse<RBACUser>>('/', 'POST', token, backendPayload, true);
    return response.data;
  }

  async updateUser(userId: string, userData: Partial<CreateUserRequest>, token: string): Promise<RBACUser> {
    // Convert frontend format to backend format
    const backendPayload: any = {};
    
    if (userData.firstName || userData.lastName) {
      backendPayload.name = `${userData.firstName || ''} ${userData.lastName || ''}`.trim();
    }
    if (userData.email) backendPayload.email = userData.email;
    if (userData.status) backendPayload.status = userData.status;
    
    backendPayload.updated_by = 'admin'; // Could be extracted from token if needed
    
    const response = await this.makeRequest<APIResponse<RBACUser>>(`/${userId}`, 'PUT', token, backendPayload, true);
    return response.data;
  }

  async deleteUser(userId: string, token: string): Promise<void> {
    await this.makeRequest<APIResponse<{ message: string }>>(`/${userId}`, 'DELETE', token, undefined, true);
  }

  // ===== GROUP METHODS =====

  async getGroups(token: string): Promise<RBACGroup[]> {
    const response = await this.makeRequest<APIResponse<RBACGroup[]>>('/groups', 'GET', token);
    return response.data;
  }

  async getGroup(groupId: string, token: string): Promise<RBACGroup> {
    const response = await this.makeRequest<APIResponse<RBACGroup>>(`/groups/${groupId}`, 'GET', token);
    return response.data;
  }

  async createGroup(groupData: CreateGroupRequest, token: string): Promise<RBACGroup> {
    const response = await this.makeRequest<APIResponse<RBACGroup>>('/groups', 'POST', token, groupData);
    return response.data;
  }

  async updateGroup(groupId: string, groupData: Partial<CreateGroupRequest>, token: string): Promise<RBACGroup> {
    const response = await this.makeRequest<APIResponse<RBACGroup>>(`/groups/${groupId}`, 'PUT', token, groupData);
    return response.data;
  }

  async deleteGroup(groupId: string, token: string): Promise<void> {
    await this.makeRequest<APIResponse<{ message: string }>>(`/groups/${groupId}`, 'DELETE', token);
  }

  // ===== ROLE METHODS =====

  async getRoles(token: string): Promise<RBACRole[]> {
    const response = await this.makeRequest<APIResponse<RBACRole[]>>('/roles', 'GET', token);
    return response.data;
  }

  async getRole(roleId: string, token: string): Promise<RBACRole> {
    const response = await this.makeRequest<APIResponse<RBACRole>>(`/roles/${roleId}`, 'GET', token);
    return response.data;
  }

  async createRole(roleData: CreateRoleRequest, token: string): Promise<RBACRole> {
    const response = await this.makeRequest<APIResponse<RBACRole>>('/roles', 'POST', token, roleData);
    return response.data;
  }

  async updateRole(roleId: string, roleData: Partial<CreateRoleRequest>, token: string): Promise<RBACRole> {
    const response = await this.makeRequest<APIResponse<RBACRole>>(`/roles/${roleId}`, 'PUT', token, roleData);
    return response.data;
  }

  async deleteRole(roleId: string, token: string): Promise<void> {
    await this.makeRequest<APIResponse<{ message: string }>>(`/roles/${roleId}`, 'DELETE', token);
  }

  // ===== PERMISSION METHODS =====

  async getPermissions(token: string): Promise<RBACPermission[]> {
    const response = await this.makeRequest<APIResponse<RBACPermission[]>>('/permissions', 'GET', token);
    return response.data;
  }

  async getPermission(permissionId: string, token: string): Promise<RBACPermission> {
    const response = await this.makeRequest<APIResponse<RBACPermission>>(`/permissions/${permissionId}`, 'GET', token);
    return response.data;
  }

  async createPermission(permissionData: CreatePermissionRequest, token: string): Promise<RBACPermission> {
    const response = await this.makeRequest<APIResponse<RBACPermission>>('/permissions', 'POST', token, permissionData);
    return response.data;
  }

  async updatePermission(permissionId: string, permissionData: Partial<CreatePermissionRequest>, token: string): Promise<RBACPermission> {
    const response = await this.makeRequest<APIResponse<RBACPermission>>(`/permissions/${permissionId}`, 'PUT', token, permissionData);
    return response.data;
  }

  async deletePermission(permissionId: string, token: string): Promise<void> {
    await this.makeRequest<APIResponse<{ message: string }>>(`/permissions/${permissionId}`, 'DELETE', token);
  }

  // ===== ASSIGNMENT METHODS =====

  async addUserToGroup(userId: string, groupId: string, token: string): Promise<void> {
    await this.makeRequest<APIResponse<{ message: string }>>(`/users/${userId}/groups`, 'POST', token, { groupId });
  }

  async removeUserFromGroup(userId: string, groupId: string, token: string): Promise<void> {
    await this.makeRequest<APIResponse<{ message: string }>>(`/users/${userId}/groups/${groupId}`, 'DELETE', token);
  }

  async assignRoleToGroup(groupId: string, roleId: string, token: string): Promise<void> {
    await this.makeRequest<APIResponse<{ message: string }>>(`/groups/${groupId}/roles`, 'POST', token, { roleId });
  }

  async removeRoleFromGroup(groupId: string, roleId: string, token: string): Promise<void> {
    await this.makeRequest<APIResponse<{ message: string }>>(`/groups/${groupId}/roles/${roleId}`, 'DELETE', token);
  }

  // ===== QUERY METHODS =====

  async getUserGroups(userId: string, token: string): Promise<any[]> {
    const response = await this.makeRequest<APIResponse<any[]>>(`/users/${userId}/groups`, 'GET', token);
    return response.data;
  }

  async getGroupMembers(groupId: string, token: string): Promise<any[]> {
    const response = await this.makeRequest<APIResponse<any[]>>(`/groups/${groupId}/members`, 'GET', token);
    return response.data;
  }

  async getGroupRoles(groupId: string, token: string): Promise<any[]> {
    const response = await this.makeRequest<APIResponse<any[]>>(`/groups/${groupId}/roles`, 'GET', token);
    return response.data;
  }

  async getRoleGroups(roleId: string, token: string): Promise<any[]> {
    const response = await this.makeRequest<APIResponse<any[]>>(`/roles/${roleId}/groups`, 'GET', token);
    return response.data;
  }

  async getAuditTrail(token: string, limit: number = 50): Promise<any[]> {
    const response = await this.makeRequest<APIResponse<any[]>>(`/audit?limit=${limit}`, 'GET', token);
    return response.data;
  }
}

// Create singleton instance
export const rbacApiClient = new RBACApiClient();

// Export types
export type {
  RBACUser,
  RBACGroup,
  RBACRole,
  RBACPermission,
  CreateUserRequest,
  CreateGroupRequest,
  CreateRoleRequest,
  CreatePermissionRequest,
  APIResponse
};