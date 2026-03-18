/**
 * Regulatory Obligation Extraction Engine
 * Extracts structured obligations from knowledge chunks
 * Deterministic parsing and obligation mapping
 *
 * @module regulatoryObligationExtractionEngine
 */

// ============================================================================
// CONSTANTS & CONFIGURATION
// ============================================================================

const ENGINE_VERSION = 'v1.0_obligation-extraction';

const OBLIGATION_TYPES = {
  MANDATORY: 'mandatory',
  RECOMMENDED: 'recommended',
  CONDITIONAL: 'conditional',
  BEST_PRACTICE: 'best_practice',
};

const SEVERITY_LEVELS = {
  CRITICAL: 5,
  HIGH: 4,
  MEDIUM: 3,
  LOW: 2,
  MINIMAL: 1,
};

const RISK_CATEGORIES = [
  'financial_risk',
  'compliance_risk',
  'operational_risk',
  'reputational_risk',
  'legal_risk',
  'safety_risk',
  'documentation_risk',
  'contractual_risk',
];

const CONFIDENCE_THRESHOLD = 0.7;

// ============================================================================
// LOGGER FACTORY
// ============================================================================

/**
 * Create structured logger for obligation extraction
 * @param {Object} externalLogger - Optional external logger
 * @returns {Object} Logger instance
 */
const createLogger = (externalLogger = null) => {
  if (externalLogger && typeof externalLogger.info === 'function') {
    return {
      info: (step, data = {}) => {
        externalLogger.info({ module: 'OBLIGATION_EXTRACTION', step, ...data });
      },
      warn: (step, data = {}) => {
        if (typeof externalLogger.warn === 'function') {
          externalLogger.warn({ module: 'OBLIGATION_EXTRACTION', step, ...data });
        } else {
          externalLogger.info({ module: 'OBLIGATION_EXTRACTION', level: 'warn', step, ...data });
        }
      },
      error: (step, data = {}) => {
        if (typeof externalLogger.error === 'function') {
          externalLogger.error({ module: 'OBLIGATION_EXTRACTION', step, ...data });
        } else {
          externalLogger.info({ module: 'OBLIGATION_EXTRACTION', level: 'error', step, ...data });
        }
      },
    };
  }

  // Fallback to console.info (structured JSON only)
  return {
    info: (step, data = {}) => {
      const logEntry = {
        timestamp: new Date().toISOString(),
        module: 'OBLIGATION_EXTRACTION',
        level: 'info',
        step,
        ...data,
      };
      console.info(JSON.stringify(logEntry));
    },
    warn: (step, data = {}) => {
      const logEntry = {
        timestamp: new Date().toISOString(),
        module: 'OBLIGATION_EXTRACTION',
        level: 'warn',
        step,
        ...data,
      };
      console.info(JSON.stringify(logEntry));
    },
    error: (step, data = {}) => {
      const logEntry = {
        timestamp: new Date().toISOString(),
        module: 'OBLIGATION_EXTRACTION',
        level: 'error',
        step,
        ...data,
      };
      console.info(JSON.stringify(logEntry));
    },
  };
};

// ============================================================================
// VALIDATION FUNCTIONS
// ============================================================================

/**
 * Validate knowledge chunk structure
 * @param {Object} chunk - Knowledge chunk
 * @param {Object} logger - Logger instance
 * @throws {Error} If validation fails
 */
function validateKnowledgeChunk(chunk, logger) {
  logger.info('validate_chunk_start', { action: 'validating knowledge chunk structure' });

  const errors = [];

  if (!chunk || typeof chunk !== 'object') {
    errors.push('chunk must be an object');
  } else {
    if (!chunk.id || typeof chunk.id !== 'string') {
      errors.push('chunk.id is required (string)');
    }
    if (!chunk.content || typeof chunk.content !== 'string') {
      errors.push('chunk.content is required (string)');
    }
    if (!chunk.category || typeof chunk.category !== 'string') {
      errors.push('chunk.category is required (string)');
    }
  }

  if (errors.length > 0) {
    logger.error('validate_chunk_failed', { errors });
    throw new Error(`Knowledge chunk validation failed: ${errors.join('; ')}`);
  }

  logger.info('validate_chunk_complete', { status: 'success', chunkId: chunk.id });
}

