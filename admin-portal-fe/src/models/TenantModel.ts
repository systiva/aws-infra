export interface TenantData {
  tenantId: string;
  tenantName: string;
  email: string;
  subscriptionTier: 'public' | 'private';
  provisioningState: 'pending' | 'active' | 'suspended' | 'creating' | 'inactive';
  registeredOn: string;
  lastModified?: string;
  createdBy?: string;
}

export interface TenantRegistrationRequest {
  tenantName: string;
  email: string;          // Tenant contact email
  subscriptionTier: 'public' | 'private';
  firstName: string;      // Admin user first name
  lastName: string;       // Admin user last name
  adminUsername: string;  // Admin username for Cognito login
  adminEmail: string;     // Admin user email (separate from tenant contact)
  adminPassword?: string; // Optional admin password (if not provided, will be generated)
  createdBy?: string;
}

export interface ApiResponse<T> {
  status: number;
  message: string;
  data: T;
}

export interface BackendResponse<T> {
  msg: string;
  data: T;
  result: string;
}

export interface TenantsListResponse {
  tenants: TenantData[];
  totalCount: number;
  timestamp: string;
}
