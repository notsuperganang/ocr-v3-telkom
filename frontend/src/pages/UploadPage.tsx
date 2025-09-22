// Halaman upload file kontrak dengan drag & drop dan bulk upload
import { useState, useCallback, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import {
  Upload,
  FileText,
  AlertCircle,
  CheckCircle,
  Clock,
  X,
  RefreshCw,
  Eye
} from 'lucide-react';
import { apiService } from '@/services/api';

// Types untuk file upload
interface UploadFile {
  id: string;
  file: File;
  status: 'selected' | 'uploading' | 'processing' | 'awaiting_review' | 'completed' | 'failed';
  progress: number;
  jobId?: number;
  error?: string;
  uploadedAt?: Date;
  processingTime?: number;
}

const MAX_FILES = 5;
const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB
const ALLOWED_TYPES = ['application/pdf'];
const POLL_INTERVAL = 2000; // 2 detik

export function UploadPage() {
  const [files, setFiles] = useState<UploadFile[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const navigate = useNavigate();
  const pollingIntervals = useRef<Map<number, NodeJS.Timeout>>(new Map());

  // Format ukuran file
  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  // Validasi file
  const validateFile = (file: File): string | null => {
    if (!ALLOWED_TYPES.includes(file.type)) {
      return 'Hanya file PDF yang diperbolehkan';
    }
    if (file.size > MAX_FILE_SIZE) {
      return 'Ukuran file maksimal 50MB';
    }
    return null;
  };

  // Handle drag events
  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDragIn = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);

  const handleDragOut = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const droppedFiles = Array.from(e.dataTransfer.files);
    handleFileSelection(droppedFiles);
  }, []);

  // Handle file selection
  const handleFileSelection = (selectedFiles: File[]) => {
    const newFiles: UploadFile[] = [];

    selectedFiles.forEach((file) => {
      // Check total file limit
      if (files.length + newFiles.length >= MAX_FILES) {
        return;
      }

      // Check if file already exists
      const existingFile = files.find(f => f.file.name === file.name && f.file.size === file.size);
      if (existingFile) {
        return;
      }

      const error = validateFile(file);
      const uploadFile: UploadFile = {
        id: Date.now().toString() + Math.random().toString(36),
        file,
        status: error ? 'failed' : 'selected',
        progress: 0,
        error: error || undefined
      };

      newFiles.push(uploadFile);
    });

    setFiles(prev => [...prev, ...newFiles]);
  };

  // Handle file input change
  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      handleFileSelection(Array.from(e.target.files));
    }
  };

  // Remove file
  const removeFile = (fileId: string) => {
    setFiles(prev => prev.filter(f => f.id !== fileId));
  };

  // Get status badge
  const getStatusBadge = (status: UploadFile['status']) => {
    switch (status) {
      case 'selected':
        return <Badge variant="secondary">Siap Upload</Badge>;
      case 'uploading':
        return <Badge variant="default">Mengupload</Badge>;
      case 'processing':
        return <Badge variant="default" className="animate-pulse">Memproses</Badge>;
      case 'awaiting_review':
        return <Badge variant="outline" className="text-blue-600">Siap Review</Badge>;
      case 'completed':
        return <Badge variant="default" className="bg-green-600">Selesai</Badge>;
      case 'failed':
        return <Badge variant="destructive">Gagal</Badge>;
      default:
        return null;
    }
  };

  // Get status icon
  const getStatusIcon = (status: UploadFile['status']) => {
    switch (status) {
      case 'selected':
        return <Clock className="w-4 h-4 text-gray-500" />;
      case 'uploading':
        return <RefreshCw className="w-4 h-4 animate-spin text-blue-500" />;
      case 'processing':
        return <RefreshCw className="w-4 h-4 animate-spin text-blue-500" />;
      case 'awaiting_review':
        return <Eye className="w-4 h-4 text-blue-600" />;
      case 'completed':
        return <CheckCircle className="w-4 h-4 text-green-600" />;
      case 'failed':
        return <AlertCircle className="w-4 h-4 text-red-500" />;
      default:
        return <FileText className="w-4 h-4" />;
    }
  };

  // Get progress message
  const getProgressMessage = (file: UploadFile) => {
    switch (file.status) {
      case 'selected':
        return 'Siap untuk diupload';
      case 'uploading':
        return `Mengupload... ${file.progress}%`;
      case 'processing':
        return 'Sedang memproses dengan OCR...';
      case 'awaiting_review':
        return 'Siap untuk direview dan dikonfirmasi';
      case 'completed':
        return `Selesai ${file.processingTime ? `dalam ${file.processingTime}s` : ''}`;
      case 'failed':
        return file.error || 'Upload gagal';
      default:
        return '';
    }
  };

  // Poll job status
  const pollJobStatus = useCallback(async (jobId: number, fileId: string) => {
    try {
      const status = await apiService.getJobStatus(jobId);

      setFiles(prev => prev.map(file => {
        if (file.id === fileId) {
          let newStatus: UploadFile['status'] = 'processing';
          let progress = file.progress;

          switch (status.status) {
            case 'processing':
              newStatus = 'processing';
              progress = 50; // Show 50% when processing
              break;
            case 'awaiting_review':
              newStatus = 'awaiting_review';
              progress = 100;
              break;
            case 'completed':
              newStatus = 'completed';
              progress = 100;
              break;
            case 'failed':
              newStatus = 'failed';
              progress = 0;
              break;
          }

          return {
            ...file,
            status: newStatus,
            progress,
            error: status.error_message || file.error,
            processingTime: status.processing_time_seconds
          };
        }
        return file;
      }));

      // Stop polling if job is finished
      if (['awaiting_review', 'completed', 'failed'].includes(status.status)) {
        const interval = pollingIntervals.current.get(jobId);
        if (interval) {
          clearInterval(interval);
          pollingIntervals.current.delete(jobId);
        }
      }
    } catch (error) {
      console.error('Error polling job status:', error);
      // Stop polling on error
      const interval = pollingIntervals.current.get(jobId);
      if (interval) {
        clearInterval(interval);
        pollingIntervals.current.delete(jobId);
      }
    }
  }, []);

  // Start polling for a job
  const startPolling = useCallback((jobId: number, fileId: string) => {
    const interval = setInterval(() => {
      pollJobStatus(jobId, fileId);
    }, POLL_INTERVAL);

    pollingIntervals.current.set(jobId, interval);

    // Initial poll
    pollJobStatus(jobId, fileId);
  }, [pollJobStatus]);

  // Upload single file
  const uploadSingleFile = async (file: UploadFile): Promise<void> => {
    try {
      // Update status to uploading
      setFiles(prev => prev.map(f =>
        f.id === file.id
          ? { ...f, status: 'uploading', progress: 0 }
          : f
      ));

      // Simulate upload progress
      for (let progress = 0; progress <= 90; progress += 10) {
        setFiles(prev => prev.map(f =>
          f.id === file.id ? { ...f, progress } : f
        ));
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      // Upload file
      const response = await apiService.uploadFile(file.file);

      // Update with job info and start processing
      setFiles(prev => prev.map(f =>
        f.id === file.id
          ? {
              ...f,
              status: 'processing',
              progress: 100,
              jobId: response.job_id,
              uploadedAt: new Date()
            }
          : f
      ));

      // Start polling for this job
      startPolling(response.job_id, file.id);

    } catch (error: any) {
      setFiles(prev => prev.map(f =>
        f.id === file.id
          ? {
              ...f,
              status: 'failed',
              progress: 0,
              error: error.message || 'Upload gagal'
            }
          : f
      ));
    }
  };

  // Upload all selected files
  const handleBulkUpload = async () => {
    const selectedFiles = files.filter(f => f.status === 'selected');
    if (selectedFiles.length === 0) return;

    setIsUploading(true);

    try {
      // Upload files sequentially to avoid overwhelming the server
      for (const file of selectedFiles) {
        await uploadSingleFile(file);
        // Small delay between uploads
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    } catch (error) {
      console.error('Bulk upload error:', error);
    } finally {
      setIsUploading(false);
    }
  };

  // Cleanup intervals on unmount
  useEffect(() => {
    return () => {
      pollingIntervals.current.forEach(interval => clearInterval(interval));
      pollingIntervals.current.clear();
    };
  }, []);

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-foreground">Upload Kontrak</h1>
        <p className="text-muted-foreground">
          Upload file kontrak PDF untuk ekstraksi data otomatis (Maksimal 5 file)
        </p>
      </div>

      {/* Upload Area */}
      <div className="max-w-4xl">
        <Card>
          <CardHeader>
            <CardTitle>Upload File Kontrak</CardTitle>
            <CardDescription>
              Seret dan lepas file PDF atau klik untuk memilih. Maksimal 5 file per batch, 50MB per file.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {/* Drag & Drop Area */}
            <div
              className={`border-2 border-dashed rounded-lg p-12 text-center space-y-4 transition-colors ${
                isDragging
                  ? 'border-primary bg-primary/5'
                  : files.length >= MAX_FILES
                  ? 'border-gray-300 bg-gray-50'
                  : 'border-border hover:border-primary/50'
              }`}
              onDragEnter={handleDragIn}
              onDragLeave={handleDragOut}
              onDragOver={handleDrag}
              onDrop={handleDrop}
            >
              <div className="flex justify-center">
                <Upload className={`w-12 h-12 ${isDragging ? 'text-primary' : 'text-muted-foreground'}`} />
              </div>
              <div>
                <p className="text-lg font-medium text-foreground">
                  {files.length >= MAX_FILES
                    ? 'Batas maksimal 5 file tercapai'
                    : isDragging
                    ? 'Lepas file di sini'
                    : 'Seret dan lepas file PDF ke sini'
                  }
                </p>
                <p className="text-muted-foreground">atau</p>
              </div>
              <div>
                <input
                  type="file"
                  id="file-input"
                  multiple
                  accept=".pdf"
                  onChange={handleFileInputChange}
                  disabled={files.length >= MAX_FILES}
                  className="hidden"
                />
                <Button
                  asChild
                  disabled={files.length >= MAX_FILES}
                  variant={files.length >= MAX_FILES ? "secondary" : "default"}
                >
                  <label htmlFor="file-input" className="cursor-pointer">
                    {files.length >= MAX_FILES ? 'Batas Tercapai' : 'Pilih File'}
                  </label>
                </Button>
              </div>
              <div className="text-xs text-muted-foreground">
                Format yang didukung: PDF • Ukuran maksimal: 50MB per file • Maksimal: 5 file per batch
                <br />
                <span className="font-medium">
                  {files.length}/{MAX_FILES} file dipilih
                </span>
              </div>
            </div>

            {/* File List */}
            {files.length > 0 && (
              <div className="mt-6">
                <h3 className="font-medium text-foreground mb-4">File yang Dipilih ({files.length})</h3>
                <div className="space-y-3">
                  {files.map((file) => (
                    <div
                      key={file.id}
                      className="flex items-center gap-4 p-4 border border-border rounded-lg bg-card"
                    >
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        {getStatusIcon(file.status)}
                        <div className="flex-1 min-w-0">
                          <p className="font-medium truncate text-foreground">
                            {file.file.name}
                          </p>
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <span>{formatFileSize(file.file.size)}</span>
                            <span>•</span>
                            <span>{getProgressMessage(file)}</span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-3">
                        {getStatusBadge(file.status)}

                        {/* Progress Bar */}
                        {(file.status === 'uploading' || file.status === 'processing') && (
                          <div className="w-24">
                            <Progress value={file.progress} className="h-2" />
                          </div>
                        )}

                        {/* Remove Button */}
                        {file.status === 'selected' || file.status === 'failed' ? (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => removeFile(file.id)}
                            className="text-gray-500 hover:text-red-500"
                          >
                            <X className="w-4 h-4" />
                          </Button>
                        ) : null}

                        {/* View Button for completed files */}
                        {file.status === 'awaiting_review' && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => navigate(`/review/${file.jobId}`)}
                          >
                            Review
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Upload Actions */}
                <div className="flex gap-3 mt-6">
                  <Button
                    onClick={handleBulkUpload}
                    disabled={!files.some(f => f.status === 'selected') || isUploading}
                    className="flex items-center gap-2"
                  >
                    {isUploading ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        Mengupload...
                      </>
                    ) : (
                      <>
                        <Upload className="w-4 h-4" />
                        Upload Semua File
                      </>
                    )}
                  </Button>

                  <Button
                    variant="outline"
                    onClick={() => setFiles([])}
                    disabled={isUploading}
                  >
                    Hapus Semua
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Guidelines */}
        <Card className="mt-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertCircle className="w-5 h-5" />
              Panduan Pemrosesan
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <h4 className="font-medium text-foreground mb-2">Jenis Dokumen yang Didukung</h4>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>• Dokumen kontrak Telkom Indonesia (format K.TEL)</li>
                <li>• File PDF multi-halaman (halaman 1-2 akan diproses)</li>
                <li>• Dokumen dengan teks dan tabel yang jelas dan terbaca</li>
              </ul>
            </div>

            <div>
              <h4 className="font-medium text-foreground mb-2">Alur Pemrosesan</h4>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>1. File diupload dan masuk ke antrian pemrosesan</li>
                <li>2. Ekstraksi OCR dilakukan secara otomatis</li>
                <li>3. Data diekstrak dan siap untuk direview</li>
                <li>4. Anda dapat mengedit dan mengkonfirmasi data yang diekstrak</li>
                <li>5. Data yang dikonfirmasi disimpan sebagai record kontrak</li>
              </ul>
            </div>

            <div>
              <h4 className="font-medium text-foreground mb-2">Estimasi Waktu Pemrosesan</h4>
              <p className="text-sm text-muted-foreground">
                Setiap dokumen biasanya membutuhkan waktu 15-45 detik untuk diproses, tergantung ukuran file dan kompleksitas.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}