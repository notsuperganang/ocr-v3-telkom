import * as React from 'react';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { apiService } from '@/services/api';
import type { SegmentResponse, SegmentCreate } from '@/types/api';

interface CreateSegmentModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: (segment: SegmentResponse) => void;
}

export function CreateSegmentModal({
  open,
  onOpenChange,
  onSuccess,
}: CreateSegmentModalProps) {
  const [formData, setFormData] = React.useState({
    name: '',
    code: '',
  });
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [validationErrors, setValidationErrors] = React.useState<Record<string, string>>({});

  const resetForm = () => {
    setFormData({ name: '', code: '' });
    setValidationErrors({});
  };

  const handleSubmit = async () => {
    setValidationErrors({});

    // Simple validation
    const errors: Record<string, string> = {};
    if (!formData.name || formData.name.trim() === '') {
      errors.name = 'Nama segment wajib diisi';
    }

    if (Object.keys(errors).length > 0) {
      setValidationErrors(errors);
      return;
    }

    setIsSubmitting(true);
    try {
      const createData: SegmentCreate = {
        name: formData.name.trim(),
        code: formData.code && formData.code.trim() !== '' ? formData.code.trim() : undefined,
      };

      const newSegment = await apiService.createSegment(createData);
      toast.success('Segment berhasil dibuat');
      resetForm();
      onOpenChange(false);
      onSuccess(newSegment);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Gagal membuat segment';
      toast.error(errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    resetForm();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Tambah Segment Baru</DialogTitle>
          <DialogDescription>
            Masukkan informasi segment pelanggan
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="create-segment-name">Nama Segment *</Label>
            <Input
              id="create-segment-name"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="Contoh: Enterprise, SME, Consumer"
            />
            {validationErrors.name && (
              <p className="text-sm text-destructive">{validationErrors.name}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="create-segment-code">Kode Segment</Label>
            <Input
              id="create-segment-code"
              value={formData.code}
              onChange={(e) => setFormData({ ...formData, code: e.target.value })}
              placeholder="Contoh: ENT, SME, CONS (opsional)"
            />
            {validationErrors.code && (
              <p className="text-sm text-destructive">{validationErrors.code}</p>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={isSubmitting}>
            Batal
          </Button>
          <Button onClick={handleSubmit} disabled={isSubmitting}>
            {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Simpan
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
