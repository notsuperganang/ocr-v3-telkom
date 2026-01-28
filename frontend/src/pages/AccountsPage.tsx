// Accounts Management Page
import * as React from 'react';
import { motion } from 'motion/react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { toast } from 'sonner';
import { apiService } from '@/services/api';
import type { 
  AccountResponse, 
  AccountCreate, 
  AccountUpdate,
  SegmentResponse,
  WitelResponse,
  AccountManagerResponse,
  UserResponse,
} from '@/types/api';
import {
  accountCreateSchema,
  accountUpdateSchema,
  type AccountCreateInput,
  type AccountUpdateInput,
} from '@/lib/masterDataValidation';
import { 
  Building2, 
  Plus, 
  Search, 
  MoreHorizontal, 
  Edit, 
  XCircle, 
  CheckCircle, 
  Loader2,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { twMerge } from 'tailwind-merge';

export function AccountsPage() {
  const { isManager, isStaff } = useAuth();
  const navigate = useNavigate();

  // Redirect if not staff/manager
  React.useEffect(() => {
    if (!isStaff && !isManager) {
      toast.error('Anda tidak memiliki akses ke halaman ini');
      navigate('/');
    }
  }, [isStaff, isManager, navigate]);

  // State
  const [accounts, setAccounts] = React.useState<AccountResponse[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [searchQuery, setSearchQuery] = React.useState('');
  const [activeFilter, setActiveFilter] = React.useState<'all' | 'active' | 'inactive'>('active');
  const [segmentFilter, setSegmentFilter] = React.useState<number | undefined>(undefined);
  const [witelFilter, setWitelFilter] = React.useState<number | undefined>(undefined);
  const [page, setPage] = React.useState(1);
  const [totalPages, setTotalPages] = React.useState(1);
  const [total, setTotal] = React.useState(0);

  // Master data for dropdowns
  const [segments, setSegments] = React.useState<SegmentResponse[]>([]);
  const [witels, setWitels] = React.useState<WitelResponse[]>([]);
  const [accountManagers, setAccountManagers] = React.useState<AccountManagerResponse[]>([]);
  const [users, setUsers] = React.useState<UserResponse[]>([]);

  // Dialog states
  const [createDialogOpen, setCreateDialogOpen] = React.useState(false);
  const [editDialogOpen, setEditDialogOpen] = React.useState(false);
  const [statusDialogOpen, setStatusDialogOpen] = React.useState(false);
  const [selectedAccount, setSelectedAccount] = React.useState<AccountResponse | null>(null);

  // Form states
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [validationErrors, setValidationErrors] = React.useState<Record<string, string>>({});

  // Create account form
  const [newAccount, setNewAccount] = React.useState<AccountCreateInput>({
    account_number: '',
    name: '',
    nipnas: '',
    bus_area: '',
    segment_id: null,
    witel_id: null,
    account_manager_id: null,
    assigned_officer_id: null,
    notes: '',
  });

  // Edit account form
  const [editData, setEditData] = React.useState<AccountUpdateInput>({});

  // Load master data for dropdowns
  const loadMasterData = async () => {
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
      setUsers(usersRes.users);
    } catch (error) {
      console.error('Failed to load master data:', error);
      toast.error('Gagal memuat data master: ' + (error instanceof Error ? error.message : 'Unknown error'));
    }
  };

  // Load accounts
  const loadAccounts = async () => {
    setIsLoading(true);
    try {
      const shouldFetchActive = activeFilter === 'active';
      const response = await apiService.listAccounts(
        page,
        20,
        shouldFetchActive,
        searchQuery || undefined,
        segmentFilter,
        witelFilter,
        undefined,
        undefined
      );
      
      // Filter on frontend if showing inactive or all
      let filteredAccounts = response.accounts;
      if (activeFilter === 'inactive') {
        filteredAccounts = response.accounts.filter(acc => !acc.is_active);
      }
      
      setAccounts(filteredAccounts);
      setTotal(activeFilter === 'inactive' ? filteredAccounts.length : response.total);
      setTotalPages(activeFilter === 'inactive' ? Math.ceil(filteredAccounts.length / 20) : response.total_pages);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Gagal memuat data account';
      toast.error(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  React.useEffect(() => {
    if (isStaff || isManager) {
      loadMasterData();
    }
  }, [isStaff, isManager]);

  React.useEffect(() => {
    if (isStaff || isManager) {
      loadAccounts();
    }
  }, [page, searchQuery, activeFilter, segmentFilter, witelFilter, isStaff, isManager]);

  // Handlers
  const handleCreateAccount = async () => {
    setValidationErrors({});
    
    // Validate using Zod
    const result = accountCreateSchema.safeParse(newAccount);
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
      await apiService.createAccount(createData);
      toast.success('Account berhasil dibuat');
      setCreateDialogOpen(false);
      setNewAccount({
        account_number: '',
        name: '',
        nipnas: '',
        bus_area: '',
        segment_id: null,
        witel_id: null,
        account_manager_id: null,
        assigned_officer_id: null,
        notes: '',
      });
      loadAccounts();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Gagal membuat account';
      toast.error(errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEditAccount = async () => {
    if (!selectedAccount) return;

    setValidationErrors({});

    // Validate using Zod
    const result = accountUpdateSchema.safeParse(editData);
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
      const updateData: AccountUpdate = {
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
      await apiService.updateAccount(selectedAccount.id, updateData);
      toast.success('Account berhasil diperbarui');
      setEditDialogOpen(false);
      setEditData({});
      setSelectedAccount(null);
      loadAccounts();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Gagal memperbarui account';
      toast.error(errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleToggleActive = async () => {
    if (!selectedAccount) return;

    setIsSubmitting(true);
    try {
      if (selectedAccount.is_active) {
        await apiService.deactivateAccount(selectedAccount.id);
        toast.success('Account berhasil dinonaktifkan');
      } else {
        await apiService.activateAccount(selectedAccount.id);
        toast.success('Account berhasil diaktifkan');
      }
      setStatusDialogOpen(false);
      setSelectedAccount(null);
      loadAccounts();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Gagal mengubah status account';
      toast.error(errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  };

  const openEditDialog = (account: AccountResponse) => {
    setSelectedAccount(account);
    setEditData({
      account_number: account.account_number || '',
      name: account.name,
      nipnas: account.nipnas || '',
      bus_area: account.bus_area || '',
      segment_id: account.segment?.id || null,
      witel_id: account.witel?.id || null,
      account_manager_id: account.account_manager?.id || null,
      assigned_officer_id: account.assigned_officer?.id || null,
      notes: account.notes || '',
    });
    setValidationErrors({});
    setEditDialogOpen(true);
  };

  const openStatusDialog = (account: AccountResponse) => {
    setSelectedAccount(account);
    setStatusDialogOpen(true);
  };

  if (!isStaff && !isManager) {
    return null;
  }

  return (
    <div className="h-full w-full">
      <motion.div
        className="mx-auto max-w-7xl space-y-6"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div
              className={twMerge(
                'flex size-14 items-center justify-center rounded-2xl border border-border/60 bg-gradient-to-br from-[#d71920]/10 to-transparent shadow-inner'
              )}
            >
              <Building2 className="size-7 text-[#d71920]" aria-hidden="true" />
            </div>
            <div>
              <h1 className="text-3xl font-bold tracking-tight">Manajemen Akun</h1>
              <p className="text-muted-foreground">
                Kelola data customer dan akun Telkom
              </p>
            </div>
          </div>
          {(isManager || isStaff) && (
            <Button onClick={() => setCreateDialogOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Tambah Account
            </Button>
          )}
        </div>

        {/* Filters */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Search className="h-5 w-5" />
              Pencarian & Filter
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              {/* Search */}
              <div className="space-y-2">
                <Label htmlFor="search">Cari Account</Label>
                <Input
                  id="search"
                  placeholder="Nama atau account number..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>

              {/* Status Filter */}
              <div className="space-y-2">
                <Label htmlFor="status-filter">Filter Status</Label>
                <Select value={activeFilter} onValueChange={(value: 'all' | 'active' | 'inactive') => setActiveFilter(value)}>
                  <SelectTrigger id="status-filter">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Hanya Aktif</SelectItem>
                    <SelectItem value="inactive">Hanya Nonaktif</SelectItem>
                    <SelectItem value="all">Semua Status</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Segment Filter */}
              <div className="space-y-2">
                <Label htmlFor="segment-filter">Filter Segment</Label>
                <Select
                  value={segmentFilter?.toString() || 'all'}
                  onValueChange={(value) => {
                    setSegmentFilter(value === 'all' ? undefined : parseInt(value));
                    setPage(1);
                  }}
                >
                  <SelectTrigger id="segment-filter">
                    <SelectValue placeholder="Semua Segment" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Semua Segment</SelectItem>
                    {segments.map((segment) => (
                      <SelectItem key={segment.id} value={segment.id.toString()}>
                        {segment.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Witel Filter */}
              <div className="space-y-2">
                <Label htmlFor="witel-filter">Filter Witel</Label>
                <Select
                  value={witelFilter?.toString() || 'all'}
                  onValueChange={(value) => {
                    setWitelFilter(value === 'all' ? undefined : parseInt(value));
                    setPage(1);
                  }}
                >
                  <SelectTrigger id="witel-filter">
                    <SelectValue placeholder="Semua Witel" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Semua Witel</SelectItem>
                    {witels.map((witel) => (
                      <SelectItem key={witel.id} value={witel.id.toString()}>
                        {witel.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Table */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5" />
              Daftar Account
            </CardTitle>
            <CardDescription>
              Total: {total} Account
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : accounts.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                Tidak ada account ditemukan
              </div>
            ) : (
              <>
                <div className="rounded-md border overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Account Number</TableHead>
                        <TableHead>Nama Customer</TableHead>
                        <TableHead>NIPNAS</TableHead>
                        <TableHead>Segment</TableHead>
                        <TableHead>Witel</TableHead>
                        <TableHead>Account Manager</TableHead>
                        <TableHead>Petugas</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Aksi</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {accounts.map((account) => (
                        <TableRow key={account.id}>
                          <TableCell className="font-medium">
                            {account.account_number || '-'}
                          </TableCell>
                          <TableCell>{account.name}</TableCell>
                          <TableCell className="font-mono">{account.nipnas || '-'}</TableCell>
                          <TableCell>
                            {account.segment ? (
                              <Badge variant="outline">{account.segment.name}</Badge>
                            ) : (
                              '-'
                            )}
                          </TableCell>
                          <TableCell>
                            {account.witel ? (
                              <Badge variant="outline">{account.witel.name}</Badge>
                            ) : (
                              '-'
                            )}
                          </TableCell>
                          <TableCell>
                            {account.account_manager?.name || '-'}
                          </TableCell>
                          <TableCell>
                            {account.assigned_officer ? (
                              <span className="text-sm">
                                {account.assigned_officer.full_name || account.assigned_officer.username}
                              </span>
                            ) : (
                              '-'
                            )}
                          </TableCell>
                          <TableCell>
                            <Badge variant={account.is_active ? 'default' : 'secondary'}>
                              {account.is_active ? 'Aktif' : 'Nonaktif'}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            {(isManager || isStaff) && (
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button variant="ghost" size="icon">
                                    <MoreHorizontal className="h-4 w-4" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                  <DropdownMenuItem onClick={() => openEditDialog(account)}>
                                    <Edit className="mr-2 h-4 w-4" />
                                    Edit
                                  </DropdownMenuItem>
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem onClick={() => openStatusDialog(account)}>
                                    {account.is_active ? (
                                      <>
                                        <XCircle className="mr-2 h-4 w-4" />
                                        Nonaktifkan
                                      </>
                                    ) : (
                                      <>
                                        <CheckCircle className="mr-2 h-4 w-4" />
                                        Aktifkan
                                      </>
                                    )}
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>

                {/* Pagination */}
                {totalPages > 1 && (
                  <div className="flex items-center justify-between px-2 py-4">
                    <div className="text-sm text-muted-foreground">
                      Halaman {page} dari {totalPages} ({total} total)
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setPage(page - 1)}
                        disabled={page === 1}
                      >
                        <ChevronLeft className="h-4 w-4 mr-1" />
                        Sebelumnya
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setPage(page + 1)}
                        disabled={page >= totalPages}
                      >
                        Selanjutnya
                        <ChevronRight className="h-4 w-4 ml-1" />
                      </Button>
                    </div>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>
      </motion.div>

      {/* Create Dialog */}
      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Tambah Account Baru</DialogTitle>
            <DialogDescription>
              Masukkan informasi account yang akan ditambahkan
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="new-account-number">Account Number</Label>
                <Input
                  id="new-account-number"
                  value={newAccount.account_number || ''}
                  onChange={(e) => setNewAccount({ ...newAccount, account_number: e.target.value })}
                  placeholder="ACC-XXX"
                />
                {validationErrors.account_number && (
                  <p className="text-sm text-destructive">{validationErrors.account_number}</p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="new-nipnas">NIPNAS</Label>
                <Input
                  id="new-nipnas"
                  value={newAccount.nipnas || ''}
                  onChange={(e) => setNewAccount({ ...newAccount, nipnas: e.target.value })}
                  placeholder="NIPNAS"
                />
                {validationErrors.nipnas && (
                  <p className="text-sm text-destructive">{validationErrors.nipnas}</p>
                )}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="new-name">Nama Customer *</Label>
              <Input
                id="new-name"
                value={newAccount.name}
                onChange={(e) => setNewAccount({ ...newAccount, name: e.target.value })}
                placeholder="Nama lengkap customer"
              />
              {validationErrors.name && (
                <p className="text-sm text-destructive">{validationErrors.name}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="new-bus-area">Business Area</Label>
              <Input
                id="new-bus-area"
                value={newAccount.bus_area || ''}
                onChange={(e) => setNewAccount({ ...newAccount, bus_area: e.target.value })}
                placeholder="Business area"
              />
              {validationErrors.bus_area && (
                <p className="text-sm text-destructive">{validationErrors.bus_area}</p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="new-segment">Segment</Label>
                <Select
                  value={newAccount.segment_id?.toString() || 'none'}
                  onValueChange={(value) => {
                    setNewAccount({ 
                      ...newAccount, 
                      segment_id: value === 'none' ? null : parseInt(value) 
                    });
                  }}
                >
                  <SelectTrigger id="new-segment">
                    <SelectValue placeholder="Pilih segment" />
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
              </div>

              <div className="space-y-2">
                <Label htmlFor="new-witel">Witel</Label>
                <Select
                  value={newAccount.witel_id?.toString() || 'none'}
                  onValueChange={(value) => {
                    setNewAccount({ 
                      ...newAccount, 
                      witel_id: value === 'none' ? null : parseInt(value) 
                    });
                  }}
                >
                  <SelectTrigger id="new-witel">
                    <SelectValue placeholder="Pilih witel" />
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
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="new-am">Account Manager</Label>
                <Select
                  value={newAccount.account_manager_id?.toString() || 'none'}
                  onValueChange={(value) => {
                    setNewAccount({ 
                      ...newAccount, 
                      account_manager_id: value === 'none' ? null : parseInt(value) 
                    });
                  }}
                >
                  <SelectTrigger id="new-am">
                    <SelectValue placeholder="Pilih Account Manager" />
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
              </div>

              <div className="space-y-2">
                <Label htmlFor="new-officer">Assigned Officer</Label>
                <Select
                  value={newAccount.assigned_officer_id?.toString() || 'none'}
                  onValueChange={(value) => {
                    setNewAccount({ 
                      ...newAccount, 
                      assigned_officer_id: value === 'none' ? null : parseInt(value) 
                    });
                  }}
                >
                  <SelectTrigger id="new-officer">
                    <SelectValue placeholder="Pilih officer" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Tidak ada</SelectItem>
                    {users.map((user) => (
                      <SelectItem key={user.id} value={user.id.toString()}>
                        {user.full_name || user.username}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="new-notes">Catatan</Label>
              <Textarea
                id="new-notes"
                value={newAccount.notes || ''}
                onChange={(e) => setNewAccount({ ...newAccount, notes: e.target.value })}
                placeholder="Catatan tambahan (opsional)"
                rows={3}
              />
              {validationErrors.notes && (
                <p className="text-sm text-destructive">{validationErrors.notes}</p>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateDialogOpen(false)} disabled={isSubmitting}>
              Batal
            </Button>
            <Button onClick={handleCreateAccount} disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Simpan
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Account</DialogTitle>
            <DialogDescription>
              Perbarui informasi account
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="edit-account-number">Account Number</Label>
                <Input
                  id="edit-account-number"
                  value={editData.account_number || ''}
                  onChange={(e) => setEditData({ ...editData, account_number: e.target.value })}
                  placeholder="ACC-XXX"
                />
                {validationErrors.account_number && (
                  <p className="text-sm text-destructive">{validationErrors.account_number}</p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-nipnas">NIPNAS</Label>
                <Input
                  id="edit-nipnas"
                  value={editData.nipnas || ''}
                  onChange={(e) => setEditData({ ...editData, nipnas: e.target.value })}
                  placeholder="NIPNAS"
                />
                {validationErrors.nipnas && (
                  <p className="text-sm text-destructive">{validationErrors.nipnas}</p>
                )}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-name">Nama Customer *</Label>
              <Input
                id="edit-name"
                value={editData.name || ''}
                onChange={(e) => setEditData({ ...editData, name: e.target.value })}
                placeholder="Nama lengkap customer"
              />
              {validationErrors.name && (
                <p className="text-sm text-destructive">{validationErrors.name}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-bus-area">Business Area</Label>
              <Input
                id="edit-bus-area"
                value={editData.bus_area || ''}
                onChange={(e) => setEditData({ ...editData, bus_area: e.target.value })}
                placeholder="Business area"
              />
              {validationErrors.bus_area && (
                <p className="text-sm text-destructive">{validationErrors.bus_area}</p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="edit-segment">Segment</Label>
                <Select
                  value={editData.segment_id?.toString() || 'none'}
                  onValueChange={(value) => {
                    setEditData({ 
                      ...editData, 
                      segment_id: value === 'none' ? null : parseInt(value) 
                    });
                  }}
                >
                  <SelectTrigger id="edit-segment">
                    <SelectValue placeholder="Pilih segment" />
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
              </div>

              <div className="space-y-2">
                <Label htmlFor="edit-witel">Witel</Label>
                <Select
                  value={editData.witel_id?.toString() || 'none'}
                  onValueChange={(value) => {
                    setEditData({ 
                      ...editData, 
                      witel_id: value === 'none' ? null : parseInt(value) 
                    });
                  }}
                >
                  <SelectTrigger id="edit-witel">
                    <SelectValue placeholder="Pilih witel" />
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
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="edit-am">Account Manager</Label>
                <Select
                  value={editData.account_manager_id?.toString() || 'none'}
                  onValueChange={(value) => {
                    setEditData({ 
                      ...editData, 
                      account_manager_id: value === 'none' ? null : parseInt(value) 
                    });
                  }}
                >
                  <SelectTrigger id="edit-am">
                    <SelectValue placeholder="Pilih Account Manager" />
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
              </div>

              <div className="space-y-2">
                <Label htmlFor="edit-officer">Assigned Officer</Label>
                <Select
                  value={editData.assigned_officer_id?.toString() || 'none'}
                  onValueChange={(value) => {
                    setEditData({ 
                      ...editData, 
                      assigned_officer_id: value === 'none' ? null : parseInt(value) 
                    });
                  }}
                >
                  <SelectTrigger id="edit-officer">
                    <SelectValue placeholder="Pilih officer" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Tidak ada</SelectItem>
                    {users.map((user) => (
                      <SelectItem key={user.id} value={user.id.toString()}>
                        {user.full_name || user.username}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-notes">Catatan</Label>
              <Textarea
                id="edit-notes"
                value={editData.notes || ''}
                onChange={(e) => setEditData({ ...editData, notes: e.target.value })}
                placeholder="Catatan tambahan (opsional)"
                rows={3}
              />
              {validationErrors.notes && (
                <p className="text-sm text-destructive">{validationErrors.notes}</p>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialogOpen(false)} disabled={isSubmitting}>
              Batal
            </Button>
            <Button onClick={handleEditAccount} disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Simpan
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Status Toggle Dialog */}
      <AlertDialog open={statusDialogOpen} onOpenChange={setStatusDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {selectedAccount?.is_active ? 'Nonaktifkan' : 'Aktifkan'} Account?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Apakah Anda yakin ingin {selectedAccount?.is_active ? 'menonaktifkan' : 'mengaktifkan'} account{' '}
              <strong>{selectedAccount?.name}</strong>?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isSubmitting}>Batal</AlertDialogCancel>
            <AlertDialogAction onClick={handleToggleActive} disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Ya, {selectedAccount?.is_active ? 'Nonaktifkan' : 'Aktifkan'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
