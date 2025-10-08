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
  ContractDetail,
  ContractStatsResponse,
  ApiError
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

  async confirmJob(jobId: number): Promise<any> {
    return this.request(`/api/processing/confirm/${jobId}`, {
      method: 'POST',
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

  async updateContract(contractId: number, updatedData: any, incrementVersion: boolean = false): Promise<ContractDetail> {
    const queryParams = incrementVersion ? '?increment_version=true' : '';
    return this.request<ContractDetail>(`/api/contracts/${contractId}${queryParams}`, {
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
}

export const apiClient = new ApiClient();

// Default export for convenience
export const apiService = apiClient;