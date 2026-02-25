/**
 * AppLayout Component (Phase 30.1 - Layout Isolation & Role Enforcement)
 * Conditional layout system based on user role from Supabase
 * Admin users → AdminLayout (AdminSidebar)
 * Regular users → UserLayout (Standard Sidebar)
 * NO duplicate rendering - clean separation
 */

import { ReactNode, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  FileSearch,
  PlusCircle,
  Briefcase,
  LogOut,
  Menu,
  X,
  ChevronDown,
  User,
  Building2,
  Home,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useApp } from '@/context/AppContext';
import { useUserRole } from '@/hooks/useUserRole';
import { Button } from '@/components/ui/button';
import { AdminSidebar } from './AdminSidebar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { useToast } from '@/hooks/use-toast';
import { BRANDING } from '@/config/branding';

interface AppLayoutProps {
  children: ReactNode;
}

interface NavItem {
  href: string;
  icon: React.ElementType;
  label: string;
  exact?: boolean;
}

// Navigation pour B2C (particuliers)
const B2C_NAV_ITEMS: NavItem[] = [
  { href: '/dashboard', icon: LayoutDashboard, label: 'Tableau de bord', exact: true },
  { href: '/projets', icon: Briefcase, label: 'Mes projets' },
  { href: '/analyze', icon: FileSearch, label: 'Analyser un devis' },
  { href: '/profile', icon: User, label: 'Mon profil' },
];

// Navigation pour B2B (professionnels)
const B2B_NAV_ITEMS: NavItem[] = [
  { href: '/dashboard', icon: LayoutDashboard, label: 'Tableau de bord', exact: true },
  { href: '/projets', icon: Briefcase, label: 'Mes projets' },
  { href: '/analyze', icon: FileSearch, label: 'Analyser un devis' },
  { href: '/profile', icon: User, label: 'Mon profil' },
];

// Navigation pour Admin
const ADMIN_NAV_ITEMS: NavItem[] = [
  { href: '/analytics', icon: BarChart3, label: 'Tableau de bord', exact: true },
];

// Configuration par type d'utilisateur
const USER_TYPE_CONFIG = {
  B2C: {
    label: 'Particulier',
    badge: null,
    navItems: B2C_NAV_ITEMS,
    newProjectLink: '/projets',
    newProjectLabel: 'Mes projets',
    dashboardLink: '/dashboard',
  },
  B2B: {
    label: 'Professionnel',
    badge: 'PRO',
    badgeColor: 'bg-blue-100 text-blue-700',
    navItems: B2B_NAV_ITEMS,
    newProjectLink: '/projets',
    newProjectLabel: 'Mes projets',
    dashboardLink: '/dashboard',
  },
};

// ADMIN CONFIGURATION
const ADMIN_CONFIG = {
  label: 'Administrateur',
  badge: 'ADMIN',
  badgeColor: 'bg-orange-100 text-orange-700',
  dashboardLink: '/analytics',
};

const SUPER_ADMIN_CONFIG = {
  label: 'Super Admin',
  badge: 'SUPER',
  badgeColor: 'bg-red-100 text-red-700',
  dashboardLink: '/analytics',
};

/**
 * Get role-based config
 */
function getConfigByRole(role: string, userType: string) {
  if (role === 'super_admin') {
    return SUPER_ADMIN_CONFIG;
  }
  if (role === 'admin') {
    return ADMIN_CONFIG;
  }

  // Regular user - use userType
  return USER_TYPE_CONFIG[userType as keyof typeof USER_TYPE_CONFIG] || USER_TYPE_CONFIG.B2C;
}

/**
 * User Sidebar Component (for B2C/B2B users)
 */
function UserSidebar({ navItems, onItemClick }: { navItems: NavItem[]; onItemClick?: () => void }) {
  const location = useLocation();
  const navigate = useNavigate();
  const { userType } = useApp();
  const config = USER_TYPE_CONFIG[userType as keyof typeof USER_TYPE_CONFIG] || USER_TYPE_CONFIG.B2C;

  const isActiveRoute = (item: NavItem) => {
    if (item.exact) {
      return location.pathname === item.href;
    }
    return location.pathname.startsWith(item.href);
  };

  return (
    <nav className="p-4 space-y-1 w-full flex flex-col">
      {navItems.map((item) => {
        const isActive = isActiveRoute(item);
        const Icon = item.icon;

        return (
          <Link
            key={item.href}
            to={item.href}
            onClick={onItemClick}
            className={cn(
              'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors',
              isActive ? 'bg-primary text-white' : 'text-gray-700 hover:bg-gray-100'
            )}
          >
            <Icon className="h-5 w-5" />
            {item.label}
          </Link>
        );
      })}

      {/* CTA */}
      <div className="p-4 border-t mt-auto">
        <Button className="w-full" onClick={() => navigate(config.newProjectLink)}>
          <PlusCircle className="h-4 w-4 mr-2" />
          {config.newProjectLabel}
        </Button>
      </div>
    </nav>
  );
}

