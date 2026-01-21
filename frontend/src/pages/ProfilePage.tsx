// Profile and Settings Page
import * as React from 'react';
import { motion } from 'motion/react';
import { useAuth } from '@/context/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { apiService } from '@/services/api';
import {
  User,
  Mail,
  Shield,
  Key,
  Loader2,
  Eye,
  EyeOff,
  Save,
  X,
} from 'lucide-react';

// Design tokens matching other pages
const designTokens = {
  radius: {
    xl: "rounded-[1.25rem]",
  },
  shadow: {
    sm: "shadow-[0_10px_30px_-18px_rgba(15,23,42,0.45)]",
  },
  border: "border border-border/70",
  surface: {
    base: "bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/90",
  },
  focusRing:
    "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#d71920]/80",
} as const;

export function ProfilePage() {
  const { user, refreshUserInfo } = useAuth();

  // Profile update state
  const [isEditingProfile, setIsEditingProfile] = React.useState(false);
  const [isSavingProfile, setIsSavingProfile] = React.useState(false);
  const [email, setEmail] = React.useState(user?.email || '');
  const [fullName, setFullName] = React.useState(user?.fullName || '');

  // Password change state
  const [isChangingPassword, setIsChangingPassword] = React.useState(false);
  const [currentPassword, setCurrentPassword] = React.useState('');
  const [newPassword, setNewPassword] = React.useState('');
  const [confirmPassword, setConfirmPassword] = React.useState('');
  const [showCurrentPassword, setShowCurrentPassword] = React.useState(false);
  const [showNewPassword, setShowNewPassword] = React.useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = React.useState(false);

  const [passwordErrors, setPasswordErrors] = React.useState<{
    currentPassword?: string;
    newPassword?: string;
    confirmPassword?: string;
  }>({});

  // Update local state when user data changes
  React.useEffect(() => {
    if (user) {
      setEmail(user.email || '');
      setFullName(user.fullName || '');
    }
  }, [user]);

  const handleCancelEdit = () => {
    setEmail(user?.email || '');
    setFullName(user?.fullName || '');
    setIsEditingProfile(false);
  };

  const handleSaveProfile = async () => {
    setIsSavingProfile(true);

    try {
      await apiService.updateOwnProfile({
        email: email.trim() || undefined,
        full_name: fullName.trim() || undefined,
      });

      await refreshUserInfo();
      toast.success('Profil berhasil diperbarui');
      setIsEditingProfile(false);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Terjadi kesalahan';
      toast.error(`Gagal memperbarui profil: ${errorMessage}`);
    } finally {
      setIsSavingProfile(false);
    }
  };

  const validatePasswordForm = (): boolean => {
    const newErrors: typeof passwordErrors = {};

    if (!currentPassword) {
      newErrors.currentPassword = 'Password saat ini harus diisi';
    }

    if (!newPassword) {
      newErrors.newPassword = 'Password baru harus diisi';
    } else if (newPassword.length < 8) {
      newErrors.newPassword = 'Password minimal 8 karakter';
    }

    if (!confirmPassword) {
      newErrors.confirmPassword = 'Konfirmasi password harus diisi';
    } else if (newPassword !== confirmPassword) {
      newErrors.confirmPassword = 'Password tidak cocok';
    }

    setPasswordErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validatePasswordForm()) {
      return;
    }

    setIsChangingPassword(true);

    try {
      await apiService.changeOwnPassword({
        current_password: currentPassword,
        new_password: newPassword,
        confirm_password: confirmPassword,
      });

      toast.success('Password berhasil diubah');

      // Clear form
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setPasswordErrors({});
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Terjadi kesalahan';
      toast.error(`Gagal mengubah password: ${errorMessage}`);
    } finally {
      setIsChangingPassword(false);
    }
  };

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1,
      },
    },
  } as const;

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: {
      opacity: 1,
      y: 0,
      transition: {
        type: 'spring' as const,
        stiffness: 100,
        damping: 15,
      },
    },
  } as const;

  return (
    <div className="h-full w-full">
      <motion.div
        className="mx-auto max-w-4xl space-y-6"
        variants={containerVariants}
        initial="hidden"
        animate="visible"
      >
        {/* Header */}
        <motion.div variants={itemVariants} className="space-y-2">
          <h1 className="text-3xl font-bold tracking-tight">Profil & Pengaturan</h1>
          <p className="text-muted-foreground">
            Kelola informasi profil dan ubah password Anda
          </p>
        </motion.div>

        {/* Profile Information Card */}
        <motion.div variants={itemVariants}>
          <Card className={`${designTokens.radius.xl} ${designTokens.shadow.sm} ${designTokens.border} ${designTokens.surface.base}`}>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <User className="h-5 w-5 text-primary" />
                    Informasi Profil
                  </CardTitle>
                  <CardDescription>
                    Informasi akun Anda di sistem
                  </CardDescription>
                </div>
                {!isEditingProfile && (
                  <Button
                    onClick={() => setIsEditingProfile(true)}
                    variant="outline"
                    size="sm"
                  >
                    Edit Profil
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                {/* Username (Read-only) */}
                <div className="space-y-2">
                  <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Username
                  </Label>
                  <div className="flex items-center gap-2 rounded-md border border-border/50 bg-muted/30 px-3 py-2">
                    <User className="h-4 w-4 text-muted-foreground" />
                    <span className="font-medium">{user?.username || '-'}</span>
                  </div>
                  <p className="text-xs text-muted-foreground">Username tidak dapat diubah</p>
                </div>

                {/* Role (Read-only with Badge) */}
                <div className="space-y-2">
                  <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Role
                  </Label>
                  <div className="flex items-center gap-2 rounded-md border border-border/50 bg-muted/30 px-3 py-2">
                    <Shield className="h-4 w-4 text-muted-foreground" />
                    <Badge
                      variant={user?.role === 'MANAGER' ? 'default' : 'secondary'}
                      className="font-medium"
                    >
                      {user?.role === 'MANAGER' ? 'Manager' : 'Staff'}
                    </Badge>
                  </div>
                </div>

                {/* Email (Editable) */}
                <div className="space-y-2">
                  <Label htmlFor="email" className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Email
                  </Label>
                  {isEditingProfile ? (
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="email"
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="email@example.com"
                        className="pl-9"
                      />
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 rounded-md border border-border/50 bg-muted/30 px-3 py-2">
                      <Mail className="h-4 w-4 text-muted-foreground" />
                      <span className="font-medium">{user?.email || '-'}</span>
                    </div>
                  )}
                </div>

                {/* Full Name (Editable) */}
                <div className="space-y-2">
                  <Label htmlFor="fullName" className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Nama Lengkap
                  </Label>
                  {isEditingProfile ? (
                    <div className="relative">
                      <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="fullName"
                        type="text"
                        value={fullName}
                        onChange={(e) => setFullName(e.target.value)}
                        placeholder="Nama lengkap Anda"
                        className="pl-9"
                      />
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 rounded-md border border-border/50 bg-muted/30 px-3 py-2">
                      <User className="h-4 w-4 text-muted-foreground" />
                      <span className="font-medium">{user?.fullName || '-'}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Action buttons when editing */}
              {isEditingProfile && (
                <div className="flex justify-end gap-2 pt-4 border-t">
                  <Button
                    onClick={handleCancelEdit}
                    variant="outline"
                    disabled={isSavingProfile}
                  >
                    <X className="mr-2 h-4 w-4" />
                    Batal
                  </Button>
                  <Button
                    onClick={handleSaveProfile}
                    disabled={isSavingProfile}
                    className={designTokens.focusRing}
                  >
                    {isSavingProfile ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Menyimpan...
                      </>
                    ) : (
                      <>
                        <Save className="mr-2 h-4 w-4" />
                        Simpan
                      </>
                    )}
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>

        {/* Change Password Card */}
        <motion.div variants={itemVariants}>
          <Card className={`${designTokens.radius.xl} ${designTokens.shadow.sm} ${designTokens.border} ${designTokens.surface.base}`}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Key className="h-5 w-5 text-primary" />
                Ubah Password
              </CardTitle>
              <CardDescription>
                Pastikan password Anda kuat dan unik
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handlePasswordChange} className="space-y-4">
                {/* Current Password */}
                <div className="space-y-2">
                  <Label htmlFor="currentPassword">
                    Password Saat Ini <span className="text-destructive">*</span>
                  </Label>
                  <div className="relative">
                    <Input
                      id="currentPassword"
                      type={showCurrentPassword ? 'text' : 'password'}
                      value={currentPassword}
                      onChange={(e) => {
                        setCurrentPassword(e.target.value);
                        setPasswordErrors({ ...passwordErrors, currentPassword: undefined });
                      }}
                      placeholder="Masukkan password saat ini"
                      className={passwordErrors.currentPassword ? 'border-destructive' : ''}
                    />
                    <button
                      type="button"
                      onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    >
                      {showCurrentPassword ? (
                        <EyeOff className="h-4 w-4" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                    </button>
                  </div>
                  {passwordErrors.currentPassword && (
                    <p className="text-sm text-destructive">{passwordErrors.currentPassword}</p>
                  )}
                </div>

                {/* New Password */}
                <div className="space-y-2">
                  <Label htmlFor="newPassword">
                    Password Baru <span className="text-destructive">*</span>
                  </Label>
                  <div className="relative">
                    <Input
                      id="newPassword"
                      type={showNewPassword ? 'text' : 'password'}
                      value={newPassword}
                      onChange={(e) => {
                        setNewPassword(e.target.value);
                        setPasswordErrors({ ...passwordErrors, newPassword: undefined });
                      }}
                      placeholder="Minimal 8 karakter"
                      className={passwordErrors.newPassword ? 'border-destructive' : ''}
                    />
                    <button
                      type="button"
                      onClick={() => setShowNewPassword(!showNewPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    >
                      {showNewPassword ? (
                        <EyeOff className="h-4 w-4" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                    </button>
                  </div>
                  {passwordErrors.newPassword && (
                    <p className="text-sm text-destructive">{passwordErrors.newPassword}</p>
                  )}
                </div>

                {/* Confirm Password */}
                <div className="space-y-2">
                  <Label htmlFor="confirmPassword">
                    Konfirmasi Password Baru <span className="text-destructive">*</span>
                  </Label>
                  <div className="relative">
                    <Input
                      id="confirmPassword"
                      type={showConfirmPassword ? 'text' : 'password'}
                      value={confirmPassword}
                      onChange={(e) => {
                        setConfirmPassword(e.target.value);
                        setPasswordErrors({ ...passwordErrors, confirmPassword: undefined });
                      }}
                      placeholder="Masukkan ulang password baru"
                      className={passwordErrors.confirmPassword ? 'border-destructive' : ''}
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    >
                      {showConfirmPassword ? (
                        <EyeOff className="h-4 w-4" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                    </button>
                  </div>
                  {passwordErrors.confirmPassword && (
                    <p className="text-sm text-destructive">{passwordErrors.confirmPassword}</p>
                  )}
                </div>

                {/* Submit Button */}
                <div className="flex justify-end pt-4">
                  <Button
                    type="submit"
                    disabled={isChangingPassword}
                    className={designTokens.focusRing}
                  >
                    {isChangingPassword ? (
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
                </div>
              </form>
            </CardContent>
          </Card>
        </motion.div>
      </motion.div>
    </div>
  );
}
