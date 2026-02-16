/**
 * TORP Knowledge Validation v1.0
 * Validates registry integrity and consistency
 */

import {
  KnowledgeRegistry,
  ValidationResult,
  KnowledgeSeverity,
  NormativeRule,
  PricingReference,
  FraudPattern,
  SectorCoefficient,
  RiskFactor,
} from './knowledgeTypes';

/**
 * Valid severity levels
 */
const VALID_SEVERITIES: KnowledgeSeverity[] = ['low', 'medium', 'high', 'critical'];

/**
 * Validate knowledge registry
 */
export function validateKnowledgeRegistry(registry: KnowledgeRegistry): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  try {
    // Validate metadata
    if (!registry.metadata) {
      errors.push('Missing metadata');
      return { valid: false, errors };
    }

    if (!registry.metadata.version) {
      errors.push('Missing metadata.version');
    }

    if (!registry.metadata.lastUpdated) {
      errors.push('Missing metadata.lastUpdated');
    }

    // Validate normative rules
    const normErrors = validateNormativeRules(registry.normativeRules);
    errors.push(...normErrors.errors);
    warnings.push(...normErrors.warnings);

    // Validate pricing references
    const pricingErrors = validatePricingReferences(registry.pricingReferences);
    errors.push(...pricingErrors.errors);
    warnings.push(...pricingErrors.warnings);

    // Validate fraud patterns
    const fraudErrors = validateFraudPatterns(registry.fraudPatterns);
    errors.push(...fraudErrors.errors);
    warnings.push(...fraudErrors.warnings);

    // Validate sector coefficients
    const sectorErrors = validateSectorCoefficients(registry.sectorCoefficients);
    errors.push(...sectorErrors.errors);
    warnings.push(...sectorErrors.warnings);

    // Validate risk factors
    const riskErrors = validateRiskFactors(registry.riskFactors);
    errors.push(...riskErrors.errors);
    warnings.push(...riskErrors.warnings);

    // Validate jurisprudence
    const jurErrors = validateJurisprudence(registry.jurisprudence);
    errors.push(...jurErrors.errors);
    warnings.push(...jurErrors.warnings);

    // Cross-validation
    const crossErrors = validateCrossReferences(registry);
    errors.push(...crossErrors.errors);
    warnings.push(...crossErrors.warnings);

    return {
      valid: errors.length === 0,
      errors,
      warnings: warnings.length > 0 ? warnings : undefined,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return {
      valid: false,
      errors: [errorMessage],
    };
  }
}

/**
 * Validate normative rules
 */
function validateNormativeRules(
  rules: NormativeRule[]
): { errors: string[]; warnings: string[] } {
  const errors: string[] = [];
  const warnings: string[] = [];
  const ids = new Set<string>();

  if (!Array.isArray(rules)) {
    errors.push('normativeRules must be an array');
    return { errors, warnings };
  }

  if (rules.length === 0) {
    warnings.push('No normative rules defined');
  }

  rules.forEach((rule, index) => {
    const prefix = `normativeRules[${index}]`;

    // Validate id
    if (!rule.id) {
      errors.push(`${prefix}: Missing id`);
    } else if (ids.has(rule.id)) {
      errors.push(`${prefix}: Duplicate id "${rule.id}"`);
    } else {
      ids.add(rule.id);
    }

    // Validate label
    if (!rule.label) {
      errors.push(`${prefix}: Missing label`);
    }

    // Validate relatedLots
    if (!Array.isArray(rule.relatedLots) || rule.relatedLots.length === 0) {
      errors.push(`${prefix}: relatedLots must be non-empty array`);
    }

    // Validate severity
    if (!rule.severity || !VALID_SEVERITIES.includes(rule.severity)) {
      errors.push(`${prefix}: Invalid severity "${rule.severity}"`);
    }
  });

  return { errors, warnings };
}

/**
 * Validate pricing references
 */
