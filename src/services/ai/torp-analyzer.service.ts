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
    // Log un échantillon du texte OCR pour debug (premiers 1500 caractères - en-tête)
    const headerSample = devisText.slice(0, 1500);
    console.log('[TORP OCR] Échantillon en-tête (SIRET devrait être ici):');
    console.log(headerSample);

    // Chercher proactivement les mentions SIRET dans le texte brut
    const siretMentions = devisText.match(/siret[:\s]*[\d\s\.\-]+/gi);
    console.log('[TORP OCR] Mentions SIRET trouvées dans texte brut:', siretMentions);

    const prompt = buildExtractionPrompt(devisText);

    const { data } = await hybridAIService.generateJSON<ExtractedDevisData>(prompt, {
      systemPrompt: TORP_SYSTEM_PROMPT,
      temperature: 0.2, // Low temperature for accurate extraction
    });

    console.log('[TORP Extraction] SIRET brut retourné par IA:', data.entreprise?.siret);

    // Valider et nettoyer le SIRET
    if (data.entreprise?.siret) {
      data.entreprise.siret = this.cleanAndValidateSiret(data.entreprise.siret, devisText);
    } else {
      // Si l'IA n'a pas trouvé de SIRET, essayer de le trouver directement dans le texte
      console.log('[TORP Extraction] IA n\'a pas trouvé de SIRET, recherche directe...');
      const directSearch = this.cleanAndValidateSiret('', devisText);
      if (directSearch) {
        data.entreprise.siret = directSearch;
        console.log('[TORP Extraction] SIRET trouvé par recherche directe:', directSearch);
      }
    }

    // Log critical extraction data for debugging
    console.log('[TORP Extraction] Entreprise:', data.entreprise.nom);
    console.log('[TORP Extraction] SIRET final:', data.entreprise.siret || 'NON TROUVÉ');
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
    let cleaned = (siret || '').replace(/[\s\-\.]/g, '');

    // Si déjà 14 chiffres, c'est bon
    if (/^\d{14}$/.test(cleaned)) {
      console.log('[TORP SIRET] Valide (14 chiffres):', cleaned);
      return cleaned;
    }

    // Normaliser le texte pour la recherche (enlever retours ligne multiples)
    const normalizedText = devisText.replace(/\n+/g, ' ').replace(/\s+/g, ' ');

    // D'abord chercher tous les SIRET potentiels dans le texte (14 chiffres consécutifs avec séparateurs possibles)
    const findAllSirets = (): string[] => {
      const patterns = [
        // Recherche explicite après "SIRET" avec différents formats
        /siret[:\s]*(\d{3}[\s\.\-]?\d{3}[\s\.\-]?\d{3}[\s\.\-]?\d{2}[\s\.\-]?\d{3})/gi,
        /siret[:\s]*(\d{3}[\s\.\-]?\d{3}[\s\.\-]?\d{3}[\s\.\-]?\d{5})/gi,
        /siret[:\s]*(\d{9}[\s\.\-]?\d{5})/gi,
        /siret[:\s]*(\d{14})/gi,
        // Recherche de 14 chiffres consécutifs (avec espaces possibles)
        /\b(\d{3}[\s]?\d{3}[\s]?\d{3}[\s]?\d{5})\b/g,
        /\b(\d{14})\b/g,
      ];

      const found: string[] = [];
      for (const pattern of patterns) {
        const matches = normalizedText.matchAll(pattern);
        for (const match of matches) {
          const candidate = match[1]?.replace(/[\s\.\-]/g, '');
          if (candidate && /^\d{14}$/.test(candidate) && !found.includes(candidate)) {
            found.push(candidate);
          }
        }
      }
      return found;
    };

    const allSirets = findAllSirets();
    console.log('[TORP SIRET] SIRETs trouvés dans texte:', allSirets);

    // Si aucun SIRET fourni (recherche directe), utiliser le premier trouvé dans le texte
    if (!cleaned && allSirets.length > 0) {
      console.log('[TORP SIRET] Recherche directe - utilisation du premier SIRET trouvé:', allSirets[0]);
      return allSirets[0];
    }

    // Si on a un SIRET partiel, chercher le complet qui commence par les mêmes chiffres
    if (cleaned.length >= 9) {
      const sirenPart = cleaned.slice(0, 9);

      // Chercher parmi les SIRETs complets trouvés
      for (const fullSiret of allSirets) {
        if (fullSiret.startsWith(sirenPart)) {
          console.log('[TORP SIRET] Correspondance trouvée pour SIREN', sirenPart, ':', fullSiret);
          return fullSiret;
        }
      }

      // Chercher le NIC juste après le SIREN dans le texte brut
      const sirenWithNicPattern = new RegExp(
        `${sirenPart.slice(0, 3)}[\\s\\.\\-]?${sirenPart.slice(3, 6)}[\\s\\.\\-]?${sirenPart.slice(6, 9)}[\\s\\.\\-]?(\\d{2}[\\s\\.\\-]?\\d{3}|\\d{5})`,
        'gi'
      );
      const nicMatch = normalizedText.match(sirenWithNicPattern);
      if (nicMatch) {
        const fullSiret = nicMatch[0].replace(/[\s\.\-]/g, '');
        if (/^\d{14}$/.test(fullSiret)) {
          console.log('[TORP SIRET] SIREN + NIC reconstitué:', fullSiret);
          return fullSiret;
        }
      }
    }

    // Si 9 chiffres (SIREN seul), chercher avec patterns alternatifs
    if (/^\d{9}$/.test(cleaned)) {
      console.log('[TORP SIRET] SIREN détecté (9 chiffres), recherche NIC...');

      // Chercher si on trouve ce SIREN suivi de 5 chiffres n'importe où
      const nicSearchPatterns = [
        new RegExp(`${cleaned}[\\s\\.\\-]*(\\d{5})`, 'i'),
        new RegExp(`${cleaned.slice(0, 3)}[\\s\\.\\-]*${cleaned.slice(3, 6)}[\\s\\.\\-]*${cleaned.slice(6, 9)}[\\s\\.\\-]*(\\d{5})`, 'i'),
        new RegExp(`${cleaned.slice(0, 3)}[\\s\\.\\-]*${cleaned.slice(3, 6)}[\\s\\.\\-]*${cleaned.slice(6, 9)}[\\s\\.\\-]*(\\d{2})[\\s\\.\\-]*(\\d{3})`, 'i'),
      ];

      for (const pattern of nicSearchPatterns) {
        const match = normalizedText.match(pattern);
        if (match) {
          const nic = match[2] ? match[1] + match[2] : match[1];
          if (nic && /^\d{5}$/.test(nic.replace(/[\s\.\-]/g, ''))) {
            const fullSiret = cleaned + nic.replace(/[\s\.\-]/g, '');
            console.log('[TORP SIRET] NIC trouvé, SIRET complet:', fullSiret);
            return fullSiret;
          }
        }
      }

      // S'il y a un seul SIRET de 14 chiffres dans le texte, l'utiliser
      if (allSirets.length === 1) {
        console.log('[TORP SIRET] Utilisation du seul SIRET trouvé dans texte:', allSirets[0]);
        return allSirets[0];
      }

      // Fallback: ajouter 00010 (siège social) - mieux que rien
      console.log('[TORP SIRET] NIC non trouvé, utilisation NIC par défaut (00010)');
      return cleaned + '00010';
    }

    // Si entre 10 et 13 chiffres, possiblement mal formaté
    if (/^\d{10,13}$/.test(cleaned)) {
      console.log('[TORP SIRET] Incomplet (' + cleaned.length + ' chiffres):', cleaned, '- recherche élargie...');

      // S'il y a un seul SIRET complet dans le texte, l'utiliser
      if (allSirets.length === 1) {
        console.log('[TORP SIRET] Utilisation du seul SIRET trouvé:', allSirets[0]);
        return allSirets[0];
      }

      // Chercher un SIRET qui contient les premiers 9 chiffres
      const sirenPart = cleaned.slice(0, 9);
      for (const fullSiret of allSirets) {
        if (fullSiret.startsWith(sirenPart)) {
          console.log('[TORP SIRET] Correspondance partielle trouvée:', fullSiret);
          return fullSiret;
        }
      }

      // Dernier essai : essayer de compléter à 14 chiffres en cherchant les chiffres manquants
      const missingDigits = 14 - cleaned.length;
      const searchPattern = new RegExp(
        `${cleaned.slice(0, 3)}[\\s\\.\\-]?${cleaned.slice(3, 6)}[\\s\\.\\-]?${cleaned.slice(6, 9)}[\\s\\.\\-]?` +
        `(\\d{${missingDigits + (cleaned.length - 9)}})`,
        'gi'
      );
      const completionMatch = normalizedText.match(searchPattern);
      if (completionMatch) {
        const potential = cleaned.slice(0, 9) + completionMatch[1];
        if (/^\d{14}$/.test(potential)) {
          console.log('[TORP SIRET] Complété à 14 chiffres:', potential);
          return potential;
        }
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
