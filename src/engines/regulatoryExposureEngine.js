// ============================================================================
// REGULATORY EXPOSURE ENGINE
// ============================================================================
// Computes deterministic regulatory exposure index for construction projects

// ============================================================================
// CONSTANTS & VERSION
// ============================================================================

const ENGINE_VERSION = 'v1.0_regulatory-exposure';
const FORCE_COEFFICIENTS = {
  mandatory: 1.0,
  recommended: 0.6,
  informative: 0.3,
};
const EXPOSURE_INDEX_MULTIPLIER = 2;
const EXPOSURE_INDEX_MAX = 100;
const VALID_AUTHORITY_LEVELS = [1, 2, 3];

// ============================================================================
// LOGGER FACTORY
// ============================================================================

const createLogger = (externalLogger = null) => {
  if (externalLogger && typeof externalLogger.info === 'function') {
    return {
      info: (step, data = {}) => {
        externalLogger.info({ module: 'REGULATORY_EXPOSURE', step, ...data });
      },
      warn: (step, data = {}) => {
        if (typeof externalLogger.warn === 'function') {
          externalLogger.warn({ module: 'REGULATORY_EXPOSURE', step, ...data });
        } else {
          externalLogger.info({ module: 'REGULATORY_EXPOSURE', level: 'warn', step, ...data });
        }
      },
      error: (step, data = {}) => {
        if (typeof externalLogger.error === 'function') {
          externalLogger.error({ module: 'REGULATORY_EXPOSURE', step, ...data });
        } else {
          externalLogger.info({ module: 'REGULATORY_EXPOSURE', level: 'error', step, ...data });
        }
      },
    };
  }

  // Fallback to console.info (structured JSON only)
  return {
    info: (step, data = {}) => {
      const logEntry = {
        timestamp: new Date().toISOString(),
        module: 'REGULATORY_EXPOSURE',
        level: 'info',
        step,
        ...data,
      };
      console.info(JSON.stringify(logEntry));
    },
    warn: (step, data = {}) => {
      const logEntry = {
        timestamp: new Date().toISOString(),
        module: 'REGULATORY_EXPOSURE',
        level: 'warn',
        step,
        ...data,
      };
      console.info(JSON.stringify(logEntry));
    },
    error: (step, data = {}) => {
      const logEntry = {
        timestamp: new Date().toISOString(),
        module: 'REGULATORY_EXPOSURE',
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
 * Validate project context object
 *
 * @param {object} projectContext - Project metadata
 * @param {object} logger - Logger instance
 * @throws {Error} If validation fails
 */
const validateProjectContext = (projectContext, logger) => {
  logger.info('validate_project_context', { action: 'start' });

  const errors = [];

  // Required fields
  const requiredFields = ['type_travaux', 'surface', 'localisation'];
  for (const field of requiredFields) {
    if (!projectContext[field]) {
      errors.push(`${field} is required`);
    }
  }

  // Type validations
  if (projectContext.type_travaux && typeof projectContext.type_travaux !== 'string') {
    errors.push('type_travaux must be a string');
  }

  if (projectContext.surface !== undefined && typeof projectContext.surface !== 'number') {
    errors.push('surface must be a number');
  }

  if (projectContext.localisation && typeof projectContext.localisation !== 'string') {
    errors.push('localisation must be a string');
  }

  // Optional boolean fields
  const booleanFields = ['modification_structurelle', 'zone_abf', 'erp', 'permis_requis', 'lot_technique_sensible'];
  for (const field of booleanFields) {
    if (projectContext[field] !== undefined && typeof projectContext[field] !== 'boolean') {
      errors.push(`${field} must be a boolean if provided`);
    }
  }

  if (errors.length > 0) {
    logger.error('validate_project_context', { errors });
    throw new Error(`Project context validation failed: ${errors.join('; ')}`);
  }

  logger.info('validate_project_context', { status: 'success' });
};

/**
 * Validate regulatory documents array
 *
 * @param {array} regulatoryDocuments - Array of regulatory documents
 * @param {object} logger - Logger instance
 * @throws {Error} If validation fails
 */
const validateRegulatoryDocuments = (regulatoryDocuments, logger) => {
  logger.info('validate_regulatory_documents', { action: 'start' });

  if (!Array.isArray(regulatoryDocuments)) {
    logger.error('validate_regulatory_documents', { reason: 'not an array' });
    throw new Error('regulatoryDocuments must be an array');
  }

  const errors = [];

  for (let i = 0; i < regulatoryDocuments.length; i++) {
    const doc = regulatoryDocuments[i];

    // Required fields per document
    if (!doc.title || typeof doc.title !== 'string') {
      errors.push(`Document ${i}: title is required and must be string`);
    }

    if (!Number.isInteger(doc.authority_level) || !VALID_AUTHORITY_LEVELS.includes(doc.authority_level)) {
      errors.push(`Document ${i}: authority_level must be 1, 2, or 3`);
    }

    if (!Number.isInteger(doc.legal_weight) || doc.legal_weight < 1 || doc.legal_weight > 5) {
      errors.push(`Document ${i}: legal_weight must be integer 1-5`);
    }

    if (!doc.regulatory_force || !['mandatory', 'recommended', 'informative'].includes(doc.regulatory_force)) {
      errors.push(`Document ${i}: regulatory_force must be mandatory|recommended|informative`);
    }

    if (!Array.isArray(doc.applicable_project_types)) {
      errors.push(`Document ${i}: applicable_project_types must be an array`);
    }
  }

  if (errors.length > 0) {
    logger.error('validate_regulatory_documents', { errors, document_count: regulatoryDocuments.length });
    throw new Error(`Regulatory documents validation failed: ${errors.join('; ')}`);
  }

  logger.info('validate_regulatory_documents', { status: 'success', document_count: regulatoryDocuments.length });
};

// ============================================================================
// FILTERING & PROCESSING
// ============================================================================

/**
 * Filter applicable regulatory documents based on project context and validity dates.
 *
 * A document is applicable if:
 * 1. Project type matches applicable_project_types
 * 2. effective_date <= today
 * 3. expiration_date is null OR >= today
 *
 * @param {object} projectContext - Project metadata
 * @param {array} regulatoryDocuments - Array of regulatory documents
 * @param {object} logger - Logger instance
 * @returns {array} Filtered applicable documents
 */
const filterApplicableDocuments = (projectContext, regulatoryDocuments, logger) => {
  logger.info('filter_applicable_documents', { action: 'start', total_documents: regulatoryDocuments.length });

  const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
  const projectType = projectContext.type_travaux.toLowerCase();
  const applicable = [];

  for (const doc of regulatoryDocuments) {
    // Check if project type is applicable
    const typeMatches = doc.applicable_project_types.some(
      type => type.toLowerCase() === projectType || type.toLowerCase() === 'all',
    );

    if (!typeMatches) {
      continue;
    }

    // Check effective date (must be <= today)
    if (doc.effective_date && doc.effective_date > today) {
      continue;
    }

    // Check expiration date (must be null or >= today)
    if (doc.expiration_date && doc.expiration_date < today) {
      continue;
    }

    applicable.push(doc);
  }

  logger.info('filter_applicable_documents', { status: 'success', applicable_count: applicable.length });
  return applicable;
};

/**
 * Compute weight for a single regulatory document.
 *
 * weight = authority_level * legal_weight * forceCoefficient
 *
 * @param {object} doc - Regulatory document
 * @returns {number} Computed weight
 */
const computeDocumentWeight = (doc) => {
  const forceCoeff = FORCE_COEFFICIENTS[doc.regulatory_force] || 0;
  return doc.authority_level * doc.legal_weight * forceCoeff;
};

/**
 * Count high-authority documents (authority_level = 1).
 *
 * @param {array} applicableDocs - Filtered documents
 * @returns {number} Count of high-authority documents
 */
const countHighAuthorityDocuments = (applicableDocs) => {
  return applicableDocs.filter(doc => doc.authority_level === 1).length;
};

/**
 * Build breakdown array with weights for output.
 *
 * @param {array} applicableDocs - Filtered documents
 * @returns {array} Breakdown entries
 */
const buildBreakdown = (applicableDocs) => {
  return applicableDocs.map(doc => ({
    title: doc.title,
    authority_level: doc.authority_level,
    legal_weight: doc.legal_weight,
    regulatory_force: doc.regulatory_force,
    weight: computeDocumentWeight(doc),
  }));
};

// ============================================================================
// MAIN EXPOSURE COMPUTATION
// ============================================================================

/**
 * Compute regulatory exposure index for a construction project.
 *
 * Pipeline:
 * 1. Validate project context
 * 2. Validate regulatory documents array
 * 3. Filter applicable documents
 * 4. Compute weights for each document
 * 5. Sum weights and normalize to 0-100 scale
 * 6. Return structured exposure data
 *
 * @param {object} projectContext - Project metadata
 * @param {array} regulatoryDocuments - Array of regulatory documents
 * @param {object} options - Configuration object
 * @param {object} options.logger - Optional external logger instance
 * @returns {object} Exposure result with index and breakdown
 * @throws {Error} On validation failure
 */
const computeRegulatoryExposure = (projectContext, regulatoryDocuments, options = {}) => {
  const logger = createLogger(options.logger);

  try {
    logger.info('compute_exposure_start', { action: 'regulatory exposure computation', engine_version: ENGINE_VERSION });

    // Step 1: Validate inputs
    validateProjectContext(projectContext, logger);
    validateRegulatoryDocuments(regulatoryDocuments, logger);

    // Step 2: Filter applicable documents
    const applicableDocs = filterApplicableDocuments(projectContext, regulatoryDocuments, logger);

    logger.info('filtering_complete', { applicable_count: applicableDocs.length });

    // Step 3: Compute exposure
    let totalWeight = 0;
    const breakdown = buildBreakdown(applicableDocs);

    for (const entry of breakdown) {
      totalWeight += entry.weight;
    }

    // Step 4: Normalize exposure index to 0-100 scale
    const rawIndex = totalWeight * EXPOSURE_INDEX_MULTIPLIER;
    const exposure_index = Math.min(EXPOSURE_INDEX_MAX, Math.round(rawIndex));

    // Step 5: Count high-authority documents
    const high_authority_count = countHighAuthorityDocuments(applicableDocs);

    // Step 6: Build result
    const result = {
      exposure_index,
      applicable_count: applicableDocs.length,
      high_authority_count,
      breakdown,
      engine_version: ENGINE_VERSION,
    };

    logger.info('compute_exposure_completed', {
      status: 'success',
      exposure_index,
      applicable_count: applicableDocs.length,
      total_weight: Math.round(totalWeight * 100) / 100,
    });

    return result;
  } catch (error) {
    logger.error('compute_exposure_error', { error_message: error.message });
    throw error;
  }
};

// ============================================================================
// EXPORTS
// ============================================================================

export { computeRegulatoryExposure };
