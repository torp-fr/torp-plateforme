/**
 * Doctrine Classification Service (Phase 30)
 * Classifies doctrine documents and matches them to project scenarios
 * Determines applicability to specific quotes and lots
 */

import type { NormalizedDocument } from './doctrineNormalization.service';
import { log, warn, error, time, timeEnd } from '@/lib/logger';

export interface ClassificationResult {
  documentId: string;
  applicableSectors: string[];
  applicableLotTypes: string[];
  applicableRisks: string[];
  relevanceScore: number; // 0-100
  enforceabilityLevel: 'critical' | 'important' | 'advisory' | 'reference';
  keyObligationsCount: number;
  criticalThresholdsCount: number;
  applicableToAllProjects: boolean;
}

/**
 * Map normalized sectors to project lot types
 */
function mapSectorsToLotTypes(sectors: string[]): string[] {
  const sectorLotMap: { [key: string]: string[] } = {
    batiment: ['structure', 'gros-oeuvre', 'murs'],
    facade: ['facade', 'revêtement-façade'],
    toiture: ['couverture', 'toiture', 'charpente'],
    electricite: ['installation-electrique'],
    chauffage_clim: ['chauffage', 'climatisation'],
    plomberie: ['plomberie-sanitaire'],
    interieur: ['cloisons', 'plâtrerie', 'finitions'],
    isolation: ['isolation-thermique', 'isolation-phonique'],
    menuiserie: ['fenêtres', 'portes', 'menuiserie'],
  };

  const lotTypes = new Set<string>();

  sectors.forEach((sector) => {
    const types = sectorLotMap[sector] || [];
    types.forEach((type) => lotTypes.add(type));
  });

  return Array.from(lotTypes);
}

/**
 * Classify normalized doctrine document
 */
export function classifyDoctrineDocument(
  documentId: string,
  normalized: NormalizedDocument,
  authorityLevel: number,
  legalWeight: number,
  enforceable: boolean
): ClassificationResult {
  try {
    log(`[DoctrineClassification] Classifying document: ${documentId}`);

    // Determine applicability from obligations and thresholds
    const applicableSectors = normalized.applicableSectors;
    const applicableLotTypes = mapSectorsToLotTypes(applicableSectors);

    // Extract risk categories from obligations
    const applicableRisks = extractRiskCategories(normalized);

    // Calculate critical obligations and thresholds
    const criticalObligations = normalized.obligations.filter(
      (o) => o.severity === 'critical' || o.severity === 'high'
    ).length;

    const criticalThresholds = normalized.thresholds.filter((t) => {
      // Identify critical thresholds (e.g., minimum requirements)
      return t.context.toLowerCase().includes('minimum') ||
        t.context.toLowerCase().includes('obligatoire')
        ? true
        : false;
    }).length;

    // Calculate relevance score
    // Based on: authority level, legal weight, extraction confidence, obligations count
    const relevanceScore = Math.round(
      ((authorityLevel + legalWeight) / 10) * 50 + // Authority: 50%
        (normalized.extractionConfidence * 30) + // Extraction: 30%
        Math.min((normalized.obligations.length / 10) * 20, 20) // Obligations: 20%
    );

    // Determine enforceability level
    let enforceabilityLevel: 'critical' | 'important' | 'advisory' | 'reference';
    if (enforceable && legalWeight >= 4) {
      enforceabilityLevel = 'critical';
    } else if (legalWeight >= 3 || authorityLevel >= 4) {
      enforceabilityLevel = 'important';
    } else if (authorityLevel >= 2) {
      enforceabilityLevel = 'advisory';
    } else {
      enforceabilityLevel = 'reference';
    }

    // Apply to all projects if it's a fundamental standard (e.g., DTU)
    const applicableToAllProjects = enforceable && authorityLevel >= 4;

    const classification: ClassificationResult = {
      documentId,
      applicableSectors,
      applicableLotTypes,
      applicableRisks,
      relevanceScore: Math.min(relevanceScore, 100),
      enforceabilityLevel,
      keyObligationsCount: criticalObligations,
      criticalThresholdsCount: criticalThresholds,
      applicableToAllProjects,
    };

    log(
      `[DoctrineClassification] Classified: ${applicableLotTypes.length} lot types, relevance: ${classification.relevanceScore}`
    );

    return classification;
  } catch (error) {
    console.error(`[DoctrineClassification] Classification failed for ${documentId}:`, error);

    return {
      documentId,
      applicableSectors: [],
      applicableLotTypes: [],
      applicableRisks: [],
      relevanceScore: 0,
      enforceabilityLevel: 'reference',
      keyObligationsCount: 0,
      criticalThresholdsCount: 0,
      applicableToAllProjects: false,
    };
  }
}

