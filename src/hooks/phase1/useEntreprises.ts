/**
 * Hook pour la gestion des entreprises (Phase 1)
 * Recherche, invitation et suivi des entreprises consultées
 * ZÉRO MOCK - Données réelles uniquement
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/hooks/use-toast';

// =============================================================================
// TYPES
// =============================================================================

export interface Entreprise {
  id: string;
  siret: string;
  nom: string;
  adresse: string;
  ville: string;
  code_postal: string;
  telephone?: string;
  email?: string;
  site_web?: string;
  activite_principale: string;
  effectif?: string;
  chiffre_affaires?: number;
  date_creation?: string;
  rge?: boolean;
  qualibat?: boolean;
  score_fiabilite?: number;
  notes?: string;
}

export interface EntrepriseInvitation {
  id: string;
  projet_id: string;
  entreprise_id: string;
  lot_code: string;
  statut: 'invited' | 'consulted' | 'responded' | 'declined';
  date_invitation: string;
  date_reponse?: string;
}

export interface SearchParams {
  activite?: string;
  localisation?: string;
  rayon?: number;
  rge?: boolean;
  qualibat?: boolean;
  chiffre_affaires_min?: number;
}

export interface UseEntreprisesOptions {
  projectId: string;
  lotCode?: string;
  enabled?: boolean;
}

// =============================================================================
// HOOK
// =============================================================================

export function useEntreprises({ projectId, lotCode, enabled = true }: UseEntreprisesOptions) {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  // Récupérer les entreprises associées au projet
  const entreprisesQuery = useQuery({
    queryKey: ['entreprises', projectId, lotCode],
    queryFn: async () => {
      let query = supabase
        .from('tender_responses')
        .select(`
          id,
          entreprise_id,
          company_name,
          siret,
          status,
          lot_code,
          invited_at,
          submitted_at
        `)
        .eq('project_id', projectId);

      if (lotCode) {
        query = query.eq('lot_code', lotCode);
      }

      const { data, error } = await query.order('invited_at', { ascending: false });

      if (error) throw error;

      // Transformer en format Entreprise
      return (data || []).map(r => ({
        id: r.entreprise_id || r.id,
        siret: r.siret || '',
        nom: r.company_name || 'N/A',
        statut: r.status,
        lot_code: r.lot_code,
        date_invitation: r.invited_at,
        date_reponse: r.submitted_at,
      }));
    },
    enabled: enabled && !!projectId,
  });

  // Rechercher des entreprises (externes ou base)
  const searchMutation = useMutation({
    mutationFn: async (params: SearchParams) => {
      // Recherche dans la base locale d'entreprises
      let query = supabase
        .from('entreprises')
        .select('*')
        .limit(50);

      if (params.activite) {
        query = query.ilike('activite_principale', `%${params.activite}%`);
      }
      if (params.localisation) {
        query = query.or(`ville.ilike.%${params.localisation}%,code_postal.ilike.${params.localisation}%`);
      }
      if (params.rge) {
        query = query.eq('rge', true);
      }
      if (params.qualibat) {
        query = query.eq('qualibat', true);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as Entreprise[];
    },
  });

  // Inviter une entreprise à répondre
  const inviteMutation = useMutation({
    mutationFn: async ({
      entreprise,
      lotCode: lot
    }: {
      entreprise: Partial<Entreprise>;
      lotCode: string
    }) => {
      const { data, error } = await supabase
        .from('tender_responses')
        .insert({
          project_id: projectId,
          entreprise_id: entreprise.id,
          company_name: entreprise.nom,
          siret: entreprise.siret,
          lot_code: lot,
          status: 'invited',
          invited_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['entreprises', projectId] });
      toast({
        title: 'Invitation envoyée',
        description: 'L\'entreprise a été invitée à consulter l\'appel d\'offres.',
      });
    },
    onError: (error) => {
      toast({
        title: 'Erreur',
        description: 'Impossible d\'inviter l\'entreprise.',
        variant: 'destructive',
      });
      console.error('Invite error:', error);
    },
  });

  // Relancer une entreprise
  const relanceMutation = useMutation({
    mutationFn: async (entrepriseId: string) => {
      const { data, error } = await supabase
        .from('tender_responses')
        .update({
          last_reminder_at: new Date().toISOString(),
          reminders_count: supabase.rpc('increment_reminders', { row_id: entrepriseId }),
        })
        .eq('id', entrepriseId)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast({
        title: 'Relance envoyée',
        description: 'L\'entreprise a été relancée.',
      });
    },
  });

  // Statistiques
  const stats = {
    total: entreprisesQuery.data?.length || 0,
    invitees: entreprisesQuery.data?.filter(e => e.statut === 'invited').length || 0,
    reponses: entreprisesQuery.data?.filter(e => e.date_reponse).length || 0,
    enAttente: entreprisesQuery.data?.filter(e => !e.date_reponse && e.statut === 'invited').length || 0,
  };

  return {
    // Data
    entreprises: entreprisesQuery.data || [],
    isLoading: entreprisesQuery.isLoading,
    isError: entreprisesQuery.isError,
    error: entreprisesQuery.error,
    stats,

    // Actions
    searchEntreprises: searchMutation.mutateAsync,
    isSearching: searchMutation.isPending,
    searchResults: searchMutation.data,

    inviteEntreprise: inviteMutation.mutate,
    inviteEntrepriseAsync: inviteMutation.mutateAsync,
    isInviting: inviteMutation.isPending,

    relanceEntreprise: relanceMutation.mutate,
    isRelancing: relanceMutation.isPending,

    // Refresh
    refetch: entreprisesQuery.refetch,
  };
}

export default useEntreprises;
