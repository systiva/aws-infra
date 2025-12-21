import { AccountData, AccountRegistrationRequest, BackendResponse, AccountsListResponse } from '../models/AccountModel';
import { apiClient } from './ApiClient';

export class AccountApiClient {
  private static instance: AccountApiClient;
  
  static getInstance(): AccountApiClient {
    if (!this.instance) {
      this.instance = new AccountApiClient();
    }
    return this.instance;
  }

  async registerAccount(request: AccountRegistrationRequest): Promise<AccountData> {
    try {
      const response = await apiClient.request<BackendResponse<AccountData>>(
        '/accounts/onboard',
        {
          method: 'POST',
          body: JSON.stringify(request),
        }
      );
      return response.data;
    } catch (error) {
      console.error('Error registering account:', error);
      throw error;
    }
  }

  async fetchAccounts(): Promise<AccountData[]> {
    try {
      const response = await apiClient.request<BackendResponse<AccountsListResponse>>(
        '/accounts'
      );
      return response.data.accounts;
    } catch (error) {
      console.error('Error fetching accounts:', error);
      throw error;
    }
  }

  async fetchAccountDetails(accountId: string): Promise<AccountData> {
    try {
      const response = await apiClient.request<BackendResponse<AccountData>>(
        `/accounts/${encodeURIComponent(accountId)}`
      );
      return response.data;
    } catch (error) {
      console.error('Error fetching account details:', error);
      throw error;
    }
  }

  async updateAccount(accountId: string, updateData: Partial<AccountData>): Promise<AccountData> {
    try {
      const response = await apiClient.request<BackendResponse<AccountData>>(
        '/accounts/onboard',
        {
          method: 'PUT',
          body: JSON.stringify({ accountId, ...updateData }),
        }
      );
      return response.data;
    } catch (error) {
      console.error('Error updating account:', error);
      throw error;
    }
  }

  async modifyAccountState(accountId: string, newState: 'active' | 'suspended'): Promise<void> {
    try {
      await this.updateAccount(accountId, { provisioningState: newState });
    } catch (error) {
      console.error('Error modifying account state:', error);
      throw error;
    }
  }

  async deleteAccount(accountId: string): Promise<void> {
    try {
      await apiClient.request<BackendResponse<any>>(
        `/accounts/offboard?accountId=${encodeURIComponent(accountId)}`,
        {
          method: 'DELETE',
        }
      );
    } catch (error) {
      console.error('Error deleting account:', error);
      throw error;
    }
  }

  async suspendAccount(accountId: string): Promise<AccountData> {
    try {
      const response = await apiClient.request<BackendResponse<AccountData>>(
        `/accounts/suspend?accountId=${encodeURIComponent(accountId)}`,
        {
          method: 'PUT',
        }
      );
      return response.data;
    } catch (error) {
      console.error('Error suspending account:', error);
      throw error;
    }
  }
}
