import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  AlertCircle,
  RefreshCw
} from 'lucide-react';
import { apiService } from '@/services/api';

interface PdfPreviewProps {
  jobId: number;
  className?: string;
}

export function PdfPreview({ jobId, className }: PdfPreviewProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pdfBlob, setPdfBlob] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);

  // Retry function for failed loads
  const retryLoad = () => {
    setError(null);
    setIsLoading(true);
    setPdfBlob(null);
    setRetryCount(prev => prev + 1);
  };

  // Load PDF on mount
  React.useEffect(() => {
    async function loadPdf() {
      try {
        setIsLoading(true);
        setError(null);

        const blob = await apiService.getJobPdf(jobId);

        if (blob.size === 0) {
          throw new Error('Received empty PDF file');
        }

        const url = URL.createObjectURL(blob);
        setPdfBlob(url);
        setIsLoading(false);

      } catch (error) {
        setError(error instanceof Error ? error.message : 'Failed to load PDF');
        setIsLoading(false);
      }
    }

    loadPdf();

    // Cleanup blob URL on unmount
    return () => {
      if (pdfBlob) {
        URL.revokeObjectURL(pdfBlob);
      }
    };
  }, [jobId, retryCount]); // Re-run when jobId changes or when retrying

  // Handle iframe load error
  const handleIframeError = () => {
    setError('Failed to load PDF in browser viewer');
  };


  if (error) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertCircle className="w-5 h-5 text-red-500" />
            PDF Preview Error
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center gap-4 py-8">
            <p className="text-muted-foreground text-center">{error}</p>
            <Button variant="outline" onClick={retryLoad}>
              <RefreshCw className="w-4 h-4 mr-2" />
              Retry
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className={`${className} border border-gray-200 rounded-lg overflow-hidden bg-white dark:border-gray-700 dark:bg-gray-800`}>
      {isLoading ? (
        <div className="flex items-center justify-center h-64">
          <div className="flex items-center gap-3">
            <RefreshCw className="w-6 h-6 animate-spin text-primary" />
            <span>Loading PDF...</span>
          </div>
        </div>
      ) : pdfBlob ? (
        <iframe
          src={pdfBlob}
          className="w-full h-full border-0"
          title="PDF Preview"
          onError={handleIframeError}
        />
      ) : null}
    </div>
  );
}