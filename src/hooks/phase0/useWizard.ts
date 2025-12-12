/**
 * Hook de gestion du wizard Phase 0
 * Gère l'état, la navigation et la persistence du wizard
 */

import { useState, useCallback, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { WizardState, WizardStep, WizardAnswer, WizardMode } from '@/types/phase0/wizard.types';
import { Phase0Project } from '@/types/phase0/project.types';
import { WizardService } from '@/services/phase0/wizard.service';
import { Phase0ProjectService } from '@/services/phase0/project.service';
import { ValidationService } from '@/services/phase0/validation.service';
import { DeductionService } from '@/services/phase0/deduction.service';
import { useApp } from '@/context/AppContext';
import { useToast } from '@/hooks/use-toast';

export interface UseWizardOptions {
  projectId?: string;
  mode?: WizardMode;
  onComplete?: (project: Phase0Project) => void;
}

export interface UseWizardReturn {
  // État
  state: WizardState | null;
  project: Partial<Phase0Project> | null;
  currentStep: WizardStep | null;
  isLoading: boolean;
  isSaving: boolean;
  error: string | null;

  // Navigation
  currentStepIndex: number;
  totalSteps: number;
  progress: number;
  canGoNext: boolean;
  canGoPrevious: boolean;

  // Actions
  goToStep: (stepId: string) => void;
  goNext: () => Promise<void>;
  goPrevious: () => void;
  saveAnswer: (questionId: string, value: unknown) => Promise<void>;
  saveAnswers: (answers: Record<string, unknown>) => Promise<void>;
  skipStep: () => void;
  complete: () => Promise<void>;

  // Validation
  stepErrors: string[];
  stepWarnings: string[];
  validateCurrentStep: () => boolean;

  // Helpers
  getAnswer: (questionId: string) => unknown;
  isStepCompleted: (stepId: string) => boolean;
  resetWizard: () => void;
}

export function useWizard(options: UseWizardOptions = {}): UseWizardReturn {
  const { projectId, mode = 'b2c', onComplete } = options;

  const navigate = useNavigate();
  const { user, isLoading: isAuthLoading } = useApp();
  const { toast } = useToast();

  // États
  const [state, setState] = useState<WizardState | null>(null);
  const [project, setProject] = useState<Partial<Phase0Project> | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [stepErrors, setStepErrors] = useState<string[]>([]);
  const [stepWarnings, setStepWarnings] = useState<string[]>([]);

  // Configuration des étapes
  const steps = useMemo(() => WizardService.getStepsConfig(mode), [mode]);

  // Étape courante
  const currentStepIndex = useMemo(() => {
    if (!state) return 0;
    return state.currentStepIndex || 0;
  }, [state]);

  const currentStep = useMemo(() => {
    if (!steps.length) return null;
    return steps[currentStepIndex] || steps[0];
  }, [steps, currentStepIndex]);

  // Vérification précoce de l'authentification
  useEffect(() => {
    // Attendre que l'auth soit chargée
    if (isAuthLoading) return;

    // Si l'utilisateur n'est pas connecté après le chargement de l'auth
    if (!user) {
      console.warn('[useWizard] Utilisateur non connecté - redirection vers login');
      setError('Vous devez être connecté pour accéder au wizard');
      toast({
        title: 'Connexion requise',
        description: 'Veuillez vous connecter pour définir votre projet',
        variant: 'destructive',
      });
      navigate('/login', { state: { from: `/phase0/wizard${projectId ? `/${projectId}` : ''}` } });
    }
  }, [isAuthLoading, user, navigate, toast, projectId]);

  // Initialisation
  useEffect(() => {
    // Ne pas initialiser si l'auth est en cours de chargement ou si pas d'utilisateur
    if (isAuthLoading || !user) return;

    const initialize = async () => {
      setIsLoading(true);
      setError(null);

      try {
        if (projectId) {
          // Charger un projet existant
          const existingProject = await Phase0ProjectService.getProjectById(projectId);
          if (!existingProject) {
            throw new Error('Projet non trouvé');
          }
          setProject(existingProject);

          // Charger l'état du wizard
          const wizardState = await WizardService.getWizardState(projectId);
          setState(wizardState || WizardService.initializeWizardState(mode, steps));
        } else {
          // Nouveau projet
          setProject({});
          setState(WizardService.initializeWizardState(mode, steps));
        }
      } catch (err) {
        console.error('Erreur initialisation wizard:', err);
        setError(err instanceof Error ? err.message : 'Erreur lors du chargement');
      } finally {
        setIsLoading(false);
      }
    };

    initialize();
  }, [projectId, mode, steps, isAuthLoading, user]);

  // Navigation
  const canGoNext = useMemo(() => {
    if (!currentStep) return false;
    if (currentStep.isOptional) return true;

    // Vérifier que les champs requis sont remplis
    const validation = ValidationService.canProceedToNextStep(project || {}, currentStepIndex + 1);
    return validation.canProceed;
  }, [currentStep, project, currentStepIndex]);

  const canGoPrevious = useMemo(() => {
    return currentStepIndex > 0;
  }, [currentStepIndex]);

  const progress = useMemo(() => {
    if (!state) return 0;
    return WizardService.calculateProgress(state, steps);
  }, [state, steps]);

  // Actions
  const goToStep = useCallback((stepId: string) => {
    if (!state) return;

    const targetIndex = steps.findIndex(s => s.id === stepId);
    if (targetIndex < 0) return;

    // Ne pas autoriser de sauter des étapes non complétées (sauf retour en arrière)
    const targetStep = steps[targetIndex];
    const completedSteps = state.completedSteps || [];
    const canNavigate = targetIndex <= currentStepIndex ||
      completedSteps.includes(targetIndex + 1) ||
      targetStep.isOptional;

    if (!canNavigate) {
      toast({
        title: 'Navigation impossible',
        description: 'Veuillez compléter les étapes précédentes',
        variant: 'destructive',
      });
      return;
    }

    setState(prev => prev ? {
      ...prev,
      currentStepIndex: targetIndex,
    } : null);
  }, [state, steps, currentStepIndex, toast]);

  const goNext = useCallback(async () => {
    if (!state || !currentStep || currentStepIndex >= steps.length - 1) return;

    // Valider l'étape courante (optionnelle pour les étapes marquées comme telles)
    const validation = ValidationService.canProceedToNextStep(project || {}, currentStepIndex + 1);
    if (!validation.canProceed && !currentStep.isOptional) {
      setStepErrors(validation.blockers);
      toast({
        title: 'Informations incomplètes',
        description: validation.blockers[0] || 'Veuillez compléter les champs requis',
        variant: 'destructive',
      });
      return;
    }

    setIsSaving(true);
    try {
      // Appliquer les déductions automatiques
      if (project && project.id) {
        const updatedProject = await DeductionService.applyDeductions(project as Phase0Project);
        setProject(updatedProject);
      }

      // Marquer l'étape comme complétée (numéro de l'étape, 1-indexed)
      const stepNumber = currentStepIndex + 1;
      const completedSteps = state.completedSteps || [];
      const newCompletedSteps = completedSteps.includes(stepNumber)
        ? completedSteps
        : [...completedSteps, stepNumber];

      const nextStepIndex = currentStepIndex + 1;

      setState(prev => prev ? {
        ...prev,
        currentStepIndex: nextStepIndex,
        completedSteps: newCompletedSteps,
      } : null);

      setStepErrors([]);
      setStepWarnings([]);

      // Sauvegarder si on a un projet
      if (projectId) {
        await WizardService.completeStep(projectId, currentStep.id, state.answers);
      }
    } catch (err) {
      console.error('Erreur passage étape suivante:', err);
      toast({
        title: 'Erreur',
        description: 'Impossible de passer à l\'étape suivante',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  }, [state, currentStep, currentStepIndex, steps, project, projectId, toast]);

  const goPrevious = useCallback(() => {
    if (!state || currentStepIndex <= 0) return;

    setState(prev => prev ? {
      ...prev,
      currentStepIndex: currentStepIndex - 1,
    } : null);

    setStepErrors([]);
    setStepWarnings([]);
  }, [state, currentStepIndex]);

  const saveAnswer = useCallback(async (questionId: string, value: unknown) => {
    if (!state) return;

    const newAnswers = {
      ...state.answers,
      [questionId]: { questionId, value, answeredAt: new Date() } as WizardAnswer,
    };

    setState(prev => prev ? {
      ...prev,
      answers: newAnswers,
      lastUpdated: new Date(),
    } : null);

    // Mettre à jour le projet selon la question
    updateProjectFromAnswer(questionId, value);

    // Sauvegarder si on a un projet
    if (projectId) {
      try {
        await WizardService.saveAnswer(projectId, questionId, value);
      } catch (err) {
        console.error('Erreur sauvegarde réponse:', err);
      }
    }
  }, [state, projectId]);

  const saveAnswers = useCallback(async (answers: Record<string, unknown>) => {
    if (!state) return;

    const newAnswers = { ...state.answers };
    Object.entries(answers).forEach(([questionId, value]) => {
      newAnswers[questionId] = { questionId, value, answeredAt: new Date() };
      updateProjectFromAnswer(questionId, value);
    });

    setState(prev => prev ? {
      ...prev,
      answers: newAnswers,
      lastUpdated: new Date(),
    } : null);

    if (projectId) {
      try {
        await WizardService.saveAnswers(projectId, answers);
      } catch (err) {
        console.error('Erreur sauvegarde réponses:', err);
      }
    }
  }, [state, projectId]);

  const updateProjectFromAnswer = (questionId: string, value: unknown) => {
    setProject(prev => {
      if (!prev) return prev;

      // Parser le questionId pour mettre à jour la bonne partie du projet
      // Format: section.field ou section.subsection.field
      const parts = questionId.split('.');

      if (parts.length < 2) return prev;

      const section = parts[0];
      const field = parts.slice(1).join('.');

      switch (section) {
        case 'owner':
          // Map 'owner' to 'ownerProfile' for Phase0Project compatibility
          return {
            ...prev,
            ownerProfile: setNestedValue(prev.ownerProfile || {}, field, value),
          };
        case 'property':
          return {
            ...prev,
            property: setNestedValue(prev.property || {}, field, value),
          };
        case 'workProject':
          return {
            ...prev,
            workProject: setNestedValue(prev.workProject || {}, field, value),
          };
        case 'selectedLots':
          return {
            ...prev,
            selectedLots: value as unknown[],
          };
        default:
          return prev;
      }
    });
  };

  const skipStep = useCallback(() => {
    if (!currentStep?.isOptional) return;
    goNext();
  }, [currentStep, goNext]);

  const complete = useCallback(async () => {
    if (!state || !project) return;

    // Valider le projet - mais ne pas bloquer
    // L'utilisateur a déjà passé les étapes de validation essentielles
    const validation = ValidationService.validateProject(project, 'minimal');
    if (!validation.isValid) {
      // Afficher un avertissement mais ne pas bloquer
      console.warn('Projet avec informations partielles:', validation.validations
        .filter(v => !v.isValid)
        .map(v => v.message));
    }

    setIsSaving(true);
    try {
      let finalProject: Phase0Project;

      if (projectId) {
        // Mettre à jour le projet existant
        finalProject = await Phase0ProjectService.updateProject(projectId, project);
        await Phase0ProjectService.changeStatus(projectId, 'in_progress');
      } else {
        // Créer un nouveau projet
        if (!user?.id) {
          throw new Error('Utilisateur non connecté');
        }
        finalProject = await Phase0ProjectService.createProject(user.id, project);
      }

      toast({
        title: 'Projet créé avec succès',
        description: `Référence: ${finalProject.reference}`,
      });

      if (onComplete) {
        onComplete(finalProject);
      } else {
        navigate(`/phase0/project/${finalProject.id}`);
      }
    } catch (err) {
      console.error('Erreur finalisation projet:', err);
      const errorMessage = err instanceof Error ? err.message : 'Erreur inconnue';
      const isAuthError = errorMessage.includes('non connecté') || errorMessage.includes('Utilisateur');

      toast({
        title: isAuthError ? 'Connexion requise' : 'Erreur',
        description: isAuthError
          ? 'Vous devez être connecté pour créer un projet. Veuillez vous connecter puis réessayer.'
          : `Impossible de finaliser le projet: ${errorMessage}`,
        variant: 'destructive',
      });

      // Rediriger vers login si c'est une erreur d'authentification
      if (isAuthError) {
        navigate('/login', { state: { from: `/phase0/wizard` } });
      }
    } finally {
      setIsSaving(false);
    }
  }, [state, project, projectId, user, onComplete, navigate, toast]);

  const validateCurrentStep = useCallback((): boolean => {
    if (!currentStep || !project) return false;

    const validation = ValidationService.canProceedToNextStep(project, currentStepIndex + 1);
    setStepErrors(validation.blockers);

    return validation.canProceed;
  }, [currentStep, project, currentStepIndex]);

  const getAnswer = useCallback((questionId: string): unknown => {
    if (!state?.answers[questionId]) return undefined;
    return state.answers[questionId].value;
  }, [state]);

  const isStepCompleted = useCallback((stepId: string): boolean => {
    if (!state?.completedSteps) return false;
    const stepIndex = steps.findIndex(s => s.id === stepId);
    if (stepIndex < 0) return false;
    return state.completedSteps.includes(stepIndex + 1);
  }, [state, steps]);

  const resetWizard = useCallback(() => {
    setState(WizardService.initializeWizardState(mode, steps));
    setProject({});
    setStepErrors([]);
    setStepWarnings([]);
    setError(null);
  }, [mode, steps]);

  return {
    // État
    state,
    project,
    currentStep,
    isLoading,
    isSaving,
    error,

    // Navigation
    currentStepIndex,
    totalSteps: steps.length,
    progress,
    canGoNext,
    canGoPrevious,

    // Actions
    goToStep,
    goNext,
    goPrevious,
    saveAnswer,
    saveAnswers,
    skipStep,
    complete,

    // Validation
    stepErrors,
    stepWarnings,
    validateCurrentStep,

    // Helpers
    getAnswer,
    isStepCompleted,
    resetWizard,
  };
}

// Utilitaire pour définir une valeur imbriquée dans un objet
function setNestedValue<T extends Record<string, unknown>>(obj: T, path: string, value: unknown): T {
  const parts = path.split('.');
  const result = { ...obj } as T;

  let current: Record<string, unknown> = result;
  for (let i = 0; i < parts.length - 1; i++) {
    const key = parts[i];
    current[key] = { ...(current[key] as Record<string, unknown> || {}) };
    current = current[key] as Record<string, unknown>;
  }

  current[parts[parts.length - 1]] = value;
  return result;
}

export default useWizard;
