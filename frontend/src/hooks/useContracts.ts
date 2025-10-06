import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiService } from '@/services/api';

// Query keys for contract-related queries
export const contractKeys = {
  all: ['contracts'] as const,
  lists: () => [...contractKeys.all, 'list'] as const,
  list: (params?: { page?: number; per_page?: number; search?: string }) =>
    [...contractKeys.lists(), params] as const,
  details: () => [...contractKeys.all, 'detail'] as const,
  detail: (id: number) => [...contractKeys.details(), id] as const,
};

// Hook for fetching contracts list with pagination and search
export function useContracts(params?: {
  page?: number;
  per_page?: number;
  search?: string;
}) {
  return useQuery({
    queryKey: contractKeys.list(params),
    queryFn: () => apiService.getContracts(params),
    staleTime: 30000, // 30 seconds
    refetchOnWindowFocus: false,
    retry: 2,
  });
}

// Hook for fetching single contract details
export function useContract(contractId: number) {
  return useQuery({
    queryKey: contractKeys.detail(contractId),
    queryFn: () => apiService.getContract(contractId),
    staleTime: 60000, // 1 minute
    refetchOnWindowFocus: false,
    retry: 2,
    enabled: !!contractId,
  });
}

// Hook for downloading contract as JSON
export function useDownloadContractJson() {
  return useMutation({
    mutationFn: async (contractId: number) => {
      const blob = await apiService.downloadContractJson(contractId);

      // Create download link
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `contract_${contractId}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      return { contractId, success: true };
    },
    onError: (error) => {
      console.error('Failed to download contract JSON:', error);
    },
  });
}

// Hook for downloading contract PDF
export function useDownloadContractPdf() {
  return useMutation({
    mutationFn: async (contractId: number) => {
      const blob = await apiService.downloadContractPdf(contractId);

      // Create download link
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `contract_${contractId}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      return { contractId, success: true };
    },
    onError: (error) => {
      console.error('Failed to download contract PDF:', error);
    },
  });
}

// Hook for deleting a contract
export function useDeleteContract() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (contractId: number) => apiService.deleteContract(contractId),
    onSuccess: () => {
      // Invalidate and refetch contracts list
      queryClient.invalidateQueries({ queryKey: contractKeys.lists() });
    },
    onError: (error) => {
      console.error('Failed to delete contract:', error);
    },
  });
}

// Hook for contract statistics from backend aggregation endpoint
export function useContractStats() {
  return useQuery({
    queryKey: [...contractKeys.all, 'stats'],
    queryFn: () => apiService.getContractStats(),
    staleTime: 30000, // 30 seconds
    refetchOnWindowFocus: false,
    retry: 2,
  });
}

// Utility hook to invalidate all contract queries (useful after confirmations)
export function useInvalidateContracts() {
  const queryClient = useQueryClient();

  return () => {
    queryClient.invalidateQueries({ queryKey: contractKeys.all });
  };
}