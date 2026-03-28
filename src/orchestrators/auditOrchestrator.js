/**
 * Audit Orchestrator
 * Single entry point that coordinates the full audit pipeline
 * without modifying any existing engines
 *
 * @module auditOrchestrator
 * @requires regulatoryCorpusAdapter
 * @requires regulatoryExposureEngine
 * @requires thematicScoringEngine
 * @requires auditNarrativeEngine
 */

// ============================================================================
// IMPORTS
// ============================================================================

const {
  fetchRegulatoryCorpus,
} = require('../adapters/regulatoryCorpusAdapter');

const {
  computeRegulatoryExposure,
} = require('../engines/regulatoryExposureEngine');

const {
  calculateThematicScore,
} = require('../engines/thematicScoringEngine');

const {
  generateAuditNarrative,
} = require('../engines/auditNarrativeEngine');

// ============================================================================
// CONSTANTS
// ============================================================================

const ORCHESTRATOR_VERSION = 'v1.0_orchestrated_pipeline';

// ============================================================================
// LOGGER FACTORY
// ============================================================================

/**
 * Create structured logger for orchestrator
 * @param {Object} externalLogger - Optional external logger
 * @returns {Object} Logger instance
 */
const createLogger = (externalLogger = null) => {
  if (externalLogger && typeof externalLogger.info === 'function') {
    return {
      info: (step, data = {}) => {
        externalLogger.info({ module: 'ORCHESTRATOR', step, ...data });
      },
      warn: (step, data = {}) => {
        if (typeof externalLogger.warn === 'function') {
          externalLogger.warn({ module: 'ORCHESTRATOR', step, ...data });
        } else {
          externalLogger.info({ module: 'ORCHESTRATOR', level: 'warn', step, ...data });
        }
      },
      error: (step, data = {}) => {
        if (typeof externalLogger.error === 'function') {
          externalLogger.error({ module: 'ORCHESTRATOR', step, ...data });
        } else {
          externalLogger.info({ module: 'ORCHESTRATOR', level: 'error', step, ...data });
        }
      },
    };
  }

  // Fallback to console.info (structured JSON only)
  return {
    info: (step, data = {}) => {
      const logEntry = {
        timestamp: new Date().toISOString(),
        module: 'ORCHESTRATOR',
        level: 'info',
        step,
        ...data,
      };
      console.info(JSON.stringify(logEntry));
    },
    warn: (step, data = {}) => {
      const logEntry = {
        timestamp: new Date().toISOString(),
        module: 'ORCHESTRATOR',
        level: 'warn',
        step,
        ...data,
      };
      console.info(JSON.stringify(logEntry));
    },
    error: (step, data = {}) => {
      const logEntry = {
        timestamp: new Date().toISOString(),
        module: 'ORCHESTRATOR',
        level: 'error',
        step,
        ...data,
      };
      console.info(JSON.stringify(logEntry));
    },
  };
};

// ============================================================================
// VALIDATION
// ============================================================================

/**
 * Validate input parameters for full audit pipeline
 * @param {Object} params - Input parameters
 * @throws {Error} If validation fails
 */
function validateAuditOrchestratorInput(params) {
  const errors = [];

  if (!params || typeof params !== 'object') {
    throw new Error('params must be an object');
  }

  // Validate projectContext
  if (!params.projectContext || typeof params.projectContext !== 'object') {
    errors.push('projectContext is required and must be an object');
  } else {
    const { type_travaux, surface, localisation } = params.projectContext;
    if (!type_travaux || typeof type_travaux !== 'string') {
      errors.push('projectContext.type_travaux is required (string)');
    }
    if (surface === undefined || typeof surface !== 'number') {
      errors.push('projectContext.surface is required (number)');
    }
    if (!localisation || typeof localisation !== 'string') {
      errors.push('projectContext.localisation is required (string)');
    }
  }

  // Validate analysisData
  if (!params.analysisData || typeof params.analysisData !== 'object') {
    errors.push('analysisData is required and must be an object');
  }

  // Validate userProfile
  if (!params.userProfile || typeof params.userProfile !== 'object') {
    errors.push('userProfile is required and must be an object');
  } else {
    if (!['B2B', 'B2C'].includes(params.userProfile.type)) {
      errors.push('userProfile.type must be B2B or B2C');
    }
  }

  // Validate supabaseClient
  if (!params.supabaseClient || typeof params.supabaseClient.from !== 'function') {
    errors.push('supabaseClient is required and must be a valid Supabase client');
  }

  // Validate complexityWeights (optional but if provided, must be valid)
  if (params.complexityWeights && typeof params.complexityWeights !== 'object') {
    errors.push('complexityWeights must be an object if provided');
  }

  if (errors.length > 0) {
    throw new Error(`Orchestrator validation failed: ${errors.join('; ')}`);
  }
}

// ============================================================================
// PIPELINE STEP 1: FETCH REGULATORY CORPUS
// ============================================================================

