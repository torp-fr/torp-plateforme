import { log, warn, error, time, timeEnd } from '@/lib/logger';

/**
 * Doctrine Normalization Service (Phase 30)
 * Extracts structured information from doctrine documents
 * Identifies obligations, thresholds, penalties
 */

export interface ExtractedObligation {
  id: string;
  text: string;
  category: 'requirement' | 'prohibition' | 'recommendation' | 'exemption';
  severity: 'critical' | 'high' | 'medium' | 'low';
  sectorApplicable: string[];
  condition?: string;
}

export interface NumericalThreshold {
  id: string;
  description: string;
  value: number;
  unit: string;
  context: string;
  comparisonOperator: '<' | '<=' | '>' | '>=' | '=' | '!=' | 'between';
  secondValue?: number; // For 'between'
}

export interface ExtractedSanction {
  id: string;
  type: 'penalty' | 'fine' | 'liability' | 'non-compliance';
  description: string;
  severity: number; // 1-10
  applicableTo: string[]; // contractor, owner, designer, etc
}

export interface NormalizedDocument {
  sourceId: string;
  obligations: ExtractedObligation[];
  thresholds: NumericalThreshold[];
  sanctions: ExtractedSanction[];
  keyTerms: string[];
  applicableSectors: string[];
  extractionConfidence: number; // 0-1
}

/**
 * Extract obligations from text
 * Looks for requirement patterns: must, shall, require, obligation
 */
