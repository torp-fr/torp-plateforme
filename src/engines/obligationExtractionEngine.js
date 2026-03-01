/**
 * Regulatory Obligation Extraction Engine v2
 * Structured extraction of regulatory obligations from knowledge chunks
 * using LLM-based analysis (GPT-4o-mini)
 *
 * @module obligationExtractionEngine
 */

// ============================================================================
// CONSTANTS
// ============================================================================

const ENGINE_VERSION = 'v2_llm_structured_extraction';
const OBLIGATION_TYPES = ['exigence', 'interdiction', 'recommandation', 'tolérance'];
const APPLICABLE_PHASES = ['conception', 'execution', 'controle'];
const SANCTION_RISKS = ['faible', 'moyen', 'eleve'];
const DB_TABLE = 'regulatory_obligations_v2';
const VERSION_LABEL = 'v1_initial_extraction';

// ============================================================================
// LOGGER
// ============================================================================

/**
 * Create structured logger
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

  return {
    info: (step, data = {}) => {
      console.info(JSON.stringify({
        timestamp: new Date().toISOString(),
        module: 'OBLIGATION_EXTRACTION',
        level: 'info',
        step,
        ...data,
      }));
    },
    warn: (step, data = {}) => {
      console.info(JSON.stringify({
        timestamp: new Date().toISOString(),
        module: 'OBLIGATION_EXTRACTION',
        level: 'warn',
        step,
        ...data,
      }));
    },
    error: (step, data = {}) => {
      console.info(JSON.stringify({
        timestamp: new Date().toISOString(),
        module: 'OBLIGATION_EXTRACTION',
        level: 'error',
        step,
        ...data,
      }));
    },
  };
};

// ============================================================================
// VALIDATION
// ============================================================================

/**
 * Validate knowledge chunk structure
 * @param {Object} chunk - Knowledge chunk
 * @throws {Error} If validation fails
 */
function validateChunk(chunk) {
  if (!chunk || typeof chunk !== 'object') {
    throw new Error('Chunk must be a valid object');
  }

  if (!chunk.id || typeof chunk.id !== 'string') {
    throw new Error('Chunk must have valid id field');
  }

  if (!chunk.content || typeof chunk.content !== 'string' || chunk.content.trim().length === 0) {
    throw new Error('Chunk must have non-empty content field');
  }
}

/**
 * Validate single obligation object
 * @param {Object} obligation - Obligation to validate
 * @returns {Object} { isValid: boolean, errors: Array }
 */
function validateObligation(obligation) {
  const errors = [];

  if (!obligation.article_reference || typeof obligation.article_reference !== 'string') {
    errors.push('article_reference is required (string)');
  }

  if (!obligation.obligation_text || typeof obligation.obligation_text !== 'string' || obligation.obligation_text.trim().length === 0) {
    errors.push('obligation_text is required (non-empty string)');
  }

  if (!OBLIGATION_TYPES.includes(obligation.obligation_type)) {
    errors.push(`obligation_type must be one of: ${OBLIGATION_TYPES.join(', ')}`);
  }

  if (!Number.isInteger(obligation.severity_level) || obligation.severity_level < 1 || obligation.severity_level > 5) {
    errors.push('severity_level must be an integer between 1 and 5');
  }

  if (!APPLICABLE_PHASES.includes(obligation.applicable_phase)) {
    errors.push(`applicable_phase must be one of: ${APPLICABLE_PHASES.join(', ')}`);
  }

  if (!obligation.metier_target || typeof obligation.metier_target !== 'string') {
    errors.push('metier_target is required (string)');
  }

  if (!SANCTION_RISKS.includes(obligation.sanction_risk)) {
    errors.push(`sanction_risk must be one of: ${SANCTION_RISKS.join(', ')}`);
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

// ============================================================================
// PROMPT CONSTRUCTION
// ============================================================================

/**
 * Build LLM prompt for obligation extraction
 * @param {string} chunkContent - Knowledge chunk text content
 * @returns {string} System and user prompt
 */
function buildExtractionPrompt(chunkContent) {
  const systemPrompt = `Tu es un expert en réglementation BTP française.

Ta mission: À partir du texte fourni, extraire UNIQUEMENT les obligations explicites.

Retourne STRICTEMENT un JSON de la forme:
{
  "obligations": [
    {
      "article_reference": "...",
      "obligation_text": "...",
      "obligation_type": "exigence | interdiction | recommandation | tolérance",
      "severity_level": 1-5,
      "applicable_phase": "conception | execution | controle",
      "metier_target": "...",
      "sanction_risk": "faible | moyen | eleve"
    }
  ]
}

Règles:
- Ne retourne rien d'autre que le JSON
- Sois strict: extrait uniquement les obligations explicites
- severity_level: 5=critique, 4=très important, 3=important, 2=moyen, 1=mineur
- metier_target: domaine d'application (ex: "maçonnerie", "électricité", "plomberie", "tous")
- sanction_risk: risque de sanction en cas de non-conformité`;

  const userPrompt = `Extrait les obligations du texte suivant:\n\n${chunkContent}`;

  return { systemPrompt, userPrompt };
}

// ============================================================================
// LLM INTEGRATION
// ============================================================================

/**
 * Call LLM for obligation extraction
 * @param {Object} openaiClient - OpenAI client instance
 * @param {string} systemPrompt - System prompt
 * @param {string} userPrompt - User prompt
 * @param {Object} logger - Logger instance
 * @returns {Promise<Object>} Parsed obligations or empty array
 * @throws {Error} On LLM call failure
 */
async function callLlmForExtraction(openaiClient, systemPrompt, userPrompt, logger) {
  logger.info('llm_call_start', { action: 'calling LLM for obligation extraction' });

  try {
    const response = await openaiClient.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.2,
      max_tokens: 2000,
      response_format: { type: 'json_object' },
    });

    const content = response.choices[0]?.message?.content;

    if (!content) {
      logger.warn('llm_empty_response', { reason: 'no content in response' });
      return { obligations: [] };
    }

    logger.info('llm_response_received', { contentLength: content.length });

    const parsed = JSON.parse(content);

    if (!parsed.obligations || !Array.isArray(parsed.obligations)) {
      logger.warn('llm_invalid_structure', { reason: 'obligations array not found' });
      return { obligations: [] };
    }

    logger.info('llm_parse_complete', { obligationCount: parsed.obligations.length });

    return parsed;
  } catch (error) {
    logger.error('llm_call_failed', { error: error.message });
    throw new Error(`LLM extraction failed: ${error.message}`);
  }
}

