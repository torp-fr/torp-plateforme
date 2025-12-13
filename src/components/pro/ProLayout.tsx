/**
 * ProLayout Component
 * Layout pour les pages B2B professionnelles
 */

import { ReactNode } from 'react';
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
import { useState } from 'react';
import torpLogo from '@/assets/torp-logo-red.png';

interface ProLayoutProps {
  children: ReactNode;
}

const NAV_ITEMS = [
  { href: '/pro', icon: LayoutDashboard, label: 'Tableau de bord', exact: true },
  { href: '/pro/projects', icon: Briefcase, label: 'Mes projets' },
  { href: '/pro/documents', icon: FileText, label: 'Documents' },
  { href: '/b2b/ao', icon: FolderOpen, label: 'Appels d\'offres' },
  { href: '/pro/analyses', icon: FileSearch, label: 'Analyses devis' },
  { href: '/pro/settings', icon: Settings, label: 'Paramètres' },
];

export function ProLayout({ children }: ProLayoutProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, setUser } = useApp();
  const { toast } = useToast();
  const [sidebarOpen, setSidebarOpen] = useState(false);

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

  const isActiveRoute = (item: typeof NAV_ITEMS[0]) => {
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
            >
              {sidebarOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>

            <Link to="/pro" className="flex items-center gap-2">
              <img src={torpLogo} alt="TORP" className="h-8 w-auto" />
              <span className="font-semibold text-lg hidden sm:inline">TORP</span>
              <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded font-medium">
                PRO
              </span>
            </Link>
          </div>

          {/* Right side */}
          <div className="flex items-center gap-3">
            <NotificationBell />

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="gap-2">
                  <Building2 className="h-4 w-4 text-muted-foreground" />
                  <span className="hidden sm:inline max-w-[150px] truncate">
                    {user?.name || 'Mon entreprise'}
                  </span>
                  <ChevronDown className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <div className="px-2 py-1.5 text-sm text-muted-foreground">
                  {user?.email}
                </div>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => navigate('/pro/settings')}>
                  <Settings className="h-4 w-4 mr-2" />
                  Paramètres
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => navigate('/dashboard')}>
                  <LayoutDashboard className="h-4 w-4 mr-2" />
                  Mode B2C
                </DropdownMenuItem>
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
            {NAV_ITEMS.map((item) => {
              const isActive = isActiveRoute(item);

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
                  <item.icon className="h-5 w-5" />
                  {item.label}
                </Link>
              );
            })}
          </nav>

          {/* CTA */}
          <div className="p-4 border-t mt-4">
            <Button className="w-full" onClick={() => navigate('/pro/projects/new')}>
              <PlusCircle className="h-4 w-4 mr-2" />
              Nouveau projet
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
            <aside className="fixed left-0 top-16 bottom-0 w-64 bg-white border-r z-50">
              <nav className="p-4 space-y-1">
                {NAV_ITEMS.map((item) => {
                  const isActive = isActiveRoute(item);

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
                      <item.icon className="h-5 w-5" />
                      {item.label}
                    </Link>
                  );
                })}
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

export default ProLayout;
