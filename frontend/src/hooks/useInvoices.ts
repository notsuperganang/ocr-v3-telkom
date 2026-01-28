import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiService } from '@/services/api';
import type {
  InvoiceFilters,
  InvoiceType,
  AddPaymentRequest,
  UpdateInvoiceStatusRequest,
  DocumentType,
} from '@/types/api';

// Query keys for invoice-related queries
export const invoiceKeys = {
  all: ['invoices'] as const,
  lists: () => [...invoiceKeys.all, 'list'] as const,
  list: (filters: InvoiceFilters) => [...invoiceKeys.lists(), filters] as const,
  details: () => [...invoiceKeys.all, 'detail'] as const,
  detail: (invoiceType: InvoiceType, id: string) => [...invoiceKeys.details(), invoiceType, id] as const,
  documents: (invoiceType: InvoiceType, id: string) => [...invoiceKeys.detail(invoiceType, id), 'documents'] as const,
};

// Hook for fetching invoices list with filters
export function useInvoices(filters: InvoiceFilters) {
  return useQuery({
    queryKey: invoiceKeys.list(filters),
    queryFn: () => apiService.getInvoices(filters),
    staleTime: 30000, // 30 seconds
    refetchOnWindowFocus: false,
    retry: 2,
  });
}

// Hook for fetching single invoice details with payments and documents
export function useInvoiceDetail(invoiceType: InvoiceType, id: string) {
  return useQuery({
    queryKey: invoiceKeys.detail(invoiceType, id),
    queryFn: () => apiService.getInvoiceDetail(invoiceType, id),
    staleTime: 60000, // 1 minute
    refetchOnWindowFocus: false,
    retry: 2,
    enabled: !!invoiceType && !!id,
  });
}

// Hook for fetching invoice documents
export function useInvoiceDocuments(
  invoiceType: InvoiceType,
  id: string,
  documentType?: DocumentType
) {
  return useQuery({
    queryKey: invoiceKeys.documents(invoiceType, id),
    queryFn: () => apiService.getInvoiceDocuments(invoiceType, id, documentType),
    staleTime: 30000,
    refetchOnWindowFocus: false,
    retry: 2,
    enabled: !!invoiceType && !!id,
  });
}

// Hook for adding payment to invoice
export function useAddPayment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      invoiceType,
      id,
      data,
    }: {
      invoiceType: InvoiceType;
      id: string;
      data: AddPaymentRequest;
    }) => apiService.addPayment(invoiceType, id, data),
    onSuccess: (_, variables) => {
      // Invalidate invoice detail to refetch with new payment
      queryClient.invalidateQueries({
        queryKey: invoiceKeys.detail(variables.invoiceType, variables.id),
      });
      // Invalidate list to update summary
      queryClient.invalidateQueries({
        queryKey: invoiceKeys.lists(),
      });
    },
    onError: (error) => {
      console.error('Failed to add payment:', error);
    },
  });
}

// Hook for uploading document to invoice
export function useUploadInvoiceDocument() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      invoiceType,
      id,
      file,
      documentType,
      paymentTransactionId,
      notes,
    }: {
      invoiceType: InvoiceType;
      id: string;
      file: File;
      documentType: DocumentType;
      paymentTransactionId?: string;
      notes?: string;
    }) =>
      apiService.uploadInvoiceDocument(
        invoiceType,
        id,
        file,
        documentType,
        paymentTransactionId,
        notes
      ),
    onSuccess: (_, variables) => {
      // Invalidate invoice detail and documents
      queryClient.invalidateQueries({
        queryKey: invoiceKeys.detail(variables.invoiceType, variables.id),
      });
      queryClient.invalidateQueries({
        queryKey: invoiceKeys.documents(variables.invoiceType, variables.id),
      });
    },
    onError: (error) => {
      console.error('Failed to upload document:', error);
    },
  });
}

// Hook for updating invoice status
export function useUpdateInvoiceStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      invoiceType,
      id,
      data,
    }: {
      invoiceType: InvoiceType;
      id: string;
      data: UpdateInvoiceStatusRequest;
    }) => apiService.updateInvoiceStatus(invoiceType, id, data),
    onSuccess: (_, variables) => {
      // Invalidate invoice detail
      queryClient.invalidateQueries({
        queryKey: invoiceKeys.detail(variables.invoiceType, variables.id),
      });
      // Invalidate list
      queryClient.invalidateQueries({
        queryKey: invoiceKeys.lists(),
      });
    },
    onError: (error) => {
      console.error('Failed to update invoice status:', error);
    },
  });
}

