/**
 * Trust Framework Types
 * Centralized business-level type definitions for professional reliability assessment
 * Phase 22: Trust Framework Registry
 */

/**
 * Lot criticality level
 * Determines importance and risk level of a specific construction lot
 */
export type LotCriticalityLevel = 'low' | 'medium' | 'high' | 'critical';

/**
 * Risk type classification
 * Categories of risks associated with obligations
 */
export type RiskType = 'safety' | 'financial' | 'administrative' | 'technical' | 'commercial';

/**
 * Severity level for obligations
 */
export type SeverityLevel = 'low' | 'medium' | 'high' | 'critical';

/**
 * Grade levels
 */
export type GradeLevel = 'A' | 'B' | 'C' | 'D';

/**
 * Lot Trust Profile
 * Describes expected characteristics and requirements for a specific lot type
 */
export interface LotTrustProfile {
  // Identifier and basic info
  lotType: string;
  criticality: LotCriticalityLevel;

  // Expected compliance requirements
  expectedObligations: string[];

  // Price expectations
  priceRange?: {
    minPerUnit?: number;
    maxPerUnit?: number;
  };

  // Quality expectations
  minimumDescriptionLength?: number;

  // Additional metadata
  description?: string;
  relatedKeywords?: string[];
}

/**
 * Obligation Trust Profile
 * Describes characteristics and risk level of a specific obligation type
 */
export interface ObligationTrustProfile {
  // Identifier
  obligationId: string;

  // Risk classification
  riskType: RiskType;
  severity: SeverityLevel;

  // Compliance requirement
  description?: string;

  // Grade impact: if this obligation is violated,
  // it prevents achieving grades above this level
  blocksGradeAbove?: GradeLevel;

  // Additional metadata
  relatedLots?: string[];
  keywords?: string[];
}

/**
 * Trust Framework Registry
 * Centralized repository of business rules and metadata
 */
export interface TrustFrameworkRegistry {
  // Lot profiles indexed by lot type
  lots: Record<string, LotTrustProfile>;

  // Obligation profiles indexed by obligation ID
  obligations: Record<string, ObligationTrustProfile>;

  // Metadata about the registry itself
  metadata?: {
    version: string;
    createdAt: string;
    description: string;
  };
}

/**
 * Criticality level utility functions
 */
export function getCriticalityScore(level: LotCriticalityLevel): number {
  const scores: Record<LotCriticalityLevel, number> = {
    low: 1,
    medium: 2,
    high: 3,
    critical: 4,
  };
  return scores[level];
}

export function isCritical(level: LotCriticalityLevel): boolean {
  return level === 'critical' || level === 'high';
}

/**
 * Risk type utility functions
 */
export function getRiskTypeCategory(riskType: RiskType): string {
  const categories: Record<RiskType, string> = {
    safety: 'Safety & Health',
    financial: 'Financial & Commercial',
    administrative: 'Administrative & Legal',
    technical: 'Technical & Quality',
    commercial: 'Commercial & Terms',
  };
  return categories[riskType];
}

/**
 * Severity utility functions
 */
export function getSeverityScore(severity: SeverityLevel): number {
  const scores: Record<SeverityLevel, number> = {
    low: 1,
    medium: 2,
    high: 3,
    critical: 4,
  };
  return scores[severity];
}

/**
 * Grade blocking utility
 * Determines if an obligation blocks a grade
 */
export function blocksGrade(profileGrade: GradeLevel | undefined, targetGrade: GradeLevel): boolean {
  if (!profileGrade) {
    return false;
  }

  const gradeHierarchy: Record<GradeLevel, number> = {
    A: 4,
    B: 3,
    C: 2,
    D: 1,
  };

  return gradeHierarchy[profileGrade] >= gradeHierarchy[targetGrade];
}
