/**
 * RAG Orchestrator - Retrieval-Augmented Generation pour l'analyse de devis
 *
 * Architecture:
 * 1. Extraction intelligente des entités du devis
 * 2. Requêtes parallèles vers les sources de données
 * 3. Agrégation et scoring des données
 * 4. Génération de contexte enrichi pour l'IA
 */

import {
  searchEntreprise,
  getRGECertifications,
  getBODACCAnnonces,
  getQualibatCertification,
  getQualifelecCertification,
  getURSSAFAttestation,
  getDGFIPAttestation,
  getIndicesBTP,
  type APIEntrepriseConfig
} from './api-clients.ts';
import { callClaude } from './ai-client.ts';
import {
  searchKnowledgeForDevis,
  generateKnowledgeContext,
  identifyApplicableDTU,
  type KnowledgeSearchResult
} from './knowledge-search.ts';
import {
  createCompanySearchService,
  type CompanyDataResult
} from './company-search.service.ts';
import {
  extractCompanyInfo,
  type SiretExtractionResult
} from './siret-extractor.ts';

// ============================================
// TYPES & INTERFACES
// ============================================

export interface DevisExtractedData {
  // Identité entreprise
  entreprise: {
    nom?: string;
    siret?: string;
    siren?: string;
    adresse?: string;
    telephone?: string;
    email?: string;
  };
  // Travaux
  travaux: {
    type: string;
    description: string;
    quantite?: number;
    unite?: string;
    prixUnitaire?: number;
    prixTotal?: number;
    categorie?: string;
  }[];
  // Montants
  montants: {
    ht: number;
    tva: number;
    ttc: number;
    acompte?: number;
  };
  // Métadonnées
  dateDevis?: string;
  validite?: string;
  delaiTravaux?: string;
  garanties?: string[];
}

export interface RAGContext {
  // Données entreprise enrichies (avec cache intelligent)
  entreprise: {
    identite: any;
    certifications: {
      rge: any[];
      qualibat?: any;
      qualifelec?: any;
    };
    conformite: {
      urssaf?: any;
      dgfip?: any;
    };
    annoncesLegales: any[];
    score: number;
    alertes: string[];
    // Métadonnées du cache
    cached?: boolean;
    cacheAge?: number;
    dataSource?: string;
    qualityScore?: number;
    dataCompleteness?: number;
    riskLevel?: 'low' | 'medium' | 'high' | 'critical';
  };
  // Référentiels prix
  prixMarche: {
    references: any[];
    indicesBTP: any;
    comparaison: {
      poste: string;
      prixDevis: number;
      prixMarcheMin: number;
      prixMarcheMax: number;
      prixMarcheAvg: number;
      ecart: number;
      analyse: string;
    }[];
  };
  // Aides et réglementations
  aides: {
    eligibles: any[];
    montantEstime: number;
    conditions: string[];
  };
  reglementations: {
    applicables: any[];
    conformite: string[];
    alertes: string[];
  };
  // Base de connaissances (DTU, normes, guides)
  knowledgeBase?: {
    dtu: KnowledgeSearchResult[];
    normes: KnowledgeSearchResult[];
    guides: KnowledgeSearchResult[];
    dtuApplicables: string[];
  };
  // Métadonnées RAG
  sources: string[];
  fiabilite: number;
  timestamp: string;
}

export interface RAGQuery {
  devisText: string;
  extractedData?: DevisExtractedData;
  options?: {
    includeAllAPIs?: boolean;
    maxParallelRequests?: number;
    timeout?: number;
  };
}

// ============================================
// BASE DE CONNAISSANCES MÉTIER
// ============================================

