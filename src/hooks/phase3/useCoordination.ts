/**
 * useCoordination - Hook React pour la coordination multi-entreprises Phase 3
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { coordinationService } from '@/services/phase3/coordination.service';
import { toast } from 'sonner';

interface UseCoordinationOptions {
  projetId: string;
  enabled?: boolean;
}

export function useCoordination({ projetId, enabled = true }: UseCoordinationOptions) {
  const queryClient = useQueryClient();

  // Query keys
  const keys = {
    all: ['coordination', projetId] as const,
    slots: ['coordination', projetId, 'slots'] as const,
    conflicts: ['coordination', projetId, 'conflicts'] as const,
    journal: ['coordination', projetId, 'journal'] as const,
    messages: ['coordination', projetId, 'messages'] as const,
    interfaces: ['coordination', projetId, 'interfaces'] as const,
  };

  // Créneaux de coordination
  const slotsQuery = useQuery({
    queryKey: keys.slots,
    queryFn: () => coordinationService.getCreneaux(projetId),
    enabled: enabled && !!projetId,
    staleTime: 2 * 60 * 1000, // 2 minutes
  });

  // Conflits
  const conflictsQuery = useQuery({
    queryKey: keys.conflicts,
    queryFn: () => coordinationService.getConflits(projetId),
    enabled: enabled && !!projetId,
    staleTime: 2 * 60 * 1000,
  });

  // Carnet du jour
  const journalQuery = useQuery({
    queryKey: keys.journal,
    queryFn: () => coordinationService.getCarnetDuJour(projetId, new Date()),
    enabled: enabled && !!projetId,
    staleTime: 5 * 60 * 1000,
  });

  // Messages/Correspondance
  const messagesQuery = useQuery({
    queryKey: keys.messages,
    queryFn: () => coordinationService.getCorrespondance(projetId),
    enabled: enabled && !!projetId,
    staleTime: 1 * 60 * 1000, // 1 minute
  });

  // Points d'interface
  const interfacesQuery = useQuery({
    queryKey: keys.interfaces,
    queryFn: () => coordinationService.getPointsInterface(projetId),
    enabled: enabled && !!projetId,
    staleTime: 5 * 60 * 1000,
  });

  // Mutation: Créer un créneau
  const createSlot = useMutation({
    mutationFn: (data: Parameters<typeof coordinationService.createCreneau>[0]) =>
      coordinationService.createCreneau(data),
    onSuccess: () => {
      toast.success('Créneau créé avec succès');
      queryClient.invalidateQueries({ queryKey: keys.slots });
      queryClient.invalidateQueries({ queryKey: keys.conflicts });
    },
    onError: (error: Error) => {
      toast.error(`Erreur lors de la création: ${error.message}`);
    },
  });

  // Mutation: Résoudre un conflit
  const resolveConflict = useMutation({
    mutationFn: (data: { conflictId: string; resolution: string; prioriteLot: string }) =>
      coordinationService.resoudreConflit(data.conflictId, data.resolution, data.prioriteLot),
    onSuccess: () => {
      toast.success('Conflit résolu');
      queryClient.invalidateQueries({ queryKey: keys.conflicts });
      queryClient.invalidateQueries({ queryKey: keys.slots });
    },
    onError: (error: Error) => {
      toast.error(`Erreur lors de la résolution: ${error.message}`);
    },
  });

  // Mutation: Envoyer un message
  const sendMessage = useMutation({
    mutationFn: (data: Parameters<typeof coordinationService.envoyerMessage>[0]) =>
      coordinationService.envoyerMessage(data),
    onSuccess: () => {
      toast.success('Message envoyé');
      queryClient.invalidateQueries({ queryKey: keys.messages });
    },
    onError: (error: Error) => {
      toast.error(`Erreur lors de l'envoi: ${error.message}`);
    },
  });

  // Mutation: Ajouter entrée journal
  const addJournalEntry = useMutation({
    mutationFn: (data: Parameters<typeof coordinationService.ajouterEntreeJournal>[0]) =>
      coordinationService.ajouterEntreeJournal(data),
    onSuccess: () => {
      toast.success('Entrée ajoutée au carnet');
      queryClient.invalidateQueries({ queryKey: keys.journal });
    },
    onError: (error: Error) => {
      toast.error(`Erreur lors de l'ajout: ${error.message}`);
    },
  });

  // Mutation: Créer point d'interface
  const createInterface = useMutation({
    mutationFn: (data: Parameters<typeof coordinationService.creerPointInterface>[0]) =>
      coordinationService.creerPointInterface(data),
    onSuccess: () => {
      toast.success("Point d'interface créé");
      queryClient.invalidateQueries({ queryKey: keys.interfaces });
    },
    onError: (error: Error) => {
      toast.error(`Erreur lors de la création: ${error.message}`);
    },
  });

  // Mutation: Valider point d'interface
  const validateInterface = useMutation({
    mutationFn: (data: { interfaceId: string; commentaire?: string }) =>
      coordinationService.validerPointInterface(data.interfaceId, data.commentaire),
    onSuccess: () => {
      toast.success("Point d'interface validé");
      queryClient.invalidateQueries({ queryKey: keys.interfaces });
    },
    onError: (error: Error) => {
      toast.error(`Erreur lors de la validation: ${error.message}`);
    },
  });

  // Détection automatique des conflits
  const detectConflicts = useMutation({
    mutationFn: () => coordinationService.detecterConflits(projetId),
    onSuccess: (conflicts) => {
      if (conflicts.length > 0) {
        toast.warning(`${conflicts.length} conflit(s) détecté(s)`);
      } else {
        toast.success('Aucun conflit détecté');
      }
      queryClient.invalidateQueries({ queryKey: keys.conflicts });
    },
    onError: (error: Error) => {
      toast.error(`Erreur lors de la détection: ${error.message}`);
    },
  });

  return {
    // Queries
    slots: slotsQuery.data || [],
    conflicts: conflictsQuery.data || [],
    journal: journalQuery.data || [],
    messages: messagesQuery.data || [],
    interfaces: interfacesQuery.data || [],
    isLoading:
      slotsQuery.isLoading || conflictsQuery.isLoading || journalQuery.isLoading,
    error: slotsQuery.error || conflictsQuery.error,

    // Mutations
    createSlot: createSlot.mutate,
    resolveConflict: resolveConflict.mutate,
    sendMessage: sendMessage.mutate,
    addJournalEntry: addJournalEntry.mutate,
    createInterface: createInterface.mutate,
    validateInterface: validateInterface.mutate,
    detectConflicts: detectConflicts.mutate,

    // Mutation states
    isCreatingSlot: createSlot.isPending,
    isResolvingConflict: resolveConflict.isPending,
    isSendingMessage: sendMessage.isPending,
    isDetecting: detectConflicts.isPending,

    // Refetch
    refetch: () => {
      queryClient.invalidateQueries({ queryKey: keys.all });
    },
  };
}
