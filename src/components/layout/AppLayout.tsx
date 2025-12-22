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
  Settings,
  Building2,
  LogOut,
  Menu,
  X,
  ChevronDown,
  Briefcase,
  Home,
  Hammer,
  User,
  Landmark,
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
import { useToast } from '@/hooks/use-toast';
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

interface NavSection {
  id: string;
  label: string | null; // null for items without section header (like Tableau de bord)
  items: NavItem[];
}

// Navigation pour B2C (particuliers) - Structure par catégories
const B2C_NAV_SECTIONS: NavSection[] = [
  {
    id: 'main',
    label: null,
    items: [
      { href: '/dashboard', icon: LayoutDashboard, label: 'Tableau de bord', exact: true },
    ],
  },
  {
    id: 'projets',
    label: 'PROJETS',
    items: [
      { href: '/phase0/new', icon: PlusCircle, label: 'Nouveau projet' },
      { href: '/phase0/dashboard', icon: Briefcase, label: 'Mes projets' },
      { href: '/chantiers', icon: Hammer, label: 'Mes chantiers' },
    ],
  },
  {
    id: 'outils',
    label: 'OUTILS IA',
    items: [
      { href: '/analyze', icon: FileSearch, label: 'Analyser un devis' },
      { href: '/entreprises', icon: Users, label: 'Trouver des entreprises' },
    ],
  },
  {
    id: 'compte',
    label: 'COMPTE',
    items: [
      { href: '/profile', icon: User, label: 'Mon profil' },
      { href: '/settings', icon: Settings, label: 'Paramètres' },
    ],
  },
];

// Navigation pour B2B (professionnels) - Structure par catégories
const B2B_NAV_SECTIONS: NavSection[] = [
  {
    id: 'main',
    label: null,
    items: [
      { href: '/pro', icon: LayoutDashboard, label: 'Tableau de bord', exact: true },
    ],
  },
  {
    id: 'projets',
    label: 'PROJETS',
    items: [
      { href: '/pro/projects/new', icon: PlusCircle, label: 'Nouveau projet' },
      { href: '/pro/projects', icon: Briefcase, label: 'Mes projets' },
      { href: '/chantiers', icon: Hammer, label: 'Mes chantiers' },
    ],
  },
  {
    id: 'outils',
    label: 'OUTILS IA',
    items: [
      { href: '/analyze', icon: FileSearch, label: 'Analyser un devis' },
      { href: '/entreprises', icon: Users, label: 'Trouver des entreprises' },
    ],
  },
  {
    id: 'compte',
    label: 'COMPTE',
    items: [
      { href: '/pro/company', icon: Building2, label: 'Mon entreprise' },
      { href: '/pro/settings', icon: Settings, label: 'Paramètres' },
    ],
  },
];

// Navigation pour B2G (collectivités) - Structure par catégories
const B2G_NAV_SECTIONS: NavSection[] = [
  {
    id: 'main',
    label: null,
    items: [
      { href: '/dashboard', icon: LayoutDashboard, label: 'Tableau de bord', exact: true },
    ],
  },
  {
    id: 'projets',
    label: 'MARCHÉS',
    items: [
      { href: '/phase0/new', icon: PlusCircle, label: 'Nouveau marché' },
      { href: '/phase0/dashboard', icon: Briefcase, label: 'Marchés en cours' },
      { href: '/chantiers', icon: Hammer, label: 'Suivi chantiers' },
    ],
  },
  {
    id: 'outils',
    label: 'OUTILS IA',
    items: [
      { href: '/analyze', icon: FileSearch, label: 'Analyser un devis' },
      { href: '/entreprises', icon: Users, label: 'Trouver des entreprises' },
    ],
  },
  {
    id: 'compte',
    label: 'COMPTE',
    items: [
      { href: '/profile', icon: Landmark, label: 'Ma collectivité' },
      { href: '/settings', icon: Settings, label: 'Paramètres' },
    ],
  },
];

