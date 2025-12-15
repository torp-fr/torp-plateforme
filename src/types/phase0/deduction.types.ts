/**
 * TORP Phase 0 - Types du Moteur de Déduction IA
 * Règles de déduction automatique et enrichissement des données
 */

import type { LotType } from './lots.types';
import type { ConfidenceLevel, DataSource } from './common.types';

// =============================================================================
// RÈGLES DE DÉDUCTION
// =============================================================================

export interface DeductionRule {
  id: string;
  name: string;
  description: string;
  category: DeductionCategory;
  priority: number;
  enabled: boolean;
  version: number;

  // Déclencheur
  trigger: DeductionTrigger;

  // Conditions d'application
  conditions: DeductionCondition[];
  conditionOperator: 'and' | 'or';

  // Action à effectuer
  action: DeductionAction;

  // Configuration
  confidence: ConfidenceLevel;
  source: DeductionSource;
  userOverridable: boolean;
  requiresValidation: boolean;

  // Métadonnées
  createdAt: string;
  updatedAt: string;
  author?: string;
  tags?: string[];
}

export type DeductionCategory =
  | 'property_enrichment'     // Enrichissement données bien
  | 'lot_suggestion'          // Suggestion de lots
  | 'regulation_check'        // Vérification réglementaire
  | 'risk_assessment'         // Évaluation des risques
  | 'cost_estimation'         // Estimation des coûts
  | 'timeline_estimation'     // Estimation des délais
  | 'aid_eligibility'         // Éligibilité aux aides
  | 'technical_calculation'   // Calcul technique
  | 'external_data';          // Données externes

export interface DeductionTrigger {
  type: TriggerType;
  source: string;           // Chemin du champ déclencheur
  event?: TriggerEvent;
  debounceMs?: number;
}

export type TriggerType =
  | 'field_change'          // Changement d'un champ
  | 'field_filled'          // Champ rempli
  | 'step_completion'       // Étape complétée
  | 'lot_selection'         // Sélection de lot
  | 'document_upload'       // Upload document
  | 'photo_upload'          // Upload photo
  | 'manual_request'        // Demande manuelle
  | 'scheduled';            // Planifié

export type TriggerEvent =
  | 'on_change'
  | 'on_blur'
  | 'on_submit'
  | 'on_complete';

export interface DeductionCondition {
  type: ConditionType;
  field: string;
  operator: ConditionOperator;
  value: ConditionValue;
  negate?: boolean;
}

export type ConditionType =
  | 'field_value'
  | 'field_exists'
  | 'field_type'
  | 'computed'
  | 'external';

export type ConditionOperator =
  | 'equals'
  | 'not_equals'
  | 'contains'
  | 'not_contains'
  | 'starts_with'
  | 'ends_with'
  | 'greater_than'
  | 'greater_equal'
  | 'less_than'
  | 'less_equal'
  | 'in'
  | 'not_in'
  | 'matches'      // Regex
  | 'is_empty'
  | 'is_not_empty'
  | 'is_true'
  | 'is_false';

export type ConditionValue = string | number | boolean | string[] | number[] | null;

export interface DeductionAction {
  type: ActionType;
  target: string;           // Chemin du champ cible
  value?: DeductionValue;
  transform?: DeductionTransform;
  externalApi?: ExternalApiConfig;
  aiPrompt?: AIPromptConfig;
}

export type ActionType =
  | 'set_value'             // Définir une valeur
  | 'suggest_value'         // Suggérer une valeur
  | 'add_to_array'          // Ajouter à un tableau
  | 'remove_from_array'     // Retirer d'un tableau
  | 'calculate'             // Calculer
  | 'fetch_external'        // Récupérer données externes
  | 'ai_inference'          // Inférence IA
  | 'validate'              // Valider
  | 'create_alert'          // Créer une alerte
  | 'suggest_lot'           // Suggérer un lot
  | 'estimate_cost'         // Estimer un coût
  | 'estimate_duration';    // Estimer une durée

