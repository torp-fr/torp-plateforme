// ─────────────────────────────────────────────────────────────────────────────
// src/core/pipelines/index.ts — Central export for all pipeline infrastructure
// ─────────────────────────────────────────────────────────────────────────────

// ── Types ────────────────────────────────────────────────────────────────────
export type {
  PipelineContext,
  PipelineResult,
  APICallConfig,
  LazyLoadedData,
  DevisItem,
  DataNeed,
  ProjectType,
} from './types/index.js';

// ── Base infrastructure ───────────────────────────────────────────────────────
export { BasePipeline } from './handlers/base/BasePipeline.js';
export { PipelineCache } from './handlers/base/PipelineCache.js';
export { PipelineRetry } from './handlers/base/PipelineRetry.js';

// ── Pipeline handlers ─────────────────────────────────────────────────────────
export { ClientLocalizationPipeline } from './handlers/ClientLocalizationPipeline.js';
export { EnrichissementEntreprisePipeline } from './handlers/EnrichissementEntreprisePipeline.js';
export { DevisParsingPipeline } from './handlers/DevisParsingPipeline.js';
export { AuditScoringPipeline } from './handlers/AuditScoringPipeline.js';
export { ContextRegulationPipeline } from './handlers/ContextRegulationPipeline.js';

// ── Shared utilities ──────────────────────────────────────────────────────────
export {
  callAPIWithRetry,
  resolveDataNeeds,
  classifyItemCategory,
  CATEGORY_TO_DOMAIN,
} from './utils/index.js';

// ── Domain inference ──────────────────────────────────────────────────────────
export type { DomainProfile } from './utils/domain-inference.js';
export {
  getDomainProfile,
  inferItemDomain,
  requiresRGE,
  inferDTUsForCategory,
  scoreContractorDomainMatch,
} from './utils/domain-inference.js';

// ── Quality scoring ───────────────────────────────────────────────────────────
export type {
  QualityScore,
  AddressQualityInput,
  EnterpriseQualityInput,
  DevisItemQualityInput,
} from './utils/quality-scorer.js';
export {
  scoreAddressQuality,
  scoreEnterpriseQuality,
  scoreDevisItemQuality,
  aggregateQualityScores,
} from './utils/quality-scorer.js';

// ── Anomaly detection ─────────────────────────────────────────────────────────
export type {
  Anomaly,
  AnomalySeverity,
  AnomalyReport,
  PricingAnomalyInput,
  EnterpriseAnomalyInput,
  ParsingAnomalyInput,
} from './utils/anomaly-detector.js';
export {
  detectPricingAnomalies,
  detectEnterpriseAnomalies,
  detectParsingAnomalies,
  detectStatisticalOutliers,
} from './utils/anomaly-detector.js';

// ── Fallback chain ────────────────────────────────────────────────────────────
export type {
  FallbackResult,
  FallbackStep,
  GeoCoords,
  EnterpriseData,
  RegulatoryData,
} from './utils/fallback-chain.js';
export {
  runFallbackChain,
  buildGeocodingChain,
  buildEnterpriseChain,
  buildRegulatoryChain,
  mergeFallbackResults,
} from './utils/fallback-chain.js';
