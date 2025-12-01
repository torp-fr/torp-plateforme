/**
 * Service d'extraction OCR pour les devis professionnels
 * Utilise Google Cloud Vision API pour extraire le texte,
 * puis parse les données avec les patterns définis
 */

import {
  EXTRACTION_PATTERNS,
  parseAmount,
  parseDate,
  cleanText,
  extractLignesPrestation,
} from './patterns';

export interface ExtractedDevisData {
  // Confiance globale extraction
  confidence: number; // 0-1

  // Données entreprise émettrice
  entreprise: {
    siret?: string;
    siren?: string;
    raisonSociale?: string;
    adresse?: string;
    telephone?: string;
    email?: string;
    siteWeb?: string;
    formeJuridique?: string;
    capitalSocial?: string;
    rcs?: string; // Numéro RCS
    tvaIntra?: string; // N° TVA intracommunautaire
  };

  // Assurances mentionnées
  assurances: {
    decennale?: {
      numero?: string;
      assureur?: string;
      validite?: string;
    };
    rcPro?: {
      numero?: string;
      assureur?: string;
    };
  };

  // Informations devis
  devis: {
    numero?: string;
    date?: string;
    validite?: string; // Date de validité
    objet?: string; // Objet/description
  };

  // Client destinataire
  client: {
    nom?: string;
    adresse?: string;
    telephone?: string;
    email?: string;
  };

  // Données financières
  financier: {
    montantHT?: number;
    tauxTVA?: number[]; // Peut y avoir plusieurs taux
    montantTVA?: number;
    montantTTC?: number;
    acompte?: number;
    acomptePourcentage?: number;
    conditionsPaiement?: string;
  };

  // Lignes de prestations
  lignes: Array<{
    designation: string;
    description?: string;
    quantite?: number;
    unite?: string;
    prixUnitaireHT?: number;
    totalLigneHT?: number;
  }>;

  // Mentions légales détectées
  mentionsLegales: {
    droitRetractation?: boolean;
    cgv?: boolean;
    mediateur?: boolean;
    delaiExecution?: string;
    garanties?: string[];
    penalitesRetard?: boolean;
  };

  // Certifications/labels mentionnés
  certifications: string[]; // Ex: ["RGE", "Qualibat", "QualiPAC"]

  // Texte brut (pour analyse complémentaire)
  texteComplet: string;
}

/**
 * Extrait le texte d'un fichier PDF via Google Cloud Vision API
 */