export type DeductionValue =
  | { type: 'static'; value: unknown }
  | { type: 'field_reference'; path: string }
  | { type: 'expression'; expression: string }
  | { type: 'lookup'; table: string; key: string }
  | { type: 'api_result'; path?: string }
  | { type: 'ai_result'; path?: string };

export interface DeductionTransform {
  type: TransformType;
  config: Record<string, unknown>;
}

export type TransformType =
  | 'map'
  | 'filter'
  | 'reduce'
  | 'format'
  | 'parse'
  | 'extract'
  | 'calculate';

export type DeductionSource =
  | 'rule_engine'
  | 'ai_model'
  | 'external_api'
  | 'knowledge_base'
  | 'historical_data'
  | 'user_pattern';

// =============================================================================
// CONFIGURATION API EXTERNE
// =============================================================================

export interface ExternalApiConfig {
  apiId: ExternalApiId;
  endpoint?: string;
  method: 'GET' | 'POST';
  params?: Record<string, string>;
  headers?: Record<string, string>;
  resultPath?: string;
  timeout: number;
  retryCount: number;
  cacheMinutes?: number;
}

export type ExternalApiId =
  | 'api_ban'               // Base Adresse Nationale
  | 'api_cadastre'          // API Cadastre IGN
  | 'api_georisques'        // Géorisques BRGM
  | 'api_dpe_ademe'         // Base DPE ADEME
  | 'api_meteo_france'      // Données climatiques
  | 'api_sirene'            // INSEE Sirene
  | 'api_pappers'           // Enrichissement entreprise
  | 'api_france_renov'      // MaPrimeRénov
  | 'api_atlas_patrimoine'  // Atlas du patrimoine
  | 'api_plu_gpu'           // Géoportail Urbanisme
  | 'api_rge_ademe';        // Liste RGE ADEME

// =============================================================================
// CONFIGURATION PROMPT IA
// =============================================================================

export interface AIPromptConfig {
  model: AIModel;
  systemPrompt?: string;
  userPrompt: string;
  contextFields?: string[];
  temperature?: number;
  maxTokens?: number;
  responseFormat?: 'text' | 'json' | 'structured';
  responseSchema?: Record<string, unknown>;
}

export type AIModel = 'claude' | 'openai' | 'hybrid';

// =============================================================================
// RÉSULTATS DE DÉDUCTION
// =============================================================================

export interface DeductionResult {
  id: string;
  ruleId: string;
  ruleName: string;
  timestamp: string;

  // Résultat
  status: DeductionStatus;
  success: boolean;

  // Données
  sourceData: Record<string, unknown>;
  deducedData: DeducedData[];

  // Qualité
  confidence: ConfidenceLevel;
  reasoning?: string;

  // État utilisateur
  userAction?: UserDeductionAction;
  userActionAt?: string;
  userOverrideValue?: unknown;

  // Erreur si échec
  error?: DeductionError;

  // Performance
  executionTimeMs: number;
}

export type DeductionStatus =
  | 'pending'           // En attente
  | 'executing'         // En cours
  | 'success'           // Réussi
  | 'partial'           // Partiellement réussi
  | 'failed'            // Échoué
  | 'skipped'           // Ignoré (conditions non remplies)
  | 'expired';          // Expiré

export interface DeducedData {
  field: string;
  value: unknown;
  previousValue?: unknown;
  confidence: ConfidenceLevel;
  source: DataSource;
  requiresValidation: boolean;
  validated: boolean;
}

export type UserDeductionAction =
  | 'accepted'
  | 'rejected'
  | 'modified'
  | 'pending';

export interface DeductionError {
  code: DeductionErrorCode;
  message: string;
  details?: Record<string, unknown>;
  retryable: boolean;
}

export type DeductionErrorCode =
  | 'CONDITION_NOT_MET'
  | 'API_ERROR'
  | 'API_TIMEOUT'
  | 'API_RATE_LIMIT'
  | 'INVALID_DATA'
  | 'MISSING_FIELD'
  | 'CALCULATION_ERROR'
  | 'AI_ERROR'
  | 'UNKNOWN_ERROR';

// =============================================================================
// RÈGLES PRÉDÉFINIES
// =============================================================================

