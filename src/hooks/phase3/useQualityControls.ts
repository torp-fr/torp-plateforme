/**
 * useQualityControls - Hook React pour la gestion des contrôles qualité Phase 3
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { controleService } from '@/services/phase3/controle.service';
import { toast } from 'sonner';

interface UseQualityControlsOptions {
  projetId: string;
  lotId?: string;
  enabled?: boolean;
}

export function useQualityControls({ projetId, lotId, enabled = true }: UseQualityControlsOptions) {
  const queryClient = useQueryClient();

  // Query keys
  const keys = {
    all: ['quality-controls', projetId] as const,
    list: ['quality-controls', projetId, 'list', lotId] as const,
    detail: (id: string) => ['quality-controls', projetId, 'detail', id] as const,
    stats: ['quality-controls', projetId, 'stats'] as const,
    planning: ['quality-controls', projetId, 'planning'] as const,
  };

  // Liste des contrôles
  const controlsQuery = useQuery({
    queryKey: keys.list,
    queryFn: () => controleService.getControles(projetId, lotId),
    enabled: enabled && !!projetId,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  // Statistiques
  const statsQuery = useQuery({
    queryKey: keys.stats,
    queryFn: () => controleService.getStatistiques(projetId),
    enabled: enabled && !!projetId,
    staleTime: 10 * 60 * 1000, // 10 minutes
  });

  // Planning des contrôles
  const planningQuery = useQuery({
    queryKey: keys.planning,
    queryFn: () => controleService.getPlanningControles(projetId),
    enabled: enabled && !!projetId,
    staleTime: 5 * 60 * 1000,
  });

  // Mutation: Créer un contrôle
  const createControl = useMutation({
    mutationFn: (data: Parameters<typeof controleService.createControle>[0]) =>
      controleService.createControle(data),
    onSuccess: () => {
      toast.success('Contrôle créé avec succès');
      queryClient.invalidateQueries({ queryKey: keys.all });
    },
    onError: (error: Error) => {
      toast.error(`Erreur lors de la création: ${error.message}`);
    },
  });

  // Mutation: Planifier une visite
  const scheduleVisit = useMutation({
    mutationFn: (data: { controleId: string; date: Date; participants: string[] }) =>
      controleService.planifierVisite(data.controleId, data.date, data.participants),
    onSuccess: () => {
      toast.success('Visite planifiée avec succès');
      queryClient.invalidateQueries({ queryKey: keys.all });
    },
    onError: (error: Error) => {
      toast.error(`Erreur lors de la planification: ${error.message}`);
    },
  });

  // Mutation: Enregistrer résultat
  const recordResult = useMutation({
    mutationFn: (data: {
      controleId: string;
      resultat: 'conforme' | 'non_conforme' | 'reserve';
      observations: string;
      photos?: string[];
    }) =>
      controleService.enregistrerResultat(
        data.controleId,
        data.resultat,
        data.observations,
        data.photos
      ),
    onSuccess: () => {
      toast.success('Résultat enregistré avec succès');
      queryClient.invalidateQueries({ queryKey: keys.all });
    },
    onError: (error: Error) => {
      toast.error(`Erreur lors de l'enregistrement: ${error.message}`);
    },
  });

  // Mutation: Créer fiche de non-conformité
  const createNonConformity = useMutation({
    mutationFn: (data: {
      controleId: string;
      description: string;
      gravite: 'mineure' | 'majeure' | 'critique';
      actionsCorrectives: string[];
    }) =>
      controleService.creerFicheNC(
        data.controleId,
        data.description,
        data.gravite,
        data.actionsCorrectives
      ),
    onSuccess: () => {
      toast.success('Fiche de non-conformité créée');
      queryClient.invalidateQueries({ queryKey: keys.all });
    },
    onError: (error: Error) => {
      toast.error(`Erreur lors de la création: ${error.message}`);
    },
  });

  // Mutation: Lever une réserve/NC
  const resolveNonConformity = useMutation({
    mutationFn: (data: { controleId: string; commentaire: string; photos?: string[] }) =>
      controleService.leverReserve(data.controleId, data.commentaire, data.photos),
    onSuccess: () => {
      toast.success('Non-conformité levée avec succès');
      queryClient.invalidateQueries({ queryKey: keys.all });
    },
    onError: (error: Error) => {
      toast.error(`Erreur lors de la levée: ${error.message}`);
    },
  });

  return {
    // Queries
    controls: controlsQuery.data || [],
    stats: statsQuery.data,
    planning: planningQuery.data || [],
    isLoading: controlsQuery.isLoading,
    isLoadingStats: statsQuery.isLoading,
    error: controlsQuery.error,

    // Mutations
    createControl: createControl.mutate,
    scheduleVisit: scheduleVisit.mutate,
    recordResult: recordResult.mutate,
    createNonConformity: createNonConformity.mutate,
    resolveNonConformity: resolveNonConformity.mutate,

    // Mutation states
    isCreating: createControl.isPending,
    isScheduling: scheduleVisit.isPending,
    isRecording: recordResult.isPending,

    // Refetch
    refetch: () => {
      queryClient.invalidateQueries({ queryKey: keys.all });
    },
  };
}
