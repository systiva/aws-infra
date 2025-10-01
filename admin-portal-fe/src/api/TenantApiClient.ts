import { TenantData, TenantRegistrationRequest, BackendResponse, TenantsListResponse } from '../models/TenantModel';

const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'http://localhost:8080/api/v1';

export class TenantApiClient {
  private static instance: TenantApiClient;
  
  static getInstance(): TenantApiClient {
    if (!this.instance) {
      this.instance = new TenantApiClient();
    }
    return this.instance;
  }

  private async makeRequest<T>(
    url: string, 
    options: RequestInit = {}
  ): Promise<T> {
    const response = await fetch(url, {
      headers: {
        'Content-Type': 'application/json',
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

  async registerTenant(request: TenantRegistrationRequest): Promise<TenantData> {
    try {
      const response = await this.makeRequest<BackendResponse<TenantData>>(
        `${API_BASE_URL}/tenants/onboard`,
        {
          method: 'POST',
          body: JSON.stringify(request),
        }
      );
      return response.data;
    } catch (error) {
      console.error('Error registering tenant:', error);
      throw error;
    }
  }

  async fetchTenants(): Promise<TenantData[]> {
    try {
      const response = await this.makeRequest<BackendResponse<TenantsListResponse>>(
        `${API_BASE_URL}/tenants`
      );
      return response.data.tenants;
    } catch (error) {
      console.error('Error fetching tenants:', error);
      throw error;
    }
  }

  async updateTenant(tenantId: string, updateData: Partial<TenantData>): Promise<TenantData> {
    try {
      const response = await this.makeRequest<BackendResponse<TenantData>>(
        `${API_BASE_URL}/tenants/onboard`,
        {
          method: 'PUT',
          body: JSON.stringify({ tenantId, ...updateData }),
        }
      );
      return response.data;
    } catch (error) {
      console.error('Error updating tenant:', error);
      throw error;
    }
  }

  async modifyTenantState(tenantId: string, newState: 'active' | 'suspended'): Promise<void> {
    try {
      await this.updateTenant(tenantId, { provisioningState: newState });
    } catch (error) {
      console.error('Error modifying tenant state:', error);
      throw error;
    }
  }

  async deleteTenant(tenantId: string): Promise<void> {
    try {
      await this.makeRequest<BackendResponse<any>>(
        `${API_BASE_URL}/tenants/offboard?tenantId=${encodeURIComponent(tenantId)}`,
        {
          method: 'DELETE',
        }
      );
    } catch (error) {
      console.error('Error deleting tenant:', error);
      throw error;
    }
  }

  async suspendTenant(tenantId: string): Promise<TenantData> {
    try {
      const response = await this.makeRequest<BackendResponse<TenantData>>(
        `${API_BASE_URL}/tenants/suspend?tenantId=${encodeURIComponent(tenantId)}`,
        {
          method: 'PUT',
        }
      );
      return response.data;
    } catch (error) {
      console.error('Error suspending tenant:', error);
      throw error;
    }
  }
}