function validatePricingReferences(
  references: PricingReference[]
): { errors: string[]; warnings: string[] } {
  const errors: string[] = [];
  const warnings: string[] = [];
  const seenIds = new Set<string>();

  if (!Array.isArray(references)) {
    errors.push('pricingReferences must be an array');
    return { errors, warnings };
  }

  if (references.length === 0) {
    warnings.push('No pricing references defined');
  }

  references.forEach((ref, index) => {
    const prefix = `pricingReferences[${index}]`;

    // Validate id if present
    if (ref.id) {
      if (seenIds.has(ref.id)) {
        errors.push(`${prefix}: Duplicate id "${ref.id}"`);
      }
      seenIds.add(ref.id);
    }

    // Validate lotType
    if (!ref.lotType) {
      errors.push(`${prefix}: Missing lotType`);
    }

    // Validate updatedAt
    if (!ref.updatedAt) {
      errors.push(`${prefix}: Missing updatedAt`);
    }

    // Validate price ranges
    if (ref.minPricePerUnit !== undefined && ref.maxPricePerUnit !== undefined) {
      if (ref.minPricePerUnit < 0) {
        errors.push(`${prefix}: minPricePerUnit must be >= 0`);
      }
      if (ref.maxPricePerUnit < 0) {
        errors.push(`${prefix}: maxPricePerUnit must be >= 0`);
      }
      if (ref.minPricePerUnit > ref.maxPricePerUnit) {
        errors.push(
          `${prefix}: minPricePerUnit (${ref.minPricePerUnit}) > maxPricePerUnit (${ref.maxPricePerUnit})`
        );
      }
    }

    if (ref.minTotalPrice !== undefined && ref.maxTotalPrice !== undefined) {
      if (ref.minTotalPrice < 0) {
        errors.push(`${prefix}: minTotalPrice must be >= 0`);
      }
      if (ref.maxTotalPrice < 0) {
        errors.push(`${prefix}: maxTotalPrice must be >= 0`);
      }
      if (ref.minTotalPrice > ref.maxTotalPrice) {
        errors.push(
          `${prefix}: minTotalPrice (${ref.minTotalPrice}) > maxTotalPrice (${ref.maxTotalPrice})`
        );
      }
    }

    // Validate currency
    if (ref.currency && !['EUR', 'EUR/m²', 'EUR/m', 'EUR/unit'].includes(ref.currency)) {
      warnings.push(`${prefix}: Unusual currency format "${ref.currency}"`);
    }
  });

  return { errors, warnings };
}

/**
 * Validate fraud patterns
 */
function validateFraudPatterns(
  patterns: FraudPattern[]
): { errors: string[]; warnings: string[] } {
  const errors: string[] = [];
  const warnings: string[] = [];
  const ids = new Set<string>();

  if (!Array.isArray(patterns)) {
    errors.push('fraudPatterns must be an array');
    return { errors, warnings };
  }

  if (patterns.length === 0) {
    warnings.push('No fraud patterns defined');
  }

  patterns.forEach((pattern, index) => {
    const prefix = `fraudPatterns[${index}]`;

    // Validate id
    if (!pattern.id) {
      errors.push(`${prefix}: Missing id`);
    } else if (ids.has(pattern.id)) {
      errors.push(`${prefix}: Duplicate id "${pattern.id}"`);
    } else {
      ids.add(pattern.id);
    }

    // Validate description
    if (!pattern.description) {
      errors.push(`${prefix}: Missing description`);
    }

    // Validate riskLevel
    if (!pattern.riskLevel || !VALID_SEVERITIES.includes(pattern.riskLevel)) {
      errors.push(`${prefix}: Invalid riskLevel "${pattern.riskLevel}"`);
    }

    // Validate detectionHints
    if (!Array.isArray(pattern.detectionHints) || pattern.detectionHints.length === 0) {
      errors.push(`${prefix}: detectionHints must be non-empty array`);
    }
  });

  return { errors, warnings };
}

/**
 * Validate sector coefficients
 */
function validateSectorCoefficients(
  coefficients: SectorCoefficient[]
): { errors: string[]; warnings: string[] } {
  const errors: string[] = [];
  const warnings: string[] = [];
  const sectors = new Set<string>();

  if (!Array.isArray(coefficients)) {
    errors.push('sectorCoefficients must be an array');
    return { errors, warnings };
  }

  if (coefficients.length === 0) {
    warnings.push('No sector coefficients defined');
  }

  coefficients.forEach((coef, index) => {
    const prefix = `sectorCoefficients[${index}]`;

    // Validate sector
    if (!coef.sector) {
      errors.push(`${prefix}: Missing sector`);
    } else if (sectors.has(coef.sector)) {
      errors.push(`${prefix}: Duplicate sector "${coef.sector}"`);
    } else {
      sectors.add(coef.sector);
    }

    // Validate multipliers
    if (coef.complexityMultiplier <= 0) {
      errors.push(`${prefix}: complexityMultiplier must be > 0`);
    }

    if (coef.riskMultiplier <= 0) {
      errors.push(`${prefix}: riskMultiplier must be > 0`);
    }

    if (coef.priceScaleFactor !== undefined && coef.priceScaleFactor <= 0) {
      errors.push(`${prefix}: priceScaleFactor must be > 0`);
    }

    // Warn on unusual multipliers
    if (coef.complexityMultiplier > 3) {
      warnings.push(`${prefix}: complexityMultiplier ${coef.complexityMultiplier} seems very high`);
    }

    if (coef.riskMultiplier > 3) {
      warnings.push(`${prefix}: riskMultiplier ${coef.riskMultiplier} seems very high`);
    }
  });

  return { errors, warnings };
}

