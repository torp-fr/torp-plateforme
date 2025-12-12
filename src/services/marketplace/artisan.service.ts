/**
 * Service de gestion des profils artisans Marketplace
 */

import type {
  ArtisanProfile,
  ArtisanQualification,
  MetierBTP,
  ReponseArtisan,
  EvaluationArtisan,
  ArtisanSubscription,
} from '@/types/marketplace.types';
import { supabase } from '@/lib/supabase';

/**
 * Service de gestion des artisans
 */
export class ArtisanService {
  private readonly tableName = 'marketplace_artisans';

  /**
   * Créer un profil artisan
   */
  async createProfile(
    userId: string,
    data: Omit<ArtisanProfile, 'id' | 'userId' | 'stats' | 'status' | 'createdAt' | 'updatedAt'>
  ): Promise<ArtisanProfile> {
    const profile: ArtisanProfile = {
      ...data,
      id: `artisan-${Date.now()}`,
      userId,
      stats: {
        devisEnvoyes: 0,
        devisAcceptes: 0,
        tauxConversion: 0,
        noteMoyenne: 0,
        nombreAvis: 0,
      },
      status: 'pending_verification',
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    console.log('[ArtisanService] Profil créé:', profile.id);

    return profile;
  }

  /**
   * Mettre à jour un profil artisan
   */
  async updateProfile(
    artisanId: string,
    updates: Partial<ArtisanProfile>
  ): Promise<ArtisanProfile> {
    console.log('[ArtisanService] Mise à jour profil:', artisanId, updates);

    // Simuler la mise à jour
    return {
      id: artisanId,
      ...updates,
      updatedAt: new Date(),
    } as ArtisanProfile;
  }

  /**
   * Récupérer un profil par ID
   */
  async getProfile(artisanId: string): Promise<ArtisanProfile | null> {
    console.log('[ArtisanService] Récupération profil:', artisanId);
    return null;
  }

  /**
   * Récupérer un profil par userId
   */
  async getProfileByUserId(userId: string): Promise<ArtisanProfile | null> {
    console.log('[ArtisanService] Récupération profil par userId:', userId);
    return null;
  }

  /**
   * Rechercher des artisans
   */
  async searchArtisans(filters: {
    metiers?: MetierBTP[];
    departements?: string[];
    rgeRequis?: boolean;
    noteMinimum?: number;
    disponibilite?: string;
  }): Promise<ArtisanProfile[]> {
    console.log('[ArtisanService] Recherche artisans:', filters);
    return [];
  }

  /**
   * Ajouter une qualification
   */
  async addQualification(
    artisanId: string,
    qualification: Omit<ArtisanQualification, 'id' | 'estValide'>
  ): Promise<ArtisanQualification> {
    const qualif: ArtisanQualification = {
      ...qualification,
      id: `qualif-${Date.now()}`,
      estValide: qualification.dateValidite > new Date(),
    };

    console.log('[ArtisanService] Qualification ajoutée:', qualif.id);

    return qualif;
  }

  /**
   * Vérifier les qualifications
   */
  async verifyQualifications(artisanId: string): Promise<{
    total: number;
    valides: number;
    expirees: number;
    aVerifier: number;
  }> {
    console.log('[ArtisanService] Vérification qualifications:', artisanId);

    return {
      total: 0,
      valides: 0,
      expirees: 0,
      aVerifier: 0,
    };
  }

  /**
   * Soumettre une réponse à une demande
   */
  async submitReponse(
    artisanId: string,
    demandeId: string,
    reponse: Omit<ReponseArtisan, 'id' | 'artisanId' | 'demandeId' | 'status' | 'vueParClient' | 'createdAt' | 'updatedAt'>
  ): Promise<ReponseArtisan> {
    const savedReponse: ReponseArtisan = {
      ...reponse,
      id: `reponse-${Date.now()}`,
      artisanId,
      demandeId,
      status: 'submitted',
      vueParClient: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    console.log('[ArtisanService] Réponse soumise:', savedReponse.id);

    return savedReponse;
  }

  /**
   * Récupérer les réponses d'un artisan
   */
  async getArtisanReponses(artisanId: string): Promise<ReponseArtisan[]> {
    console.log('[ArtisanService] Récupération réponses artisan:', artisanId);
    return [];
  }

  /**
   * Récupérer les évaluations d'un artisan
   */
  async getEvaluations(artisanId: string): Promise<EvaluationArtisan[]> {
    console.log('[ArtisanService] Récupération évaluations:', artisanId);
    return [];
  }

  /**
   * Calculer les statistiques d'un artisan
   */
  async calculateStats(artisanId: string): Promise<ArtisanProfile['stats']> {
    // Récupérer les données
    const reponses = await this.getArtisanReponses(artisanId);
    const evaluations = await this.getEvaluations(artisanId);

    const devisEnvoyes = reponses.length;
    const devisAcceptes = reponses.filter(r => r.status === 'accepted').length;
    const tauxConversion = devisEnvoyes > 0 ? (devisAcceptes / devisEnvoyes) * 100 : 0;

    const notes = evaluations.map(e => e.noteMoyenne);
    const noteMoyenne = notes.length > 0
      ? notes.reduce((a, b) => a + b, 0) / notes.length
      : 0;

    return {
      devisEnvoyes,
      devisAcceptes,
      tauxConversion: Math.round(tauxConversion * 10) / 10,
      noteMoyenne: Math.round(noteMoyenne * 10) / 10,
      nombreAvis: evaluations.length,
    };
  }

  /**
   * Gérer l'abonnement
   */
  async getSubscription(artisanId: string): Promise<ArtisanSubscription | null> {
    console.log('[ArtisanService] Récupération abonnement:', artisanId);
    return null;
  }

  /**
   * Mettre à niveau l'abonnement
   */
  async upgradeSubscription(
    artisanId: string,
    plan: ArtisanSubscription['plan']
  ): Promise<ArtisanSubscription> {
    const subscription: ArtisanSubscription = {
      id: `sub-${Date.now()}`,
      artisanId,
      plan,
      features: this.getPlanFeatures(plan),
      pricing: this.getPlanPricing(plan),
      status: 'active',
      startDate: new Date(),
      endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      autoRenew: true,
    };

    console.log('[ArtisanService] Abonnement mis à jour:', subscription.id);

    return subscription;
  }

  /**
   * Obtenir les fonctionnalités d'un plan
   */
  private getPlanFeatures(plan: ArtisanSubscription['plan']): ArtisanSubscription['features'] {
    const features: Record<ArtisanSubscription['plan'], ArtisanSubscription['features']> = {
      free: {
        demandesParMois: 5,
        miseEnAvant: false,
        badgePremium: false,
        statistiquesAvancees: false,
        supportPrioritaire: false,
      },
      starter: {
        demandesParMois: 20,
        miseEnAvant: false,
        badgePremium: false,
        statistiquesAvancees: true,
        supportPrioritaire: false,
      },
      pro: {
        demandesParMois: 50,
        miseEnAvant: true,
        badgePremium: false,
        statistiquesAvancees: true,
        supportPrioritaire: true,
      },
      premium: {
        demandesParMois: -1, // Illimité
        miseEnAvant: true,
        badgePremium: true,
        statistiquesAvancees: true,
        supportPrioritaire: true,
      },
    };

    return features[plan];
  }

  /**
   * Obtenir les tarifs d'un plan
   */
  private getPlanPricing(plan: ArtisanSubscription['plan']): ArtisanSubscription['pricing'] {
    const pricing: Record<ArtisanSubscription['plan'], ArtisanSubscription['pricing']> = {
      free: { mensuel: 0, annuel: 0 },
      starter: { mensuel: 29, annuel: 290 },
      pro: { mensuel: 79, annuel: 790 },
      premium: { mensuel: 149, annuel: 1490 },
    };

    return pricing[plan];
  }

  /**
   * Vérifier si un artisan peut répondre à une demande
   */
  async canRespondToDemande(
    artisanId: string,
    demandeId: string
  ): Promise<{
    canRespond: boolean;
    reason?: string;
  }> {
    const subscription = await this.getSubscription(artisanId);

    if (!subscription || subscription.status !== 'active') {
      return {
        canRespond: false,
        reason: 'Abonnement inactif ou inexistant',
      };
    }

    // Vérifier le quota mensuel
    const reponses = await this.getArtisanReponses(artisanId);
    const thisMonth = new Date();
    thisMonth.setDate(1);
    thisMonth.setHours(0, 0, 0, 0);

    const reponsesThisMonth = reponses.filter(
      r => new Date(r.createdAt) >= thisMonth
    ).length;

    const limit = subscription.features.demandesParMois;
    if (limit !== -1 && reponsesThisMonth >= limit) {
      return {
        canRespond: false,
        reason: `Quota mensuel atteint (${limit} demandes)`,
      };
    }

    return { canRespond: true };
  }
}

export const artisanService = new ArtisanService();
export default artisanService;
