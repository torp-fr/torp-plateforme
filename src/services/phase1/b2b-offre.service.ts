/**
 * B2B Offre Service
 * Service pour la gestion des offres B2B soumises par les entreprises
 * Sauvegarde vers Supabase phase1_offres
 */

import { supabase } from '@/lib/supabase';

// Types pour l'offre B2B
export interface B2BOffreMemoireTechnique {
  presentationEntreprise: string;
  moyensHumains: string;
  moyensMateriels: string;
  methodologie: string;
  referencesProjet: string;
  engagementsQualite: string;
}

export interface B2BOffreDPGFPoste {
  id: string;
  designation: string;
  unite: string;
  quantite: number;
  prixUnitaireHT: number;
}

export interface B2BOffrePlanning {
  dateDebutProposee: string;
  dureeJours: number;
  commentairePlanning: string;
}

export interface B2BOffreConditions {
  dureeValiditeOffre: number; // jours
  delaiPaiement: number; // jours
  acompte: number; // %
}

export interface B2BOffreData {
  projectId: string;
  consultationId?: string;
  memoireTechnique: B2BOffreMemoireTechnique;
  dpgf: {
    postes: B2BOffreDPGFPoste[];
    totalHT: number;
  };
  planning: B2BOffrePlanning;
  conditions: B2BOffreConditions;
  status: 'draft' | 'submitted' | 'accepted' | 'rejected';
  createdAt?: string;
  updatedAt?: string;
  submittedAt?: string;
}

export interface B2BOffreRecord {
  id: string;
  consultation_id: string;
  entreprise_id?: string;
  entreprise: {
    id: string;
    raison_sociale: string;
    siret: string;
    contact: {
      nom: string;
      email: string;
      telephone: string;
    };
  };
  statut: 'recue' | 'en_analyse' | 'conforme' | 'non_conforme' | 'retenue' | 'selectionnee' | 'rejetee' | 'retiree';
  date_reception: string;
  conformite: object;
  contenu: B2BOffreData;
  analyse_offre?: object;
  score_offre?: object;
  documents: object[];
  historique: object[];
  created_at: string;
  updated_at: string;
}

/**
 * Service de gestion des offres B2B
 */
export class B2BOffreService {
  /**
   * Sauvegarder une offre B2B (brouillon ou soumission)
   */
  static async saveOffer(
    userId: string,
    projectId: string,
    offerData: Omit<B2BOffreData, 'projectId' | 'createdAt' | 'updatedAt'>,
    submit: boolean = false
  ): Promise<{ success: boolean; offerId?: string; error?: string }> {
    try {
      // Récupérer les infos de l'entreprise depuis le profil utilisateur
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('*')
        .eq('id', userId)
        .single();

      if (userError) throw userError;

      // Chercher ou créer la consultation
      let consultationId: string;
      const { data: existingConsultation } = await supabase
        .from('phase1_consultations')
        .select('id')
        .eq('project_id', projectId)
        .single();

      if (existingConsultation) {
        consultationId = existingConsultation.id;
      } else {
        // Créer une consultation si elle n'existe pas
        const { data: newConsultation, error: consultError } = await supabase
          .from('phase1_consultations')
          .insert({
            project_id: projectId,
            parametres: {},
            statut: 'en_cours',
          })
          .select('id')
          .single();

        if (consultError) throw consultError;
        consultationId = newConsultation.id;
      }

      // Préparer les données de l'entreprise
      const entrepriseSnapshot = {
        id: userId,
        raison_sociale: userData.company || '',
        siret: userData.company_siret || '',
        contact: {
          nom: userData.name || '',
          email: userData.email || '',
          telephone: userData.phone || '',
        },
        adresse: userData.company_address || '',
        qualifications: userData.company_certifications || [],
      };

      // Préparer le contenu de l'offre
      const contenu: B2BOffreData = {
        projectId,
        consultationId,
        ...offerData,
        status: submit ? 'submitted' : 'draft',
        updatedAt: new Date().toISOString(),
        submittedAt: submit ? new Date().toISOString() : undefined,
      };

      // Vérifier si une offre existe déjà pour ce projet et cet utilisateur
      const { data: existingOffer } = await supabase
        .from('phase1_offres')
        .select('id')
        .eq('consultation_id', consultationId)
        .eq('entreprise->id', userId)
        .single();

      if (existingOffer) {
        // Mettre à jour l'offre existante
        const { error: updateError } = await supabase
          .from('phase1_offres')
          .update({
            entreprise: entrepriseSnapshot,
            contenu,
            statut: submit ? 'recue' : 'recue', // Statut après soumission
            date_reception: submit ? new Date().toISOString() : undefined,
            historique: supabase.sql`historique || ${JSON.stringify([{
              action: submit ? 'submitted' : 'updated',
              timestamp: new Date().toISOString(),
              details: submit ? 'Offre soumise' : 'Offre mise à jour',
            }])}::jsonb`,
          })
          .eq('id', existingOffer.id);

        if (updateError) throw updateError;

        return { success: true, offerId: existingOffer.id };
      } else {
        // Créer une nouvelle offre
        const { data: newOffer, error: insertError } = await supabase
          .from('phase1_offres')
          .insert({
            consultation_id: consultationId,
            entreprise: entrepriseSnapshot,
            statut: submit ? 'recue' : 'recue',
            date_reception: submit ? new Date().toISOString() : null,
            conformite: {},
            contenu,
            documents: [],
            historique: [{
              action: 'created',
              timestamp: new Date().toISOString(),
              details: 'Offre créée',
            }],
          })
          .select('id')
          .single();

        if (insertError) throw insertError;

        return { success: true, offerId: newOffer.id };
      }
    } catch (error) {
      console.error('[B2BOffreService] Erreur sauvegarde:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Erreur lors de la sauvegarde',
      };
    }
  }

