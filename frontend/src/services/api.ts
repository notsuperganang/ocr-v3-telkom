// API Service for Telkom Contract Extractor
import type {
  LoginRequest,
  LoginResponse,
  HealthResponse,
  UploadResponse,
  BatchUploadResponse,
  JobStatusResponse,
  JobDataResponse,
  ContractListResponse,
  UnifiedContractListResponse,
  ContractDetail,
  ContractStatsResponse,
  ApiError,
  TerminPayment,
  UpdateTerminPaymentRequest,
  RecurringPayment,
  UpdateRecurringPaymentRequest,
  DashboardOverview,
  TerminUpcomingResponse,
  RecurringCurrentMonthResponse,
  DashboardFinancialSummary,
  UserInfo,
  ChangePasswordRequest,
  ChangePasswordResponse,
  UpdateProfileRequest,
  UpdateProfileResponse,
  UserResponse,
  CreateUserRequest,
  UpdateUserRequest,
  ChangeUserPasswordRequest,
  UserListResponse,
  SegmentResponse,
  SegmentCreate,
  SegmentUpdate,
  SegmentListResponse,
  WitelResponse,
  WitelCreate,
  WitelUpdate,
  WitelListResponse,
  AccountManagerResponse,
  AccountManagerCreate,
  AccountManagerUpdate,
  AccountManagerListResponse,
  AccountResponse,
  AccountCreate,
  AccountUpdate,
  AccountListResponse,
  AccountContractsResponse,
  AccountStatsSummary
} from '../types/api';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';

class ApiClient {
  private token: string | null = null;

  constructor() {
    // Load token from localStorage on initialization
    this.token = localStorage.getItem('authToken');
  }

  setToken(token: string) {
    this.token = token;
    localStorage.setItem('authToken', token);
  }