const KNOWLEDGE_BASE = {
  // Catégories de travaux et indices BTP associés
  categoriesIndices: {
    'isolation': ['BT38'],
    'chauffage': ['BT41'],
    'plomberie': ['BT40'],
    'electricite': ['BT43'],
    'menuiserie': ['BT16', 'BT19'],
    'maconnerie': ['BT03'],
    'couverture': ['BT26'],
    'platerie': ['BT30'],
    'peinture': ['BT46'],
    'carrelage': ['BT52'],
    'charpente': ['BT07'],
    'ventilation': ['BT42'],
    'terrassement': ['BT02']
  },

  // Mots-clés pour détection automatique de catégorie
  keywords: {
    'isolation': ['isolation', 'laine', 'polystyrène', 'ite', 'iti', 'combles', 'thermique', 'r='],
    'chauffage': ['pompe à chaleur', 'pac', 'chaudière', 'radiateur', 'plancher chauffant', 'poêle', 'granulés'],
    'plomberie': ['plomberie', 'sanitaire', 'wc', 'douche', 'baignoire', 'lavabo', 'robinet', 'chauffe-eau'],
    'electricite': ['électricité', 'tableau', 'câblage', 'prise', 'interrupteur', 'éclairage', 'led'],
    'menuiserie': ['fenêtre', 'porte', 'volet', 'pvc', 'aluminium', 'bois', 'double vitrage', 'triple vitrage'],
    'ventilation': ['vmc', 'ventilation', 'aération', 'extraction', 'simple flux', 'double flux'],
    'toiture': ['toiture', 'couverture', 'tuile', 'ardoise', 'étanchéité', 'zinguerie', 'gouttière'],
    'solaire': ['photovoltaïque', 'panneau solaire', 'onduleur', 'kwc', 'autoconsommation']
  },

  // Certifications requises par type de travaux
  certificationsRequises: {
    'isolation': ['RGE - Isolation des murs', 'RGE - Isolation des combles', 'RGE - Isolation des planchers'],
    'chauffage': ['RGE - Pompes à chaleur', 'RGE - Chaudières', 'Qualibat'],
    'electricite': ['Qualifelec'],
    'solaire': ['RGE - QualiPV', 'RGE - QualiSol'],
    'ventilation': ['RGE - Ventilation']
  },

  // Aides par type de travaux
  aidesParTravaux: {
    'isolation': ['MaPrimeRénov', 'CEE', 'Éco-PTZ', 'TVA 5.5%'],
    'chauffage': ['MaPrimeRénov', 'CEE', 'Éco-PTZ', 'TVA 5.5%', 'Coup de pouce chauffage'],
    'menuiserie': ['MaPrimeRénov', 'CEE', 'Éco-PTZ', 'TVA 5.5%'],
    'ventilation': ['MaPrimeRénov', 'CEE', 'Éco-PTZ', 'TVA 5.5%'],
    'solaire': ['MaPrimeRénov', 'Prime autoconsommation', 'TVA 10%']
  }
};

// ============================================
// FONCTIONS D'EXTRACTION
// ============================================

export async function extractDevisData(
  devisText: string,
  claudeApiKey: string
): Promise<DevisExtractedData> {
  const extractionPrompt = `Analyse ce devis et extrait les informations structurées.

DEVIS:
${devisText}

Retourne un JSON avec cette structure exacte:
{
  "entreprise": {
    "nom": "nom de l'entreprise",
    "siret": "numéro SIRET si présent (14 chiffres)",
    "siren": "numéro SIREN si présent (9 chiffres)",
    "adresse": "adresse complète",
    "telephone": "téléphone",
    "email": "email"
  },
  "travaux": [
    {
      "type": "type de travaux (isolation, chauffage, etc.)",
      "description": "description détaillée",
      "quantite": nombre,
      "unite": "m², unité, ml, etc.",
      "prixUnitaire": prix_unitaire_ht,
      "prixTotal": prix_total_ht,
      "categorie": "catégorie principale"
    }
  ],
  "montants": {
    "ht": montant_total_ht,
    "tva": montant_tva,
    "ttc": montant_ttc,
    "acompte": montant_acompte_si_present
  },
  "dateDevis": "date du devis",
  "validite": "durée de validité",
  "delaiTravaux": "délai d'exécution",
  "garanties": ["liste des garanties mentionnées"]
}`;

  const response = await callClaude(
    extractionPrompt,
    'Tu es un expert en analyse de devis du bâtiment. Extrait les données avec précision. Retourne uniquement du JSON valide.',
    claudeApiKey
  );

  if (response.success && response.data) {
    return response.data as DevisExtractedData;
  }

  throw new Error('Échec extraction données devis');
}