/**
 * Step 1: Fetch regulatory corpus from Supabase
 * @param {Object} supabaseClient - Supabase client instance
 * @param {Object} logger - Logger instance
 * @returns {Promise<Array>} Regulatory documents
 * @throws {Error} On fetch failure
 */
async function fetchCorpus(supabaseClient, logger) {
  logger.info('fetch_corpus_start', { action: 'fetching regulatory corpus' });

  try {
    const corpus = await fetchRegulatoryCorpus(supabaseClient);

    logger.info('fetch_corpus_complete', {
      documentCount: corpus.length,
      status: 'success',
    });

    return corpus;
  } catch (error) {
    logger.error('fetch_corpus_failed', {
      error: error.message,
    });
    throw new Error(`Corpus fetch failed: ${error.message}`);
  }
}

// ============================================================================
// PIPELINE STEP 2: COMPUTE REGULATORY EXPOSURE
// ============================================================================

/**
 * Step 2: Compute regulatory exposure index
 * @param {Object} projectContext - Project metadata
 * @param {Array} regulatoryDocuments - Corpus documents
 * @param {Object} logger - Logger instance
 * @returns {Object} Exposure data
 * @throws {Error} On computation failure
 */
function computeExposure(projectContext, regulatoryDocuments, logger) {
  logger.info('compute_exposure_start', {
    projectType: projectContext.type_travaux,
  });

  try {
    const exposureData = computeRegulatoryExposure(projectContext, regulatoryDocuments);

    logger.info('compute_exposure_complete', {
      exposureIndex: exposureData.exposure_index,
      applicableCount: exposureData.applicable_count,
      status: 'success',
    });

    return exposureData;
  } catch (error) {
    logger.error('compute_exposure_failed', {
      error: error.message,
    });
    throw new Error(`Exposure computation failed: ${error.message}`);
  }
}

// ============================================================================
// PIPELINE STEP 3: COMPUTE THEMATIC SCORING
// ============================================================================

/**
 * Step 3: Compute thematic scores with regulatory amplification
 * @param {Object} input - Scoring input
 * @param {Object} options - Scoring options
 * @param {Object} logger - Logger instance
 * @returns {Promise<Object>} Scoring result
 * @throws {Error} On computation failure
 */
async function computeScoring(input, options, logger) {
  logger.info('compute_scoring_start', {
    projectId: input.projectContext?.projectId,
  });

  try {
    const scoringResult = await calculateThematicScore(input, options);

    logger.info('compute_scoring_complete', {
      grade: scoringResult.gradeLetter,
      weightedScore: scoringResult.weightedScore,
      status: 'success',
    });

    return scoringResult;
  } catch (error) {
    logger.error('compute_scoring_failed', {
      error: error.message,
    });
    throw new Error(`Scoring computation failed: ${error.message}`);
  }
}

// ============================================================================
// PIPELINE STEP 4: GENERATE AUDIT NARRATIVE
// ============================================================================

/**
 * Step 4: Generate audit narrative report
 * @param {Object} input - Narrative input
 * @param {Object} options - Narrative options
 * @param {Object} logger - Logger instance
 * @returns {Promise<Object>} Audit report
 * @throws {Error} On generation failure
 */
async function generateNarrative(input, options, logger) {
  logger.info('generate_narrative_start', {
    projectId: input.projectContext?.projectId,
  });

  try {
    const report = await generateAuditNarrative(input, options);

    logger.info('generate_narrative_complete', {
      auditId: report.auditId,
      userType: report.userType,
      status: 'success',
    });

    return report;
  } catch (error) {
    logger.error('generate_narrative_failed', {
      error: error.message,
    });
    throw new Error(`Narrative generation failed: ${error.message}`);
  }
}

// ============================================================================
// MAIN ORCHESTRATION FUNCTION
// ============================================================================

/**
 * Run full audit pipeline orchestration
 *
 * Pipeline:
 * 1. Fetch regulatory corpus from Supabase
 * 2. Compute regulatory exposure index
 * 3. Compute thematic scores (with exposure amplification)
 * 4. Generate audit narrative (with priority adjustment)
 * 5. Return structured final result
 *
 * @param {Object} params - Input parameters
 * @param {Object} params.projectContext - Project metadata (type_travaux, surface, localisation, etc.)
 * @param {Object} params.analysisData - Analysis findings from document parsing
 * @param {Object} params.userProfile - User profile (type: B2B|B2C)
 * @param {Object} params.supabaseClient - Supabase client instance
 * @param {Object} params.complexityWeights - Optional complexity weights for scoring
 * @param {Object} options - Orchestration options
 * @param {Object} options.logger - Optional logger instance
 * @param {Function} options.persistenceAdapter - Optional persistence function
 * @param {Function} options.llmProvider - Optional LLM provider for enrichment
 * @returns {Promise<Object>} Structured audit result
 * @throws {Error} On any pipeline step failure
 *
 * @example
 * const result = await runFullAudit({
 *   projectContext: { type_travaux: 'rénovation', surface: 150, localisation: 'Paris' },
 *   analysisData: { regulatoryFindings: {}, riskFindings: {}, ... },
 *   userProfile: { type: 'B2B' },
 *   supabaseClient: supabaseInstance,
 * }, {
 *   logger: customLogger,
 * });
 *
 * // Result structure:
 * // {
 * //   auditMeta: { systemVersion, timestamp },
 * //   exposure: { exposure_index, applicable_count, ... },
 * //   scoring: { gradeLetter, weightedScore, scores: {...} },
 * //   report: { auditId, executiveSummary, recommendations, ... }
 * // }
 */