// ============================================================================
// DATABASE PERSISTENCE
// ============================================================================

/**
 * Insert obligations into database
 * @param {Object} supabase - Supabase client instance
 * @param {Array} obligations - Validated obligations
 * @param {string} chunkId - Knowledge chunk ID
 * @param {string} documentId - Document ID
 * @param {Object} logger - Logger instance
 * @returns {Promise<number>} Count of inserted obligations
 * @throws {Error} On database insert failure
 */
async function persistObligations(supabase, obligations, chunkId, documentId, logger) {
  if (!obligations || obligations.length === 0) {
    logger.info('persist_skipped', { reason: 'no obligations to persist' });
    return 0;
  }

  logger.info('persist_start', { obligationCount: obligations.length });

  try {
    const now = new Date().toISOString();
    const batch = obligations.map((obl, index) => ({
      knowledge_chunk_id: chunkId,
      document_id: documentId,
      article_reference: obl.article_reference,
      obligation_text: obl.obligation_text,
      obligation_type: obl.obligation_type,
      severity_level: obl.severity_level,
      applicable_phase: obl.applicable_phase,
      metier_target: obl.metier_target,
      sanction_risk: obl.sanction_risk,
      version_label: VERSION_LABEL,
      extraction_order: index,
      extracted_at: now,
      created_at: now,
    }));

    const { data, error } = await supabase
      .from(DB_TABLE)
      .insert(batch)
      .select();

    if (error) {
      logger.error('persist_failed', { error: error.message });
      throw new Error(`Database insert failed: ${error.message}`);
    }

    const insertedCount = data ? data.length : 0;
    logger.info('persist_complete', { insertedCount });

    return insertedCount;
  } catch (error) {
    logger.error('persist_error', { error: error.message });
    throw error;
  }
}

// ============================================================================
// MAIN EXTRACTION FUNCTION
// ============================================================================

/**
 * Extract regulatory obligations from knowledge chunk using LLM
 *
 * @param {Object} chunk - Knowledge chunk
 * @param {string} chunk.id - Unique chunk identifier
 * @param {string} chunk.content - Text content to analyze
 * @param {string} documentId - Parent document ID
 * @param {Object} supabase - Supabase client instance
 * @param {Object} openaiClient - OpenAI client instance
 * @param {Object} options - Optional parameters
 * @param {Object} options.logger - Optional logger instance
 * @returns {Promise<Object>} Extraction result
 * @throws {Error} On validation or extraction failure
 *
 * @example
 * const result = await extractObligationsFromChunk(
 *   { id: 'chunk-001', content: 'Article 5: Tous les projets doivent...' },
 *   'doc-123',
 *   supabase,
 *   openaiClient
 * );
 * // Returns:
 * // {
 * //   inserted_count: 3,
 * //   obligations: [ { article_reference, obligation_text, ... }, ... ]
 * // }
 */
