/**
 * TORP Knowledge Registry v1.0
 * Structured business knowledge base
 * Static, curated reference data for TORP ecosystem
 */

import {
  KnowledgeRegistry,
  NormativeRule,
  PricingReference,
  FraudPattern,
  SectorCoefficient,
  RiskFactor,
  JurisprudenceReference,
} from './knowledgeTypes';

/**
 * Normative Rules - regulatory and best practice requirements
 */
const NORMATIVE_RULES: NormativeRule[] = [
  {
    id: 'norm_001',
    label: 'NFC 15-100 Electrical Installation',
    description: 'French electrical installation standard',
    relatedLots: ['electricite', 'domotique'],
    severity: 'critical',
    requiredDocuments: ['Declaration', 'Technical Report'],
    referenceText: 'Compliance with NFC 15-100 mandatory for all electrical work',
    category: 'standard',
    effectiveFrom: '2015-01-01',
  },
  {
    id: 'norm_002',
    label: 'Thermal Regulation RT 2020',
    description: 'French thermal performance regulation',
    relatedLots: ['chauffage', 'isolation', 'fenetre'],
    severity: 'high',
    requiredDocuments: ['Energy Audit', 'Compliance Certificate'],
    referenceText: 'RT 2020 compliance required for building envelope work',
    category: 'regulation',
    effectiveFrom: '2021-01-01',
  },
  {
    id: 'norm_003',
    label: 'Asbestos Survey',
    description: 'Pre-demolition asbestos assessment',
    relatedLots: ['demolition', 'gros_oeuvre'],
    severity: 'critical',
    requiredDocuments: ['Asbestos Report', 'Professional Certification'],
    referenceText: 'Mandatory before any demolition or renovation',
    category: 'regulation',
    effectiveFrom: '2000-01-01',
  },
  {
    id: 'norm_004',
    label: 'Plumbing Standards DTU 60.11',
    description: 'Water installation standards',
    relatedLots: ['plomberie', 'sanitaire'],
    severity: 'high',
    requiredDocuments: ['Installation Report', 'Test Certificate'],
    referenceText: 'DTU 60.11 compliance for water system integrity',
    category: 'standard',
    effectiveFrom: '2016-01-01',
  },
  {
    id: 'norm_005',
    label: 'Roofing Safety DTU 40.11',
    description: 'Roofing installation and safety',
    relatedLots: ['toiture', 'charpente'],
    severity: 'high',
    requiredDocuments: ['Installation Report', 'Safety Certificate'],
    referenceText: 'Safety and durability standards for roof systems',
    category: 'standard',
    effectiveFrom: '2014-01-01',
  },
  {
    id: 'norm_006',
    label: 'Health and Safety on Site',
    description: 'Construction site safety requirements',
    relatedLots: ['gros_oeuvre', 'demolition'],
    severity: 'high',
    requiredDocuments: ['Safety Plan', 'SPS Documentation'],
    referenceText: 'Mandatory safety coordination and planning',
    category: 'regulation',
    effectiveFrom: '1994-01-01',
  },
  {
    id: 'norm_007',
    label: 'Paint and Surface Treatment VOC',
    description: 'Volatile organic compound limits',
    relatedLots: ['peinture', 'traitement_bois'],
    severity: 'medium',
    requiredDocuments: ['Product Certificate'],
    referenceText: 'Low-VOC requirements for environmental compliance',
    category: 'regulation',
    effectiveFrom: '2004-01-01',
  },
  {
    id: 'norm_008',
    label: 'Waste Management Plan',
    description: 'Construction waste segregation and disposal',
    relatedLots: ['demolition', 'gros_oeuvre'],
    severity: 'medium',
    requiredDocuments: ['Waste Management Plan'],
    referenceText: 'Mandatory for projects > 50m³',
    category: 'best_practice',
    effectiveFrom: '2010-01-01',
  },
  {
    id: 'norm_009',
    label: 'Accessibility Standards Handicap',
    description: 'Accessibility for people with disabilities',
    relatedLots: ['portes', 'escaliers', 'ascenseur'],
    severity: 'high',
    requiredDocuments: ['Accessibility Report'],
    referenceText: 'Loi Handicap compliance mandatory',
    category: 'regulation',
    effectiveFrom: '2005-01-01',
  },
  {
    id: 'norm_010',
    label: 'Energy Label Requirements',
    description: 'Energy performance labeling',
    relatedLots: ['chauffage', 'isolation'],
    severity: 'medium',
    requiredDocuments: ['Energy Label', 'DPE if applicable'],
    referenceText: 'Performance labeling for energy systems',
    category: 'regulation',
    effectiveFrom: '2020-01-01',
  },
];

