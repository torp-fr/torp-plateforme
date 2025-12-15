/**
 * useWarrantyClaims - Hook React pour la gestion des garanties et sinistres Phase 4
 * Suivi des garanties et déclaration de désordres
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import type { Garantie, Desordre, GarantieType, DesordreStatut } from '@/types/phase4.types';

interface UseWarrantyClaimsOptions {
  chantierId: string;
  enabled?: boolean;
}

interface WarrantyAlert {
  type: 'expiration' | 'desordre';
  garantieType?: GarantieType;
  message: string;
  severity: 'warning' | 'danger' | 'info';
  daysRemaining?: number;
}

export function useWarrantyClaims({ chantierId, enabled = true }: UseWarrantyClaimsOptions) {
  const queryClient = useQueryClient();

  // Query keys
  const keys = {
    all: ['warranty', chantierId] as const,
    garanties: ['warranty', chantierId, 'garanties'] as const,
    desordres: ['warranty', chantierId, 'desordres'] as const,
    alertes: ['warranty', chantierId, 'alertes'] as const,
  };

  // Garanties du projet
  const garantiesQuery = useQuery({
    queryKey: keys.garanties,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('garanties')
        .select('*')
        .eq('chantier_id', chantierId)
        .order('type');

      if (error) throw error;
      return data as Garantie[];
    },
    enabled: enabled && !!chantierId,
  });

  // Désordres/sinistres déclarés
  const desordresQuery = useQuery({
    queryKey: keys.desordres,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('desordres')
        .select('*')
        .eq('chantier_id', chantierId)
        .order('date_decouverte', { ascending: false });

      if (error) throw error;
      return data as Desordre[];
    },
    enabled: enabled && !!chantierId,
  });

  // Alertes (garanties expirant bientôt, désordres non traités)
  const alertesQuery = useQuery({
    queryKey: keys.alertes,
    queryFn: async (): Promise<WarrantyAlert[]> => {
      const alerts: WarrantyAlert[] = [];
      const today = new Date();

      // Vérifier les garanties
      const garanties = garantiesQuery.data || [];
      for (const garantie of garanties) {
        if (garantie.expiree) continue;

        const dateFin = new Date(garantie.date_fin);
        const daysRemaining = Math.ceil((dateFin.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

        if (daysRemaining < 0) {
          // Expirée
          await supabase
            .from('garanties')
            .update({ expiree: true, active: false })
            .eq('id', garantie.id);
        } else if (daysRemaining <= 30) {
          alerts.push({
            type: 'expiration',
            garantieType: garantie.type,
            message: `Garantie ${formatGarantieType(garantie.type)} expire dans ${daysRemaining} jours`,
            severity: daysRemaining <= 7 ? 'danger' : 'warning',
            daysRemaining,
          });
        } else if (daysRemaining <= 90) {
          alerts.push({
            type: 'expiration',
            garantieType: garantie.type,
            message: `Garantie ${formatGarantieType(garantie.type)} expire dans ${daysRemaining} jours`,
            severity: 'info',
            daysRemaining,
          });
        }
      }

      // Vérifier les désordres non traités
      const desordres = desordresQuery.data || [];
      const desordresOuverts = desordres.filter(
        d => !['repare', 'prescrit'].includes(d.statut)
      );

      if (desordresOuverts.length > 0) {
        alerts.push({
          type: 'desordre',
          message: `${desordresOuverts.length} désordre(s) en attente de traitement`,
          severity: 'warning',
        });
      }

      return alerts;
    },
    enabled: enabled && !!chantierId && !!garantiesQuery.data && !!desordresQuery.data,
    staleTime: 10 * 60 * 1000,
  });

  // Mutation: Déclarer un désordre
  const createDesordre = useMutation({
    mutationFn: async (data: {
      nature: string;
      description: string;
      localisation: string;
      dateDecouverte: string;
      gravite: 'faible' | 'moyenne' | 'grave' | 'critique';
      typeDesordre?: string;
      photos?: string[];
      documents?: string[];
    }) => {
      // Obtenir le prochain numéro
      const { data: lastDesordre } = await supabase
        .from('desordres')
        .select('numero')
        .eq('chantier_id', chantierId)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      const lastNum = lastDesordre?.numero ? parseInt(lastDesordre.numero.split('-').pop() || '0') : 0;
      const numero = `DES-${new Date().getFullYear()}-${String(lastNum + 1).padStart(4, '0')}`;

      // Déterminer la garantie applicable
      const garantieApplicable = await determineGarantieApplicable(
        chantierId,
        data.typeDesordre || data.nature,
        new Date(data.dateDecouverte)
      );

      const { data: desordre, error } = await supabase
        .from('desordres')
        .insert({
          chantier_id: chantierId,
          numero,
          nature: data.nature,
          description: data.description,
          localisation: data.localisation,
          date_decouverte: data.dateDecouverte,
          date_signalement: new Date().toISOString().split('T')[0],
          gravite: data.gravite,
          type_desordre: data.typeDesordre,
          garantie_applicable: garantieApplicable,
          statut: 'signale',
          photos: data.photos?.map((url, i) => ({
            id: `photo-${i}`,
            url,
            dateCapture: new Date().toISOString(),
          })),
          documents: data.documents?.map((url, i) => ({
            id: `doc-${i}`,
            url,
            uploadedAt: new Date().toISOString(),
          })),
        })
        .select()
        .single();

      if (error) throw error;
      return desordre;
    },
    onSuccess: () => {
      toast.success('Désordre déclaré avec succès');
      queryClient.invalidateQueries({ queryKey: keys.all });
    },
    onError: (error: Error) => {
      toast.error(`Erreur: ${error.message}`);
    },
  });

  // Mutation: Mettre à jour le statut d'un désordre
  const updateDesordreStatus = useMutation({
    mutationFn: async ({
      desordreId,
      statut,
      data,
    }: {
      desordreId: string;
      statut: DesordreStatut;
      data?: {
        diagnosticResultat?: string;
        responsabiliteAcceptee?: boolean;
        motifContestation?: string;
        reparationPlanifiee?: string;
        reparationRealisee?: string;
        coutReparation?: number;
        reparationConforme?: boolean;
        travauxDescription?: string;
        travauxRealisePar?: string;
      };
    }) => {
      const updateData: Record<string, unknown> = { statut };

      if (statut === 'diagnostic' && data?.diagnosticResultat) {
        updateData.diagnostic_date = new Date().toISOString().split('T')[0];
        updateData.diagnostic_resultat = data.diagnosticResultat;
        updateData.responsabilite_acceptee = data.responsabiliteAcceptee;
        updateData.motif_contestation = data.motifContestation;
      }

      if (statut === 'en_reparation' && data?.reparationPlanifiee) {
        updateData.reparation_planifiee = data.reparationPlanifiee;
      }

      if (statut === 'repare') {
        updateData.reparation_realisee = data?.reparationRealisee || new Date().toISOString().split('T')[0];
        updateData.cout_reparation = data?.coutReparation;
        updateData.reparation_conforme = data?.reparationConforme ?? true;
        updateData.travaux_description = data?.travauxDescription;
        updateData.travaux_realises_par = data?.travauxRealisePar;
      }

      const { error } = await supabase
        .from('desordres')
        .update(updateData)
        .eq('id', desordreId);

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

  // Mutation: Demander une expertise
  const requestExpertise = useMutation({
    mutationFn: async ({
      desordreId,
      expertNom,
      expertContact,
    }: {
      desordreId: string;
      expertNom: string;
      expertContact?: { email?: string; telephone?: string };
    }) => {
      const { error } = await supabase
        .from('desordres')
        .update({
          expertise_requise: true,
          expert_nom: expertNom,
          expert_contact: expertContact,
          statut: 'diagnostic',
        })
        .eq('id', desordreId);

      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Demande d\'expertise enregistrée');
      queryClient.invalidateQueries({ queryKey: keys.all });
    },
  });

  // Mutation: Déclarer à l'assurance
  const declareToInsurance = useMutation({
    mutationFn: async ({
      desordreId,
      assureurReference,
    }: {
      desordreId: string;
      assureurReference?: string;
    }) => {
      const { error } = await supabase
        .from('desordres')
        .update({
          assureur_notifie: true,
          assureur_reference: assureurReference,
          declaration_assurance: {
            date: new Date().toISOString().split('T')[0],
            statut: 'en_cours',
          },
        })
        .eq('id', desordreId);

      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Déclaration à l\'assurance enregistrée');
      queryClient.invalidateQueries({ queryKey: keys.all });
    },
  });

  // Données dérivées
  const garanties = garantiesQuery.data || [];
  const desordres = desordresQuery.data || [];
  const alertes = alertesQuery.data || [];

  const garantiesActives = garanties.filter(g => g.active && !g.expiree);
  const desordresOuverts = desordres.filter(d => !['repare', 'prescrit'].includes(d.statut));
  const desordresEnCours = desordres.filter(d => ['diagnostic', 'en_reparation'].includes(d.statut));

  return {
    // Queries
    garanties,
    desordres,
    alertes,
    isLoading: garantiesQuery.isLoading || desordresQuery.isLoading,
    error: garantiesQuery.error || desordresQuery.error,

    // Données dérivées
    garantiesActives,
    desordresOuverts,
    desordresEnCours,
    hasActiveWarranty: garantiesActives.length > 0,

    // Mutations
    createDesordre: createDesordre.mutate,
    updateDesordreStatus: updateDesordreStatus.mutate,
    requestExpertise: requestExpertise.mutate,
    declareToInsurance: declareToInsurance.mutate,

    // Mutation states
    isCreating: createDesordre.isPending,
    isUpdating: updateDesordreStatus.isPending,

    // Refetch
    refetch: () => {
      queryClient.invalidateQueries({ queryKey: keys.all });
    },
  };
}

/**
 * Hook pour un désordre spécifique
 */
