/**
 * Service de gestion des demandes de devis Marketplace
 */

import type {
  DemandeDevis,
  DemandeStatus,
  LotDemande,
  ReponseArtisan,
} from '@/types/marketplace.types';
import type { Phase0Project } from '@/types/phase0';
import { supabase } from '@/lib/supabase';

/**
 * Service de gestion des demandes de devis
 */
export class DemandeService {
  private readonly tableName = 'marketplace_demandes';

  /**
   * Créer une demande depuis un projet Phase0
   */
  async createFromPhase0Project(
    project: Phase0Project,
    options: {
      mode: 'public' | 'cible' | 'prive';
      artisansCibles?: string[];
      dateLimiteReponse: Date;
      nombreDevisMax?: number;
    }
  ): Promise<DemandeDevis> {
    const demande: Omit<DemandeDevis, 'id' | 'createdAt' | 'updatedAt'> = {
      projectId: project.id,
      userId: project.userId,

      projet: {
        titre: project.workProject?.general?.title || 'Projet de travaux',
        description: this.generateDescription(project),
        type: (project.workProject?.general?.type as DemandeDevis['projet']['type']) || 'renovation',
        lots: this.convertLotsFromPhase0(project),
        budgetEstime: project.workProject?.budget?.totalEnvelope ? {
          min: project.workProject.budget.totalEnvelope.minAmount || 0,
          max: project.workProject.budget.totalEnvelope.maxAmount || 0,
        } : undefined,
        delaiSouhaite: this.extractDelais(project),
      },

      localisation: {
        adresse: project.property?.address?.street || '',
        codePostal: project.property?.address?.postalCode || '',
        ville: project.property?.address?.city || '',
        departement: project.property?.address?.department || '',
      },

      criteres: {
        rgeRequis: project.selectedLots?.some(
          lot => lot.isRGEEligible || lot.category === 'energy'
        ) || false,
        qualificationsRequises: [],
        budgetFerme: false,
      },

      diffusion: {
        mode: options.mode,
        artisansCibles: options.artisansCibles,
        dateLimiteReponse: options.dateLimiteReponse,
        nombreDevisMax: options.nombreDevisMax,
      },

      status: 'draft',
      nombreDevisRecus: 0,
      nombreVues: 0,
    };

    // Sauvegarder (simulation pour l'instant)
    const savedDemande: DemandeDevis = {
      ...demande,
      id: `demande-${Date.now()}`,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    console.log('[DemandeService] Demande créée:', savedDemande.id);

    return savedDemande;
  }

  /**
   * Publier une demande (la rendre visible aux artisans)
   */
  async publish(demandeId: string): Promise<DemandeDevis> {
    // Mise à jour du statut
    console.log('[DemandeService] Publication demande:', demandeId);

    // Simuler la mise à jour
    return {
      id: demandeId,
      status: 'published',
      publishedAt: new Date(),
    } as DemandeDevis;
  }

  /**
   * Récupérer les demandes d'un utilisateur
   */
  async getUserDemandes(userId: string): Promise<DemandeDevis[]> {
    // Pour l'instant, retourner un tableau vide (à connecter à Supabase)
    console.log('[DemandeService] Récupération demandes pour:', userId);
    return [];
  }

  /**
   * Récupérer les demandes correspondant aux critères d'un artisan
   */
  async getMatchingDemandes(
    artisanId: string,
    filters?: {
      departements?: string[];
      metiers?: string[];
      budgetMin?: number;
      budgetMax?: number;
    }
  ): Promise<DemandeDevis[]> {
    console.log('[DemandeService] Recherche demandes pour artisan:', artisanId, filters);
    return [];
  }

  /**
   * Récupérer les réponses à une demande
   */
  async getReponses(demandeId: string): Promise<ReponseArtisan[]> {
    console.log('[DemandeService] Récupération réponses pour:', demandeId);
    return [];
  }

  /**
   * Mettre à jour le statut d'une demande
   */
  async updateStatus(
    demandeId: string,
    status: DemandeStatus
  ): Promise<void> {
    console.log('[DemandeService] Mise à jour statut:', demandeId, status);
  }

  /**
   * Clôturer une demande (accepter une réponse)
   */
  async closeDemande(
    demandeId: string,
    acceptedReponseId: string
  ): Promise<void> {
    console.log('[DemandeService] Clôture demande:', demandeId, 'Réponse acceptée:', acceptedReponseId);
  }

  /**
   * Générer une description depuis le projet Phase0
   */
  private generateDescription(project: Phase0Project): string {
    const parts: string[] = [];

    // Type de bien
    if (project.property) {
      const propertyType = project.property.type || 'bien';
      const surface = project.property.surface?.total;
      parts.push(`Travaux sur ${propertyType}${surface ? ` de ${surface}m²` : ''}`);
    }

    // Localisation
    if (project.property?.address) {
      parts.push(`à ${project.property.address.city} (${project.property.address.postalCode})`);
    }

    // Type de travaux
    if (project.workProject?.general?.type) {
      parts.push(`- Projet de ${project.workProject.general.type}`);
    }

    // Nombre de lots
    if (project.selectedLots?.length) {
      parts.push(`comprenant ${project.selectedLots.length} lot(s) de travaux`);
    }

    return parts.join(' ');
  }

  /**
   * Convertir les lots Phase0 en lots de demande
   */
  private convertLotsFromPhase0(project: Phase0Project): LotDemande[] {
    if (!project.selectedLots) return [];

    return project.selectedLots.map(lot => ({
      id: lot.id,
      categorie: lot.category,
      designation: lot.label || lot.type,
      description: lot.description,
      budgetEstime: lot.estimation?.totalHT ? {
        min: lot.estimation.totalHT.min || 0,
        max: lot.estimation.totalHT.max || 0,
      } : undefined,
      priorite: lot.isRequired ? 'obligatoire' : 'souhaite',
    }));
  }

  /**
   * Extraire les délais depuis le projet
   */
  private extractDelais(
    project: Phase0Project
  ): DemandeDevis['projet']['delaiSouhaite'] {
    const temporal = project.workProject?.constraints?.temporal;
    if (!temporal?.preferredStart) return undefined;

    const debut = new Date(temporal.preferredStart);
    const fin = temporal.deadline?.date
      ? new Date(temporal.deadline.date)
      : new Date(debut.getTime() + (temporal.maxDuration || 3) * 30 * 24 * 60 * 60 * 1000);

    return { debut, fin };
  }
}

export const demandeService = new DemandeService();
export default demandeService;
