/**
 * AppLayout Component
 * Layout unifié qui s'adapte au type d'utilisateur (B2C/B2B/B2G)
 * Fournit le sidebar et le header pour toutes les pages protégées
 */

import { ReactNode, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  FileSearch,
  PlusCircle,
  FolderOpen,
  Settings,
  Building2,
  LogOut,
  Menu,
  X,
  ChevronDown,
  Briefcase,
  FileText,
  Home,
  Hammer,
  User,
  Landmark,
  Scale,
  Users,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useApp } from '@/context/AppContext';
import { NotificationBell } from '@/components/notifications/NotificationBell';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { authService } from '@/services/api';
import { useToast } from '@/hooks/use-toast';
import { useProfile } from '@/hooks/useProfile';
import torpLogo from '@/assets/torp-logo-red.png';

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
  { href: '/phase0/dashboard', icon: Briefcase, label: 'Mes projets' },
  { href: '/analyze', icon: FileSearch, label: 'Analyser un devis' },
  { href: '/compare', icon: Scale, label: 'Comparer devis' },
  { href: '/profile', icon: User, label: 'Mon profil' },
];

// Navigation pour B2B (professionnels)
const B2B_NAV_ITEMS: NavItem[] = [
  { href: '/pro', icon: LayoutDashboard, label: 'Tableau de bord', exact: true },
  { href: '/pro/projects', icon: Briefcase, label: 'Mes projets' },
  { href: '/pro/documents', icon: FileText, label: 'Documents' },
  { href: '/b2b/ao', icon: FolderOpen, label: 'Appels d\'offres' },
  { href: '/pro/analyses', icon: FileSearch, label: 'Analyses devis' },
  { href: '/pro/settings', icon: Settings, label: 'Paramètres' },
];

// Navigation pour B2G (collectivités)
const B2G_NAV_ITEMS: NavItem[] = [
  { href: '/dashboard', icon: LayoutDashboard, label: 'Tableau de bord', exact: true },
  { href: '/phase0/dashboard', icon: Briefcase, label: 'Marchés en cours' },
  { href: '/tenders', icon: FolderOpen, label: 'Appels d\'offres' },
  { href: '/pro/documents', icon: FileText, label: 'Documents' },
  { href: '/profile', icon: Landmark, label: 'Ma collectivité' },
];

// Configuration par type d'utilisateur
const USER_TYPE_CONFIG = {
  B2C: {
    label: 'Particulier',
    badge: null,
    navItems: B2C_NAV_ITEMS,
    newProjectLink: '/phase0/new',
    newProjectLabel: 'Nouveau projet',
    dashboardLink: '/dashboard',
  },
  B2B: {
    label: 'Professionnel',
    badge: 'PRO',
    badgeColor: 'bg-blue-100 text-blue-700',
    navItems: B2B_NAV_ITEMS,
    newProjectLink: '/pro/projects/new',
    newProjectLabel: 'Nouveau projet',
    dashboardLink: '/pro',
  },
  B2G: {
    label: 'Collectivité',
    badge: 'B2G',
    badgeColor: 'bg-purple-100 text-purple-700',
    navItems: B2G_NAV_ITEMS,
    newProjectLink: '/phase0/new',
    newProjectLabel: 'Nouveau marché',
    dashboardLink: '/dashboard',
  },
  admin: {
    label: 'Administrateur',
    badge: 'ADMIN',
    badgeColor: 'bg-orange-100 text-orange-700',
    navItems: B2B_NAV_ITEMS, // Admins can access B2B features
    newProjectLink: '/admin-dashboard',
    newProjectLabel: 'Administration',
    dashboardLink: '/admin-dashboard',
  },
  super_admin: {
    label: 'Super Admin',
    badge: 'SUPER',
    badgeColor: 'bg-red-100 text-red-700',
    navItems: B2B_NAV_ITEMS, // Super admins can access all features
    newProjectLink: '/admin/analytics',
    newProjectLabel: 'Administration',
    dashboardLink: '/admin/analytics',
  },
};

export function AppLayout({ children }: AppLayoutProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, userType, setUser } = useApp();
  const { toast } = useToast();
  const { labels, mainRoutes, defaultRoute, profileName, profileColor } = useProfile();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Déterminer la configuration selon le type d'utilisateur
  const config = USER_TYPE_CONFIG[userType as keyof typeof USER_TYPE_CONFIG] || USER_TYPE_CONFIG.B2C;

  // Utiliser les labels dynamiques du profil
  const newProjectLabel = labels.newProjectLabel;

  // Adapter les labels de navigation selon le profil
  const navItems = config.navItems.map(item => {
    // Remplacer les labels génériques par ceux du profil
    if (item.href === '/phase0/dashboard') {
      return { ...item, label: labels.projectNamePlural };
    }
    if (item.href === '/analyze') {
      return { ...item, label: labels.analyzeLabel };
    }
    if (item.href === '/pro/projects') {
      return { ...item, label: labels.projectNamePlural };
    }
    return item;
  });

  const handleLogout = async () => {
    try {
      await authService.logout();
      setUser(null);
      toast({
        title: 'Déconnexion réussie',
        description: 'À bientôt!',
      });
      navigate('/login');
    } catch (error) {
      console.error('Logout error:', error);
      setUser(null);
      navigate('/login');
    }
  };

  const isActiveRoute = (item: NavItem) => {
    if (item.exact) {
      return location.pathname === item.href;
    }
    return location.pathname.startsWith(item.href);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
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
              <img src={torpLogo} alt="TORP" className="h-8 w-auto" />
              <span className="font-semibold text-lg hidden sm:inline">TORP</span>
              {config.badge && (
                <span className={cn(
                  "text-xs px-2 py-0.5 rounded font-medium",
                  config.badgeColor
                )}>
                  {config.badge}
                </span>
              )}
            </Link>
          </div>

          {/* Right side */}
          <div className="flex items-center gap-3">
            <NotificationBell />

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="gap-2">
                  {userType === 'B2B' ? (
                    <Building2 className="h-4 w-4 text-muted-foreground" />
                  ) : userType === 'B2G' ? (
                    <Landmark className="h-4 w-4 text-muted-foreground" />
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
                </div>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => navigate(config.dashboardLink)}>
                  <LayoutDashboard className="h-4 w-4 mr-2" />
                  Tableau de bord
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => navigate('/profile')}>
                  <User className="h-4 w-4 mr-2" />
                  Mon profil
                </DropdownMenuItem>
                {userType === 'B2B' && (
                  <DropdownMenuItem onClick={() => navigate('/dashboard')}>
                    <Home className="h-4 w-4 mr-2" />
                    Mode B2C
                  </DropdownMenuItem>
                )}
                {userType === 'B2C' && (
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

          {/* CTA */}
          <div className="p-4 border-t mt-4">
            <Button className="w-full" onClick={() => navigate(config.newProjectLink)}>
              <PlusCircle className="h-4 w-4 mr-2" />
              {newProjectLabel}
            </Button>
          </div>
        </aside>

        {/* Sidebar - Mobile */}
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

              {/* CTA Mobile */}
              <div className="p-4 border-t">
                <Button
                  className="w-full"
                  onClick={() => {
                    setSidebarOpen(false);
                    navigate(config.newProjectLink);
                  }}
                >
                  <PlusCircle className="h-4 w-4 mr-2" />
                  {newProjectLabel}
                </Button>
              </div>
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