export function extractObligations(text: string): ExtractedObligation[] {
  const obligations: ExtractedObligation[] = [];

  // Common obligation patterns in French construction documents
  const obligationPatterns = [
    {
      regex: /(?:doit|doivent|obligation de|être obligatoirement|l'ouvrage doit)([^.]*)/gi,
      category: 'requirement' as const,
      severity: 'high' as const,
    },
    {
      regex: /(?:ne doit pas|ne peuvent pas|interdit|prohibé|interdiction)([^.]*)/gi,
      category: 'prohibition' as const,
      severity: 'high' as const,
    },
    {
      regex: /(?:devrait|il est recommandé|recommandation|préconisé)([^.]*)/gi,
      category: 'recommendation' as const,
      severity: 'medium' as const,
    },
    {
      regex: /(?:sauf|excepté|exception|exemption|pas applicable)([^.]*)/gi,
      category: 'exemption' as const,
      severity: 'low' as const,
    },
  ];

  let obligationId = 0;

  obligationPatterns.forEach((pattern) => {
    const matches = text.matchAll(pattern.regex);
    for (const match of matches) {
      const obligation: ExtractedObligation = {
        id: `obl-${obligationId++}`,
        text: (match[0] || '').substring(0, 200).trim(),
        category: pattern.category,
        severity: pattern.severity,
        sectorApplicable: inferSectorApplicability(match[0] || ''),
      };
      obligations.push(obligation);
    }
  });

  return obligations;
}

/**
 * Extract numerical thresholds
 * Looks for patterns: X meters, Y degrees, Z kg/m², etc
 */
export function extractNumericalThresholds(text: string): NumericalThreshold[] {
  const thresholds: NumericalThreshold[] = [];

  // Pattern for number + unit + context
  const thresholdPatterns = [
    {
      regex: /(\d+(?:[.,]\d+)?)\s*(m|m²|m³|cm|mm|kg|kg\/m²|°C|A|W|kW|dB|%)(?:\s+[a-z]+)*([^.]*)/gi,
      unitMap: {
        'm': 'meter',
        'm²': 'square_meter',
        'm³': 'cubic_meter',
        'cm': 'centimeter',
        'mm': 'millimeter',
        'kg': 'kilogram',
        'kg/m²': 'kg_per_sqm',
        '°c': 'celsius',
        'a': 'ampere',
        'w': 'watt',
        'kw': 'kilowatt',
        'db': 'decibel',
        '%': 'percent',
      },
    },
  ];

  let thresholdId = 0;

  thresholdPatterns.forEach((pattern) => {
    const matches = text.matchAll(pattern.regex);
    for (const match of matches) {
      const value = parseFloat((match[1] || '0').replace(',', '.'));
      const unit = (match[2] || 'm').toLowerCase();

      const threshold: NumericalThreshold = {
        id: `thr-${thresholdId++}`,
        description: `${value}${unit}`,
        value,
        unit,
        context: (match[3] || '').substring(0, 100).trim(),
        comparisonOperator: inferComparisonOperator(match[0] || ''),
      };
      thresholds.push(threshold);
    }
  });

  return thresholds;
}

/**
 * Extract sanctions and penalties
 */
export function extractSanctions(text: string): ExtractedSanction[] {
  const sanctions: ExtractedSanction[] = [];

  const sanctionPatterns = [
    {
      regex: /(?:amende|pénalité|sanction|pénale)([^.]*?)(?:\d+|€)/gi,
      type: 'penalty' as const,
      severity: 8,
    },
    {
      regex: /(?:responsabilité civile|responsable de|garantie décennale)([^.]*)/gi,
      type: 'liability' as const,
      severity: 9,
    },
    {
      regex: /(?:non-conformité|non-respect|infraction)([^.]*)/gi,
      type: 'non-compliance' as const,
      severity: 6,
    },
  ];

  let sanctionId = 0;

  sanctionPatterns.forEach((pattern) => {
    const matches = text.matchAll(pattern.regex);
    for (const match of matches) {
      const sanction: ExtractedSanction = {
        id: `san-${sanctionId++}`,
        type: pattern.type,
        description: (match[0] || '').substring(0, 150).trim(),
        severity: pattern.severity,
        applicableTo: inferResponsibleParties(match[0] || ''),
      };
      sanctions.push(sanction);
    }
  });

  return sanctions;
}

/**
 * Extract key technical terms
 */
export function extractKeyTerms(text: string, limit: number = 20): string[] {
  // Common technical terms in construction
  const technicalTerms = [
    'DTU',
    'NF',
    'AFNOR',
    'RGE',
    'QAI',
    'BBC',
    'RE2020',
    'étanchéité',
    'isolation thermique',
    'isolation phonique',
    'humidité',
    'condensation',
    'ventilation',
    'étuvage',
    'pontage thermique',
    'pare-vapeur',
    'pare-pluie',
    'membrane',
    'béton',
    'acier',
    'brique',
    'tuile',
    'enduit',
  ];

  const foundTerms: { term: string; count: number }[] = [];

  technicalTerms.forEach((term) => {
    const regex = new RegExp(`\\b${term}\\b`, 'gi');
    const matches = text.match(regex) || [];
    if (matches.length > 0) {
      foundTerms.push({ term, count: matches.length });
    }
  });

  return foundTerms
    .sort((a, b) => b.count - a.count)
    .slice(0, limit)
    .map((t) => t.term);
}

/**
 * Infer sector applicability from text
 */
function inferSectorApplicability(text: string): string[] {
  const sectorMap: { [key: string]: string } = {
    'batiment|immeuble|résidentiel|logement|habitation': 'batiment',
    'facades?|revêtement': 'facade',
    'toiture?|couverture': 'toiture',
    'électricit|câblage|installation électrique': 'electricite',
    'chauffage|radiateur|climatisation': 'chauffage_clim',
    'plomberie|eau|sanitaire': 'plomberie',
    'cloison|plâtre|intérieur': 'interieur',
    'isolation|thermique': 'isolation',
    'menuiserie|fenêtre|porte': 'menuiserie',
  };

  const sectors: string[] = [];

  Object.entries(sectorMap).forEach(([pattern, sector]) => {
    if (new RegExp(pattern, 'i').test(text)) {
      sectors.push(sector);
    }
  });

  return sectors.length > 0 ? sectors : ['general'];
}

/**
 * Infer comparison operator from context
 */
function inferComparisonOperator(
  text: string
): '<' | '<=' | '>' | '>=' | '=' | '!=' | 'between' {
  if (/minimum|au moins|≥|>=/.test(text)) return '>=';
  if (/maximum|au plus|≤|<=/.test(text)) return '<=';
  if (/supérieur à|>/.test(text)) return '>';
  if (/inférieur à|</.test(text)) return '<';
  if (/entre|range/.test(text)) return 'between';
  if (/égal|=/.test(text)) return '=';
  if (/différent|!=|≠/.test(text)) return '!=';
  return '=';
}

/**
 * Infer responsible parties from text
 */
function inferResponsibleParties(text: string): string[] {
  const parties: string[] = [];

  if (/entrepreneur|artisan|entreprise/.test(text)) parties.push('contractor');
  if (/maître d'ouvrage|propriétaire|client/.test(text)) parties.push('owner');
  if (/architecte|maître d'œuvre|concepteur/.test(text)) parties.push('designer');
  if (/bureau d'études|ingénieur/.test(text)) parties.push('engineer');

  return parties.length > 0 ? parties : ['contractor'];
}

/**
 * Normalize doctrine document
 * Main function to extract and structure all relevant information
 */
export function normalizeDoctrineDocument(
  sourceId: string,
  text: string
): NormalizedDocument {
  try {
    log(`[DoctrineNormalization] Normalizing document: ${sourceId}`);

    const obligations = extractObligations(text);
    const thresholds = extractNumericalThresholds(text);
    const sanctions = extractSanctions(text);
    const keyTerms = extractKeyTerms(text);

    // Collect all applicable sectors
    const applicableSectors = Array.from(
      new Set(
        obligations.flatMap((o) => o.sectorApplicable).filter((s) => s !== 'general')
      )
    );

    // Calculate extraction confidence based on data found
    const dataPoints =
      obligations.length + thresholds.length + sanctions.length + keyTerms.length;
    const extractionConfidence = Math.min(dataPoints / 10, 1.0);

    const normalized: NormalizedDocument = {
      sourceId,
      obligations,
      thresholds,
      sanctions,
      keyTerms,
      applicableSectors,
      extractionConfidence,
    };

    log(
      `[DoctrineNormalization] Extracted: ${obligations.length} obligations, ${thresholds.length} thresholds, ${sanctions.length} sanctions`
    );

    return normalized;
  } catch (error) {
    console.error(`[DoctrineNormalization] Normalization failed for ${sourceId}:`, error);

    return {
      sourceId,
      obligations: [],
      thresholds: [],
      sanctions: [],
      keyTerms: [],
      applicableSectors: [],
      extractionConfidence: 0,
    };
  }
}
