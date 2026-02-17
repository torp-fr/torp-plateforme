/**
 * MainLayout - Layout principal UNIFIÉ avec sidebar FIXE
 * Le sidebar ne change JAMAIS - navigation stable et prévisible
 */

import React, { ReactNode, useState } from 'react';
import { Link, useLocation, useNavigate, Outlet } from 'react-router-dom';
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
  User,
  Sparkles,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useApp } from '@/context/AppContext';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { useToast } from '@/hooks/use-toast';
import torpLogo from '@/assets/torp-logo-red.png';
import { AdminInitializer } from '@/components/admin/AdminInitializer';

interface MainLayoutProps {
  children?: ReactNode;
}

interface NavItem {
  id: string;
  href: string;
  icon: React.ElementType;
  label: string;
  exact?: boolean;
  badge?: string | number;
  show?: 'always' | 'b2b-only' | 'b2c-only';
}

interface NavSection {
  id: string;
  title: string;
  items: NavItem[];
}

// Navigation FIXE - ne change JAMAIS
const NAV_SECTIONS: NavSection[] = [
  {
    id: 'main',
    title: '',
    items: [
      {
        id: 'dashboard',
        href: '/dashboard',
        icon: LayoutDashboard,
        label: 'Tableau de bord',
        exact: true,
        show: 'always',
      },
    ],
  },
  {
    id: 'valorization',
    title: 'Valorisation',
    items: [
      {
        id: 'new-valorization',
        href: '/analyze',
        icon: PlusCircle,
        label: 'Nouveau projet',
        show: 'b2c-only',
      },
      {
        id: 'my-analyses',
        href: '/projets',
        icon: FileSearch,
        label: 'Mes projets & analyses',
        show: 'b2c-only',
      },
    ],
  },
  {
    id: 'account',
    title: 'Compte',
    items: [
      {
        id: 'company',
        href: '/pro/company',
        icon: Building2,
        label: 'Mon entreprise',
        show: 'b2c-only',
      },
      {
        id: 'settings',
        href: '/parametres',
        icon: Settings,
        label: 'Paramètres',
        show: 'b2c-only',
      },
    ],
  },
];