function detectCategories(travaux: DevisExtractedData['travaux']): string[] {
  const categories = new Set<string>();

  travaux.forEach(t => {
    const text = `${t.type} ${t.description}`.toLowerCase();

    for (const [category, keywords] of Object.entries(KNOWLEDGE_BASE.keywords)) {
      if (keywords.some(kw => text.includes(kw))) {
        categories.add(category);
      }
    }

    if (t.categorie) {
      categories.add(t.categorie.toLowerCase());
    }
  });

  return Array.from(categories);
}

// ============================================
// ORCHESTRATEUR RAG PRINCIPAL
// ============================================

export async function orchestrateRAG(query: RAGQuery): Promise<RAGContext> {
  const startTime = Date.now();
  const sources: string[] = [];
  const context: Partial<RAGContext> = {
    sources: [],
    timestamp: new Date().toISOString()
  };

  // 1. Extraction des données si non fournies
  let extractedData = query.extractedData;
  if (!extractedData) {
    const claudeApiKey = Deno.env.get('CLAUDE_API_KEY');
    if (claudeApiKey) {
      try {
        extractedData = await extractDevisData(query.devisText, claudeApiKey);
        sources.push('Extraction IA (Claude)');
      } catch (e) {
        console.error('Extraction failed:', e);
      }
    }
  }

  if (!extractedData) {
    throw new Error('Impossible d\'extraire les données du devis');
  }

  // 2. Détection des catégories de travaux
  const categories = detectCategories(extractedData.travaux);

  // 3. Extraction SIRET/SIREN si non fourni (nouveau service)
  let siretExtraction: SiretExtractionResult | null = null;
  if (!extractedData.entreprise.siret) {
    const claudeApiKey = Deno.env.get('CLAUDE_API_KEY');
    try {
      siretExtraction = await extractCompanyInfo(query.devisText, claudeApiKey);
      if (siretExtraction.success) {
        extractedData.entreprise.siret = siretExtraction.siret;
        extractedData.entreprise.siren = siretExtraction.siren;
        extractedData.entreprise.nom = extractedData.entreprise.nom || siretExtraction.companyName;
        sources.push('Extraction SIRET intelligente');
      }
    } catch (e) {
      console.error('SIRET extraction failed:', e);
    }
  }

  // 4. Recherche entreprise avec cache intelligent (nouveau service)
  let companyData: CompanyDataResult | null = null;
  if (extractedData.entreprise.siret || extractedData.entreprise.nom) {
    try {
      const companySearchService = createCompanySearchService();
      companyData = await companySearchService.searchCompany({
        siret: extractedData.entreprise.siret,
        siren: extractedData.entreprise.siren,
        companyName: extractedData.entreprise.nom,
        usePappers: true,
        includeFinances: true,
        includeRepresentants: true,
        includeProcedures: true,
      });

      if (companyData.success) {
        if (companyData.cached) {
          sources.push(`Cache entreprise (${companyData.cacheAge}j)`);
        } else {
          sources.push(`API: ${companyData.dataSource}`);
        }
      }
    } catch (e) {
      console.error('Company search failed:', e);
    }
  }

  // 5. Requêtes parallèles vers les sources de données complémentaires
  const promises: Promise<any>[] = [];
  const promiseLabels: string[] = [];

  // 5.1 Indices BTP
  promises.push(getIndicesBTP().catch(() => null));
  promiseLabels.push('indices');

  // Exécution parallèle
  const results = await Promise.all(promises);

  // 6. Agrégation des résultats
  const resultMap: Record<string, any> = {};
  promiseLabels.forEach((label, i) => {
    resultMap[label] = results[i];
    if (results[i]) {
      sources.push(getLabelSource(label));
    }
  });

  // 7. Construction du contexte entreprise (avec données du cache)
  const cachedCompanyData = companyData?.data || {};
  const rgeData = cachedCompanyData.rge_certifications ||
                  cachedCompanyData.recherche_entreprises?.siege?.liste_rge || [];
  const bodaccData = cachedCompanyData.bodacc_annonces || [];

  context.entreprise = {
    identite: companyData?.success
      ? {
          ...extractedData.entreprise,
          ...cachedCompanyData.recherche_entreprises,
          ...cachedCompanyData,
          siret: companyData.siret,
          siren: companyData.siren,
          nom: companyData.companyName,
          legal_name: companyData.legalName,
        }
      : extractedData.entreprise,
    certifications: {
      rge: Array.isArray(rgeData) ? rgeData : [],
      qualibat: cachedCompanyData.qualibat || null,
      qualifelec: cachedCompanyData.qualifelec || null
    },
    conformite: {
      urssaf: null,
      dgfip: null
    },
    annoncesLegales: bodaccData,
    score: 0,
    alertes: [],
    // Métadonnées du cache
    cached: companyData?.cached,
    cacheAge: companyData?.cacheAge,
    dataSource: companyData?.dataSource,
    qualityScore: companyData?.qualityScore,
    dataCompleteness: companyData?.dataCompleteness,
    riskLevel: companyData?.riskLevel,
  };

  // 8. Calcul du score entreprise (enrichi avec les données du cache)
  context.entreprise.score = calculateEnterpriseScore(context.entreprise, categories);

  // 9. Génération des alertes (incluant celles du cache)
  context.entreprise.alertes = [
    ...(companyData?.alerts || []),
    ...generateEnterpriseAlerts(context.entreprise, categories)
  ];

  // 10. Construction du contexte prix
  const indicesData = resultMap['indices'];
  context.prixMarche = {
    references: [],
    indicesBTP: indicesData,
    comparaison: compareWithMarketPrices(extractedData.travaux, categories)
  };

  // 11. Construction du contexte aides
  context.aides = {
    eligibles: getEligibleAids(categories),
    montantEstime: estimateAidsAmount(extractedData.montants.ttc, categories),
    conditions: getAidsConditions(categories)
  };

  // 12. Construction du contexte réglementations
  context.reglementations = {
    applicables: getApplicableRegulations(categories),
    conformite: checkRegulationsCompliance(extractedData, context.entreprise),
    alertes: []
  };

  // 13. Recherche dans la base de connaissances (DTU, normes, guides)
  try {
    const { createClient } = await import('https://esm.sh/@supabase/supabase-js@2');
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (supabaseUrl && supabaseKey) {
      const supabase = createClient(supabaseUrl, supabaseKey);
      const travaux = extractedData.travaux.map(t => ({
        type: t.type,
        description: t.description
      }));

      const knowledgeResults = await searchKnowledgeForDevis(supabase, travaux);
      const dtuApplicables = identifyApplicableDTU(categories);

      context.knowledgeBase = {
        ...knowledgeResults,
        dtuApplicables
      };

      if (knowledgeResults.dtu.length > 0 || knowledgeResults.normes.length > 0) {
        sources.push('Base de connaissances (DTU/Normes)');
      }
    }
  } catch (kbError) {
    console.error('Knowledge base search failed:', kbError);
  }

  // 10. Calcul de la fiabilité globale
  context.fiabilite = calculateReliability(sources, context as RAGContext);
  context.sources = sources;

  return context as RAGContext;
}

