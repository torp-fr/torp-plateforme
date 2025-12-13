/**
 * TORP Phase 0 - Service de gestion du Wizard
 * Gestion du flux de saisie et de la progression
 */

import { supabase } from '@/lib/supabase';
import type {
  WizardState,
  WizardProgress,
  WizardAnswer,
  WizardAnswers,
  StepProgress,
  StepStatus,
  WizardMode,
  B2C_WIZARD_STEPS,
  QuestionValue,
} from '@/types/phase0';
import { phase0ProjectService } from './project.service';

// =============================================================================
// TYPES
// =============================================================================

interface WizardProgressRow {
  id: string;
  project_id: string;
  current_step: number;
  total_steps: number;
  step_data: Record<string, WizardAnswers>;
  step_completion: Record<string, StepProgress>;
  pending_deductions: unknown[];
  validation_errors: unknown[];
  session_id: string | null;
  session_started_at: string | null;
  last_active_at: string;
  total_time_spent: number;
  device_type: string | null;
  browser: string | null;
  created_at: string;
  updated_at: string;
}

// =============================================================================
// WIZARD STEPS CONFIGURATION
// =============================================================================

export const WIZARD_STEPS_B2C = [
  {
    id: 'step_profile',
    number: 1,
    name: 'Vous & votre projet',
    shortName: 'Profil',
    description: 'Quelques questions pour mieux vous connaître',
    icon: 'user',
    estimatedMinutes: 3,
  },
  {
    id: 'step_property',
    number: 2,
    name: 'Votre bien',
    shortName: 'Bien',
    description: 'Décrivez le bien concerné par les travaux',
    icon: 'home',
    estimatedMinutes: 5,
  },
  {
    id: 'step_works',
    number: 3,
    name: 'Vos travaux',
    shortName: 'Travaux',
    description: 'Sélectionnez les travaux à réaliser',
    icon: 'hammer',
    estimatedMinutes: 10,
  },
  {
    id: 'step_constraints',
    number: 4,
    name: 'Aspects pratiques',
    shortName: 'Contraintes',
    description: 'Contraintes et conditions du chantier',
    icon: 'calendar',
    estimatedMinutes: 3,
  },
  {
    id: 'step_budget',
    number: 5,
    name: 'Financement',
    shortName: 'Budget',
    description: 'Budget et modalités de financement',
    icon: 'euro',
    estimatedMinutes: 3,
  },
  {
    id: 'step_summary',
    number: 6,
    name: 'Validation',
    shortName: 'Récap',
    description: 'Récapitulatif et génération du cahier des charges',
    icon: 'check-circle',
    estimatedMinutes: 5,
  },
];

/**
 * Configuration des étapes du wizard B2B (professionnel)
 * Adapté pour les entreprises qui interviennent chez leurs clients
 */
export const WIZARD_STEPS_B2B = [
  {
    id: 'step_client',
    number: 1,
    name: 'Client & Projet',
    shortName: 'Client',
    description: 'Informations du maître d\'ouvrage / donneur d\'ordres',
    icon: 'users',
    estimatedMinutes: 4,
  },
  {
    id: 'step_site',
    number: 2,
    name: 'Site d\'intervention',
    shortName: 'Site',
    description: 'Adresse et caractéristiques du lieu des travaux',
    icon: 'map-pin',
    estimatedMinutes: 5,
  },
  {
    id: 'step_works',
    number: 3,
    name: 'Travaux à réaliser',
    shortName: 'Travaux',
    description: 'Sélection des lots et prestations',
    icon: 'hammer',
    estimatedMinutes: 10,
  },
  {
    id: 'step_constraints',
    number: 4,
    name: 'Contraintes chantier',
    shortName: 'Chantier',
    description: 'Accès, planning et conditions d\'exécution',
    icon: 'calendar',
    estimatedMinutes: 3,
  },
  {
    id: 'step_budget',
    number: 5,
    name: 'Budget & Conditions',
    shortName: 'Budget',
    description: 'Enveloppe budgétaire et conditions commerciales',
    icon: 'euro',
    estimatedMinutes: 3,
    isOptional: true,
  },
  {
    id: 'step_summary',
    number: 6,
    name: 'Validation & Documents',
    shortName: 'Documents',
    description: 'Récapitulatif et génération du DCE/CCTP',
    icon: 'file-text',
    estimatedMinutes: 5,
  },
];

