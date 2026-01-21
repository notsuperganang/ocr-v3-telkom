// Segments Management Page
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
import type { SegmentResponse, SegmentCreate, SegmentUpdate } from '@/types/api';
import {
  segmentCreateSchema,
  segmentUpdateSchema,
  type SegmentCreateInput,
  type SegmentUpdateInput,
} from '@/lib/masterDataValidation';
import { Target, Plus, Search, MoreHorizontal, Edit, XCircle, CheckCircle, Loader2 } from 'lucide-react';
import { twMerge } from 'tailwind-merge';
import { format } from 'date-fns';
import { id } from 'date-fns/locale';

export function SegmentsPage() {
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
  const [segments, setSegments] = React.useState<SegmentResponse[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [searchQuery, setSearchQuery] = React.useState('');
  const [activeFilter, setActiveFilter] = React.useState<'all' | 'active' | 'inactive'>('active');

  // Dialog states
  const [createDialogOpen, setCreateDialogOpen] = React.useState(false);
  const [editDialogOpen, setEditDialogOpen] = React.useState(false);
  const [statusDialogOpen, setStatusDialogOpen] = React.useState(false);
  const [selectedSegment, setSelectedSegment] = React.useState<SegmentResponse | null>(null);

  // Form states
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [validationErrors, setValidationErrors] = React.useState<Record<string, string>>({});

  // Create segment form
  const [newSegment, setNewSegment] = React.useState<SegmentCreateInput>({
    name: '',
    code: '',
  });

  // Edit segment form
  const [editData, setEditData] = React.useState<SegmentUpdateInput>({});

  // Load segments
  const loadSegments = async () => {
    setIsLoading(true);
    try {
      // Fetch based on filter - if 'all' or 'inactive', get all segments; if 'active', get only active
      const shouldFetchAll = activeFilter === 'all' || activeFilter === 'inactive';
      const response = await apiService.listSegments(!shouldFetchAll, searchQuery || undefined);
      
      // Filter on frontend if showing inactive only
      let filteredSegments = response.segments;
      if (activeFilter === 'inactive') {
        filteredSegments = response.segments.filter(s => !s.is_active);
      }
      // If 'active' or 'all', show what backend returned
      
      setSegments(filteredSegments);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Gagal memuat data segment';
      toast.error(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  React.useEffect(() => {
    if (isStaff || isManager) {
      loadSegments();
    }
  }, [searchQuery, activeFilter, isStaff, isManager]);

  // Handlers
  const handleCreateSegment = async () => {
    setValidationErrors({});
    
    // Validate using Zod
    const result = segmentCreateSchema.safeParse(newSegment);
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
      const createData: SegmentCreate = {
        name: result.data.name,
        code: result.data.code && result.data.code !== '' ? result.data.code : undefined,
      };
      await apiService.createSegment(createData);
      toast.success('Segment berhasil dibuat');
      setCreateDialogOpen(false);
      setNewSegment({ name: '', code: '' });
      loadSegments();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Gagal membuat segment';
      toast.error(errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEditSegment = async () => {
    if (!selectedSegment) return;

    setValidationErrors({});

    // Validate using Zod
    const result = segmentUpdateSchema.safeParse(editData);
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
      const updateData: SegmentUpdate = {
        name: result.data.name,
        code: result.data.code && result.data.code !== '' ? result.data.code : undefined,
      };
      await apiService.updateSegment(selectedSegment.id, updateData);
      toast.success('Segment berhasil diperbarui');
      setEditDialogOpen(false);
      setEditData({});
      setSelectedSegment(null);
      loadSegments();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Gagal memperbarui segment';
      toast.error(errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleToggleActive = async () => {
    if (!selectedSegment) return;

    setIsSubmitting(true);
    try {
      if (selectedSegment.is_active) {
        await apiService.deactivateSegment(selectedSegment.id);
        toast.success('Segment berhasil dinonaktifkan');
      } else {
        await apiService.activateSegment(selectedSegment.id);
        toast.success('Segment berhasil diaktifkan');
      }
      setStatusDialogOpen(false);
      setSelectedSegment(null);
      loadSegments();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Gagal mengubah status segment';
      toast.error(errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  };

  const openEditDialog = (segment: SegmentResponse) => {
    setSelectedSegment(segment);
    setEditData({
      name: segment.name,
      code: segment.code || '',
    });
    setValidationErrors({});
    setEditDialogOpen(true);
  };

  const openStatusDialog = (segment: SegmentResponse) => {
    setSelectedSegment(segment);
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
              <Target className="size-7 text-[#d71920]" aria-hidden="true" />
            </div>
            <div>
              <h1 className="text-3xl font-bold tracking-tight">Manajemen Segment</h1>
              <p className="text-muted-foreground">
                Kelola klasifikasi segment customer
              </p>
            </div>
          </div>
          {(isManager || isStaff) && (
            <Button onClick={() => setCreateDialogOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Tambah Segment
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
                <Label htmlFor="search">Cari Segment</Label>
                <Input
                  id="search"
                  placeholder="Nama atau kode segment..."
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
              <Target className="h-5 w-5" />
              Daftar Segment
            </CardTitle>
            <CardDescription>
              Total: {segments.length} segment
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : segments.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                Tidak ada segment ditemukan
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
                    {segments.map((segment) => (
                      <TableRow key={segment.id}>
                        <TableCell className="font-medium">{segment.code || '-'}</TableCell>
                        <TableCell>{segment.name}</TableCell>
                        <TableCell>
                          <Badge variant={segment.is_active ? 'default' : 'secondary'}>
                            {segment.is_active ? 'Aktif' : 'Nonaktif'}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {format(new Date(segment.created_at), 'PPp', { locale: id })}
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
                                <DropdownMenuItem onClick={() => openEditDialog(segment)}>
                                  <Edit className="mr-2 h-4 w-4" />
                                  Edit
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem onClick={() => openStatusDialog(segment)}>
                                  {segment.is_active ? (
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
            <DialogTitle>Tambah Segment Baru</DialogTitle>
            <DialogDescription>
              Masukkan informasi segment yang akan ditambahkan
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="new-name">Nama Segment *</Label>
              <Input
                id="new-name"
                value={newSegment.name}
                onChange={(e) => setNewSegment({ ...newSegment, name: e.target.value })}
                placeholder="Contoh: Enterprise, SME, Consumer"
              />
              {validationErrors.name && (
                <p className="text-sm text-destructive">{validationErrors.name}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="new-code">Kode (Opsional)</Label>
              <Input
                id="new-code"
                value={newSegment.code}
                onChange={(e) => setNewSegment({ ...newSegment, code: e.target.value })}
                placeholder="Contoh: ENT, SME, CON"
              />
              {validationErrors.code && (
                <p className="text-sm text-destructive">{validationErrors.code}</p>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateDialogOpen(false)} disabled={isSubmitting}>
              Batal
            </Button>
            <Button onClick={handleCreateSegment} disabled={isSubmitting}>
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
            <DialogTitle>Edit Segment</DialogTitle>
            <DialogDescription>
              Perbarui informasi segment
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="edit-name">Nama Segment *</Label>
              <Input
                id="edit-name"
                value={editData.name || ''}
                onChange={(e) => setEditData({ ...editData, name: e.target.value })}
                placeholder="Contoh: Enterprise, SME, Consumer"
              />
              {validationErrors.name && (
                <p className="text-sm text-destructive">{validationErrors.name}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-code">Kode (Opsional)</Label>
              <Input
                id="edit-code"
                value={editData.code || ''}
                onChange={(e) => setEditData({ ...editData, code: e.target.value })}
                placeholder="Contoh: ENT, SME, CON"
              />
              {validationErrors.code && (
                <p className="text-sm text-destructive">{validationErrors.code}</p>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialogOpen(false)} disabled={isSubmitting}>
              Batal
            </Button>
            <Button onClick={handleEditSegment} disabled={isSubmitting}>
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
              {selectedSegment?.is_active ? 'Nonaktifkan' : 'Aktifkan'} Segment?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Apakah Anda yakin ingin {selectedSegment?.is_active ? 'menonaktifkan' : 'mengaktifkan'} segment{' '}
              <strong>{selectedSegment?.name}</strong>?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isSubmitting}>Batal</AlertDialogCancel>
            <AlertDialogAction onClick={handleToggleActive} disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Ya, {selectedSegment?.is_active ? 'Nonaktifkan' : 'Aktifkan'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