export const PREDEFINED_RULES: DeductionRuleDefinition[] = [
  // Déductions géographiques
  {
    id: 'DEDUC_001',
    name: 'Zone climatique depuis code postal',
    category: 'property_enrichment',
    trigger: { type: 'field_change', source: 'property.address.postalCode' },
    action: { type: 'fetch_external', externalApi: 'api_meteo_france' },
    target: 'property.environment.climate.climateZone',
    confidence: 'high',
    source: 'api_meteo_france',
  },
  {
    id: 'DEDUC_002',
    name: 'Risques naturels depuis adresse',
    category: 'risk_assessment',
    trigger: { type: 'field_change', source: 'property.address.coordinates' },
    action: { type: 'fetch_external', externalApi: 'api_georisques' },
    target: 'property.diagnostics.erp',
    confidence: 'high',
    source: 'api_georisques',
  },
  {
    id: 'DEDUC_003',
    name: 'Zone ABF depuis adresse',
    category: 'regulation_check',
    trigger: { type: 'field_change', source: 'property.address' },
    action: { type: 'fetch_external', externalApi: 'api_atlas_patrimoine' },
    target: 'property.heritageStatus',
    confidence: 'high',
    source: 'api_atlas_patrimoine',
  },
  {
    id: 'DEDUC_004',
    name: 'Références cadastrales depuis adresse',
    category: 'property_enrichment',
    trigger: { type: 'field_change', source: 'property.address' },
    action: { type: 'fetch_external', externalApi: 'api_cadastre' },
    target: 'property.identification.cadastralReferences',
    confidence: 'high',
    source: 'api_cadastre',
  },

  // Déductions lots
  {
    id: 'DEDUC_010',
    name: 'Lots depuis description projet',
    category: 'lot_suggestion',
    trigger: { type: 'field_change', source: 'project.scope.descriptionDetailed' },
    action: { type: 'ai_inference' },
    target: 'project.scope.selectedLotIds',
    confidence: 'medium',
    source: 'ai_model',
  },
  {
    id: 'DEDUC_011',
    name: 'Lots complémentaires obligatoires',
    category: 'lot_suggestion',
    trigger: { type: 'lot_selection', source: 'project.scope.selectedLotIds' },
    action: { type: 'suggest_lot' },
    target: 'project.scope.selectedLotIds',
    confidence: 'high',
    source: 'rule_engine',
  },

  // Déductions réglementaires
  {
    id: 'DEDUC_020',
    name: 'Permis de construire requis',
    category: 'regulation_check',
    trigger: { type: 'field_change', source: 'project.scope.surfaceImpact' },
    action: { type: 'calculate' },
    target: 'project.regulatory.buildingPermits.permitType',
    confidence: 'high',
    source: 'rule_engine',
  },
  {
    id: 'DEDUC_021',
    name: 'Architecte obligatoire',
    category: 'regulation_check',
    trigger: { type: 'field_change', source: 'project.scope.surfaceImpact' },
    action: { type: 'calculate' },
    target: 'project.regulatory.buildingPermits.architectRequired',
    confidence: 'high',
    source: 'rule_engine',
  },
  {
    id: 'DEDUC_022',
    name: 'DTU applicables par lot',
    category: 'regulation_check',
    trigger: { type: 'lot_selection', source: 'project.scope.selectedLotIds' },
    action: { type: 'set_value' },
    target: 'project.regulatory.technicalRegulations.applicableDTUs',
    confidence: 'high',
    source: 'knowledge_base',
  },

  // Déductions énergie
  {
    id: 'DEDUC_030',
    name: 'DPE cible calculé',
    category: 'technical_calculation',
    trigger: { type: 'lot_selection', source: 'project.scope.selectedLotIds' },
    action: { type: 'calculate' },
    target: 'project.qualityExpectations.specificExpectations',
    confidence: 'medium',
    source: 'rule_engine',
    conditions: ['lots.includes(isolation) OR lots.includes(heating)'],
  },

  // Déductions aides
  {
    id: 'DEDUC_040',
    name: 'Éligibilité MaPrimeRénov',
    category: 'aid_eligibility',
    trigger: { type: 'step_completion', source: 'step_budget' },
    action: { type: 'fetch_external', externalApi: 'api_france_renov' },
    target: 'project.budget.funding.aids',
    confidence: 'high',
    source: 'api_france_renov',
  },
  {
    id: 'DEDUC_041',
    name: 'Éligibilité CEE',
    category: 'aid_eligibility',
    trigger: { type: 'lot_selection', source: 'project.scope.selectedLotIds' },
    action: { type: 'calculate' },
    target: 'project.budget.funding.aids',
    confidence: 'medium',
    source: 'rule_engine',
  },

  // Déductions estimation
  {
    id: 'DEDUC_050',
    name: 'Estimation budget par lot',
    category: 'cost_estimation',
    trigger: { type: 'field_change', source: 'lots' },
    action: { type: 'estimate_cost' },
    target: 'project.budget.breakdown.byLot',
    confidence: 'medium',
    source: 'knowledge_base',
  },
  {
    id: 'DEDUC_051',
    name: 'Estimation durée travaux',
    category: 'timeline_estimation',
    trigger: { type: 'lot_selection', source: 'project.scope.selectedLotIds' },
    action: { type: 'estimate_duration' },
    target: 'project.planning.timeline',
    confidence: 'medium',
    source: 'knowledge_base',
  },
];