// =============================================================================
// TYPES EXPORTS
// =============================================================================

export interface WizardStepConfig {
  id: string;
  number: number;
  name: string;
  shortName: string;
  description: string;
  icon: string;
  estimatedMinutes: number;
  isOptional?: boolean;
}

export interface WizardQuestionConfig {
  id: string;
  type: string;
  label: string;
  required: boolean;
}

export interface WizardFieldConfig {
  id: string;
  type: string;
  label: string;
}

// =============================================================================
// SERVICE
// =============================================================================

export class WizardService {
  // Static methods for compatibility with useWizard hook

  /**
   * Get wizard steps configuration based on mode
   */
  static getStepsConfig(mode: WizardMode = 'b2c'): WizardStepConfig[] {
    // Mode B2B professionnel : utilise les steps B2B adaptés
    if (mode === 'b2b' || mode === 'b2b_professional') {
      return WIZARD_STEPS_B2B.map(step => ({
        ...step,
        isOptional: step.isOptional || false,
      }));
    }
    // Mode B2C : steps classiques
    return WIZARD_STEPS_B2C.map(step => ({ ...step, isOptional: false }));
  }

  /**
   * Vérifie si le mode est B2B
   */
  static isB2BMode(mode: WizardMode): boolean {
    return mode === 'b2b' || mode === 'b2b_professional';
  }

  /**
   * Initialize a new wizard state (static version)
   */
  static initializeWizardState(mode: WizardMode, steps: WizardStepConfig[]): WizardState {
    const stepProgress: StepProgress[] = steps.map((step, index) => ({
      stepId: step.id,
      stepNumber: step.number,
      status: index === 0 ? 'in_progress' : 'not_started',
      completionPercentage: 0,
      answeredQuestions: 0,
      totalQuestions: 0,
      validationErrors: 0,
      timeSpent: 0,
    }));

    return {
      projectId: '',
      currentStepIndex: 0,
      completedSteps: [],
      answers: {},
      aiDeductions: [],
      validationErrors: [],
      alerts: [],
      progress: {
        overallPercentage: 0,
        stepProgress,
        estimatedTimeRemaining: steps.reduce((acc, s) => acc + s.estimatedMinutes, 0),
        lastSaved: new Date().toISOString(),
        autoSaveEnabled: true,
      },
      metadata: {
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        createdBy: '',
        wizardMode: mode === 'b2c' ? 'b2c_simple' : 'b2b_professional',
        version: 1,
        sessionDuration: 0,
        abandonedSteps: [],
      },
    };
  }

  /**
   * Get wizard state for a project (static version)
   */
  static async getWizardState(projectId: string): Promise<WizardState | null> {
    return wizardServiceInstance.getWizardState(projectId);
  }

  /**
   * Calculate progress (static version)
   */
  static calculateProgress(state: WizardState, steps: WizardStepConfig[]): number {
    if (!state || !steps.length) return 0;
    const completedCount = state.completedSteps?.length || 0;
    return Math.round((completedCount / steps.length) * 100);
  }

  /**
   * Complete a step (static version)
   */
  static async completeStep(
    projectId: string,
    stepId: string,
    answers: WizardAnswers
  ): Promise<void> {
    await wizardServiceInstance.saveAnswers(projectId, stepId,
      Object.fromEntries(
        Object.entries(answers).map(([k, v]) => [k, v.value])
      )
    );
    await wizardServiceInstance.completeStep(projectId, stepId);
  }

  /**
   * Save a single answer (static version)
   */
  static async saveAnswer(
    projectId: string,
    questionId: string,
    value: unknown
  ): Promise<void> {
    await wizardServiceInstance.saveAnswer(projectId, 'current', questionId, value as QuestionValue);
  }

  /**
   * Save multiple answers (static version)
   */
  static async saveAnswers(
    projectId: string,
    answers: Record<string, unknown>
  ): Promise<void> {
    await wizardServiceInstance.saveAnswers(projectId, 'current', answers as Record<string, QuestionValue>);
  }
  /**
   * Récupérer l'état du wizard pour un projet
   */
  async getWizardState(projectId: string): Promise<WizardState | null> {
    const { data, error } = await supabase
      .from('phase0_wizard_progress')
      .select('*')
      .eq('project_id', projectId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        // Créer un nouvel état wizard
        return this.initializeWizardState(projectId);
      }
      console.error('Error fetching wizard state:', error);
      throw new Error(`Erreur lors de la récupération du wizard: ${error.message}`);
    }

