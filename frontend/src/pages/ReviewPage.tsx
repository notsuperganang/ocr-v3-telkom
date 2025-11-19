import { useParams, useNavigate } from 'react-router-dom';
import {
  FileText,
  Clock,
  ArrowLeft,
  RefreshCw,
  AlertCircle,
  CheckCircle
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { PdfPreview } from '@/components/PdfPreview';
import { ExtractionForm } from '@/components/ExtractionForm';
import { useFormData, useJobStatus } from '@/hooks/useExtraction';

export function ReviewPage() {
  const { jobId } = useParams<{ jobId: string }>();
  const navigate = useNavigate();

  const numericJobId = jobId ? parseInt(jobId, 10) : 0;

  // Fetch job status and data
  const { data: statusData, isLoading: statusLoading } = useJobStatus(
    numericJobId,
    true // Enable polling
  );

  const {
    formData,
    extractionData,
    isLoading: dataLoading,
    error: dataError,
    hasData,
    status,
  } = useFormData(numericJobId);

  const isLoading = statusLoading || dataLoading;

  // Handle back navigation
  const handleBack = () => {
    navigate('/upload');
  };


  // Show loading state
  if (isLoading) {
    return (
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-center min-h-64">
          <div className="flex items-center gap-3">
            <RefreshCw className="w-6 h-6 animate-spin text-primary" />
            <span className="text-lg">Memuat data ekstraksi...</span>
          </div>
        </div>
      </div>
    );
  }

  // Show error state
  if (dataError || !extractionData) {
    return (
      <div className="p-6 space-y-6">
        <div className="flex items-center gap-3 mb-6">
          <Button
            variant="ghost"
            onClick={handleBack}
            className="flex items-center gap-2 text-muted-foreground hover:text-white focus-visible:text-white"
          >
            <ArrowLeft className="w-4 h-4" />
            Kembali ke Upload
          </Button>
        </div>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-4 text-red-600">
              <AlertCircle className="w-8 h-8" />
              <div>
                <h3 className="font-semibold text-lg">Terjadi Kesalahan</h3>
                <p className="text-muted-foreground">
                  {dataError?.message || 'Gagal memuat data ekstraksi'}
                </p>
              </div>
            </div>
            <Button
              variant="outline"
              onClick={() => window.location.reload()}
              className="mt-4"
            >
              Muat Ulang
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Show processing state if not ready for review
  if (status !== 'awaiting_review' && status !== 'confirmed') {
    return (
      <div className="p-6 space-y-6">
        <div className="flex items-center gap-3 mb-6">
          <Button
            variant="ghost"
            onClick={handleBack}
            className="flex items-center gap-2 text-muted-foreground hover:text-white focus-visible:text-white"
          >
            <ArrowLeft className="w-4 h-4" />
            Kembali ke Upload
          </Button>
        </div>

        <Card>
          <CardContent className="p-6 text-center">
            <div className="flex flex-col items-center gap-4">
              <RefreshCw className="w-8 h-8 animate-spin text-primary" />
              <div>
                <h3 className="font-semibold">Sedang Memproses</h3>
                <p className="text-muted-foreground">
                  {statusData?.progress_message || 'Dokumen sedang diproses...'}
                </p>
              </div>
              <Button
                variant="outline"
                onClick={() => window.location.reload()}
                size="sm"
              >
                Refresh Status
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!hasData || !formData) {
    return (
      <div className="p-6 space-y-6">
        <div className="flex items-center gap-3 mb-6">
          <Button
            variant="ghost"
            onClick={handleBack}
            className="flex items-center gap-2 text-muted-foreground hover:text-white focus-visible:text-white"
          >
            <ArrowLeft className="w-4 h-4" />
            Kembali ke Upload
          </Button>
        </div>

        <Card>
          <CardContent className="p-6 text-center">
            <div className="flex flex-col items-center gap-4">
              <AlertCircle className="w-8 h-8 text-orange-500" />
              <div>
                <h3 className="font-semibold">Data Tidak Tersedia</h3>
                <p className="text-muted-foreground">
                  Belum ada data ekstraksi yang dapat ditampilkan
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
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
          className="flex items-center gap-1.5 text-muted-foreground hover:text-foreground h-8"
        >
          <ArrowLeft className="w-4 h-4" />
          <span className="text-sm">Kembali</span>
        </Button>

        {/* Center - Filename */}
        <div className="flex items-center gap-2 flex-1 justify-center min-w-0">
          <FileText className="w-4 h-4 text-primary flex-shrink-0" />
          <span className="text-sm font-medium">
            {extractionData.filename}
          </span>
        </div>

        {/* Right - Badges */}
        <div className="flex items-center gap-2">
          <Badge
            variant="outline"
            className="text-emerald-600 border-emerald-300 bg-emerald-50 text-xs py-0.5 px-2"
          >
            <CheckCircle className="w-3 h-3 mr-1" />
            Siap Review
          </Badge>

          {statusData?.processing_time_seconds && (
            <Badge variant="secondary" className="text-xs py-0.5 px-2">
              <Clock className="w-3 h-3 mr-1" />
              {statusData.processing_time_seconds}s
            </Badge>
          )}

          <Badge variant="secondary" className="text-xs py-0.5 px-2">
            2 halaman
          </Badge>
        </div>
      </div>

      {/* Main Content - 2 Pane Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 flex-1 min-h-0 p-3">
        {/* Left Pane - PDF Preview */}
        <div className="h-full min-h-0">
          <PdfPreview
            jobId={numericJobId}
            className="h-full"
          />
        </div>

        {/* Right Pane - Extraction Form */}
        <div className="h-full min-h-0 overflow-y-auto">
          <ExtractionForm
            jobId={numericJobId}
            initialData={formData}
            onSave={(data) => {
              console.log('Form data saved:', data);
            }}
            onConfirm={() => {
              console.log('Form data confirmed');
            }}
            onDiscard={() => {
              console.log('Form data discarded');
            }}
          />
        </div>
      </div>
    </div>
  );
}
