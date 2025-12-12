/**
 * Conteneur principal du wizard Phase 0
 * Orchestre les étapes, la navigation et l'affichage
 */

import React, { useCallback, useMemo } from 'react';
import { cn } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertTriangle, Info, Loader2 } from 'lucide-react';
import { useWizard, UseWizardOptions } from '@/hooks/phase0/useWizard';
import { WizardProgress } from './WizardProgress';
import { WizardNavigation } from './WizardNavigation';
import { WizardService } from '@/services/phase0/wizard.service';

// Import des composants d'étapes
import { StepOwnerProfile } from './steps/StepOwnerProfile';
import { StepPropertyAddress } from './steps/StepPropertyAddress';
import { StepPropertyDetails } from './steps/StepPropertyDetails';
import { StepWorkIntent } from './steps/StepWorkIntent';
import { StepConstraints } from './steps/StepConstraints';
import { StepSummary } from './steps/StepSummary';

export interface WizardContainerProps extends UseWizardOptions {
  className?: string;
}

// Map des composants d'étapes
const STEP_COMPONENTS: Record<string, React.ComponentType<StepComponentProps>> = {
  'owner-profile': StepOwnerProfile,
  'property-address': StepPropertyAddress,
  'property-details': StepPropertyDetails,
  'work-intent': StepWorkIntent,
  'constraints': StepConstraints,
  'summary': StepSummary,
};

export interface StepComponentProps {
  project: Record<string, unknown>;
  answers: Record<string, unknown>;
  onAnswerChange: (questionId: string, value: unknown) => void;
  onAnswersChange: (answers: Record<string, unknown>) => void;
  errors: string[];
  isProcessing: boolean;
}

export function WizardContainer({ className, ...options }: WizardContainerProps) {
  const wizard = useWizard(options);
  const stepsConfig = useMemo(() => WizardService.getStepsConfig(options.mode || 'b2c'), [options.mode]);

  // Récupérer le composant pour l'étape courante
  const StepComponent = useMemo(() => {
    if (!wizard.currentStep) return null;
    return STEP_COMPONENTS[wizard.currentStep.id] || null;
  }, [wizard.currentStep]);

  // Handlers
  const handleStepClick = useCallback((stepId: string) => {
    wizard.goToStep(stepId);
  }, [wizard]);

  const handleAnswerChange = useCallback((questionId: string, value: unknown) => {
    wizard.saveAnswer(questionId, value);
  }, [wizard]);

  const handleAnswersChange = useCallback((answers: Record<string, unknown>) => {
    wizard.saveAnswers(answers);
  }, [wizard]);

  const handleSaveDraft = useCallback(async () => {
    // TODO: Implémenter la sauvegarde brouillon
    console.log('Sauvegarde brouillon...');
  }, []);

  // Affichage chargement
  if (wizard.isLoading) {
    return (
      <div className={cn('flex items-center justify-center min-h-[400px]', className)}>
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin mx-auto text-primary" />
          <p className="mt-4 text-muted-foreground">Chargement du projet...</p>
        </div>
      </div>
    );
  }

  // Affichage erreur
  if (wizard.error) {
    return (
      <div className={cn('p-4', className)}>
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>{wizard.error}</AlertDescription>
        </Alert>
      </div>
    );
  }

  // Préparer les données pour le composant d'étape
  const stepProps: StepComponentProps = {
    project: (wizard.project || {}) as Record<string, unknown>,
    answers: Object.fromEntries(
      Object.entries(wizard.state?.answers || {}).map(([k, v]) => [k, v.value])
    ),
    onAnswerChange: handleAnswerChange,
    onAnswersChange: handleAnswersChange,
    errors: wizard.stepErrors,
    isProcessing: wizard.isSaving,
  };

  return (
    <div className={cn('w-full max-w-4xl mx-auto', className)}>
      {/* Progression */}
      <WizardProgress
        steps={stepsConfig.map(s => ({
          id: s.id,
          title: s.title,
          description: s.description,
          isOptional: s.isOptional,
        }))}
        currentStepId={wizard.currentStep?.id || ''}
        completedStepIds={wizard.state?.completedStepIds || []}
        onStepClick={handleStepClick}
        isProcessing={wizard.isSaving}
        className="mb-8"
      />

      {/* Contenu de l'étape */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            {wizard.currentStep?.icon && (
              <span className="text-primary">{wizard.currentStep.icon}</span>
            )}
            {wizard.currentStep?.title}
          </CardTitle>
          {wizard.currentStep?.description && (
            <CardDescription>{wizard.currentStep.description}</CardDescription>
          )}
        </CardHeader>

        <CardContent className="space-y-6">
          {/* Erreurs de l'étape */}
          {wizard.stepErrors.length > 0 && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                <ul className="list-disc list-inside space-y-1">
                  {wizard.stepErrors.map((error, index) => (
                    <li key={index}>{error}</li>
                  ))}
                </ul>
              </AlertDescription>
            </Alert>
          )}

          {/* Avertissements */}
          {wizard.stepWarnings.length > 0 && (
            <Alert>
              <Info className="h-4 w-4" />
              <AlertDescription>
                <ul className="list-disc list-inside space-y-1">
                  {wizard.stepWarnings.map((warning, index) => (
                    <li key={index}>{warning}</li>
                  ))}
                </ul>
              </AlertDescription>
            </Alert>
          )}

          {/* Composant de l'étape */}
          {StepComponent ? (
            <StepComponent {...stepProps} />
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              Étape non implémentée: {wizard.currentStep?.id}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Navigation */}
      <WizardNavigation
        canGoPrevious={wizard.canGoPrevious}
        canGoNext={wizard.canGoNext}
        isFirstStep={wizard.currentStepIndex === 0}
        isLastStep={wizard.currentStepIndex === wizard.totalSteps - 1}
        isOptionalStep={wizard.currentStep?.isOptional}
        isLoading={wizard.isLoading}
        isSaving={wizard.isSaving}
        onPrevious={wizard.goPrevious}
        onNext={wizard.goNext}
        onSkip={wizard.skipStep}
        onSaveDraft={handleSaveDraft}
        onComplete={wizard.complete}
        className="mt-6"
      />

      {/* Info progression */}
      <div className="mt-4 text-center text-sm text-muted-foreground">
        Étape {wizard.currentStepIndex + 1} sur {wizard.totalSteps} •
        Progression: {wizard.progress}%
      </div>
    </div>
  );
}

export default WizardContainer;
