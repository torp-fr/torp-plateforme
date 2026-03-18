/**
 * UserLayout - Layout EXCLUSIF pour les utilisateurs standards
 * Structure complètement dédiée aux pages utilisateur
 * Aucune logique conditionnelle basée sur userType
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
import { BRANDING } from '@/config/branding';

interface UserLayoutProps {
  children?: ReactNode;
}

interface NavItem {
  id: string;
  href: string;
  icon: React.ElementType;
  label: string;
  exact?: boolean;
}

interface NavSection {
  id: string;
  title: string;
  items: NavItem[];
}

// Navigation UTILISATEUR - Ne change JAMAIS
const USER_NAV_SECTIONS: NavSection[] = [
  {
    id: 'main',
    title: '',
    items: [
      {
        id: 'dashboard',
        href: '/dashboard',
        icon: LayoutDashboard,
        label: 'Dashboard',
        exact: true,
      },
    ],
  },
  {
    id: 'projects',
    title: 'Projects',
    items: [
      {
        id: 'new-project',
        href: '/analyze',
        icon: PlusCircle,
        label: 'New Project',
      },
      {
        id: 'my-projects',
        href: '/projects',
        icon: FileSearch,
        label: 'My Projects',
      },
    ],
  },
  {
    id: 'account',
    title: 'Account',
    items: [
      {
        id: 'company',
        href: '/company',
        icon: Building2,
        label: 'Company',
      },
      {
        id: 'settings',
        href: '/settings',
        icon: Settings,
        label: 'Settings',
      },
    ],
  },
];

export function UserLayout({ children }: UserLayoutProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useApp();
  const { toast } = useToast();
  const [sidebarOpen, setSidebarOpen] = useState(false);

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

  const renderNavItem = (item: NavItem) => {
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
      </Link>
    );
  };

  const renderSection = (section: NavSection) => {
    return (
      <div key={section.id} className="mb-4">
        {section.title && (
          <div className="px-3 py-2 text-xs font-semibold text-sidebar-foreground/60 uppercase tracking-wider">
            {section.title}
          </div>
        )}
        <div className="space-y-1">
          {section.items.map(renderNavItem)}
        </div>
      </div>
    );
  };

  const SidebarContent = () => (
    <>
      {/* Logo */}
      <div className="p-4 border-b border-sidebar-border">
        <Link to="/dashboard" className="flex items-center gap-3">
          <img src={BRANDING.logoPrimary} alt="TORP" className="h-10 w-auto" />
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-lg text-sidebar-foreground">TORP</span>
            </div>
            <span className="text-xs text-sidebar-foreground/60">User Dashboard</span>
          </div>
        </Link>
      </div>

      {/* Navigation */}
      <ScrollArea className="flex-1 p-3">
        {USER_NAV_SECTIONS.map(renderSection)}
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
                  {user?.name || user?.email || 'User'}
                </div>
                <div className="text-xs text-sidebar-foreground/60">
                  User Account
                </div>
              </div>
              <ChevronDown className="h-4 w-4 text-sidebar-foreground/60" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuItem onClick={() => navigate('/dashboard')}>
              <LayoutDashboard className="h-4 w-4 mr-2" />
              Dashboard
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => navigate('/settings')}>
              <Settings className="h-4 w-4 mr-2" />
              Settings
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleLogout} className="text-destructive">
              <LogOut className="h-4 w-4 mr-2" />
              Logout
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </>
  );

  return (
    <div className="min-h-screen bg-gray-50">
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
              <img src={BRANDING.logoPrimary} alt="TORP" className="h-8 w-auto" />
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
                {USER_NAV_SECTIONS.map(renderSection)}
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
                Smart quote analysis and project management
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

export default UserLayout;
