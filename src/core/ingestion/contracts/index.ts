/**
 * Ingestion Contracts - Centralized exports
 * All pipeline contracts for type safety and documentation
 */

export type { RawDocument } from './rawDocument.contract'
export type { ParsedDocument } from './parsedDocument.contract'
export type { ExtractedDevisData } from './extractedDevisData.contract'
export type { NormalizedDevisData } from './normalizedDevisData.contract'
export type { DevisAggregate, LotAggregate, EntrepriseAggregate } from './domainAggregate.contract'
export type { ValidatedDevisAggregate, ValidationReport } from './validatedAggregate.contract'
