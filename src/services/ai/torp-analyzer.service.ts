/**
 * TORP Analyzer Service
 * Main service for analyzing devis using AI and TORP methodology
 */

import { hybridAIService } from './hybrid-ai.service';
import {
  TORP_SYSTEM_PROMPT,
  buildExtractionPrompt,
  buildEntrepriseAnalysisPrompt,
  buildPrixAnalysisPrompt,
  buildCompletudeAnalysisPrompt,
  buildConformiteAnalysisPrompt,
  buildDelaisAnalysisPrompt,
  buildSynthesisPrompt,
} from './prompts/torp-analysis.prompts';
import type { TorpAnalysisResult } from '@/types/torp';

export interface ExtractedDevisData {
  entreprise: {
    nom: string;
    siret: string | null;
    adresse: string;
    telephone: string | null;
    email: string | null;
    certifications: string[];
    assurances: {
      decennale: boolean;
      rcPro: boolean;
      numeroPolice: string | null;
    };
  };
  devis: {
    numero: string | null;
    date: string | null;
    validite: number | null;
    montantTotal: number;
    montantHT: number | null;
    tva: number | null;
  };
  travaux: {
    type: string;
    description: string;
    surface: number | null;
    postes: Array<{
      designation: string;
      quantite: number | null;
      unite: string | null;
      prixUnitaire: number | null;
      total: number;
    }>;
  };
  delais: {
    debut: string | null;
    fin: string | null;
    duree: number | null;
  };
}

