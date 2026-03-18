/**
 * Shared Analysis Types
 *
 * Single source of truth for types used across:
 *   src/services/contextEngine.service.ts
 *   src/services/checkBuilder.service.ts
 *
 * Import from here, not from the individual services.
 */

/**
 * Regulatory severity of a rule or check.
 *
 * Severity order (descending): critical > high > medium > low > info
 *
 *   critical  — statutory / safety violation: immediate action required
 *   high      — normative / regulatory requirement: must be addressed
 *   medium    — best-practice / recommendation: should be addressed
 *   low       — informative: note for awareness only
 *   info      — inapplicable rules, silenced in context
 */
export type Severity = 'critical' | 'high' | 'medium' | 'low' | 'info';

/**
 * Type of check produced by the checkBuilder.
 *
 *   min_value  — measured value must be ≥ expected_value
 *   max_value  — measured value must be ≤ expected_value
 *   compliance — measured value must fall within a range (see metadata.range_*)
 *   presence   — item/property must exist and be compliant
 */
export type CheckType = 'min_value' | 'max_value' | 'compliance' | 'presence';
