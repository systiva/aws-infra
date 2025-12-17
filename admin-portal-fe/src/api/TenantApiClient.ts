import { TenantData, TenantRegistrationRequest, BackendResponse, TenantsListResponse } from '../models/TenantModel';
import { apiClient } from './ApiClient';

export class TenantApiClient {
  private static instance: TenantApiClient;
  
  static getInstance(): TenantApiClient {
    if (!this.instance) {
      this.instance = new TenantApiClient();
    }
    return this.instance;
  }

  async registerTenant(request: TenantRegistrationRequest): Promise<TenantData> {
    try {
      const response = await apiClient.request<BackendResponse<TenantData>>(
        '/tenants/onboard',
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
      const response = await apiClient.request<BackendResponse<TenantsListResponse>>(
        '/tenants'
      );
      return response.data.tenants;
    } catch (error) {
      console.error('Error fetching tenants:', error);
      throw error;
    }
  }

  async fetchTenantDetails(tenantId: string): Promise<TenantData> {
    try {
      const response = await apiClient.request<BackendResponse<TenantData>>(
        `/tenants/${encodeURIComponent(tenantId)}`
      );
      return response.data;
    } catch (error) {
      console.error('Error fetching tenant details:', error);
      throw error;
    }
  }

  async updateTenant(tenantId: string, updateData: Partial<TenantData>): Promise<TenantData> {
    try {
      const response = await apiClient.request<BackendResponse<TenantData>>(
        '/tenants/onboard',
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
      await apiClient.request<BackendResponse<any>>(
        `/tenants/offboard?tenantId=${encodeURIComponent(tenantId)}`,
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
      const response = await apiClient.request<BackendResponse<TenantData>>(
        `/tenants/suspend?tenantId=${encodeURIComponent(tenantId)}`,
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
