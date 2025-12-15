/**
 * useDOE - Hook React pour la gestion des DOE/DIUO Phase 4
 * Dossier des Ouvrages Exécutés et Dossier d'Intervention Ultérieure
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import type { DOE, DocumentDOE, DocumentDOEType, DIUO, CarnetSante, EntretienProgramme } from '@/types/phase4.types';

interface UseDOEOptions {
  chantierId: string;
  enabled?: boolean;
}

// Documents obligatoires par défaut pour un DOE
const DOCUMENTS_OBLIGATOIRES: { type: DocumentDOEType; nom: string; categorie: string }[] = [
  { type: 'plan_execution', nom: 'Plans d\'exécution conformes', categorie: 'Plans' },
  { type: 'notice_technique', nom: 'Notices techniques équipements', categorie: 'Notices' },
  { type: 'certificat', nom: 'Attestation CONSUEL', categorie: 'Certificats' },
  { type: 'certificat', nom: 'Certificat QUALIGAZ', categorie: 'Certificats' },
  { type: 'certificat', nom: 'Attestation RE2020/RT2012', categorie: 'Certificats' },
  { type: 'pv_controle', nom: 'PV de contrôle bureau de contrôle', categorie: 'PV' },
  { type: 'garantie', nom: 'Attestations de garantie constructeur', categorie: 'Garanties' },
  { type: 'fiche_materiau', nom: 'Fiches techniques matériaux', categorie: 'Fiches techniques' },
];

export function useDOE({ chantierId, enabled = true }: UseDOEOptions) {
  const queryClient = useQueryClient();

  // Query keys
  const keys = {
    all: ['doe', chantierId] as const,
    doe: ['doe', chantierId, 'main'] as const,
    diuo: ['doe', chantierId, 'diuo'] as const,
    carnet: ['doe', chantierId, 'carnet'] as const,
    entretiens: ['doe', chantierId, 'entretiens'] as const,
  };

  // DOE du projet
  const doeQuery = useQuery({
    queryKey: keys.doe,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('doe')
        .select('*')
        .eq('chantier_id', chantierId)
        .single();

      if (error && error.code !== 'PGRST116') throw error;

      // Si pas de DOE, le créer
      if (!data) {
        const { data: newDoe, error: createError } = await supabase
          .from('doe')
          .insert({
            chantier_id: chantierId,
            statut: 'en_constitution',
            documents: [],
            documents_manquants: DOCUMENTS_OBLIGATOIRES.map(d => d.nom),
            pourcentage_complet: 0,
          })
          .select()
          .single();

        if (createError) throw createError;
        return newDoe as DOE;
      }

      return data as DOE;
    },
    enabled: enabled && !!chantierId,
  });

  // DIUO du projet
  const diuoQuery = useQuery({
    queryKey: keys.diuo,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('diuo')
        .select('*')
        .eq('chantier_id', chantierId)
        .single();

      if (error && error.code !== 'PGRST116') throw error;
      return data as DIUO | null;
    },
    enabled: enabled && !!chantierId,
  });

  // Carnet de santé
  const carnetQuery = useQuery({
    queryKey: keys.carnet,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('carnets_sante')
        .select('*')
        .eq('chantier_id', chantierId)
        .single();

      if (error && error.code !== 'PGRST116') throw error;
      return data as CarnetSante | null;
    },
    enabled: enabled && !!chantierId,
  });

  // Entretiens à venir
  const entretiensQuery = useQuery({
    queryKey: keys.entretiens,
    queryFn: async (): Promise<EntretienProgramme[]> => {
      const carnet = carnetQuery.data;
      if (!carnet?.entretiens_programmes) return [];

      const entretiens = carnet.entretiens_programmes as EntretienProgramme[];
      const today = new Date();

      // Filtrer les entretiens à venir dans les 30 jours
      return entretiens.filter(e => {
        if (!e.prochaineEcheance) return false;
        const echeance = new Date(e.prochaineEcheance);
        const daysUntil = Math.ceil((echeance.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
        return daysUntil <= 30 && daysUntil >= 0;
      });
    },
    enabled: enabled && !!carnetQuery.data,
  });

  // Mutation: Ajouter un document au DOE
  const addDocument = useMutation({
    mutationFn: async ({
      doeId,
      document,
    }: {
      doeId: string;
      document: {
        type: DocumentDOEType;
        categorie: string;
        lot?: string;
        nom: string;
        description?: string;
        reference?: string;
        fichierUrl: string;
        format: string;
        tailleMo: number;
        obligatoire: boolean;
        dateDocument?: string;
        dateExpiration?: string;
      };
    }) => {
      const { data: doe } = await supabase
        .from('doe')
        .select('documents, documents_manquants')
        .eq('id', doeId)
        .single();

      if (!doe) throw new Error('DOE non trouvé');

      const existingDocs = (doe.documents as DocumentDOE[]) || [];
      const docManquants = (doe.documents_manquants as string[]) || [];

      const newDoc: DocumentDOE = {
        id: `doc-${Date.now()}`,
        doeId,
        ...document,
        valide: false,
        uploadedAt: new Date().toISOString(),
        uploadedBy: '', // TODO: Get current user
      };

      // Retirer des documents manquants si c'est un document obligatoire
      const updatedManquants = docManquants.filter(
        d => d.toLowerCase() !== document.nom.toLowerCase()
      );

      // Calculer la nouvelle progression
      const totalObligatoires = DOCUMENTS_OBLIGATOIRES.length;
      const fournis = totalObligatoires - updatedManquants.length;
      const progression = Math.round((fournis / totalObligatoires) * 100);

      const { error } = await supabase
        .from('doe')
        .update({
          documents: [...existingDocs, newDoc],
          documents_manquants: updatedManquants,
          pourcentage_complet: progression,
          statut: progression >= 100 ? 'complet' : 'en_constitution',
        })
        .eq('id', doeId);

      if (error) throw error;
      return newDoc;
    },
    onSuccess: () => {
      toast.success('Document ajouté au DOE');
      queryClient.invalidateQueries({ queryKey: keys.all });
    },
    onError: (error: Error) => {
      toast.error(`Erreur: ${error.message}`);
    },
  });

  // Mutation: Valider un document
  const validateDocument = useMutation({
    mutationFn: async ({
      doeId,
      documentId,
    }: {
      doeId: string;
      documentId: string;
    }) => {
      const { data: doe } = await supabase
        .from('doe')
        .select('documents')
        .eq('id', doeId)
        .single();

      if (!doe) throw new Error('DOE non trouvé');

      const documents = (doe.documents as DocumentDOE[]) || [];
      const docIndex = documents.findIndex(d => d.id === documentId);

      if (docIndex === -1) throw new Error('Document non trouvé');

      documents[docIndex] = {
        ...documents[docIndex],
        valide: true,
        dateValidation: new Date().toISOString(),
        // validePar: currentUserId,
      };

      const { error } = await supabase
        .from('doe')
        .update({ documents })
        .eq('id', doeId);

      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Document validé');
      queryClient.invalidateQueries({ queryKey: keys.all });
    },
  });

  // Mutation: Remettre le DOE
  const remettreDOE = useMutation({
    mutationFn: async ({
      doeId,
      destinataire,
      formatRemise,
    }: {
      doeId: string;
      destinataire: { nom: string; email: string };
      formatRemise: 'numerique' | 'papier' | 'mixte';
    }) => {
      const { data: doe } = await supabase
        .from('doe')
        .select('pourcentage_complet, documents')
        .eq('id', doeId)
        .single();

      if (!doe) throw new Error('DOE non trouvé');

      // Vérifier que le DOE est complet
      if (doe.pourcentage_complet < 100) {
        throw new Error('Le DOE doit être complet avant remise');
      }

      // Vérifier que tous les documents sont validés
      const docs = (doe.documents as DocumentDOE[]) || [];
      const nonValides = docs.filter(d => d.obligatoire && !d.valide);
      if (nonValides.length > 0) {
        throw new Error(`${nonValides.length} document(s) obligatoire(s) non validé(s)`);
      }

      const { error } = await supabase
        .from('doe')
        .update({
          statut: 'remis',
          date_remise: new Date().toISOString(),
          remis_a: destinataire,
          format_remise: formatRemise,
        })
        .eq('id', doeId);

      if (error) throw error;

      // TODO: Envoyer email de notification
      // await emailService.sendTemplatedEmail(destinataire.email, 'doe_remis', { ... });
    },
    onSuccess: () => {
      toast.success('DOE remis avec succès');
      queryClient.invalidateQueries({ queryKey: keys.all });
    },
    onError: (error: Error) => {
      toast.error(`Erreur: ${error.message}`);
    },
  });

  // Mutation: Créer/Mettre à jour le DIUO
  const updateDIUO = useMutation({
    mutationFn: async (data: {
      descriptif?: DIUO['descriptif'];
      zonesRisques?: DIUO['zones'];
      mesuresGenerales?: string[];
      epiRecommandes?: string[];
    }) => {
      const existing = diuoQuery.data;

      if (existing) {
        const { error } = await supabase
          .from('diuo')
          .update({
            descriptif: data.descriptif || existing.descriptif,
            zones_risques: data.zonesRisques || existing.zones,
            mesures_generales: data.mesuresGenerales || existing.mesuresGenerales,
            epi_recommandes: data.epiRecommandes || existing.epiRecommandes,
          })
          .eq('id', existing.id);

        if (error) throw error;
      } else {
        const { error } = await supabase.from('diuo').insert({
          chantier_id: chantierId,
          statut: 'en_constitution',
          descriptif: data.descriptif,
          zones_risques: data.zonesRisques || [],
          mesures_generales: data.mesuresGenerales || [],
          epi_recommandes: data.epiRecommandes || [],
        });

        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success('DIUO mis à jour');
      queryClient.invalidateQueries({ queryKey: keys.all });
    },
  });

  // Mutation: Créer le carnet de santé
  const createCarnetSante = useMutation({
    mutationFn: async (data: {
      adresse: string;
      surface: number;
      anneeConstruction?: number;
      equipements?: CarnetSante['equipements'];
      contacts?: CarnetSante['contacts'];
    }) => {
      const existing = carnetQuery.data;

      if (existing) {
        const { error } = await supabase
          .from('carnets_sante')
          .update({
            adresse: data.adresse,
            surface: data.surface,
            annee_construction: data.anneeConstruction,
            equipements: data.equipements || existing.equipements,
            contacts: data.contacts || existing.contacts,
          })
          .eq('id', existing.id);

        if (error) throw error;
      } else {
        const { error } = await supabase.from('carnets_sante').insert({
          chantier_id: chantierId,
          doe_id: doeQuery.data?.id,
          adresse: data.adresse,
          surface: data.surface,
          annee_construction: data.anneeConstruction,
          equipements: data.equipements || [],
          contacts: data.contacts || [],
          entretiens_programmes: [],
          entretiens_realises: [],
        });

        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success('Carnet de santé créé');
      queryClient.invalidateQueries({ queryKey: keys.all });
    },
  });

  // Mutation: Programmer un entretien
  const programmerEntretien = useMutation({
    mutationFn: async (entretien: {
      equipement: string;
      nature: string;
      periodicite: string;
      periodiciteMois: number;
      prestataire?: string;
      coutEstime?: number;
      obligatoire?: boolean;
    }) => {
      const carnet = carnetQuery.data;
      if (!carnet) throw new Error('Carnet de santé non trouvé');

      const entretiens = (carnet.entretiens_programmes as EntretienProgramme[]) || [];

      const prochaineEcheance = new Date();
      prochaineEcheance.setMonth(prochaineEcheance.getMonth() + entretien.periodiciteMois);

      const newEntretien: EntretienProgramme = {
        id: `ent-${Date.now()}`,
        equipement: entretien.equipement,
        nature: entretien.nature,
        periodicite: entretien.periodicite,
        periodiciteMois: entretien.periodiciteMois,
        prochaineEcheance: prochaineEcheance.toISOString().split('T')[0],
        prestataire: entretien.prestataire,
        coutEstime: entretien.coutEstime,
        obligatoire: entretien.obligatoire ?? false,
        rappelEnvoye: false,
      };

      const { error } = await supabase
        .from('carnets_sante')
        .update({
          entretiens_programmes: [...entretiens, newEntretien],
        })
        .eq('id', carnet.id);

      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Entretien programmé');
      queryClient.invalidateQueries({ queryKey: keys.all });
    },
  });

  // Mutation: Enregistrer un entretien réalisé
  const enregistrerEntretien = useMutation({
    mutationFn: async (entretien: {
      entretienProgrammeId?: string;
      equipement: string;
      nature: string;
      prestataire: string;
      cout?: number;
      observations?: string;
      factureUrl?: string;
    }) => {
      const carnet = carnetQuery.data;
      if (!carnet) throw new Error('Carnet de santé non trouvé');

      const realises = (carnet.entretiens_realises as CarnetSante['entretiensRealises']) || [];

      const newRealise = {
        id: `real-${Date.now()}`,
        entretienProgrammeId: entretien.entretienProgrammeId,
        equipement: entretien.equipement,
        date: new Date().toISOString().split('T')[0],
        nature: entretien.nature,
        prestataire: entretien.prestataire,
        cout: entretien.cout,
        observations: entretien.observations,
        factureUrl: entretien.factureUrl,
      };

      // Mettre à jour la date du prochain entretien programmé si lié
      let programmes = (carnet.entretiens_programmes as EntretienProgramme[]) || [];
      if (entretien.entretienProgrammeId) {
        programmes = programmes.map(p => {
          if (p.id === entretien.entretienProgrammeId) {
            const prochaine = new Date();
            prochaine.setMonth(prochaine.getMonth() + p.periodiciteMois);
            return {
              ...p,
              derniereRealisation: new Date().toISOString().split('T')[0],
              prochaineEcheance: prochaine.toISOString().split('T')[0],
              rappelEnvoye: false,
            };
          }
          return p;
        });
      }

      const { error } = await supabase
        .from('carnets_sante')
        .update({
          entretiens_realises: [...realises, newRealise],
          entretiens_programmes: programmes,
        })
        .eq('id', carnet.id);

      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Entretien enregistré');
      queryClient.invalidateQueries({ queryKey: keys.all });
    },
  });

  // Données dérivées
  const doe = doeQuery.data;
  const documentsManquants = (doe?.documents_manquants as string[]) || [];
  const progression = doe?.pourcentage_complet || 0;
  const isComplete = progression >= 100 && documentsManquants.length === 0;
  const entretiensAVenir = entretiensQuery.data || [];

  return {
    // Queries
    doe,
    diuo: diuoQuery.data,
    carnetSante: carnetQuery.data,
    entretiensAVenir,
    isLoading: doeQuery.isLoading,
    error: doeQuery.error,

    // Données dérivées
    progression,
    documentsManquants,
    isComplete,
    canRemit: isComplete && doe?.statut !== 'remis',

    // Mutations DOE
    addDocument: addDocument.mutate,
    validateDocument: validateDocument.mutate,
    remettreDOE: remettreDOE.mutate,

    // Mutations DIUO
    updateDIUO: updateDIUO.mutate,

    // Mutations Carnet
    createCarnetSante: createCarnetSante.mutate,
    programmerEntretien: programmerEntretien.mutate,
    enregistrerEntretien: enregistrerEntretien.mutate,

    // Mutation states
    isAddingDocument: addDocument.isPending,
    isRemitting: remettreDOE.isPending,

    // Refetch
    refetch: () => {
      queryClient.invalidateQueries({ queryKey: keys.all });
    },
  };
}