/**
 * Extract risk categories from obligations and thresholds
 */
function extractRiskCategories(normalized: NormalizedDocument): string[] {
  const risks = new Set<string>();

  // Parse obligations for risk keywords
  const riskKeywords: { [key: string]: string } = {
    'humidité|eau|infiltration': 'moisture-risk',
    'thermique|pont|isolation': 'thermal-risk',
    'acoustique|bruit': 'acoustic-risk',
    'feu|incendie|sécurité': 'fire-risk',
    'structurel|fondation|charge': 'structural-risk',
    'ventilation|condensation': 'ventilation-risk',
    'électrique|électrocution': 'electrical-risk',
    'gaz|combustion': 'gas-risk',
    'contamination|amiante|plomb': 'contamination-risk',
  };

  const obligationsText = normalized.obligations.map((o) => o.text).join(' ');

  Object.entries(riskKeywords).forEach(([keywords, risk]) => {
    if (new RegExp(keywords, 'i').test(obligationsText)) {
      risks.add(risk);
    }
  });

  return Array.from(risks);
}

/**
 * Match document to project characteristics
 */
export function matchDocumentToProject(
  classification: ClassificationResult,
  projectSectors: string[],
  projectLotTypes: string[],
  projectRisks?: string[]
): number {
  // Calculate match score (0-100)
  let score = 0;

  // Sector matching (30 points max)
  const matchingSectors = projectSectors.filter((s) =>
    classification.applicableSectors.includes(s)
  ).length;
  const sectorScore = Math.min((matchingSectors / Math.max(projectSectors.length, 1)) * 30, 30);
  score += sectorScore;

  // Lot type matching (40 points max)
  const matchingLotTypes = projectLotTypes.filter((l) =>
    classification.applicableLotTypes.includes(l)
  ).length;
  const lotScore = Math.min((matchingLotTypes / Math.max(projectLotTypes.length, 1)) * 40, 40);
  score += lotScore;

  // Risk matching (20 points max)
  if (projectRisks && projectRisks.length > 0) {
    const matchingRisks = projectRisks.filter((r) =>
      classification.applicableRisks.includes(r)
    ).length;
    const riskScore = Math.min((matchingRisks / projectRisks.length) * 20, 20);
    score += riskScore;
  } else {
    score += 20; // Full points if no specific risks
  }

  // Boost score if document is applicable to all projects
  if (classification.applicableToAllProjects) {
    score = Math.min(score + 10, 100);
  }

  return Math.round(score);
}

/**
 * Get applicable documents for a project
 * Scores and filters documents relevant to the project
 */
export function getApplicableDocumentsForProject(
  classifications: ClassificationResult[],
  projectSectors: string[],
  projectLotTypes: string[],
  projectRisks?: string[],
  minRelevance: number = 30
): Array<ClassificationResult & { matchScore: number }> {
  const applicable: Array<ClassificationResult & { matchScore: number }> = [];

  classifications.forEach((classification) => {
    const matchScore = matchDocumentToProject(
      classification,
      projectSectors,
      projectLotTypes,
      projectRisks
    );

    if (matchScore >= minRelevance) {
      applicable.push({
        ...classification,
        matchScore,
      });
    }
  });

  // Sort by match score descending
  return applicable.sort((a, b) => b.matchScore - a.matchScore);
}

/**
 * Aggregate classification insights for project analysis
 */
export function aggregateClassifications(
  classifications: Array<ClassificationResult & { matchScore: number }>
): {
  totalApplicable: number;
  criticalDocuments: number;
  totalObligations: number;
  riskCoverage: string[];
  averageRelevance: number;
  enforceabilityBreakdown: Record<string, number>;
} {
  const enforceabilityBreakdown = {
    critical: 0,
    important: 0,
    advisory: 0,
    reference: 0,
  };

  let totalObligations = 0;
  const riskCoverageSet = new Set<string>();

  classifications.forEach((c) => {
    enforceabilityBreakdown[c.enforceabilityLevel]++;
    totalObligations += c.keyObligationsCount;
    c.applicableRisks.forEach((r) => riskCoverageSet.add(r));
  });

  const averageRelevance =
    classifications.length > 0
      ? Math.round(
          classifications.reduce((sum, c) => sum + c.relevanceScore, 0) / classifications.length
        )
      : 0;

  return {
    totalApplicable: classifications.length,
    criticalDocuments: enforceabilityBreakdown.critical,
    totalObligations,
    riskCoverage: Array.from(riskCoverageSet),
    averageRelevance,
    enforceabilityBreakdown,
  };
}