/**
 * Pricing References - benchmarks by lot type and region
 */
const PRICING_REFERENCES: PricingReference[] = [
  {
    id: 'price_001',
    lotType: 'electricite',
    description: 'Electrical installation',
    region: 'Ile-de-France',
    minPricePerUnit: 45,
    maxPricePerUnit: 85,
    currency: 'EUR',
    updatedAt: '2026-01-15',
    source: 'Market Survey 2026 Q1',
  },
  {
    id: 'price_002',
    lotType: 'electricite',
    description: 'Electrical installation',
    region: 'Province',
    minPricePerUnit: 35,
    maxPricePerUnit: 65,
    currency: 'EUR',
    updatedAt: '2026-01-15',
    source: 'Market Survey 2026 Q1',
  },
  {
    id: 'price_003',
    lotType: 'plomberie',
    description: 'Plumbing installation',
    region: 'Ile-de-France',
    minPricePerUnit: 50,
    maxPricePerUnit: 90,
    currency: 'EUR',
    updatedAt: '2026-01-15',
    source: 'Market Survey 2026 Q1',
  },
  {
    id: 'price_004',
    lotType: 'plomberie',
    description: 'Plumbing installation',
    region: 'Province',
    minPricePerUnit: 40,
    maxPricePerUnit: 70,
    currency: 'EUR',
    updatedAt: '2026-01-15',
    source: 'Market Survey 2026 Q1',
  },
  {
    id: 'price_005',
    lotType: 'chauffage',
    description: 'Heating system',
    region: 'Ile-de-France',
    minTotalPrice: 3500,
    maxTotalPrice: 8000,
    currency: 'EUR',
    updatedAt: '2026-01-15',
    source: 'Market Survey 2026 Q1',
  },
  {
    id: 'price_006',
    lotType: 'chauffage',
    description: 'Heating system',
    region: 'Province',
    minTotalPrice: 2500,
    maxTotalPrice: 6000,
    currency: 'EUR',
    updatedAt: '2026-01-15',
    source: 'Market Survey 2026 Q1',
  },
  {
    id: 'price_007',
    lotType: 'toiture',
    description: 'Roofing',
    region: 'Ile-de-France',
    minPricePerUnit: 65,
    maxPricePerUnit: 120,
    currency: 'EUR/m²',
    updatedAt: '2026-01-15',
    source: 'Market Survey 2026 Q1',
  },
  {
    id: 'price_008',
    lotType: 'toiture',
    description: 'Roofing',
    region: 'Province',
    minPricePerUnit: 50,
    maxPricePerUnit: 95,
    currency: 'EUR/m²',
    updatedAt: '2026-01-15',
    source: 'Market Survey 2026 Q1',
  },
  {
    id: 'price_009',
    lotType: 'peinture',
    description: 'Painting and surface treatment',
    region: 'Ile-de-France',
    minPricePerUnit: 12,
    maxPricePerUnit: 25,
    currency: 'EUR/m²',
    updatedAt: '2026-01-15',
    source: 'Market Survey 2026 Q1',
  },
  {
    id: 'price_010',
    lotType: 'gros_oeuvre',
    description: 'Structural work',
    region: 'Ile-de-France',
    minPricePerUnit: 150,
    maxPricePerUnit: 350,
    currency: 'EUR/m²',
    updatedAt: '2026-01-15',
    source: 'Market Survey 2026 Q1',
  },
];

/**
 * Fraud Patterns - known fraud indicators
 */
