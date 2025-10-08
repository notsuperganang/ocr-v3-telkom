import { useParams, useNavigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import {
  FileText,
  Clock,
  ArrowLeft,
  RefreshCw,
  AlertCircle
} from 'lucide-react';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  // PDF preview state
  const [pdfBlob, setPdfBlob] = useState<string | null>(null);
  const [pdfLoading, setPdfLoading] = useState(true);
  const [pdfError, setPdfError] = useState<string | null>(null);

  // Load contract data into form when available
  useEffect(() => {
    if (contract?.final_data) {
      setFormData(contract.final_data);
    }
  }, [contract]);

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

  // Handle form data changes (auto-save without version increment)
  const handleFormChange = async (data: any) => {
    setFormData(data);
    setHasUnsavedChanges(true);

    // Auto-save without incrementing version
    try {
      await updateMutation.mutateAsync({
        contractId: numericContractId,
        data: data,
        incrementVersion: false
      });
      setHasUnsavedChanges(false);
    } catch (error) {
      console.error('Auto-save failed:', error);
    }
  };

  // Handle confirmation (save with version increment)
  const handleSave = async () => {
    if (!formData) return;

    try {
      await updateMutation.mutateAsync({
        contractId: numericContractId,
        data: formData,
        incrementVersion: true
      });
      setHasUnsavedChanges(false);
      toast.success('Contract updated successfully!');

      // Navigate back to detail page after successful save
      setTimeout(() => {
        navigate(`/contracts/${numericContractId}`);
      }, 1000);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to update contract';
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
    <div className="p-4 space-y-3">
      {/* Status Header with Back Button */}
      <Card>
        <CardHeader className="py-2">
          <div className="flex items-center justify-between mb-1">
            <Button
              variant="ghost"
              onClick={handleBack}
              size="sm"
              className="flex items-center gap-1 text-muted-foreground hover:text-white focus-visible:text-white -ml-2 h-7"
            >
              <ArrowLeft className="w-3 h-3" />
              <span className="text-xs">Kembali ke Detail</span>
            </Button>

            <div className="flex items-center gap-2">
              <Badge
                variant="outline"
                className="text-amber-600 border-amber-600 text-xs py-0 px-1.5 h-5"
              >
                <FileText className="w-2.5 h-2.5 mr-1" />
                Edit Mode
              </Badge>

              <Badge variant="secondary" className="text-xs py-0 px-1.5 h-5">
                v{contract.version}
              </Badge>

              {hasUnsavedChanges && (
                <Badge variant="outline" className="text-orange-600 border-orange-600 text-xs py-0 px-1.5 h-5">
                  <Clock className="w-2.5 h-2.5 mr-1" />
                  Unsaved
                </Badge>
              )}

              {updateMutation.isPending && (
                <Badge variant="outline" className="text-blue-600 border-blue-600 text-xs py-0 px-1.5 h-5">
                  <RefreshCw className="w-2.5 h-2.5 mr-1 animate-spin" />
                  Saving...
                </Badge>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <FileText className="w-4 h-4 text-primary" />
            <div>
              <CardTitle className="text-base leading-tight">Edit Kontrak</CardTitle>
              <p className="text-xs text-muted-foreground leading-tight">
                {contract.filename}
              </p>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Main Content - 2 Pane Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 h-[calc(100vh-140px)]">
        {/* Left Pane - PDF Preview */}
        <div className="h-full">
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
        <div className="h-full overflow-y-auto">
          <ExtractionForm
            jobId={0} // Not used for contract edit
            initialData={formData}
            onSave={handleFormChange}
            onConfirm={handleSave}
            onDiscard={handleBack}
            mode="contract"
          />
        </div>
      </div>

      {/* Footer Info */}
      <Card>
        <CardContent className="p-2">
          <div className="flex items-center justify-center text-xs text-muted-foreground">
            <span>💾 Data tersimpan otomatis saat Anda mengedit. Klik "Konfirmasi & Simpan" untuk finalisasi perubahan.</span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
