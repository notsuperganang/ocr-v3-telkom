// Account Managers Management Page
import * as React from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
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
import type { AccountManagerResponse, AccountManagerCreate, AccountManagerUpdate } from '@/types/api';
import {
  accountManagerCreateSchema,
  accountManagerUpdateSchema,
  type AccountManagerCreateInput,
  type AccountManagerUpdateInput,
} from '@/lib/masterDataValidation';
import { UserCog, Plus, Search, MoreHorizontal, Edit, XCircle, CheckCircle, Loader2, ChevronLeft, ChevronRight, Mail, Phone } from 'lucide-react';
import { format } from 'date-fns';
import { id } from 'date-fns/locale';

export function AccountManagersPage() {
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
  const [accountManagers, setAccountManagers] = React.useState<AccountManagerResponse[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [searchQuery, setSearchQuery] = React.useState('');
  const [activeFilter, setActiveFilter] = React.useState<'all' | 'active' | 'inactive'>('active');
  const [page, setPage] = React.useState(1);
  const [totalPages, setTotalPages] = React.useState(1);
  const [total, setTotal] = React.useState(0);

  // Dialog states
  const [createDialogOpen, setCreateDialogOpen] = React.useState(false);
  const [editDialogOpen, setEditDialogOpen] = React.useState(false);
  const [statusDialogOpen, setStatusDialogOpen] = React.useState(false);
  const [selectedAccountManager, setSelectedAccountManager] = React.useState<AccountManagerResponse | null>(null);

  // Form states
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [validationErrors, setValidationErrors] = React.useState<Record<string, string>>({});

  // Create account manager form
  const [newAccountManager, setNewAccountManager] = React.useState<AccountManagerCreateInput>({
    name: '',
    title: '',
    email: '',
    phone: '',
  });

  // Edit account manager form
  const [editData, setEditData] = React.useState<AccountManagerUpdateInput>({});

  // Load account managers
  const loadAccountManagers = async () => {
    setIsLoading(true);
    try {
      // Fetch based on filter - if 'all' or 'inactive', get all; if 'active', get only active
      const shouldFetchAll = activeFilter === 'all' || activeFilter === 'inactive';
      const response = await apiService.listAccountManagers(
        page,
        20,
        !shouldFetchAll,
        searchQuery || undefined
      );
      
      // Filter on frontend if showing inactive only
      let filteredAccountManagers = response.account_managers;
      if (activeFilter === 'inactive') {
        filteredAccountManagers = response.account_managers.filter(am => !am.is_active);
      }
      
      setAccountManagers(filteredAccountManagers);
      setTotal(response.total);
      setTotalPages(response.total_pages);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Gagal memuat data Account Manager';
      toast.error(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  React.useEffect(() => {
    if (isStaff || isManager) {
      loadAccountManagers();
    }
  }, [page, searchQuery, activeFilter, isStaff, isManager]);

  // Handlers
  const handleCreateAccountManager = async () => {
    setValidationErrors({});
    
    // Validate using Zod
    const result = accountManagerCreateSchema.safeParse(newAccountManager);
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
      await apiService.createAccountManager(createData);
      toast.success('Account Manager berhasil dibuat');
      setCreateDialogOpen(false);
      setNewAccountManager({ name: '', title: '', email: '', phone: '' });
      loadAccountManagers();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Gagal membuat Account Manager';
      toast.error(errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEditAccountManager = async () => {
    if (!selectedAccountManager) return;

    setValidationErrors({});

    // Validate using Zod
    const result = accountManagerUpdateSchema.safeParse(editData);
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
      const updateData: AccountManagerUpdate = {
        name: result.data.name,
        title: result.data.title && result.data.title !== '' ? result.data.title : undefined,
        email: result.data.email && result.data.email !== '' ? result.data.email : undefined,
        phone: result.data.phone && result.data.phone !== '' ? result.data.phone : undefined,
      };
      await apiService.updateAccountManager(selectedAccountManager.id, updateData);
      toast.success('Account Manager berhasil diperbarui');
      setEditDialogOpen(false);
      setEditData({});
      setSelectedAccountManager(null);
      loadAccountManagers();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Gagal memperbarui Account Manager';
      toast.error(errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleToggleActive = async () => {
    if (!selectedAccountManager) return;

    setIsSubmitting(true);
    try {
      if (selectedAccountManager.is_active) {
        await apiService.deactivateAccountManager(selectedAccountManager.id);
        toast.success('Account Manager berhasil dinonaktifkan');
      } else {
        await apiService.activateAccountManager(selectedAccountManager.id);
        toast.success('Account Manager berhasil diaktifkan');
      }
      setStatusDialogOpen(false);
      setSelectedAccountManager(null);
      loadAccountManagers();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Gagal mengubah status Account Manager';
      toast.error(errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  };

  const openEditDialog = (accountManager: AccountManagerResponse) => {
    setSelectedAccountManager(accountManager);
    setEditData({
      name: accountManager.name,
      title: accountManager.title || '',
      email: accountManager.email || '',
      phone: accountManager.phone || '',
    });
    setValidationErrors({});
    setEditDialogOpen(true);
  };

  const openStatusDialog = (accountManager: AccountManagerResponse) => {
    setSelectedAccountManager(accountManager);
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
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Manajemen Account Manager</h1>
            <p className="text-muted-foreground">
              Kelola data Account Manager Telkom
            </p>
          </div>
          {isManager && (
            <Button onClick={() => setCreateDialogOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Tambah Account Manager
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
            <div className="grid gap-4 md:grid-cols-2">
              {/* Search */}
              <div className="space-y-2">
                <Label htmlFor="search">Cari Account Manager</Label>
                <Input
                  id="search"
                  placeholder="Nama, email, atau telepon..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>

              {/* Active Filter */}
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
            </div>
          </CardContent>
        </Card>

        {/* Table */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <UserCog className="h-5 w-5" />
              Daftar Account Manager
            </CardTitle>
            <CardDescription>
              Total: {total} Account Manager
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : accountManagers.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                Tidak ada Account Manager ditemukan
              </div>
            ) : (
              <>
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Nama</TableHead>
                        <TableHead>Jabatan</TableHead>
                        <TableHead>Email</TableHead>
                        <TableHead>Telepon</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Dibuat</TableHead>
                        <TableHead className="text-right">Aksi</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {accountManagers.map((am) => (
                        <TableRow key={am.id}>
                          <TableCell className="font-medium">{am.name}</TableCell>
                          <TableCell>{am.title || '-'}</TableCell>
                          <TableCell>
                            {am.email ? (
                              <div className="flex items-center gap-1">
                                <Mail className="h-3 w-3 text-muted-foreground" />
                                {am.email}
                              </div>
                            ) : (
                              '-'
                            )}
                          </TableCell>
                          <TableCell>
                            {am.phone ? (
                              <div className="flex items-center gap-1">
                                <Phone className="h-3 w-3 text-muted-foreground" />
                                {am.phone}
                              </div>
                            ) : (
                              '-'
                            )}
                          </TableCell>
                          <TableCell>
                            <Badge variant={am.is_active ? 'default' : 'secondary'}>
                              {am.is_active ? 'Aktif' : 'Nonaktif'}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {format(new Date(am.created_at), 'PPp', { locale: id })}
                          </TableCell>
                          <TableCell className="text-right">
                            {isManager && (
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button variant="ghost" size="icon">
                                    <MoreHorizontal className="h-4 w-4" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                  <DropdownMenuItem onClick={() => openEditDialog(am)}>
                                    <Edit className="mr-2 h-4 w-4" />
                                    Edit
                                  </DropdownMenuItem>
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem onClick={() => openStatusDialog(am)}>
                                    {am.is_active ? (
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
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Tambah Account Manager Baru</DialogTitle>
            <DialogDescription>
              Masukkan informasi Account Manager yang akan ditambahkan
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="new-name">Nama *</Label>
              <Input
                id="new-name"
                value={newAccountManager.name}
                onChange={(e) => setNewAccountManager({ ...newAccountManager, name: e.target.value })}
                placeholder="Nama lengkap Account Manager"
              />
              {validationErrors.name && (
                <p className="text-sm text-destructive">{validationErrors.name}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="new-title">Jabatan (Opsional)</Label>
              <Input
                id="new-title"
                value={newAccountManager.title}
                onChange={(e) => setNewAccountManager({ ...newAccountManager, title: e.target.value })}
                placeholder="Contoh: Senior Account Manager"
              />
              {validationErrors.title && (
                <p className="text-sm text-destructive">{validationErrors.title}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="new-email">Email (Opsional)</Label>
              <Input
                id="new-email"
                type="email"
                value={newAccountManager.email}
                onChange={(e) => setNewAccountManager({ ...newAccountManager, email: e.target.value })}
                placeholder="email@telkom.co.id"
              />
              {validationErrors.email && (
                <p className="text-sm text-destructive">{validationErrors.email}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="new-phone">Telepon (Opsional)</Label>
              <Input
                id="new-phone"
                value={newAccountManager.phone}
                onChange={(e) => setNewAccountManager({ ...newAccountManager, phone: e.target.value })}
                placeholder="+62 xxx xxxx xxxx"
              />
              {validationErrors.phone && (
                <p className="text-sm text-destructive">{validationErrors.phone}</p>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateDialogOpen(false)} disabled={isSubmitting}>
              Batal
            </Button>
            <Button onClick={handleCreateAccountManager} disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Simpan
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Account Manager</DialogTitle>
            <DialogDescription>
              Perbarui informasi Account Manager
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="edit-name">Nama *</Label>
              <Input
                id="edit-name"
                value={editData.name || ''}
                onChange={(e) => setEditData({ ...editData, name: e.target.value })}
                placeholder="Nama lengkap Account Manager"
              />
              {validationErrors.name && (
                <p className="text-sm text-destructive">{validationErrors.name}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-title">Jabatan (Opsional)</Label>
              <Input
                id="edit-title"
                value={editData.title || ''}
                onChange={(e) => setEditData({ ...editData, title: e.target.value })}
                placeholder="Contoh: Senior Account Manager"
              />
              {validationErrors.title && (
                <p className="text-sm text-destructive">{validationErrors.title}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-email">Email (Opsional)</Label>
              <Input
                id="edit-email"
                type="email"
                value={editData.email || ''}
                onChange={(e) => setEditData({ ...editData, email: e.target.value })}
                placeholder="email@telkom.co.id"
              />
              {validationErrors.email && (
                <p className="text-sm text-destructive">{validationErrors.email}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-phone">Telepon (Opsional)</Label>
              <Input
                id="edit-phone"
                value={editData.phone || ''}
                onChange={(e) => setEditData({ ...editData, phone: e.target.value })}
                placeholder="+62 xxx xxxx xxxx"
              />
              {validationErrors.phone && (
                <p className="text-sm text-destructive">{validationErrors.phone}</p>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialogOpen(false)} disabled={isSubmitting}>
              Batal
            </Button>
            <Button onClick={handleEditAccountManager} disabled={isSubmitting}>
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
              {selectedAccountManager?.is_active ? 'Nonaktifkan' : 'Aktifkan'} Account Manager?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Apakah Anda yakin ingin {selectedAccountManager?.is_active ? 'menonaktifkan' : 'mengaktifkan'} Account Manager{' '}
              <strong>{selectedAccountManager?.name}</strong>?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isSubmitting}>Batal</AlertDialogCancel>
            <AlertDialogAction onClick={handleToggleActive} disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Ya, {selectedAccountManager?.is_active ? 'Nonaktifkan' : 'Aktifkan'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