async function runFullAudit(params, options = {}) {
  // Initialize logger
  const logger = createLogger(options.logger);

  const startTime = Date.now();
  const auditTimestamp = new Date().toISOString();

  logger.info('audit_start', {
    orchestratorVersion: ORCHESTRATOR_VERSION,
    timestamp: auditTimestamp,
  });

  try {
    // ======================================================================
    // INPUT VALIDATION
    // ======================================================================
    logger.info('validation_start', { action: 'validating orchestrator inputs' });
    validateAuditOrchestratorInput(params);
    logger.info('validation_complete', { status: 'success' });

    const {
      projectContext,
      analysisData,
      userProfile,
      supabaseClient,
      complexityWeights,
    } = params;

    // ======================================================================
    // STEP 1: FETCH REGULATORY CORPUS
    // ======================================================================
    logger.info('step_1_start', { stepName: 'Fetch Regulatory Corpus' });
    const regulatoryDocuments = await fetchCorpus(supabaseClient, logger);
    logger.info('step_1_complete', { stepName: 'Fetch Regulatory Corpus' });

    // ======================================================================
    // STEP 2: COMPUTE REGULATORY EXPOSURE
    // ======================================================================
    logger.info('step_2_start', { stepName: 'Compute Regulatory Exposure' });
    const exposureData = computeExposure(projectContext, regulatoryDocuments, logger);
    logger.info('step_2_complete', { stepName: 'Compute Regulatory Exposure' });

    // ======================================================================
    // STEP 3: COMPUTE THEMATIC SCORING
    // ======================================================================
    logger.info('step_3_start', { stepName: 'Compute Thematic Scoring' });

    const scoringInput = {
      projectContext,
      analysisData,
      regulatoryExposureData: exposureData,
      complexityWeights,
    };

    const scoringOptions = {
      ...options,
      logger: options.logger,
    };

    const scoringResult = await computeScoring(scoringInput, scoringOptions, logger);
    logger.info('step_3_complete', { stepName: 'Compute Thematic Scoring' });

    // ======================================================================
    // STEP 4: GENERATE AUDIT NARRATIVE
    // ======================================================================
    logger.info('step_4_start', { stepName: 'Generate Audit Narrative' });

    const narrativeInput = {
      projectContext,
      analysisData,
      userProfile,
      scoringProfile: scoringResult,
      regulatoryExposureData: exposureData,
    };

    const narrativeOptions = {
      logger: options.logger,
      persistenceAdapter: options.persistenceAdapter,
      llmProvider: options.llmProvider,
    };

    const auditReport = await generateNarrative(narrativeInput, narrativeOptions, logger);
    logger.info('step_4_complete', { stepName: 'Generate Audit Narrative' });

    // ======================================================================
    // STEP 5: COMPILE FINAL RESULT
    // ======================================================================
    logger.info('result_compilation_start', { action: 'compiling final structured result' });

    const duration = Date.now() - startTime;

    const finalResult = {
      auditMeta: {
        systemVersion: ORCHESTRATOR_VERSION,
        timestamp: auditTimestamp,
        duration: `${duration}ms`,
      },
      exposure: exposureData,
      scoring: {
        gradeLetter: scoringResult.gradeLetter,
        weightedScore: scoringResult.weightedScore,
        scores: scoringResult.scores,
        bonusApplied: scoringResult.bonusApplied,
      },
      report: auditReport,
    };

    logger.info('result_compilation_complete', { status: 'success' });

    // ======================================================================
    // COMPLETION
    // ======================================================================
    logger.info('audit_complete', {
      grade: scoringResult.gradeLetter,
      duration: `${duration}ms`,
      status: 'success',
    });

    return finalResult;
  } catch (error) {
    const duration = Date.now() - startTime;

    logger.error('audit_failed', {
      error: error.message,
      duration: `${duration}ms`,
      stack: error.stack,
    });

    throw error;
  }
}

// ============================================================================
// EXPORTS
// ============================================================================

module.exports = {
  // Main orchestration function
  runFullAudit,

  // Version constant
  ORCHESTRATOR_VERSION,

  // Helper functions (for testing)
  validateAuditOrchestratorInput,
  createLogger,
};
