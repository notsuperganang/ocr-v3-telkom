// Main layout component with hover-based sidebar navigation
import { useState } from 'react';
import type { ReactNode } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  Sidebar,
  SidebarBody,
  useSidebar
} from '@/components/ui/sidebar';
import { motion } from 'motion/react';
import { cn } from "@/lib/utils";
import {
  Upload,
  FolderOpen,
  BarChart3,
  LogOut,
  User,
  Users,
  Layers,
  MapPin,
  UserCog,
  Building2,
  Target,
  Receipt
} from 'lucide-react';

interface LayoutProps {
  children: ReactNode;
}

interface Links {
  label: string;
  href: string;
  icon: React.JSX.Element | React.ReactNode;
}

const navigationLinks: Links[] = [
  {
    label: 'Dashboard',
    href: '/',
    icon: <BarChart3 className="text-neutral-700 dark:text-neutral-200 h-5 w-5 flex-shrink-0" />
  },
  {
    label: 'Invoice',
    href: '/invoices',
    icon: <Receipt className="text-neutral-700 dark:text-neutral-200 h-5 w-5 flex-shrink-0" />
  },
  {
    label: 'Kontrak',
    href: '/contracts',
    icon: <FolderOpen className="text-neutral-700 dark:text-neutral-200 h-5 w-5 flex-shrink-0" />
  },
  {
    label: 'Overview Akun',
    href: '/account-history',
    icon: <Layers className="text-neutral-700 dark:text-neutral-200 h-5 w-5 flex-shrink-0" />
  },
  {
    label: 'Upload',
    href: '/upload',
    icon: <Upload className="text-neutral-700 dark:text-neutral-200 h-5 w-5 flex-shrink-0" />
  },
];

// Custom SidebarLink component for React Router
function CustomSidebarLink({
  link,
  className,
  isActive = false,
  ...props
}: {
  link: Links;
  className?: string;
  isActive?: boolean;
}) {
  const { open, animate } = useSidebar();
  return (
    <Link
      to={link.href}
      className={cn(
        "flex items-center justify-start gap-2 group/sidebar py-2 rounded-md transition-colors relative overflow-hidden",
        isActive
          ? "bg-neutral-200 dark:bg-neutral-700"
          : "hover:bg-neutral-200 dark:hover:bg-neutral-700",
        className
      )}
      {...props}
    >
      <div
        className={cn(
          "transition-all duration-200 flex-shrink-0",
          open ? "ml-2" : "mx-auto",
          isActive && "[&>svg]:text-primary dark:[&>svg]:text-primary"
        )}
      >
        {link.icon}
      </div>

      <motion.span
        animate={{
          display: animate ? (open ? "inline-block" : "none") : "inline-block",
          opacity: animate ? (open ? 1 : 0) : 1,
        }}
        className="text-neutral-700 dark:text-neutral-200 text-sm group-hover/sidebar:translate-x-1 transition duration-150 whitespace-pre inline-block !p-0 !m-0"
      >
        {link.label}
      </motion.span>
    </Link>
  );
}

// Logo component
function Logo() {
  return (
    <Link
      to="/"
      className="font-normal flex space-x-2 items-center text-sm text-black py-1 relative z-20"
    >
      <img
        src="/src/assets/icon-telkom.png"
        alt="Telkom"
        className="h-6 w-6 flex-shrink-0"
      />
      <span className="font-medium text-black dark:text-white whitespace-pre">
        Telkom Contract
      </span>
    </Link>
  );
}

// Logo icon for collapsed state
function LogoIcon() {
  return (
    <Link
      to="/"
      className="font-normal flex space-x-2 items-center text-sm text-black py-1 relative z-20"
    >
      <img
        src="/src/assets/icon-telkom.png"
        alt="Telkom"
        className="h-6 w-6 flex-shrink-0"
      />
    </Link>
  );
}