/**
 * Validate extracted obligation structure
 * @param {Object} obligation - Extracted obligation
 * @param {Object} logger - Logger instance
 * @returns {Object} { isValid: boolean, errors: Array }
 */
function validateExtractedObligation(obligation, logger) {
  const errors = [];

  if (!obligation.obligation_type || !Object.values(OBLIGATION_TYPES).includes(obligation.obligation_type)) {
    errors.push(`obligation_type must be one of: ${Object.values(OBLIGATION_TYPES).join(', ')}`);
  }

  if (!obligation.description || typeof obligation.description !== 'string' || obligation.description.length === 0) {
    errors.push('description is required (non-empty string)');
  }

  if (!Number.isInteger(obligation.severity) || obligation.severity < 1 || obligation.severity > 5) {
    errors.push('severity must be an integer between 1 and 5');
  }

  if (typeof obligation.penalty_weight !== 'number' || obligation.penalty_weight < 0 || obligation.penalty_weight > 1) {
    errors.push('penalty_weight must be a number between 0 and 1');
  }

  if (!Array.isArray(obligation.risk_categories)) {
    errors.push('risk_categories must be an array');
  } else {
    const invalidCategories = obligation.risk_categories.filter(cat => !RISK_CATEGORIES.includes(cat));
    if (invalidCategories.length > 0) {
      errors.push(`Invalid risk_categories: ${invalidCategories.join(', ')}`);
    }
  }

  if (typeof obligation.confidence_score !== 'number' || obligation.confidence_score < 0 || obligation.confidence_score > 1) {
    errors.push('confidence_score must be a number between 0 and 1');
  }

  if (obligation.confidence_score < CONFIDENCE_THRESHOLD) {
    logger.warn('low_confidence_extraction', {
      confidence_score: obligation.confidence_score,
      threshold: CONFIDENCE_THRESHOLD,
    });
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

// ============================================================================
// EXTRACTION FUNCTIONS
// ============================================================================

/**
 * Generate unique obligation ID from chunk and index
 * @param {string} chunkId - Knowledge chunk ID
 * @param {number} index - Obligation index within chunk
 * @returns {string} Obligation ID
 */
function generateObligationId(chunkId, index) {
  const hash = chunkId.replace(/[^a-zA-Z0-9]/g, '').substring(0, 8);
  return `OBL-${hash}-${index}`;
}

/**
 * Determine obligation type from text patterns
 * Deterministic pattern matching
 * @param {string} content - Text content
 * @returns {Object} { type: string, confidence: number }
 */
function determineObligationType(content) {
  const text = content.toLowerCase();

  // Mandatory patterns (highest confidence)
  const mandatoryPatterns = [
    'must', 'shall', 'required', 'mandatory', 'obligatory',
    'is required', 'must be', 'must include', 'non-negotiable'
  ];
  if (mandatoryPatterns.some(pattern => text.includes(pattern))) {
    return { type: OBLIGATION_TYPES.MANDATORY, confidence: 0.95 };
  }

  // Conditional patterns
  const conditionalPatterns = [
    'if', 'when', 'provided that', 'in case', 'depending on',
    'subject to', 'contingent on'
  ];
  if (conditionalPatterns.some(pattern => text.includes(pattern))) {
    return { type: OBLIGATION_TYPES.CONDITIONAL, confidence: 0.85 };
  }

  // Recommended patterns
  const recommendedPatterns = [
    'should', 'recommend', 'suggested', 'advised', 'best practice',
    'it is recommended', 'consider', 'advisable'
  ];
  if (recommendedPatterns.some(pattern => text.includes(pattern))) {
    return { type: OBLIGATION_TYPES.RECOMMENDED, confidence: 0.80 };
  }

  // Best practice patterns
  const bestPracticePatterns = [
    'best practice', 'standard practice', 'good practice',
    'typically', 'generally accepted', 'industry standard'
  ];
  if (bestPracticePatterns.some(pattern => text.includes(pattern))) {
    return { type: OBLIGATION_TYPES.BEST_PRACTICE, confidence: 0.75 };
  }

  // Default to recommended with low confidence
  return { type: OBLIGATION_TYPES.RECOMMENDED, confidence: 0.5 };
}

/**
 * Determine severity level from text patterns
 * Deterministic severity assessment
 * @param {string} content - Text content
 * @returns {Object} { severity: number, confidence: number }
 */
function determineSeverity(content) {
  const text = content.toLowerCase();

  // Critical severity
  const criticalPatterns = [
    'critical', 'failure', 'critical failure', 'fatal', 'catastrophic',
    'irrevocable', 'irreversible', 'non-recoverable', 'will cause',
  ];
  if (criticalPatterns.some(pattern => text.includes(pattern))) {
    return { severity: SEVERITY_LEVELS.CRITICAL, confidence: 0.90 };
  }

  // High severity
  const highPatterns = [
    'severe', 'significant', 'major', 'serious', 'substantial impact',
    'high risk', 'substantial', 'major impact',
  ];
  if (highPatterns.some(pattern => text.includes(pattern))) {
    return { severity: SEVERITY_LEVELS.HIGH, confidence: 0.85 };
  }

  // Medium severity
  const mediumPatterns = [
    'moderate', 'moderate risk', 'important', 'notable',
    'should be', 'needs', 'requires attention',
  ];
  if (mediumPatterns.some(pattern => text.includes(pattern))) {
    return { severity: SEVERITY_LEVELS.MEDIUM, confidence: 0.80 };
  }

  // Low severity
  const lowPatterns = [
    'minor', 'small', 'minimal', 'insignificant', 'low risk',
    'nice to have', 'optional',
  ];
  if (lowPatterns.some(pattern => text.includes(pattern))) {
    return { severity: SEVERITY_LEVELS.LOW, confidence: 0.75 };
  }

  // Default to medium with low confidence
  return { severity: SEVERITY_LEVELS.MEDIUM, confidence: 0.6 };
}

/**
 * Extract risk categories from content
 * Deterministic category mapping
 * @param {string} content - Text content
 * @returns {Array} Array of risk categories
 */
function extractRiskCategories(content) {
  const text = content.toLowerCase();
  const categories = [];

  const categoryPatterns = {
    financial_risk: ['financial', 'money', 'cost', 'price', 'budget', 'payment', 'invoice'],
    compliance_risk: ['compliance', 'compliance risk', 'regulatory', 'law', 'regulation', 'standard'],
    operational_risk: ['operational', 'operation', 'process', 'workflow', 'procedure', 'implementation'],
    reputational_risk: ['reputation', 'reputation risk', 'brand', 'trust', 'credibility'],
    legal_risk: ['legal', 'lawsuit', 'litigation', 'contract', 'dispute', 'liability'],
    safety_risk: ['safety', 'dangerous', 'hazard', 'risk of injury', 'workplace safety'],
    documentation_risk: ['documentation', 'document', 'record', 'archive', 'filing', 'evidence'],
    contractual_risk: ['contract', 'contractual', 'agreement', 'terms', 'condition', 'clause'],
  };

  for (const [category, patterns] of Object.entries(categoryPatterns)) {
    if (patterns.some(pattern => text.includes(pattern))) {
      categories.push(category);
    }
  }

  // Always include at least compliance_risk for regulatory obligations
  if (categories.length === 0) {
    categories.push('compliance_risk');
  }

  return [...new Set(categories)]; // Remove duplicates
}

/**
 * Calculate penalty weight based on severity and obligation type
 * Deterministic formula
 * @param {number} severity - Severity level (1-5)
 * @param {string} obligationType - Type of obligation
 * @returns {number} Penalty weight (0-1)
 */
function calculatePenaltyWeight(severity, obligationType) {
  // Base weight from severity
  const severityWeight = severity / 5;

  // Modifier based on obligation type
  const typeModifiers = {
    [OBLIGATION_TYPES.MANDATORY]: 1.0,
    [OBLIGATION_TYPES.RECOMMENDED]: 0.7,
    [OBLIGATION_TYPES.CONDITIONAL]: 0.8,
    [OBLIGATION_TYPES.BEST_PRACTICE]: 0.5,
  };

  const typeModifier = typeModifiers[obligationType] || 0.5;

  // Combined weight (capped at 1.0)
  return Math.min(severityWeight * typeModifier, 1.0);
}

// ============================================================================
// MAIN EXTRACTION FUNCTION
// ============================================================================

/**
 * Extract structured obligations from knowledge chunk
 *
 * @param {Object} chunk - Knowledge chunk
 * @param {string} chunk.id - Unique chunk identifier
 * @param {string} chunk.content - Text content to analyze
 * @param {string} chunk.category - Knowledge category
 * @param {Object} options - Extraction options
 * @param {Object} options.logger - Optional logger instance
 * @returns {Object} Extraction result
 * @throws {Error} If extraction fails
 *
 * @example
 * const chunk = {
 *   id: 'chunk-001',
 *   content: 'All projects must include mandatory safety documentation...',
 *   category: 'normative'
 * };
 *
 * const result = extractObligations(chunk);
 * // Returns:
 * // {
 * //   success: true,
 * //   chunk_id: 'chunk-001',
 * //   obligations: [ { obligation_type, description, severity, ... } ],
 * //   statistics: { total_extracted, low_confidence_count }
 * // }
 */
function extractObligations(chunk, options = {}) {
  const logger = createLogger(options.logger);

  const startTime = Date.now();
  const extractionId = `EXT-${Date.now()}-${chunk.id.substring(0, 8)}`;

  logger.info('extraction_start', {
    extractionId,
    chunkId: chunk.id,
    contentLength: chunk.content?.length || 0,
  });

  try {
    // Validation
    logger.info('validation_start', { action: 'validating knowledge chunk' });
    validateKnowledgeChunk(chunk, logger);
    logger.info('validation_complete', { status: 'success' });

    // Extract sentences that contain obligation keywords
    logger.info('sentence_extraction_start', { action: 'extracting obligation sentences' });

    const sentenceDelimiters = /[.!?]+/;
    const sentences = chunk.content.split(sentenceDelimiters).filter(s => s.trim().length > 0);

    const obligationKeywords = [
      'must', 'shall', 'should', 'required', 'mandatory', 'obligation',
      'must include', 'must be', 'should include', 'is required',
    ];

    const relevantSentences = sentences.filter(sentence =>
      obligationKeywords.some(keyword => sentence.toLowerCase().includes(keyword))
    );

    logger.info('sentence_extraction_complete', {
      totalSentences: sentences.length,
      relevantSentences: relevantSentences.length,
    });

    // Extract obligations from relevant sentences
    logger.info('obligation_extraction_start', { action: 'extracting structured obligations' });

    const obligations = [];
    const lowConfidenceObligations = [];

    relevantSentences.forEach((sentence, index) => {
      const trimmedSentence = sentence.trim();

      // Determine obligation type
      const typeResult = determineObligationType(trimmedSentence);

      // Determine severity
      const severityResult = determineSeverity(trimmedSentence);

      // Extract risk categories
      const riskCategories = extractRiskCategories(trimmedSentence);

      // Calculate penalty weight
      const penaltyWeight = calculatePenaltyWeight(severityResult.severity, typeResult.type);

      // Calculate combined confidence score
      const combinedConfidence = (typeResult.confidence + severityResult.confidence) / 2;

      // Create obligation object
      const obligation = {
        id: generateObligationId(chunk.id, index),
        source_chunk_id: chunk.id,
        obligation_type: typeResult.type,
        description: trimmedSentence,
        severity: severityResult.severity,
        penalty_weight: Math.round(penaltyWeight * 100) / 100,
        risk_categories: riskCategories,
        confidence_score: Math.round(combinedConfidence * 100) / 100,
        extracted_at: new Date().toISOString(),
      };

      // Validate obligation
      const validation = validateExtractedObligation(obligation, logger);

      if (!validation.isValid) {
        logger.warn('invalid_obligation_skipped', {
          obligationId: obligation.id,
          errors: validation.errors,
        });
        return;
      }

      obligations.push(obligation);

      // Track low confidence
      if (combinedConfidence < CONFIDENCE_THRESHOLD) {
        lowConfidenceObligations.push(obligation.id);
        logger.warn('low_confidence_obligation_flagged', {
          obligationId: obligation.id,
          confidence: combinedConfidence,
          threshold: CONFIDENCE_THRESHOLD,
        });
      }
    });

    logger.info('obligation_extraction_complete', {
      totalExtracted: obligations.length,
      lowConfidenceCount: lowConfidenceObligations.length,
    });

    // Create obligation-risk mapping
    logger.info('mapping_creation_start', { action: 'creating obligation-risk mappings' });

    const obligationRiskMapping = obligations.map(obl => ({
      obligation_id: obl.id,
      source_chunk_id: obl.source_chunk_id,
      risk_categories: obl.risk_categories,
      severity_level: obl.severity,
      penalty_weight: obl.penalty_weight,
    }));

    logger.info('mapping_creation_complete', {
      mappingCount: obligationRiskMapping.length,
    });

    // Compile result
    const duration = Date.now() - startTime;

    const result = {
      success: true,
      extractionId,
      chunk_id: chunk.id,
      chunk_category: chunk.category,
      extraction_timestamp: new Date().toISOString(),
      duration: `${duration}ms`,
      regulatory_obligations: obligations,
      obligation_risk_mapping: obligationRiskMapping,
      statistics: {
        total_extracted: obligations.length,
        low_confidence_count: lowConfidenceObligations.length,
        low_confidence_ids: lowConfidenceObligations,
        average_confidence: obligations.length > 0
          ? Math.round((obligations.reduce((sum, o) => sum + o.confidence_score, 0) / obligations.length) * 100) / 100
          : 0,
        severity_distribution: {
          critical: obligations.filter(o => o.severity === SEVERITY_LEVELS.CRITICAL).length,
          high: obligations.filter(o => o.severity === SEVERITY_LEVELS.HIGH).length,
          medium: obligations.filter(o => o.severity === SEVERITY_LEVELS.MEDIUM).length,
          low: obligations.filter(o => o.severity === SEVERITY_LEVELS.LOW).length,
          minimal: obligations.filter(o => o.severity === SEVERITY_LEVELS.MINIMAL).length,
        },
      },
    };

    logger.info('extraction_complete', {
      extractionId,
      success: true,
      duration: `${duration}ms`,
      obligationsExtracted: obligations.length,
    });

    return result;
  } catch (error) {
    const duration = Date.now() - startTime;

    logger.error('extraction_failed', {
      extractionId,
      error: error.message,
      duration: `${duration}ms`,
      stack: error.stack,
    });

    throw error;
  }
}

// ============================================================================
// INSERTION PREPARATION (Non-mutative, pure function)
// ============================================================================

/**
 * Prepare extraction result for database insertion
 * Pure function: creates new objects without modifying originals
 *
 * @param {Object} extractionResult - Result from extractObligations()
 * @returns {Object} Insertion-ready data structure
 *
 * @example
 * const insertionData = prepareForInsertion(extractionResult);
 * // Can then be passed to: insertRegulatoryObligations(supabaseClient, insertionData)
 */
function prepareForInsertion(extractionResult) {
  if (!extractionResult.success) {
    throw new Error('Cannot prepare failed extraction result for insertion');
  }

  return {
    obligations_batch: extractionResult.regulatory_obligations.map(obl => ({
      id: obl.id,
      source_chunk_id: obl.source_chunk_id,
      obligation_type: obl.obligation_type,
      description: obl.description,
      severity: obl.severity,
      penalty_weight: obl.penalty_weight,
      risk_categories: obl.risk_categories,
      confidence_score: obl.confidence_score,
      extracted_at: obl.extracted_at,
      created_at: new Date().toISOString(),
    })),
    risk_mapping_batch: extractionResult.obligation_risk_mapping.map(mapping => ({
      obligation_id: mapping.obligation_id,
      source_chunk_id: mapping.source_chunk_id,
      risk_categories: mapping.risk_categories,
      severity_level: mapping.severity_level,
      penalty_weight: mapping.penalty_weight,
      created_at: new Date().toISOString(),
    })),
    metadata: {
      extraction_id: extractionResult.extractionId,
      chunk_id: extractionResult.chunk_id,
      extraction_timestamp: extractionResult.extraction_timestamp,
      statistics: extractionResult.statistics,
    },
  };
}

// ============================================================================
// EXPORTS
// ============================================================================

module.exports = {
  // Main extraction function
  extractObligations,

  // Insertion preparation
  prepareForInsertion,

  // Helper functions (for testing)
  determineObligationType,
  determineSeverity,
  extractRiskCategories,
  calculatePenaltyWeight,
  validateExtractedObligation,
  generateObligationId,

  // Constants
  ENGINE_VERSION,
  OBLIGATION_TYPES,
  SEVERITY_LEVELS,
  RISK_CATEGORIES,
  CONFIDENCE_THRESHOLD,

  // Logger
  createLogger,
};