  /**
   * Charger une offre B2B existante pour un projet
   */
  static async getOfferByProject(
    userId: string,
    projectId: string
  ): Promise<B2BOffreData | null> {
    try {
      // D'abord, vérifier s'il y a une offre sauvegardée en localStorage (fallback)
      const localOffer = localStorage.getItem(`b2b_offer_${projectId}`);

      // Chercher la consultation du projet
      const { data: consultation } = await supabase
        .from('phase1_consultations')
        .select('id')
        .eq('project_id', projectId)
        .single();

      if (!consultation) {
        // Pas de consultation, retourner les données locales si disponibles
        if (localOffer) {
          try {
            return JSON.parse(localOffer);
          } catch {
            return null;
          }
        }
        return null;
      }

      // Chercher l'offre de l'utilisateur pour cette consultation
      const { data: offer } = await supabase
        .from('phase1_offres')
        .select('*')
        .eq('consultation_id', consultation.id)
        .eq('entreprise->id', userId)
        .single();

      if (offer?.contenu) {
        return offer.contenu as B2BOffreData;
      }

      // Fallback vers localStorage
      if (localOffer) {
        try {
          return JSON.parse(localOffer);
        } catch {
          return null;
        }
      }

      return null;
    } catch (error) {
      console.error('[B2BOffreService] Erreur chargement:', error);

      // Fallback vers localStorage en cas d'erreur
      const localOffer = localStorage.getItem(`b2b_offer_${projectId}`);
      if (localOffer) {
        try {
          return JSON.parse(localOffer);
        } catch {
          return null;
        }
      }

      return null;
    }
  }

  /**
   * Soumettre une offre B2B
   */
  static async submitOffer(
    userId: string,
    projectId: string,
    offerData: Omit<B2BOffreData, 'projectId' | 'createdAt' | 'updatedAt'>
  ): Promise<{ success: boolean; offerId?: string; error?: string }> {
    return this.saveOffer(userId, projectId, offerData, true);
  }

