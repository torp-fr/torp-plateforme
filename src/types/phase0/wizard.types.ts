/**
 * TORP Phase 0 - Types du Wizard B2C/B2B
 * Gestion du flux de qualification et de saisie
 */

import type { LotType, LotCategory } from './lots.types';
import type { ConfidenceLevel, Phase0Alert } from './common.types';

// =============================================================================
// CONFIGURATION DU WIZARD
// =============================================================================

export interface WizardConfig {
  mode: WizardMode;
  steps: WizardStep[];
  conditionalLogic: ConditionalRule[];
  saveMode: SaveMode;
  autoSaveInterval: number; // en secondes
  validationMode: ValidationMode;
  aiAssistEnabled: boolean;
  progressTracking: boolean;
}

export type WizardMode = 'b2c_simple' | 'b2c_detailed' | 'b2b_professional' | 'b2g_public';

export type SaveMode = 'auto' | 'manual' | 'step_completion';

export type ValidationMode = 'immediate' | 'step_completion' | 'final';

// =============================================================================
// ÉTAPES DU WIZARD
// =============================================================================

export interface WizardStep {
  id: string;
  number: number;
  name: string;
  description: string;
  icon: string;
  questions: WizardQuestion[];
  sections?: WizardSection[];
  estimatedDuration: number; // en minutes
  mandatory: boolean;
  conditionalDisplay?: StepCondition;
  validationRules: StepValidation[];
  completionCriteria: CompletionCriteria;
  helpContent?: HelpContent;
}

export interface WizardSection {
  id: string;
  title: string;
  description?: string;
  questions: WizardQuestion[];
  collapsible: boolean;
  defaultExpanded: boolean;
  conditionalDisplay?: SectionCondition;
}

export interface StepCondition {
  type: 'always' | 'conditional' | 'user_choice';
  conditions?: ConditionalRule[];
}

export interface SectionCondition {
  questionId: string;
  operator: ConditionOperator;
  value: ConditionValue;
}

export type ConditionOperator =
  | 'equals'
  | 'not_equals'
  | 'contains'
  | 'not_contains'
  | 'greater_than'
  | 'less_than'
  | 'in'
  | 'not_in'
  | 'is_empty'
  | 'is_not_empty';

export type ConditionValue = string | number | boolean | string[] | number[];

export interface StepValidation {
  type: 'required_questions' | 'custom' | 'cross_field';
  config: ValidationConfig;
  errorMessage: string;
}

export interface ValidationConfig {
  requiredQuestionIds?: string[];
  minAnswered?: number;
  customValidator?: string;
  crossFieldRules?: CrossFieldRule[];
}

export interface CrossFieldRule {
  sourceField: string;
  targetField: string;
  rule: string;
  message: string;
}

export interface CompletionCriteria {
  minQuestionsAnswered: number;
  requiredQuestionIds: string[];
  minCompletionPercentage: number;
}

export interface HelpContent {
  title: string;
  description: string;
  tips?: string[];
  faq?: FAQ[];
  videoUrl?: string;
  documentUrl?: string;
}

export interface FAQ {
  question: string;
  answer: string;
}

// =============================================================================
// QUESTIONS DU WIZARD
// =============================================================================

export interface WizardQuestion {
  id: string;
  stepId: string;
  sectionId?: string;
  order: number;
  type: QuestionType;
  label: string;
  placeholder?: string;
  helpText?: string;
  tooltip?: string;
  required: boolean;
  validation?: QuestionValidation;
  options?: QuestionOption[];
  defaultValue?: QuestionValue;
  conditionalDisplay?: QuestionCondition[];
  aiAssist?: AIAssistance;
  dataBinding: DataBinding;
  uiConfig?: UIConfig;
}