// ============================================
// FONCTIONS AUXILIAIRES
// ============================================

function getLabelSource(label: string): string {
  const sourceMap: Record<string, string> = {
    'entreprise': 'API Recherche Entreprises (gouv.fr)',
    'rge': 'ADEME - Liste RGE',
    'bodacc': 'BODACC - Annonces légales',
    'indices': 'INSEE - Indices BTP',
    'qualibat': 'Qualibat (API Entreprise)',
    'qualifelec': 'Qualifelec (API Entreprise)',
    'urssaf': 'URSSAF (API Entreprise)',
    'dgfip': 'DGFIP (API Entreprise)'
  };
  return sourceMap[label] || label;
}

function calculateEnterpriseScore(entreprise: any, categories: string[]): number {
  let score = 0;

  // Ancienneté (max 25)
  if (entreprise.identite?.date_creation) {
    const years = new Date().getFullYear() -
      new Date(entreprise.identite.date_creation).getFullYear();
    score += Math.min(25, years * 2.5);
  }

  // Certifications RGE (max 35)
  if (entreprise.certifications?.rge?.length > 0) {
    score += 20;
    // Bonus si certifications correspondent aux travaux
    const requiredCerts = categories.flatMap(c =>
      KNOWLEDGE_BASE.certificationsRequises[c as keyof typeof KNOWLEDGE_BASE.certificationsRequises] || []
    );
    const hasCerts = entreprise.certifications.rge.some((cert: any) =>
      requiredCerts.some(req => cert.nom_qualification?.toLowerCase().includes(req.toLowerCase()))
    );
    if (hasCerts) score += 15;
  }

  // État administratif (max 15)
  if (entreprise.identite?.etat_administratif === 'A') {
    score += 10;
  }

  // Pas de procédure collective (max 10)
  const hasProblems = entreprise.annoncesLegales?.some((a: any) =>
    ['liquidation', 'redressement', 'sauvegarde'].some(kw =>
      (a.type || a.typeavis || '').toLowerCase().includes(kw)
    )
  );
  if (!hasProblems) score += 10;

  // Conformité (max 15)
  if (entreprise.conformite?.urssaf?.valide) score += 7;
  if (entreprise.conformite?.dgfip?.valide) score += 8;

  return Math.round(score);
}

