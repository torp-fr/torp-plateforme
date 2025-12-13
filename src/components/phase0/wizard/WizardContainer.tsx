/**
 * Conteneur principal du wizard Phase 0
 * Orchestre les étapes, la navigation et l'affichage
 * Supporte les modes B2C (particuliers), B2B (professionnels) et B2G (secteur public)
 */

import React, { useCallback, useMemo, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertTriangle, Info, Loader2 } from 'lucide-react';
import { useWizard, UseWizardOptions, useAutoSave, AutoSaveIndicator } from '@/hooks/phase0';
import { WizardProgress } from './WizardProgress';
import { WizardNavigation } from './WizardNavigation';
import { WizardService } from '@/services/phase0/wizard.service';
import { Phase0ProjectService } from '@/services/phase0';

// Import des composants d'étapes B2C (6 étapes - StepWorkIntent fusionné dans StepRoomDetails)
import { StepOwnerProfile } from './steps/StepOwnerProfile';
import { StepPropertyAddress } from './steps/StepPropertyAddress';
import { StepPropertyDetails } from './steps/StepPropertyDetails';
import { StepRoomDetails } from './steps/StepRoomDetails';
import { StepConstraints } from './steps/StepConstraints';
import { StepSummary } from './steps/StepSummary';

// Import des composants d'étapes B2B optimisés (4 étapes)
import {
  StepB2BClient,
  StepB2BSiteProject,
  StepB2BWorksPlanning,
  StepB2BBudgetValidation,
} from './steps/b2b';

// Import des composants d'étapes B2G (secteur public)
import { StepB2GEntity, StepB2GMarche } from './steps';

export interface WizardContainerProps extends UseWizardOptions {
  className?: string;
}

// Map des composants d'étapes B2C - IDs correspondent à WIZARD_STEPS_B2C (6 étapes)
const STEP_COMPONENTS_B2C: Record<string, React.ComponentType<StepComponentProps>> = {
  'step_profile': StepOwnerProfile,
  'step_property': StepPropertyAddress,
  'step_room_details': StepRoomDetails, // Inclut désormais le type de travaux et les détails par pièce
  'step_constraints': StepConstraints,
  'step_budget': StepPropertyDetails,
  'step_summary': StepSummary,
};

// Map des composants d'étapes B2B optimisés (4 étapes sans redondances)
const STEP_COMPONENTS_B2B: Record<string, React.ComponentType<StepComponentProps>> = {
  'step_client': StepB2BClient,                   // 1. Client (MOA, contact, nature demande)
  'step_site_project': StepB2BSiteProject,        // 2. Site & Projet (adresse, type projet)
  'step_works_planning': StepB2BWorksPlanning,    // 3. Travaux & Planning (description, délais)
  'step_budget_validation': StepB2BBudgetValidation, // 4. Budget & Validation (récap, docs)
};

// Map des composants d'étapes B2G (secteur public - marchés publics)
// IDs doivent correspondre à WIZARD_STEPS_B2G dans wizard.service.ts
const STEP_COMPONENTS_B2G: Record<string, React.ComponentType<StepComponentProps>> = {
  'step_entity': StepB2GEntity,                   // 1. Entité publique (collectivité, SIRET)
  'step_site_patrimoine': StepB2BSiteProject,     // 2. Site & Patrimoine (réutilise composant B2B)
  'step_operation': StepB2BWorksPlanning,         // 3. Opération (réutilise composant B2B)
  'step_marche': StepB2GMarche,                   // 4. Marché public (procédure, allotissement)
  'step_budget_planning': StepB2BBudgetValidation, // 5. Budget & Planning (réutilise composant B2B)
  'step_validation_dce': StepSummary,             // 6. Validation & DCE (résumé adapté)
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
  const mode = options.mode || 'b2c_simple';
  const isB2B = WizardService.isB2BMode(mode);
  const isB2G = WizardService.isB2GMode(mode);
  const stepsConfig = useMemo(() => WizardService.getStepsConfig(mode), [mode]);

  // Préparer les données du projet pour l'auto-save
  const projectDataForSave = useMemo(() => {
    if (!wizard.project) return null;
    return {
      ...wizard.project,
      wizardState: wizard.state,
    } as Partial<import('@/types/phase0/project.types').Phase0Project>;
  }, [wizard.project, wizard.state]);

  // Auto-save hook pour sauvegarder automatiquement les réponses
  const autoSave = useAutoSave(projectDataForSave, {
    projectId: options.projectId,
    enabled: !!options.projectId && !wizard.isLoading,
    debounceMs: 2000,
  });

  // Récupérer le composant pour l'étape courante selon le mode
  const currentStepConfig = stepsConfig[wizard.currentStepIndex];
  const StepComponent = useMemo(() => {
    if (!currentStepConfig) return null;
    // Sélectionner le bon map de composants selon le mode
    let componentsMap: Record<string, React.ComponentType<StepComponentProps>>;
    if (isB2G) {
      componentsMap = STEP_COMPONENTS_B2G;
    } else if (isB2B) {
      componentsMap = STEP_COMPONENTS_B2B;
    } else {
      componentsMap = STEP_COMPONENTS_B2C;
    }
    return componentsMap[currentStepConfig.id] || null;
  }, [currentStepConfig, isB2B, isB2G]);

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
          title: s.name,
          shortTitle: s.shortName,
          description: s.description,
          isOptional: s.isOptional,
        }))}
        currentStepId={wizard.currentStep?.id || stepsConfig[0]?.id || ''}
        completedStepIds={wizard.state?.completedSteps?.map(n => stepsConfig[n - 1]?.id).filter(Boolean) || []}
        onStepClick={handleStepClick}
        isProcessing={wizard.isSaving}
        className="mb-8"
      />

      {/* Contenu de l'étape */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            {stepsConfig[wizard.currentStepIndex]?.name || 'Étape'}
          </CardTitle>
          {stepsConfig[wizard.currentStepIndex]?.description && (
            <CardDescription>{stepsConfig[wizard.currentStepIndex].description}</CardDescription>
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
              Étape non implémentée: {currentStepConfig?.id || 'inconnue'}
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
        isOptionalStep={currentStepConfig?.isOptional}
        isLoading={wizard.isLoading}
        isSaving={wizard.isSaving}
        onPrevious={wizard.goPrevious}
        onNext={wizard.goNext}
        onSkip={wizard.skipStep}
        onSaveDraft={handleSaveDraft}
        onComplete={wizard.complete}
        className="mt-6"
      />

      {/* Info progression et Auto-save */}
      <div className="mt-4 flex items-center justify-between text-sm text-muted-foreground">
        <span>
          Étape {wizard.currentStepIndex + 1} sur {wizard.totalSteps} •
          Progression: {wizard.progress}%
        </span>
        <AutoSaveIndicator
          isSaving={autoSave.isSaving}
          lastSaved={autoSave.lastSaved}
          hasUnsavedChanges={autoSave.hasUnsavedChanges}
          error={autoSave.error}
        />
      </div>
    </div>
  );
}

export default WizardContainer;
