// Halaman review dan konfirmasi data hasil ekstraksi
import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  FileText,
  CheckCircle,
  AlertCircle,
  Clock,
  ArrowLeft,
  RefreshCw,
} from 'lucide-react';
import { apiService } from '@/services/api';

interface JobStatus {
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

interface ExtractedData {
  nomor_kontrak?: string;
  informasi_pelanggan?: {
    nama_pelanggan?: string;
    npwp?: string;
    alamat?: string;
  };
  layanan_utama?: {
    connectivity_telkom?: number;
    non_connectivity_telkom?: number;
    bundling?: number;
  };
  // Add more fields as needed
}

export function ProcessingPage() {
  const { jobId } = useParams<{ jobId: string }>();
  const navigate = useNavigate();
  const [jobStatus, setJobStatus] = useState<JobStatus | null>(null);
  const [extractedData, setExtractedData] = useState<ExtractedData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (jobId) {
      fetchJobData();
    }
  }, [jobId]);

  const fetchJobData = async () => {
    if (!jobId) return;

    try {
      setLoading(true);

      // Fetch job status and extracted data in parallel
      const [status, data] = await Promise.all([
        apiService.getJobStatus(parseInt(jobId)),
        apiService.getJobData(parseInt(jobId))
      ]);

      setJobStatus(status);
      setExtractedData(data.extracted_data || data.edited_data);

    } catch (err: any) {
      setError(err.message || 'Gagal memuat data job');
    } finally {
      setLoading(false);
    }
  };

  // Navigate to review page for detailed review and confirmation with account linkage
  const handleReview = () => {
    if (!jobId) return;
    navigate(`/review/${jobId}`);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'processing':
        return <Badge variant="default" className="animate-pulse">Memproses</Badge>;
      case 'awaiting_review':
        return <Badge variant="outline" className="text-blue-600">Siap Review</Badge>;
      case 'completed':
        return <Badge variant="default" className="bg-green-600">Selesai</Badge>;
      case 'failed':
        return <Badge variant="destructive">Gagal</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'processing':
        return <RefreshCw className="w-5 h-5 animate-spin text-blue-500" />;
      case 'awaiting_review':
        return <FileText className="w-5 h-5 text-blue-600" />;
      case 'completed':
        return <CheckCircle className="w-5 h-5 text-green-600" />;
      case 'failed':
        return <AlertCircle className="w-5 h-5 text-red-500" />;
      default:
        return <Clock className="w-5 h-5 text-gray-500" />;
    }
  };

  if (loading) {
    return (
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-center min-h-64">
          <div className="flex items-center gap-3">
            <RefreshCw className="w-6 h-6 animate-spin text-primary" />
            <span className="text-lg">Memuat data...</span>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 space-y-6">
        <div className="flex items-center gap-3 mb-6">
          <Button
            variant="ghost"
            onClick={() => navigate('/upload')}
            className="flex items-center gap-2"
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
                <p className="text-muted-foreground">{error}</p>
              </div>
            </div>
            <Button
              variant="outline"
              onClick={fetchJobData}
              className="mt-4"
            >
              Coba Lagi
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!jobStatus) {
    return (
      <div className="p-6 space-y-6">
        <Card>
          <CardContent className="p-6 text-center">
            <p>Data job tidak ditemukan</p>
            <Button
              variant="outline"
              onClick={() => navigate('/upload')}
              className="mt-4"
            >
              Kembali ke Upload
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header with navigation */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            onClick={() => navigate('/upload')}
            className="flex items-center gap-2"
          >
            <ArrowLeft className="w-4 h-4" />
            Kembali ke Upload
          </Button>
        </div>
      </div>

      {/* Job Status Card */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {getStatusIcon(jobStatus.status)}
              <div>
                <CardTitle>Status Pemrosesan</CardTitle>
                <CardDescription>
                  File: {jobStatus.filename}
                </CardDescription>
              </div>
            </div>
            {getStatusBadge(jobStatus.status)}
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Status:</span>
              <span>{jobStatus.progress_message}</span>
            </div>

            {jobStatus.processing_time_seconds && (
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Waktu Pemrosesan:</span>
                <span>{jobStatus.processing_time_seconds} detik</span>
              </div>
            )}

            {jobStatus.error_message && (
              <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-lg">
                <AlertCircle className="w-4 h-4 text-red-500 mt-0.5" />
                <div className="text-sm text-red-700">
                  <strong>Error:</strong> {jobStatus.error_message}
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Extracted Data Preview */}
      {jobStatus.status === 'awaiting_review' && extractedData && (
        <Card>
          <CardHeader>
            <CardTitle>Data Hasil Ekstraksi</CardTitle>
            <CardDescription>
              Review data yang telah diekstrak dari dokumen. Anda dapat mengedit jika diperlukan.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {/* Contract Number */}
              {extractedData.nomor_kontrak && (
                <div className="grid grid-cols-2 gap-4">
                  <div className="text-sm font-medium text-muted-foreground">Nomor Kontrak:</div>
                  <div className="text-sm font-mono">{extractedData.nomor_kontrak}</div>
                </div>
              )}

              {/* Customer Information */}
              {extractedData.informasi_pelanggan && (
                <div className="space-y-2">
                  <h4 className="font-medium">Informasi Pelanggan</h4>
                  <div className="grid grid-cols-2 gap-4 pl-4">
                    {extractedData.informasi_pelanggan.nama_pelanggan && (
                      <>
                        <div className="text-sm text-muted-foreground">Nama:</div>
                        <div className="text-sm">{extractedData.informasi_pelanggan.nama_pelanggan}</div>
                      </>
                    )}
                    {extractedData.informasi_pelanggan.npwp && (
                      <>
                        <div className="text-sm text-muted-foreground">NPWP:</div>
                        <div className="text-sm font-mono">{extractedData.informasi_pelanggan.npwp}</div>
                      </>
                    )}
                    {extractedData.informasi_pelanggan.alamat && (
                      <>
                        <div className="text-sm text-muted-foreground">Alamat:</div>
                        <div className="text-sm">{extractedData.informasi_pelanggan.alamat}</div>
                      </>
                    )}
                  </div>
                </div>
              )}

              {/* Services */}
              {extractedData.layanan_utama && (
                <div className="space-y-2">
                  <h4 className="font-medium">Layanan Utama</h4>
                  <div className="grid grid-cols-2 gap-4 pl-4">
                    <div className="text-sm text-muted-foreground">Connectivity Telkom:</div>
                    <div className="text-sm">{extractedData.layanan_utama.connectivity_telkom || 0}</div>
                    <div className="text-sm text-muted-foreground">Non-Connectivity Telkom:</div>
                    <div className="text-sm">{extractedData.layanan_utama.non_connectivity_telkom || 0}</div>
                    <div className="text-sm text-muted-foreground">Bundling:</div>
                    <div className="text-sm">{extractedData.layanan_utama.bundling || 0}</div>
                  </div>
                </div>
              )}

              {/* Show raw data if no specific fields are available */}
              {(!extractedData.nomor_kontrak && !extractedData.informasi_pelanggan && !extractedData.layanan_utama) && (
                <div className="text-sm text-muted-foreground">
                  <p>Data ekstraksi tersedia tetapi belum diformat untuk preview.</p>
                  <details className="mt-2">
                    <summary className="cursor-pointer">Lihat data mentah</summary>
                    <pre className="mt-2 p-2 bg-gray-50 rounded text-xs overflow-auto">
                      {JSON.stringify(extractedData, null, 2)}
                    </pre>
                  </details>
                </div>
              )}
            </div>

            {/* Action Buttons */}
            <div className="flex gap-3 mt-6 pt-4 border-t">
              <Button
                onClick={handleReview}
                className="flex items-center gap-2"
              >
                <FileText className="w-4 h-4" />
                Review & Konfirmasi
              </Button>

              <Button
                variant="outline"
                onClick={() => navigate('/upload')}
              >
                Kembali ke Upload
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* If still processing */}
      {jobStatus.status === 'processing' && (
        <Card>
          <CardContent className="p-6 text-center">
            <div className="flex flex-col items-center gap-4">
              <RefreshCw className="w-8 h-8 animate-spin text-primary" />
              <div>
                <h3 className="font-semibold">Sedang Memproses</h3>
                <p className="text-muted-foreground">
                  Dokumen sedang diproses dengan OCR. Harap tunggu...
                </p>
              </div>
              <Button
                variant="outline"
                onClick={fetchJobData}
                size="sm"
              >
                Refresh Status
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}