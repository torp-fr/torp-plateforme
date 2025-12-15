/**
 * useReception - Hook React pour la gestion des réceptions Phase 4
 * Création et signature des PV de réception
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import type { Reception, ReceptionDecision, ReceptionSignataire } from '@/types/phase4.types';

interface UseReceptionOptions {
  chantierId: string;
  enabled?: boolean;
}

export function useReception({ chantierId, enabled = true }: UseReceptionOptions) {
  const queryClient = useQueryClient();

  // Query keys
  const keys = {
    all: ['reception', chantierId] as const,
    current: ['reception', chantierId, 'current'] as const,
    list: ['reception', chantierId, 'list'] as const,
    garanties: ['reception', chantierId, 'garanties'] as const,
  };

  // Réception en cours ou dernière
  const receptionQuery = useQuery({
    queryKey: keys.current,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('receptions')
        .select('*')
        .eq('chantier_id', chantierId)
        .order('date_reception', { ascending: false })
        .limit(1)
        .single();

      if (error && error.code !== 'PGRST116') throw error; // PGRST116 = no rows
      return data as Reception | null;
    },
    enabled: enabled && !!chantierId,
  });

  // Liste de toutes les réceptions
  const receptionsQuery = useQuery({
    queryKey: keys.list,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('receptions')
        .select('*')
        .eq('chantier_id', chantierId)
        .order('date_reception', { ascending: false });

      if (error) throw error;
      return data as Reception[];
    },
    enabled: enabled && !!chantierId,
  });

  // Mutation: Créer une réception
  const createReception = useMutation({
    mutationFn: async (data: {
      oprSessionId: string;
      dateReception: string;
      lieu: string;
      decision: ReceptionDecision;
      motifRefus?: string;
      dateNouvelleOPR?: string;
      reserveIds?: string[];
      delaiLeveeReservesJours?: number;
      soldeDu?: number;
      retenueGarantie?: number;
      retenueGarantieTaux?: number;
      montantReservesRetenu?: number;
    }) => {
      // Calculer les dates de garanties
      const dateReception = new Date(data.dateReception);
      const dateDebut = data.dateReception;

      const dateFinPA = new Date(dateReception);
      dateFinPA.setFullYear(dateFinPA.getFullYear() + 1);

      const dateFinBiennale = new Date(dateReception);
      dateFinBiennale.setFullYear(dateFinBiennale.getFullYear() + 2);

      const dateFinDecennale = new Date(dateReception);
      dateFinDecennale.setFullYear(dateFinDecennale.getFullYear() + 10);

      const dateLimiteLevee = new Date(dateReception);
      dateLimiteLevee.setDate(dateLimiteLevee.getDate() + (data.delaiLeveeReservesJours || 90));

      const { data: reception, error } = await supabase
        .from('receptions')
        .insert({
          chantier_id: chantierId,
          opr_session_id: data.oprSessionId,
          date_reception: data.dateReception,
          lieu: data.lieu,
          decision: data.decision,
          motif_refus: data.motifRefus,
          date_nouvelle_opr: data.dateNouvelleOPR,
          reserve_ids: data.reserveIds || [],
          nombre_reserves: data.reserveIds?.length || 0,
          delai_levee_reserves_jours: data.delaiLeveeReservesJours || 90,
          date_limite_levee: dateLimiteLevee.toISOString().split('T')[0],
          solde_du: data.soldeDu,
          retenue_garantie: data.retenueGarantie,
          retenue_garantie_taux: data.retenueGarantieTaux || 5,
          montant_reserves_retenu: data.montantReservesRetenu,
          // Dates de garanties (activées si acceptée)
          date_debut_garanties: data.decision.includes('acceptee') ? dateDebut : null,
          date_fin_parfait_achevement: data.decision.includes('acceptee')
            ? dateFinPA.toISOString().split('T')[0]
            : null,
          date_fin_biennale: data.decision.includes('acceptee')
            ? dateFinBiennale.toISOString().split('T')[0]
            : null,
          date_fin_decennale: data.decision.includes('acceptee')
            ? dateFinDecennale.toISOString().split('T')[0]
            : null,
          demarrage_garanties: data.decision.includes('acceptee'),
          date_demarrage_garanties: data.decision.includes('acceptee') ? dateDebut : null,
          transfert_garde: data.decision.includes('acceptee'),
          date_transfert_garde: data.decision.includes('acceptee') ? dateDebut : null,
        })
        .select()
        .single();

      if (error) throw error;

      // Si acceptée, créer les garanties
      if (data.decision.includes('acceptee')) {
        await createGaranties(reception.id, dateReception);
      }

      return reception;
    },
    onSuccess: (reception) => {
      toast.success('Réception créée avec succès');
      queryClient.invalidateQueries({ queryKey: keys.all });
      return reception;
    },
    onError: (error: Error) => {
      toast.error(`Erreur: ${error.message}`);
    },
  });

  // Fonction helper pour créer les garanties
  async function createGaranties(receptionId: string, dateReception: Date) {
    const garanties = [
      {
        type: 'parfait_achevement',
        duree_annees: 1,
        date_fin: new Date(dateReception.getFullYear() + 1, dateReception.getMonth(), dateReception.getDate()),
      },
      {
        type: 'biennale',
        duree_annees: 2,
        date_fin: new Date(dateReception.getFullYear() + 2, dateReception.getMonth(), dateReception.getDate()),
      },
      {
        type: 'decennale',
        duree_annees: 10,
        date_fin: new Date(dateReception.getFullYear() + 10, dateReception.getMonth(), dateReception.getDate()),
      },
    ];

    for (const garantie of garanties) {
      await supabase.from('garanties').insert({
        chantier_id: chantierId,
        reception_id: receptionId,
        type: garantie.type,
        duree_annees: garantie.duree_annees,
        date_debut: dateReception.toISOString().split('T')[0],
        date_fin: garantie.date_fin.toISOString().split('T')[0],
        active: true,
        expiree: false,
      });
    }
  }

  // Mutation: Générer le PV
  const generatePV = useMutation({
    mutationFn: async (receptionId: string) => {
      // TODO: Intégrer avec l'agent IA pour générer le PV
      // Pour l'instant, marquer comme généré
      const { error } = await supabase
        .from('receptions')
        .update({
          pv_genere: true,
          // pv_document_path: generatedPVPath,
        })
        .eq('id', receptionId);

      if (error) throw error;

      return { success: true };
    },
    onSuccess: () => {
      toast.success('PV généré');
      queryClient.invalidateQueries({ queryKey: keys.all });
    },
    onError: (error: Error) => {
      toast.error(`Erreur: ${error.message}`);
    },
  });

  // Mutation: Signer le PV
  const signPV = useMutation({
    mutationFn: async ({
      receptionId,
      signataire,
    }: {
      receptionId: string;
      signataire: {
        participantId: string;
        role: string;
        nom: string;
        entreprise?: string;
        signature: string;
        mentionManuscrite?: string;
      };
    }) => {
      const { data: reception } = await supabase
        .from('receptions')
        .select('signataires')
        .eq('id', receptionId)
        .single();

      if (!reception) throw new Error('Réception non trouvée');

      const existingSignataires = (reception.signataires as ReceptionSignataire[]) || [];

      const newSignataire: ReceptionSignataire = {
        id: `sig-${Date.now()}`,
        participantId: signataire.participantId,
        role: signataire.role as ReceptionSignataire['role'],
        nom: signataire.nom,
        entreprise: signataire.entreprise,
        signature: signataire.signature,
        dateSignature: new Date().toISOString(),
        mentionManuscrite: signataire.mentionManuscrite,
      };

      const { error } = await supabase
        .from('receptions')
        .update({
          signataires: [...existingSignataires, newSignataire],
          pv_signe: true, // Peut être ajusté pour vérifier si tous ont signé
        })
        .eq('id', receptionId);

      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Signature enregistrée');
      queryClient.invalidateQueries({ queryKey: keys.all });
    },
    onError: (error: Error) => {
      toast.error(`Erreur: ${error.message}`);
    },
  });

  // Mutation: Libérer la retenue de garantie
  const libererRetenue = useMutation({
    mutationFn: async (receptionId: string) => {
      const { data: reception } = await supabase
        .from('receptions')
        .select('*')
        .eq('id', receptionId)
        .single();

      if (!reception) throw new Error('Réception non trouvée');

      // Vérifier que toutes les réserves sont levées
      if (reception.nombre_reserves > reception.nombre_reserves_levees) {
        throw new Error('Toutes les réserves doivent être levées avant de libérer la retenue');
      }

      const { error } = await supabase
        .from('receptions')
        .update({
          retenue_liberee: true,
          retenue_liberee_at: new Date().toISOString(),
        })
        .eq('id', receptionId);

      if (error) throw error;

      // Mettre à jour la table retenues_garantie si elle existe
      await supabase
        .from('retenues_garantie')
        .update({
          liberee: true,
          liberee_at: new Date().toISOString(),
          statut: 'liberee',
          montant_libere: reception.retenue_garantie,
          date_liberation_effective: new Date().toISOString().split('T')[0],
        })
        .eq('reception_id', receptionId);
    },
    onSuccess: () => {
      toast.success('Retenue de garantie libérée');
      queryClient.invalidateQueries({ queryKey: keys.all });
    },
    onError: (error: Error) => {
      toast.error(`Erreur: ${error.message}`);
    },
  });

  // Mutation: Mettre à jour le nombre de réserves levées
  const updateReservesLevees = useMutation({
    mutationFn: async ({
      receptionId,
      nombreLevees,
    }: {
      receptionId: string;
      nombreLevees: number;
    }) => {
      const { error } = await supabase
        .from('receptions')
        .update({
          nombre_reserves_levees: nombreLevees,
        })
        .eq('id', receptionId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: keys.all });
    },
  });

  // Calculer si la retenue peut être libérée
  const canReleaseRetenue = () => {
    const reception = receptionQuery.data;
    if (!reception) return false;

    // Vérifier que toutes les réserves sont levées
    if (reception.nombre_reserves > reception.nombre_reserves_levees) {
      return false;
    }

    // Vérifier que le délai est passé (généralement 1 an après réception)
    if (reception.date_debut_garanties) {
      const dateDebut = new Date(reception.date_debut_garanties);
      const dateLimite = new Date(dateDebut);
      dateLimite.setFullYear(dateLimite.getFullYear() + 1);

      if (new Date() < dateLimite) {
        return false;
      }
    }

    return !reception.retenue_liberee;
  };

  return {
    // Queries
    reception: receptionQuery.data,
    receptions: receptionsQuery.data || [],
    isLoading: receptionQuery.isLoading,
    isLoadingList: receptionsQuery.isLoading,
    error: receptionQuery.error,

    // État dérivé
    hasReception: !!receptionQuery.data,
    isAccepted: receptionQuery.data?.decision?.includes('acceptee'),
    canReleaseRetenue: canReleaseRetenue(),

    // Mutations
    createReception: createReception.mutate,
    generatePV: generatePV.mutate,
    signPV: signPV.mutate,
    libererRetenue: libererRetenue.mutate,
    updateReservesLevees: updateReservesLevees.mutate,

    // Mutation states
    isCreating: createReception.isPending,
    isGeneratingPV: generatePV.isPending,
    isSigning: signPV.isPending,
    isReleasingRetenue: libererRetenue.isPending,

    // Refetch
    refetch: () => {
      queryClient.invalidateQueries({ queryKey: keys.all });
    },
  };
}

/**
 * Hook pour une réception spécifique
 */
export function useReceptionById(receptionId: string) {
  const queryClient = useQueryClient();

  const receptionQuery = useQuery({
    queryKey: ['reception', 'detail', receptionId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('receptions')
        .select('*')
        .eq('id', receptionId)
        .single();

      if (error) throw error;
      return data as Reception;
    },
    enabled: !!receptionId,
  });

  return {
    reception: receptionQuery.data,
    isLoading: receptionQuery.isLoading,
    error: receptionQuery.error,
    refetch: () => {
      queryClient.invalidateQueries({ queryKey: ['reception', 'detail', receptionId] });
    },
  };
}