export function Layout({ children }: LayoutProps) {
  const { user, logout, isManager, isStaff } = useAuth();
  const location = useLocation();
  const [open, setOpen] = useState(false);

  // Create user management link (manager only)
  const userManagementLink: Links = {
    label: 'Manajemen User',
    href: '/users',
    icon: <Users className="text-neutral-700 dark:text-neutral-200 h-5 w-5 flex-shrink-0" />
  };

  // Create master data links (staff & manager only)
  const masterDataLinks: Links[] = [
    {
      label: 'Segmen',
      href: '/segments',
      icon: <Target className="text-neutral-700 dark:text-neutral-200 h-5 w-5 flex-shrink-0" />
    },
    {
      label: 'Witel',
      href: '/witels',
      icon: <MapPin className="text-neutral-700 dark:text-neutral-200 h-5 w-5 flex-shrink-0" />
    },
    {
      label: 'Akun Manajer',
      href: '/account-managers',
      icon: <UserCog className="text-neutral-700 dark:text-neutral-200 h-5 w-5 flex-shrink-0" />
    },
    {
      label: 'Akun',
      href: '/accounts',
      icon: <Building2 className="text-neutral-700 dark:text-neutral-200 h-5 w-5 flex-shrink-0" />
    },
  ];

  // Create logout link
  const logoutLink: Links = {
    label: 'Keluar',
    href: '#',
    icon: <LogOut className="text-neutral-700 dark:text-neutral-200 h-5 w-5 flex-shrink-0" />
  };

  const handleLogout = (e: React.MouseEvent) => {
    e.preventDefault();
    logout();
  };

  return (
    <div className={cn(
      "mx-auto flex w-full flex-1 flex-col overflow-hidden rounded-md border border-neutral-200 bg-gray-100 md:flex-row dark:border-neutral-700 dark:bg-neutral-800",
      "h-screen"
    )}>
      <Sidebar open={open} setOpen={setOpen}>
        <SidebarBody className="justify-between gap-10">
          <div className="flex flex-1 flex-col overflow-x-hidden overflow-y-auto">
            {open ? <Logo /> : <LogoIcon />}

            <div className="mt-8 flex flex-col gap-2">
              {navigationLinks.map((link, idx) => (
                <CustomSidebarLink
                  key={idx}
                  link={link}
                  isActive={location.pathname === link.href}
                />
              ))}

              {/* Master Data - Staff & Manager */}
              {(isStaff || isManager) && (
                <>
                  {/* Section header when open */}
                  {open && (
                    <div className="mt-6 mb-2 px-2">
                      <span className="text-xs font-semibold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider">
                        Master Data
                      </span>
                    </div>
                  )}
                  {/* Divider when closed */}
                  {!open && (
                    <div className="my-2 border-t-2 border-[#E42313]" />
                  )}
                  {masterDataLinks.map((link, idx) => (
                    <CustomSidebarLink
                      key={`master-${idx}`}
                      link={link}
                      isActive={location.pathname === link.href}
                    />
                  ))}
                </>
              )}

              {/* User Management - Manager Only */}
              {isManager && (
                <>
                  {/* Section header when open */}
                  {open && (
                    <div className="mt-6 mb-2 px-2">
                      <span className="text-xs font-semibold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider">
                        Admin
                      </span>
                    </div>
                  )}
                  {/* Divider when closed */}
                  {!open && (
                    <div className="my-2 border-t-2 border-[#E42313]" />
                  )}
                  <CustomSidebarLink
                    link={userManagementLink}
                    isActive={location.pathname === '/users'}
                  />
                </>
              )}
            </div>
          </div>

          <div>
            {/* User info - clickable to profile */}
            <Link
              to="/profile"
              className={cn(
                "flex items-center justify-start gap-2 py-2 rounded-md transition-colors mb-4 relative overflow-hidden",
                location.pathname === '/profile'
                  ? "bg-neutral-200 dark:bg-neutral-700"
                  : "hover:bg-neutral-200 dark:hover:bg-neutral-700"
              )}
            >
              <div className={cn(
                "h-7 w-7 bg-primary rounded-full flex items-center justify-center flex-shrink-0 transition-all duration-200",
                open ? "ml-2" : "mx-auto"
              )}>
                <User className="h-4 w-4 text-primary-foreground" />
              </div>
              {open && (
                <div className="flex flex-col">
                  <span className="text-xs text-neutral-700 dark:text-neutral-200 font-medium">
                    {user?.fullName || user?.username}
                  </span>
                  <span className="text-xs text-neutral-500 dark:text-neutral-400">
                    {user?.role === 'MANAGER' ? 'Manager' : 'Staff'}
                  </span>
                </div>
              )}
            </Link>

            {/* Logout */}
            <div onClick={handleLogout} className="cursor-pointer">
              <CustomSidebarLink link={logoutLink} />
            </div>
          </div>
        </SidebarBody>
      </Sidebar>

      {/* Main Content */}
      <div className="flex flex-1">
        <div className="flex h-full w-full flex-1 flex-col gap-2 rounded-tl-2xl border border-neutral-200 bg-white dark:border-neutral-700 dark:bg-neutral-900 overflow-hidden">
          <div className="flex-1 overflow-y-auto p-2 md:p-10">
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}