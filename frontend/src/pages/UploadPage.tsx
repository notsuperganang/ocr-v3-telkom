// File upload page for contract processing
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Upload, FileText, AlertCircle } from 'lucide-react';

export function UploadPage() {
  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-foreground">Upload Contracts</h1>
        <p className="text-muted-foreground">
          Upload PDF contract files for automatic data extraction
        </p>
      </div>

      {/* Upload Area */}
      <div className="max-w-4xl">
        <Card>
          <CardHeader>
            <CardTitle>Upload Files</CardTitle>
            <CardDescription>
              Select PDF files to upload for processing. Maximum 10 files per batch, 50MB per file.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="border-2 border-dashed border-border rounded-lg p-12 text-center space-y-4">
              <div className="flex justify-center">
                <Upload className="w-12 h-12 text-muted-foreground" />
              </div>
              <div>
                <p className="text-lg font-medium text-foreground">Drag and drop files here</p>
                <p className="text-muted-foreground">or</p>
              </div>
              <Button>
                Browse Files
              </Button>
              <div className="text-xs text-muted-foreground">
                Supported formats: PDF • Maximum size: 50MB per file • Maximum: 10 files per batch
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Processing Guidelines */}
        <Card className="mt-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertCircle className="w-5 h-5" />
              Processing Guidelines
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <h4 className="font-medium text-foreground mb-2">Supported Document Types</h4>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>• Indonesian Telkom contract documents (K.TEL format)</li>
                <li>• Multi-page PDF files (first 2 pages will be processed)</li>
                <li>• Documents with clear, readable text and tables</li>
              </ul>
            </div>
            
            <div>
              <h4 className="font-medium text-foreground mb-2">Processing Workflow</h4>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>1. Files are uploaded and queued for processing</li>
                <li>2. OCR extraction is performed automatically</li>
                <li>3. Data is extracted and made available for review</li>
                <li>4. You can edit and confirm the extracted data</li>
                <li>5. Confirmed data is saved as a contract record</li>
              </ul>
            </div>

            <div>
              <h4 className="font-medium text-foreground mb-2">Expected Processing Time</h4>
              <p className="text-sm text-muted-foreground">
                Each document typically takes 15-30 seconds to process, depending on file size and complexity.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Recent Uploads */}
        <Card className="mt-6">
          <CardHeader>
            <CardTitle>Recent Uploads</CardTitle>
            <CardDescription>
              Track the status of your recently uploaded files
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center gap-4 p-3 bg-muted/30 rounded-lg">
                <FileText className="w-8 h-8 text-muted-foreground" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">No recent uploads</p>
                  <p className="text-xs text-muted-foreground">Upload files to track their processing status</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}