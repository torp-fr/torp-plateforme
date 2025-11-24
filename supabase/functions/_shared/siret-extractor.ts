/**
 * SIRET Extractor Service
 * Extracts SIRET, SIREN, and company name from devis text
 * Uses regex patterns + AI fallback for robust extraction
 */

import { callClaude } from './ai-client.ts';

export interface SiretExtractionResult {
  success: boolean;
  siret?: string;
  siren?: string;
  companyName?: string;
  legalName?: string;
  address?: string;
  extractionMethod: 'regex' | 'ai' | 'hybrid' | 'failed';
  confidence: number; // 0-100
  errors?: string[];
}

/**
 * Validates SIRET format (14 digits)
 */
export function isValidSiret(siret: string): boolean {
  if (!siret || typeof siret !== 'string') return false;

  // Remove spaces and dashes
  const cleaned = siret.replace(/[\s-]/g, '');

  // Must be exactly 14 digits
  if (!/^\d{14}$/.test(cleaned)) return false;

  // Luhn algorithm validation
  return validateLuhnAlgorithm(cleaned);
}

/**
 * Validates SIREN format (9 digits)
 */
export function isValidSiren(siren: string): boolean {
  if (!siren || typeof siren !== 'string') return false;

  // Remove spaces and dashes
  const cleaned = siren.replace(/[\s-]/g, '');

  // Must be exactly 9 digits
  if (!/^\d{9}$/.test(cleaned)) return false;

  return validateLuhnAlgorithm(cleaned);
}

/**
 * Luhn algorithm for SIRET/SIREN validation
 */
function validateLuhnAlgorithm(number: string): boolean {
  let sum = 0;
  let isEven = false;

  // Process digits from right to left
  for (let i = number.length - 1; i >= 0; i--) {
    let digit = parseInt(number[i], 10);

    if (isEven) {
      digit *= 2;
      if (digit > 9) {
        digit -= 9;
      }
    }

    sum += digit;
    isEven = !isEven;
  }

  return sum % 10 === 0;
}

/**
 * Extract SIREN from SIRET (first 9 digits)
 */
export function extractSirenFromSiret(siret: string): string {
  const cleaned = siret.replace(/[\s-]/g, '');
  return cleaned.substring(0, 9);
}

/**
 * Extract SIRET using regex patterns
 */
function extractSiretWithRegex(text: string): SiretExtractionResult {
  const errors: string[] = [];

  // Common patterns for SIRET in documents
  const patterns = [
    // SIRET: 123 456 789 00012 or SIRET 123 456 789 00012
    /(?:SIRET|Siret|siret)[\s:]*(\d{3}[\s-]?\d{3}[\s-]?\d{3}[\s-]?\d{5})/gi,
    // SIRET without label: 123 456 789 00012
    /(?:^|\s)(\d{3}[\s-]?\d{3}[\s-]?\d{3}[\s-]?\d{5})(?:\s|$)/gm,
    // Compact format: 12345678900012
    /(?:SIRET|Siret|siret)[\s:]*(\d{14})/gi,
    // SIREN + NIC format
    /(?:SIREN|Siren|siren)[\s:]*(\d{3}[\s-]?\d{3}[\s-]?\d{3})[\s\S]{0,50}?(?:NIC|Nic|nic)[\s:]*(\d{5})/gi,
  ];

  const foundSirets: string[] = [];

  for (const pattern of patterns) {
    let match;
    while ((match = pattern.exec(text)) !== null) {
      const siretCandidate = match[1]?.replace(/[\s-]/g, '') || '';

      if (siretCandidate.length === 14 && isValidSiret(siretCandidate)) {
        foundSirets.push(siretCandidate);
      } else if (match[2]) {
        // SIREN + NIC pattern
        const siren = match[1].replace(/[\s-]/g, '');
        const nic = match[2].replace(/[\s-]/g, '');
        const fullSiret = siren + nic;

        if (isValidSiret(fullSiret)) {
          foundSirets.push(fullSiret);
        }
      }
    }
  }

  // Remove duplicates
  const uniqueSirets = [...new Set(foundSirets)];

  if (uniqueSirets.length === 0) {
    return {
      success: false,
      extractionMethod: 'regex',
      confidence: 0,
      errors: ['No valid SIRET found with regex patterns'],
    };
  }

  if (uniqueSirets.length > 1) {
    errors.push(`Multiple SIRETs found: ${uniqueSirets.join(', ')}. Using first one.`);
  }

  const siret = uniqueSirets[0];
  const siren = extractSirenFromSiret(siret);

  return {
    success: true,
    siret,
    siren,
    extractionMethod: 'regex',
    confidence: 85,
    errors: errors.length > 0 ? errors : undefined,
  };
}