export type QuestionType =
  // Basic inputs
  | 'text'
  | 'textarea'
  | 'number'
  | 'email'
  | 'phone'
  | 'date'
  | 'datetime'
  | 'time'
  // Selection
  | 'single_choice'
  | 'multiple_choice'
  | 'dropdown'
  | 'radio'
  | 'checkbox'
  | 'toggle'
  // Advanced
  | 'slider'
  | 'range_slider'
  | 'rating'
  | 'color_picker'
  // Visual
  | 'visual_selector'
  | 'image_choice'
  | 'icon_choice'
  | 'card_selector'
  // Special
  | 'address'
  | 'address_autocomplete'
  | 'file_upload'
  | 'photo_upload'
  | 'document_upload'
  | 'signature'
  // Complex
  | 'lot_selector'
  | 'room_configurator'
  | 'surface_calculator'
  | 'budget_slider'
  | 'timeline_picker'
  | 'material_selector';

export type QuestionValue =
  | string
  | number
  | boolean
  | string[]
  | number[]
  | FileUploadValue
  | AddressValue
  | DateRangeValue
  | BudgetValue
  | null;

export interface QuestionOption {
  value: string;
  label: string;
  description?: string;
  icon?: string;
  image?: string;
  disabled?: boolean;
  recommended?: boolean;
  premium?: boolean;
  helpText?: string;
  linkedQuestions?: string[];
}

export interface QuestionValidation {
  required?: boolean;
  min?: number;
  max?: number;
  minLength?: number;
  maxLength?: number;
  pattern?: string;
  patternMessage?: string;
  customValidator?: string;
  asyncValidator?: string;
}

export interface QuestionCondition {
  questionId: string;
  operator: ConditionOperator;
  value: ConditionValue;
  action: 'show' | 'hide' | 'enable' | 'disable' | 'require';
}

export interface AIAssistance {
  enabled: boolean;
  type: AIAssistType;
  trigger: AITrigger;
  confidence: ConfidenceLevel;
  userCanOverride: boolean;
  source?: string;
  prompt?: string;
}

export type AIAssistType =
  | 'auto_fill'
  | 'suggestion'
  | 'validation'
  | 'photo_analysis'
  | 'document_extraction'
  | 'address_lookup'
  | 'risk_lookup'
  | 'price_estimation';

export type AITrigger =
  | 'on_load'
  | 'on_focus'
  | 'on_blur'
  | 'on_change'
  | 'on_request'
  | 'after_previous';

export interface DataBinding {
  path: string; // ex: "ownerProfile.identity.firstName"
  transform?: string;
  bidirectional: boolean;
}

export interface UIConfig {
  layout?: 'vertical' | 'horizontal' | 'grid';
  columns?: number;
  width?: 'full' | 'half' | 'third' | 'quarter';
  className?: string;
  showLabel?: boolean;
  labelPosition?: 'top' | 'left' | 'right';
  showHelp?: boolean;
  helpPosition?: 'tooltip' | 'below' | 'side';
  animation?: string;
}

// =============================================================================
// VALEURS SPÉCIALES
// =============================================================================

export interface FileUploadValue {
  fileId: string;
  fileName: string;
  fileUrl: string;
  fileType: string;
  fileSize: number;
  uploadedAt: string;
  thumbnailUrl?: string;
  aiAnalysis?: Record<string, unknown>;
}

export interface AddressValue {
  streetNumber?: string;
  streetName: string;
  complement?: string;
  postalCode: string;
  city: string;
  country: string;
  formatted?: string;
  coordinates?: {
    lat: number;
    lng: number;
  };
  banId?: string;
  cadastralRef?: string;
}

export interface DateRangeValue {
  start: string;
  end: string;
}

export interface BudgetValue {
  min: number;
  max: number;
  target: number;
  currency: string;
  flexibility: 'strict' | 'flexible' | 'negotiable';
}

// =============================================================================
// LOGIQUE CONDITIONNELLE
// =============================================================================

export interface ConditionalRule {
  id: string;
  name: string;
  conditions: Condition[];
  operator: 'and' | 'or';
  actions: ConditionalAction[];
  priority: number;
  enabled: boolean;
}

export interface Condition {
  type: 'question' | 'step' | 'computed' | 'external';
  source: string;
  operator: ConditionOperator;
  value: ConditionValue;
}

