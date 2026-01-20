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
import type { WitelResponse, WitelCreate } from '@/types/api';

interface CreateWitelModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: (witel: WitelResponse) => void;
}

export function CreateWitelModal({
  open,
  onOpenChange,
  onSuccess,
}: CreateWitelModalProps) {
  const [formData, setFormData] = React.useState({
    name: '',
    code: '',
    region: '',
  });
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [validationErrors, setValidationErrors] = React.useState<Record<string, string>>({});

  const resetForm = () => {
    setFormData({ name: '', code: '', region: '' });
    setValidationErrors({});
  };

  const handleSubmit = async () => {
    setValidationErrors({});

    // Simple validation
    const errors: Record<string, string> = {};
    if (!formData.name || formData.name.trim() === '') {
      errors.name = 'Nama Witel wajib diisi';
    }
    if (!formData.code || formData.code.trim() === '') {
      errors.code = 'Kode Witel wajib diisi';
    }

    if (Object.keys(errors).length > 0) {
      setValidationErrors(errors);
      return;
    }

    setIsSubmitting(true);
    try {
      const createData: WitelCreate = {
        name: formData.name.trim(),
        code: formData.code.trim(),
        region: formData.region && formData.region.trim() !== '' ? formData.region.trim() : undefined,
      };

      const newWitel = await apiService.createWitel(createData);
      toast.success('Witel berhasil dibuat');
      resetForm();
      onOpenChange(false);
      onSuccess(newWitel);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Gagal membuat Witel';
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
          <DialogTitle>Tambah Witel Baru</DialogTitle>
          <DialogDescription>
            Masukkan informasi Witel (Wilayah Telekomunikasi)
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="create-witel-code">Kode Witel *</Label>
            <Input
              id="create-witel-code"
              value={formData.code}
              onChange={(e) => setFormData({ ...formData, code: e.target.value })}
              placeholder="Contoh: WITEL-JKT, WITEL-BDG"
            />
            {validationErrors.code && (
              <p className="text-sm text-destructive">{validationErrors.code}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="create-witel-name">Nama Witel *</Label>
            <Input
              id="create-witel-name"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="Contoh: Jakarta, Bandung"
            />
            {validationErrors.name && (
              <p className="text-sm text-destructive">{validationErrors.name}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="create-witel-region">Region</Label>
            <Input
              id="create-witel-region"
              value={formData.region}
              onChange={(e) => setFormData({ ...formData, region: e.target.value })}
              placeholder="Contoh: Jawa Barat, DKI Jakarta (opsional)"
            />
            {validationErrors.region && (
              <p className="text-sm text-destructive">{validationErrors.region}</p>
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