/**
 * Validate risk factors
 */
function validateRiskFactors(
  factors: RiskFactor[]
): { errors: string[]; warnings: string[] } {
  const errors: string[] = [];
  const warnings: string[] = [];
  const ids = new Set<string>();

  if (!Array.isArray(factors)) {
    errors.push('riskFactors must be an array');
    return { errors, warnings };
  }

  factors.forEach((factor, index) => {
    const prefix = `riskFactors[${index}]`;

    // Validate id
    if (!factor.id) {
      errors.push(`${prefix}: Missing id`);
    } else if (ids.has(factor.id)) {
      errors.push(`${prefix}: Duplicate id "${factor.id}"`);
    } else {
      ids.add(factor.id);
    }

    // Validate label
    if (!factor.label) {
      errors.push(`${prefix}: Missing label`);
    }

    // Validate impactLevel
    if (!factor.impactLevel || !VALID_SEVERITIES.includes(factor.impactLevel)) {
      errors.push(`${prefix}: Invalid impactLevel "${factor.impactLevel}"`);
    }
  });

  return { errors, warnings };
}

/**
 * Validate jurisprudence
 */
function validateJurisprudence(
  references: any[]
): { errors: string[]; warnings: string[] } {
  const errors: string[] = [];
  const warnings: string[] = [];
  const ids = new Set<string>();

  if (!Array.isArray(references)) {
    errors.push('jurisprudence must be an array');
    return { errors, warnings };
  }

  references.forEach((ref, index) => {
    const prefix = `jurisprudence[${index}]`;

    // Validate id
    if (!ref.id) {
      errors.push(`${prefix}: Missing id`);
    } else if (ids.has(ref.id)) {
      errors.push(`${prefix}: Duplicate id "${ref.id}"`);
    } else {
      ids.add(ref.id);
    }

    // Validate title
    if (!ref.title) {
      errors.push(`${prefix}: Missing title`);
    }

    // Validate date
    if (!ref.date) {
      errors.push(`${prefix}: Missing date`);
    }

    // Validate guidance
    if (!ref.guidance) {
      errors.push(`${prefix}: Missing guidance`);
    }
  });

  return { errors, warnings };
}

/**
 * Validate cross-references between sections
 */
function validateCrossReferences(registry: KnowledgeRegistry): {
  errors: string[];
  warnings: string[];
} {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Check if at least some core data is present
  if (
    registry.normativeRules.length === 0 &&
    registry.pricingReferences.length === 0 &&
    registry.fraudPatterns.length === 0
  ) {
    errors.push('Registry has no core knowledge data (norms, pricing, or fraud patterns)');
  }

  // Validate lot type consistency
  const normativeLots = new Set<string>();
  registry.normativeRules.forEach((rule) => {
    rule.relatedLots.forEach((lot) => {
      normativeLots.add(lot);
    });
  });

  const pricingLots = new Set<string>();
  registry.pricingReferences.forEach((ref) => {
    pricingLots.add(ref.lotType);
  });

  // Check for lot types in pricing that don't have normative rules
  pricingLots.forEach((lot) => {
    if (!normativeLots.has(lot)) {
      warnings.push(
        `Lot type "${lot}" has pricing references but no normative rules. Consider adding requirements.`
      );
    }
  });

  return { errors, warnings };
}

/**
 * Validate a single severity value
 */
export function isValidSeverity(severity: string): severity is KnowledgeSeverity {
  return VALID_SEVERITIES.includes(severity as KnowledgeSeverity);
}

/**
 * Get all valid severities
 */
export function getValidSeverities(): KnowledgeSeverity[] {
  return [...VALID_SEVERITIES];
}
