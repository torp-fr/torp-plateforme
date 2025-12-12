/**
 * Composants du wizard Phase 0
 * Export centralisé pour une utilisation simplifiée
 */

// Composants principaux
export { WizardContainer } from './WizardContainer';
export type { WizardContainerProps, StepComponentProps } from './WizardContainer';

export { WizardProgress } from './WizardProgress';
export type { WizardProgressProps } from './WizardProgress';

export { WizardNavigation } from './WizardNavigation';
export type { WizardNavigationProps } from './WizardNavigation';

// Composants d'étapes
export {
  StepOwnerProfile,
  StepPropertyAddress,
  StepPropertyDetails,
  StepWorkIntent,
  StepConstraints,
  StepSummary,
} from './steps';
