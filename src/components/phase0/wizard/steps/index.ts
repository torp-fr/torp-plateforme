/**
 * Export des composants d'étapes du wizard Phase 0
 */

// Étapes B2C
export { StepOwnerProfile } from './StepOwnerProfile';
export { StepPropertyAddress } from './StepPropertyAddress';
export { StepPropertyDetails } from './StepPropertyDetails';
export { StepWorkIntent } from './StepWorkIntent';
export { StepConstraints } from './StepConstraints';
export { StepSummary } from './StepSummary';

// Étapes B2B (voir b2b/index.ts)
export * from './b2b';

// Étapes B2G (secteur public)
export { StepB2GEntity } from './StepB2GEntity';
export { StepB2GMarche } from './StepB2GMarche';
