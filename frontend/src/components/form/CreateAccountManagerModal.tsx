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
import type { AccountManagerResponse, AccountManagerCreate } from '@/types/api';
import {
  accountManagerCreateSchema,
  type AccountManagerCreateInput,
} from '@/lib/masterDataValidation';

interface CreateAccountManagerModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: (manager: AccountManagerResponse) => void;
}

export function CreateAccountManagerModal({
  open,
  onOpenChange,
  onSuccess,
}: CreateAccountManagerModalProps) {
  // Form state
  const [formData, setFormData] = React.useState<AccountManagerCreateInput>({
    name: '',
    title: '',
    email: '',
    phone: '',
  });

  // Submit state
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [validationErrors, setValidationErrors] = React.useState<Record<string, string>>({});

  const resetForm = () => {
    setFormData({
      name: '',
      title: '',
      email: '',
      phone: '',
    });
    setValidationErrors({});
  };

  const handleSubmit = async () => {
    setValidationErrors({});

    // Validate using Zod
    const result = accountManagerCreateSchema.safeParse(formData);
    if (!result.success) {
      const errors: Record<string, string> = {};
      result.error.issues.forEach((issue) => {
        if (issue.path[0]) {
          errors[issue.path[0].toString()] = issue.message;
        }
      });
      setValidationErrors(errors);
      return;
    }

    setIsSubmitting(true);
    try {
      const createData: AccountManagerCreate = {
        name: result.data.name,
        title: result.data.title && result.data.title !== '' ? result.data.title : undefined,
        email: result.data.email && result.data.email !== '' ? result.data.email : undefined,
        phone: result.data.phone && result.data.phone !== '' ? result.data.phone : undefined,
      };

      const newManager = await apiService.createAccountManager(createData);
      toast.success('Account Manager berhasil dibuat');
      resetForm();
      onOpenChange(false);
      onSuccess(newManager);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Gagal membuat Account Manager';
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
          <DialogTitle>Tambah Account Manager Baru</DialogTitle>
          <DialogDescription>
            Masukkan informasi Account Manager baru
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          {/* Name - Required */}
          <div className="space-y-2">
            <Label htmlFor="create-am-name">Nama *</Label>
            <Input
              id="create-am-name"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="Nama lengkap"
            />
            {validationErrors.name && (
              <p className="text-sm text-destructive">{validationErrors.name}</p>
            )}
          </div>

          {/* Title */}
          <div className="space-y-2">
            <Label htmlFor="create-am-title">Jabatan</Label>
            <Input
              id="create-am-title"
              value={formData.title || ''}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              placeholder="Contoh: Senior Account Manager"
            />
            {validationErrors.title && (
              <p className="text-sm text-destructive">{validationErrors.title}</p>
            )}
          </div>

          {/* Email */}
          <div className="space-y-2">
            <Label htmlFor="create-am-email">Email</Label>
            <Input
              id="create-am-email"
              type="email"
              value={formData.email || ''}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              placeholder="email@telkom.co.id"
            />
            {validationErrors.email && (
              <p className="text-sm text-destructive">{validationErrors.email}</p>
            )}
          </div>

          {/* Phone */}
          <div className="space-y-2">
            <Label htmlFor="create-am-phone">Telepon</Label>
            <Input
              id="create-am-phone"
              type="tel"
              value={formData.phone || ''}
              onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              placeholder="081234567890"
            />
            {validationErrors.phone && (
              <p className="text-sm text-destructive">{validationErrors.phone}</p>
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