// Flat navigation items for backward compatibility (used by config)
const B2C_NAV_ITEMS: NavItem[] = B2C_NAV_SECTIONS.flatMap(s => s.items);
const B2B_NAV_ITEMS: NavItem[] = B2B_NAV_SECTIONS.flatMap(s => s.items);
const B2G_NAV_ITEMS: NavItem[] = B2G_NAV_SECTIONS.flatMap(s => s.items);

// Configuration par type d'utilisateur
const USER_TYPE_CONFIG = {
  B2C: {
    label: 'Particulier',
    badge: null,
    navItems: B2C_NAV_ITEMS,
    navSections: B2C_NAV_SECTIONS,
    newProjectLink: '/phase0/new',
    newProjectLabel: 'Nouveau projet',
    dashboardLink: '/dashboard',
  },
  B2B: {
    label: 'Professionnel',
    badge: 'PRO',
    badgeColor: 'bg-primary/10 text-primary',
    navItems: B2B_NAV_ITEMS,
    navSections: B2B_NAV_SECTIONS,
    newProjectLink: '/pro/projects/new',
    newProjectLabel: 'Nouveau projet',
    dashboardLink: '/pro',
  },
  B2G: {
    label: 'Collectivité',
    badge: 'B2G',
    badgeColor: 'bg-purple-100 text-purple-700',
    navItems: B2G_NAV_ITEMS,
    navSections: B2G_NAV_SECTIONS,
    newProjectLink: '/phase0/new',
    newProjectLabel: 'Nouveau marché',
    dashboardLink: '/dashboard',
  },
  admin: {
    label: 'Administrateur',
    badge: 'ADMIN',
    badgeColor: 'bg-orange-100 text-orange-700',
    navItems: B2B_NAV_ITEMS,
    navSections: B2B_NAV_SECTIONS,
    newProjectLink: '/admin-dashboard',
    newProjectLabel: 'Administration',
    dashboardLink: '/admin-dashboard',
  },
  super_admin: {
    label: 'Super Admin',
    badge: 'SUPER',
    badgeColor: 'bg-red-100 text-red-700',
    navItems: B2B_NAV_ITEMS,
    navSections: B2B_NAV_SECTIONS,
    newProjectLink: '/admin/analytics',
    newProjectLabel: 'Administration',
    dashboardLink: '/admin/analytics',
  },
};

export function AppLayout({ children }: AppLayoutProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, userType, logout } = useApp();
  const { toast } = useToast();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Déterminer la configuration selon le type d'utilisateur
  const config = USER_TYPE_CONFIG[userType as keyof typeof USER_TYPE_CONFIG] || USER_TYPE_CONFIG.B2C;

  // Adapter les sections de navigation selon le profil
  const navSections = config.navSections;

  const handleLogout = async () => {
    try {
      await logout();
      toast({
        title: 'Déconnexion réussie',
        description: 'À bientôt!',
      });
      // Redirection vers la landing page
      navigate('/');
    } catch (error) {
      console.error('Logout error:', error);
      // Même en cas d'erreur, rediriger vers la landing page
      navigate('/');
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
          <nav className="p-4 space-y-4">
            {navSections.map((section) => (
              <div key={section.id}>
                {section.label && (
                  <div className="px-3 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    {section.label}
                  </div>
                )}
                <div className="space-y-1">
                  {section.items.map((item) => {
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
                </div>
              </div>
            ))}
          </nav>
        </aside>

        {/* Sidebar - Mobile */}
        {sidebarOpen && (
          <div className="fixed inset-0 z-40 md:hidden">
            <div
              className="fixed inset-0 bg-black/50"
              onClick={() => setSidebarOpen(false)}
            />
            <aside className="fixed left-0 top-16 bottom-0 w-64 bg-white border-r z-50 overflow-y-auto">
              <nav className="p-4 space-y-4">
                {navSections.map((section) => (
                  <div key={section.id}>
                    {section.label && (
                      <div className="px-3 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                        {section.label}
                      </div>
                    )}
                    <div className="space-y-1">
                      {section.items.map((item) => {
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
                    </div>
                  </div>
                ))}
              </nav>

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
