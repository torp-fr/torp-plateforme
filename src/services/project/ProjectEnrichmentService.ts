/**
 * Project Enrichment Service (P1)
 * Enrichissement automatique du contexte projet avec données externes
 * Structure prête pour implémentation P1
 */

import { inseeService } from '@/services/external-apis/INSEEService';
// NOTE: Pappers API moved to server-side via Edge Function
// import { pappersService } from '@/services/external-apis/PappersService';
import { banService } from '@/services/external-apis/BANService';
import { georisquesService } from '@/services/external-apis/GeorisquesService';
import type { ProjectContext } from '@/types/ProjectContext';
import { log, warn, error, time, timeEnd } from '@/lib/logger';

export interface EnrichedProjectContext extends ProjectContext {
  enrichmentData: {
    address?: {
      validated: boolean;
      coordinates?: { lat: number; lng: number };
      region?: string;
    };
    environmental?: {
      climateZone?: string;
      floodRisk?: string;
      seismicRisk?: string;
      radonPotential?: string;
    };
    buildingInfo?: {
      constructionYear?: number;
      previousRenovations?: string[];
    };
  };
}

export class ProjectEnrichmentService {
  /**
   * Enrichir un contexte projet avec données externes (P1)
   */
  async enrichProjectContext(context: ProjectContext): Promise<EnrichedProjectContext> {
    try {
      log(`🔄 [P1] Enriching project context...`);

      const enrichedContext: EnrichedProjectContext = {
        ...context,
        enrichmentData: {},
      };

      // 1. Enrichir adresse
      enrichedContext.enrichmentData.address = await this.enrichAddress(context.address);

      // 2. Enrichir données environnementales
      if (enrichedContext.enrichmentData.address?.coordinates) {
        enrichedContext.enrichmentData.environmental = await this.enrichEnvironmental(
          enrichedContext.enrichmentData.address.coordinates.lat,
          enrichedContext.enrichmentData.address.coordinates.lng,
          context.address
        );
      }

      // 3. Enrichir infos bâtiment
      enrichedContext.enrichmentData.buildingInfo = await this.enrichBuildingInfo(context.address);

      log(`✅ Project enrichment complete`);
      return enrichedContext;
    } catch (error) {
      console.error('❌ Enrichment error:', error);
      // Retourner le contexte original en cas d'erreur
      return {
        ...context,
        enrichmentData: {},
      };
    }
  }

  /**
   * Enrichir adresse (P1)
   * - Valider et standardiser
   * - Géocoder
   * - Récupérer données INSEE
   */
  private async enrichAddress(address: string): Promise<{
    validated: boolean;
    coordinates?: { lat: number; lng: number };
    region?: string;
  }> {
    try {
      log(`📍 [P1] Enriching address: ${address}`);

      // TODO: P1 Implementation
      // 1. Valider avec BAN
      // 2. Géocoder
      // 3. Récupérer région INSEE

      // Stub pour MVP
      return {
        validated: false,
      };
    } catch (error) {
      console.error('❌ Address enrichment error:', error);
      return { validated: false };
    }
  }

  /**
   * Enrichir données environnementales (P1)
   * - Zone climatique RE2020
   * - Risques: inondation, séisme, radon
   * - Contraintes: monuments, zones protégées
   */
  private async enrichEnvironmental(
    latitude: number,
    longitude: number,
    postalCode: string
  ): Promise<{
    climateZone?: string;
    floodRisk?: string;
    seismicRisk?: string;
    radonPotential?: string;
  }> {
    try {
      log(`🌍 [P1] Enriching environmental data...`);

      // TODO: P1 Implementation
      // 1. Récupérer zone climatique
      // 2. Vérifier risques Géorisques
      // 3. Vérifier potentiel radon

      // Stub pour MVP
      return {};
    } catch (error) {
      console.error('❌ Environmental enrichment error:', error);
      return {};
    }
  }

  /**
   * Enrichir infos bâtiment (P1)
   * - Année construction (cadastre)
   * - Historique rénovations
   * - Caractéristiques
   */
  private async enrichBuildingInfo(address: string): Promise<{
    constructionYear?: number;
    previousRenovations?: string[];
  }> {
    try {
      log(`🏢 [P1] Enriching building info for: ${address}`);

      // TODO: P1 Implementation
      // 1. Récupérer année construction via cadastre
      // 2. Chercher historique rénovations
      // 3. Classifier type bâtiment

      // Stub pour MVP
      return {};
    } catch (error) {
      console.error('❌ Building info enrichment error:', error);
      return {};
    }
  }

  /**
   * Enrichir contexte entreprise (pour scoring)
   * P1: Récupérer données financières
   */
  async enrichCompanyData(siret: string): Promise<{
    name?: string;
    financialHealth?: number;
    paymentRecord?: string;
    solvencyScore?: number;
  }> {
    try {
      log(`🏭 [P1] Enriching company data for SIRET: ${siret}`);

      // TODO: P1 Implementation
      // 1. Récupérer INSEE
      // 2. Récupérer Pappers
      // 3. Analyser scores

      // Stub pour MVP
      return {};
    } catch (error) {
      console.error('❌ Company enrichment error:', error);
      return {};
    }
  }

  /**
   * Vérifier si enrichissement disponible pour adresse
   */
  async canEnrich(address: string): Promise<boolean> {
    try {
      log(`❓ [P1] Checking if can enrich: ${address}`);

      // TODO: P1 Implementation
      // Stub pour MVP
      return false;
    } catch (error) {
      console.error('❌ Check enrichment error:', error);
      return false;
    }
  }

  /**
   * Obtenir statut enrichissement
   */
  getEnrichmentStatus(context: EnrichedProjectContext): {
    percentage: number;
    fields: Record<string, boolean>;
  } {
    const fields = {
      address: !!context.enrichmentData.address?.validated,
      environmental: !!context.enrichmentData.environmental,
      buildingInfo: !!context.enrichmentData.buildingInfo,
    };

    const percentage = Object.values(fields).filter(Boolean).length / Object.keys(fields).length * 100;

    return {
      percentage,
      fields,
    };
  }
}

export const projectEnrichmentService = new ProjectEnrichmentService();
export default projectEnrichmentService;
