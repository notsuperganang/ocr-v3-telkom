import { useParams, useNavigate } from 'react-router-dom';
import { useState, useEffect, useCallback } from 'react';
import {
  FileText,
  Clock,
  ArrowLeft,
  RefreshCw,
  AlertCircle
} from 'lucide-react';
import { toast } from 'sonner';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ExtractionForm } from '@/components/ExtractionForm';
import { useContract, useUpdateContract } from '@/hooks/useContracts';
import { apiService } from '@/services/api';

export function ContractEditPage() {
  const { contractId } = useParams<{ contractId: string }>();
  const navigate = useNavigate();

  const numericContractId = contractId ? parseInt(contractId, 10) : 0;

  // Fetch contract data
  const { data: contract, isLoading: contractLoading, error: contractError } = useContract(numericContractId);

  // Update mutation
  const updateMutation = useUpdateContract();

  // Local state for form data
  const [formData, setFormData] = useState<any>(null);
  const [hasFormChanges, setHasFormChanges] = useState(false);
  const [hasAccountChanges, setHasAccountChanges] = useState(false);
  const hasUnsavedChanges = hasFormChanges || hasAccountChanges;

  // Account linkage state
  const [accountLinkage, setAccountLinkage] = useState<{
    accountId: number | null;
    contractYear: number;
    telkomContactId: number | null;
  } | null>(null);

  // Track initial account linkage values to detect real changes
  const [initialAccountLinkage, setInitialAccountLinkage] = useState<{
    accountId: number | null;
    contractYear: number;
    telkomContactId: number | null;
  } | null>(null);

  // PDF preview state
  const [pdfBlob, setPdfBlob] = useState<string | null>(null);
  const [pdfLoading, setPdfLoading] = useState(true);
  const [pdfError, setPdfError] = useState<string | null>(null);

  // Load contract data into form when available
  useEffect(() => {
    if (contract?.final_data) {
      setFormData(contract.final_data);
      // Set initial account linkage values
      if (!initialAccountLinkage) {
        setInitialAccountLinkage({
          accountId: contract.account_id ?? null,
          contractYear: contract.contract_year,
          telkomContactId: contract.telkom_contact_id ?? null,
        });
      }
    }
  }, [contract, initialAccountLinkage]);

  // Load PDF on mount
  useEffect(() => {
    async function loadPdf() {
      try {
        console.log(`Loading PDF for contract ${numericContractId}...`);
        setPdfLoading(true);
        setPdfError(null);

        const blob = await apiService.getContractPdfStream(numericContractId);
        console.log(`PDF blob received: ${blob.size} bytes`);

        if (blob.size === 0) {
          throw new Error('Received empty PDF file');
        }

        const url = URL.createObjectURL(blob);
        setPdfBlob(url);
        setPdfLoading(false);
      } catch (error) {
        console.error('Failed to load PDF:', error);
        setPdfError(error instanceof Error ? error.message : 'Failed to load PDF');
        setPdfLoading(false);
      }
    }

    if (numericContractId) {
      loadPdf();
    }

    // Cleanup blob URL on unmount
    return () => {
      if (pdfBlob) {
        URL.revokeObjectURL(pdfBlob);
      }
    };
  }, [numericContractId]);

  // Handle back navigation
  const handleBack = () => {
    if (hasUnsavedChanges) {
      if (confirm('You have unsaved changes. Are you sure you want to leave?')) {
        navigate(`/contracts/${numericContractId}`);
      }
    } else {
      navigate(`/contracts/${numericContractId}`);
    }
  };

  // Handle form data changes (no auto-save, only update local state)
  const handleFormChange = (data: any) => {
    setFormData(data);
  };

  // Handle form dirty state change from ExtractionForm
  const handleFormDirtyChange = useCallback((isDirty: boolean) => {
    setHasFormChanges(isDirty);
  }, []);

  // Handle account linkage changes (wrapped in useCallback to prevent infinite loop)
  const handleAccountLinkageChange = useCallback((data: { accountId: number | null; contractYear: number; telkomContactId: number | null }) => {
    setAccountLinkage(data);
    // Only mark as changed if values differ from initial
    if (initialAccountLinkage) {
      const hasChanged = 
        data.accountId !== initialAccountLinkage.accountId ||
        data.contractYear !== initialAccountLinkage.contractYear ||
        data.telkomContactId !== initialAccountLinkage.telkomContactId;
      setHasAccountChanges(hasChanged);
    }
  }, [initialAccountLinkage]);

  // Handle confirmation (save with version increment)
  const handleSave = async (dataToSave?: any) => {
    // Use passed data if available (from ExtractionForm), fallback to state
    const dataForSave = dataToSave || formData;
    if (!dataForSave || !contract) return;

    // Only increment version if there are actual changes
    const shouldIncrementVersion = hasUnsavedChanges;

    try {
      await updateMutation.mutateAsync({
        contractId: numericContractId,
        data: dataForSave,
        incrementVersion: shouldIncrementVersion,
        accountId: accountLinkage?.accountId ?? null,
        contractYear: accountLinkage?.contractYear ?? contract.contract_year,
        telkomContactId: accountLinkage?.telkomContactId ?? null,
      });
      setHasFormChanges(false);
      setHasAccountChanges(false);
      toast.success('Kontrak berhasil diperbarui');

      // Navigate back to detail page after successful save
      setTimeout(() => {
        navigate(`/contracts/${numericContractId}`);
      }, 1000);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Gagal memperbarui kontrak';
      toast.error(errorMessage);
      console.error('Failed to save:', error);
    }
  };

  // Loading state
  if (contractLoading || !contract) {
    return (
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-center min-h-64">
          <div className="flex items-center gap-3">
            <RefreshCw className="w-6 h-6 animate-spin text-primary" />
            <span className="text-lg">Memuat data kontrak...</span>
          </div>
        </div>
      </div>
    );
  }

  // Error state
  if (contractError) {
    return (
      <div className="p-6 space-y-6">
        <div className="flex items-center gap-3 mb-6">
          <Button
            variant="ghost"
            onClick={handleBack}
            className="flex items-center gap-2 text-muted-foreground hover:text-white focus-visible:text-white"
          >
            <ArrowLeft className="w-4 h-4" />
            Kembali ke Detail
          </Button>
        </div>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-4 text-red-600">
              <AlertCircle className="w-8 h-8" />
              <div>
                <h3 className="font-semibold text-lg">Terjadi Kesalahan</h3>
                <p className="text-muted-foreground">Gagal memuat data kontrak</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!formData) {
    return (
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-center min-h-64">
          <div className="flex items-center gap-3">
            <RefreshCw className="w-6 h-6 animate-spin text-primary" />
            <span className="text-lg">Memuat form data...</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="-m-2 md:-m-10 h-[calc(100%+1rem)] md:h-[calc(100%+5rem)] w-[calc(100%+1rem)] md:w-[calc(100%+5rem)] flex flex-col overflow-hidden">
      {/* Compact Header Bar */}
      <div className="flex items-center justify-between py-2 px-3 border-b shrink-0">
        {/* Left - Back button */}
        <Button
          variant="ghost"
          onClick={handleBack}
          size="sm"
          className="flex items-center gap-1.5 text-muted-foreground hover:text-foreground hover:bg-gray-100 h-8"
        >
          <ArrowLeft className="w-4 h-4" />
          <span className="text-sm">Kembali</span>
        </Button>

        {/* Center - Filename */}
        <div className="flex items-center gap-2 flex-1 justify-center min-w-0">
          <FileText className="w-4 h-4 text-primary flex-shrink-0" />
          <span className="text-sm font-medium">
            {contract.filename}
          </span>
        </div>

        {/* Right - Badges */}
        <div className="flex items-center gap-2">
          <Badge
            variant="outline"
            className="text-amber-600 border-amber-300 bg-amber-50 text-xs py-0.5 px-2"
          >
            <FileText className="w-3 h-3 mr-1" />
            Edit Mode
          </Badge>

          <Badge variant="secondary" className="text-xs py-0.5 px-2">
            v{contract.version}
          </Badge>

          {hasUnsavedChanges && (
            <Badge variant="outline" className="text-orange-600 border-orange-300 bg-orange-50 text-xs py-0.5 px-2">
              <Clock className="w-3 h-3 mr-1" />
              Unsaved
            </Badge>
          )}

          {updateMutation.isPending && (
            <Badge variant="outline" className="text-blue-600 border-blue-300 bg-blue-50 text-xs py-0.5 px-2">
              <RefreshCw className="w-3 h-3 mr-1 animate-spin" />
              Saving...
            </Badge>
          )}
        </div>
      </div>

      {/* Main Content - 2 Pane Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 flex-1 min-h-0 p-3">
        {/* Left Pane - PDF Preview */}
        <div className="h-full min-h-0">
          <div className="border border-gray-200 rounded-lg overflow-hidden bg-white h-full">
            {pdfLoading ? (
              <div className="flex items-center justify-center h-full">
                <div className="flex items-center gap-3">
                  <RefreshCw className="w-6 h-6 animate-spin text-primary" />
                  <span>Loading PDF...</span>
                </div>
              </div>
            ) : pdfError ? (
              <div className="flex flex-col items-center justify-center h-full gap-4 p-8">
                <AlertCircle className="w-8 h-8 text-red-500" />
                <p className="text-muted-foreground text-center">{pdfError}</p>
              </div>
            ) : pdfBlob ? (
              <iframe
                src={pdfBlob}
                className="w-full h-full border-0"
                title="PDF Preview"
              />
            ) : null}
          </div>
        </div>

        {/* Right Pane - Extraction Form */}
        <div className="h-full min-h-0 overflow-y-auto">
          <ExtractionForm
            jobId={0} // Not used for contract edit
            initialData={formData}
            onSave={handleFormChange}
            onConfirm={handleSave}
            onDiscard={handleBack}
            mode="contract"
            contractId={numericContractId}
            initialAccountId={contract.account_id}
            initialContractYear={contract.contract_year}
            initialTelkomContactId={contract.telkom_contact_id}
            onAccountLinkageChange={handleAccountLinkageChange}
            onDirtyChange={handleFormDirtyChange}
          />
        </div>
      </div>
    </div>
  );
}
