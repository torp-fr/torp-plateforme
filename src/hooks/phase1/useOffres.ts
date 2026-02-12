/**
 * Hook pour la gestion des offres (Phase 1)
 * Analyse, comparaison et sélection des offres entreprises
 * ZÉRO MOCK - Données réelles uniquement
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/hooks/use-toast';

// =============================================================================
// TYPES
// =============================================================================

export interface Offre {
  id: string;
  project_id: string;
  tender_id?: string;
  entreprise_id: string;
  entreprise_nom: string;
  entreprise_siret?: string;
  lot_code: string;
  montant_ht: number;
  montant_ttc: number;
  delai_jours: number;
  date_reception: string;
  statut: 'recue' | 'analysee' | 'retenue' | 'rejetee' | 'negociation';
  score_global?: number;
  score_prix?: number;
  score_technique?: number;
  score_fiabilite?: number;
  score_delai?: number;
  documents: string[];
  memoire_technique?: string;
  commentaires?: string;
  points_forts?: string[];
  points_faibles?: string[];
  alertes?: string[];
}

export interface OffreStats {
  total: number;
  recues: number;
  analysees: number;
  retenues: number;
  rejetees: number;
  montantMoyen: number;
  montantMin: number;
  montantMax: number;
  delaiMoyen: number;
}

export interface OffreComparaison {
  offre_id: string;
  rang: number;
  score: number;
  ecart_prix_moyen: number;
  recommandation: 'retenir' | 'negocier' | 'rejeter';
}

export interface UseOffresOptions {
  projectId: string;
  tenderId?: string;
  lotCode?: string;
  enabled?: boolean;
}

// =============================================================================
// HOOK
// =============================================================================

export function useOffres({ projectId, tenderId, lotCode, enabled = true }: UseOffresOptions) {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  // Récupérer les offres
  const offresQuery = useQuery({
    queryKey: ['offres', projectId, tenderId, lotCode],
    queryFn: async () => {
      let query = supabase
        .from('tender_responses')
        .select('*')
        .eq('project_id', projectId)
        .not('submitted_at', 'is', null); // Seulement les offres soumises

      if (tenderId) {
        query = query.eq('tender_id', tenderId);
      }
      if (lotCode) {
        query = query.eq('lot_code', lotCode);
      }

      const { data, error } = await query.order('submitted_at', { ascending: false });
      if (error) throw error;

      // Transformer en format Offre
      return (data || []).map(r => ({
        id: r.id,
        project_id: r.project_id,
        tender_id: r.tender_id,
        entreprise_id: r.entreprise_id,
        entreprise_nom: r.company_name || 'N/A',
        entreprise_siret: r.siret,
        lot_code: r.lot_code,
        montant_ht: r.amount_ht || 0,
        montant_ttc: r.amount_ttc || 0,
        delai_jours: r.duration_days || 0,
        date_reception: r.submitted_at,
        statut: mapStatus(r.analysis_status || r.status),
        score_global: r.score,
        score_prix: r.score_prix,
        score_technique: r.score_technique,
        score_fiabilite: r.score_fiabilite,
        documents: r.documents || [],
        memoire_technique: r.memoire_technique,
        commentaires: r.notes,
        points_forts: r.points_forts || [],
        points_faibles: r.points_faibles || [],
        alertes: r.alertes || [],
      })) as Offre[];
    },
    enabled: enabled && !!projectId,
  });

  // Mapper le statut
  function mapStatus(status: string): Offre['statut'] {
    const mapping: Record<string, Offre['statut']> = {
      submitted: 'recue',
      analyzed: 'analysee',
      accepted: 'retenue',
      rejected: 'rejetee',
      negotiation: 'negociation',
    };
    return mapping[status] || 'recue';
  }

  // Analyser une offre
  const analyzeMutation = useMutation({
    mutationFn: async (offreId: string) => {
      // Récupérer l'offre
      const offre = offresQuery.data?.find(o => o.id === offreId);
      if (!offre) throw new Error('Offre non trouvée');

      // Calculer les scores (version simplifiée - l'agent IA fera mieux)
      const autresOffres = offresQuery.data?.filter(o => o.id !== offreId && o.lot_code === offre.lot_code) || [];
      const montantMoyen = autresOffres.length > 0
        ? autresOffres.reduce((s, o) => s + o.montant_ht, 0) / autresOffres.length
        : offre.montant_ht;

      const ecartPrix = ((offre.montant_ht - montantMoyen) / montantMoyen) * 100;
      let scorePrix = 70;
      if (ecartPrix <= -10) scorePrix = 95;
      else if (ecartPrix <= 0) scorePrix = 85;
      else if (ecartPrix <= 10) scorePrix = 70;
      else if (ecartPrix <= 20) scorePrix = 50;
      else scorePrix = 30;

      const scoreDelai = offre.delai_jours <= 30 ? 90 : offre.delai_jours <= 60 ? 70 : 50;
      const scoreTechnique = 70; // À améliorer avec agent IA
      const scoreFiabilite = 70; // À améliorer avec données entreprise

      const scoreGlobal = Math.round(
        scorePrix * 0.30 +
        scoreTechnique * 0.25 +
        scoreFiabilite * 0.25 +
        scoreDelai * 0.20
      );

      // Mettre à jour
      const { data, error } = await supabase
        .from('tender_responses')
        .update({
          analysis_status: 'analyzed',
          analyzed_at: new Date().toISOString(),
          score: scoreGlobal,
          score_prix: scorePrix,
          score_technique: scoreTechnique,
          score_fiabilite: scoreFiabilite,
        })
        .eq('id', offreId)
        .select()
        .single();

      if (error) throw error;
      return { ...data, scoreGlobal, scorePrix, scoreTechnique, scoreFiabilite, scoreDelai };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['offres', projectId] });
      toast({
        title: 'Analyse terminée',
        description: 'L\'offre a été analysée avec succès.',
      });
    },
    onError: (error) => {
      toast({
        title: 'Erreur',
        description: 'Impossible d\'analyser l\'offre.',
        variant: 'destructive',
      });
      console.error('Analyze error:', error);
    },
  });

  // Retenir une offre
  const retainMutation = useMutation({
    mutationFn: async (offreId: string) => {
      const { data, error } = await supabase
        .from('tender_responses')
        .update({
          analysis_status: 'accepted',
          accepted_at: new Date().toISOString(),
        })
        .eq('id', offreId)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['offres', projectId] });
      toast({
        title: 'Offre retenue',
        description: 'L\'offre a été marquée comme retenue.',
      });
    },
  });

  // Rejeter une offre
  const rejectMutation = useMutation({
    mutationFn: async ({ offreId, motif }: { offreId: string; motif: string }) => {
      const { data, error } = await supabase
        .from('tender_responses')
        .update({
          analysis_status: 'rejected',
          rejected_at: new Date().toISOString(),
          rejection_reason: motif,
        })
        .eq('id', offreId)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['offres', projectId] });
      toast({
        title: 'Offre rejetée',
        description: 'L\'offre a été marquée comme rejetée.',
      });
    },
  });

  // Comparer les offres
  const comparerOffres = (): OffreComparaison[] => {
    const offres = offresQuery.data || [];
    if (offres.length === 0) return [];

    const montantMoyen = offres.reduce((s, o) => s + o.montant_ht, 0) / offres.length;

    return offres
      .map(o => ({
        offre_id: o.id,
        score: o.score_global || 0,
        ecart_prix_moyen: Math.round(((o.montant_ht - montantMoyen) / montantMoyen) * 100),
        recommandation: (o.score_global || 0) >= 75 ? 'retenir' as const
          : (o.score_global || 0) >= 50 ? 'negocier' as const
          : 'rejeter' as const,
      }))
      .sort((a, b) => b.score - a.score)
      .map((o, i) => ({ ...o, rang: i + 1 }));
  };

  // Statistiques
  const stats: OffreStats = {
    total: offresQuery.data?.length || 0,
    recues: offresQuery.data?.filter(o => o.statut === 'recue').length || 0,
    analysees: offresQuery.data?.filter(o => o.statut === 'analysee').length || 0,
    retenues: offresQuery.data?.filter(o => o.statut === 'retenue').length || 0,
    rejetees: offresQuery.data?.filter(o => o.statut === 'rejetee').length || 0,
    montantMoyen: offresQuery.data?.length
      ? Math.round(offresQuery.data.reduce((s, o) => s + o.montant_ht, 0) / offresQuery.data.length)
      : 0,
    montantMin: offresQuery.data?.length
      ? Math.min(...offresQuery.data.map(o => o.montant_ht))
      : 0,
    montantMax: offresQuery.data?.length
      ? Math.max(...offresQuery.data.map(o => o.montant_ht))
      : 0,
    delaiMoyen: offresQuery.data?.length
      ? Math.round(offresQuery.data.reduce((s, o) => s + o.delai_jours, 0) / offresQuery.data.length)
      : 0,
  };

  return {
    // Data
    offres: offresQuery.data || [],
    isLoading: offresQuery.isLoading,
    isError: offresQuery.isError,
    error: offresQuery.error,
    stats,

    // Comparaison
    comparaison: comparerOffres(),
    meilleureOffre: comparerOffres()[0]?.offre_id,

    // Actions
    analyzeOffre: analyzeMutation.mutate,
    analyzeOffreAsync: analyzeMutation.mutateAsync,
    isAnalyzing: analyzeMutation.isPending,

    retainOffre: retainMutation.mutate,
    isRetaining: retainMutation.isPending,

    rejectOffre: rejectMutation.mutate,
    isRejecting: rejectMutation.isPending,

    // Refresh
    refetch: offresQuery.refetch,
  };
}

export default useOffres;
