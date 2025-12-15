/**
 * useSituations - Hook React pour la gestion des situations de paiement Phase 3
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { administratifService } from '@/services/phase3/administratif.service';
import { toast } from 'sonner';

interface UseSituationsOptions {
  projetId: string;
  lotId?: string;
  enabled?: boolean;
}

export function useSituations({ projetId, lotId, enabled = true }: UseSituationsOptions) {
  const queryClient = useQueryClient();

  // Query keys
  const keys = {
    all: ['situations', projetId] as const,
    list: ['situations', projetId, 'list', lotId] as const,
    detail: (id: string) => ['situations', projetId, 'detail', id] as const,
    budget: ['situations', projetId, 'budget'] as const,
    avenants: ['situations', projetId, 'avenants'] as const,
  };

  // Liste des situations
  const situationsQuery = useQuery({
    queryKey: keys.list,
    queryFn: () => administratifService.getSituations(projetId, lotId),
    enabled: enabled && !!projetId,
    staleTime: 5 * 60 * 1000,
  });

  // Suivi budgétaire
  const budgetQuery = useQuery({
    queryKey: keys.budget,
    queryFn: () => administratifService.calculerSuiviBudgetaire(projetId),
    enabled: enabled && !!projetId,
    staleTime: 10 * 60 * 1000,
  });

  // Avenants
  const avenantsQuery = useQuery({
    queryKey: keys.avenants,
    queryFn: () => administratifService.getAvenants(projetId),
    enabled: enabled && !!projetId,
    staleTime: 5 * 60 * 1000,
  });

  // Mutation: Créer une situation
  const createSituation = useMutation({
    mutationFn: (data: Parameters<typeof administratifService.createSituation>[0]) =>
      administratifService.createSituation(data),
    onSuccess: () => {
      toast.success('Situation créée avec succès');
      queryClient.invalidateQueries({ queryKey: keys.all });
    },
    onError: (error: Error) => {
      toast.error(`Erreur lors de la création: ${error.message}`);
    },
  });

  // Mutation: Soumettre une situation
  const submitSituation = useMutation({
    mutationFn: (situationId: string) => administratifService.soumettreSituation(situationId),
    onSuccess: () => {
      toast.success('Situation soumise pour validation');
      queryClient.invalidateQueries({ queryKey: keys.all });
    },
    onError: (error: Error) => {
      toast.error(`Erreur lors de la soumission: ${error.message}`);
    },
  });

  // Mutation: Valider une situation
  const validateSituation = useMutation({
    mutationFn: (data: { situationId: string; commentaire?: string }) =>
      administratifService.validerSituation(data.situationId, data.commentaire),
    onSuccess: () => {
      toast.success('Situation validée avec succès');
      queryClient.invalidateQueries({ queryKey: keys.all });
    },
    onError: (error: Error) => {
      toast.error(`Erreur lors de la validation: ${error.message}`);
    },
  });

  // Mutation: Refuser une situation
  const rejectSituation = useMutation({
    mutationFn: (data: { situationId: string; motif: string }) =>
      administratifService.refuserSituation(data.situationId, data.motif),
    onSuccess: () => {
      toast.info('Situation refusée');
      queryClient.invalidateQueries({ queryKey: keys.all });
    },
    onError: (error: Error) => {
      toast.error(`Erreur lors du refus: ${error.message}`);
    },
  });

  // Mutation: Créer un avenant
  const createAvenant = useMutation({
    mutationFn: (data: Parameters<typeof administratifService.createAvenant>[0]) =>
      administratifService.createAvenant(data),
    onSuccess: () => {
      toast.success('Avenant créé avec succès');
      queryClient.invalidateQueries({ queryKey: keys.avenants });
    },
    onError: (error: Error) => {
      toast.error(`Erreur lors de la création: ${error.message}`);
    },
  });

  // Mutation: Valider un avenant
  const validateAvenant = useMutation({
    mutationFn: (avenantId: string) => administratifService.validerAvenant(avenantId),
    onSuccess: () => {
      toast.success('Avenant validé');
      queryClient.invalidateQueries({ queryKey: keys.avenants });
    },
    onError: (error: Error) => {
      toast.error(`Erreur lors de la validation: ${error.message}`);
    },
  });

  return {
    // Queries
    situations: situationsQuery.data || [],
    budget: budgetQuery.data,
    avenants: avenantsQuery.data || [],
    isLoading: situationsQuery.isLoading,
    isLoadingBudget: budgetQuery.isLoading,
    error: situationsQuery.error,

    // Mutations
    createSituation: createSituation.mutate,
    submitSituation: submitSituation.mutate,
    validateSituation: validateSituation.mutate,
    rejectSituation: rejectSituation.mutate,
    createAvenant: createAvenant.mutate,
    validateAvenant: validateAvenant.mutate,

    // Mutation states
    isCreating: createSituation.isPending,
    isSubmitting: submitSituation.isPending,
    isValidating: validateSituation.isPending,

    // Refetch
    refetch: () => {
      queryClient.invalidateQueries({ queryKey: keys.all });
    },
  };
}