function generateEnterpriseAlerts(entreprise: any, categories: string[]): string[] {
  const alertes: string[] = [];

  // État administratif
  if (entreprise.identite?.etat_administratif !== 'A') {
    alertes.push('CRITIQUE: Entreprise non active');
  }

  // Certifications RGE
  if (!entreprise.certifications?.rge?.length) {
    alertes.push('ATTENTION: Aucune certification RGE - Éligibilité aides compromise');
  } else {
    // Vérifier les certifications par rapport aux travaux
    const requiredCerts = categories.flatMap(c =>
      KNOWLEDGE_BASE.certificationsRequises[c as keyof typeof KNOWLEDGE_BASE.certificationsRequises] || []
    );

    if (requiredCerts.length > 0) {
      const hasCerts = entreprise.certifications.rge.some((cert: any) =>
        requiredCerts.some(req =>
          cert.nom_qualification?.toLowerCase().includes(req.toLowerCase().split(' - ')[1] || '')
        )
      );
      if (!hasCerts) {
        alertes.push(`INFO: Vérifier certification RGE pour ${categories.join(', ')}`);
      }
    }

    // Vérifier expiration
    entreprise.certifications.rge.forEach((cert: any) => {
      if (cert.date_fin) {
        const expDate = new Date(cert.date_fin);
        const daysLeft = (expDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24);
        if (daysLeft < 0) {
          alertes.push(`ATTENTION: Certification "${cert.nom_qualification}" expirée`);
        } else if (daysLeft < 60) {
          alertes.push(`INFO: Certification "${cert.nom_qualification}" expire dans ${Math.round(daysLeft)} jours`);
        }
      }
    });
  }

  // Procédures collectives
  const problems = entreprise.annoncesLegales?.filter((a: any) =>
    ['liquidation', 'redressement', 'sauvegarde'].some(kw =>
      (a.type || a.typeavis || '').toLowerCase().includes(kw)
    )
  );
  if (problems?.length > 0) {
    alertes.push(`CRITIQUE: Procédure collective détectée (${problems[0].type || problems[0].typeavis})`);
  }

  return alertes;
}

// Prix de référence par catégorie (simplifié)
const MARKET_PRICES: Record<string, { min: number; max: number; avg: number; unit: string }[]> = {
  'isolation': [
    { min: 20, max: 40, avg: 30, unit: 'm²' },   // Combles
    { min: 40, max: 80, avg: 60, unit: 'm²' },   // ITI
    { min: 100, max: 200, avg: 150, unit: 'm²' } // ITE
  ],
  'chauffage': [
    { min: 8000, max: 18000, avg: 12000, unit: 'unité' }, // PAC air/eau
    { min: 3000, max: 8000, avg: 5000, unit: 'unité' }    // PAC air/air
  ],
  'menuiserie': [
    { min: 300, max: 800, avg: 500, unit: 'unité' },  // Fenêtre PVC
    { min: 500, max: 1200, avg: 800, unit: 'unité' }  // Fenêtre alu
  ]
};