export interface DeductionRuleDefinition {
  id: string;
  name: string;
  category: DeductionCategory;
  trigger: {
    type: TriggerType;
    source: string;
  };
  action: {
    type: ActionType;
    externalApi?: ExternalApiId;
  };
  target: string;
  confidence: ConfidenceLevel;
  source: DeductionSource;
  conditions?: string[];
}

// =============================================================================
// MOTEUR DE DÉDUCTION
// =============================================================================

export interface DeductionEngineConfig {
  enabled: boolean;
  mode: 'automatic' | 'manual' | 'suggest_only';
  maxConcurrentDeductions: number;
  timeoutMs: number;
  retryPolicy: RetryPolicy;
  cacheEnabled: boolean;
  cacheTTLMinutes: number;
  loggingLevel: 'none' | 'errors' | 'info' | 'debug';
}

export interface RetryPolicy {
  maxRetries: number;
  initialDelayMs: number;
  maxDelayMs: number;
  backoffMultiplier: number;
  retryableErrors: DeductionErrorCode[];
}

export interface DeductionEngineState {
  isRunning: boolean;
  pendingDeductions: string[];
  executingDeductions: string[];
  completedDeductions: DeductionResult[];
  failedDeductions: DeductionResult[];
  statistics: DeductionStatistics;
}

export interface DeductionStatistics {
  totalExecuted: number;
  successCount: number;
  failureCount: number;
  averageExecutionTimeMs: number;
  byCategory: Record<DeductionCategory, CategoryStats>;
  bySource: Record<DeductionSource, SourceStats>;
  userAcceptanceRate: number;
}

export interface CategoryStats {
  count: number;
  successRate: number;
  avgConfidence: number;
}

export interface SourceStats {
  count: number;
  successRate: number;
  avgResponseTimeMs: number;
}

// =============================================================================
// SUGGESTIONS DE LOTS PAR IA
// =============================================================================

export interface LotSuggestion {
  lotType: LotType;
  lotName: string;
  suggestionReason: SuggestionReason;
  confidence: ConfidenceLevel;
  priority: 'required' | 'recommended' | 'optional';
  estimatedImpact: {
    cost: { min: number; max: number };
    duration: { minDays: number; maxDays: number };
  };
  dependencies: LotType[];
  aiReasoning?: string;
  marketInsight?: string;
}

export type SuggestionReason =
  | 'project_type_match'      // Correspond au type de projet
  | 'description_analysis'    // Détecté dans la description
  | 'complementary_to_selected' // Complémentaire aux lots sélectionnés
  | 'regulation_required'     // Requis réglementairement
  | 'energy_efficiency'       // Pour performance énergétique
  | 'commonly_associated'     // Couramment associé
  | 'condition_based'         // Basé sur l'état du bien
  | 'user_profile_match';     // Correspond au profil utilisateur