const FRAUD_PATTERNS: FraudPattern[] = [
  {
    id: 'fraud_001',
    description: 'Suspiciously low pricing on complex work',
    riskLevel: 'high',
    detectionHints: [
      'Price < 40% of market average',
      'Multiple critical lots involved',
      'Enterprise has low track record',
      'Minimal quality description',
    ],
    category: 'pricing_anomaly',
    countermeasures: ['Request detailed breakdown', 'Verify enterprise history', 'Price flag alert'],
  },
  {
    id: 'fraud_002',
    description: 'Missing mandatory compliance documentation',
    riskLevel: 'critical',
    detectionHints: [
      'No electrical certification for electricite lot',
      'No asbestos survey for demolition',
      'No thermal compliance for isolation',
      'Missing safety plan for structural work',
    ],
    category: 'documentation_fraud',
    countermeasures: ['Mandatory documentation check', 'Grade capping', 'Compliance requirement'],
  },
  {
    id: 'fraud_003',
    description: 'Enterprise strength mismatch with project scope',
    riskLevel: 'high',
    detectionHints: [
      'New enterprise (< 1 year) with critical lots',
      'Solo entrepreneur for structural work',
      'No insurance for high-risk work',
      'Scale mismatch (small team, large project)',
    ],
    category: 'enterprise_mismatch',
    countermeasures: ['Enterprise risk assessment', 'Grade capping', 'Subcontractor verification'],
  },
  {
    id: 'fraud_004',
    description: 'Quality description masking low pricing',
    riskLevel: 'medium',
    detectionHints: [
      'Excellent description but very low price',
      'Premium materials claimed but budget too low',
      'Contradictory scope vs budget',
      'Professional language but weak enterprise',
    ],
    category: 'scope_mismatch',
    countermeasures: ['Consistency check', 'Request itemization', 'Material verification'],
  },
  {
    id: 'fraud_005',
    description: 'Geographic inconsistency - no local presence',
    riskLevel: 'medium',
    detectionHints: [
      'Enterprise not registered in region',
      'No prior projects in area',
      'Travel cost not in budget',
      'Logistical challenges ignored',
    ],
    category: 'pricing_anomaly',
    countermeasures: ['Geo-verification', 'Regional network check', 'Travel cost validation'],
  },
];

/**
 * Sector Coefficients - multipliers per business sector
 */
const SECTOR_COEFFICIENTS: SectorCoefficient[] = [
  {
    sector: 'residential',
    description: 'Standard residential construction',
    complexityMultiplier: 1.0,
    riskMultiplier: 1.0,
    priceScaleFactor: 1.0,
    typicalMargin: 15,
  },
  {
    sector: 'commercial',
    description: 'Commercial and office spaces',
    complexityMultiplier: 1.3,
    riskMultiplier: 1.2,
    priceScaleFactor: 1.1,
    typicalMargin: 12,
  },
  {
    sector: 'industrial',
    description: 'Industrial and manufacturing',
    complexityMultiplier: 1.5,
    riskMultiplier: 1.4,
    priceScaleFactor: 1.2,
    typicalMargin: 10,
  },
  {
    sector: 'heritage',
    description: 'Historic and protected buildings',
    complexityMultiplier: 1.8,
    riskMultiplier: 1.6,
    priceScaleFactor: 1.4,
    typicalMargin: 18,
  },
  {
    sector: 'public',
    description: 'Public and government projects',
    complexityMultiplier: 1.4,
    riskMultiplier: 1.3,
    priceScaleFactor: 1.15,
    typicalMargin: 8,
  },
];

/**
 * Risk Factors - identified risk considerations
 */
const RISK_FACTORS: RiskFactor[] = [
  {
    id: 'risk_001',
    label: 'New Enterprise',
    description: 'Enterprise less than 2 years old',
    category: 'enterprise',
    impactLevel: 'high',
    mitigation: 'Require stronger guarantees, performance bond, or parent company guarantee',
  },
  {
    id: 'risk_002',
    label: 'Pricing Below Threshold',
    description: 'Quote price significantly below market range',
    category: 'pricing',
    impactLevel: 'high',
    mitigation: 'Request detailed breakdown, verify material costs, assess feasibility',
  },
  {
    id: 'risk_003',
    label: 'Poor Quality Description',
    description: 'Insufficient or vague work description',
    category: 'quality',
    impactLevel: 'medium',
    mitigation: 'Request detailed specifications and technical drawings',
  },
  {
    id: 'risk_004',
    label: 'Geographic Distance',
    description: 'Enterprise location far from project',
    category: 'geographic',
    impactLevel: 'medium',
    mitigation: 'Verify logistical capabilities and travel cost allocation',
  },
  {
    id: 'risk_005',
    label: 'Urgent Timeline',
    description: 'Project requires rapid completion',
    category: 'temporal',
    impactLevel: 'medium',
    mitigation: 'Verify capacity, assess quality compromise risk, increase supervision',
  },
];