export function useDesordre(desordreId: string) {
  const queryClient = useQueryClient();

  const desordreQuery = useQuery({
    queryKey: ['desordre', desordreId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('desordres')
        .select('*')
        .eq('id', desordreId)
        .single();

      if (error) throw error;
      return data as Desordre;
    },
    enabled: !!desordreId,
  });

  return {
    desordre: desordreQuery.data,
    isLoading: desordreQuery.isLoading,
    error: desordreQuery.error,
    refetch: () => {
      queryClient.invalidateQueries({ queryKey: ['desordre', desordreId] });
    },
  };
}

// Helper: Déterminer la garantie applicable
async function determineGarantieApplicable(
  chantierId: string,
  typeDesordre: string,
  dateDecouverte: Date
): Promise<GarantieType | null> {
  // Récupérer la date de réception
  const { data: reception } = await supabase
    .from('receptions')
    .select('date_reception, date_fin_parfait_achevement, date_fin_biennale, date_fin_decennale')
    .eq('chantier_id', chantierId)
    .single();

  if (!reception) return null;

  // Mots-clés pour la garantie décennale (structure)
  const decennaleKeywords = ['fissure', 'infiltration', 'structure', 'fondation', 'toiture', 'etancheite', 'effondrement'];
  const isDecennale = decennaleKeywords.some(kw => typeDesordre.toLowerCase().includes(kw));

  // Mots-clés pour la garantie biennale (équipements)
  const biennaleKeywords = ['robinet', 'radiateur', 'volet', 'porte', 'fenetre', 'interrupteur', 'prise', 'chaudiere'];
  const isBiennale = biennaleKeywords.some(kw => typeDesordre.toLowerCase().includes(kw));

  // Vérifier les dates
  const finPA = reception.date_fin_parfait_achevement ? new Date(reception.date_fin_parfait_achevement) : null;
  const finBiennale = reception.date_fin_biennale ? new Date(reception.date_fin_biennale) : null;
  const finDecennale = reception.date_fin_decennale ? new Date(reception.date_fin_decennale) : null;

  // Parfait achèvement (1 an) - tous désordres
  if (finPA && dateDecouverte <= finPA) {
    return 'parfait_achevement';
  }

  // Biennale (2 ans) - équipements
  if (finBiennale && dateDecouverte <= finBiennale && isBiennale) {
    return 'biennale';
  }

  // Décennale (10 ans) - structure
  if (finDecennale && dateDecouverte <= finDecennale && isDecennale) {
    return 'decennale';
  }

  return null;
}

// Helper: Formater le type de garantie
function formatGarantieType(type: GarantieType): string {
  const labels: Record<GarantieType, string> = {
    parfait_achevement: 'Parfait achèvement',
    biennale: 'Biennale',
    decennale: 'Décennale',
    vices_caches: 'Vices cachés',
  };
  return labels[type] || type;
}
