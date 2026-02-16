/**
 * Trust Framework Metadata
 * Analysis and introspection utilities for the Trust Framework Registry
 * Phase 22: Trust Framework Foundation
 */

import { TRUST_FRAMEWORK_REGISTRY } from './trustFramework.registry';
import { LotCriticalityLevel, RiskType, SeverityLevel } from './trustTypes';

/**
 * Trust Framework metadata summary
 */
export interface TrustFrameworkMetadata {
  version: string;
  description: string;

  // Lot statistics
  totalLots: number;
  lotTypes: string[];
  lotCriticalityDistribution: Record<LotCriticalityLevel, number>;

  // Obligation statistics
  totalObligations: number;
  obligationIds: string[];
  obligationRiskTypeDistribution: Record<RiskType, number>;
  obligationSeverityDistribution: Record<SeverityLevel, number>;

  // Grade blocking analysis
  obligationsBlockingGrades: {
    blockingA: string[];
    blockingB: string[];
    blockingC: string[];
    blockingD: string[];
  };

  // Cross-references
  lotObligationMap: Record<string, string[]>;
  obligationLotMap: Record<string, string[]>;

  // Metadata
  createdAt: string;
}

/**
 * Get comprehensive Trust Framework metadata
 */
export function getTrustFrameworkMetadata(): TrustFrameworkMetadata {
  const registry = TRUST_FRAMEWORK_REGISTRY;

  // Lot statistics
  const lotTypes = Object.keys(registry.lots);
  const totalLots = lotTypes.length;

  const lotCriticalityDistribution: Record<LotCriticalityLevel, number> = {
    low: 0,
    medium: 0,
    high: 0,
    critical: 0,
  };

  Object.values(registry.lots).forEach((lot) => {
    lotCriticalityDistribution[lot.criticality]++;
  });

  // Obligation statistics
  const obligationIds = Object.keys(registry.obligations);
  const totalObligations = obligationIds.length;

  const obligationRiskTypeDistribution: Record<RiskType, number> = {
    safety: 0,
    financial: 0,
    administrative: 0,
    technical: 0,
    commercial: 0,
  };

  const obligationSeverityDistribution: Record<SeverityLevel, number> = {
    low: 0,
    medium: 0,
    high: 0,
    critical: 0,
  };

  Object.values(registry.obligations).forEach((obl) => {
    obligationRiskTypeDistribution[obl.riskType]++;
    obligationSeverityDistribution[obl.severity]++;
  });

  // Grade blocking analysis
  const obligationsBlockingGrades = {
    blockingA: obligationIds.filter(
      (id) => registry.obligations[id].blocksGradeAbove === 'A'
    ),
    blockingB: obligationIds.filter(
      (id) => registry.obligations[id].blocksGradeAbove === 'B'
    ),
    blockingC: obligationIds.filter(
      (id) => registry.obligations[id].blocksGradeAbove === 'C'
    ),
    blockingD: obligationIds.filter(
      (id) => registry.obligations[id].blocksGradeAbove === 'D'
    ),
  };

  // Build cross-reference maps
  const lotObligationMap: Record<string, string[]> = {};
  Object.entries(registry.lots).forEach(([lotType, lot]) => {
    lotObligationMap[lotType] = lot.expectedObligations;
  });

  const obligationLotMap: Record<string, string[]> = {};
  obligationIds.forEach((obligationId) => {
    const relatedLots = registry.obligations[obligationId].relatedLots || [];
    obligationLotMap[obligationId] = relatedLots;
  });

  return {
    version: registry.metadata?.version || '1.0',
    description: registry.metadata?.description || 'TORP Trust Framework Registry',

    totalLots,
    lotTypes,
    lotCriticalityDistribution,

    totalObligations,
    obligationIds,
    obligationRiskTypeDistribution,
    obligationSeverityDistribution,

    obligationsBlockingGrades,

    lotObligationMap,
    obligationLotMap,

    createdAt: registry.metadata?.createdAt || new Date().toISOString(),
  };
}

/**
 * Get summary statistics
 */
export function getSummaryStatistics(): {
  totalLots: number;
  totalObligations: number;
  criticalLots: number;
  criticalObligations: number;
  averageObligationsPerLot: number;
} {
  const metadata = getTrustFrameworkMetadata();

  const criticalLots =
    (metadata.lotCriticalityDistribution.critical || 0) +
    (metadata.lotCriticalityDistribution.high || 0);

  const criticalObligations =
    (metadata.obligationSeverityDistribution.critical || 0) +
    (metadata.obligationSeverityDistribution.high || 0);

  const totalExpectedObligations = Object.values(
    metadata.lotObligationMap
  ).reduce((sum, obls) => sum + obls.length, 0);

  const averageObligationsPerLot =
    metadata.totalLots > 0 ? totalExpectedObligations / metadata.totalLots : 0;

  return {
    totalLots: metadata.totalLots,
    totalObligations: metadata.totalObligations,
    criticalLots,
    criticalObligations,
    averageObligationsPerLot: Math.round(averageObligationsPerLot * 10) / 10,
  };
}

