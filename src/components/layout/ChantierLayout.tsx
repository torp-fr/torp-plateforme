/**
 * ChantierLayout - Layout contextuel pour les pages de chantier
 * Fournit une sous-navigation entre Phase 2 (Préparation) et Phase 3 (Exécution)
 * S'adapte au profil utilisateur (B2C/B2B/B2G)
 */

import React, { useState, useEffect } from 'react';
import { Link, useParams, useLocation, Outlet, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  Calendar,
  Users,
  FileText,
  Shield,
  MessageSquare,
  Receipt,
  ChevronLeft,
  ChevronRight,
  Building2,
  AlertTriangle,
  CheckCircle2,
  Clock,
  TrendingUp,
  ClipboardCheck,
  FileCheck,
  Home,
  FolderOpen,
  BookOpen,
  Wrench,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { useApp } from '@/context/AppContext';
import { ChantierService } from '@/services/phase2';
import type { Chantier } from '@/types/phase2';
import { AppLayout } from './AppLayout';
import { usePreloadPhase, type PhaseNumber } from '@/hooks/usePreloadPhase';

interface NavSection {
  id: string;
  label: string;
  labelB2B?: string;
  labelB2G?: string;
  items: NavItem[];
}

interface NavItem {
  href: string;
  icon: React.ElementType;
  label: string;
  labelB2B?: string;
  labelB2G?: string;
  badge?: string;
  badgeColor?: string;
}

// Navigation structurée par phase
const CHANTIER_NAV: NavSection[] = [
  {
    id: 'preparation',
    label: 'Phase 2 - Préparation',
    labelB2B: 'Préparation chantier',
    labelB2G: 'Préparation marché',
    items: [
      { href: 'phase2:', icon: LayoutDashboard, label: 'Vue d\'ensemble', labelB2B: 'Dashboard', labelB2G: 'Tableau de bord' },
      { href: 'phase2:/planning', icon: Calendar, label: 'Planning', labelB2B: 'Planning Gantt', labelB2G: 'Planning marché' },
      { href: 'phase2:/reunions', icon: Users, label: 'Réunions', labelB2B: 'Réunions chantier', labelB2G: 'Comités de suivi' },
      { href: 'phase2:/journal', icon: FileText, label: 'Journal', labelB2B: 'Journal chantier', labelB2G: 'Registre travaux' },
    ],
  },
  {
    id: 'execution',
    label: 'Phase 3 - Exécution',
    labelB2B: 'Exécution & Suivi',
    labelB2G: 'Exécution marché',
    items: [
      { href: 'phase3:', icon: TrendingUp, label: 'Vue d\'ensemble', labelB2B: 'Dashboard exécution', labelB2G: 'Tableau de bord' },
      { href: 'phase3:/controles', icon: Shield, label: 'Contrôles', labelB2B: 'Contrôles qualité', labelB2G: 'Contrôles réglementaires' },
      { href: 'phase3:/coordination', icon: MessageSquare, label: 'Coordination', labelB2B: 'Coordination équipes', labelB2G: 'Coordination entreprises' },
      { href: 'phase3:/situations', icon: Receipt, label: 'Situations', labelB2B: 'Facturation', labelB2G: 'Situations & Paiements' },
    ],
  },
  {
    id: 'reception',
    label: 'Phase 4 - Réception',
    labelB2B: 'Réception & Garanties',
    labelB2G: 'Réception marché',
    items: [
      { href: 'phase4:', icon: ClipboardCheck, label: 'OPR', labelB2B: 'Opérations préalables', labelB2G: 'OPR marché' },
      { href: 'phase4:/reserves', icon: AlertTriangle, label: 'Réserves', labelB2B: 'Levée réserves', labelB2G: 'Réserves & Levées' },
      { href: 'phase4:/garanties', icon: Shield, label: 'Garanties', labelB2B: 'Suivi garanties', labelB2G: 'Garanties légales' },
      { href: 'phase4:/doe', icon: FolderOpen, label: 'DOE', labelB2B: 'DOE/DIUO', labelB2G: 'Dossier ouvrage' },
    ],
  },
  {
    id: 'maintenance',
    label: 'Phase 5 - Maintenance',
    labelB2B: 'Exploitation & Maintenance',
    labelB2G: 'Gestion patrimoniale',
    items: [
      { href: 'phase5:', icon: BookOpen, label: 'Carnet numérique', labelB2B: 'Carnet du logement', labelB2G: 'Carnet ouvrage' },
      { href: 'phase5:/diagnostics', icon: FileCheck, label: 'Diagnostics', labelB2B: 'Diagnostics immobiliers', labelB2G: 'Diagnostics obligatoires' },
      { href: 'phase5:/entretien', icon: Wrench, label: 'Entretien', labelB2B: 'Planning entretien', labelB2G: 'Maintenance' },
      { href: 'phase5:/sinistres', icon: AlertTriangle, label: 'Sinistres', labelB2B: 'Gestion sinistres', labelB2G: 'Sinistres & Garanties' },
    ],
  },
];

export function ChantierLayout() {
  const { projectId } = useParams<{ projectId: string }>();
  const location = useLocation();
  const navigate = useNavigate();
  const { userType } = useApp();
  const [chantier, setChantier] = useState<Chantier | null>(null);
  const [loading, setLoading] = useState(true);
  const [collapsed, setCollapsed] = useState(false);

  // Déterminer la phase actuelle à partir de l'URL
  const currentPhase = (() => {
    const path = location.pathname;
    if (path.includes('/phase2/')) return 2;
    if (path.includes('/phase3/')) return 3;
    if (path.includes('/phase4/')) return 4;
    if (path.includes('/phase5/')) return 5;
    return 2; // Default
  })() as PhaseNumber;

  // Précharger les phases adjacentes pour une navigation fluide
  usePreloadPhase(currentPhase, { delay: 500 });

  useEffect(() => {
    if (projectId) {
      loadChantier();
    }
  }, [projectId]);

  const loadChantier = async () => {
    if (!projectId) return;
    try {
      const data = await ChantierService.getChantierByProject(projectId);
      setChantier(data);
    } catch (error) {
      console.error('Erreur chargement chantier:', error);
    } finally {
      setLoading(false);
    }
  };

  // Construire le lien complet à partir du href
  const buildLink = (href: string) => {
    // Format: "phaseX:/path" ou "phaseX:" pour index
    const match = href.match(/^(phase\d+):(.*)$/);
    if (match) {
      const [, phase, path] = match;
      return `/${phase}/${projectId}${path}`;
    }
    // Fallback pour anciens formats
    return `/phase2/${projectId}${href}`;
  };

  // Déterminer l'item actif
  const getActiveItem = () => {
    const path = location.pathname;
    for (const section of CHANTIER_NAV) {
      for (const item of section.items) {
        const fullPath = buildLink(item.href);
        if (path === fullPath) {
          return { section, item };
        }
      }
    }
    return null;
  };

  // Obtenir le label selon le profil
  const getLabel = (item: NavItem | NavSection, field: 'label' | 'labelB2B' | 'labelB2G' = 'label') => {
    if (userType === 'B2B' && item.labelB2B) return item.labelB2B;
    if (userType === 'B2G' && item.labelB2G) return item.labelB2G;
    return item.label;
  };

  const activeItem = getActiveItem();

  const STATUT_LABELS: Record<string, { label: string; color: string }> = {
    preparation: { label: 'En préparation', color: 'bg-yellow-500' },
    ordre_service: { label: 'OS émis', color: 'bg-blue-500' },
    en_cours: { label: 'En cours', color: 'bg-green-500' },
    suspendu: { label: 'Suspendu', color: 'bg-orange-500' },
    reception: { label: 'Réception', color: 'bg-purple-500' },
    garantie_parfait_achevement: { label: 'GPA', color: 'bg-indigo-500' },
    clos: { label: 'Clos', color: 'bg-gray-500' },
  };

  return (
    <AppLayout>
      <div className="flex h-full min-h-[calc(100vh-4rem)] -m-4 md:-m-6">
        {/* Sidebar contextuel chantier */}
        <aside
          className={cn(
            'bg-white border-r transition-all duration-300 flex flex-col',
            collapsed ? 'w-16' : 'w-64'
          )}
        >
          {/* En-tête chantier */}
          <div className={cn('p-4 border-b', collapsed && 'p-2')}>
            {!collapsed && chantier && (
              <>
                <div className="flex items-center justify-between mb-2">
                  <h2 className="font-semibold text-sm truncate">{chantier.nom}</h2>
                  <Badge className={STATUT_LABELS[chantier.statut]?.color || 'bg-gray-500'}>
                    {STATUT_LABELS[chantier.statut]?.label || chantier.statut}
                  </Badge>
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>Avancement</span>
                    <span>{chantier.avancementGlobal}%</span>
                  </div>
                  <Progress value={chantier.avancementGlobal} className="h-1.5" />
                </div>
              </>
            )}
            {loading && !chantier && !collapsed && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary" />
                Chargement...
              </div>
            )}
            {collapsed && (
              <div className="flex justify-center">
                <Building2 className="h-6 w-6 text-primary" />
              </div>
            )}
          </div>

          {/* Navigation */}
          <nav className="flex-1 overflow-y-auto p-2">
            {CHANTIER_NAV.map((section) => (
              <div key={section.id} className="mb-4">
                {!collapsed && (
                  <div className="px-3 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    {getLabel(section)}
                  </div>
                )}
                <div className="space-y-1">
                  {section.items.map((item) => {
                    const href = buildLink(item.href);
                    const isActive = activeItem?.item.href === item.href;
                    const Icon = item.icon;

                    return (
                      <Link
                        key={item.href}
                        to={href}
                        className={cn(
                          'flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors relative',
                          isActive
                            ? 'bg-primary text-white'
                            : 'text-gray-700 hover:bg-gray-100',
                          collapsed && 'justify-center px-2'
                        )}
                        title={collapsed ? getLabel(item) : undefined}
                      >
                        <Icon className={cn('h-5 w-5', collapsed && 'h-6 w-6')} />
                        {!collapsed && (
                          <>
                            <span className="flex-1">{getLabel(item)}</span>
                            {item.badge && (
                              <Badge className={cn('text-xs', item.badgeColor || 'bg-primary')}>
                                {item.badge}
                              </Badge>
                            )}
                          </>
                        )}
                        {collapsed && item.badge && (
                          <span className="absolute -top-1 -right-1 h-2 w-2 bg-green-500 rounded-full" />
                        )}
                      </Link>
                    );
                  })}
                </div>
              </div>
            ))}
          </nav>

          {/* Bouton collapse */}
          <div className="p-2 border-t">
            <Button
              variant="ghost"
              size="sm"
              className="w-full"
              onClick={() => setCollapsed(!collapsed)}
            >
              {collapsed ? (
                <ChevronRight className="h-4 w-4" />
              ) : (
                <>
                  <ChevronLeft className="h-4 w-4 mr-2" />
                  <span>Réduire</span>
                </>
              )}
            </Button>
          </div>

          {/* Retour chantiers */}
          <div className={cn('p-2 border-t', collapsed && 'p-1')}>
            <Button
              variant="outline"
              size="sm"
              className={cn('w-full', collapsed && 'p-2')}
              onClick={() => navigate('/chantiers')}
            >
              <ChevronLeft className="h-4 w-4" />
              {!collapsed && <span className="ml-2">Mes chantiers</span>}
            </Button>
          </div>
        </aside>

        {/* Contenu principal */}
        <main className="flex-1 overflow-auto p-4 md:p-6">
          <Outlet />
        </main>
      </div>
    </AppLayout>
  );
}

export default ChantierLayout;