export function AppLayout({ children }: AppLayoutProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, userType, logout } = useApp();
  const { role, isAdmin } = useUserRole();
  const { toast } = useToast();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Get configuration based on role
  const config = getConfigByRole(role, userType);

  // Get navigation items (only for non-admin users)
  const navItems = !isAdmin
    ? (config as (typeof USER_TYPE_CONFIG)['B2C']).navItems || B2C_NAV_ITEMS
    : [];

  const handleLogout = async () => {
    try {
      await logout();
      toast({
        title: 'Déconnexion réussie',
        description: 'À bientôt!',
      });
      navigate('/');
    } catch (error) {
      console.error('Logout error:', error);
      navigate('/');
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* HEADER - Same for both admin and user */}
      <header className="bg-white border-b sticky top-0 z-50">
        <div className="flex items-center justify-between h-16 px-4">
          {/* Logo + Mobile menu button */}
          <div className="flex items-center gap-3">
            <button
              className="md:hidden p-2 -ml-2"
              onClick={() => setSidebarOpen(!sidebarOpen)}
              aria-label="Toggle menu"
            >
              {sidebarOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>

            <Link to={config.dashboardLink} className="flex items-center gap-2">
              <img src={BRANDING.logoPrimary} alt="TORP" className="h-8 w-auto" />
              <span className="font-semibold text-lg hidden sm:inline">TORP</span>
              {config.badge && (
                <span
                  className={cn('text-xs px-2 py-0.5 rounded font-medium', config.badgeColor)}
                >
                  {config.badge}
                </span>
              )}
            </Link>
          </div>

          {/* Right side - User menu */}
          <div className="flex items-center gap-3">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="gap-2">
                  {isAdmin ? (
                    <User className="h-4 w-4 text-orange-600" />
                  ) : userType === 'B2B' ? (
                    <Building2 className="h-4 w-4 text-muted-foreground" />
                  ) : (
                    <User className="h-4 w-4 text-muted-foreground" />
                  )}
                  <span className="hidden sm:inline max-w-[150px] truncate">
                    {user?.name || user?.email || 'Mon compte'}
                  </span>
                  <ChevronDown className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <div className="px-2 py-1.5">
                  <div className="text-sm font-medium">{user?.name || 'Utilisateur'}</div>
                  <div className="text-xs text-muted-foreground">{user?.email}</div>
                  {isAdmin && (
                    <div className="text-xs font-medium text-orange-600 mt-1">
                      {role === 'super_admin' ? 'Super Administrateur' : 'Administrateur'}
                    </div>
                  )}
                </div>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => navigate(config.dashboardLink)}>
                  <LayoutDashboard className="h-4 w-4 mr-2" />
                  {isAdmin ? 'Cockpit Admin' : 'Tableau de bord'}
                </DropdownMenuItem>
                {!isAdmin && (
                  <DropdownMenuItem onClick={() => navigate('/profile')}>
                    <User className="h-4 w-4 mr-2" />
                    Mon profil
                  </DropdownMenuItem>
                )}
                {!isAdmin && userType === 'B2B' && (
                  <DropdownMenuItem onClick={() => navigate('/dashboard')}>
                    <Home className="h-4 w-4 mr-2" />
                    Mode B2C
                  </DropdownMenuItem>
                )}
                {!isAdmin && userType === 'B2C' && (
                  <DropdownMenuItem onClick={() => navigate('/pro')}>
                    <Building2 className="h-4 w-4 mr-2" />
                    Mode Pro
                  </DropdownMenuItem>
                )}
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleLogout} className="text-red-600">
                  <LogOut className="h-4 w-4 mr-2" />
                  Déconnexion
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </header>

      {/* LAYOUT CONTENT */}
      <div className="flex">
        {/* Sidebar - Desktop */}
        <aside className="w-64 bg-white border-r min-h-[calc(100vh-4rem)] hidden md:block">
          <nav className="p-4 space-y-1">
            {navItems.map((item) => {
              const isActive = isActiveRoute(item);
              const Icon = item.icon;

              return (
                <Link
                  key={item.href}
                  to={item.href}
                  className={cn(
                    'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors',
                    isActive
                      ? 'bg-primary text-white'
                      : 'text-gray-700 hover:bg-gray-100'
                  )}
                >
                  <Icon className="h-5 w-5" />
                  {item.label}
                </Link>
              );
            })}
          </nav>

          {/* CTA - Hide for admin users */}
          {userType !== 'admin' && userType !== 'super_admin' && (
            <div className="p-4 border-t mt-4">
              <Button className="w-full" onClick={() => navigate(config.newProjectLink)}>
                <PlusCircle className="h-4 w-4 mr-2" />
                {config.newProjectLabel}
              </Button>
            </div>
          )}
        </aside>

        {/* CONDITIONAL SIDEBAR - Mobile */}
        {sidebarOpen && (
          <div className="fixed inset-0 z-40 md:hidden">
            <div
              className="fixed inset-0 bg-black/50"
              onClick={() => setSidebarOpen(false)}
            />
            <aside className="fixed left-0 top-16 bottom-0 w-64 bg-white border-r z-50 overflow-y-auto">
              <nav className="p-4 space-y-1">
                {navItems.map((item) => {
                  const isActive = isActiveRoute(item);
                  const Icon = item.icon;

                  return (
                    <Link
                      key={item.href}
                      to={item.href}
                      onClick={() => setSidebarOpen(false)}
                      className={cn(
                        'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors',
                        isActive
                          ? 'bg-primary text-white'
                          : 'text-gray-700 hover:bg-gray-100'
                      )}
                    >
                      <Icon className="h-5 w-5" />
                      {item.label}
                    </Link>
                  );
                })}
              </nav>

              {/* CTA Mobile - Hide for admin users */}
              {userType !== 'admin' && userType !== 'super_admin' && (
                <div className="p-4 border-t">
                  <Button
                    className="w-full"
                    onClick={() => {
                      setSidebarOpen(false);
                      navigate(config.newProjectLink);
                    }}
                  >
                    <PlusCircle className="h-4 w-4 mr-2" />
                    {config.newProjectLabel}
                  </Button>
                </div>
              )}
            </aside>
          </div>
        )}

        {/* Main content */}
        <main className="flex-1 p-4 md:p-6 min-h-[calc(100vh-4rem)]">
          {children}
        </main>
      </div>
    </div>
  );
}

export default AppLayout;
