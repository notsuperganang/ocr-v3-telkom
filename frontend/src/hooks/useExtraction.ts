import React from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { apiService } from '@/services/api';
import type { TelkomContractData, TypedJobDataResponse } from '@/types/extraction';

// Query keys
export const extractionKeys = {
  all: ['extractions'] as const,
  job: (jobId: number) => [...extractionKeys.all, 'job', jobId] as const,
  status: (jobId: number) => [...extractionKeys.all, 'status', jobId] as const,
};

// Hook for fetching extraction data
export function useExtraction(jobId: number) {
  return useQuery({
    queryKey: extractionKeys.job(jobId),
    queryFn: async (): Promise<TypedJobDataResponse> => {
      const response = await apiService.getJobData(jobId);
      return response;
    },
    staleTime: 30000, // 30 seconds
    refetchOnWindowFocus: false,
    retry: (failureCount, error) => {
      // Don't retry on 404 errors
      if (error instanceof Error && error.message.includes('404')) {
        return false;
      }
      return failureCount < 3;
    },
  });
}

// Hook for fetching job status with polling
export function useJobStatus(jobId: number, shouldPoll = true) {
  return useQuery({
    queryKey: extractionKeys.status(jobId),
    queryFn: () => apiService.getJobStatus(jobId),
    staleTime: 0, // Always fresh for status
    refetchInterval: (query) => {
      // Poll every 3 seconds if status indicates processing
      const data = query.state.data;

      // Explicitly return false if no data yet
      if (!shouldPoll || !data) {
        return false;
      }

      const shouldRefetch = ['queued', 'processing', 'extracted'].includes(data.status);
      return shouldRefetch ? 3000 : false;
    },
    refetchOnWindowFocus: (query) => {
      // Only refetch on window focus if job is still processing
      const data = query.state.data;
      if (!shouldPoll || !data) {
        return false;
      }
      const shouldRefetch = ['queued', 'processing', 'extracted'].includes(data.status);
      return shouldRefetch;
    },
    retry: 3,
  });
}

// Hook for updating extraction data
export function useUpdateExtraction(jobId: number) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: Partial<TelkomContractData>) => {
      return apiService.updateJobData(jobId, data);
    },
    onMutate: async (newData) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: extractionKeys.job(jobId) });

      // Snapshot the previous value
      const previousData = queryClient.getQueryData<TypedJobDataResponse>(
        extractionKeys.job(jobId)
      );

      // Optimistically update the cache
      if (previousData) {
        queryClient.setQueryData<TypedJobDataResponse>(
          extractionKeys.job(jobId),
          {
            ...previousData,
            edited_data: {
              ...(previousData.edited_data || {}),
              ...newData,
            } as TelkomContractData,
          }
        );
      }

      return { previousData };
    },
    onError: (_error, _newData, context) => {
      // Rollback on error
      if (context?.previousData) {
        queryClient.setQueryData(extractionKeys.job(jobId), context.previousData);
      }
    },
    onSettled: () => {
      // Always refetch after error or success
      queryClient.invalidateQueries({ queryKey: extractionKeys.job(jobId) });
    },
  });
}

// Hook for confirming extraction
export function useConfirmExtraction() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  return useMutation({
    mutationFn: async (jobId: number) => {
      return apiService.confirmJob(jobId);
    },
    onSuccess: (data, _jobId) => {
      // Invalidate all extraction-related queries
      queryClient.invalidateQueries({ queryKey: extractionKeys.all });

      // Invalidate contracts queries to show new contract immediately
      queryClient.invalidateQueries({ queryKey: ['contracts'] });

      // Navigate to contracts page with success message
      navigate('/contracts', {
        state: {
          message: 'Data berhasil dikonfirmasi dan disimpan sebagai kontrak',
          contractId: data?.contract_id
        }
      });
    },
    onError: (error) => {
      console.error('Failed to confirm extraction:', error);
    },
  });
}

