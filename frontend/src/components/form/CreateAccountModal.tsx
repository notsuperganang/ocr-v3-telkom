import * as React from 'react';
import { Loader2, Plus } from 'lucide-react';
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
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { apiService } from '@/services/api';
import type {
  AccountResponse,
  AccountCreate,
  SegmentResponse,
  WitelResponse,
  AccountManagerResponse,
  UserResponse,
} from '@/types/api';
import {
  accountCreateSchema,
  type AccountCreateInput,
} from '@/lib/masterDataValidation';
import { CreateSegmentModal } from '@/components/form/CreateSegmentModal';
import { CreateWitelModal } from '@/components/form/CreateWitelModal';
import { CreateAccountManagerModal } from '@/components/form/CreateAccountManagerModal';

interface CreateAccountModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: (account: AccountResponse) => void;
}

export function CreateAccountModal({
  open,
  onOpenChange,
  onSuccess,
}: CreateAccountModalProps) {
  // Form state
  const [formData, setFormData] = React.useState<AccountCreateInput>({
    name: '',
    account_number: '',
    nipnas: '',
    bus_area: '',
    segment_id: null,
    witel_id: null,
    account_manager_id: null,
    assigned_officer_id: null,
    notes: '',
  });

  // Master data for dropdowns
  const [segments, setSegments] = React.useState<SegmentResponse[]>([]);
  const [witels, setWitels] = React.useState<WitelResponse[]>([]);
  const [accountManagers, setAccountManagers] = React.useState<AccountManagerResponse[]>([]);
  const [assignedOfficers, setAssignedOfficers] = React.useState<UserResponse[]>([]);
  const [isLoadingMasterData, setIsLoadingMasterData] = React.useState(true);

  // Submit state
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [validationErrors, setValidationErrors] = React.useState<Record<string, string>>({});

  // Sub-modal states
  const [createSegmentModalOpen, setCreateSegmentModalOpen] = React.useState(false);
  const [createWitelModalOpen, setCreateWitelModalOpen] = React.useState(false);
  const [createAMModalOpen, setCreateAMModalOpen] = React.useState(false);

  // Load master data when modal opens
  React.useEffect(() => {
    if (open) {
      loadMasterData();
    }
  }, [open]);

  const loadMasterData = async () => {
    setIsLoadingMasterData(true);
    try {
      const [segmentsRes, witelsRes, amsRes, usersRes] = await Promise.all([
        apiService.listSegments(true),
        apiService.listWitels(true),
        apiService.listAccountManagers(1, 100, true),
        apiService.listUsers(1, 100, undefined, undefined, true),
      ]);
      setSegments(segmentsRes.segments);
      setWitels(witelsRes.witels);
      setAccountManagers(amsRes.account_managers);
      // Assigned officers are users from the users table
      setAssignedOfficers(usersRes.users);
    } catch (error) {
      console.error('Failed to load master data:', error);
      toast.error('Gagal memuat data master');
    } finally {
      setIsLoadingMasterData(false);
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      account_number: '',
      nipnas: '',
      bus_area: '',
      segment_id: null,
      witel_id: null,
      account_manager_id: null,
      assigned_officer_id: null,
      notes: '',
    });
    setValidationErrors({});
  };

  const handleSubmit = async () => {
    setValidationErrors({});

    // Validate using Zod
    const result = accountCreateSchema.safeParse(formData);
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
      const createData: AccountCreate = {
        account_number: result.data.account_number && result.data.account_number !== '' ? result.data.account_number : undefined,
        name: result.data.name,
        nipnas: result.data.nipnas && result.data.nipnas !== '' ? result.data.nipnas : undefined,
        bus_area: result.data.bus_area && result.data.bus_area !== '' ? result.data.bus_area : undefined,
        segment_id: result.data.segment_id || undefined,
        witel_id: result.data.witel_id || undefined,
        account_manager_id: result.data.account_manager_id || undefined,
        assigned_officer_id: result.data.assigned_officer_id || undefined,
        notes: result.data.notes && result.data.notes !== '' ? result.data.notes : undefined,
      };

      const newAccount = await apiService.createAccount(createData);
      toast.success('Akun berhasil dibuat');
      resetForm();
      onOpenChange(false);
      onSuccess(newAccount);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Gagal membuat akun';
      toast.error(errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle new segment created
  const handleSegmentCreated = (newSegment: SegmentResponse) => {
    setSegments((prev) => [...prev, newSegment]);
    setFormData({ ...formData, segment_id: newSegment.id });
  };

  // Handle new witel created
  const handleWitelCreated = (newWitel: WitelResponse) => {
    setWitels((prev) => [...prev, newWitel]);
    setFormData({ ...formData, witel_id: newWitel.id });
  };

  // Handle new AM created
  const handleAMCreated = (newAM: AccountManagerResponse) => {
    setAccountManagers((prev) => [...prev, newAM]);
    setFormData({ ...formData, account_manager_id: newAM.id });
  };

  const handleClose = () => {
    resetForm();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Tambah Akun Baru</DialogTitle>
          <DialogDescription>
            Masukkan informasi akun pelanggan baru
          </DialogDescription>
        </DialogHeader>

        {isLoadingMasterData ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : (
          <div className="grid gap-4 py-4">
            {/* Account Number & NIPNAS */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="create-account-number">Account Number</Label>
                <Input
                  id="create-account-number"
                  value={formData.account_number || ''}
                  onChange={(e) => setFormData({ ...formData, account_number: e.target.value })}
                  placeholder="ACC-XXX"
                />
                {validationErrors.account_number && (
                  <p className="text-sm text-destructive">{validationErrors.account_number}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="create-account-nipnas">NIPNAS</Label>
                <Input
                  id="create-account-nipnas"
                  value={formData.nipnas || ''}
                  onChange={(e) => setFormData({ ...formData, nipnas: e.target.value })}
                  placeholder="NIPNAS"
                />
                {validationErrors.nipnas && (
                  <p className="text-sm text-destructive">{validationErrors.nipnas}</p>
                )}
              </div>
            </div>

            {/* Name - Required */}
            <div className="space-y-2">
              <Label htmlFor="create-account-name">Nama Customer *</Label>
              <Input
                id="create-account-name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Nama lengkap customer"
              />
              {validationErrors.name && (
                <p className="text-sm text-destructive">{validationErrors.name}</p>
              )}
            </div>

            {/* Business Area */}
            <div className="space-y-2">
              <Label htmlFor="create-account-bus-area">Business Area</Label>
              <Input
                id="create-account-bus-area"
                value={formData.bus_area || ''}
                onChange={(e) => setFormData({ ...formData, bus_area: e.target.value })}
                placeholder="Business area"
              />
              {validationErrors.bus_area && (
                <p className="text-sm text-destructive">{validationErrors.bus_area}</p>
              )}
            </div>

            {/* Segment & Witel */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="create-account-segment">Segment</Label>
                <div className="flex gap-2">
                  <Select
                    value={formData.segment_id?.toString() || 'none'}
                    onValueChange={(value) => {
                      setFormData({
                        ...formData,
                        segment_id: value === 'none' ? null : parseInt(value)
                      });
                    }}
                  >
                    <SelectTrigger id="create-account-segment" className="flex-1">
                      <SelectValue placeholder="Tidak ada" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Tidak ada</SelectItem>
                      {segments.map((segment) => (
                        <SelectItem key={segment.id} value={segment.id.toString()}>
                          {segment.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={() => setCreateSegmentModalOpen(true)}
                    className="flex-shrink-0"
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="create-account-witel">Witel</Label>
                <div className="flex gap-2">
                  <Select
                    value={formData.witel_id?.toString() || 'none'}
                    onValueChange={(value) => {
                      setFormData({
                        ...formData,
                        witel_id: value === 'none' ? null : parseInt(value)
                      });
                    }}
                  >
                    <SelectTrigger id="create-account-witel" className="flex-1">
                      <SelectValue placeholder="Tidak ada" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Tidak ada</SelectItem>
                      {witels.map((witel) => (
                        <SelectItem key={witel.id} value={witel.id.toString()}>
                          {witel.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={() => setCreateWitelModalOpen(true)}
                    className="flex-shrink-0"
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>

            {/* Account Manager & Assigned Officer */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="create-account-am">Account Manager</Label>
                <div className="flex gap-2">
                  <Select
                    value={formData.account_manager_id?.toString() || 'none'}
                    onValueChange={(value) => {
                      setFormData({
                        ...formData,
                        account_manager_id: value === 'none' ? null : parseInt(value)
                      });
                    }}
                  >
                    <SelectTrigger id="create-account-am" className="flex-1">
                      <SelectValue placeholder="Tidak ada" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Tidak ada</SelectItem>
                      {accountManagers.map((am) => (
                        <SelectItem key={am.id} value={am.id.toString()}>
                          {am.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={() => setCreateAMModalOpen(true)}
                    className="flex-shrink-0"
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="create-account-officer">Assigned Officer</Label>
                <Select
                  value={formData.assigned_officer_id?.toString() || 'none'}
                  onValueChange={(value) => {
                    setFormData({
                      ...formData,
                      assigned_officer_id: value === 'none' ? null : parseInt(value)
                    });
                  }}
                >
                  <SelectTrigger id="create-account-officer">
                    <SelectValue placeholder="Tidak ada" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Tidak ada</SelectItem>
                    {assignedOfficers.map((officer) => (
                      <SelectItem key={officer.id} value={officer.id.toString()}>
                        {officer.full_name || officer.username}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Notes */}
            <div className="space-y-2">
              <Label htmlFor="create-account-notes">Catatan</Label>
              <Textarea
                id="create-account-notes"
                value={formData.notes || ''}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                placeholder="Catatan tambahan (opsional)"
                rows={3}
              />
              {validationErrors.notes && (
                <p className="text-sm text-destructive">{validationErrors.notes}</p>
              )}
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={isSubmitting}>
            Batal
          </Button>
          <Button onClick={handleSubmit} disabled={isSubmitting || isLoadingMasterData}>
            {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Simpan
          </Button>
        </DialogFooter>
      </DialogContent>

      {/* Sub-modals for creating related entities */}
      <CreateSegmentModal
        open={createSegmentModalOpen}
        onOpenChange={setCreateSegmentModalOpen}
        onSuccess={handleSegmentCreated}
      />

      <CreateWitelModal
        open={createWitelModalOpen}
        onOpenChange={setCreateWitelModalOpen}
        onSuccess={handleWitelCreated}
      />

      <CreateAccountManagerModal
        open={createAMModalOpen}
        onOpenChange={setCreateAMModalOpen}
        onSuccess={handleAMCreated}
      />
    </Dialog>
  );
}