export function MainLayout({ children }: MainLayoutProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, userType, logout } = useApp();
  const { toast } = useToast();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const isB2B = userType === 'B2B';
  const isAdmin = userType === 'admin' || userType === 'super_admin';

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

  const isActiveRoute = (item: NavItem) => {
    if (item.exact) {
      return location.pathname === item.href;
    }
    return location.pathname.startsWith(item.href);
  };

  const shouldShowItem = (item: NavItem) => {
    if (item.show === 'always') return true;
    if (item.show === 'b2b-only' && isB2B) return true;
    if (item.show === 'b2c-only' && !isB2B && !isAdmin) return true;
    return false;
  };

  const renderNavItem = (item: NavItem) => {
    if (!shouldShowItem(item)) return null;

    const isActive = isActiveRoute(item);
    const Icon = item.icon;

    return (
      <Link
        key={item.id}
        to={item.href}
        onClick={() => setSidebarOpen(false)}
        className={cn(
          'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors',
          isActive
            ? 'bg-sidebar-primary text-sidebar-primary-foreground font-medium'
            : 'text-sidebar-foreground hover:bg-sidebar-accent'
        )}
      >
        <Icon className={cn('h-5 w-5', isActive && 'text-white')} />
        <span className="flex-1">{item.label}</span>
        {item.badge && (
          <Badge variant="secondary" className="text-xs">
            {item.badge}
          </Badge>
        )}
      </Link>
    );
  };

  const renderSection = (section: NavSection) => {
    const visibleItems = section.items.filter(shouldShowItem);
    if (visibleItems.length === 0) return null;

    return (
      <div key={section.id} className="mb-4">
        {section.title && (
          <div className="px-3 py-2 text-xs font-semibold text-sidebar-foreground/60 uppercase tracking-wider">
            {section.title}
          </div>
        )}
        <div className="space-y-1">
          {visibleItems.map(renderNavItem)}
        </div>
      </div>
    );
  };

  const SidebarContent = () => (
    <>
      {/* Logo */}
      <div className="p-4 border-b border-sidebar-border">
        <Link to="/dashboard" className="flex items-center gap-3">
          <img src={torpLogo} alt="TORP" className="h-10 w-auto" />
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-lg text-sidebar-foreground">TORP</span>
              {isB2B && (
                <Badge className="bg-sidebar-primary text-sidebar-primary-foreground text-xs">PRO</Badge>
              )}
            </div>
            <span className="text-xs text-sidebar-foreground/60">Gestion BTP Intelligente</span>
          </div>
        </Link>
      </div>

      {/* Navigation */}
      <ScrollArea className="flex-1 p-3">
        {NAV_SECTIONS.map(renderSection)}
      </ScrollArea>

      {/* Footer utilisateur */}
      <div className="p-3 border-t border-sidebar-border bg-sidebar-accent">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="w-full flex items-center gap-3 p-2 rounded-lg hover:bg-sidebar-accent/80 transition-colors text-left">
              <div className="h-9 w-9 rounded-full bg-sidebar-primary/20 flex items-center justify-center">
                <span className="text-sm font-medium text-sidebar-primary-foreground">
                  {user?.email?.charAt(0).toUpperCase() || 'U'}
                </span>
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium truncate text-sidebar-foreground">
                  {user?.name || user?.email || 'Utilisateur'}
                </div>
                <div className="text-xs text-sidebar-foreground/60">
                  {userType === 'admin' ? 'Administrateur' : userType === 'super_admin' ? 'Super Admin' : userType === 'B2B' ? 'Professionnel' : 'Particulier'}
                </div>
              </div>
              <ChevronDown className="h-4 w-4 text-sidebar-foreground/60" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuItem onClick={() => navigate('/profile')}>
              <User className="h-4 w-4 mr-2" />
              Mon profil
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => navigate('/settings')}>
              <Settings className="h-4 w-4 mr-2" />
              Paramètres
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleLogout} className="text-destructive">
              <LogOut className="h-4 w-4 mr-2" />
              Déconnexion
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </>
  );

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Admin Initializer Dialog */}
      {user?.email && <AdminInitializer userEmail={user.email} />}

      {/* Header mobile */}
      <header className="md:hidden bg-background border-b sticky top-0 z-50">
        <div className="flex items-center justify-between h-14 px-4">
          <div className="flex items-center gap-3">
            <button
              className="p-2 -ml-2"
              onClick={() => setSidebarOpen(!sidebarOpen)}
              aria-label="Menu"
            >
              {sidebarOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
            <Link to="/dashboard" className="flex items-center gap-2">
              <img src={torpLogo} alt="TORP" className="h-8 w-auto" />
              <span className="font-bold">TORP</span>
            </Link>
          </div>
          <div className="flex items-center gap-2">
          </div>
        </div>
      </header>

      <div className="flex">
        {/* Sidebar Desktop - FIXE */}
        <aside className="hidden md:flex md:flex-col w-64 bg-sidebar text-sidebar-foreground min-h-screen fixed left-0 top-0 border-r border-sidebar-border">
          <SidebarContent />
        </aside>

        {/* Sidebar Mobile */}
        {sidebarOpen && (
          <div className="fixed inset-0 z-40 md:hidden">
            <div
              className="fixed inset-0 bg-black/50"
              onClick={() => setSidebarOpen(false)}
            />
            <aside className="fixed left-0 top-14 bottom-0 w-64 bg-sidebar text-sidebar-foreground border-r border-sidebar-border z-50 flex flex-col">
              <ScrollArea className="flex-1 p-3">
                {NAV_SECTIONS.map(renderSection)}
              </ScrollArea>
            </aside>
          </div>
        )}

        {/* Main content */}
        <main className="flex-1 md:ml-64 min-h-screen bg-background">
          {/* Header Desktop */}
          <header className="hidden md:flex bg-background border-b h-14 items-center justify-between px-6 sticky top-0 z-40">
            <div className="flex items-center gap-4">
              <Sparkles className="h-5 w-5 text-primary" />
              <span className="text-sm text-muted-foreground">
                Valorisation intelligente de vos devis BTP
              </span>
            </div>
          </header>

          {/* Content */}
          <div className="p-4 md:p-6">
            {children || <Outlet />}
          </div>
        </main>
      </div>
    </div>
  );
}

export default MainLayout;
