/**
 * TORP Knowledge Core Types v1.0
 * Fundamental data structures for business knowledge base
 */

/**
 * Severity levels for knowledge items
 */
export type KnowledgeSeverity = 'low' | 'medium' | 'high' | 'critical';

/**
 * Categories of business knowledge
 */
export type KnowledgeCategory =
  | 'normative'
  | 'pricing'
  | 'fraud_pattern'
  | 'risk_factor'
  | 'sector_coefficient'
  | 'jurisprudence';

/**
 * Normative rule - regulatory or best practice requirement
 */
export interface NormativeRule {
  id: string;
  label: string;
  description?: string;
  relatedLots: string[];
  severity: KnowledgeSeverity;
  requiredDocuments?: string[];
  referenceText?: string;
  category?: 'regulation' | 'standard' | 'best_practice';
  effectiveFrom?: string;
}

/**
 * Pricing reference - benchmarks for different lot types
 */
export interface PricingReference {
  id?: string;
  lotType: string;
  description?: string;
  region?: string;
  minPricePerUnit?: number;
  maxPricePerUnit?: number;
  minTotalPrice?: number;
  maxTotalPrice?: number;
  currency?: string;
  updatedAt: string;
  source?: string;
}

/**
 * Fraud pattern - known fraud indicators and red flags
 */
export interface FraudPattern {
  id: string;
  description: string;
  riskLevel: KnowledgeSeverity;
  detectionHints: string[];
  category?: 'pricing_anomaly' | 'documentation_fraud' | 'scope_mismatch' | 'enterprise_mismatch';
  countermeasures?: string[];
}

/**
 * Sector coefficient - multipliers and factors per business sector
 */
export interface SectorCoefficient {
  sector: string;
  description?: string;
  complexityMultiplier: number;
  riskMultiplier: number;
  priceScaleFactor?: number;
  typicalMargin?: number;
}

/**
 * Risk factor - identified risk considerations
 */
export interface RiskFactor {
  id: string;
  label: string;
  description?: string;
  category: 'enterprise' | 'pricing' | 'quality' | 'geographic' | 'temporal';
  impactLevel: KnowledgeSeverity;
  mitigation?: string;
}

/**
 * Jurisprudence reference - legal case or guidance
 */
export interface JurisprudenceReference {
  id: string;
  title: string;
  description?: string;
  date: string;
  source: string;
  relevantLots?: string[];
  guidance: string;
}

/**
 * Complete knowledge registry
 */
export interface KnowledgeRegistry {
  metadata: {
    version: string;
    lastUpdated: string;
    authority: string;
  };
  normativeRules: NormativeRule[];
  pricingReferences: PricingReference[];
  fraudPatterns: FraudPattern[];
  sectorCoefficients: SectorCoefficient[];
  riskFactors: RiskFactor[];
  jurisprudence: JurisprudenceReference[];
}

/**
 * Validation result
 */
export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings?: string[];
}

/**
 * Knowledge statistics
 */
export interface KnowledgeStatistics {
  totalNorms: number;
  totalPricingRefs: number;
  totalFraudPatterns: number;
  totalSectorCoefficients: number;
  totalRiskFactors: number;
  totalJurisprudence: number;
  severityDistribution: Record<KnowledgeSeverity, number>;
  categoryDistribution: Record<string, number>;
  lastUpdated: string;
}

/**
 * Knowledge export format
 */
export interface KnowledgeExport {
  registry: KnowledgeRegistry;
  statistics: KnowledgeStatistics;
  exportedAt: string;
  exportedBy: string;
}
