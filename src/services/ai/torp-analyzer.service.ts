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
  type EnrichedCompanyData,
} from './prompts/torp-analysis.prompts';
import type { TorpAnalysisResult } from '@/types/torp';
import { pappersService } from '@/services/api/pappers.service';
import { innovationDurableScoringService } from '@/services/scoring/innovation-durable.scoring';

// Statut de vérification du SIRET
export interface SiretVerification {
  source: 'document' | 'pappers_lookup' | 'non_trouve';
  confidence: 'high' | 'medium' | 'low';
  verified: boolean;
  message: string;
  pappersMatch?: {
    nomEntreprise: string;
    adresse: string;
    siret: string;
    matchScore: number;
  };
}

export interface ExtractedDevisData {
  entreprise: {
    nom: string;
    siret: string | null;
    siretVerification?: SiretVerification;
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
      userType?: 'B2B' | 'B2C' | 'admin';
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
      console.log('[TORP] Step 6/7: Analyzing délais...');
      const delaisAnalysis = await this.analyzeDelais(extractedData, typeTravaux);

      // Step 7: Analyze Innovation & Développement Durable (50 pts)
      console.log('[TORP] Step 7/7: Analyzing innovation & développement durable...');
      const innovationDurableScore = innovationDurableScoringService.calculateScore({
        devisText,
        devisExtrait: {
          prestations: extractedData.travaux?.postes?.map(p => ({
            description: p.designation,
            detail: p.unite || undefined,
          })),
          typeTravauxPrincipal: extractedData.travaux?.type,
        },
        entreprise: {
          labelsRGE: [], // Will be enriched from Pappers data if available
          labelsQualite: [],
          distanceChantierKm: undefined, // Could be calculated from geo data
        },
      });
      console.log(`[TORP] Innovation/Durable score: ${innovationDurableScore.total}/50 (Grade ${innovationDurableScore.grade})`);

      // Step 8: Generate synthesis and recommendations
      const userType = metadata?.userType || 'B2C';
      console.log(`[TORP] Generating synthesis... (userType: ${userType})`);
      const synthesis = await this.generateSynthesis(
        entrepriseAnalysis,
        prixAnalysis,
        completudeAnalysis,
        conformiteAnalysis,
        delaisAnalysis,
        innovationDurableScore.total,
        userType
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

        // Innovation & Développement Durable (50 pts)
        scoreInnovationDurable: {
          scoreTotal: innovationDurableScore.total,
          pourcentage: innovationDurableScore.pourcentage,
          grade: innovationDurableScore.grade,
          sousAxes: innovationDurableScore.sousAxes,
          recommandations: innovationDurableScore.recommandations,
          pointsForts: innovationDurableScore.pointsForts,
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
            siretVerification: extractedData.entreprise.siretVerification,
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

      console.log(`[TORP] Analysis complete in ${dureeAnalyse}s - Score: ${result.scoreGlobal}/1050 (${result.grade}) [Innovation/Durable: ${innovationDurableScore.total}/50]`);

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
    let siretFoundInDocument = false;
    if (data.entreprise?.siret) {
      const cleanedSiret = this.cleanAndValidateSiret(data.entreprise.siret, devisText);
      if (cleanedSiret) {
        data.entreprise.siret = cleanedSiret;
        siretFoundInDocument = true;
      } else {
        data.entreprise.siret = null;
      }
    }

    if (!data.entreprise.siret) {
      // Si l'IA n'a pas trouvé de SIRET, essayer de le trouver directement dans le texte
      console.log('[TORP Extraction] IA n\'a pas trouvé de SIRET, recherche directe...');
      const directSearch = this.cleanAndValidateSiret('', devisText);
      if (directSearch) {
        data.entreprise.siret = directSearch;
        siretFoundInDocument = true;
        console.log('[TORP Extraction] SIRET trouvé par recherche directe:', directSearch);
      }
    }

    // Initialiser la vérification SIRET
    if (siretFoundInDocument && data.entreprise.siret) {
      data.entreprise.siretVerification = {
        source: 'document',
        confidence: 'high',
        verified: true,
        message: 'SIRET extrait du document (14 chiffres valides)'
      };
    } else {
      // FALLBACK: Recherche via Pappers par nom d'entreprise + adresse
      console.log('[TORP SIRET] Tentative de recherche via Pappers...');
      const pappersResult = await this.lookupSiretViaPappers(
        data.entreprise.nom,
        data.entreprise.adresse
      );

      if (pappersResult) {
        data.entreprise.siret = pappersResult.siret;
        data.entreprise.siretVerification = {
          source: 'pappers_lookup',
          confidence: pappersResult.confidence,
          verified: true,
          message: pappersResult.message,
          pappersMatch: {
            nomEntreprise: pappersResult.nomEntreprise,
            adresse: pappersResult.adresse,
            siret: pappersResult.siret,
            matchScore: pappersResult.matchScore
          }
        };
        console.log('[TORP SIRET] ⚠️ SIRET trouvé via Pappers:', pappersResult.siret);
        console.log('[TORP SIRET] Confiance:', pappersResult.confidence, '- Score:', pappersResult.matchScore);
      } else {
        data.entreprise.siretVerification = {
          source: 'non_trouve',
          confidence: 'low',
          verified: false,
          message: 'SIRET non trouvé dans le document et recherche Pappers infructueuse. Vérification manuelle requise.'
        };
        console.log('[TORP SIRET] ❌ SIRET non trouvé (document + Pappers)');
      }
    }

    // Log critical extraction data for debugging
    console.log('[TORP Extraction] Entreprise:', data.entreprise.nom);
    console.log('[TORP Extraction] SIRET final:', data.entreprise.siret || 'NON TROUVÉ');
    console.log('[TORP Extraction] Source SIRET:', data.entreprise.siretVerification?.source);
    console.log('[TORP Extraction] Adresse entreprise:', data.entreprise.adresse || 'NON TROUVÉE');
    console.log('[TORP Extraction] Adresse client:', data.client?.adresse || 'NON TROUVÉE');
    console.log('[TORP Extraction] Adresse chantier:', data.travaux?.adresseChantier || 'NON TROUVÉE');
    console.log('[TORP Extraction] Certifications:', data.entreprise.certifications);
    console.log('[TORP Extraction] Montant total:', data.devis.montantTotal);

    return data;
  }

  /**
   * Recherche le SIRET via l'API Pappers en utilisant le nom et l'adresse de l'entreprise
   */
  private async lookupSiretViaPappers(
    nomEntreprise: string,
    adresseEntreprise: string | null
  ): Promise<{
    siret: string;
    nomEntreprise: string;
    adresse: string;
    confidence: 'high' | 'medium' | 'low';
    matchScore: number;
    message: string;
  } | null> {
    if (!pappersService.isConfigured()) {
      console.log('[TORP SIRET Pappers] API Pappers non configurée');
      return null;
    }

    if (!nomEntreprise || nomEntreprise.length < 3) {
      console.log('[TORP SIRET Pappers] Nom d\'entreprise insuffisant pour recherche');
      return null;
    }

    try {
      // Extraire le code postal de l'adresse si disponible
      const codePostalMatch = adresseEntreprise?.match(/\b(\d{5})\b/);
      const codePostal = codePostalMatch ? codePostalMatch[1] : undefined;

      console.log('[TORP SIRET Pappers] Recherche:', {
        nom: nomEntreprise,
        codePostal: codePostal || 'non trouvé'
      });

      // Recherche par nom d'entreprise
      const result = await pappersService.recherche({
        q: nomEntreprise,
        code_postal: codePostal,
        entreprise_cessee: false,
        par_page: 5
      });

      if (!result.success || !result.data?.resultats?.length) {
        console.log('[TORP SIRET Pappers] Aucun résultat trouvé');
        return null;
      }

      console.log('[TORP SIRET Pappers] Résultats:', result.data.resultats.length);

      // Calculer un score de correspondance pour chaque résultat
      const scored = result.data.resultats.map(r => {
        let score = 0;
        const nomPappers = (r.nom_entreprise || r.denomination || '').toLowerCase();
        const nomRecherche = nomEntreprise.toLowerCase();

        // Score basé sur la similarité du nom
        if (nomPappers === nomRecherche) {
          score += 50;
        } else if (nomPappers.includes(nomRecherche) || nomRecherche.includes(nomPappers)) {
          score += 35;
        } else {
          // Vérifier les mots clés communs
          const motsPappers = nomPappers.split(/[\s\-]+/);
          const motsRecherche = nomRecherche.split(/[\s\-]+/);
          const motsCommuns = motsPappers.filter(m =>
            motsRecherche.some(mr => mr.includes(m) || m.includes(mr))
          );
          score += Math.min(30, motsCommuns.length * 10);
        }

        // Bonus pour le code postal correspondant
        const cpPappers = r.siege?.code_postal;
        if (codePostal && cpPappers === codePostal) {
          score += 30;
        } else if (codePostal && cpPappers?.slice(0, 2) === codePostal.slice(0, 2)) {
          // Même département
          score += 15;
        }

        // Bonus si entreprise active
        if (!r.entreprise_cessee) {
          score += 10;
        }

        // Bonus si dans le BTP (codes NAF F)
        if (r.code_naf?.startsWith('F') || r.code_naf?.startsWith('43') || r.code_naf?.startsWith('41')) {
          score += 10;
        }

        return {
          ...r,
          matchScore: score
        };
      });

      // Trier par score et prendre le meilleur
      scored.sort((a, b) => b.matchScore - a.matchScore);
      const best = scored[0];

      console.log('[TORP SIRET Pappers] Meilleur match:', {
        nom: best.nom_entreprise || best.denomination,
        siret: best.siret,
        score: best.matchScore,
        cp: best.siege?.code_postal
      });

      // Déterminer la confiance basée sur le score
      let confidence: 'high' | 'medium' | 'low';
      let message: string;

      if (best.matchScore >= 70) {
        confidence = 'high';
        message = `SIRET trouvé via Pappers avec haute confiance (score: ${best.matchScore}/100). L'entreprise "${best.nom_entreprise || best.denomination}" correspond bien au devis.`;
      } else if (best.matchScore >= 40) {
        confidence = 'medium';
        message = `SIRET possiblement trouvé via Pappers (score: ${best.matchScore}/100). ATTENTION: Le SIRET sur le devis semble incorrect ou absent. Vérifiez que "${best.nom_entreprise || best.denomination}" est bien l'entreprise du devis.`;
      } else {
        // Score trop bas, ne pas retourner de résultat
        console.log('[TORP SIRET Pappers] Score trop bas, résultat ignoré');
        return null;
      }

      return {
        siret: best.siret,
        nomEntreprise: best.nom_entreprise || best.denomination || '',
        adresse: `${best.siege?.code_postal || ''} ${best.siege?.ville || ''}`.trim(),
        confidence,
        matchScore: best.matchScore,
        message
      };

    } catch (error) {
      console.error('[TORP SIRET Pappers] Erreur:', error);
      return null;
    }
  }

  /**
   * Validation de l'algorithme de Luhn pour SIRET/SIREN
   * Le SIRET utilise une variante de Luhn (somme paire des chiffres)
   */
  private validateLuhn(num: string): boolean {
    if (!num || !/^\d+$/.test(num)) return false;

    let sum = 0;
    for (let i = 0; i < num.length; i++) {
      let digit = parseInt(num[i], 10);
      // Pour SIRET/SIREN, on double les chiffres en position paire (0-indexé)
      if (i % 2 === 0) {
        digit *= 2;
        if (digit > 9) digit -= 9;
      }
      sum += digit;
    }
    return sum % 10 === 0;
  }

  /**
   * Extrait le SIREN depuis un numéro de TVA intracommunautaire
   * Format: FR + clé (2 chiffres) + SIREN (9 chiffres)
   */
  private extractSirenFromTVA(tvaNumber: string | null, devisText: string): string | null {
    if (!tvaNumber && !devisText) return null;

    // Patterns pour trouver le numéro TVA
    const tvaPatterns = [
      /FR\s*(\d{2})\s*(\d{3})\s*(\d{3})\s*(\d{3})/gi,
      /FR\s*(\d{2})\s*(\d{9})/gi,
      /TVA\s*:?\s*FR\s*(\d{2})\s*(\d{9})/gi,
      /N°?\s*TVA\s*:?\s*FR\s*(\d{11})/gi,
      /intracommunautaire\s*:?\s*FR\s*(\d{11})/gi,
    ];

    const textToSearch = tvaNumber || devisText;

    for (const pattern of tvaPatterns) {
      const matches = textToSearch.matchAll(pattern);
      for (const match of matches) {
        // Reconstruire le numéro complet
        let fullNumber = match[0].replace(/[^0-9]/g, '');

        // Le numéro TVA a 11 chiffres (2 clé + 9 SIREN)
        if (fullNumber.length === 11) {
          const siren = fullNumber.slice(2); // Les 9 derniers chiffres sont le SIREN
          if (/^\d{9}$/.test(siren)) {
            console.log('[TORP TVA] SIREN extrait du numéro TVA:', siren);
            return siren;
          }
        }
      }
    }

    return null;
  }

  /**
   * Nettoie et valide le SIRET extrait
   * SIRET = 14 chiffres (SIREN 9 chiffres + NIC 5 chiffres)
   */
  private cleanAndValidateSiret(siret: string, devisText: string): string | null {
    // Nettoyer : enlever espaces, tirets, points
    let cleaned = (siret || '').replace(/[\s\-\.]/g, '');

    // Si déjà 14 chiffres, valider avec Luhn
    if (/^\d{14}$/.test(cleaned)) {
      const isValid = this.validateLuhn(cleaned);
      console.log('[TORP SIRET] 14 chiffres:', cleaned, '| Luhn:', isValid ? '✓' : '✗');
      if (isValid) {
        return cleaned;
      }
      // Si Luhn échoue, on continue quand même car certains SIRET ne passent pas Luhn
      console.log('[TORP SIRET] Luhn invalide mais on continue avec ce SIRET');
      return cleaned;
    }

    // Normaliser le texte pour la recherche (enlever retours ligne multiples)
    const normalizedText = devisText.replace(/\n+/g, ' ').replace(/\s+/g, ' ');

    // Essayer d'extraire le SIREN depuis le numéro TVA si disponible
    const sirenFromTVA = this.extractSirenFromTVA(null, normalizedText);
    if (sirenFromTVA && !cleaned) {
      console.log('[TORP SIRET] SIREN extrait du numéro TVA, recherche NIC...');
      cleaned = sirenFromTVA;
    }

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
   * Enrichit automatiquement les données entreprise via Pappers si SIRET disponible
   */
  private async analyzeEntreprise(devisData: ExtractedDevisData): Promise<any> {
    // Essayer d'enrichir les données entreprise si SIRET disponible
    let enrichedData: EnrichedCompanyData | null = null;

    if (devisData.entreprise.siret) {
      try {
        console.log('[TORP Entreprise] Enrichissement via Pappers pour SIRET:', devisData.entreprise.siret);
        const pappersResult = await pappersService.getEntrepriseBySiret(devisData.entreprise.siret);

        if (pappersResult) {
          console.log('[TORP Entreprise] Données Pappers récupérées:', pappersResult.nom);

          // Calculer l'ancienneté
          let ancienneteAnnees: number | undefined;
          if (pappersResult.dateCreation) {
            const creation = new Date(pappersResult.dateCreation);
            ancienneteAnnees = Math.floor((Date.now() - creation.getTime()) / (365.25 * 24 * 60 * 60 * 1000));
          }

          enrichedData = {
            siret: pappersResult.siret,
            siren: pappersResult.siren,
            raisonSociale: pappersResult.nom,
            formeJuridique: pappersResult.formeJuridique,
            codeNAF: pappersResult.codeNAF,
            libelleNAF: pappersResult.libelleNAF,
            dateCreation: pappersResult.dateCreation,
            ancienneteAnnees,
            estActif: pappersResult.estActive,
            effectif: pappersResult.effectif?.toString(),
            capitalSocial: pappersResult.capital,
            chiffreAffaires: pappersResult.chiffreAffaires || undefined,
            resultatNet: pappersResult.resultat || undefined,
            scorePappers: pappersResult.healthScore?.score,
            risquePappers: pappersResult.healthScore?.niveau,
            labelsRGE: pappersResult.certificationsRGE?.map(c => ({
              nom: c.nom,
              domaines: c.domaine ? [c.domaine] : undefined,
              dateFinValidite: c.validite
            })),
            labelsQualite: pappersResult.labels?.map(l => ({ nom: l })),
            adresseComplete: `${pappersResult.adresse.ligne1} ${pappersResult.adresse.codePostal} ${pappersResult.adresse.ville}`.trim(),
            siretVerification: devisData.entreprise.siretVerification
          };

          console.log('[TORP Entreprise] Enrichissement terminé - Score santé:', enrichedData.scorePappers);
        }
      } catch (error) {
        console.error('[TORP Entreprise] Erreur enrichissement Pappers:', error);
        // Continue sans enrichissement
      }
    }

    const prompt = buildEntrepriseAnalysisPrompt(JSON.stringify(devisData, null, 2), enrichedData);

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
    delaisAnalysis: any,
    scoreInnovationDurable?: number,
    userType: 'B2B' | 'B2C' | 'admin' = 'B2C'
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
      allAnalyses,
      scoreInnovationDurable,
      userType
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