function compareWithMarketPrices(travaux: DevisExtractedData['travaux'], categories: string[]): any[] {
  return travaux.map(t => {
    const cat = t.categorie?.toLowerCase() || categories[0] || 'autre';
    const refs = MARKET_PRICES[cat] || [];

    if (refs.length === 0 || !t.prixUnitaire) {
      return {
        poste: t.description,
        prixDevis: t.prixTotal || 0,
        prixMarcheMin: 0,
        prixMarcheMax: 0,
        prixMarcheAvg: 0,
        ecart: 0,
        analyse: 'Non comparable'
      };
    }

    // Trouver la référence la plus proche
    const ref = refs[0]; // Simplification
    const ecart = ((t.prixUnitaire - ref.avg) / ref.avg) * 100;

    let analyse: string;
    if (t.prixUnitaire < ref.min * 0.8) {
      analyse = 'Prix très bas - Vérifier qualité/prestations';
    } else if (t.prixUnitaire < ref.min) {
      analyse = 'Prix attractif';
    } else if (t.prixUnitaire > ref.max * 1.2) {
      analyse = 'Prix élevé - Négociation recommandée';
    } else if (t.prixUnitaire > ref.max) {
      analyse = 'Prix légèrement élevé';
    } else {
      analyse = 'Prix conforme au marché';
    }

    return {
      poste: t.description,
      prixDevis: t.prixUnitaire,
      prixMarcheMin: ref.min,
      prixMarcheMax: ref.max,
      prixMarcheAvg: ref.avg,
      ecart: Math.round(ecart),
      analyse
    };
  });
}

function getEligibleAids(categories: string[]): any[] {
  const aids = new Set<string>();
  categories.forEach(cat => {
    const catAids = KNOWLEDGE_BASE.aidesParTravaux[cat as keyof typeof KNOWLEDGE_BASE.aidesParTravaux];
    catAids?.forEach(a => aids.add(a));
  });
  return Array.from(aids).map(name => ({ name, applicable: true }));
}

function estimateAidsAmount(ttc: number, categories: string[]): number {
  // Estimation simplifiée
  // MaPrimeRénov: 15-40% selon revenus
  // CEE: 10-15%
  // TVA réduite: économie d'environ 15%
  const baseRate = 0.25; // 25% en moyenne
  return Math.round(ttc * baseRate);
}

function getAidsConditions(categories: string[]): string[] {
  const conditions = new Set<string>();
  conditions.add('Artisan RGE obligatoire');
  conditions.add('Logement > 15 ans');
  conditions.add('Résidence principale');

  if (categories.includes('chauffage')) {
    conditions.add('Remplacement système existant');
  }
  if (categories.includes('isolation')) {
    conditions.add('R minimal selon zone climatique');
  }

  return Array.from(conditions);
}

function getApplicableRegulations(categories: string[]): any[] {
  const regs = [
    { code: 'RGE', name: 'Reconnu Garant Environnement', obligatoire: true }
  ];

  if (categories.includes('electricite')) {
    regs.push({ code: 'NFC15-100', name: 'Norme électrique', obligatoire: true });
  }
  if (categories.includes('chauffage') || categories.includes('isolation')) {
    regs.push({ code: 'RT2012/RE2020', name: 'Réglementation thermique', obligatoire: true });
  }

  return regs;
}

