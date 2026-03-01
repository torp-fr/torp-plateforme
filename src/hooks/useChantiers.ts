/**
 * Hook pour la gestion des chantiers
 * Récupère et agrège les données depuis chantiers et phase0_projects
 * ZÉRO MOCK - Données réelles uniquement
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/hooks/use-toast';
import { log, warn, error, time, timeEnd } from '@/lib/logger';

// =============================================================================
// TYPES
// =============================================================================

export type ChantierStatus = 'preparation' | 'en_cours' | 'suspendu' | 'termine';

export interface ChantierCard {
  id: string;
  projectId: string;
  nom: string;
  reference: string;
  adresse: string;
  status: ChantierStatus;
  avancement: number;
  dateDebut?: string;
  dateFin?: string;
  montant?: number;
  entreprisesActives: number;
  prochaineReunion?: string;
  alertes: number;
}

export interface ChantierStats {
  total: number;
  enCours: number;
  preparation: number;
  termine: number;
  suspendu: number;
  alertes: number;
  avancementMoyen: number;
}

export interface UseChantierOptions {
  userType?: 'B2C' | 'B2B' | 'B2G';
  statusFilter?: ChantierStatus | 'all';
  enabled?: boolean;
}

// =============================================================================
// HOOK PRINCIPAL
// =============================================================================

export function useChantiers({
  userType = 'B2C',
  statusFilter = 'all',
  enabled = true,
}: UseChantierOptions = {}) {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  // -------------------------------------------------------------------------
  // Query: Liste des chantiers (DEPRECATED)
  // -------------------------------------------------------------------------
  // NOTE: This hook references phase0_projects which was removed in migration 034
  const chantiersQuery = useQuery({
    queryKey: ['chantiers', userType, statusFilter],
    queryFn: async (): Promise<ChantierCard[]> => {
      warn('[useChantiers] This hook is deprecated. Phase 0 tables have been removed.');
      return [];
    },
    enabled,
    staleTime: 1000 * 60 * 2, // 2 minutes
  });

  // -------------------------------------------------------------------------
  // Query: Statistiques globales
  // -------------------------------------------------------------------------
  const statsQuery = useQuery({
    queryKey: ['chantiers-stats', userType],
    queryFn: async (): Promise<ChantierStats> => {
      const chantiers = chantiersQuery.data || [];
      return calculateStats(chantiers);
    },
    enabled: enabled && !!chantiersQuery.data,
  });

  // -------------------------------------------------------------------------
  // Mutation: Mettre à jour le statut d'un chantier (DEPRECATED)
  // -------------------------------------------------------------------------
  // NOTE: This mutation references phase0_projects which was removed in migration 034
  const updateStatusMutation = useMutation({
    mutationFn: async ({ chantierId, newStatus }: { chantierId: string; newStatus: ChantierStatus }) => {
      warn('[useChantiers] updateStatus mutation is disabled - phase0_projects table removed');
      throw new Error('Cette fonctionnalité n\'est plus disponible après la refonte de l\'architecture.');
    },
    onError: (error: Error) => {
      toast({
        title: 'Fonctionnalité indisponible',
        description: 'Cette fonctionnalité n\'est pas disponible avec la nouvelle architecture.',
        variant: 'destructive',
      });
    },
  });

  // -------------------------------------------------------------------------
  // Filtrage local
  // -------------------------------------------------------------------------
  const filteredChantiers = (chantiersQuery.data || []).filter((chantier) => {
    if (statusFilter === 'all') return true;
    return chantier.status === statusFilter;
  });

  // -------------------------------------------------------------------------
  // Return
  // -------------------------------------------------------------------------

  return {
    // Données
    chantiers: filteredChantiers,
    allChantiers: chantiersQuery.data || [],
    stats: statsQuery.data || calculateStats(chantiersQuery.data || []),

    // États
    isLoading: chantiersQuery.isLoading,
    isUpdating: updateStatusMutation.isPending,

    // Erreurs
    error: chantiersQuery.error,

    // Actions
    updateStatus: updateStatusMutation.mutate,
    refetch: chantiersQuery.refetch,
  };
}

// =============================================================================
// HELPERS - Enrichissement des données
// =============================================================================

async function enrichChantiers(chantiers: any[]): Promise<ChantierCard[]> {
  // Récupérer les données complémentaires pour chaque chantier
  const enrichedChantiers = await Promise.all(
    chantiers.map(async (chantier) => {
      // Récupérer les acteurs du projet
      const { data: actors } = await supabase
        .from('project_actors')
        .select('id')
        .eq('project_id', chantier.project_id)
        .eq('status', 'active');

      // Récupérer les alertes non résolues
      const { data: alerts } = await supabase
        .from('notifications')
        .select('id')
        .eq('project_id', chantier.project_id)
        .eq('read', false)
        .in('type', ['warning', 'error', 'alerte']);

      // Récupérer la prochaine réunion
      const { data: reunions } = await supabase
        .from('reunions_chantier')
        .select('date_reunion')
        .eq('project_id', chantier.project_id)
        .gte('date_reunion', new Date().toISOString())
        .order('date_reunion', { ascending: true })
        .limit(1);

      // Récupérer l'avancement depuis situations_travaux
      const { data: situations } = await supabase
        .from('situations_travaux')
        .select('avancement_global')
        .eq('project_id', chantier.project_id)
        .order('date_situation', { ascending: false })
        .limit(1);

      return {
        id: chantier.id,
        projectId: chantier.project_id,
        nom: chantier.nom || chantier.designation || 'Chantier sans titre',
        reference: chantier.reference || chantier.id.slice(0, 8).toUpperCase(),
        adresse: formatAddress(chantier.adresse || chantier.location),
        status: mapChantierStatus(chantier.status),
        avancement: situations?.[0]?.avancement_global || chantier.avancement || 0,
        dateDebut: chantier.date_debut || chantier.created_at,
        dateFin: chantier.date_fin,
        montant: chantier.montant_ttc || chantier.montant || 0,
        entreprisesActives: actors?.length || 0,
        prochaineReunion: reunions?.[0]?.date_reunion,
        alertes: alerts?.length || 0,
      };
    })
  );

  return enrichedChantiers;
}

async function transformProjectsToChantiers(projects: any[]): Promise<ChantierCard[]> {
  // Récupérer les données complémentaires en batch
  const projectIds = projects.map((p) => p.project_id);

  // Acteurs par projet
  const { data: allActors } = await supabase
    .from('project_actors')
    .select('project_id, id')
    .in('project_id', projectIds)
    .eq('status', 'active');

  // Alertes par projet
  const { data: allAlerts } = await supabase
    .from('notifications')
    .select('project_id, id')
    .in('project_id', projectIds)
    .eq('read', false)
    .in('type', ['warning', 'error', 'alerte']);

  // Situations de travaux
  const { data: allSituations } = await supabase
    .from('situations_travaux')
    .select('project_id, avancement_global')
    .in('project_id', projectIds);

  // Indexer les données
  const actorsByProject = groupBy(allActors || [], 'project_id');
  const alertsByProject = groupBy(allAlerts || [], 'project_id');
  const situationsByProject = groupBy(allSituations || [], 'project_id');

  return projects.map((project) => {
    const workProject = project.work_project || {};
    const property = project.property || {};
    const projectActors = actorsByProject[project.project_id] || [];
    const projectAlerts = alertsByProject[project.project_id] || [];
    const projectSituations = situationsByProject[project.project_id] || [];

    // Calculer l'avancement
    const latestSituation = projectSituations.sort((a: any, b: any) =>
      new Date(b.date_situation || 0).getTime() - new Date(a.date_situation || 0).getTime()
    )[0];

    return {
      id: project.project_id,
      projectId: project.project_id,
      nom: workProject.general?.title || project.reference || 'Projet sans titre',
      reference: project.reference || project.project_id.slice(0, 8).toUpperCase(),
      adresse: formatAddress(property.address),
      status: mapProjectStatusToChantier(project.status),
      avancement: latestSituation?.avancement_global || 0,
      dateDebut: project.created_at,
      dateFin: workProject.planning?.date_fin,
      montant: workProject.budget?.estimated || 0,
      entreprisesActives: projectActors.length,
      prochaineReunion: undefined, // Sera enrichi si nécessaire
      alertes: projectAlerts.length,
    };
  });
}

// =============================================================================
// HELPERS - Calculs et transformations
// =============================================================================

function calculateStats(chantiers: ChantierCard[]): ChantierStats {
  return {
    total: chantiers.length,
    enCours: chantiers.filter((c) => c.status === 'en_cours').length,
    preparation: chantiers.filter((c) => c.status === 'preparation').length,
    termine: chantiers.filter((c) => c.status === 'termine').length,
    suspendu: chantiers.filter((c) => c.status === 'suspendu').length,
    alertes: chantiers.reduce((sum, c) => sum + c.alertes, 0),
    avancementMoyen:
      chantiers.length > 0
        ? Math.round(chantiers.reduce((sum, c) => sum + c.avancement, 0) / chantiers.length)
        : 0,
  };
}

function mapChantierStatus(status: string): ChantierStatus {
  switch (status) {
    case 'en_cours':
    case 'in_progress':
    case 'active':
      return 'en_cours';
    case 'preparation':
    case 'draft':
    case 'pending':
      return 'preparation';
    case 'termine':
    case 'completed':
    case 'closed':
      return 'termine';
    case 'suspendu':
    case 'paused':
    case 'blocked':
      return 'suspendu';
    default:
      return 'preparation';
  }
}

function mapProjectStatusToChantier(status: string): ChantierStatus {
  switch (status) {
    case 'validated':
    case 'in_progress':
      return 'en_cours';
    case 'in_consultation':
    case 'draft':
      return 'preparation';
    case 'published':
    case 'completed':
      return 'termine';
    default:
      return 'preparation';
  }
}

function formatAddress(address: any): string {
  if (!address) return 'Adresse non définie';
  if (typeof address === 'string') return address;

  const parts = [address.city, address.postalCode ? `(${address.postalCode})` : ''].filter(Boolean);

  return parts.join(' ') || 'Adresse non définie';
}

function groupBy<T>(array: T[], key: keyof T): Record<string, T[]> {
  return array.reduce(
    (result, item) => {
      const groupKey = String(item[key]);
      if (!result[groupKey]) {
        result[groupKey] = [];
      }
      result[groupKey].push(item);
      return result;
    },
    {} as Record<string, T[]>
  );
}

// =============================================================================
// EXPORTS
// =============================================================================

export type { ChantierStatus, ChantierCard, ChantierStats };
