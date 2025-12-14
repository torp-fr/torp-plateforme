/**
 * ChantierLayout - Layout contextuel pour les pages de chantier
 * Navigation horizontale (tabs) entre Phase 2 et Phase 3
 * Utilise AppLayout pour le sidebar principal unifié
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
  ArrowLeft,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Card, CardContent } from '@/components/ui/card';
import { useApp } from '@/context/AppContext';
import { ChantierService } from '@/services/phase2';
import type { Chantier } from '@/types/phase2';
import { AppLayout } from './AppLayout';

interface NavItem {
  href: string;
  icon: React.ElementType;
  label: string;
  labelB2B?: string;
  labelB2G?: string;
  badge?: string;
  badgeColor?: string;
  phase: 'preparation' | 'execution';
}

// Navigation horizontale pour les pages chantier
const CHANTIER_NAV: NavItem[] = [
  // Phase 2 - Préparation
  { href: '', icon: LayoutDashboard, label: 'Dashboard', labelB2B: 'Vue d\'ensemble', labelB2G: 'Tableau de bord', phase: 'preparation' },
  { href: '/planning', icon: Calendar, label: 'Planning', labelB2B: 'Planning Gantt', labelB2G: 'Planning marché', phase: 'preparation' },
  { href: '/reunions', icon: Users, label: 'Réunions', labelB2B: 'CR chantier', labelB2G: 'Comités', phase: 'preparation' },
  { href: '/journal', icon: FileText, label: 'Journal', labelB2B: 'Registre', labelB2G: 'Registre travaux', phase: 'preparation' },
  // Phase 3 - Exécution
  { href: '/controles', icon: Shield, label: 'Contrôles', labelB2B: 'Contrôles qualité', labelB2G: 'Contrôles réglementaires', badge: 'Nouveau', badgeColor: 'bg-green-500', phase: 'execution' },
  { href: '/coordination', icon: MessageSquare, label: 'Coordination', labelB2B: 'Coordination', labelB2G: 'Coordination', phase: 'execution' },
  { href: '/situations', icon: Receipt, label: 'Situations', labelB2B: 'Facturation', labelB2G: 'Situations', phase: 'execution' },
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

  // Obtenir le label selon le profil
  const getLabel = (item: NavItem) => {
    if (userType === 'B2B' && item.labelB2B) return item.labelB2B;
    if (userType === 'B2G' && item.labelB2G) return item.labelB2G;
    return item.label;
  };

  // Construire le lien complet
  const buildLink = (item: NavItem) => {
    if (item.phase === 'execution') {
      return `/phase3/${projectId}${item.href}`;
    }
    return `/phase2/${projectId}${item.href}`;
  };

  // Déterminer si l'item est actif
  const isActive = (item: NavItem) => {
    const currentPath = location.pathname;
    const itemPath = buildLink(item);

    // Pour le dashboard (href vide), vérifier match exact
    if (item.href === '') {
      return currentPath === `/phase2/${projectId}` || currentPath === `/phase2/${projectId}/dashboard`;
    }

    return currentPath === itemPath;
  };

  const statutConfig = chantier ? STATUT_LABELS[chantier.statut] : null;

  return (
    <AppLayout>
      <div className="space-y-4">
        {/* Header du chantier avec navigation */}
        <div className="bg-white rounded-lg border shadow-sm">
          {/* Info chantier */}
          <div className="p-4 border-b">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => navigate('/chantiers')}
                  className="shrink-0"
                >
                  <ArrowLeft className="h-5 w-5" />
                </Button>
                <div>
                  {loading ? (
                    <div className="flex items-center gap-2">
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary" />
                      <span className="text-muted-foreground">Chargement...</span>
                    </div>
                  ) : chantier ? (
                    <>
                      <div className="flex items-center gap-3">
                        <h1 className="text-xl font-bold">{chantier.nom}</h1>
                        {statutConfig && (
                          <Badge className={cn(statutConfig.color, 'text-white')}>
                            {statutConfig.label}
                          </Badge>
                        )}
                      </div>
                      {chantier.reference && (
                        <p className="text-sm text-muted-foreground">Réf: {chantier.reference}</p>
                      )}
                    </>
                  ) : (
                    <h1 className="text-xl font-bold">Chantier</h1>
                  )}
                </div>
              </div>

              {/* Avancement */}
              {chantier && (
                <div className="hidden md:flex items-center gap-4">
                  <div className="text-right">
                    <p className="text-sm text-muted-foreground">Avancement</p>
                    <p className="text-lg font-bold">{chantier.avancementGlobal}%</p>
                  </div>
                  <div className="w-32">
                    <Progress value={chantier.avancementGlobal} className="h-2" />
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Navigation tabs */}
          <div className="px-4 overflow-x-auto">
            <nav className="flex gap-1 py-2 min-w-max">
              {/* Préparation */}
              <div className="flex items-center gap-1 pr-4 border-r mr-4">
                <span className="text-xs text-muted-foreground uppercase tracking-wider mr-2 hidden sm:inline">
                  Préparation
                </span>
                {CHANTIER_NAV.filter(item => item.phase === 'preparation').map((item) => {
                  const Icon = item.icon;
                  const active = isActive(item);

                  return (
                    <Link
                      key={item.href}
                      to={buildLink(item)}
                      className={cn(
                        'flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap',
                        active
                          ? 'bg-primary text-white'
                          : 'text-gray-600 hover:bg-gray-100'
                      )}
                    >
                      <Icon className="h-4 w-4" />
                      <span className="hidden sm:inline">{getLabel(item)}</span>
                    </Link>
                  );
                })}
              </div>

              {/* Exécution */}
              <div className="flex items-center gap-1">
                <span className="text-xs text-muted-foreground uppercase tracking-wider mr-2 hidden sm:inline">
                  Exécution
                </span>
                {CHANTIER_NAV.filter(item => item.phase === 'execution').map((item) => {
                  const Icon = item.icon;
                  const active = isActive(item);

                  return (
                    <Link
                      key={item.href}
                      to={buildLink(item)}
                      className={cn(
                        'flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap relative',
                        active
                          ? 'bg-primary text-white'
                          : 'text-gray-600 hover:bg-gray-100'
                      )}
                    >
                      <Icon className="h-4 w-4" />
                      <span className="hidden sm:inline">{getLabel(item)}</span>
                      {item.badge && !active && (
                        <Badge className={cn('text-[10px] px-1.5 py-0', item.badgeColor || 'bg-primary')}>
                          {item.badge}
                        </Badge>
                      )}
                    </Link>
                  );
                })}
              </div>
            </nav>
          </div>
        </div>

        {/* Contenu de la page */}
        <Outlet />
      </div>
    </AppLayout>
  );
}

export default ChantierLayout;
