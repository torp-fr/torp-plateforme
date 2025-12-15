/**
 * useOPR - Hook React pour la gestion des OPR Phase 4
 * Opérations Préalables à la Réception
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { oprService } from '@/services/phase4/opr.service';
import { toast } from 'sonner';
import type { OPRSession, OPRParticipant, OPRControle, Reserve, ReserveGravite } from '@/types/phase4.types';

interface UseOPROptions {
  chantierId: string;
  enabled?: boolean;
}

export function useOPR({ chantierId, enabled = true }: UseOPROptions) {
  const queryClient = useQueryClient();

  // Query keys
  const keys = {
    all: ['opr', chantierId] as const,
    sessions: ['opr', chantierId, 'sessions'] as const,
    session: (id: string) => ['opr', chantierId, 'session', id] as const,
    activeSession: ['opr', chantierId, 'active'] as const,
    checklists: ['opr', 'checklists'] as const,
  };

  // Liste des sessions OPR
  const sessionsQuery = useQuery({
    queryKey: keys.sessions,
    queryFn: () => oprService.getSessionsByChantier(chantierId),
    enabled: enabled && !!chantierId,
    staleTime: 5 * 60 * 1000,
  });

  // Session active (en cours ou dernière planifiée)
  const activeSessionQuery = useQuery({
    queryKey: keys.activeSession,
    queryFn: async () => {
      const sessions = await oprService.getSessionsByChantier(chantierId);
      // Trouver la session en cours ou la dernière planifiée
      const active = sessions.find(s => s.statut === 'en_cours');
      if (active) return active;
      const planned = sessions.filter(s => s.statut === 'planifiee')
        .sort((a, b) => new Date(b.dateOPR).getTime() - new Date(a.dateOPR).getTime());
      return planned[0] || null;
    },
    enabled: enabled && !!chantierId,
    staleTime: 2 * 60 * 1000,
  });

  // Checklists disponibles
  const checklistsQuery = useQuery({
    queryKey: keys.checklists,
    queryFn: () => oprService.getAvailableChecklists(),
    staleTime: 30 * 60 * 1000, // 30 minutes - static data
  });

  // Mutation: Créer une session OPR
  const createSession = useMutation({
    mutationFn: (params: {
      dateOPR: string;
      heureDebut: string;
      lieu: string;
      lots: string[];
      createdBy: string;
    }) => oprService.createSession(chantierId, params),
    onSuccess: (session) => {
      toast.success('Session OPR créée avec succès');
      queryClient.invalidateQueries({ queryKey: keys.all });
      return session;
    },
    onError: (error: Error) => {
      toast.error(`Erreur lors de la création: ${error.message}`);
    },
  });

  // Mutation: Démarrer une session
  const startSession = useMutation({
    mutationFn: (sessionId: string) => oprService.startSession(sessionId),
    onSuccess: () => {
      toast.success('Session OPR démarrée');
      queryClient.invalidateQueries({ queryKey: keys.all });
    },
    onError: (error: Error) => {
      toast.error(`Erreur: ${error.message}`);
    },
  });

  // Mutation: Terminer une session
  const endSession = useMutation({
    mutationFn: (sessionId: string) => oprService.endSession(sessionId),
    onSuccess: () => {
      toast.success('Session OPR terminée');
      queryClient.invalidateQueries({ queryKey: keys.all });
    },
    onError: (error: Error) => {
      toast.error(`Erreur: ${error.message}`);
    },
  });

  // Mutation: Ajouter un participant
  const addParticipant = useMutation({
    mutationFn: ({
      sessionId,
      participant,
    }: {
      sessionId: string;
      participant: Omit<OPRParticipant, 'id' | 'present' | 'signature' | 'dateSignature'>;
    }) => oprService.addParticipant(sessionId, participant),
    onSuccess: () => {
      toast.success('Participant ajouté');
      queryClient.invalidateQueries({ queryKey: keys.all });
    },
    onError: (error: Error) => {
      toast.error(`Erreur: ${error.message}`);
    },
  });

  // Mutation: Marquer un participant présent
  const markParticipantPresent = useMutation({
    mutationFn: ({
      sessionId,
      participantId,
      present,
    }: {
      sessionId: string;
      participantId: string;
      present?: boolean;
    }) => oprService.markParticipantPresent(sessionId, participantId, present),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: keys.all });
    },
  });

  // Mutation: Enregistrer signature participant
  const signParticipant = useMutation({
    mutationFn: ({
      sessionId,
      participantId,
      signature,
    }: {
      sessionId: string;
      participantId: string;
      signature: string;
    }) => oprService.signParticipant(sessionId, participantId, signature),
    onSuccess: () => {
      toast.success('Signature enregistrée');
      queryClient.invalidateQueries({ queryKey: keys.all });
    },
  });

  // Mutation: Envoyer convocations
  const sendConvocations = useMutation({
    mutationFn: ({
      sessionId,
      mode,
    }: {
      sessionId: string;
      mode: ('email' | 'lrar' | 'courrier')[];
    }) => oprService.sendConvocations(sessionId, mode),
    onSuccess: (result) => {
      if (result.success) {
        toast.success('Convocations envoyées');
      } else {
        toast.warning(`Convocations envoyées avec ${result.errors.length} erreur(s)`);
      }
      queryClient.invalidateQueries({ queryKey: keys.all });
    },
    onError: (error: Error) => {
      toast.error(`Erreur: ${error.message}`);
    },
  });

  // Mutation: Mettre à jour un contrôle
  const updateControle = useMutation({
    mutationFn: ({
      sessionId,
      controleId,
      update,
    }: {
      sessionId: string;
      controleId: string;
      update: {
        statut: OPRControle['statut'];
        commentaire?: string;
        photos?: string[];
      };
    }) => oprService.updateControle(sessionId, controleId, update),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: keys.all });
    },
  });

  // Mutation: Créer une réserve depuis un contrôle
  const createReserveFromControle = useMutation({
    mutationFn: ({
      sessionId,
      controleId,
      reserveData,
    }: {
      sessionId: string;
      controleId: string;
      reserveData: {
        nature: string;
        description: string;
        gravite: ReserveGravite;
        localisation: string;
        piece?: string;
        entrepriseId: string;
        entrepriseNom: string;
        photos?: string[];
        coutEstime?: number;
      };
    }) => oprService.createReserveFromControle(sessionId, controleId, reserveData),
    onSuccess: () => {
      toast.success('Réserve créée');
      queryClient.invalidateQueries({ queryKey: keys.all });
    },
    onError: (error: Error) => {
      toast.error(`Erreur: ${error.message}`);
    },
  });

  // Mutation: Ajouter une réserve libre
  const addReserve = useMutation({
    mutationFn: ({
      sessionId,
      reserveData,
    }: {
      sessionId: string;
      reserveData: {
        lot: string;
        piece?: string;
        localisation: string;
        nature: string;
        description: string;
        gravite: ReserveGravite;
        entrepriseId: string;
        entrepriseNom: string;
        photos?: string[];
        coutEstime?: number;
      };
    }) => oprService.addReserve(sessionId, reserveData),
    onSuccess: () => {
      toast.success('Réserve ajoutée');
      queryClient.invalidateQueries({ queryKey: keys.all });
    },
    onError: (error: Error) => {
      toast.error(`Erreur: ${error.message}`);
    },
  });

  // Mutation: Mettre à jour un document
  const updateDocument = useMutation({
    mutationFn: ({
      sessionId,
      documentId,
      update,
    }: {
      sessionId: string;
      documentId: string;
      update: {
        present: boolean;
        conforme?: boolean;
        commentaire?: string;
        fichier?: string;
      };
    }) => oprService.updateDocument(sessionId, documentId, update),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: keys.all });
    },
  });

  // Mutation: Ajouter une photo
  const addPhoto = useMutation({
    mutationFn: ({
      sessionId,
      photoUrl,
    }: {
      sessionId: string;
      photoUrl: string;
    }) => oprService.addPhoto(sessionId, photoUrl),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: keys.all });
    },
  });

  // Calcul des statistiques de la session active
  const getActiveSessionStats = () => {
    const session = activeSessionQuery.data;
    if (!session) return null;
    return oprService.getSessionStats(session);
  };

  // Vérification si réception possible
  const canProceedToReception = () => {
    const session = activeSessionQuery.data;
    if (!session) return { canProceed: false, blockers: ['Aucune session active'], warnings: [] };
    return oprService.canProceedToReception(session);
  };

  return {
    // Queries
    sessions: sessionsQuery.data || [],
    activeSession: activeSessionQuery.data,
    checklists: checklistsQuery.data || [],
    isLoading: sessionsQuery.isLoading,
    isLoadingActive: activeSessionQuery.isLoading,
    error: sessionsQuery.error,

    // Stats et vérifications
    stats: getActiveSessionStats(),
    receptionCheck: canProceedToReception(),

    // Mutations
    createSession: createSession.mutate,
    startSession: startSession.mutate,
    endSession: endSession.mutate,
    addParticipant: addParticipant.mutate,
    markParticipantPresent: markParticipantPresent.mutate,
    signParticipant: signParticipant.mutate,
    sendConvocations: sendConvocations.mutate,
    updateControle: updateControle.mutate,
    createReserveFromControle: createReserveFromControle.mutate,
    addReserve: addReserve.mutate,
    updateDocument: updateDocument.mutate,
    addPhoto: addPhoto.mutate,

    // Mutation states
    isCreating: createSession.isPending,
    isStarting: startSession.isPending,
    isEnding: endSession.isPending,
    isSendingConvocations: sendConvocations.isPending,

    // Refetch
    refetch: () => {
      queryClient.invalidateQueries({ queryKey: keys.all });
    },
  };
}

/**
 * Hook pour une session OPR spécifique
 */
export function useOPRSession(sessionId: string) {
  const queryClient = useQueryClient();

  const sessionQuery = useQuery({
    queryKey: ['opr', 'session', sessionId],
    queryFn: () => oprService.getSession(sessionId),
    enabled: !!sessionId,
    staleTime: 1 * 60 * 1000,
  });

  return {
    session: sessionQuery.data,
    isLoading: sessionQuery.isLoading,
    error: sessionQuery.error,
    stats: sessionQuery.data ? oprService.getSessionStats(sessionQuery.data) : null,
    canProceed: sessionQuery.data ? oprService.canProceedToReception(sessionQuery.data) : null,
    refetch: () => {
      queryClient.invalidateQueries({ queryKey: ['opr', 'session', sessionId] });
    },
  };
}