    return this.mapRowToState(data, projectId);
  }

  /**
   * Initialiser l'état du wizard pour un nouveau projet
   */
  async initializeWizardState(projectId: string): Promise<WizardState> {
    const initialState: Partial<WizardProgressRow> = {
      project_id: projectId,
      current_step: 1,
      total_steps: 6,
      step_data: {},
      step_completion: {},
      pending_deductions: [],
      validation_errors: [],
      session_id: this.generateSessionId(),
      session_started_at: new Date().toISOString(),
      total_time_spent: 0,
    };

    const { data, error } = await supabase
      .from('phase0_wizard_progress')
      .upsert(initialState, { onConflict: 'project_id' })
      .select()
      .single();

    if (error) {
      console.error('Error initializing wizard state:', error);
      throw new Error(`Erreur lors de l'initialisation du wizard: ${error.message}`);
    }

    return this.mapRowToState(data, projectId);
  }

  /**
   * Sauvegarder une réponse
   */
  async saveAnswer(
    projectId: string,
    stepId: string,
    questionId: string,
    value: QuestionValue,
    source: WizardAnswer['source'] = 'user_input'
  ): Promise<void> {
    const currentState = await this.getWizardState(projectId);
    if (!currentState) {
      throw new Error('État wizard non trouvé');
    }

    const stepData = currentState.answers || {};

    const answer: WizardAnswer = {
      questionId,
      value,
      source,
      timestamp: new Date().toISOString(),
      confidence: source === 'user_input' ? 'high' : 'medium',
      validated: source === 'user_input',
      modified: false,
    };

    stepData[questionId] = answer;

    const { error } = await supabase
      .from('phase0_wizard_progress')
      .update({
        step_data: { ...currentState.metadata, [stepId]: stepData },
        last_active_at: new Date().toISOString(),
      })
      .eq('project_id', projectId);

    if (error) {
      console.error('Error saving answer:', error);
      throw new Error(`Erreur lors de la sauvegarde: ${error.message}`);
    }
  }

  /**
   * Sauvegarder plusieurs réponses d'un coup
   */
  async saveAnswers(
    projectId: string,
    stepId: string,
    answers: Record<string, QuestionValue>
  ): Promise<void> {
    const currentState = await this.getWizardState(projectId);
    if (!currentState) {
      throw new Error('État wizard non trouvé');
    }

    const stepData: WizardAnswers = {};

    for (const [questionId, value] of Object.entries(answers)) {
      stepData[questionId] = {
        questionId,
        value,
        source: 'user_input',
        timestamp: new Date().toISOString(),
        confidence: 'high',
        validated: true,
        modified: false,
      };
    }

    // Récupérer les données existantes et fusionner
    const { data: existing } = await supabase
      .from('phase0_wizard_progress')
      .select('step_data')
      .eq('project_id', projectId)
      .single();

    const existingStepData = existing?.step_data || {};
    const updatedStepData = {
      ...existingStepData,
      [stepId]: {
        ...(existingStepData[stepId] || {}),
        ...stepData,
      },
    };

    const { error } = await supabase
      .from('phase0_wizard_progress')
      .update({
        step_data: updatedStepData,
        last_active_at: new Date().toISOString(),
      })
      .eq('project_id', projectId);

    if (error) {
      console.error('Error saving answers:', error);
      throw new Error(`Erreur lors de la sauvegarde: ${error.message}`);
    }
  }

  /**
   * Naviguer vers une étape
   */
  async navigateToStep(projectId: string, stepNumber: number): Promise<void> {
    const { error } = await supabase
      .from('phase0_wizard_progress')
      .update({
        current_step: stepNumber,
        last_active_at: new Date().toISOString(),
      })
      .eq('project_id', projectId);

    if (error) {
      console.error('Error navigating to step:', error);
      throw new Error(`Erreur lors de la navigation: ${error.message}`);
    }

    // Mettre à jour également le projet
    await supabase
      .from('phase0_projects')
      .update({
        current_step: stepNumber,
        last_activity_at: new Date().toISOString(),
      })
      .eq('id', projectId);
  }

  /**
   * Marquer une étape comme complétée
   */
  async completeStep(projectId: string, stepId: string): Promise<void> {
    const currentState = await this.getWizardState(projectId);
    if (!currentState) {
      throw new Error('État wizard non trouvé');
    }

    const stepCompletion = currentState.progress.stepProgress || [];
    const stepIndex = stepCompletion.findIndex(s => s.stepId === stepId);

    const completedStep: StepProgress = {
      stepId,
      stepNumber: WIZARD_STEPS_B2C.find(s => s.id === stepId)?.number || 0,
      status: 'completed',
      completionPercentage: 100,
      answeredQuestions: 0,
      totalQuestions: 0,
      validationErrors: 0,
      lastVisited: new Date().toISOString(),
      timeSpent: 0,
    };

    if (stepIndex >= 0) {
      stepCompletion[stepIndex] = completedStep;
    } else {
      stepCompletion.push(completedStep);
    }

    const { data: existing } = await supabase
      .from('phase0_wizard_progress')
      .select('step_completion')
      .eq('project_id', projectId)
      .single();

    const updatedCompletion = {
      ...(existing?.step_completion || {}),
      [stepId]: completedStep,
    };

    const { error } = await supabase
      .from('phase0_wizard_progress')
      .update({
        step_completion: updatedCompletion,
        last_active_at: new Date().toISOString(),
      })
      .eq('project_id', projectId);

    if (error) {
      console.error('Error completing step:', error);
      throw new Error(`Erreur lors de la validation de l'étape: ${error.message}`);
    }
  }

  /**
   * Calculer la progression globale
   */
  async calculateProgress(projectId: string): Promise<WizardProgress> {
    const state = await this.getWizardState(projectId);
    if (!state) {
      return {
        overallPercentage: 0,
        stepProgress: [],
        estimatedTimeRemaining: 30,
        lastSaved: new Date().toISOString(),
        autoSaveEnabled: true,
      };
    }

    const stepProgress = state.progress.stepProgress;
    const completedSteps = stepProgress.filter(s => s.status === 'completed').length;
    const totalSteps = WIZARD_STEPS_B2C.length;

    const overallPercentage = Math.round((completedSteps / totalSteps) * 100);

    const remainingSteps = WIZARD_STEPS_B2C.filter(
      step => !stepProgress.find(sp => sp.stepId === step.id && sp.status === 'completed')
    );
    const estimatedTimeRemaining = remainingSteps.reduce(
      (acc, step) => acc + step.estimatedMinutes,
      0
    );

    return {
      overallPercentage,
      stepProgress,
      estimatedTimeRemaining,
      lastSaved: state.metadata.updatedAt,
      autoSaveEnabled: true,
    };
  }

  /**
   * Synchroniser l'état du wizard avec le projet
   */
  async syncWithProject(projectId: string): Promise<void> {
    const state = await this.getWizardState(projectId);
    if (!state) return;

    // Construire les données du projet depuis les réponses du wizard
    const projectUpdates = this.buildProjectDataFromAnswers(state.answers);

    await phase0ProjectService.updateProject({
      projectId,
      updates: projectUpdates,
      source: 'wizard',
    });
  }

  /**
   * Obtenir les questions d'une étape
   */
  getStepQuestions(stepId: string, mode: WizardMode = 'b2c_simple'): unknown[] {
    // Les questions sont définies dans le composant wizard
    // Ce service retourne la configuration de base
    const stepConfig = WIZARD_STEPS_B2C.find(s => s.id === stepId);
    return stepConfig ? [stepConfig] : [];
  }

  /**
   * Valider une étape
   */
  async validateStep(
    projectId: string,
    stepId: string,
    answers: WizardAnswers
  ): Promise<{ isValid: boolean; errors: string[] }> {
    const errors: string[] = [];

    // Validation basique par étape
    switch (stepId) {
      case 'step_profile':
        if (!answers['owner_type']?.value) {
          errors.push('Veuillez indiquer votre statut');
        }
        if (!answers['address']?.value) {
          errors.push('Veuillez indiquer l\'adresse du bien');
        }
        break;

      case 'step_property':
        if (!answers['property_type']?.value) {
          errors.push('Veuillez indiquer le type de bien');
        }
        if (!answers['surface']?.value) {
          errors.push('Veuillez indiquer la surface');
        }
        break;

      case 'step_works':
        if (!answers['selected_lots']?.value ||
            (Array.isArray(answers['selected_lots']?.value) &&
             answers['selected_lots'].value.length === 0)) {
          errors.push('Veuillez sélectionner au moins un lot de travaux');
        }
        break;

      case 'step_budget':
        if (!answers['budget_range']?.value) {
          errors.push('Veuillez indiquer votre budget');
        }
        break;
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  /**
   * Mettre à jour le temps passé
   */
  async updateTimeSpent(projectId: string, additionalSeconds: number): Promise<void> {
    const { data: existing } = await supabase
      .from('phase0_wizard_progress')
      .select('total_time_spent')
      .eq('project_id', projectId)
      .single();

    const currentTime = existing?.total_time_spent || 0;

    await supabase
      .from('phase0_wizard_progress')
      .update({
        total_time_spent: currentTime + additionalSeconds,
        last_active_at: new Date().toISOString(),
      })
      .eq('project_id', projectId);
  }

  // =============================================================================
  // PRIVATE METHODS
  // =============================================================================

  private generateSessionId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private mapRowToState(row: WizardProgressRow, projectId: string): WizardState {
    const stepProgress: StepProgress[] = WIZARD_STEPS_B2C.map(step => {
      const completion = row.step_completion?.[step.id];
      return {
        stepId: step.id,
        stepNumber: step.number,
        status: (completion?.status as StepStatus) || 'not_started',
        completionPercentage: completion?.completionPercentage || 0,
        answeredQuestions: completion?.answeredQuestions || 0,
        totalQuestions: completion?.totalQuestions || 0,
        validationErrors: completion?.validationErrors || 0,
        lastVisited: completion?.lastVisited,
        timeSpent: completion?.timeSpent || 0,
      };
    });

    // Flatten step_data into answers
    const answers: WizardAnswers = {};
    if (row.step_data) {
      for (const stepAnswers of Object.values(row.step_data)) {
        if (typeof stepAnswers === 'object' && stepAnswers !== null) {
          Object.assign(answers, stepAnswers);
        }
      }
    }

    return {
      projectId,
      currentStepIndex: row.current_step - 1,
      completedSteps: stepProgress
        .filter(s => s.status === 'completed')
        .map(s => s.stepNumber),
      answers,
      aiDeductions: [],
      validationErrors: row.validation_errors as never[],
      alerts: [],
      progress: {
        overallPercentage: Math.round(
          (stepProgress.filter(s => s.status === 'completed').length / WIZARD_STEPS_B2C.length) * 100
        ),
        stepProgress,
        estimatedTimeRemaining: WIZARD_STEPS_B2C.filter(
          (_, idx) => !stepProgress[idx] || stepProgress[idx].status !== 'completed'
        ).reduce((acc, step) => acc + step.estimatedMinutes, 0),
        lastSaved: row.updated_at,
        autoSaveEnabled: true,
      },
      metadata: {
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        createdBy: '',
        wizardMode: 'b2c_simple',
        version: 1,
        device: row.device_type || undefined,
        browser: row.browser || undefined,
        sessionDuration: row.total_time_spent,
        abandonedSteps: [],
      },
    };
  }

  private buildProjectDataFromAnswers(answers: WizardAnswers): Record<string, unknown> {
    const updates: Record<string, unknown> = {};

    // Mapper les réponses vers la structure du projet
    // Cette fonction sera enrichie au fur et à mesure des besoins

    if (answers['owner_type']?.value) {
      updates.ownerProfile = {
        identity: {
          type: answers['owner_type'].value,
        },
      };
    }

    if (answers['address']?.value) {
      const addressValue = answers['address'].value as Record<string, string>;
      updates.property = {
        identification: {
          address: {
            streetName: addressValue.streetName || '',
            postalCode: addressValue.postalCode || '',
            city: addressValue.city || '',
            country: 'France',
          },
        },
      };
    }

    if (answers['budget_range']?.value) {
      const budgetValue = answers['budget_range'].value;
      if (typeof budgetValue === 'object' && budgetValue !== null) {
        updates.workProject = {
          budget: {
            envelope: budgetValue,
          },
        };
      }
    }

    return updates;
  }
}

// Create instance for static methods to use
const wizardServiceInstance = new WizardService();

// Export both the instance and a named export
export const wizardService = wizardServiceInstance;
