export interface AccountData {
  accountId: string;
  accountName: string;
  email: string;
  subscriptionTier: 'public' | 'private';
  provisioningState: 'pending' | 'active' | 'suspended' | 'creating' | 'inactive';
  registeredOn: string;
  lastModified?: string;
  createdBy?: string;
}

export interface AccountRegistrationRequest {
  accountName: string;
  email: string;          // Account contact email
  subscriptionTier: 'public' | 'private';
  firstName: string;      // Admin user first name
  lastName: string;       // Admin user last name
  adminUsername: string;  // Admin username for Cognito login
  adminEmail: string;     // Admin user email (separate from account contact)
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

export interface AccountsListResponse {
  accounts: AccountData[];
  totalCount: number;
  timestamp: string;
}
