import { useParams, useNavigate } from 'react-router-dom';
import {
  FileText,
  Clock,
  ArrowLeft,
  RefreshCw,
  AlertCircle,
  CheckCircle,
  Download
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
              <span className="text-xs">Kembali ke Upload</span>
            </Button>

            <div className="flex items-center gap-2">
              <Badge
                variant="outline"
                className="text-blue-600 border-blue-600 text-xs py-0 px-1.5 h-5"
              >
                <CheckCircle className="w-2.5 h-2.5 mr-1" />
                Siap Review
              </Badge>

              {statusData?.processing_time_seconds && (
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Clock className="w-3 h-3" />
                  {statusData.processing_time_seconds}s
                </div>
              )}

              <Badge variant="secondary" className="text-xs py-0 px-1.5 h-5">2 halaman</Badge>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <FileText className="w-4 h-4 text-primary" />
            <div>
              <CardTitle className="text-base leading-tight">Review Data Ekstraksi</CardTitle>
              <p className="text-xs text-muted-foreground leading-tight">
                {extractionData.filename}
              </p>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Main Content - 2 Pane Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 h-[calc(100vh-140px)]">
        {/* Left Pane - PDF Preview */}
        <div className="h-full">
          <PdfPreview
            jobId={numericJobId}
            className="h-full"
          />
        </div>

        {/* Right Pane - Extraction Form */}
        <div className="h-full overflow-y-auto">
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

      {/* Footer Actions */}
      <Card>
        <CardContent className="p-2">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>💡 Klik "Simpan Draft" untuk menyimpan perubahan Anda</span>
            <Button
              variant="ghost"
              size="sm"
              className="flex items-center gap-1 text-xs h-7"
            >
              <Download className="w-3 h-3" />
              Export PDF
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