export interface ConditionalAction {
  type: ActionType;
  target: string;
  value?: unknown;
}

export type ActionType =
  | 'show'
  | 'hide'
  | 'enable'
  | 'disable'
  | 'require'
  | 'unrequire'
  | 'set_value'
  | 'clear_value'
  | 'add_option'
  | 'remove_option'
  | 'navigate_to'
  | 'skip_step'
  | 'trigger_validation'
  | 'trigger_deduction';

// =============================================================================
// ÉTAT DU WIZARD
// =============================================================================

export interface WizardState {
  projectId: string;
  currentStepIndex: number;
  completedSteps: number[];
  answers: WizardAnswers;
  aiDeductions: AIDeduction[];
  validationErrors: ValidationError[];
  alerts: Phase0Alert[];
  progress: WizardProgress;
  metadata: WizardMetadata;
}

export interface WizardAnswers {
  [questionId: string]: WizardAnswer;
}

export interface WizardAnswer {
  questionId: string;
  value: QuestionValue;
  source: AnswerSource;
  timestamp: string;
  confidence: ConfidenceLevel;
  validated: boolean;
  modified: boolean;
  previousValue?: QuestionValue;
}

export type AnswerSource =
  | 'user_input'
  | 'ai_deduction'
  | 'ai_suggestion_accepted'
  | 'document_extraction'
  | 'api_external'
  | 'auto_prefill'
  | 'default'
  | 'restored';

export interface AIDeduction {
  id: string;
  ruleId: string;
  ruleName: string;
  sourceQuestions: string[];
  targetQuestion: string;
  deducedValue: QuestionValue;
  confidence: ConfidenceLevel;
  reasoning?: string;
  accepted: boolean;
  acceptedAt?: string;
  rejectedAt?: string;
  userOverride?: QuestionValue;
}

export interface ValidationError {
  questionId: string;
  stepId: string;
  type: 'required' | 'format' | 'range' | 'custom' | 'cross_field';
  message: string;
  severity: 'error' | 'warning';
}

export interface WizardProgress {
  overallPercentage: number;
  stepProgress: StepProgress[];
  estimatedTimeRemaining: number; // en minutes
  lastSaved: string;
  autoSaveEnabled: boolean;
}

export interface StepProgress {
  stepId: string;
  stepNumber: number;
  status: StepStatus;
  completionPercentage: number;
  answeredQuestions: number;
  totalQuestions: number;
  validationErrors: number;
  lastVisited?: string;
  timeSpent: number; // en secondes
}

export type StepStatus =
  | 'not_started'
  | 'in_progress'
  | 'completed'
  | 'validated'
  | 'error'
  | 'skipped'
  | 'locked';

export interface WizardMetadata {
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  wizardMode: WizardMode;
  version: number;
  device?: string;
  browser?: string;
  sessionDuration: number;
  abandonedSteps: number[];
}

// =============================================================================
// CONFIGURATION DES ÉTAPES B2C
// =============================================================================

export const B2C_WIZARD_STEPS: WizardStepConfig[] = [
  {
    id: 'step_profile',
    number: 1,
    name: 'Vous & votre projet',
    shortName: 'Profil',
    description: 'Quelques questions pour mieux vous connaître',
    icon: 'user',
    estimatedMinutes: 3,
    questionCount: 7,
    sections: ['identity', 'project_type', 'motivation'],
  },
  {
    id: 'step_property',
    number: 2,
    name: 'Votre bien',
    shortName: 'Bien',
    description: 'Décrivez le bien concerné par les travaux',
    icon: 'home',
    estimatedMinutes: 5,
    questionCount: 10,
    sections: ['address', 'characteristics', 'condition'],
  },
  {
    id: 'step_works',
    number: 3,
    name: 'Vos travaux',
    shortName: 'Travaux',
    description: 'Sélectionnez les travaux à réaliser',
    icon: 'hammer',
    estimatedMinutes: 10,
    questionCount: 20,
    sections: ['lot_selection', 'lot_details'],
  },
  {
    id: 'step_constraints',
    number: 4,
    name: 'Aspects pratiques',
    shortName: 'Contraintes',
    description: 'Contraintes et conditions du chantier',
    icon: 'calendar',
    estimatedMinutes: 3,
    questionCount: 7,
    sections: ['occupation', 'schedule', 'access'],
  },
  {
    id: 'step_budget',
    number: 5,
    name: 'Financement',
    shortName: 'Budget',
    description: 'Budget et modalités de financement',
    icon: 'euro',
    estimatedMinutes: 3,
    questionCount: 5,
    sections: ['budget', 'funding', 'aids'],
  },
  {
    id: 'step_summary',
    number: 6,
    name: 'Validation',
    shortName: 'Récap',
    description: 'Récapitulatif et génération du cahier des charges',
    icon: 'check-circle',
    estimatedMinutes: 5,
    questionCount: 0,
    sections: ['summary', 'documents', 'actions'],
  },
];