function checkRegulationsCompliance(
  extractedData: DevisExtractedData,
  entreprise: any
): string[] {
  const conformite: string[] = [];

  // RGE
  if (entreprise.certifications?.rge?.length > 0) {
    conformite.push('✓ Entreprise certifiée RGE');
  } else {
    conformite.push('✗ Certification RGE non vérifiée');
  }

  // Mentions obligatoires devis
  if (extractedData.dateDevis) {
    conformite.push('✓ Date du devis présente');
  }
  if (extractedData.validite) {
    conformite.push('✓ Durée de validité mentionnée');
  }
  if (extractedData.entreprise.siret) {
    conformite.push('✓ SIRET mentionné');
  }

  return conformite;
}

function calculateReliability(sources: string[], context: RAGContext): number {
  let reliability = 50; // Base

  // Sources officielles
  if (sources.includes('API Recherche Entreprises (gouv.fr)')) reliability += 15;
  if (sources.includes('ADEME - Liste RGE')) reliability += 15;
  if (sources.includes('BODACC - Annonces légales')) reliability += 10;
  if (sources.includes('INSEE - Indices BTP')) reliability += 5;
  if (sources.includes('Base de connaissances (DTU/Normes)')) reliability += 10;

  // Données entreprise complètes
  if (context.entreprise?.identite?.siren) reliability += 5;

  return Math.min(100, reliability);
}

// ============================================
// EXPORT POUR GÉNÉRATION PROMPT IA
// ============================================

export function generateAIPromptFromRAG(context: RAGContext, devisText: string): string {
  return `# CONTEXTE ENRICHI PAR RAG

## DONNÉES ENTREPRISE
- Nom: ${context.entreprise?.identite?.nom_complet || context.entreprise?.identite?.nom || 'Non identifié'}
- SIRET: ${context.entreprise?.identite?.siret || 'Non trouvé'}
- État: ${context.entreprise?.identite?.etat_administratif === 'A' ? 'Active' : 'Attention'}
- Score confiance: ${context.entreprise?.score}/100

### Certifications RGE
${context.entreprise?.certifications?.rge?.map((c: any) =>
    `- ${c.nom_qualification} (${c.organisme}) - Expire: ${c.date_fin}`
  ).join('\n') || 'Aucune certification trouvée'}

### Alertes
${context.entreprise?.alertes?.join('\n') || 'Aucune alerte'}

## ANALYSE PRIX
### Comparaison marché
${context.prixMarche?.comparaison?.map(c =>
    `- ${c.poste}: ${c.prixDevis}€ vs marché ${c.prixMarcheMin}-${c.prixMarcheMax}€ → ${c.analyse} (${c.ecart > 0 ? '+' : ''}${c.ecart}%)`
  ).join('\n') || 'Non analysé'}

## AIDES POTENTIELLES
${context.aides?.eligibles?.map(a => `- ${a.name}`).join('\n') || 'Aucune aide identifiée'}
Estimation: ${context.aides?.montantEstime}€

### Conditions
${context.aides?.conditions?.join('\n') || 'N/A'}

## CONFORMITÉ RÉGLEMENTAIRE
${context.reglementations?.conformite?.join('\n') || 'Non vérifié'}

${context.knowledgeBase ? `## RÉFÉRENCES TECHNIQUES (Base de connaissances)

### DTU Applicables
${context.knowledgeBase.dtuApplicables?.join(', ') || 'Non identifiés'}

### DTU Pertinents
${context.knowledgeBase.dtu?.slice(0, 3).map(d =>
    `- **${d.codeReference || d.title}** (${Math.round(d.similarity * 100)}%): ${d.content.substring(0, 200)}...`
  ).join('\n') || 'Aucun'}

### Normes
${context.knowledgeBase.normes?.slice(0, 3).map(n =>
    `- **${n.codeReference || n.title}** (${Math.round(n.similarity * 100)}%): ${n.content.substring(0, 200)}...`
  ).join('\n') || 'Aucune'}

### Guides et bonnes pratiques
${context.knowledgeBase.guides?.slice(0, 2).map(g =>
    `- **${g.title}**: ${g.content.substring(0, 150)}...`
  ).join('\n') || 'Aucun'}
` : ''}
---
FIABILITÉ DONNÉES: ${context.fiabilite}%
SOURCES: ${context.sources?.join(', ')}

---
# DEVIS À ANALYSER
${devisText}`;
}
