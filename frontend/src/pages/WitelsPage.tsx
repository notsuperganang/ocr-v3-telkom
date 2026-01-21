// Witels Management Page
import * as React from 'react';
import { motion } from 'motion/react';
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
import type { WitelResponse, WitelCreate, WitelUpdate } from '@/types/api';
import {
  witelCreateSchema,
  witelUpdateSchema,
  type WitelCreateInput,
  type WitelUpdateInput,
} from '@/lib/masterDataValidation';
import { MapPin, Plus, Search, MoreHorizontal, Edit, XCircle, CheckCircle, Loader2 } from 'lucide-react';
import { twMerge } from 'tailwind-merge';
import { format } from 'date-fns';
import { id } from 'date-fns/locale';

export function WitelsPage() {
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
  const [witels, setWitels] = React.useState<WitelResponse[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [searchQuery, setSearchQuery] = React.useState('');
  const [activeFilter, setActiveFilter] = React.useState<'all' | 'active' | 'inactive'>('active');

  // Dialog states
  const [createDialogOpen, setCreateDialogOpen] = React.useState(false);
  const [editDialogOpen, setEditDialogOpen] = React.useState(false);
  const [statusDialogOpen, setStatusDialogOpen] = React.useState(false);
  const [selectedWitel, setSelectedWitel] = React.useState<WitelResponse | null>(null);

  // Form states
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [validationErrors, setValidationErrors] = React.useState<Record<string, string>>({});

  // Create witel form
  const [newWitel, setNewWitel] = React.useState<WitelCreateInput>({
    code: '',
    name: '',
  });

  // Edit witel form
  const [editData, setEditData] = React.useState<WitelUpdateInput>({});

  // Load witels
  const loadWitels = async () => {
    setIsLoading(true);
    try {
      // Fetch based on filter - if 'all' or 'inactive', get all witels; if 'active', get only active
      const shouldFetchAll = activeFilter === 'all' || activeFilter === 'inactive';
      const response = await apiService.listWitels(!shouldFetchAll, searchQuery || undefined);
      
      // Filter on frontend if showing inactive only
      let filteredWitels = response.witels;
      if (activeFilter === 'inactive') {
        filteredWitels = response.witels.filter(w => !w.is_active);
      }
      // If 'active' or 'all', show what backend returned
      
      setWitels(filteredWitels);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Gagal memuat data witel';
      toast.error(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  React.useEffect(() => {
    if (isStaff || isManager) {
      loadWitels();
    }
  }, [searchQuery, activeFilter, isStaff, isManager]);

  // Handlers
  const handleCreateWitel = async () => {
    setValidationErrors({});
    
    // Validate using Zod
    const result = witelCreateSchema.safeParse(newWitel);
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
      const createData: WitelCreate = {
        code: result.data.code,
        name: result.data.name,
      };
      await apiService.createWitel(createData);
      toast.success('Witel berhasil dibuat');
      setCreateDialogOpen(false);
      setNewWitel({ code: '', name: '' });
      loadWitels();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Gagal membuat witel';
      toast.error(errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEditWitel = async () => {
    if (!selectedWitel) return;

    setValidationErrors({});

    // Validate using Zod
    const result = witelUpdateSchema.safeParse(editData);
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
      const updateData: WitelUpdate = {
        code: result.data.code || selectedWitel.code,
        name: result.data.name || selectedWitel.name,
      };
      await apiService.updateWitel(selectedWitel.id, updateData);
      toast.success('Witel berhasil diperbarui');
      setEditDialogOpen(false);
      setEditData({});
      setSelectedWitel(null);
      loadWitels();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Gagal memperbarui witel';
      toast.error(errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleToggleActive = async () => {
    if (!selectedWitel) return;

    setIsSubmitting(true);
    try {
      if (selectedWitel.is_active) {
        await apiService.deactivateWitel(selectedWitel.id);
        toast.success('Witel berhasil dinonaktifkan');
      } else {
        await apiService.activateWitel(selectedWitel.id);
        toast.success('Witel berhasil diaktifkan');
      }
      setStatusDialogOpen(false);
      setSelectedWitel(null);
      loadWitels();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Gagal mengubah status witel';
      toast.error(errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  };

  const openEditDialog = (witel: WitelResponse) => {
    setSelectedWitel(witel);
    setEditData({
      code: witel.code,
      name: witel.name,
    });
    setValidationErrors({});
    setEditDialogOpen(true);
  };

  const openStatusDialog = (witel: WitelResponse) => {
    setSelectedWitel(witel);
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
              <MapPin className="size-7 text-[#d71920]" aria-hidden="true" />
            </div>
            <div>
              <h1 className="text-3xl font-bold tracking-tight">Manajemen Witel</h1>
              <p className="text-muted-foreground">
                Kelola wilayah telekomunikasi regional
              </p>
            </div>
          </div>
          {(isManager || isStaff) && (
            <Button onClick={() => setCreateDialogOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Tambah Witel
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
                <Label htmlFor="search">Cari Witel</Label>
                <Input
                  id="search"
                  placeholder="Kode, nama, atau region..."
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
              <MapPin className="h-5 w-5" />
              Daftar Witel
            </CardTitle>
            <CardDescription>
              Total: {witels.length} witel
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : witels.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                Tidak ada witel ditemukan
              </div>
            ) : (
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Kode</TableHead>
                      <TableHead>Nama</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Dibuat</TableHead>
                      <TableHead className="text-right">Aksi</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {witels.map((witel) => (
                      <TableRow key={witel.id}>
                        <TableCell className="font-medium">{witel.code}</TableCell>
                        <TableCell>{witel.name}</TableCell>
                        <TableCell>
                          <Badge variant={witel.is_active ? 'default' : 'secondary'}>
                            {witel.is_active ? 'Aktif' : 'Nonaktif'}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {format(new Date(witel.created_at), 'PPp', { locale: id })}
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
                                <DropdownMenuItem onClick={() => openEditDialog(witel)}>
                                  <Edit className="mr-2 h-4 w-4" />
                                  Edit
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem onClick={() => openStatusDialog(witel)}>
                                  {witel.is_active ? (
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
            )}
          </CardContent>
        </Card>
      </motion.div>

      {/* Create Dialog */}
      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Tambah Witel Baru</DialogTitle>
            <DialogDescription>
              Masukkan informasi witel yang akan ditambahkan
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="new-code">Kode Witel *</Label>
              <Input
                id="new-code"
                value={newWitel.code}
                onChange={(e) => setNewWitel({ ...newWitel, code: e.target.value })}
                placeholder="Contoh: WIT-JKT, WIT-BDG"
              />
              {validationErrors.code && (
                <p className="text-sm text-destructive">{validationErrors.code}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="new-name">Nama Witel *</Label>
              <Input
                id="new-name"
                value={newWitel.name}
                onChange={(e) => setNewWitel({ ...newWitel, name: e.target.value })}
                placeholder="Contoh: Witel Jakarta, Witel Bandung"
              />
              {validationErrors.name && (
                <p className="text-sm text-destructive">{validationErrors.name}</p>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateDialogOpen(false)} disabled={isSubmitting}>
              Batal
            </Button>
            <Button onClick={handleCreateWitel} disabled={isSubmitting}>
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
            <DialogTitle>Edit Witel</DialogTitle>
            <DialogDescription>
              Perbarui informasi witel
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="edit-code">Kode Witel *</Label>
              <Input
                id="edit-code"
                value={editData.code || ''}
                onChange={(e) => setEditData({ ...editData, code: e.target.value })}
                placeholder="Contoh: WIT-JKT, WIT-BDG"
              />
              {validationErrors.code && (
                <p className="text-sm text-destructive">{validationErrors.code}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-name">Nama Witel *</Label>
              <Input
                id="edit-name"
                value={editData.name || ''}
                onChange={(e) => setEditData({ ...editData, name: e.target.value })}
                placeholder="Contoh: Witel Jakarta, Witel Bandung"
              />
              {validationErrors.name && (
                <p className="text-sm text-destructive">{validationErrors.name}</p>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialogOpen(false)} disabled={isSubmitting}>
              Batal
            </Button>
            <Button onClick={handleEditWitel} disabled={isSubmitting}>
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
              {selectedWitel?.is_active ? 'Nonaktifkan' : 'Aktifkan'} Witel?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Apakah Anda yakin ingin {selectedWitel?.is_active ? 'menonaktifkan' : 'mengaktifkan'} witel{' '}
              <strong>{selectedWitel?.name}</strong>?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isSubmitting}>Batal</AlertDialogCancel>
            <AlertDialogAction onClick={handleToggleActive} disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Ya, {selectedWitel?.is_active ? 'Nonaktifkan' : 'Aktifkan'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