export interface WizardStepConfig {
  id: string;
  number: number;
  name: string;
  shortName: string;
  description: string;
  icon: string;
  estimatedMinutes: number;
  questionCount: number;
  sections: string[];
}

// =============================================================================
// SÉLECTEUR DE LOTS
// =============================================================================

export interface LotSelectorState {
  availableLots: LotSelectorItem[];
  selectedLots: string[];
  suggestedLots: SuggestedLot[];
  lotsByCategory: Record<LotCategory, LotSelectorItem[]>;
  dependencies: LotDependency[];
  incompatibilities: LotIncompatibility[];
  totalEstimate: LotEstimateTotal;
}

export interface LotSelectorItem {
  lotType: LotType;
  lotNumber: string;
  lotName: string;
  category: LotCategory;
  description: string;
  icon: string;
  selected: boolean;
  mandatory: boolean;
  suggested: boolean;
  suggestedReason?: string;
  estimatedPrice: {
    min: number;
    max: number;
    unit: string;
  };
  rgeEligible: boolean;
  aidesEligible: string[];
  disabled: boolean;
  disabledReason?: string;
}

export interface SuggestedLot {
  lotType: LotType;
  reason: string;
  confidence: ConfidenceLevel;
  source: 'ai_deduction' | 'project_type' | 'complementary' | 'popular';
}

export interface LotDependency {
  sourceLot: LotType;
  targetLot: LotType;
  type: 'requires' | 'recommended';
  message: string;
}

export interface LotIncompatibility {
  lot1: LotType;
  lot2: LotType;
  message: string;
}

export interface LotEstimateTotal {
  minTotal: number;
  maxTotal: number;
  averageTotal: number;
  byCategory: Record<LotCategory, { min: number; max: number }>;
  confidence: ConfidenceLevel;
}

// =============================================================================
// ÉVÉNEMENTS DU WIZARD
// =============================================================================

export type WizardEvent =
  | { type: 'WIZARD_STARTED'; payload: { projectId: string; mode: WizardMode } }
  | { type: 'STEP_ENTERED'; payload: { stepId: string; stepNumber: number } }
  | { type: 'STEP_COMPLETED'; payload: { stepId: string; answers: WizardAnswers } }
  | { type: 'STEP_SKIPPED'; payload: { stepId: string; reason: string } }
  | { type: 'QUESTION_ANSWERED'; payload: { questionId: string; value: QuestionValue } }
  | { type: 'AI_DEDUCTION_APPLIED'; payload: { deductionId: string; accepted: boolean } }
  | { type: 'VALIDATION_ERROR'; payload: { errors: ValidationError[] } }
  | { type: 'PROGRESS_SAVED'; payload: { progress: WizardProgress } }
  | { type: 'WIZARD_COMPLETED'; payload: { projectId: string; answers: WizardAnswers } }
  | { type: 'WIZARD_ABANDONED'; payload: { stepId: string; reason?: string } };

export interface WizardEventLog {
  id: string;
  projectId: string;
  event: WizardEvent;
  timestamp: string;
  sessionId: string;
  userId?: string;
}