/**
 * Jurisprudence References - legal guidance
 */
const JURISPRUDENCE: JurisprudenceReference[] = [
  {
    id: 'jur_001',
    title: 'Cour de Cassation on Hidden Defects',
    description: 'Ruling on constructor liability for non-apparent defects',
    date: '2015-03-15',
    source: 'Cour de Cassation, 3ème chambre civile',
    relevantLots: ['gros_oeuvre', 'toiture', 'fondation'],
    guidance: 'Constructor must guarantee fitness for 10 years under Article 1792 CC',
  },
  {
    id: 'jur_002',
    title: 'EU Consumer Rights Directive',
    description: 'Consumer protection in distance sales',
    date: '2011-06-29',
    source: 'European Court of Justice',
    guidance: '14-day withdrawal right for distance contracts (unless waived)',
  },
  {
    id: 'jur_003',
    title: 'French Building Code Updates',
    description: 'RT 2020 thermal regulation enforcement',
    date: '2020-01-01',
    source: 'Ministère du Développement Durable',
    relevantLots: ['chauffage', 'isolation', 'fenetre'],
    guidance: 'All new constructions and major renovations must comply with RT 2020',
  },
  {
    id: 'jur_004',
    title: 'Professional Liability Insurance',
    description: 'Mandatory insurance for building professionals',
    date: '2016-03-31',
    source: 'Loi Macron Article L.211-7',
    guidance: 'Décennale insurance mandatory for all construction work',
  },
  {
    id: 'jur_005',
    title: 'Data Protection in Building',
    description: 'RGPD application to construction projects',
    date: '2018-05-25',
    source: 'Commission Nationale de l\'Informatique et des Libertés',
    guidance: 'Personal data in project documentation must be protected per RGPD',
  },
];

/**
 * Complete TORP Knowledge Core
 */
export const TORP_KNOWLEDGE_CORE: KnowledgeRegistry = {
  metadata: {
    version: '1.0',
    lastUpdated: '2026-02-16',
    authority: 'TORP Knowledge Authority',
  },
  normativeRules: NORMATIVE_RULES,
  pricingReferences: PRICING_REFERENCES,
  fraudPatterns: FRAUD_PATTERNS,
  sectorCoefficients: SECTOR_COEFFICIENTS,
  riskFactors: RISK_FACTORS,
  jurisprudence: JURISPRUDENCE,
};

/**
 * Helper function to get pricing reference for a lot
 */
export function getPricingReference(lotType: string, region?: string): PricingReference | undefined {
  return PRICING_REFERENCES.find((ref) => {
    if (region && ref.region !== region) return false;
    return ref.lotType === lotType;
  });
}

/**
 * Helper function to get sector coefficient
 */
export function getSectorCoefficient(sector: string): SectorCoefficient | undefined {
  return SECTOR_COEFFICIENTS.find((coef) => coef.sector === sector);
}

/**
 * Helper function to get normative rule
 */
export function getNormativeRule(ruleId: string): NormativeRule | undefined {
  return NORMATIVE_RULES.find((rule) => rule.id === ruleId);
}

/**
 * Helper function to get fraud pattern
 */
export function getFraudPattern(patternId: string): FraudPattern | undefined {
  return FRAUD_PATTERNS.find((pattern) => pattern.id === patternId);
}

/**
 * Helper function to get risk factor
 */
export function getRiskFactor(factorId: string): RiskFactor | undefined {
  return RISK_FACTORS.find((factor) => factor.id === factorId);
}
