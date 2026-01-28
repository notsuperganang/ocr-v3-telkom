import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { SearchableSelect, type SearchableSelectItem } from '@/components/ui/searchable-select';
import { Badge } from '@/components/ui/badge';
import { Loader2, FileText, Building2, X, Upload } from 'lucide-react';
import { apiService } from '@/services/api';

interface ManualEntryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ManualEntryDialog({ open, onOpenChange }: ManualEntryDialogProps) {
  const navigate = useNavigate();
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch accounts for the dropdown
  const { data: accountsData, isLoading: isLoadingAccounts } = useQuery({
    queryKey: ['accounts', 'manual-entry'],
    queryFn: async () => {
      const response = await apiService.listAccounts(1, 100, true);
      return response;
    },
    enabled: open, // Only fetch when dialog is open
    staleTime: 30000,
  });

  // Transform accounts to select items
  const accountItems: SearchableSelectItem[] = (accountsData?.accounts || []).map(account => ({
    value: account.id.toString(),
    label: account.name,
    searchText: `${account.account_number || ''} ${account.nipnas || ''}`.trim(),
  }));

  // Reset state when dialog closes
  useEffect(() => {
    if (!open) {
      setSelectedAccountId(null);
      setSelectedFile(null);
      setError(null);
    }
  }, [open]);

  const handleRemoveFile = () => {
    setSelectedFile(null);
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);
    setError(null);

    try {
      const accountId = selectedAccountId ? parseInt(selectedAccountId, 10) : undefined;
      const response = await apiService.createManualEntry(selectedFile || undefined, accountId);
      
      onOpenChange(false);
      navigate(`/review/${response.job_id}`);
    } catch (err: any) {
      setError(err.message || 'Gagal membuat entri manual');
    } finally {
      setIsSubmitting(false);
    }
  };

  const selectedAccount = accountsData?.accounts.find(
    acc => acc.id.toString() === selectedAccountId
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-primary" />
            Input Manual Kontrak
          </DialogTitle>
          <DialogDescription>
            Buat entri kontrak baru secara manual tanpa melalui proses OCR.
            Anda akan langsung diarahkan ke halaman validasi untuk mengisi data.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Account Selection */}
          <div className="space-y-2">
            <Label htmlFor="account" className="flex items-center gap-2">
              <Building2 className="w-4 h-4" />
              Pilih Account (Opsional)
            </Label>
            <SearchableSelect
              value={selectedAccountId}
              onValueChange={setSelectedAccountId}
              items={accountItems}
              placeholder="Pilih account untuk prefill data pelanggan..."
              searchPlaceholder="Cari nama atau nomor account..."
              emptyText="Tidak ada account ditemukan"
              clearLabel="-- Tanpa Prefill --"
              isLoading={isLoadingAccounts}
            />
            {selectedAccount && (
              <div className="text-sm text-muted-foreground p-2 bg-muted/50 rounded-md">
                <p>
                  <span className="font-medium">Nama:</span> {selectedAccount.name}
                </p>
                {selectedAccount.nipnas && (
                  <p>
                    <span className="font-medium">NIPNAS:</span> {selectedAccount.nipnas}
                  </p>
                )}
                {selectedAccount.segment && (
                  <p>
                    <span className="font-medium">Segment:</span> {selectedAccount.segment.name}
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Optional PDF Upload */}
          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <Upload className="w-4 h-4" />
              Upload PDF Referensi (Opsional)
            </Label>
            
            {!selectedFile ? (
              <div className="border-2 border-dashed rounded-lg p-6 text-center cursor-pointer hover:border-primary/50 transition-colors"
                onClick={() => document.getElementById('manual-entry-file-input')?.click()}
              >
                <input
                  id="manual-entry-file-input"
                  type="file"
                  accept=".pdf"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) setSelectedFile(file);
                  }}
                />
                <Upload className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">
                  Klik untuk memilih file PDF
                </p>
              </div>
            ) : (
              <div className="flex items-center justify-between p-3 border rounded-lg bg-muted/30">
                <div className="flex items-center gap-2">
                  <FileText className="w-5 h-5 text-primary" />
                  <div>
                    <p className="text-sm font-medium truncate max-w-[280px]">
                      {selectedFile.name}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
                    </p>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleRemoveFile}
                  className="h-8 w-8 p-0"
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>
            )}
            <p className="text-xs text-muted-foreground">
              File PDF akan tersedia sebagai referensi di halaman validasi
            </p>
          </div>

          {/* Info Badge */}
          <div className="flex items-start gap-2 p-3 bg-blue-50 border border-blue-200 rounded-lg">
            <Badge variant="secondary" className="bg-blue-100 text-blue-700 shrink-0">
              Info
            </Badge>
            <p className="text-sm text-blue-700">
              Setelah klik "Lanjutkan", Anda akan diarahkan ke halaman validasi dengan 
              layout yang sama seperti workflow standar. Semua aturan validasi tetap berlaku.
            </p>
          </div>

          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-sm text-red-600">{error}</p>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isSubmitting}
          >
            Batal
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={isSubmitting}
            className="gap-2"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Memproses...
              </>
            ) : (
              <>
                <FileText className="w-4 h-4" />
                Lanjutkan ke Validasi
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