// Hook for discarding extraction job
export function useDiscardExtraction() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  return useMutation({
    mutationFn: async (jobId: number) => {
      return apiService.discardJob(jobId);
    },
    onSuccess: (_data, jobId) => {
      // Remove from cache
      queryClient.removeQueries({ queryKey: extractionKeys.job(jobId) });
      queryClient.removeQueries({ queryKey: extractionKeys.status(jobId) });

      // Navigate back to upload page
      navigate('/upload', {
        state: {
          message: 'Job berhasil dibatalkan dan file telah dihapus'
        }
      });
    },
    onError: (error) => {
      console.error('Failed to discard extraction:', error);
    },
  });
}

// Hook for getting PDF blob
export function usePdfBlob(jobId: number) {
  return useQuery({
    queryKey: [...extractionKeys.job(jobId), 'pdf'],
    queryFn: async () => {
      const blob = await apiService.getJobPdf(jobId);
      return URL.createObjectURL(blob);
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    refetchOnWindowFocus: false,
    retry: 2,
  });
}

// Utility hook for form data preparation
export function useFormData(jobId: number) {
  const { data: extractionData, isLoading, error } = useExtraction(jobId);

  const formData = React.useMemo(() => {
    if (!extractionData) return null;

    // Prefer edited data over extracted data
    const data = extractionData.edited_data || extractionData.extracted_data;

    if (!data) return null;

    // Ensure all required fields exist with defaults
    return {
      ...data,
      informasi_pelanggan: {
        nama_pelanggan: data.informasi_pelanggan?.nama_pelanggan ?? '',
        alamat: data.informasi_pelanggan?.alamat ?? '',
        npwp: data.informasi_pelanggan?.npwp ?? '',
        perwakilan: {
          nama: data.informasi_pelanggan?.perwakilan?.nama ?? '',
          jabatan: data.informasi_pelanggan?.perwakilan?.jabatan ?? '',
        },
        kontak_person: {
          nama: data.informasi_pelanggan?.kontak_person?.nama ?? '',
          jabatan: data.informasi_pelanggan?.kontak_person?.jabatan ?? '',
          email: data.informasi_pelanggan?.kontak_person?.email ?? '',
          telepon: data.informasi_pelanggan?.kontak_person?.telepon ?? '',
        },
      },
      layanan_utama: {
        connectivity_telkom: data.layanan_utama?.connectivity_telkom ?? 0,
        non_connectivity_telkom: data.layanan_utama?.non_connectivity_telkom ?? 0,
        bundling: data.layanan_utama?.bundling ?? 0,
      },
      rincian_layanan: Array.isArray(data.rincian_layanan) && data.rincian_layanan.length > 0
        ? data.rincian_layanan
        : [{ biaya_instalasi: 0, biaya_langganan_tahunan: 0 }],
      tata_cara_pembayaran: data.tata_cara_pembayaran || {
        method_type: 'one_time_charge' as const,
        description: '',
      },
      kontak_person_telkom: {
        nama: data.kontak_person_telkom?.nama ?? '',
        jabatan: data.kontak_person_telkom?.jabatan ?? '',
        email: data.kontak_person_telkom?.email ?? '',
        telepon: data.kontak_person_telkom?.telepon ?? '',
      },
      jangka_waktu: {
        mulai: data.jangka_waktu?.mulai ?? '',
        akhir: data.jangka_waktu?.akhir ?? '',
      },
      extraction_timestamp: data.extraction_timestamp || new Date().toISOString(),
      processing_time_seconds: data.processing_time_seconds,
    } as TelkomContractData;
  }, [extractionData]);

  return {
    formData,
    extractionData,
    isLoading,
    error,
    hasData: extractionData?.has_data || false,
    status: extractionData?.status || 'unknown',
  };
}

// Hook for auto-save functionality with debouncing
export function useAutoSave(jobId: number, delay = 1000) {
  const updateMutation = useUpdateExtraction(jobId);
  const timeoutRef = React.useRef<NodeJS.Timeout | null>(null);

  const autoSave = React.useCallback((data: Partial<TelkomContractData>) => {
    // Clear existing timeout
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    // Set new timeout
    timeoutRef.current = setTimeout(() => {
      updateMutation.mutate(data);
    }, delay);
  }, [updateMutation.mutate, delay]);

  // Cleanup on unmount
  React.useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  return {
    autoSave,
    isSaving: updateMutation.isPending,
    lastSaveError: updateMutation.error,
    lastSaveTime: updateMutation.data?.timestamp,
  };
}