async function extractObligationsFromChunk(chunk, documentId, supabase, openaiClient, options = {}) {
  const logger = createLogger(options.logger);

  const startTime = Date.now();
  const extractionId = `EXT-${Date.now()}-${chunk.id.substring(0, 8)}`;

  logger.info('extraction_start', {
    extractionId,
    chunkId: chunk.id,
    documentId,
    contentLength: chunk.content?.length || 0,
  });

  try {
    // ======================================================================
    // VALIDATION
    // ======================================================================
    logger.info('validation_start', { action: 'validating chunk' });
    validateChunk(chunk);

    if (!supabase || typeof supabase.from !== 'function') {
      throw new Error('Invalid Supabase client');
    }

    if (!openaiClient || typeof openaiClient.chat?.completions?.create !== 'function') {
      throw new Error('Invalid OpenAI client');
    }

    if (!documentId || typeof documentId !== 'string') {
      throw new Error('Document ID is required (string)');
    }

    logger.info('validation_complete', { status: 'success' });

    // ======================================================================
    // LLM EXTRACTION
    // ======================================================================
    logger.info('prompt_building', { action: 'constructing extraction prompt' });
    const { systemPrompt, userPrompt } = buildExtractionPrompt(chunk.content);

    const llmResult = await callLlmForExtraction(openaiClient, systemPrompt, userPrompt, logger);

    // ======================================================================
    // VALIDATION & FILTERING
    // ======================================================================
    logger.info('obligation_validation_start', {
      totalFromLlm: llmResult.obligations.length,
    });

    const validObligations = [];
    const invalidObligations = [];

    for (const obligation of llmResult.obligations) {
      const validation = validateObligation(obligation);

      if (validation.isValid) {
        validObligations.push(obligation);
      } else {
        invalidObligations.push({
          obligation,
          errors: validation.errors,
        });
        logger.warn('invalid_obligation_filtered', {
          errors: validation.errors,
        });
      }
    }

    logger.info('obligation_validation_complete', {
      validCount: validObligations.length,
      invalidCount: invalidObligations.length,
    });

    // ======================================================================
    // PERSISTENCE
    // ======================================================================
    const insertedCount = await persistObligations(
      supabase,
      validObligations,
      chunk.id,
      documentId,
      logger
    );

    // ======================================================================
    // RESULT COMPILATION
    // ======================================================================
    const duration = Date.now() - startTime;

    const result = {
      extractionId,
      chunk_id: chunk.id,
      document_id: documentId,
      inserted_count: insertedCount,
      obligations: validObligations,
      statistics: {
        total_from_llm: llmResult.obligations.length,
        valid_count: validObligations.length,
        invalid_count: invalidObligations.length,
        filtered_obligations: invalidObligations,
      },
      timestamp: new Date().toISOString(),
      duration: `${duration}ms`,
    };

    logger.info('extraction_complete', {
      extractionId,
      insertedCount,
      duration: `${duration}ms`,
      status: 'success',
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
// BATCH EXTRACTION
// ============================================================================

/**
 * Extract obligations from multiple chunks
 * @param {Array} chunks - Knowledge chunks
 * @param {string} documentId - Document ID
 * @param {Object} supabase - Supabase client
 * @param {Object} openaiClient - OpenAI client
 * @param {Object} options - Optional parameters
 * @returns {Promise<Object>} Batch result with statistics
 */
async function extractObligationsFromChunks(chunks, documentId, supabase, openaiClient, options = {}) {
  const logger = createLogger(options.logger);

  logger.info('batch_start', {
    chunkCount: chunks.length,
    documentId,
  });

  const results = {
    document_id: documentId,
    total_chunks: chunks.length,
    successful: 0,
    failed: 0,
    total_obligations_inserted: 0,
    extraction_results: [],
    timestamp: new Date().toISOString(),
  };

  for (const chunk of chunks) {
    try {
      const result = await extractObligationsFromChunk(
        chunk,
        documentId,
        supabase,
        openaiClient,
        options
      );

      results.successful++;
      results.total_obligations_inserted += result.inserted_count;
      results.extraction_results.push(result);
    } catch (error) {
      results.failed++;
      results.extraction_results.push({
        chunk_id: chunk.id,
        status: 'failed',
        error: error.message,
      });
      logger.error('chunk_extraction_failed', {
        chunkId: chunk.id,
        error: error.message,
      });
    }
  }

  logger.info('batch_complete', {
    successful: results.successful,
    failed: results.failed,
    totalInserted: results.total_obligations_inserted,
  });

  return results;
}

// ============================================================================
// EXPORTS
// ============================================================================

module.exports = {
  // Main functions
  extractObligationsFromChunk,
  extractObligationsFromChunks,

  // Utilities (for testing)
  buildExtractionPrompt,
  validateObligation,
  validateChunk,

  // Constants
  ENGINE_VERSION,
  OBLIGATION_TYPES,
  APPLICABLE_PHASES,
  SANCTION_RISKS,
  DB_TABLE,
  VERSION_LABEL,

  // Logger
  createLogger,
};
