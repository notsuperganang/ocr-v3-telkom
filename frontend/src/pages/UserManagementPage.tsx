// User Management Page (Manager Only)
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
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
import { toast } from 'sonner';
import { apiService } from '@/services/api';
import type { UserResponse, CreateUserRequest, UpdateUserRequest, UserRole } from '@/types/api';
import {
  Users,
  UserPlus,
  Search,
  MoreHorizontal,
  Edit,
  Key,
  UserX,
  UserCheck,
  Loader2,
  Eye,
  EyeOff,
  Mail,
  User,
} from 'lucide-react';
import { format } from 'date-fns';
import { id } from 'date-fns/locale';

export function UserManagementPage() {
  const { isManager, user: currentUser } = useAuth();
  const navigate = useNavigate();

  // Redirect if not manager
  React.useEffect(() => {
    if (!isManager) {
      toast.error('Anda tidak memiliki akses ke halaman ini');
      navigate('/');
    }
  }, [isManager, navigate]);

  // State
  const [users, setUsers] = React.useState<UserResponse[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [searchQuery, setSearchQuery] = React.useState('');
  const [roleFilter, setRoleFilter] = React.useState<string>('all');
  const [activeFilter, setActiveFilter] = React.useState(true);
  const [page, setPage] = React.useState(1);
  const [totalPages, setTotalPages] = React.useState(1);
  const [total, setTotal] = React.useState(0);

  // Dialog states
  const [createDialogOpen, setCreateDialogOpen] = React.useState(false);
  const [editDialogOpen, setEditDialogOpen] = React.useState(false);
  const [passwordDialogOpen, setPasswordDialogOpen] = React.useState(false);
  const [deactivateDialogOpen, setDeactivateDialogOpen] = React.useState(false);
  const [selectedUser, setSelectedUser] = React.useState<UserResponse | null>(null);

  // Form states
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [showPassword, setShowPassword] = React.useState(false);
  const [showNewPassword, setShowNewPassword] = React.useState(false);

  // Create user form
  const [newUser, setNewUser] = React.useState<CreateUserRequest>({
    username: '',
    email: '',
    password: '',
    full_name: '',
    role: 'STAFF',
  });

  // Edit user form
  const [editData, setEditData] = React.useState<UpdateUserRequest>({});

  // Password form
  const [newPassword, setNewPassword] = React.useState('');

  // Load users
  const loadUsers = async () => {
    setIsLoading(true);
    try {
      const response = await apiService.listUsers(
        page,
        20,
        searchQuery || undefined,
        roleFilter === 'all' ? undefined : roleFilter,
        activeFilter
      );
      setUsers(response.users);
      setTotal(response.total);
      setTotalPages(response.total_pages);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Gagal memuat data user';
      toast.error(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  React.useEffect(() => {
    if (isManager) {
      loadUsers();
    }
  }, [page, searchQuery, roleFilter, activeFilter, isManager]);

  // Handlers
  const handleCreateUser = async () => {
    if (!newUser.username || !newUser.email || !newUser.password) {
      toast.error('Username, email, dan password harus diisi');
      return;
    }

    if (newUser.password.length < 8) {
      toast.error('Password minimal 8 karakter');
      return;
    }

    setIsSubmitting(true);
    try {
      await apiService.createUser(newUser);
      toast.success('User berhasil dibuat');
      setCreateDialogOpen(false);
      setNewUser({
        username: '',
        email: '',
        password: '',
        full_name: '',
        role: 'STAFF',
      });
      loadUsers();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Gagal membuat user';
      toast.error(errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEditUser = async () => {
    if (!selectedUser) return;

    setIsSubmitting(true);
    try {
      await apiService.updateUser(selectedUser.id, editData);
      toast.success('User berhasil diperbarui');
      setEditDialogOpen(false);
      setEditData({});
      setSelectedUser(null);
      loadUsers();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Gagal memperbarui user';
      toast.error(errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleChangePassword = async () => {
    if (!selectedUser) return;

    if (newPassword.length < 8) {
      toast.error('Password minimal 8 karakter');
      return;
    }

    setIsSubmitting(true);
    try {
      await apiService.changeUserPassword(selectedUser.id, { new_password: newPassword });
      toast.success('Password berhasil diubah');
      setPasswordDialogOpen(false);
      setNewPassword('');
      setSelectedUser(null);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Gagal mengubah password';
      toast.error(errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleToggleActive = async () => {
    if (!selectedUser) return;

    setIsSubmitting(true);
    try {
      if (selectedUser.is_active) {
        await apiService.deactivateUser(selectedUser.id);
        toast.success('User berhasil dinonaktifkan');
      } else {
        await apiService.activateUser(selectedUser.id);
        toast.success('User berhasil diaktifkan');
      }
      setDeactivateDialogOpen(false);
      setSelectedUser(null);
      loadUsers();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Gagal mengubah status user';
      toast.error(errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  };

  const openEditDialog = (user: UserResponse) => {
    setSelectedUser(user);
    setEditData({
      email: user.email,
      full_name: user.full_name || '',
      role: user.role,
    });
    setEditDialogOpen(true);
  };

  const openPasswordDialog = (user: UserResponse) => {
    setSelectedUser(user);
    setNewPassword('');
    setPasswordDialogOpen(true);
  };

  const openDeactivateDialog = (user: UserResponse) => {
    // Prevent manager from deactivating themselves
    if (currentUser?.userId === user.id) {
      toast.error('Anda tidak dapat menonaktifkan akun Anda sendiri');
      return;
    }
    setSelectedUser(user);
    setDeactivateDialogOpen(true);
  };

  if (!isManager) {
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
            <h1 className="text-3xl font-bold tracking-tight">Manajemen User</h1>
            <p className="text-muted-foreground">
              Kelola user dan hak akses sistem
            </p>
          </div>
          <Button onClick={() => setCreateDialogOpen(true)}>
            <UserPlus className="mr-2 h-4 w-4" />
            Tambah User
          </Button>
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
            <div className="grid gap-4 md:grid-cols-3">
              {/* Search */}
              <div className="space-y-2">
                <Label htmlFor="search">Cari User</Label>
                <Input
                  id="search"
                  placeholder="Username, email, atau nama..."
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setPage(1);
                  }}
                />
              </div>

              {/* Role Filter */}
              <div className="space-y-2">
                <Label htmlFor="role-filter">Filter Role</Label>
                <Select value={roleFilter} onValueChange={(value: string) => {
                  setRoleFilter(value);
                  setPage(1);
                }}>
                  <SelectTrigger id="role-filter">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Semua Role</SelectItem>
                    <SelectItem value="MANAGER">Manager</SelectItem>
                    <SelectItem value="STAFF">Staff</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Active Filter */}
              <div className="space-y-2">
                <Label htmlFor="active-filter">Filter Status</Label>
                <Select value={activeFilter ? 'active' : 'all'} onValueChange={(value: string) => {
                  setActiveFilter(value === 'active');
                  setPage(1);
                }}>
                  <SelectTrigger id="active-filter">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Hanya Aktif</SelectItem>
                    <SelectItem value="all">Semua Status</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Users Table */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Daftar User
            </CardTitle>
            <CardDescription>
              Total: {total} user{total !== 1 ? 's' : ''}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : users.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                Tidak ada user ditemukan
              </div>
            ) : (
              <div className="space-y-4">
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Username</TableHead>
                        <TableHead>Email</TableHead>
                        <TableHead>Nama Lengkap</TableHead>
                        <TableHead>Role</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Login Terakhir</TableHead>
                        <TableHead className="w-[100px]">Aksi</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {users.map((user) => (
                        <TableRow key={user.id}>
                          <TableCell className="font-medium">{user.username}</TableCell>
                          <TableCell>{user.email}</TableCell>
                          <TableCell>{user.full_name || '-'}</TableCell>
                          <TableCell>
                            <Badge variant={user.role === 'MANAGER' ? 'default' : 'secondary'}>
                              {user.role === 'MANAGER' ? 'Manager' : 'Staff'}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Badge variant={user.is_active ? 'default' : 'secondary'}>
                              {user.is_active ? 'Aktif' : 'Nonaktif'}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {user.last_login_at
                              ? format(new Date(user.last_login_at), 'dd MMM yyyy HH:mm', { locale: id })
                              : '-'}
                          </TableCell>
                          <TableCell>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="sm">
                                  <MoreHorizontal className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={() => openEditDialog(user)}>
                                  <Edit className="mr-2 h-4 w-4" />
                                  Edit User
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => openPasswordDialog(user)}>
                                  <Key className="mr-2 h-4 w-4" />
                                  Ubah Password
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                  onClick={() => openDeactivateDialog(user)}
                                  disabled={user.is_active && currentUser?.userId === user.id}
                                >
                                  {user.is_active ? (
                                    <>
                                      <UserX className="mr-2 h-4 w-4" />
                                      {currentUser?.userId === user.id ? 'Nonaktifkan (Anda sendiri)' : 'Nonaktifkan'}
                                    </>
                                  ) : (
                                    <>
                                      <UserCheck className="mr-2 h-4 w-4" />
                                      Aktifkan
                                    </>
                                  )}
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>

                {/* Pagination */}
                {totalPages > 1 && (
                  <div className="flex items-center justify-between">
                    <p className="text-sm text-muted-foreground">
                      Halaman {page} dari {totalPages}
                    </p>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setPage(p => Math.max(1, p - 1))}
                        disabled={page === 1}
                      >
                        Sebelumnya
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                        disabled={page === totalPages}
                      >
                        Selanjutnya
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>

      {/* Create User Dialog */}
      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Tambah User Baru</DialogTitle>
            <DialogDescription>
              Buat akun user baru untuk sistem
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="new-username">
                Username <span className="text-destructive">*</span>
              </Label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="new-username"
                  value={newUser.username}
                  onChange={(e) => setNewUser({ ...newUser, username: e.target.value })}
                  placeholder="username_user"
                  className="pl-9"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="new-email">
                Email <span className="text-destructive">*</span>
              </Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="new-email"
                  type="email"
                  value={newUser.email}
                  onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
                  placeholder="user@example.com"
                  className="pl-9"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="new-password">
                Password <span className="text-destructive">*</span>
              </Label>
              <div className="relative">
                <Input
                  id="new-password"
                  type={showPassword ? 'text' : 'password'}
                  value={newUser.password}
                  onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
                  placeholder="Minimal 8 karakter"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="new-fullname">Nama Lengkap</Label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="new-fullname"
                  value={newUser.full_name}
                  onChange={(e) => setNewUser({ ...newUser, full_name: e.target.value })}
                  placeholder="Nama lengkap user"
                  className="pl-9"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="new-role">
                Role <span className="text-destructive">*</span>
              </Label>
              <Select
                value={newUser.role}
                onValueChange={(value: string) => setNewUser({ ...newUser, role: value as UserRole })}
              >
                <SelectTrigger id="new-role">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="STAFF">Staff</SelectItem>
                  <SelectItem value="MANAGER">Manager</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateDialogOpen(false)} disabled={isSubmitting}>
              Batal
            </Button>
            <Button onClick={handleCreateUser} disabled={isSubmitting}>
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Menyimpan...
                </>
              ) : (
                <>
                  <UserPlus className="mr-2 h-4 w-4" />
                  Buat User
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit User Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Edit User</DialogTitle>
            <DialogDescription>
              Perbarui informasi user {selectedUser?.username}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="edit-email">Email</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="edit-email"
                  type="email"
                  value={editData.email || ''}
                  onChange={(e) => setEditData({ ...editData, email: e.target.value })}
                  placeholder="user@example.com"
                  className="pl-9"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-fullname">Nama Lengkap</Label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="edit-fullname"
                  value={editData.full_name || ''}
                  onChange={(e) => setEditData({ ...editData, full_name: e.target.value })}
                  placeholder="Nama lengkap user"
                  className="pl-9"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-role">Role</Label>
              <Select
                value={editData.role || selectedUser?.role}
                onValueChange={(value: string) => setEditData({ ...editData, role: value as UserRole })}
              >
                <SelectTrigger id="edit-role">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="STAFF">Staff</SelectItem>
                  <SelectItem value="MANAGER">Manager</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialogOpen(false)} disabled={isSubmitting}>
              Batal
            </Button>
            <Button onClick={handleEditUser} disabled={isSubmitting}>
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Menyimpan...
                </>
              ) : (
                <>
                  <Edit className="mr-2 h-4 w-4" />
                  Simpan
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Change Password Dialog */}
      <Dialog open={passwordDialogOpen} onOpenChange={setPasswordDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Ubah Password User</DialogTitle>
            <DialogDescription>
              Reset password untuk {selectedUser?.username}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="change-password">
                Password Baru <span className="text-destructive">*</span>
              </Label>
              <div className="relative">
                <Input
                  id="change-password"
                  type={showNewPassword ? 'text' : 'password'}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Minimal 8 karakter"
                />
                <button
                  type="button"
                  onClick={() => setShowNewPassword(!showNewPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showNewPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setPasswordDialogOpen(false)} disabled={isSubmitting}>
              Batal
            </Button>
            <Button onClick={handleChangePassword} disabled={isSubmitting}>
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Menyimpan...
                </>
              ) : (
                <>
                  <Key className="mr-2 h-4 w-4" />
                  Ubah Password
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Deactivate/Activate Dialog */}
      <AlertDialog open={deactivateDialogOpen} onOpenChange={setDeactivateDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {selectedUser?.is_active ? 'Nonaktifkan User' : 'Aktifkan User'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {selectedUser?.is_active
                ? `Apakah Anda yakin ingin menonaktifkan user ${selectedUser?.username}? User tidak akan dapat login ke sistem.`
                : `Apakah Anda yakin ingin mengaktifkan user ${selectedUser?.username}? User akan dapat login ke sistem kembali.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isSubmitting}>Batal</AlertDialogCancel>
            <AlertDialogAction onClick={handleToggleActive} disabled={isSubmitting}>
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Memproses...
                </>
              ) : selectedUser?.is_active ? (
                <>
                  <UserX className="mr-2 h-4 w-4" />
                  Nonaktifkan
                </>
              ) : (
                <>
                  <UserCheck className="mr-2 h-4 w-4" />
                  Aktifkan
                </>
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