async function extractTextFromPDF(fileUrl: string): Promise<{ text: string; confidence: number }> {
  try {
    // Si le fichier est hébergé sur Supabase, on peut le télécharger
    const response = await fetch(fileUrl);

    if (!response.ok) {
      throw new Error(`Failed to fetch file: ${response.statusText}`);
    }

    const buffer = await response.arrayBuffer();
    const base64 = Buffer.from(buffer).toString('base64');

    // Appeler Google Cloud Vision API
    // NOTE: Nécessite la clé API configurée dans les variables d'environnement
    const visionApiKey = process.env.GOOGLE_CLOUD_VISION_API_KEY;

    if (!visionApiKey) {
      console.warn('Google Cloud Vision API key not configured, using mock extraction');
      return { text: '', confidence: 0 };
    }

    const visionResponse = await fetch(
      `https://vision.googleapis.com/v1/images:annotate?key=${visionApiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          requests: [
            {
              image: { content: base64 },
              features: [{ type: 'DOCUMENT_TEXT_DETECTION' }],
            },
          ],
        }),
      }
    );

    if (!visionResponse.ok) {
      throw new Error(`Vision API error: ${visionResponse.statusText}`);
    }

    const visionData = await visionResponse.json();
    const textAnnotations = visionData.responses?.[0]?.textAnnotations;

    if (!textAnnotations || textAnnotations.length === 0) {
      return { text: '', confidence: 0 };
    }

    // Le premier élément contient le texte complet
    const fullText = textAnnotations[0].description || '';

    // Calculer la confiance moyenne
    const confidence = textAnnotations[0].confidence || 0.8;

    return { text: fullText, confidence };
  } catch (error) {
    console.error('Error extracting text from PDF:', error);
    throw error;
  }
}

/**
 * Parse le texte extrait pour structurer les données
 */
function parseExtractedText(text: string): Omit<ExtractedDevisData, 'confidence' | 'texteComplet'> {
  const data: Omit<ExtractedDevisData, 'confidence' | 'texteComplet'> = {
    entreprise: {},
    assurances: {},
    devis: {},
    client: {},
    financier: {},
    lignes: [],
    mentionsLegales: {},
    certifications: [],
  };

  // ===== ENTREPRISE =====
  const siretMatch = text.match(EXTRACTION_PATTERNS.siret);
  if (siretMatch) {
    data.entreprise.siret = siretMatch[1].replace(/[\s.]/g, '');
    // Extraire SIREN des 9 premiers chiffres
    data.entreprise.siren = data.entreprise.siret.substring(0, 9);
  }

  const tvaIntraMatch = text.match(EXTRACTION_PATTERNS.tvaIntra);
  if (tvaIntraMatch) {
    data.entreprise.tvaIntra = tvaIntraMatch[1].replace(/\s/g, '');
  }

  const rcsMatch = text.match(EXTRACTION_PATTERNS.rcs);
  if (rcsMatch) {
    data.entreprise.rcs = cleanText(rcsMatch[1]);
  }

  const formeJuridiqueMatch = text.match(EXTRACTION_PATTERNS.formeJuridique);
  if (formeJuridiqueMatch) {
    data.entreprise.formeJuridique = formeJuridiqueMatch[1];
  }

  const capitalMatch = text.match(EXTRACTION_PATTERNS.capitalSocial);
  if (capitalMatch) {
    data.entreprise.capitalSocial = cleanText(capitalMatch[1]);
  }

  // Extraire raison sociale (ligne avant SIRET généralement)
  const lines = text.split('\n');
  const siretLineIndex = lines.findIndex((line) => EXTRACTION_PATTERNS.siret.test(line));
  if (siretLineIndex > 0) {
    // Chercher la raison sociale dans les 3 lignes précédentes
    for (let i = Math.max(0, siretLineIndex - 3); i < siretLineIndex; i++) {
      const line = lines[i].trim();
      if (line.length > 5 && line.length < 100 && !line.match(/^[\d\s\-]+$/)) {
        data.entreprise.raisonSociale = cleanText(line);
        break;
      }
    }
  }

  const adresseMatch = text.match(EXTRACTION_PATTERNS.adresse);
  if (adresseMatch) {
    data.entreprise.adresse = cleanText(adresseMatch[1]);
  }

  const telMatch = text.match(EXTRACTION_PATTERNS.telephone);
  if (telMatch) {
    data.entreprise.telephone = telMatch[1];
  }

  const emailMatch = text.match(EXTRACTION_PATTERNS.email);
  if (emailMatch) {
    data.entreprise.email = emailMatch[1];
  }

  const siteWebMatch = text.match(EXTRACTION_PATTERNS.siteWeb);
  if (siteWebMatch) {
    data.entreprise.siteWeb = siteWebMatch[1];
  }

  // ===== ASSURANCES =====
  const decennaleMatch = text.match(EXTRACTION_PATTERNS.decennale);
  if (decennaleMatch) {
    data.assurances.decennale = {
      numero: decennaleMatch[1].trim(),
    };

    // Chercher l'assureur dans les lignes suivantes
    const assureurMatch = text.match(EXTRACTION_PATTERNS.assureur);
    if (assureurMatch) {
      data.assurances.decennale.assureur = cleanText(assureurMatch[1]);
    }
  }

  const rcProMatch = text.match(EXTRACTION_PATTERNS.rcPro);
  if (rcProMatch) {
    data.assurances.rcPro = {
      numero: rcProMatch[1].trim(),
    };
  }

  // ===== DEVIS =====
  const numeroDevisMatch = text.match(EXTRACTION_PATTERNS.numeroDevis);
  if (numeroDevisMatch) {
    data.devis.numero = numeroDevisMatch[1].trim();
  }

  const dateDevisMatch = text.match(EXTRACTION_PATTERNS.dateDevis);
  if (dateDevisMatch) {
    const parsedDate = parseDate(dateDevisMatch[1]);
    data.devis.date = parsedDate ? parsedDate.toISOString().split('T')[0] : dateDevisMatch[1];
  }

  const validiteMatch = text.match(EXTRACTION_PATTERNS.validiteDevis);
  if (validiteMatch) {
    data.devis.validite = validiteMatch[1];
  }

  const objetMatch = text.match(EXTRACTION_PATTERNS.objet);
  if (objetMatch) {
    data.devis.objet = cleanText(objetMatch[1]);
  }

  // ===== CLIENT =====
  const clientNomMatch = text.match(EXTRACTION_PATTERNS.clientNom);
  if (clientNomMatch) {
    data.client.nom = cleanText(clientNomMatch[1]);
  }

  // Chercher l'adresse du client (généralement après son nom)
  const clientNomIndex = text.indexOf(data.client.nom || '');
  if (clientNomIndex > -1) {
    const textAfterClient = text.substring(clientNomIndex);
    const adresseClientMatch = textAfterClient.match(EXTRACTION_PATTERNS.adresse);
    if (adresseClientMatch) {
      data.client.adresse = cleanText(adresseClientMatch[1]);
    }
  }

  // ===== FINANCIER =====
  const montantHTMatch = text.match(EXTRACTION_PATTERNS.montantHT);
  if (montantHTMatch) {
    data.financier.montantHT = parseAmount(montantHTMatch[1]) || undefined;
  }

  const montantTTCMatch = text.match(EXTRACTION_PATTERNS.montantTTC);
  if (montantTTCMatch) {
    data.financier.montantTTC = parseAmount(montantTTCMatch[1]) || undefined;
  }

  const tvaMatch = text.match(EXTRACTION_PATTERNS.tva);
  if (tvaMatch) {
    if (tvaMatch[2]) {
      data.financier.montantTVA = parseAmount(tvaMatch[2]) || undefined;
    }
  }

  // Extraire tous les taux de TVA
  const tauxTVAMatches = Array.from(text.matchAll(EXTRACTION_PATTERNS.tauxTVA));
  if (tauxTVAMatches.length > 0) {
    data.financier.tauxTVA = tauxTVAMatches.map((m) => parseAmount(m[1]) || 0).filter((t) => t > 0);
  }

  const acompteMatch = text.match(EXTRACTION_PATTERNS.acompte);
  if (acompteMatch) {
    const value = parseAmount(acompteMatch[1]);
    if (acompteMatch[0].includes('%')) {
      data.financier.acomptePourcentage = value || undefined;
    } else {
      data.financier.acompte = value || undefined;
    }
  }

  const conditionsPaiementMatch = text.match(EXTRACTION_PATTERNS.conditionsPaiement);
  if (conditionsPaiementMatch) {
    data.financier.conditionsPaiement = cleanText(conditionsPaiementMatch[1]);
  }

  // ===== LIGNES DE PRESTATION =====
  data.lignes = extractLignesPrestation(text);

  // ===== MENTIONS LÉGALES =====
  data.mentionsLegales.droitRetractation = EXTRACTION_PATTERNS.droitRetractation.test(text);
  data.mentionsLegales.cgv = EXTRACTION_PATTERNS.cgv.test(text);
  data.mentionsLegales.mediateur = EXTRACTION_PATTERNS.mediateur.test(text);
  data.mentionsLegales.penalitesRetard = EXTRACTION_PATTERNS.penalitesRetard.test(text);

  const delaiMatch = text.match(EXTRACTION_PATTERNS.delaiExecution);
  if (delaiMatch) {
    data.mentionsLegales.delaiExecution = `${delaiMatch[1]} ${delaiMatch[2]}`;
  }

  // Garanties
  const garanties: string[] = [];
  if (EXTRACTION_PATTERNS.garantieDecennale.test(text)) garanties.push('Garantie décennale');
  if (EXTRACTION_PATTERNS.garantieBiennale.test(text)) garanties.push('Garantie biennale');
  if (EXTRACTION_PATTERNS.garantiePerfectionnement.test(text))
    garanties.push('Garantie de parfait achèvement');
  data.mentionsLegales.garanties = garanties.length > 0 ? garanties : undefined;

  // ===== CERTIFICATIONS =====
  Object.entries(EXTRACTION_PATTERNS.certifications).forEach(([key, pattern]) => {
    if (pattern.test(text)) {
      data.certifications.push(key.toUpperCase());
    }
  });

  return data;
}

/**
 * Fonction principale d'extraction
 */
export async function extractDevisData(fileUrl: string): Promise<ExtractedDevisData> {
  try {
    // 1. Extraire le texte via OCR
    const { text, confidence } = await extractTextFromPDF(fileUrl);

    if (!text) {
      throw new Error('No text extracted from PDF');
    }

    // 2. Parser le texte pour structurer les données
    const parsedData = parseExtractedText(text);

    // 3. Retourner les données complètes
    return {
      ...parsedData,
      confidence,
      texteComplet: text,
    };
  } catch (error) {
    console.error('Error in extractDevisData:', error);
    throw error;
  }
}

/**
 * Version mock pour les tests (sans appeler l'API Vision)
 * Permet de tester le parsing avec du texte brut
 */
export function extractDevisDataMock(text: string): ExtractedDevisData {
  const parsedData = parseExtractedText(text);

  return {
    ...parsedData,
    confidence: 0.95, // Mock confidence
    texteComplet: text,
  };
}