/**
 * Format metadata as readable text
 */
export function formatMetadataAsText(): string {
  const metadata = getTrustFrameworkMetadata();
  const summary = getSummaryStatistics();

  let text = `
TRUST FRAMEWORK REGISTRY METADATA
=================================

Version: ${metadata.version}
Created: ${new Date(metadata.createdAt).toLocaleString()}

SUMMARY STATISTICS
==================
Total Lots: ${summary.totalLots}
Total Obligations: ${summary.totalObligations}
Critical Items: ${summary.criticalLots} lots, ${summary.criticalObligations} obligations
Avg Obligations/Lot: ${summary.averageObligationsPerLot}

LOT DISTRIBUTION BY CRITICALITY
================================
Critical: ${metadata.lotCriticalityDistribution.critical} lots
High: ${metadata.lotCriticalityDistribution.high} lots
Medium: ${metadata.lotCriticalityDistribution.medium} lots
Low: ${metadata.lotCriticalityDistribution.low} lots

LOT TYPES
=========
${metadata.lotTypes.map((lot) => `- ${lot}`).join('\n')}

OBLIGATION DISTRIBUTION BY RISK TYPE
=====================================
Safety: ${metadata.obligationRiskTypeDistribution.safety} obligations
Financial: ${metadata.obligationRiskTypeDistribution.financial} obligations
Administrative: ${metadata.obligationRiskTypeDistribution.administrative} obligations
Technical: ${metadata.obligationRiskTypeDistribution.technical} obligations
Commercial: ${metadata.obligationRiskTypeDistribution.commercial} obligations

OBLIGATION DISTRIBUTION BY SEVERITY
====================================
Critical: ${metadata.obligationSeverityDistribution.critical} obligations
High: ${metadata.obligationSeverityDistribution.high} obligations
Medium: ${metadata.obligationSeverityDistribution.medium} obligations
Low: ${metadata.obligationSeverityDistribution.low} obligations

GRADE BLOCKING ANALYSIS
=======================
Blocking Grade A: ${metadata.obligationsBlockingGrades.blockingA.join(', ') || 'None'}
Blocking Grade B: ${metadata.obligationsBlockingGrades.blockingB.join(', ') || 'None'}
Blocking Grade C: ${metadata.obligationsBlockingGrades.blockingC.join(', ') || 'None'}
Blocking Grade D: ${metadata.obligationsBlockingGrades.blockingD.join(', ') || 'None'}

OBLIGATIONS
===========
${metadata.obligationIds.map((id) => `- ${id}`).join('\n')}
`;

  return text.trim();
}

/**
 * Validate consistency of registry
 */
export function validateRegistry(): {
  valid: boolean;
  errors: string[];
  warnings: string[];
} {
  const errors: string[] = [];
  const warnings: string[] = [];
  const registry = TRUST_FRAMEWORK_REGISTRY;

  // Check lot obligations exist
  Object.entries(registry.lots).forEach(([lotType, lot]) => {
    lot.expectedObligations.forEach((oblId) => {
      if (!registry.obligations[oblId]) {
        errors.push(`Lot '${lotType}' references non-existent obligation '${oblId}'`);
      }
    });
  });

  // Check obligation lot references exist
  Object.entries(registry.obligations).forEach(([oblId, obl]) => {
    if (obl.relatedLots) {
      obl.relatedLots.forEach((lotType) => {
        if (!registry.lots[lotType]) {
          errors.push(`Obligation '${oblId}' references non-existent lot '${lotType}'`);
        }
      });
    }
  });

  // Check for unused obligations
  const referencedObligations = new Set<string>();
  Object.values(registry.lots).forEach((lot) => {
    lot.expectedObligations.forEach((oblId) => {
      referencedObligations.add(oblId);
    });
  });

  Object.keys(registry.obligations).forEach((oblId) => {
    if (!referencedObligations.has(oblId)) {
      warnings.push(`Obligation '${oblId}' is not referenced by any lot`);
    }
  });

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Export metadata as JSON
 */
export function exportMetadataAsJSON(): string {
  return JSON.stringify(getTrustFrameworkMetadata(), null, 2);
}
