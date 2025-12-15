/**
 * Hook pour la gestion des appels d'offres (Phase 1)
 * Récupère et gère les tenders depuis Supabase
 * ZÉRO MOCK - Données réelles uniquement
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/hooks/use-toast';

// =============================================================================
// TYPES
// =============================================================================

export interface Tender {
  id: string;
  project_id: string;
  lot_code: string;
  lot_nom: string;
  deadline: string;
  status: 'draft' | 'open' | 'closed' | 'awarded' | 'cancelled';
  responses_count: number;
  created_at: string;
  updated_at?: string;
}

export interface TenderResponse {
  id: string;
  tender_id: string;
  entreprise_id: string;
  entreprise_nom: string;
  montant_ht?: number;
  montant_ttc?: number;
  status: 'invited' | 'pending' | 'submitted' | 'analyzed' | 'rejected' | 'accepted';
  score?: number;
  analyzed: boolean;
  submitted_at?: string;
  created_at: string;
}

export interface TenderStats {
  entreprisesContactees: number;
  offresRecues: number;
  offresAnalysees: number;
  contratsSignes: number;
  totalAOOuverts: number;
  montantMoyenOffres?: number;
}

export interface CreateTenderData {
  project_id: string;
  lot_code: string;
  lot_nom?: string;
  deadline: string;
  description?: string;
}

export interface UseTendersOptions {
  projectId: string;
  enabled?: boolean;
}

// =============================================================================
// HOOK PRINCIPAL
// =============================================================================

export function useTenders({ projectId, enabled = true }: UseTendersOptions) {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  // -------------------------------------------------------------------------
  // Query: Liste des appels d'offres
  // -------------------------------------------------------------------------
  const tendersQuery = useQuery({
    queryKey: ['tenders', projectId],
    queryFn: async (): Promise<Tender[]> => {
      // Récupérer les tenders avec le count des réponses
      const { data: tenders, error } = await supabase
        .from('tenders')
        .select('*')
        .eq('phase0_project_id', projectId)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('[useTenders] Error fetching tenders:', error);
        return [];
      }

      if (!tenders || tenders.length === 0) return [];

      // Récupérer le count des réponses pour chaque tender
      const tenderIds = tenders.map((t) => t.id);
      const { data: responses } = await supabase
        .from('tender_responses')
        .select('tender_id')
        .in('tender_id', tenderIds);

      // Grouper les réponses par tender
      const responseCountByTender: Record<string, number> = {};
      (responses || []).forEach((r) => {
        responseCountByTender[r.tender_id] = (responseCountByTender[r.tender_id] || 0) + 1;
      });

      return tenders.map((t) => ({
        id: t.id,
        project_id: projectId,
        lot_code: t.lot_code || t.lot_ids?.[0] || 'LOT',
        lot_nom: t.title || t.lot_code || 'Appel d\'offres',
        deadline: t.deadline || t.response_deadline,
        status: mapTenderStatus(t.status),
        responses_count: responseCountByTender[t.id] || 0,
        created_at: t.created_at,
        updated_at: t.updated_at,
      }));
    },
    enabled: enabled && !!projectId,
    staleTime: 1000 * 60 * 2, // 2 minutes
  });

  // -------------------------------------------------------------------------
  // Query: Statistiques globales
  // -------------------------------------------------------------------------
  const statsQuery = useQuery({
    queryKey: ['tenders-stats', projectId],
    queryFn: async (): Promise<TenderStats> => {
      // Récupérer les tenders du projet
      const { data: tenders } = await supabase
        .from('tenders')
        .select('id, status')
        .eq('phase0_project_id', projectId);

      if (!tenders || tenders.length === 0) {
        return {
          entreprisesContactees: 0,
          offresRecues: 0,
          offresAnalysees: 0,
          contratsSignes: 0,
          totalAOOuverts: 0,
        };
      }

      const tenderIds = tenders.map((t) => t.id);

      // Récupérer les réponses
      const { data: responses } = await supabase
        .from('tender_responses')
        .select('id, tender_id, status, analyzed, montant_ht')
        .in('tender_id', tenderIds);

      // Récupérer les contrats signés
      const { data: contracts } = await supabase
        .from('project_contracts')
        .select('id, status')
        .eq('project_id', projectId);

      // Calculer les stats
      const allResponses = responses || [];
      const submittedResponses = allResponses.filter(
        (r) => r.status !== 'invited' && r.status !== 'pending'
      );
      const analyzedResponses = allResponses.filter((r) => r.analyzed);
      const signedContracts = (contracts || []).filter(
        (c) => c.status === 'signed' || c.status === 'active'
      );

      // Montant moyen des offres
      const offresAvecMontant = submittedResponses.filter((r) => r.montant_ht);
      const montantMoyen =
        offresAvecMontant.length > 0
          ? offresAvecMontant.reduce((sum, r) => sum + (r.montant_ht || 0), 0) /
            offresAvecMontant.length
          : undefined;

      return {
        entreprisesContactees: allResponses.length,
        offresRecues: submittedResponses.length,
        offresAnalysees: analyzedResponses.length,
        contratsSignes: signedContracts.length,
        totalAOOuverts: tenders.filter((t) => t.status === 'open' || t.status === 'published').length,
        montantMoyenOffres: montantMoyen,
      };
    },
    enabled: enabled && !!projectId,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });

  // -------------------------------------------------------------------------
  // Query: Réponses pour un tender spécifique
  // -------------------------------------------------------------------------
  const useResponses = (tenderId: string) =>
    useQuery({
      queryKey: ['tender-responses', tenderId],
      queryFn: async (): Promise<TenderResponse[]> => {
        const { data, error } = await supabase
          .from('tender_responses')
          .select(
            `
            *,
            entreprise:entreprises(id, raison_sociale, siret)
          `
          )
          .eq('tender_id', tenderId)
          .order('created_at', { ascending: false });

        if (error) {
          console.error('[useTenders] Error fetching responses:', error);
          return [];
        }

        return (data || []).map((r) => ({
          id: r.id,
          tender_id: r.tender_id,
          entreprise_id: r.entreprise_id,
          entreprise_nom: r.entreprise?.raison_sociale || 'Entreprise inconnue',
          montant_ht: r.montant_ht,
          montant_ttc: r.montant_ttc,
          status: r.status,
          score: r.score,
          analyzed: r.analyzed || false,
          submitted_at: r.submitted_at,
          created_at: r.created_at,
        }));
      },
      enabled: !!tenderId,
    });

  // -------------------------------------------------------------------------
  // Mutation: Créer un appel d'offres
  // -------------------------------------------------------------------------
  const createTenderMutation = useMutation({
    mutationFn: async (data: CreateTenderData) => {
      const { error } = await supabase.from('tenders').insert({
        phase0_project_id: data.project_id,
        lot_code: data.lot_code,
        title: data.lot_nom || data.lot_code,
        response_deadline: data.deadline,
        description: data.description,
        status: 'draft',
      });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tenders', projectId] });
      queryClient.invalidateQueries({ queryKey: ['tenders-stats', projectId] });
      toast({
        title: 'Appel d\'offres créé',
        description: 'L\'appel d\'offres a été créé avec succès.',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Erreur',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  // -------------------------------------------------------------------------
  // Mutation: Publier un appel d'offres
  // -------------------------------------------------------------------------
  const publishTenderMutation = useMutation({
    mutationFn: async (tenderId: string) => {
      const { error } = await supabase
        .from('tenders')
        .update({ status: 'open', published_at: new Date().toISOString() })
        .eq('id', tenderId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tenders', projectId] });
      toast({
        title: 'Appel d\'offres publié',
        description: 'Les entreprises peuvent maintenant soumettre leurs offres.',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Erreur',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  // -------------------------------------------------------------------------
  // Mutation: Clôturer un appel d'offres
  // -------------------------------------------------------------------------
  const closeTenderMutation = useMutation({
    mutationFn: async (tenderId: string) => {
      const { error } = await supabase
        .from('tenders')
        .update({ status: 'closed', closed_at: new Date().toISOString() })
        .eq('id', tenderId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tenders', projectId] });
      toast({
        title: 'Appel d\'offres clôturé',
        description: 'La consultation est maintenant fermée.',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Erreur',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  // -------------------------------------------------------------------------
  // Mutation: Attribuer un marché
  // -------------------------------------------------------------------------
  const awardTenderMutation = useMutation({
    mutationFn: async ({ tenderId, responseId }: { tenderId: string; responseId: string }) => {
      // Mettre à jour le tender
      const { error: tenderError } = await supabase
        .from('tenders')
        .update({ status: 'awarded', awarded_response_id: responseId })
        .eq('id', tenderId);

      if (tenderError) throw tenderError;

      // Mettre à jour la réponse sélectionnée
      const { error: responseError } = await supabase
        .from('tender_responses')
        .update({ status: 'accepted' })
        .eq('id', responseId);

      if (responseError) throw responseError;

      // Rejeter les autres réponses
      const { error: rejectError } = await supabase
        .from('tender_responses')
        .update({ status: 'rejected' })
        .eq('tender_id', tenderId)
        .neq('id', responseId);

      if (rejectError) console.warn('[useTenders] Error rejecting other responses:', rejectError);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tenders', projectId] });
      queryClient.invalidateQueries({ queryKey: ['tenders-stats', projectId] });
      toast({
        title: 'Marché attribué',
        description: 'L\'entreprise a été sélectionnée.',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Erreur',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  // -------------------------------------------------------------------------
  // Return
  // -------------------------------------------------------------------------

  return {
    // Données
    tenders: tendersQuery.data || [],
    stats: statsQuery.data || {
      entreprisesContactees: 0,
      offresRecues: 0,
      offresAnalysees: 0,
      contratsSignes: 0,
      totalAOOuverts: 0,
    },

    // États
    isLoading: tendersQuery.isLoading,
    isLoadingStats: statsQuery.isLoading,
    isCreating: createTenderMutation.isPending,
    isPublishing: publishTenderMutation.isPending,

    // Erreurs
    error: tendersQuery.error,

    // Actions
    createTender: createTenderMutation.mutate,
    publishTender: publishTenderMutation.mutate,
    closeTender: closeTenderMutation.mutate,
    awardTender: awardTenderMutation.mutate,
    refetch: () => {
      tendersQuery.refetch();
      statsQuery.refetch();
    },

    // Hook pour les réponses d'un tender spécifique
    useResponses,
  };
}

// =============================================================================
// HELPERS
// =============================================================================

function mapTenderStatus(status: string): Tender['status'] {
  switch (status) {
    case 'draft':
      return 'draft';
    case 'open':
    case 'published':
      return 'open';
    case 'closed':
    case 'evaluation':
      return 'closed';
    case 'awarded':
    case 'completed':
      return 'awarded';
    case 'cancelled':
      return 'cancelled';
    default:
      return 'draft';
  }
}

// =============================================================================
// EXPORTS
// =============================================================================

export type { CreateTenderData, UseTendersOptions };
