/**
 * Mock Devis Service
 * Simulates backend API for devis/quotes management
 * TODO: Replace with real API calls when backend is ready
 */

import { env } from '@/config/env';
import { DevisData, TorpAnalysisResult, Recommendation } from '@/types/torp';

/**
 * Simulate network delay for realistic UX
 */
const delay = (ms: number = 1000) => new Promise(resolve => setTimeout(resolve, ms));

export class MockDevisService {
  /**
   * Upload and analyze a devis file
   */
  async uploadDevis(file: File): Promise<{ id: string; status: string }> {
    if (!env.api.useMock) {
      throw new Error('Real API not implemented yet');
    }

    // Validate file
    if (file.size > env.upload.maxFileSize) {
      throw new Error(`File size exceeds ${env.upload.maxFileSize / 1024 / 1024}MB limit`);
    }

    const fileExtension = `.${file.name.split('.').pop()?.toLowerCase()}`;
    if (!env.upload.allowedTypes.includes(fileExtension)) {
      throw new Error(`File type ${fileExtension} not allowed`);
    }

    await delay(1500);

    return {
      id: `devis-${Date.now()}`,
      status: 'uploaded',
    };
  }

  /**
   * Get analysis result for a devis
   */
  async getAnalysis(devisId: string): Promise<TorpAnalysisResult> {
    if (!env.api.useMock) {
      throw new Error('Real API not implemented yet');
    }

    await delay(2500); // Simulate AI processing time

    const mockAnalysis: TorpAnalysisResult = {
      id: `analysis-${devisId}`,
      devisId,
      scoreGlobal: 850,
      grade: 'A',

      scoreEntreprise: {
        fiabilite: 90,
        santeFinnaciere: 85,
        anciennete: 95,
        assurances: 100,
        certifications: 80,
        reputation: 88,
        risques: [],
        benefices: [
          'Entreprise certifiée RGE depuis 10 ans',
          'Aucun litige enregistré',
          'Assurance décennale valide jusqu\'en 2026',
        ],
      },

      scorePrix: {
        vsMarche: 85,
        transparence: 95,
        coherence: 90,
        margeEstimee: 18,
        ajustementQualite: 5,
        economiesPotentielles: 1200,
      },

      scoreCompletude: {
        elementsManquants: [],
        incohérences: [],
        conformiteNormes: 95,
        risquesTechniques: [],
      },

      scoreConformite: {
        assurances: true,
        plu: true,
        normes: true,
        accessibilite: true,
        defauts: [],
      },

      scoreDelais: {
        realisme: 90,
        vsMarche: 85,
        planningDetaille: true,
        penalitesRetard: true,
      },

      recommandations: [
        {
          type: 'negociation',
          priorite: 'moyenne',
          titre: 'Possibilité de négociation sur l\'acompte',
          description: 'L\'acompte demandé de 30% est au-dessus de la norme. Vous pouvez négocier pour le ramener à 20%.',
          actionSuggeree: 'Demander une réduction de l\'acompte à 20%',
          impactBudget: -1500,
          delaiAction: 7,
        },
        {
          type: 'verification',
          priorite: 'haute',
          titre: 'Vérifier les références',
          description: 'Demandez des photos de chantiers similaires récents.',
          actionSuggeree: 'Contacter l\'entreprise pour obtenir 2-3 références vérifiables',
          delaiAction: 3,
        },
      ],

      surcoutsDetectes: 0,
      budgetRealEstime: 15200,
      margeNegociation: {
        min: 14500,
        max: 15800,
      },

      dateAnalyse: new Date(),
      dureeAnalyse: 2.5,
    };

    return mockAnalysis;
  }

  /**
   * Get all devis for a user
   */
  async getUserDevis(userId: string): Promise<DevisData[]> {
    if (!env.api.useMock) {
      throw new Error('Real API not implemented yet');
    }

    await delay(500);

    // Return mock data
    return [];
  }

  /**
   * Compare multiple devis
   */
  async compareDevis(devisIds: string[]): Promise<{
    comparison: Record<string, unknown>;
    recommendation: string;
  }> {
    if (!env.api.useMock) {
      throw new Error('Real API not implemented yet');
    }

    await delay(1000);

    return {
      comparison: {},
      recommendation: 'Devis comparison will be available soon',
    };
  }

  /**
   * Request AI assistance for a devis
   */
  async askAI(devisId: string, question: string): Promise<string> {
    if (!env.api.useMock) {
      throw new Error('Real API not implemented yet');
    }

    await delay(800);

    return `Mock AI response for: "${question}". This will be replaced with real AI when backend is ready.`;
  }
}

export const devisService = new MockDevisService();
export default devisService;
