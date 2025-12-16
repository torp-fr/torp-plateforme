/**
 * usePayments - Hook React pour la gestion des paiements
 * ZÉRO MOCK - Données réelles depuis Supabase
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';

// =============================================================================
// TYPES
// =============================================================================

export type PaymentStatus = 'pending' | 'awaiting_payment' | 'processing' | 'held' | 'released' | 'refunded' | 'disputed' | 'cancelled';
export type PaymentType = 'deposit' | 'milestone' | 'final' | 'retention' | 'penalty' | 'adjustment';
export type MilestoneStatus = 'pending' | 'in_progress' | 'submitted' | 'validated' | 'rejected' | 'completed';

export interface PaymentMilestone {
  id: string;
  contract_id: string;
  numero: number;
  designation: string;
  description?: string;
  montant_ht: number;
  montant_ttc: number;
  pourcentage_contrat?: number;
  date_prevue?: string;
  date_soumission?: string;
  date_validation?: string;
  date_paiement?: string;
  status: MilestoneStatus;
  conditions_declenchement?: string;
  preuves_requises?: string[];
  documents_soumis?: string[];
  notes?: string;
  created_at: string;
  updated_at: string;
}

export interface Payment {
  id: string;
  milestone_id?: string;
  contract_id: string;
  reference: string;
  type: PaymentType;
  montant_demande: number;
  montant_valide?: number;
  montant_paye?: number;
  status: PaymentStatus;
  date_demande: string;
  date_validation?: string;
  date_paiement?: string;
  stripe_payment_intent_id?: string;
  documents: string[];
  notes?: string;
  created_at: string;
  updated_at: string;
}

export interface PaymentStats {
  totalContrat: number;
  totalDemande: number;
  totalValide: number;
  totalPaye: number;
  enAttente: number;
  enLitige: number;
  pourcentageAvancement: number;
}

// =============================================================================
// HOOK
// =============================================================================

interface UsePaymentsOptions {
  projectId?: string;
  contractId?: string;
  enabled?: boolean;
}

export function usePayments({ projectId, contractId, enabled = true }: UsePaymentsOptions = {}) {
  const queryClient = useQueryClient();

  // Query keys
  const keys = {
    milestones: ['payment-milestones', contractId || projectId] as const,
    payments: ['payments', contractId || projectId] as const,
    stats: ['payment-stats', contractId || projectId] as const,
    contract: ['contract', contractId] as const,
  };

  // Récupérer les jalons de paiement
  const milestonesQuery = useQuery({
    queryKey: keys.milestones,
    queryFn: async () => {
      let query = supabase
        .from('payment_milestones')
        .select(`
          *,
          contract:project_contracts(id, reference, titre, montant_total_ht, montant_total_ttc, entreprise_id, client_id)
        `)
        .order('numero', { ascending: true });

      if (contractId) {
        query = query.eq('contract_id', contractId);
      }

      const { data, error } = await query;

      if (error) {
        console.error('[usePayments] Error fetching milestones:', error);
        // Retourner un tableau vide en cas d'erreur (table peut ne pas exister)
        return [];
      }

      return (data || []) as (PaymentMilestone & { contract: any })[];
    },
    enabled: enabled && !!(contractId || projectId),
    staleTime: 2 * 60 * 1000,
  });

  // Récupérer les paiements
  const paymentsQuery = useQuery({
    queryKey: keys.payments,
    queryFn: async () => {
      let query = supabase
        .from('payments')
        .select('*')
        .order('created_at', { ascending: false });

      if (contractId) {
        query = query.eq('contract_id', contractId);
      }

      const { data, error } = await query;

      if (error) {
        console.error('[usePayments] Error fetching payments:', error);
        return [];
      }

      return (data || []) as Payment[];
    },
    enabled: enabled && !!(contractId || projectId),
    staleTime: 2 * 60 * 1000,
  });

  // Calculer les statistiques
  const stats: PaymentStats = {
    totalContrat: 0,
    totalDemande: 0,
    totalValide: 0,
    totalPaye: 0,
    enAttente: 0,
    enLitige: 0,
    pourcentageAvancement: 0,
  };

  const milestones = milestonesQuery.data || [];
  const payments = paymentsQuery.data || [];

  if (milestones.length > 0) {
    stats.totalContrat = milestones.reduce((sum, m) => sum + (m.montant_ttc || 0), 0);
    stats.totalValide = milestones
      .filter(m => m.status === 'validated' || m.status === 'completed')
      .reduce((sum, m) => sum + (m.montant_ttc || 0), 0);
    stats.totalPaye = milestones
      .filter(m => m.status === 'completed')
      .reduce((sum, m) => sum + (m.montant_ttc || 0), 0);
    stats.enAttente = milestones.filter(m => m.status === 'submitted').length;
    stats.pourcentageAvancement = stats.totalContrat > 0
      ? Math.round((stats.totalPaye / stats.totalContrat) * 100)
      : 0;
  }

  if (payments.length > 0) {
    stats.totalDemande = payments.reduce((sum, p) => sum + (p.montant_demande || 0), 0);
    stats.enLitige = payments.filter(p => p.status === 'disputed').length;
  }

  // Mutation: Soumettre un jalon pour validation
  const submitMilestoneMutation = useMutation({
    mutationFn: async ({ milestoneId, documents, notes }: {
      milestoneId: string;
      documents?: string[];
      notes?: string
    }) => {
      const { error } = await supabase
        .from('payment_milestones')
        .update({
          status: 'submitted',
          date_soumission: new Date().toISOString(),
          documents_soumis: documents,
          notes,
          updated_at: new Date().toISOString(),
        })
        .eq('id', milestoneId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: keys.milestones });
      toast.success('Jalon soumis pour validation');
    },
    onError: (error) => {
      toast.error(`Erreur: ${error.message}`);
    },
  });

  // Mutation: Valider un jalon (côté client)
  const validateMilestoneMutation = useMutation({
    mutationFn: async ({ milestoneId, montantValide, notes }: {
      milestoneId: string;
      montantValide?: number;
      notes?: string
    }) => {
      const { error } = await supabase
        .from('payment_milestones')
        .update({
          status: 'validated',
          date_validation: new Date().toISOString(),
          notes,
          updated_at: new Date().toISOString(),
        })
        .eq('id', milestoneId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: keys.milestones });
      toast.success('Jalon validé');
    },
    onError: (error) => {
      toast.error(`Erreur: ${error.message}`);
    },
  });

  // Mutation: Rejeter un jalon
  const rejectMilestoneMutation = useMutation({
    mutationFn: async ({ milestoneId, raison }: { milestoneId: string; raison: string }) => {
      const { error } = await supabase
        .from('payment_milestones')
        .update({
          status: 'rejected',
          notes: raison,
          updated_at: new Date().toISOString(),
        })
        .eq('id', milestoneId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: keys.milestones });
      toast.success('Jalon rejeté');
    },
    onError: (error) => {
      toast.error(`Erreur: ${error.message}`);
    },
  });

  // Mutation: Marquer comme payé
  const markAsPaidMutation = useMutation({
    mutationFn: async (milestoneId: string) => {
      const { error } = await supabase
        .from('payment_milestones')
        .update({
          status: 'completed',
          date_paiement: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', milestoneId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: keys.milestones });
      queryClient.invalidateQueries({ queryKey: keys.payments });
      toast.success('Paiement enregistré');
    },
    onError: (error) => {
      toast.error(`Erreur: ${error.message}`);
    },
  });

  // Mutation: Créer une demande de paiement
  const createPaymentRequestMutation = useMutation({
    mutationFn: async (payment: Partial<Payment>) => {
      const { data, error } = await supabase
        .from('payments')
        .insert({
          ...payment,
          status: 'pending',
          date_demande: new Date().toISOString(),
          reference: `PAY-${Date.now()}`,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: keys.payments });
      toast.success('Demande de paiement créée');
    },
    onError: (error) => {
      toast.error(`Erreur: ${error.message}`);
    },
  });

  return {
    // Data
    milestones,
    payments,
    stats,

    // Loading states
    isLoading: milestonesQuery.isLoading || paymentsQuery.isLoading,
    isLoadingMilestones: milestonesQuery.isLoading,
    isLoadingPayments: paymentsQuery.isLoading,

    // Error states
    error: milestonesQuery.error || paymentsQuery.error,

    // Mutations
    submitMilestone: submitMilestoneMutation.mutate,
    validateMilestone: validateMilestoneMutation.mutate,
    rejectMilestone: rejectMilestoneMutation.mutate,
    markAsPaid: markAsPaidMutation.mutate,
    createPaymentRequest: createPaymentRequestMutation.mutate,

    // Mutation states
    isSubmitting: submitMilestoneMutation.isPending,
    isValidating: validateMilestoneMutation.isPending,
    isRejecting: rejectMilestoneMutation.isPending,
    isMarkingPaid: markAsPaidMutation.isPending,
    isCreatingRequest: createPaymentRequestMutation.isPending,

    // Refetch
    refetch: () => {
      milestonesQuery.refetch();
      paymentsQuery.refetch();
    },
  };
}

export default usePayments;