/**
 * Extract company name using regex patterns
 */
function extractCompanyNameWithRegex(text: string, siret?: string): Partial<SiretExtractionResult> {
  // Common patterns for company identification
  const patterns = [
    // "Entreprise: XYZ" or "Société: XYZ"
    /(?:Entreprise|Société|Company|Raison sociale)[\s:]+([A-ZÉÈÊËÀÂÄÔÖÛÜÇ][A-Za-zéèêëàâäôöûüç\s&'-]{2,80})/i,
    // Company name before SIRET
    /([A-ZÉÈÊËÀÂÄÔÖÛÜÇ][A-Za-zéèêëàâäôöûüç\s&'-]{2,80})[\s\n]+(?:SIRET|Siret)/i,
    // Legal forms: SARL, SAS, SA, EURL, etc.
    /([A-ZÉÈÊËÀÂÄÔÖÛÜÇ][A-Za-zéèêëàâäôöûüç\s&'-]{2,60}(?:SARL|SAS|SA|EURL|SCI|SASU|EIRL|EI|SELARL|SELAFA|SELAS))/i,
  ];

  for (const pattern of patterns) {
    const match = pattern.exec(text);
    if (match && match[1]) {
      const name = match[1].trim();

      // Filter out common false positives
      if (!name.match(/^(Monsieur|Madame|Client|Devis|Date|Total|Montant|Page)/i)) {
        return {
          companyName: name,
        };
      }
    }
  }

  return {};
}

/**
 * Extract company information using AI (Claude)
 */
async function extractWithAI(
  text: string,
  apiKey: string
): Promise<SiretExtractionResult> {
  const systemPrompt = `Tu es un expert en extraction de données d'entreprises françaises depuis des documents (devis, factures).
Ta mission est d'extraire avec précision le SIRET, le nom commercial et les informations légales de l'entreprise.

Règles de validation :
- SIRET : exactement 14 chiffres, doit passer l'algorithme de Luhn
- SIREN : les 9 premiers chiffres du SIRET
- Nom commercial : nom sous lequel l'entreprise exerce
- Raison sociale : nom légal complet de l'entreprise

Réponds UNIQUEMENT avec un objet JSON, sans texte additionnel.`;

  const prompt = `Extrait les informations de l'entreprise émettrice du devis suivant :

${text.substring(0, 3000)}

Retourne un objet JSON avec cette structure :
{
  "siret": "12345678900012",
  "companyName": "Nom commercial",
  "legalName": "Raison sociale complète",
  "address": "Adresse complète",
  "confidence": 90
}

Si tu ne trouves pas d'information, mets null pour ce champ et baisse le confidence.`;

  const response = await callClaude(prompt, systemPrompt, apiKey);

  if (!response.success || !response.data) {
    return {
      success: false,
      extractionMethod: 'ai',
      confidence: 0,
      errors: [response.error || 'AI extraction failed'],
    };
  }

  const data = typeof response.data === 'string'
    ? JSON.parse(response.data)
    : response.data;

  // Validate SIRET if provided
  if (data.siret) {
    const cleanedSiret = data.siret.replace(/[\s-]/g, '');
    if (!isValidSiret(cleanedSiret)) {
      return {
        success: false,
        extractionMethod: 'ai',
        confidence: 0,
        errors: ['AI extracted invalid SIRET'],
      };
    }
    data.siret = cleanedSiret;
    data.siren = extractSirenFromSiret(cleanedSiret);
  }

  return {
    success: !!data.siret || !!data.companyName,
    siret: data.siret || undefined,
    siren: data.siren || undefined,
    companyName: data.companyName || undefined,
    legalName: data.legalName || undefined,
    address: data.address || undefined,
    extractionMethod: 'ai',
    confidence: data.confidence || 70,
  };
}

/**
 * Main extraction function - uses hybrid approach
 */
export async function extractCompanyInfo(
  devisText: string,
  claudeApiKey?: string
): Promise<SiretExtractionResult> {
  const errors: string[] = [];

  // Step 1: Try regex extraction
  const regexResult = extractSiretWithRegex(devisText);

  if (regexResult.success) {
    // Enhance with company name extraction
    const nameInfo = extractCompanyNameWithRegex(devisText, regexResult.siret);

    return {
      ...regexResult,
      ...nameInfo,
      extractionMethod: nameInfo.companyName ? 'hybrid' : 'regex',
      confidence: nameInfo.companyName ? 90 : 85,
    };
  }

  errors.push(...(regexResult.errors || []));

  // Step 2: Fallback to AI extraction if API key available
  if (claudeApiKey) {
    try {
      const aiResult = await extractWithAI(devisText, claudeApiKey);

      if (aiResult.success) {
        return {
          ...aiResult,
          errors: errors.concat(aiResult.errors || []),
        };
      }

      errors.push(...(aiResult.errors || []));
    } catch (error) {
      errors.push(`AI extraction failed: ${String(error)}`);
    }
  }

  // Step 3: Try to at least extract company name
  const nameInfo = extractCompanyNameWithRegex(devisText);
  if (nameInfo.companyName) {
    return {
      success: false, // No SIRET but we have company name
      companyName: nameInfo.companyName,
      extractionMethod: 'regex',
      confidence: 40,
      errors: [...errors, 'SIRET not found, but company name extracted'],
    };
  }

  // Complete failure
  return {
    success: false,
    extractionMethod: 'failed',
    confidence: 0,
    errors: [...errors, 'Failed to extract company information'],
  };
}

/**
 * Quick SIRET-only extraction (optimized for performance)
 */
export function quickExtractSiret(text: string): string | null {
  const patterns = [
    /(?:SIRET|Siret|siret)[\s:]*(\d{3}[\s-]?\d{3}[\s-]?\d{3}[\s-]?\d{5})/i,
    /(?:SIRET|Siret|siret)[\s:]*(\d{14})/i,
  ];

  for (const pattern of patterns) {
    const match = pattern.exec(text);
    if (match && match[1]) {
      const siret = match[1].replace(/[\s-]/g, '');
      if (isValidSiret(siret)) {
        return siret;
      }
    }
  }

  return null;
}

/**
 * Format SIRET for display (adds spaces: 123 456 789 00012)
 */
export function formatSiret(siret: string): string {
  const cleaned = siret.replace(/[\s-]/g, '');
  if (cleaned.length !== 14) return siret;

  return `${cleaned.substring(0, 3)} ${cleaned.substring(3, 6)} ${cleaned.substring(6, 9)} ${cleaned.substring(9, 14)}`;
}

/**
 * Format SIREN for display (adds spaces: 123 456 789)
 */
export function formatSiren(siren: string): string {
  const cleaned = siren.replace(/[\s-]/g, '');
  if (cleaned.length !== 9) return siren;

  return `${cleaned.substring(0, 3)} ${cleaned.substring(3, 6)} ${cleaned.substring(6, 9)}`;
}
