/**
 * useReserves - Hook React pour la gestion des réserves Phase 4
 * Création, suivi et levée des réserves
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import type { Reserve, ReserveGravite, ReserveStatut } from '@/types/phase4.types';

interface UseReservesOptions {
  chantierId: string;
  oprSessionId?: string;
  filters?: {
    statut?: ReserveStatut;
    gravite?: ReserveGravite;
    lot?: string;
    entrepriseId?: string;
  };
  enabled?: boolean;
}

interface ReserveStats {
  total: number;
  ouvertes: number;
  enCours: number;
  levees: number;
  contestees: number;
  expirees: number;
  mineures: number;
  majeures: number;
  graves: number;
  bloquantes: number;
  enRetard: number;
}

export function useReserves({
  chantierId,
  oprSessionId,
  filters,
  enabled = true,
}: UseReservesOptions) {
  const queryClient = useQueryClient();

  // Query keys
  const keys = {
    all: ['reserves', chantierId] as const,
    list: ['reserves', chantierId, 'list', filters, oprSessionId] as const,
    stats: ['reserves', chantierId, 'stats'] as const,
    detail: (id: string) => ['reserves', chantierId, 'detail', id] as const,
  };

  // Liste des réserves
  const reservesQuery = useQuery({
    queryKey: keys.list,
    queryFn: async () => {
      let query = supabase
        .from('reserves')
        .select('*')
        .eq('chantier_id', chantierId)
        .order('numero', { ascending: true });

      if (oprSessionId) {
        query = query.eq('opr_session_id', oprSessionId);
      }

      if (filters?.statut) {
        query = query.eq('statut', filters.statut);
      }

      if (filters?.gravite) {
        query = query.eq('gravite', filters.gravite);
      }

      if (filters?.lot) {
        query = query.eq('lot', filters.lot);
      }

      if (filters?.entrepriseId) {
        query = query.eq('entreprise_id', filters.entrepriseId);
      }

      const { data, error } = await query;

      if (error) throw error;
      return data as Reserve[];
    },
    enabled: enabled && !!chantierId,
    staleTime: 2 * 60 * 1000,
  });

  // Statistiques des réserves
  const statsQuery = useQuery({
    queryKey: keys.stats,
    queryFn: async (): Promise<ReserveStats> => {
      const { data, error } = await supabase
        .from('reserves')
        .select('statut, gravite, date_echeance')
        .eq('chantier_id', chantierId);

      if (error) throw error;

      const today = new Date();
      const reserves = data || [];

      return {
        total: reserves.length,
        ouvertes: reserves.filter(r => r.statut === 'ouverte').length,
        enCours: reserves.filter(r => r.statut === 'en_cours').length,
        levees: reserves.filter(r => r.statut === 'levee').length,
        contestees: reserves.filter(r => r.statut === 'contestee').length,
        expirees: reserves.filter(r => r.statut === 'expiree').length,
        mineures: reserves.filter(r => r.gravite === 'mineure').length,
        majeures: reserves.filter(r => r.gravite === 'majeure').length,
        graves: reserves.filter(r => r.gravite === 'grave').length,
        bloquantes: reserves.filter(r => r.gravite === 'non_conformite_substantielle').length,
        enRetard: reserves.filter(r =>
          r.statut !== 'levee' &&
          r.date_echeance &&
          new Date(r.date_echeance) < today
        ).length,
      };
    },
    enabled: enabled && !!chantierId,
    staleTime: 5 * 60 * 1000,
  });

  // Mutation: Créer une réserve
  const createReserve = useMutation({
    mutationFn: async (data: {
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
      oprSessionId?: string;
    }) => {
      // Obtenir le prochain numéro
      const { data: lastReserve } = await supabase
        .from('reserves')
        .select('numero')
        .eq('chantier_id', chantierId)
        .order('numero', { ascending: false })
        .limit(1)
        .single();

      const numero = (lastReserve?.numero || 0) + 1;

      // Calculer le délai selon la gravité
      const delaiJours = getDelaiLevee(data.gravite);
      const dateEcheance = new Date();
      dateEcheance.setDate(dateEcheance.getDate() + delaiJours);

      const { data: reserve, error } = await supabase
        .from('reserves')
        .insert({
          chantier_id: chantierId,
          opr_session_id: data.oprSessionId,
          numero,
          lot: data.lot,
          piece: data.piece,
          localisation: data.localisation,
          nature: data.nature,
          description: data.description,
          gravite: data.gravite,
          statut: 'ouverte',
          entreprise_id: data.entrepriseId,
          entreprise_nom: data.entrepriseNom,
          photos: (data.photos || []).map((url, i) => ({
            id: `photo-${i}`,
            url,
            dateCapture: new Date().toISOString(),
            type: 'avant',
          })),
          delai_levee_jours: delaiJours,
          date_echeance: dateEcheance.toISOString().split('T')[0],
          cout_estime: data.coutEstime,
        })
        .select()
        .single();

      if (error) throw error;
      return reserve;
    },
    onSuccess: () => {
      toast.success('Réserve créée avec succès');
      queryClient.invalidateQueries({ queryKey: keys.all });
    },
    onError: (error: Error) => {
      toast.error(`Erreur: ${error.message}`);
    },
  });

  // Mutation: Mettre à jour le statut
  const updateStatus = useMutation({
    mutationFn: async ({
      reserveId,
      statut,
      commentaire,
    }: {
      reserveId: string;
      statut: ReserveStatut;
      commentaire?: string;
    }) => {
      const updateData: Record<string, unknown> = { statut };

      if (statut === 'levee') {
        updateData.date_levee = new Date().toISOString().split('T')[0];
      }

      if (commentaire) {
        updateData.commentaire_levee = commentaire;
      }

      const { error } = await supabase
        .from('reserves')
        .update(updateData)
        .eq('id', reserveId);

      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Statut mis à jour');
      queryClient.invalidateQueries({ queryKey: keys.all });
    },
    onError: (error: Error) => {
      toast.error(`Erreur: ${error.message}`);
    },
  });

  // Mutation: Marquer comme levée
  const markResolved = useMutation({
    mutationFn: async ({
      reserveId,
      commentaire,
      photosApres,
    }: {
      reserveId: string;
      commentaire?: string;
      photosApres?: string[];
    }) => {
      const { error } = await supabase
        .from('reserves')
        .update({
          statut: 'levee',
          date_levee: new Date().toISOString().split('T')[0],
          commentaire_levee: commentaire,
          photos_apres: photosApres?.map((url, i) => ({
            id: `after-${i}`,
            url,
            dateCapture: new Date().toISOString(),
            type: 'apres',
          })),
        })
        .eq('id', reserveId);

      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Réserve levée');
      queryClient.invalidateQueries({ queryKey: keys.all });
    },
    onError: (error: Error) => {
      toast.error(`Erreur: ${error.message}`);
    },
  });

  // Mutation: Contester une réserve
  const contestReserve = useMutation({
    mutationFn: async ({
      reserveId,
      motif,
    }: {
      reserveId: string;
      motif: string;
    }) => {
      const { error } = await supabase
        .from('reserves')
        .update({
          statut: 'contestee',
          contestee: true,
          motif_contestation: motif,
          date_contestation: new Date().toISOString().split('T')[0],
        })
        .eq('id', reserveId);

      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Contestation enregistrée');
      queryClient.invalidateQueries({ queryKey: keys.all });
    },
    onError: (error: Error) => {
      toast.error(`Erreur: ${error.message}`);
    },
  });

  // Mutation: Relancer l'entreprise
  const relanceEntreprise = useMutation({
    mutationFn: async (reserveId: string) => {
      const { data: reserve } = await supabase
        .from('reserves')
        .select('*')
        .eq('id', reserveId)
        .single();

      if (!reserve) throw new Error('Réserve non trouvée');

      // Incrémenter le compteur de relances
      const { error } = await supabase
        .from('reserves')
        .update({
          nombre_relances: (reserve.nombre_relances || 0) + 1,
          derniere_relance_at: new Date().toISOString(),
        })
        .eq('id', reserveId);

      if (error) throw error;

      // TODO: Envoyer l'email de relance via le service email
      // await emailService.sendTemplatedEmail(reserve.entreprise_contact?.email, 'reserve_relance', { ... });

      return reserve;
    },
    onSuccess: () => {
      toast.success('Relance envoyée');
      queryClient.invalidateQueries({ queryKey: keys.all });
    },
    onError: (error: Error) => {
      toast.error(`Erreur: ${error.message}`);
    },
  });

  // Mutation: Ajouter des photos
  const addPhotos = useMutation({
    mutationFn: async ({
      reserveId,
      photos,
      type,
    }: {
      reserveId: string;
      photos: string[];
      type: 'avant' | 'apres' | 'detail';
    }) => {
      const { data: reserve } = await supabase
        .from('reserves')
        .select('photos, photos_apres')
        .eq('id', reserveId)
        .single();

      if (!reserve) throw new Error('Réserve non trouvée');

      const newPhotos = photos.map((url, i) => ({
        id: `${type}-${Date.now()}-${i}`,
        url,
        dateCapture: new Date().toISOString(),
        type,
      }));

      const field = type === 'apres' ? 'photos_apres' : 'photos';
      const existingPhotos = (type === 'apres' ? reserve.photos_apres : reserve.photos) || [];

      const { error } = await supabase
        .from('reserves')
        .update({
          [field]: [...existingPhotos, ...newPhotos],
        })
        .eq('id', reserveId);

      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Photos ajoutées');
      queryClient.invalidateQueries({ queryKey: keys.all });
    },
  });

  // Réserves en retard
  const reservesEnRetard = (reservesQuery.data || []).filter(r => {
    if (r.statut === 'levee') return false;
    if (!r.date_echeance) return false;
    return new Date(r.date_echeance) < new Date();
  });

  return {
    // Queries
    reserves: reservesQuery.data || [],
    stats: statsQuery.data || {
      total: 0,
      ouvertes: 0,
      enCours: 0,
      levees: 0,
      contestees: 0,
      expirees: 0,
      mineures: 0,
      majeures: 0,
      graves: 0,
      bloquantes: 0,
      enRetard: 0,
    },
    reservesEnRetard,
    isLoading: reservesQuery.isLoading,
    isLoadingStats: statsQuery.isLoading,
    error: reservesQuery.error,

    // Mutations
    createReserve: createReserve.mutate,
    updateStatus: updateStatus.mutate,
    markResolved: markResolved.mutate,
    contestReserve: contestReserve.mutate,
    relanceEntreprise: relanceEntreprise.mutate,
    addPhotos: addPhotos.mutate,

    // Mutation states
    isCreating: createReserve.isPending,
    isUpdating: updateStatus.isPending,
    isResolving: markResolved.isPending,
    isRelancing: relanceEntreprise.isPending,

    // Refetch
    refetch: () => {
      queryClient.invalidateQueries({ queryKey: keys.all });
    },
  };
}

/**
 * Hook pour une réserve spécifique
 */
export function useReserve(reserveId: string) {
  const queryClient = useQueryClient();

  const reserveQuery = useQuery({
    queryKey: ['reserve', reserveId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('reserves')
        .select('*')
        .eq('id', reserveId)
        .single();

      if (error) throw error;
      return data as Reserve;
    },
    enabled: !!reserveId,
  });

  return {
    reserve: reserveQuery.data,
    isLoading: reserveQuery.isLoading,
    error: reserveQuery.error,
    refetch: () => {
      queryClient.invalidateQueries({ queryKey: ['reserve', reserveId] });
    },
  };
}

// Helper: Calculer le délai de levée selon la gravité
function getDelaiLevee(gravite: ReserveGravite): number {
  switch (gravite) {
    case 'mineure':
      return 30;
    case 'majeure':
      return 60;
    case 'grave':
      return 90;
    case 'non_conformite_substantielle':
      return 0; // Bloquant
    default:
      return 30;
  }
}
