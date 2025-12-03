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
  client?: {
    nom: string | null;
    adresse: string | null;
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
    adresseChantier?: string | null;
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

        // Données extraites pour enrichissement et géocodage
        extractedData: {
          entreprise: {
            nom: extractedData.entreprise.nom,
            siret: extractedData.entreprise.siret,
            adresse: extractedData.entreprise.adresse || null,
            telephone: extractedData.entreprise.telephone,
            email: extractedData.entreprise.email,
            certifications: extractedData.entreprise.certifications || [],
          },
          client: extractedData.client ? {
            nom: extractedData.client.nom || null,
            adresse: extractedData.client.adresse || null,
          } : undefined,
          travaux: {
            type: extractedData.travaux.type,
            adresseChantier: extractedData.travaux.adresseChantier || extractedData.client?.adresse || null,
          },
          devis: {
            montantTotal: extractedData.devis.montantTotal,
            montantHT: extractedData.devis.montantHT,
          },
        },

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

    // Valider et nettoyer le SIRET
    if (data.entreprise?.siret) {
      data.entreprise.siret = this.cleanAndValidateSiret(data.entreprise.siret, devisText);
    }

    // Log critical extraction data for debugging
    console.log('[TORP Extraction] Entreprise:', data.entreprise.nom);
    console.log('[TORP Extraction] SIRET extrait:', data.entreprise.siret || 'NON TROUVÉ');
    console.log('[TORP Extraction] Adresse entreprise:', data.entreprise.adresse || 'NON TROUVÉE');
    console.log('[TORP Extraction] Adresse client:', data.client?.adresse || 'NON TROUVÉE');
    console.log('[TORP Extraction] Adresse chantier:', data.travaux?.adresseChantier || 'NON TROUVÉE');
    console.log('[TORP Extraction] Certifications:', data.entreprise.certifications);
    console.log('[TORP Extraction] Montant total:', data.devis.montantTotal);

    return data;
  }

  /**
   * Nettoie et valide le SIRET extrait
   * SIRET = 14 chiffres (SIREN 9 chiffres + NIC 5 chiffres)
   */
  private cleanAndValidateSiret(siret: string, devisText: string): string | null {
    // Nettoyer : enlever espaces, tirets, points
    let cleaned = siret.replace(/[\s\-\.]/g, '');

    // Si déjà 14 chiffres, c'est bon
    if (/^\d{14}$/.test(cleaned)) {
      console.log('[TORP SIRET] Valide (14 chiffres):', cleaned);
      return cleaned;
    }

    // Si 9 chiffres (SIREN), chercher le NIC dans le texte
    if (/^\d{9}$/.test(cleaned)) {
      console.log('[TORP SIRET] SIREN détecté (9 chiffres), recherche NIC...');
      // Chercher le SIRET complet dans le texte avec différents formats
      const siretPatterns = [
        new RegExp(`${cleaned}\\s*(\\d{5})`, 'i'),
        new RegExp(`${cleaned.slice(0, 3)}\\s*${cleaned.slice(3, 6)}\\s*${cleaned.slice(6, 9)}\\s*(\\d{5})`, 'i'),
        /siret[:\s]*(\d{3}\s*\d{3}\s*\d{3}\s*\d{5})/i,
        /siret[:\s]*(\d{14})/i,
      ];

      for (const pattern of siretPatterns) {
        const match = devisText.match(pattern);
        if (match) {
          const fullSiret = match[1] ? cleaned + match[1].replace(/\s/g, '') : match[0]?.replace(/[^\d]/g, '');
          if (fullSiret && /^\d{14}$/.test(fullSiret)) {
            console.log('[TORP SIRET] Complet trouvé:', fullSiret);
            return fullSiret;
          }
        }
      }

      // Fallback: ajouter 00010 (siège social) - mieux que rien
      console.log('[TORP SIRET] NIC non trouvé, utilisation NIC par défaut (00010)');
      return cleaned + '00010';
    }

    // Si entre 10 et 13 chiffres, possiblement mal formaté
    if (/^\d{10,13}$/.test(cleaned)) {
      console.log('[TORP SIRET] Incomplet:', cleaned, '- recherche dans texte...');

      // Chercher un SIRET complet dans le texte source
      const fullSiretMatch = devisText.match(/siret[:\s]*(\d{3}[\s\.]?\d{3}[\s\.]?\d{3}[\s\.]?\d{5})/i);
      if (fullSiretMatch) {
        const fullSiret = fullSiretMatch[1].replace(/[\s\.]/g, '');
        if (/^\d{14}$/.test(fullSiret)) {
          console.log('[TORP SIRET] Complet trouvé dans texte:', fullSiret);
          return fullSiret;
        }
      }

      // Chercher tout numéro de 14 chiffres qui commence par les mêmes chiffres
      const partialMatch = devisText.match(new RegExp(`${cleaned.slice(0, 9)}\\d{5}`, 'g'));
      if (partialMatch && partialMatch.length === 1) {
        console.log('[TORP SIRET] Probable trouvé:', partialMatch[0]);
        return partialMatch[0];
      }
    }

    console.log('[TORP SIRET] Invalide, impossible de corriger:', siret);
    return null;
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