  /**
   * Récupérer toutes les offres soumises par l'entreprise
   */
  static async getMyOffers(userId: string): Promise<B2BOffreRecord[]> {
    try {
      const { data, error } = await supabase
        .from('phase1_offres')
        .select('*')
        .eq('entreprise->id', userId)
        .order('created_at', { ascending: false });

      if (error) throw error;

      return data || [];
    } catch (error) {
      console.error('[B2BOffreService] Erreur récupération offres:', error);
      return [];
    }
  }

  /**
   * Pré-remplir le mémoire technique depuis le profil entreprise
   */
  static async prefillFromProfile(userId: string): Promise<Partial<B2BOffreMemoireTechnique>> {
    try {
      const { data: user, error } = await supabase
        .from('users')
        .select(`
          company,
          company_description,
          company_human_resources,
          company_material_resources,
          company_methodology,
          company_quality_commitments,
          company_references
        `)
        .eq('id', userId)
        .single();

      if (error) throw error;

      return {
        presentationEntreprise: user?.company_description || '',
        moyensHumains: user?.company_human_resources || '',
        moyensMateriels: user?.company_material_resources || '',
        methodologie: user?.company_methodology || '',
        engagementsQualite: user?.company_quality_commitments || '',
        referencesProjet: user?.company_references
          ? user.company_references
              .map((ref: any) => `${ref.project_name} (${ref.year || 'N/A'}) - ${ref.client_name || 'Client'}`)
              .join('\n')
          : '',
      };
    } catch (error) {
      console.error('[B2BOffreService] Erreur pré-remplissage:', error);
      return {};
    }
  }

  /**
   * Calculer le score de l'offre (pour analyse)
   */
  static calculateOfferScore(offer: B2BOffreData): {
    completeness: number;
    details: { section: string; score: number; max: number }[];
  } {
    const details: { section: string; score: number; max: number }[] = [];

    // Score mémoire technique (40 points max)
    let mtScore = 0;
    const mt = offer.memoireTechnique;
    if (mt.presentationEntreprise && mt.presentationEntreprise.length > 100) mtScore += 8;
    else if (mt.presentationEntreprise) mtScore += 4;
    if (mt.moyensHumains && mt.moyensHumains.length > 50) mtScore += 7;
    else if (mt.moyensHumains) mtScore += 3;
    if (mt.moyensMateriels && mt.moyensMateriels.length > 50) mtScore += 7;
    else if (mt.moyensMateriels) mtScore += 3;
    if (mt.methodologie && mt.methodologie.length > 100) mtScore += 8;
    else if (mt.methodologie) mtScore += 4;
    if (mt.referencesProjet && mt.referencesProjet.length > 50) mtScore += 5;
    else if (mt.referencesProjet) mtScore += 2;
    if (mt.engagementsQualite && mt.engagementsQualite.length > 50) mtScore += 5;
    else if (mt.engagementsQualite) mtScore += 2;
    details.push({ section: 'Mémoire technique', score: mtScore, max: 40 });

    // Score DPGF (30 points max)
    let dpgfScore = 0;
    if (offer.dpgf.postes.length > 0) dpgfScore += 10;
    if (offer.dpgf.postes.every(p => p.prixUnitaireHT > 0)) dpgfScore += 10;
    if (offer.dpgf.postes.every(p => p.designation && p.unite)) dpgfScore += 10;
    details.push({ section: 'DPGF', score: dpgfScore, max: 30 });

    // Score Planning (20 points max)
    let planningScore = 0;
    if (offer.planning.dateDebutProposee) planningScore += 10;
    if (offer.planning.dureeJours > 0) planningScore += 10;
    details.push({ section: 'Planning', score: planningScore, max: 20 });

    // Score Conditions (10 points max)
    let conditionsScore = 0;
    if (offer.conditions.dureeValiditeOffre >= 30) conditionsScore += 5;
    if (offer.conditions.delaiPaiement > 0) conditionsScore += 5;
    details.push({ section: 'Conditions', score: conditionsScore, max: 10 });

    const totalScore = mtScore + dpgfScore + planningScore + conditionsScore;
    const maxScore = 100;

    return {
      completeness: Math.round((totalScore / maxScore) * 100),
      details,
    };
  }
}

export default B2BOffreService;