  clearToken() {
    this.token = null;
    localStorage.removeItem('authToken');
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${API_BASE_URL}${endpoint}`;
    
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...((options.headers as Record<string, string>) || {}),
    };

    if (this.token) {
      headers.Authorization = `Bearer ${this.token}`;
    }

    const config: RequestInit = {
      ...options,
      headers,
    };

    try {
      const response = await fetch(url, config);
      
      if (!response.ok) {
        const errorData: ApiError = await response.json().catch(() => ({
          detail: `HTTP ${response.status}: ${response.statusText}`,
        }));
        throw new Error(errorData.detail || 'An error occurred');
      }

      // Handle empty responses (like for DELETE requests)
      if (response.status === 204) {
        return {} as T;
      }

      return await response.json();
    } catch (error) {
      if (error instanceof Error) {
        throw error;
      }
      throw new Error('Network error occurred');
    }
  }

  // Authentication
  async login(credentials: LoginRequest): Promise<LoginResponse> {
    const response = await this.request<LoginResponse>('/auth/login', {
      method: 'POST',
      body: JSON.stringify(credentials),
    });
    
    this.setToken(response.access_token);
    return response;
  }

  logout() {
    this.clearToken();
  }

  // Get current user info from /auth/me
  async getCurrentUser(): Promise<UserInfo> {
    return this.request<UserInfo>('/auth/me');
  }

  // Change own password (self-service)
  async changeOwnPassword(passwordData: ChangePasswordRequest): Promise<ChangePasswordResponse> {
    return this.request<ChangePasswordResponse>('/auth/change-password', {
      method: 'POST',
      body: JSON.stringify({
        current_password: passwordData.current_password,
        new_password: passwordData.new_password,
      }),
    });
  }

  // Update own profile (self-service)
  async updateOwnProfile(profileData: UpdateProfileRequest): Promise<UpdateProfileResponse> {
    return this.request<UpdateProfileResponse>('/auth/update-profile', {
      method: 'PATCH',
      body: JSON.stringify(profileData),
    });
  }

  // User Management (Admin/Manager only)
  async listUsers(
    page: number = 1,
    perPage: number = 20,
    search?: string,
    roleFilter?: string,
    activeOnly: boolean = true
  ): Promise<UserListResponse> {
    const params = new URLSearchParams({
      page: page.toString(),
      per_page: perPage.toString(),
      active_only: activeOnly.toString(),
    });

    if (search) params.append('search', search);
    if (roleFilter) params.append('role_filter', roleFilter);

    return this.request<UserListResponse>(`/api/users?${params.toString()}`);
  }

  async getUser(userId: number): Promise<UserResponse> {
    return this.request<UserResponse>(`/api/users/${userId}`);
  }

  async createUser(userData: CreateUserRequest): Promise<UserResponse> {
    return this.request<UserResponse>('/api/users', {
      method: 'POST',
      body: JSON.stringify(userData),
    });
  }

  async updateUser(userId: number, userData: UpdateUserRequest): Promise<UserResponse> {
    return this.request<UserResponse>(`/api/users/${userId}`, {
      method: 'PATCH',
      body: JSON.stringify(userData),
    });
  }

  async changeUserPassword(userId: number, passwordData: ChangeUserPasswordRequest): Promise<{message: string; user_id: number}> {
    return this.request<{message: string; user_id: number}>(`/api/users/${userId}/change-password`, {
      method: 'POST',
      body: JSON.stringify(passwordData),
    });
  }

  async deactivateUser(userId: number): Promise<{message: string; user_id: number; deactivated_by: string}> {
    return this.request<{message: string; user_id: number; deactivated_by: string}>(`/api/users/${userId}/deactivate`, {
      method: 'POST',
    });
  }

  async activateUser(userId: number): Promise<{message: string; user_id: number; activated_by: string}> {
    return this.request<{message: string; user_id: number; activated_by: string}>(`/api/users/${userId}/activate`, {
      method: 'POST',
    });
  }

  // Health check
  async getHealth(): Promise<HealthResponse> {
    return this.request<HealthResponse>('/health');
  }

  // File upload
  async uploadFile(file: File): Promise<UploadResponse> {
    const formData = new FormData();
    formData.append('file', file);

    const response = await fetch(`${API_BASE_URL}/api/upload`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.token}`,
      },
      body: formData,
    });

    if (!response.ok) {
      const errorData: ApiError = await response.json().catch(() => ({
        detail: `HTTP ${response.status}: ${response.statusText}`,
      }));
      throw new Error(errorData.detail || 'Upload failed');
    }

    return response.json();
  }

  async uploadBatch(files: File[]): Promise<BatchUploadResponse> {
    const formData = new FormData();
    files.forEach(file => {
      formData.append('files', file);
    });

    const response = await fetch(`${API_BASE_URL}/api/upload/batch`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.token}`,
      },
      body: formData,
    });

    if (!response.ok) {
      const errorData: ApiError = await response.json().catch(() => ({
        detail: `HTTP ${response.status}: ${response.statusText}`,
      }));
      throw new Error(errorData.detail || 'Batch upload failed');
    }

    return response.json();
  }

  // Processing jobs
  async getJobStatus(jobId: number): Promise<JobStatusResponse> {
    return this.request<JobStatusResponse>(`/api/processing/status/${jobId}`);
  }

  async getJobData(jobId: number): Promise<JobDataResponse> {
    return this.request<JobDataResponse>(`/api/processing/data/${jobId}`);
  }

  async updateJobData(jobId: number, editedData: any): Promise<any> {
    return this.request(`/api/processing/data/${jobId}`, {
      method: 'PATCH',
      body: JSON.stringify({ edited_data: editedData }),
    });
  }

  async confirmJob(jobId: number, confirmData: import('../types/api').ConfirmJobRequest): Promise<import('../types/api').ConfirmJobResponse> {
    return this.request(`/api/processing/confirm/${jobId}`, {
      method: 'POST',
      body: JSON.stringify(confirmData),
    });
  }

  async discardJob(jobId: number): Promise<any> {
    return this.request(`/api/processing/discard/${jobId}`, {
      method: 'DELETE',
    });
  }

  async getJobPdf(jobId: number): Promise<Blob> {
    const response = await fetch(`${API_BASE_URL}/api/processing/pdf/${jobId}`, {
      headers: {
        Authorization: `Bearer ${this.token}`,
      },
    });

    if (!response.ok) {
      let errorMessage = `Failed to fetch PDF (${response.status})`;
      try {
        const errorText = await response.text();
        if (errorText) {
          const errorData = JSON.parse(errorText);
          errorMessage = errorData.detail || errorMessage;
        }
      } catch (e) {
        errorMessage = `Failed to fetch PDF: ${response.statusText}`;
      }
      throw new Error(errorMessage);
    }

    return response.blob();
  }

  // Contracts
  async getContracts(params?: {
    page?: number;
    per_page?: number;
    search?: string;
  }): Promise<ContractListResponse> {
    const searchParams = new URLSearchParams();
    
    if (params?.page) searchParams.append('page', params.page.toString());
    if (params?.per_page) searchParams.append('per_page', params.per_page.toString());
    if (params?.search) searchParams.append('search', params.search);

    const query = searchParams.toString();
    const endpoint = `/api/contracts${query ? `?${query}` : ''}`;
    
    return this.request<ContractListResponse>(endpoint);
  }

  async getUnifiedContracts(params?: {
    page?: number;
    per_page?: number;
    search?: string;
    status_filter?: string;
  }): Promise<UnifiedContractListResponse> {
    const searchParams = new URLSearchParams();

    if (params?.page) searchParams.append('page', params.page.toString());
    if (params?.per_page) searchParams.append('per_page', params.per_page.toString());
    if (params?.search) searchParams.append('search', params.search);
    if (params?.status_filter) searchParams.append('status_filter', params.status_filter);

    const query = searchParams.toString();
    const endpoint = `/api/contracts/all/items${query ? `?${query}` : ''}`;

    return this.request<UnifiedContractListResponse>(endpoint);
  }

  async getContract(contractId: number): Promise<ContractDetail> {
    return this.request<ContractDetail>(`/api/contracts/${contractId}`);
  }

  async downloadContractJson(contractId: number): Promise<Blob> {
    const response = await fetch(`${API_BASE_URL}/api/contracts/${contractId}/json`, {
      headers: {
        Authorization: `Bearer ${this.token}`,
      },
    });

    if (!response.ok) {
      throw new Error('Failed to download JSON');
    }

    return response.blob();
  }

  async downloadContractPdf(contractId: number): Promise<Blob> {
    const response = await fetch(`${API_BASE_URL}/api/contracts/${contractId}/pdf`, {
      headers: {
        Authorization: `Bearer ${this.token}`,
      },
    });

    if (!response.ok) {
      throw new Error('Failed to download PDF');
    }

    return response.blob();
  }

  async updateContract(
    contractId: number,
    updatedData: any,
    incrementVersion: boolean = false,
    accountId?: number | null,
    contractYear?: number,
    telkomContactId?: number | null
  ): Promise<ContractDetail> {
    const params = new URLSearchParams();
    if (incrementVersion) params.append('increment_version', 'true');
    if (accountId !== undefined && accountId !== null) params.append('account_id', accountId.toString());
    if (contractYear !== undefined) params.append('contract_year', contractYear.toString());
    if (telkomContactId !== undefined && telkomContactId !== null) params.append('telkom_contact_id', telkomContactId.toString());
    
    const queryString = params.toString();
    const url = `/api/contracts/${contractId}${queryString ? '?' + queryString : ''}`;
    
    return this.request<ContractDetail>(url, {
      method: 'PATCH',
      body: JSON.stringify(updatedData),
    });
  }

  async getContractPdfStream(contractId: number): Promise<Blob> {
    const response = await fetch(`${API_BASE_URL}/api/contracts/${contractId}/pdf/stream`, {
      headers: {
        Authorization: `Bearer ${this.token}`,
      },
    });

    if (!response.ok) {
      let errorMessage = `Failed to fetch PDF (${response.status})`;
      try {
        const errorText = await response.text();
        if (errorText) {
          const errorData = JSON.parse(errorText);
          errorMessage = errorData.detail || errorMessage;
        }
      } catch (e) {
        errorMessage = `Failed to fetch PDF: ${response.statusText}`;
      }
      throw new Error(errorMessage);
    }

    return response.blob();
  }

  async deleteContract(contractId: number): Promise<any> {
    return this.request(`/api/contracts/${contractId}`, {
      method: 'DELETE',
    });
  }

  async getContractStats(): Promise<ContractStatsResponse> {
    return this.request<ContractStatsResponse>('/api/contracts/stats/summary');
  }

  // Termin Payment Management
  async getTerminPayments(contractId: number): Promise<TerminPayment[]> {
    return this.request<TerminPayment[]>(`/api/contracts/${contractId}/termin-payments`);
  }

  async updateTerminPayment(
    contractId: number,
    terminNumber: number,
    updateData: UpdateTerminPaymentRequest
  ): Promise<TerminPayment> {
    return this.request<TerminPayment>(
      `/api/contracts/${contractId}/termin-payments/${terminNumber}`,
      {
        method: 'PATCH',
        body: JSON.stringify(updateData),
      }
    );
  }

  // Recurring Payment Management
  async getRecurringPayments(contractId: number): Promise<RecurringPayment[]> {
    return this.request<RecurringPayment[]>(`/api/contracts/${contractId}/recurring-payments`);
  }

  async updateRecurringPayment(
    contractId: number,
    cycleNumber: number,
    updateData: UpdateRecurringPaymentRequest
  ): Promise<RecurringPayment> {
    return this.request<RecurringPayment>(
      `/api/contracts/${contractId}/recurring-payments/${cycleNumber}`,
      {
        method: 'PATCH',
        body: JSON.stringify(updateData),
      }
    );
  }

  // Dashboard
  async getDashboardOverview(): Promise<DashboardOverview> {
    return this.request<DashboardOverview>('/api/dashboard/overview');
  }

  async getTerminUpcoming(days: number = 30): Promise<TerminUpcomingResponse> {
    return this.request<TerminUpcomingResponse>(`/api/dashboard/termin-upcoming?days=${days}`);
  }

  async getRecurringCurrentMonth(year?: number, month?: number): Promise<RecurringCurrentMonthResponse> {
    const searchParams = new URLSearchParams();
    if (year !== undefined) searchParams.append('year', year.toString());
    if (month !== undefined) searchParams.append('month', month.toString());
    
    const query = searchParams.toString();
    const endpoint = `/api/dashboard/recurring-current-month${query ? `?${query}` : ''}`;
    
    return this.request<RecurringCurrentMonthResponse>(endpoint);
  }

  async getRecurringAll(): Promise<TerminUpcomingResponse> {
    return this.request<TerminUpcomingResponse>('/api/dashboard/recurring-all');
  }

  async getFinancialSummary(): Promise<DashboardFinancialSummary> {
    return this.request<DashboardFinancialSummary>('/api/dashboard/financial-summary');
  }

  // ============================================================================
  // Master Data API Methods (Segments, Witels, Account Managers, Accounts)
  // ============================================================================

  // Segments
  async listSegments(activeOnly: boolean = true, search?: string): Promise<SegmentListResponse> {
    const params = new URLSearchParams();
    params.append('active_only', activeOnly.toString());
    if (search) params.append('search', search);
    
    return this.request<SegmentListResponse>(`/api/segments?${params.toString()}`);
  }

  async getSegment(id: number): Promise<SegmentResponse> {
    return this.request<SegmentResponse>(`/api/segments/${id}`);
  }

  async createSegment(data: SegmentCreate): Promise<SegmentResponse> {
    return this.request<SegmentResponse>('/api/segments', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateSegment(id: number, data: SegmentUpdate): Promise<SegmentResponse> {
    return this.request<SegmentResponse>(`/api/segments/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  }

  async deactivateSegment(id: number): Promise<SegmentResponse> {
    return this.request<SegmentResponse>(`/api/segments/${id}/deactivate`, {
      method: 'POST',
    });
  }

  async activateSegment(id: number): Promise<SegmentResponse> {
    return this.request<SegmentResponse>(`/api/segments/${id}/activate`, {
      method: 'POST',
    });
  }

  // Witels
  async listWitels(activeOnly: boolean = true, search?: string): Promise<WitelListResponse> {
    const params = new URLSearchParams();
    params.append('active_only', activeOnly.toString());
    if (search) params.append('search', search);
    
    return this.request<WitelListResponse>(`/api/witels?${params.toString()}`);
  }

  async getWitel(id: number): Promise<WitelResponse> {
    return this.request<WitelResponse>(`/api/witels/${id}`);
  }

  async createWitel(data: WitelCreate): Promise<WitelResponse> {
    return this.request<WitelResponse>('/api/witels', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateWitel(id: number, data: WitelUpdate): Promise<WitelResponse> {
    return this.request<WitelResponse>(`/api/witels/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  }

  async deactivateWitel(id: number): Promise<WitelResponse> {
    return this.request<WitelResponse>(`/api/witels/${id}/deactivate`, {
      method: 'POST',
    });
  }

  async activateWitel(id: number): Promise<WitelResponse> {
    return this.request<WitelResponse>(`/api/witels/${id}/activate`, {
      method: 'POST',
    });
  }

  // Account Managers
  async listAccountManagers(
    page: number = 1,
    perPage: number = 20,
    activeOnly: boolean = true,
    search?: string
  ): Promise<AccountManagerListResponse> {
    const params = new URLSearchParams({
      page: page.toString(),
      per_page: perPage.toString(),
      active_only: activeOnly.toString(),
    });
    if (search) params.append('search', search);
    
    return this.request<AccountManagerListResponse>(`/api/account-managers?${params.toString()}`);
  }

  async getAccountManager(id: number): Promise<AccountManagerResponse> {
    return this.request<AccountManagerResponse>(`/api/account-managers/${id}`);
  }

  async createAccountManager(data: AccountManagerCreate): Promise<AccountManagerResponse> {
    return this.request<AccountManagerResponse>('/api/account-managers', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateAccountManager(id: number, data: AccountManagerUpdate): Promise<AccountManagerResponse> {
    return this.request<AccountManagerResponse>(`/api/account-managers/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  }

  async deactivateAccountManager(id: number): Promise<AccountManagerResponse> {
    return this.request<AccountManagerResponse>(`/api/account-managers/${id}/deactivate`, {
      method: 'POST',
    });
  }

  async activateAccountManager(id: number): Promise<AccountManagerResponse> {
    return this.request<AccountManagerResponse>(`/api/account-managers/${id}/activate`, {
      method: 'POST',
    });
  }

  // Accounts
  async listAccounts(
    page: number = 1,
    perPage: number = 20,
    activeOnly: boolean = true,
    search?: string,
    segmentId?: number,
    witelId?: number,
    accountManagerId?: number,
    assignedOfficerId?: number
  ): Promise<AccountListResponse> {
    const params = new URLSearchParams({
      page: page.toString(),
      per_page: perPage.toString(),
      active_only: activeOnly.toString(),
    });
    if (search) params.append('search', search);
    if (segmentId !== undefined) params.append('segment_id', segmentId.toString());
    if (witelId !== undefined) params.append('witel_id', witelId.toString());
    if (accountManagerId !== undefined) params.append('account_manager_id', accountManagerId.toString());
    if (assignedOfficerId !== undefined) params.append('assigned_officer_id', assignedOfficerId.toString());
    
    return this.request<AccountListResponse>(`/api/accounts?${params.toString()}`);
  }

  async getAccount(id: number): Promise<AccountResponse> {
    return this.request<AccountResponse>(`/api/accounts/${id}`);
  }

  async createAccount(data: AccountCreate): Promise<AccountResponse> {
    return this.request<AccountResponse>('/api/accounts', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateAccount(id: number, data: AccountUpdate): Promise<AccountResponse> {
    return this.request<AccountResponse>(`/api/accounts/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  }

  async deactivateAccount(id: number): Promise<AccountResponse> {
    return this.request<AccountResponse>(`/api/accounts/${id}/deactivate`, {
      method: 'POST',
    });
  }

  async activateAccount(id: number): Promise<AccountResponse> {
    return this.request<AccountResponse>(`/api/accounts/${id}/activate`, {
      method: 'POST',
    });
  }

  async getAccountContracts(
    accountId: number,
    page: number = 1,
    perPage: number = 20
  ): Promise<AccountContractsResponse> {
    const params = new URLSearchParams({
      page: page.toString(),
      per_page: perPage.toString(),
    });
    return this.request<AccountContractsResponse>(`/api/accounts/${accountId}/contracts?${params}`);
  }

  async getAccountStats(): Promise<AccountStatsSummary> {
    return this.request<AccountStatsSummary>('/api/accounts/stats/summary');
  }
}

export const apiClient = new ApiClient();

// Default export for convenience
export const apiService = apiClient;