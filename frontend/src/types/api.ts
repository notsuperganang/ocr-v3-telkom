// API Types for Telkom Contract Extractor

export interface LoginRequest {
  username: string;
  password: string;
}

export interface LoginResponse {
  access_token: string;
  token_type: string;
  username: string;
}

export interface HealthResponse {
  status: string;
  app_name: string;
  version: string;
  database: {
    status: string;
    tables?: string[];
  };
  authentication: string;
  ocr_service: string;
}

export interface UploadResponse {
  job_id: number;
  file_id: number;
  filename: string;
  message: string;
}

export interface BatchUploadResponse {
  uploaded_files: UploadResponse[];
  total_files: number;
  message: string;
}

export interface JobStatusResponse {
  job_id: number;
  file_id: number;
  filename: string;
  status: string;
  progress_message: string;
  processing_time_seconds?: number;
  error_message?: string;
  created_at: string;
  updated_at: string;
}

export interface JobDataResponse {
  job_id: number;
  file_id: number;
  filename: string;
  status: string;
  extracted_data?: any;
  edited_data?: any;
  ocr_artifacts?: Record<string, string>;
  has_data: boolean;
}

export interface ContractSummary {
  id: number;
  file_id: number;
  source_job_id: number;
  filename: string;
  confirmed_by: string;
  confirmed_at: string;
  created_at: string;
  contract_number?: string;
  customer_name?: string;
}

export interface ContractListResponse {
  contracts: ContractSummary[];
  total: number;
  page: number;
  per_page: number;
  total_pages: number;
}

export interface ContractDetail {
  id: number;
  file_id: number;
  source_job_id: number;
  filename: string;
  final_data: any;
  version: number;
  confirmed_by: string;
  confirmed_at: string;
  created_at: string;
  updated_at: string;
  file_size_bytes: number;
  processing_time_seconds?: number;
}

export interface ApiError {
  detail: string;
}

export type JobStatus = 'queued' | 'processing' | 'extracted' | 'awaiting_review' | 'confirmed' | 'failed';