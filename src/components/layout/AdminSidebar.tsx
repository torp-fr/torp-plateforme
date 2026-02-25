/**
 * Admin Sidebar Component (Phase 29.1)
 * Specialized navigation for admin users
 * Replaces the standard sidebar with admin-specific menu items
 */

import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  BarChart3,
  Database,
  Shield,
  Zap,
  AlertTriangle,
  Plug,
  FileText,
  Cog,
  Users,
  BookOpen,
  TrendingUp,
  ChevronDown,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

interface AdminNavItem {
  id: string;
  href: string;
  icon: React.ElementType;
  label: string;
  description?: string;
}

// Admin navigation sections
const ADMIN_SECTIONS = {
  monitoring: {
    title: 'MONITORING',
    items: [
      {
        id: 'dashboard',
        href: '/analytics',
        icon: LayoutDashboard,
        label: 'Dashboard Global',
        description: 'Vue d\'ensemble plateforme',
      },
      {
        id: 'orchestration',
        href: '/analytics/orchestrations',
        icon: Zap,
        label: 'Cockpit d\'Orchestration',
        description: 'Status des moteurs',
      },
      {
        id: 'fraud',
        href: '/analytics/security',
        icon: AlertTriangle,
        label: 'Surveillance Fraude',
        description: 'Détection & patterns',
      },
      {
        id: 'adaptive',
        href: '/analytics/intelligence',
        icon: TrendingUp,
        label: 'Monitoring Adaptatif',
        description: 'Impacts & ajustements',
      },
    ],
  },
  knowledge: {
    title: 'GESTION DU SAVOIR',
    items: [
      {
        id: 'kb',
        href: '/analytics/knowledge',
        icon: BookOpen,
        label: 'Base de Connaissances',
        description: 'Documents & ingestion',
      },
      {
        id: 'doctrine',
        href: '/analytics/settings',
        icon: Shield,
        label: 'Doctrine & Normes',
        description: 'Règles & jurisprudence',
      },
    ],
  },
  administration: {
    title: 'ADMINISTRATION',
    items: [
      {
        id: 'apis',
        href: '/analytics/system',
        icon: Plug,
        label: 'APIs Externes',
        description: 'Services intégrés',
      },
      {
        id: 'users',
        href: '/admin/users',
        icon: Users,
        label: 'Gestion Utilisateurs',
        description: 'Rôles & permissions',
      },
      {
        id: 'logs',
        href: '/analytics/system',
        icon: FileText,
        label: 'Logs Système',
        description: 'Audit trail',
      },
      {
        id: 'config',
        href: '/analytics/settings',
        icon: Cog,
        label: 'Configuration',
        description: 'Paramètres plateforme',
      },
    ],
  },
};

interface AdminSidebarProps {
  collapsed?: boolean;
  userEmail?: string;
  onClose?: () => void;
}

export function AdminSidebar({ collapsed = false, userEmail, onClose }: AdminSidebarProps) {
  const location = useLocation();

  const isActiveRoute = (href: string): boolean => {
    return location.pathname === href;
  };

  const renderNavItem = (item: AdminNavItem) => {
    const Icon = item.icon;
    const isActive = isActiveRoute(item.href);

    return (
      <Link
        key={item.id}
        to={item.href}
        onClick={onClose}
        className={cn(
          'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors mb-1',
          isActive
            ? 'bg-primary text-white shadow-md'
            : 'text-gray-700 hover:bg-gray-100'
        )}
        title={item.description}
      >
        <Icon className="h-5 w-5 flex-shrink-0" />
        <span className="truncate">{item.label}</span>
      </Link>
    );
  };

  return (
    <div className="flex flex-col h-full bg-white">
      {/* Main Navigation */}
      <nav className="flex-1 p-4 space-y-6 overflow-y-auto">
        {/* Monitoring Section */}
        <div>
          <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider px-3 mb-2">
            {ADMIN_SECTIONS.monitoring.title}
          </div>
          <div className="space-y-1">
            {ADMIN_SECTIONS.monitoring.items.map(renderNavItem)}
          </div>
        </div>

        {/* Knowledge Section */}
        <div>
          <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider px-3 mb-2">
            {ADMIN_SECTIONS.knowledge.title}
          </div>
          <div className="space-y-1">
            {ADMIN_SECTIONS.knowledge.items.map(renderNavItem)}
          </div>
        </div>

        {/* Administration Section */}
        <div>
          <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider px-3 mb-2">
            {ADMIN_SECTIONS.administration.title}
          </div>
          <div className="space-y-1">
            {ADMIN_SECTIONS.administration.items.map(renderNavItem)}
          </div>
        </div>
      </nav>

      {/* Footer Section - Admin Info */}
      <div className="p-4 border-t space-y-3">
        <div className="p-3 rounded-lg bg-orange-50 border border-orange-200">
          <div className="text-xs font-semibold text-orange-900 uppercase tracking-wider flex items-center gap-2">
            <Shield className="h-4 w-4" />
            Administrateur
          </div>
          <div className="text-xs text-orange-700 mt-1 truncate">
            {userEmail || 'Admin'}
          </div>
        </div>
        <p className="text-xs text-gray-500 px-3">
          Plateforme TORP • Cockpit d'Orchestration
        </p>
      </div>
    </div>
  );
}

export default AdminSidebar;