// Hook for sending invoice
export function useSendInvoice() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      invoiceType,
      id,
    }: {
      invoiceType: InvoiceType;
      id: string;
    }) => apiService.sendInvoice(invoiceType, id),
    onSuccess: (_, variables) => {
      // Invalidate invoice detail
      queryClient.invalidateQueries({
        queryKey: invoiceKeys.detail(variables.invoiceType, variables.id),
      });
      // Invalidate list
      queryClient.invalidateQueries({
        queryKey: invoiceKeys.lists(),
      });
    },
    onError: (error) => {
      console.error('Failed to send invoice:', error);
    },
  });
}

// Hook for editing payment
export function useEditPayment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      paymentId,
      data,
    }: {
      paymentId: number;
      data: AddPaymentRequest;
    }) => apiService.editPayment(paymentId, data),
    onSuccess: () => {
      // Invalidate all invoice details and lists to refresh data
      queryClient.invalidateQueries({
        queryKey: invoiceKeys.details(),
      });
      queryClient.invalidateQueries({
        queryKey: invoiceKeys.lists(),
      });
    },
    onError: (error) => {
      console.error('Failed to edit payment:', error);
    },
  });
}

// Hook for deleting payment
export function useDeletePayment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (paymentId: number) => apiService.deletePayment(paymentId),
    onSuccess: () => {
      // Invalidate all invoice details and lists to refresh data
      queryClient.invalidateQueries({
        queryKey: invoiceKeys.details(),
      });
      queryClient.invalidateQueries({
        queryKey: invoiceKeys.lists(),
      });
    },
    onError: (error) => {
      console.error('Failed to delete payment:', error);
    },
  });
}

// Hook for deleting document
export function useDeleteDocument() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (documentId: number) => apiService.deleteDocument(documentId),
    onSuccess: (data) => {
      // Invalidate invoice detail to refresh with updated status
      const invoiceType = data.invoice_updated.invoice_type.toUpperCase() as InvoiceType;
      const invoiceId = data.invoice_updated.invoice_id.toString();
      
      queryClient.invalidateQueries({
        queryKey: invoiceKeys.detail(invoiceType, invoiceId),
      });
      queryClient.invalidateQueries({
        queryKey: invoiceKeys.documents(invoiceType, invoiceId),
      });
      // Also invalidate list to update summary
      queryClient.invalidateQueries({
        queryKey: invoiceKeys.lists(),
      });
    },
    onError: (error) => {
      console.error('Failed to delete document:', error);
    },
  });
}

// Hook for updating invoice notes
export function useUpdateInvoiceNotes() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      invoiceType,
      id,
      notes,
    }: {
      invoiceType: InvoiceType;
      id: string;
      notes: string;
    }) => apiService.updateInvoiceNotes(invoiceType, id, notes),
    onSuccess: (_, variables) => {
      // Invalidate invoice detail to refresh with updated notes
      queryClient.invalidateQueries({
        queryKey: invoiceKeys.detail(variables.invoiceType, variables.id),
      });
      // Also invalidate list to update notes in list view
      queryClient.invalidateQueries({
        queryKey: invoiceKeys.lists(),
      });
    },
    onError: (error) => {
      console.error('Failed to update notes:', error);
    },
  });
}

// Hook for exporting invoices
export function useExportInvoices() {
  return useMutation({
    mutationFn: async ({
      filters,
      format = 'xlsx',
    }: {
      filters: InvoiceFilters;
      format?: 'xlsx' | 'csv';
    }) => {
      const blob = await apiService.exportInvoices(filters, format);

      // Create download link
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const extension = format === 'xlsx' ? 'xlsx' : 'csv';
      a.download = `invoices_${filters.year}_${String(filters.month).padStart(2, '0')}.${extension}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      return { success: true };
    },
    onError: (error) => {
      console.error('Failed to export invoices:', error);
    },
  });
}