export class TorpAnalyzerService {
  /**
   * Analyze a devis text and return complete TORP analysis
   */
  async analyzeDevis(
    devisText: string,
    metadata?: {
      region?: string;
      typeTravaux?: string;
    }
  ): Promise<TorpAnalysisResult> {
    const startTime = Date.now();

    try {
      // Step 1: Extract structured data from devis
      console.log('[TORP] Step 1/6: Extracting structured data...');
      const extractedData = await this.extractDevisData(devisText);

      const region = metadata?.region || 'Île-de-France';
      const typeTravaux = metadata?.typeTravaux || extractedData.travaux.type || 'rénovation';

      // Step 2: Analyze Entreprise (250 pts)
      console.log('[TORP] Step 2/6: Analyzing entreprise...');
      const entrepriseAnalysis = await this.analyzeEntreprise(extractedData);

      // Step 3: Analyze Prix (300 pts)
      console.log('[TORP] Step 3/6: Analyzing prix...');
      const prixAnalysis = await this.analyzePrix(extractedData, typeTravaux, region);

      // Step 4: Analyze Complétude (200 pts)
      console.log('[TORP] Step 4/6: Analyzing complétude...');
      const completudeAnalysis = await this.analyzeCompletude(extractedData, typeTravaux);

      // Step 5: Analyze Conformité (150 pts)
      console.log('[TORP] Step 5/6: Analyzing conformité...');
      const conformiteAnalysis = await this.analyzeConformite(extractedData, typeTravaux);

      // Step 6: Analyze Délais (100 pts)
      console.log('[TORP] Step 6/6: Analyzing délais...');
      const delaisAnalysis = await this.analyzeDelais(extractedData, typeTravaux);

      // Step 7: Generate synthesis and recommendations
      console.log('[TORP] Generating synthesis...');
      const synthesis = await this.generateSynthesis(
        entrepriseAnalysis,
        prixAnalysis,
        completudeAnalysis,
        conformiteAnalysis,
        delaisAnalysis
      );

      const dureeAnalyse = Math.round((Date.now() - startTime) / 1000);

      // Build final result
      const result: TorpAnalysisResult = {
        id: `torp-${Date.now()}`,
        devisId: '', // Will be set by caller
        scoreGlobal: synthesis.scoreGlobal || 0,
        grade: (synthesis.grade || 'C') as any,

        scoreEntreprise: {
          scoreTotal: entrepriseAnalysis.scoreTotal || 0,
          fiabilite: entrepriseAnalysis.details?.fiabilite?.score || 0,
          santeFinnaciere: entrepriseAnalysis.details?.santeFinnaciere?.score || 0,
          anciennete: 0, // Included in fiabilité
          assurances: entrepriseAnalysis.details?.assurances?.score || 0,
          certifications: entrepriseAnalysis.details?.certifications?.score || 0,
          reputation: entrepriseAnalysis.details?.reputation?.score || 0,
          risques: entrepriseAnalysis.risques || [],
          benefices: entrepriseAnalysis.benefices || [],
        },

        scorePrix: {
          scoreTotal: prixAnalysis.scoreTotal || 0,
          vsMarche: prixAnalysis.vsMarche?.score || 0,
          transparence: prixAnalysis.transparence?.score || 0,
          coherence: prixAnalysis.coherence?.score || 0,
          margeEstimee: 0, // TODO: calculate
          ajustementQualite: 0, // TODO: calculate
          economiesPotentielles: prixAnalysis.optimisations?.economiesPotentielles || 0,
        },

        scoreCompletude: {
          scoreTotal: completudeAnalysis.scoreTotal || 0,
          elementsManquants: completudeAnalysis.elementsManquants || [],
          incohérences: [], // TODO: extract from analysis
          conformiteNormes: completudeAnalysis.conformiteNormes?.score || 0,
          risquesTechniques: completudeAnalysis.risquesTechniques || [],
        },

        scoreConformite: {
          scoreTotal: conformiteAnalysis.scoreTotal || 0,
          assurances: conformiteAnalysis.assurances?.conforme ?? false,
          plu: conformiteAnalysis.plu?.conforme ?? false,
          normes: conformiteAnalysis.normes?.respectees?.length > 0 ?? false,
          accessibilite: conformiteAnalysis.accessibilite?.conforme ?? false,
          defauts: conformiteAnalysis.defauts || [],
        },

        scoreDelais: {
          scoreTotal: delaisAnalysis.scoreTotal || 0,
          realisme: delaisAnalysis.realisme?.score || 0,
          vsMarche: 0, // Included in realisme
          planningDetaille: delaisAnalysis.planning?.detaille ?? false,
          penalitesRetard: delaisAnalysis.penalites?.mentionnees ?? false,
        },

        recommandations: synthesis, // Store entire synthesis object
        surcoutsDetectes: extractedData.devis?.montantTotal ? extractedData.devis.montantTotal - (synthesis.budgetRealEstime || extractedData.devis.montantTotal) : 0,
        budgetRealEstime: synthesis.budgetRealEstime || extractedData.devis?.montantTotal || 0,
        margeNegociation: synthesis.margeNegociation || { min: 0, max: 0 },

        dateAnalyse: new Date(),
        dureeAnalyse,
      };

      console.log(`[TORP] Analysis complete in ${dureeAnalyse}s - Score: ${result.scoreGlobal}/1000 (${result.grade})`);

      return result;
    } catch (error) {
      console.error('[TORP] Analysis failed:', error);
      throw new Error(`TORP analysis failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Extract structured data from devis text
   */
  private async extractDevisData(devisText: string): Promise<ExtractedDevisData> {
    const prompt = buildExtractionPrompt(devisText);

    const { data } = await hybridAIService.generateJSON<ExtractedDevisData>(prompt, {
      systemPrompt: TORP_SYSTEM_PROMPT,
      temperature: 0.2, // Low temperature for accurate extraction
    });

    // Log critical extraction data for debugging
    console.log('[TORP Extraction] Entreprise:', data.entreprise.nom);
    console.log('[TORP Extraction] SIRET extrait:', data.entreprise.siret || 'NON TROUVÉ');
    console.log('[TORP Extraction] Certifications:', data.entreprise.certifications);
    console.log('[TORP Extraction] Montant total:', data.devis.montantTotal);

    return data;
  }

  /**
   * Analyze entreprise (250 points)
   */
  private async analyzeEntreprise(devisData: ExtractedDevisData): Promise<any> {
    const prompt = buildEntrepriseAnalysisPrompt(JSON.stringify(devisData, null, 2));

    const { data } = await hybridAIService.generateJSON(prompt, {
      systemPrompt: TORP_SYSTEM_PROMPT,
      temperature: 0.4,
    });

    return data;
  }

  /**
   * Analyze prix (300 points)
   */
  private async analyzePrix(devisData: ExtractedDevisData, typeTravaux: string, region: string): Promise<any> {
    const prompt = buildPrixAnalysisPrompt(JSON.stringify(devisData, null, 2), typeTravaux, region);

    const { data } = await hybridAIService.generateJSON(prompt, {
      systemPrompt: TORP_SYSTEM_PROMPT,
      temperature: 0.4,
    });

    return data;
  }

  /**
   * Analyze complétude (200 points)
   */
  private async analyzeCompletude(devisData: ExtractedDevisData, typeTravaux: string): Promise<any> {
    const prompt = buildCompletudeAnalysisPrompt(JSON.stringify(devisData, null, 2), typeTravaux);

    const { data } = await hybridAIService.generateJSON(prompt, {
      systemPrompt: TORP_SYSTEM_PROMPT,
      temperature: 0.4,
    });

    return data;
  }

  /**
   * Analyze conformité (150 points)
   */
  private async analyzeConformite(devisData: ExtractedDevisData, typeProjet: string): Promise<any> {
    const prompt = buildConformiteAnalysisPrompt(JSON.stringify(devisData, null, 2), typeProjet);

    const { data } = await hybridAIService.generateJSON(prompt, {
      systemPrompt: TORP_SYSTEM_PROMPT,
      temperature: 0.3,
    });

    return data;
  }

  /**
   * Analyze délais (100 points)
   */
  private async analyzeDelais(devisData: ExtractedDevisData, typeTravaux: string): Promise<any> {
    const prompt = buildDelaisAnalysisPrompt(JSON.stringify(devisData, null, 2), typeTravaux);

    const { data } = await hybridAIService.generateJSON(prompt, {
      systemPrompt: TORP_SYSTEM_PROMPT,
      temperature: 0.4,
    });

    return data;
  }

  /**
   * Generate synthesis and recommendations
   */
  private async generateSynthesis(
    entrepriseAnalysis: any,
    prixAnalysis: any,
    completudeAnalysis: any,
    conformiteAnalysis: any,
    delaisAnalysis: any
  ): Promise<any> {
    const allAnalyses = JSON.stringify(
      {
        entreprise: entrepriseAnalysis,
        prix: prixAnalysis,
        completude: completudeAnalysis,
        conformite: conformiteAnalysis,
        delais: delaisAnalysis,
      },
      null,
      2
    );

    const prompt = buildSynthesisPrompt(
      entrepriseAnalysis.scoreTotal,
      prixAnalysis.scoreTotal,
      completudeAnalysis.scoreTotal,
      conformiteAnalysis.scoreTotal,
      delaisAnalysis.scoreTotal,
      allAnalyses
    );

    const { data } = await hybridAIService.generateJSON(prompt, {
      systemPrompt: TORP_SYSTEM_PROMPT,
      temperature: 0.5,
    });

    return data;
  }
}

export const torpAnalyzerService = new TorpAnalyzerService();
export default torpAnalyzerService;
