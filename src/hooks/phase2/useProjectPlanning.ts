/**
 * TORP Phase 2 - Hook useProjectPlanning
 * Gestion centralisée de l'état du planning d'un chantier
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { PlanningService } from '@/services/phase2/planning.service';
import type { PlanningLot, PlanningTache, GanttTask, CheminCritique } from '@/types/phase2';
import type { PlanningStats } from '@/services/phase2/planning.service';

interface CreateLotInput {
  chantierId: string;
  code: string;
  nom: string;
  entrepriseNom?: string;
  couleur?: string;
  ordre?: number;
}

interface CreateTacheInput {
  lotId: string;
  nom: string;
  description?: string;
  dateDebutPrevue?: string;
  dureeJours: number;
  estJalon?: boolean;
}

interface UseProjectPlanningReturn {
  // Data
  lots: PlanningLot[];
  taches: PlanningTache[];
  ganttData: GanttTask[];
  criticalPath: CheminCritique | null;
  stats: PlanningStats | null;

  // Loading states
  isLoading: boolean;
  isGenerating: boolean;
  isAddingLot: boolean;
  isAddingTache: boolean;
  isUpdating: boolean;

  // Error states
  error: Error | null;

  // Actions - Lots
  addLot: (lot: Omit<CreateLotInput, 'chantierId'>) => void;
  updateLot: (lotId: string, updates: Partial<PlanningLot>) => void;
  deleteLot: (lotId: string) => void;

  // Actions - Tâches
  addTache: (tache: CreateTacheInput) => void;
  updateTache: (tacheId: string, updates: Partial<PlanningTache>) => void;
  updateAvancement: (tacheId: string, avancement: number) => void;
  deleteTache: (tacheId: string) => void;

  // Actions - Dépendances
  addDependance: (params: { tacheId: string; predecessorId: string; type?: string; decalage?: number }) => void;
  removeDependance: (dependanceId: string) => void;

  // Actions - IA
  generatePlanning: (options?: Partial<PlanningGenerationInput>) => void;
  optimizePlanning: (objective: 'duration' | 'cost' | 'resources') => Promise<any>;

  // Actions - Recalcul
  recalculateDates: () => void;
  recalculateCriticalPath: () => void;

  // Refresh
  refresh: () => void;
}

export function useProjectPlanning(chantierId: string): UseProjectPlanningReturn {
  const queryClient = useQueryClient();

  // ============================================
  // QUERIES
  // ============================================

  // Lots
  const lotsQuery = useQuery({
    queryKey: ['planning-lots', chantierId],
    queryFn: () => PlanningService.getLots(chantierId),
    enabled: !!chantierId,
  });

  // Tâches
  const tachesQuery = useQuery({
    queryKey: ['planning-taches', chantierId],
    queryFn: () => PlanningService.getTachesByChantier(chantierId),
    enabled: !!chantierId,
  });

  // Données Gantt
  const ganttQuery = useQuery({
    queryKey: ['planning-gantt', chantierId],
    queryFn: () => PlanningService.getGanttData(chantierId),
    enabled: !!chantierId,
  });

  // Chemin critique
  const criticalPathQuery = useQuery({
    queryKey: ['planning-critical-path', chantierId],
    queryFn: () => PlanningService.calculerCheminCritique(chantierId),
    enabled: !!chantierId && (tachesQuery.data?.length || 0) > 0,
  });

  // Stats
  const statsQuery = useQuery({
    queryKey: ['planning-stats', chantierId],
    queryFn: () => PlanningService.getStats(chantierId),
    enabled: !!chantierId,
  });

  // ============================================
  // MUTATIONS - LOTS
  // ============================================

  const addLotMutation = useMutation({
    mutationFn: (lot: Omit<CreateLotInput, 'chantierId'>) =>
      PlanningService.createLot({ ...lot, chantierId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['planning-lots', chantierId] });
      queryClient.invalidateQueries({ queryKey: ['planning-gantt', chantierId] });
      queryClient.invalidateQueries({ queryKey: ['planning-stats', chantierId] });
    },
  });

  const updateLotMutation = useMutation({
    mutationFn: ({ lotId, updates }: { lotId: string; updates: Partial<PlanningLot> }) =>
      PlanningService.updateLot(lotId, updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['planning-lots', chantierId] });
      queryClient.invalidateQueries({ queryKey: ['planning-gantt', chantierId] });
    },
  });

  const deleteLotMutation = useMutation({
    mutationFn: (lotId: string) => PlanningService.deleteLot(lotId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['planning-lots', chantierId] });
      queryClient.invalidateQueries({ queryKey: ['planning-taches', chantierId] });
      queryClient.invalidateQueries({ queryKey: ['planning-gantt', chantierId] });
      queryClient.invalidateQueries({ queryKey: ['planning-stats', chantierId] });
    },
  });

  // ============================================
  // MUTATIONS - TÂCHES
  // ============================================

  const addTacheMutation = useMutation({
    mutationFn: (tache: CreateTacheInput) => PlanningService.createTache(tache),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['planning-taches', chantierId] });
      queryClient.invalidateQueries({ queryKey: ['planning-gantt', chantierId] });
      queryClient.invalidateQueries({ queryKey: ['planning-critical-path', chantierId] });
      queryClient.invalidateQueries({ queryKey: ['planning-stats', chantierId] });
    },
  });

  const updateTacheMutation = useMutation({
    mutationFn: ({ tacheId, updates }: { tacheId: string; updates: Partial<PlanningTache> }) =>
      PlanningService.updateTache(tacheId, updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['planning-taches', chantierId] });
      queryClient.invalidateQueries({ queryKey: ['planning-gantt', chantierId] });
      queryClient.invalidateQueries({ queryKey: ['planning-critical-path', chantierId] });
      queryClient.invalidateQueries({ queryKey: ['planning-stats', chantierId] });
    },
  });

  const updateAvancementMutation = useMutation({
    mutationFn: ({ tacheId, avancement }: { tacheId: string; avancement: number }) =>
      PlanningService.updateAvancement({ tacheId, avancement }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['planning-taches', chantierId] });
      queryClient.invalidateQueries({ queryKey: ['planning-gantt', chantierId] });
      queryClient.invalidateQueries({ queryKey: ['planning-stats', chantierId] });
    },
  });

  const deleteTacheMutation = useMutation({
    mutationFn: (tacheId: string) => PlanningService.deleteTache(tacheId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['planning-taches', chantierId] });
      queryClient.invalidateQueries({ queryKey: ['planning-gantt', chantierId] });
      queryClient.invalidateQueries({ queryKey: ['planning-critical-path', chantierId] });
      queryClient.invalidateQueries({ queryKey: ['planning-stats', chantierId] });
    },
  });

  // ============================================
  // MUTATIONS - DÉPENDANCES
  // ============================================

  const addDependanceMutation = useMutation({
    mutationFn: (params: { tacheId: string; predecessorId: string; type?: string; decalage?: number }) =>
      PlanningService.createDependance({
        tacheId: params.tacheId,
        predecesseurId: params.predecessorId,
        type: (params.type as 'fin_debut' | 'debut_debut' | 'fin_fin' | 'debut_fin') || 'fin_debut',
        decalageJours: params.decalage || 0,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['planning-taches', chantierId] });
      queryClient.invalidateQueries({ queryKey: ['planning-gantt', chantierId] });
      queryClient.invalidateQueries({ queryKey: ['planning-critical-path', chantierId] });
    },
  });

  const removeDependanceMutation = useMutation({
    mutationFn: (dependanceId: string) => PlanningService.deleteDependance(dependanceId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['planning-taches', chantierId] });
      queryClient.invalidateQueries({ queryKey: ['planning-gantt', chantierId] });
      queryClient.invalidateQueries({ queryKey: ['planning-critical-path', chantierId] });
    },
  });

  // ============================================
  // MUTATIONS - IA
  // ============================================

  const generatePlanningMutation = useMutation({
    mutationFn: async (options?: any) => {
      // Placeholder for AI planning generation (removed)
      return null;
    },
    onSuccess: () => {
      // Rafraîchir les données
      queryClient.invalidateQueries({ queryKey: ['planning-lots', chantierId] });
      queryClient.invalidateQueries({ queryKey: ['planning-taches', chantierId] });
      queryClient.invalidateQueries({ queryKey: ['planning-gantt', chantierId] });
      queryClient.invalidateQueries({ queryKey: ['planning-stats', chantierId] });
    },
  });

  // ============================================
  // ACTIONS - RECALCUL
  // ============================================

  const recalculateDates = async () => {
    await PlanningService.recalculerDatesEnCascade(chantierId);
    queryClient.invalidateQueries({ queryKey: ['planning-taches', chantierId] });
    queryClient.invalidateQueries({ queryKey: ['planning-gantt', chantierId] });
  };

  const recalculateCriticalPath = () => {
    queryClient.invalidateQueries({ queryKey: ['planning-critical-path', chantierId] });
  };

  // ============================================
  // OPTIMIZE
  // ============================================

  const optimizePlanning = async (objective: 'duration' | 'cost' | 'resources') => {
    // Placeholder for AI planning optimization (removed)
    return null;
  };

  // ============================================
  // REFRESH
  // ============================================

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ['planning-lots', chantierId] });
    queryClient.invalidateQueries({ queryKey: ['planning-taches', chantierId] });
    queryClient.invalidateQueries({ queryKey: ['planning-gantt', chantierId] });
    queryClient.invalidateQueries({ queryKey: ['planning-critical-path', chantierId] });
    queryClient.invalidateQueries({ queryKey: ['planning-stats', chantierId] });
  };

  // ============================================
  // RETURN
  // ============================================

  return {
    // Data
    lots: lotsQuery.data || [],
    taches: tachesQuery.data || [],
    ganttData: ganttQuery.data || [],
    criticalPath: criticalPathQuery.data || null,
    stats: statsQuery.data || null,

    // Loading states
    isLoading: lotsQuery.isLoading || tachesQuery.isLoading,
    isGenerating: generatePlanningMutation.isPending,
    isAddingLot: addLotMutation.isPending,
    isAddingTache: addTacheMutation.isPending,
    isUpdating: updateTacheMutation.isPending || updateAvancementMutation.isPending,

    // Error
    error: lotsQuery.error || tachesQuery.error || null,

    // Actions - Lots
    addLot: addLotMutation.mutate,
    updateLot: (lotId, updates) => updateLotMutation.mutate({ lotId, updates }),
    deleteLot: deleteLotMutation.mutate,

    // Actions - Tâches
    addTache: addTacheMutation.mutate,
    updateTache: (tacheId, updates) => updateTacheMutation.mutate({ tacheId, updates }),
    updateAvancement: (tacheId, avancement) => updateAvancementMutation.mutate({ tacheId, avancement }),
    deleteTache: deleteTacheMutation.mutate,

    // Actions - Dépendances
    addDependance: addDependanceMutation.mutate,
    removeDependance: removeDependanceMutation.mutate,

    // Actions - IA
    generatePlanning: generatePlanningMutation.mutate,
    optimizePlanning,

    // Actions - Recalcul
    recalculateDates,
    recalculateCriticalPath,

    // Refresh
    refresh,
  };
}
