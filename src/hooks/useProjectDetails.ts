/**
 * Hook pour les détails complets d'un projet
 * Agrège données de phase0_projects, phase0_works, planning_tasks, situations_travaux
 * ZÉRO MOCK - Données réelles uniquement
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/hooks/use-toast';
import { log, warn, error, time, timeEnd } from '@/lib/logger';

// =============================================================================
// TYPES
// =============================================================================

export interface ProjectPhase {
  id: string;
  name: string;
  status: 'completed' | 'in-progress' | 'pending' | 'delayed';
  progress: number;
  duration: string;
  startDate?: string;
  endDate?: string;
}

export interface BudgetItem {
  category: string;
  budgeted: number;
  spent: number;
  remaining: number;
}

export interface ProjectBudget {
  total: number;
  spent: number;
  remaining: number;
  breakdown: BudgetItem[];
}

export interface TeamMember {
  id: string;
  name: string;
  role: string;
  status: 'active' | 'scheduled' | 'completed';
  phone?: string;
  email?: string;
  company?: string;
}

export interface ProjectAlert {
  id: string;
  type: 'warning' | 'error' | 'info' | 'success';
  message: string;
  date: string;
  read?: boolean;
}

export interface ProjectDocument {
  id: string;
  name: string;
  type: string;
  date: string;
  size: string;
  url?: string;
  category?: string;
}

export interface ProjectDetails {
  id: string;
  name: string;
  type: string;
  status: string;
  score?: number;
  grade?: string;
  amount: string;
  createdAt: string;
  company?: string;
  address?: string;
  progress: number;
  phases: ProjectPhase[];
  budget: ProjectBudget;
  team: TeamMember[];
  alerts: ProjectAlert[];
  documents: ProjectDocument[];
}

export interface UseProjectDetailsOptions {
  projectId: string;
  enabled?: boolean;
}

// =============================================================================
// HOOK PRINCIPAL
// =============================================================================

export function useProjectDetails({
  projectId,
  enabled = true,
}: UseProjectDetailsOptions) {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  // -------------------------------------------------------------------------
  // Query: Projet principal (DEPRECATED - phase0 tables removed)
  // -------------------------------------------------------------------------
  // NOTE: This hook references phase0_projects and phase0_works which were
  // removed in migration 034. This hook is kept for backwards compatibility
  // but returns null to prevent runtime errors.
  const projectQuery = useQuery({
    queryKey: ['project-details', projectId],
    queryFn: async (): Promise<ProjectDetails | null> => {
      warn('[useProjectDetails] This hook is deprecated. Phase 0 tables have been removed.');
      return null;
    },
    enabled: enabled && !!projectId,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });

  // -------------------------------------------------------------------------
  // Query: Budget détaillé (DEPRECATED)
  // -------------------------------------------------------------------------
  // NOTE: Budget queries are deprecated as they reference legacy schemas
  const budgetQuery = useQuery({
    queryKey: ['project-budget', projectId],
    queryFn: async (): Promise<ProjectBudget> => {
      warn('[useProjectDetails] Budget query is deprecated');
      return {
        total: 0,
        spent: 0,
        remaining: 0,
        breakdown: [],
      };
    },
    enabled: enabled && !!projectId,
    staleTime: 1000 * 60 * 5,
  });

  // -------------------------------------------------------------------------
  // Mutation: Mettre à jour le statut du projet (DEPRECATED)
  // -------------------------------------------------------------------------
  // NOTE: This mutation references phase0_projects which was removed in migration 034.
  const updateStatusMutation = useMutation({
    mutationFn: async (newStatus: string) => {
      warn('[useProjectDetails] updateStatus mutation is disabled - phase0_projects table removed');
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
  // Return
  // -------------------------------------------------------------------------

  return {
    // Données
    project: projectQuery.data,
    budget: budgetQuery.data || projectQuery.data?.budget,
    phases: projectQuery.data?.phases || [],
    team: projectQuery.data?.team || [],
    alerts: projectQuery.data?.alerts || [],
    documents: projectQuery.data?.documents || [],

    // États
    isLoading: projectQuery.isLoading,
    isBudgetLoading: budgetQuery.isLoading,
    isUpdating: updateStatusMutation.isPending,

    // Erreurs
    error: projectQuery.error,

    // Actions
    updateStatus: updateStatusMutation.mutate,
    refetch: () => {
      projectQuery.refetch();
      budgetQuery.refetch();
    },
  };
}

// =============================================================================
// TRANSFORMERS
// =============================================================================

function transformToProjectDetails(
  project: any,
  works: any[],
  tasks: any[],
  situations: any[],
  actors: any[],
  documents: any[],
  notifications: any[]
): ProjectDetails {
  // Calculer le budget total depuis les works
  const totalBudget = works.reduce((sum, w) => sum + (w.montant_ttc || w.montant_ht || 0), 0);
  const spentBudget = situations.reduce((sum, s) => sum + (s.montant_cumule || 0), 0);

  // Calculer l'avancement global
  const progress = totalBudget > 0 ? Math.round((spentBudget / totalBudget) * 100) : 0;

  // Transformer les tâches en phases
  const phases = transformTasksToPhases(tasks, works);

  // Transformer les acteurs en équipe
  const team = transformActorsToTeam(actors);

  // Transformer les notifications en alertes
  const alerts = transformNotificationsToAlerts(notifications);

  // Transformer les documents
  const docs = transformDocuments(documents);

  // Budget breakdown par lot
  const breakdown = works.map((w) => {
    const workSituations = situations.filter((s) => s.lot_id === w.id);
    const spent = workSituations.reduce((sum, s) => sum + (s.montant_periode || 0), 0);
    return {
      category: w.designation || w.lot_type || 'Lot',
      budgeted: w.montant_ttc || w.montant_ht || 0,
      spent,
      remaining: (w.montant_ttc || w.montant_ht || 0) - spent,
    };
  });

  // Données du projet depuis work_project JSON si disponible
  const workProject = project?.work_project || {};
  const property = project?.property || {};

  return {
    id: project?.project_id || '',
    name: workProject.general?.title || project?.reference || 'Projet sans titre',
    type: workProject.general?.type || 'Rénovation',
    status: project?.status || 'draft',
    score: workProject.analysis?.score,
    grade: workProject.analysis?.grade,
    amount: `${totalBudget.toLocaleString('fr-FR')} €`,
    createdAt: project?.created_at || new Date().toISOString(),
    company: workProject.general?.company,
    address: property.address
      ? `${property.address.street || ''}, ${property.address.postalCode || ''} ${property.address.city || ''}`
      : undefined,
    progress,
    phases,
    budget: {
      total: totalBudget,
      spent: spentBudget,
      remaining: totalBudget - spentBudget,
      breakdown,
    },
    team,
    alerts,
    documents: docs,
  };
}

function transformTasksToPhases(tasks: any[], works: any[]): ProjectPhase[] {
  // Si pas de tâches, créer des phases génériques
  if (!tasks.length && !works.length) {
    return [
      { id: '1', name: 'Conception & Plans', status: 'completed', progress: 100, duration: '2 semaines' },
      { id: '2', name: 'Préparation chantier', status: 'in-progress', progress: 50, duration: '1 semaine' },
      { id: '3', name: 'Travaux', status: 'pending', progress: 0, duration: '4 semaines' },
      { id: '4', name: 'Finitions', status: 'pending', progress: 0, duration: '1 semaine' },
      { id: '5', name: 'Réception', status: 'pending', progress: 0, duration: '1 jour' },
    ];
  }

  // Transformer les tâches en phases
  return tasks.slice(0, 10).map((task, index) => ({
    id: task.id || String(index + 1),
    name: task.title || task.designation || `Phase ${index + 1}`,
    status: mapTaskStatus(task.status),
    progress: task.progress || 0,
    duration: calculateDuration(task.start_date, task.end_date),
    startDate: task.start_date,
    endDate: task.end_date,
  }));
}

function transformActorsToTeam(actors: any[]): TeamMember[] {
  return actors.map((actor) => ({
    id: actor.id,
    name: actor.nom || actor.contact_name || 'Intervenant',
    role: actor.role || actor.type || 'Entreprise',
    status: mapActorStatus(actor.status),
    phone: actor.telephone || actor.contact_phone,
    email: actor.email || actor.contact_email,
    company: actor.entreprise || actor.company_name,
  }));
}

function transformNotificationsToAlerts(notifications: any[]): ProjectAlert[] {
  return notifications.map((notif) => ({
    id: notif.id,
    type: mapNotificationType(notif.type),
    message: notif.message || notif.title || 'Notification',
    date: notif.created_at?.split('T')[0] || '',
    read: notif.read,
  }));
}

function transformDocuments(documents: any[]): ProjectDocument[] {
  return documents.map((doc) => ({
    id: doc.id,
    name: doc.nom || doc.name || 'Document',
    type: doc.type || 'PDF',
    date: doc.created_at?.split('T')[0] || '',
    size: doc.size ? formatFileSize(doc.size) : 'N/A',
    url: doc.url || doc.file_url,
    category: doc.category,
  }));
}

function calculateBudget(situations: any[], contracts: any[], milestones: any[]): ProjectBudget {
  const total = contracts.reduce((sum, c) => sum + (c.montant_ttc || c.montant_ht || 0), 0);
  const spent = milestones
    .filter((m) => m.status === 'completed')
    .reduce((sum, m) => sum + (m.montant_ttc || m.montant_ht || 0), 0);

  // Breakdown par contrat
  const breakdown = contracts.map((c) => {
    const contractMilestones = milestones.filter((m) => m.contract_id === c.id && m.status === 'completed');
    const contractSpent = contractMilestones.reduce((sum, m) => sum + (m.montant_ttc || m.montant_ht || 0), 0);
    return {
      category: c.lot_designation || c.entreprise || 'Lot',
      budgeted: c.montant_ttc || c.montant_ht || 0,
      spent: contractSpent,
      remaining: (c.montant_ttc || c.montant_ht || 0) - contractSpent,
    };
  });

  return {
    total,
    spent,
    remaining: total - spent,
    breakdown,
  };
}

// =============================================================================
// HELPERS
// =============================================================================

function mapTaskStatus(status: string): ProjectPhase['status'] {
  switch (status) {
    case 'completed':
    case 'done':
      return 'completed';
    case 'in_progress':
    case 'in-progress':
    case 'active':
      return 'in-progress';
    case 'delayed':
    case 'blocked':
      return 'delayed';
    default:
      return 'pending';
  }
}

function mapActorStatus(status: string): TeamMember['status'] {
  switch (status) {
    case 'active':
    case 'on_site':
      return 'active';
    case 'completed':
    case 'done':
      return 'completed';
    default:
      return 'scheduled';
  }
}

function mapNotificationType(type: string): ProjectAlert['type'] {
  switch (type) {
    case 'warning':
    case 'alerte':
      return 'warning';
    case 'error':
    case 'erreur':
      return 'error';
    case 'success':
    case 'validation':
      return 'success';
    default:
      return 'info';
  }
}

function calculateDuration(startDate?: string, endDate?: string): string {
  if (!startDate || !endDate) return 'Non défini';

  const start = new Date(startDate);
  const end = new Date(endDate);
  const days = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));

  if (days <= 0) return '1 jour';
  if (days === 1) return '1 jour';
  if (days < 7) return `${days} jours`;
  if (days < 30) return `${Math.ceil(days / 7)} semaine(s)`;
  return `${Math.ceil(days / 30)} mois`;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// =============================================================================
// EXPORTS
// =============================================================================

export type {
  ProjectPhase,
  BudgetItem,
  ProjectBudget,
  TeamMember,
  ProjectAlert,
  ProjectDocument,
};
