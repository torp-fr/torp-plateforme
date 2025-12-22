/**
 * ChantierLayout - Layout contextuel pour les pages de chantier
 * Fournit une sous-navigation compacte entre les phases (Phase 2-5)
 * S'adapte au profil utilisateur (B2C/B2B/B2G)
 * NOTE: Sidebar removed to prevent duplication with AppLayout's sidebar
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
  Building2,
  AlertTriangle,
  TrendingUp,
  ClipboardCheck,
  FileCheck,
  FolderOpen,
  BookOpen,
  Wrench,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useApp } from '@/context/AppContext';
import { ChantierService } from '@/services/phase2';
import type { Chantier } from '@/types/phase2';
import { AppLayout } from './AppLayout';

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

const STATUT_LABELS: Record<string, { label: string; color: string }> = {
  preparation: { label: 'En préparation', color: 'bg-yellow-500' },
  ordre_service: { label: 'OS émis', color: 'bg-blue-500' },
  en_cours: { label: 'En cours', color: 'bg-green-500' },
  suspendu: { label: 'Suspendu', color: 'bg-orange-500' },
  reception: { label: 'Réception', color: 'bg-purple-500' },
  garantie_parfait_achevement: { label: 'GPA', color: 'bg-indigo-500' },
  clos: { label: 'Clos', color: 'bg-gray-500' },
};

export function ChantierLayout() {
  const { projectId } = useParams<{ projectId: string }>();
  const location = useLocation();
  const navigate = useNavigate();
  const { userType } = useApp();
  const [chantier, setChantier] = useState<Chantier | null>(null);
  const [loading, setLoading] = useState(true);


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

  // Déterminer la phase et l'item actifs
  const getActivePhaseAndItem = () => {
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

  const activePhaseAndItem = getActivePhaseAndItem();
  const activeSection = activePhaseAndItem?.section;

  return (
    <AppLayout>
      <div className="space-y-4">
        {/* Chantier Header with Back Button and Info */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate('/chantiers')}
            >
              <ChevronLeft className="h-4 w-4 mr-1" />
              Mes chantiers
            </Button>
            {chantier && (
              <div className="flex items-center gap-3">
                <Building2 className="h-5 w-5 text-primary" />
                <div>
                  <h1 className="font-semibold">{chantier.nom}</h1>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Badge className={STATUT_LABELS[chantier.statut]?.color || 'bg-gray-500'}>
                      {STATUT_LABELS[chantier.statut]?.label || chantier.statut}
                    </Badge>
                    <span>•</span>
                    <span>Avancement: {chantier.avancementGlobal}%</span>
                  </div>
                </div>
              </div>
            )}
            {loading && !chantier && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary" />
                Chargement...
              </div>
            )}
          </div>
          {chantier && (
            <div className="hidden md:block w-48">
              <Progress value={chantier.avancementGlobal} className="h-2" />
            </div>
          )}
        </div>

        {/* Phase Tabs Navigation */}
        <div className="border-b">
          <Tabs value={activeSection?.id || 'preparation'} className="w-full">
            <TabsList className="w-full justify-start h-auto p-0 bg-transparent gap-0">
              {CHANTIER_NAV.map((section) => (
                <TabsTrigger
                  key={section.id}
                  value={section.id}
                  className={cn(
                    'rounded-none border-b-2 border-transparent px-4 py-3 data-[state=active]:border-primary data-[state=active]:bg-transparent',
                    activeSection?.id === section.id && 'border-primary'
                  )}
                  onClick={() => navigate(buildLink(section.items[0].href))}
                >
                  {getLabel(section)}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
        </div>

        {/* Sub-navigation for active phase */}
        {activeSection && (
          <div className="flex items-center gap-2 flex-wrap">
            {activeSection.items.map((item) => {
              const href = buildLink(item.href);
              const isActive = activePhaseAndItem?.item.href === item.href;
              const Icon = item.icon;

              return (
                <Link key={item.href} to={href}>
                  <Button
                    variant={isActive ? 'default' : 'outline'}
                    size="sm"
                    className="gap-2"
                  >
                    <Icon className="h-4 w-4" />
                    {getLabel(item)}
                    {item.badge && (
                      <Badge className={cn('text-xs ml-1', item.badgeColor || 'bg-primary')}>
                        {item.badge}
                      </Badge>
                    )}
                  </Button>
                </Link>
              );
            })}
          </div>
        )}

        {/* Contenu principal */}
        <main className="min-h-[calc(100vh-16rem)]">
          <Outlet />
        </main>
      </div>
    </AppLayout>
  );
}

export default ChantierLayout;
