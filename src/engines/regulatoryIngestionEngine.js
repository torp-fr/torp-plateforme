import { OpenAI } from 'openai';

// ============================================================================
// CONSTANTS & VERSION
// ============================================================================

const ENGINE_VERSION = 'v1.1_secure';
const MAX_DOCUMENT_SIZE = 25000;
const HALLUCINATION_CHECK_THRESHOLD = 15000;
const MAX_RETRY_ATTEMPTS = 2;
const VALID_AUTHORITY_LEVELS = [1, 2, 3];
const VALID_REGULATORY_FORCES = ['mandatory', 'recommended', 'informative'];
const VALID_LEGAL_WEIGHTS = [1, 2, 3, 4, 5];
const VALID_SOURCE_TYPES = ['official', 'expert', 'community'];
const ISO_DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

// ============================================================================
// LOGGER FACTORY
// ============================================================================

const createLogger = (externalLogger = null) => {
  if (externalLogger && typeof externalLogger.info === 'function') {
    return {
      info: (step, data = {}) => {
        externalLogger.info({ module: 'REGULATORY_INGESTION', step, ...data });
      },
      warn: (step, data = {}) => {
        if (typeof externalLogger.warn === 'function') {
          externalLogger.warn({ module: 'REGULATORY_INGESTION', step, ...data });
        } else {
          externalLogger.info({ module: 'REGULATORY_INGESTION', level: 'warn', step, ...data });
        }
      },
      error: (step, data = {}) => {
        if (typeof externalLogger.error === 'function') {
          externalLogger.error({ module: 'REGULATORY_INGESTION', step, ...data });
        } else {
          externalLogger.info({ module: 'REGULATORY_INGESTION', level: 'error', step, ...data });
        }
      },
    };
  }

  // Fallback to console.info (structured JSON only)
  return {
    info: (step, data = {}) => {
      const logEntry = {
        timestamp: new Date().toISOString(),
        module: 'REGULATORY_INGESTION',
        level: 'info',
        step,
        ...data,
      };
      console.info(JSON.stringify(logEntry));
    },
    warn: (step, data = {}) => {
      const logEntry = {
        timestamp: new Date().toISOString(),
        module: 'REGULATORY_INGESTION',
        level: 'warn',
        step,
        ...data,
      };
      console.info(JSON.stringify(logEntry));
    },
    error: (step, data = {}) => {
      const logEntry = {
        timestamp: new Date().toISOString(),
        module: 'REGULATORY_INGESTION',
        level: 'error',
        step,
        ...data,
      };
      console.info(JSON.stringify(logEntry));
    },
  };
};

// ============================================================================
// INPUT VALIDATION
// ============================================================================

const validateInput = (documentText, logger) => {
  logger.info('validate_input', { action: 'start' });

  if (!documentText || typeof documentText !== 'string') {
    logger.error('validate_input', { reason: 'documentText is not a string' });
    throw new Error('documentText must be a non-empty string');
  }

  if (documentText.trim().length === 0) {
    logger.error('validate_input', { reason: 'documentText is empty' });
    throw new Error('documentText cannot be empty');
  }

  logger.info('validate_input', { status: 'success', length: documentText.length });
  return documentText;
};

const validateSchema = (parsedObject, logger) => {
  logger.info('validate_schema', { action: 'start' });

  const errors = [];

  // Required fields (must be present and properly typed)
  const requiredFields = {
    title: 'string',
    authority_level: 'number',
    regulatory_force: 'string',
    legal_weight: 'number',
    source_type: 'string',
  };

  for (const [field, expectedType] of Object.entries(requiredFields)) {
    if (expectedType === 'string' && (!parsedObject[field] || typeof parsedObject[field] !== 'string')) {
      errors.push(`${field} (required): must be a non-empty string`);
    }
    if (expectedType === 'number' && !Number.isInteger(parsedObject[field])) {
      errors.push(`${field} (required): must be an integer`);
    }
  }

  // Enum validations for required fields
  if (!VALID_AUTHORITY_LEVELS.includes(parsedObject.authority_level)) {
    errors.push(`authority_level must be one of [${VALID_AUTHORITY_LEVELS.join(', ')}]`);
  }

  if (!VALID_REGULATORY_FORCES.includes(parsedObject.regulatory_force)) {
    errors.push(`regulatory_force must be one of [${VALID_REGULATORY_FORCES.join(', ')}]`);
  }

  if (!VALID_LEGAL_WEIGHTS.includes(parsedObject.legal_weight)) {
    errors.push(`legal_weight must be one of [${VALID_LEGAL_WEIGHTS.join(', ')}]`);
  }

  if (!VALID_SOURCE_TYPES.includes(parsedObject.source_type)) {
    errors.push(`source_type must be one of [${VALID_SOURCE_TYPES.join(', ')}]`);
  }

  // Optional string fields (validate only if present)
  const optionalStringFields = ['short_code', 'summary', 'domain'];
  for (const field of optionalStringFields) {
    if (parsedObject[field] !== undefined && parsedObject[field] !== null && typeof parsedObject[field] !== 'string') {
      errors.push(`${field} (optional): must be a string if provided`);
    }
  }

  // Version number validation
  if (parsedObject.version_number !== undefined && (!Number.isInteger(parsedObject.version_number) || parsedObject.version_number < 1)) {
    errors.push('version_number must be a positive integer if provided');
  }

  // Array validations (must be arrays if present)
  const arrayFields = ['risk_categories', 'applicable_project_types', 'key_obligations', 'risk_implications', 'applicability_conditions'];
  for (const field of arrayFields) {
    if (parsedObject[field] !== undefined && parsedObject[field] !== null && !Array.isArray(parsedObject[field])) {
      errors.push(`${field}: must be an array if provided`);
    }
  }

  // Date validations (ISO 8601 or null)
  const dateFields = ['effective_date', 'expiration_date'];
  for (const field of dateFields) {
    if (parsedObject[field] && typeof parsedObject[field] === 'string' && !ISO_DATE_REGEX.test(parsedObject[field])) {
      errors.push(`${field}: must be ISO 8601 format (YYYY-MM-DD) or null`);
    }
  }

  if (errors.length > 0) {
    logger.error('validate_schema', { errors });
    throw new Error(`Schema validation failed: ${errors.join('; ')}`);
  }

  logger.info('validate_schema', { status: 'success' });
  return parsedObject;
};

// ============================================================================
// TEXT PROCESSING FUNCTIONS
// ============================================================================

const normalizeDocumentSize = (documentText, logger) => {
  if (documentText.length > MAX_DOCUMENT_SIZE) {
    logger.warn('normalize_document_size', {
      truncated: true,
      original_length: documentText.length,
      new_length: MAX_DOCUMENT_SIZE,
    });
    return documentText.substring(0, MAX_DOCUMENT_SIZE);
  }
  return documentText;
};

/**
 * Safely extracts and parses a single JSON object from LLM response text.
 * Handles cases where LLM adds text before/after JSON or returns malformed JSON.
 *
 * Algorithm:
 * 1. Find first opening brace {
 * 2. Count braces to find matching closing brace }
 * 3. Extract substring between braces
 * 4. Attempt JSON.parse()
 * 5. Throw explicit error on failure
 *
 * @param {string} responseText - Raw LLM response
 * @param {object} logger - Logger instance
 * @returns {object} Parsed JSON object
 * @throws {Error} If no valid JSON or parse fails
 */
const extractJsonObjectSafely = (responseText, logger) => {
  logger.info('extract_json', { action: 'start' });

  const firstBrace = responseText.indexOf('{');
  if (firstBrace === -1) {
    logger.error('extract_json', { reason: 'no opening brace found' });
    throw new Error('No valid JSON object found in LLM response');
  }

  let braceCount = 0;
  let endIndex = -1;

  // Find matching closing brace
  for (let i = firstBrace; i < responseText.length; i++) {
    if (responseText[i] === '{') braceCount++;
    if (responseText[i] === '}') braceCount--;
    if (braceCount === 0) {
      endIndex = i;
      break;
    }
  }

  if (endIndex === -1) {
    logger.error('extract_json', { reason: 'no matching closing brace found' });
    throw new Error('No valid JSON object found in LLM response');
  }

  const jsonStr = responseText.substring(firstBrace, endIndex + 1);

  try {
    const parsed = JSON.parse(jsonStr);
    logger.info('extract_json', { status: 'success', object_keys_count: Object.keys(parsed).length });
    return parsed;
  } catch (error) {
    logger.error('extract_json', { reason: 'JSON parsing failed', error_message: error.message });
    throw new Error(`Failed to parse JSON from LLM response: ${error.message}`);
  }
};

/**
 * Normalize fields with smart defaults for missing optional fields.
 * Creates a new object (non-mutative).
 *
 * @param {object} obj - Parsed object from LLM
 * @param {object} logger - Logger instance
 * @returns {object} New normalized object
 */
const normalizeFields = (obj, logger) => {
  logger.info('normalize_fields', { action: 'start' });

  // Clone object to avoid mutation
  const normalized = JSON.parse(JSON.stringify(obj));

  // Trim string fields
  const stringFields = ['title', 'short_code', 'domain', 'summary'];
  for (const field of stringFields) {
    if (typeof normalized[field] === 'string') {
      normalized[field] = normalized[field].trim();
    }
  }

  // Initialize missing arrays with empty arrays
  const arrayFields = ['risk_categories', 'applicable_project_types', 'key_obligations', 'risk_implications', 'applicability_conditions'];
  for (const field of arrayFields) {
    if (!Array.isArray(normalized[field])) {
      normalized[field] = [];
    }
  }

  // Validate and normalize dates
  for (const field of ['effective_date', 'expiration_date']) {
    if (normalized[field] && typeof normalized[field] === 'string') {
      if (!ISO_DATE_REGEX.test(normalized[field])) {
        normalized[field] = null;
      }
    } else if (!normalized[field]) {
      normalized[field] = null;
    }
  }

  // Set version number default if missing
  if (!normalized.version_number) {
    normalized.version_number = 1;
  }

  logger.info('normalize_fields', { status: 'success' });
  return normalized;
};

// ============================================================================
// PROMPT BUILDING
// ============================================================================

const buildPrompt = () => {
  const systemPrompt = `You are an expert regulatory classification system specialized in construction and BTP (Bâtiment et Travaux Publics) industry standards.

Your task is to analyze regulatory documents and classify them according to a strict schema.

You MUST return ONLY a valid JSON object with no additional text before or after it. The JSON must strictly follow this schema:

{
  "title": "Official name of the regulation or standard",
  "short_code": "Abbreviated code (e.g., NF-P-001)",
  "authority_level": 1,
  "regulatory_force": "mandatory",
  "legal_weight": 1,
  "domain": "Domain of application (e.g., structural_safety, thermal_comfort)",
  "risk_categories": ["category1", "category2"],
  "applicable_project_types": ["residential", "commercial"],
  "version_number": 1,
  "effective_date": "YYYY-MM-DD",
  "expiration_date": "YYYY-MM-DD",
  "source_type": "official",
  "summary": "Comprehensive summary of the document",
  "key_obligations": ["obligation1", "obligation2"],
  "risk_implications": ["risk1", "risk2"],
  "applicability_conditions": ["condition1", "condition2"]
}

FIELD DEFINITIONS:
- authority_level: 1=National, 2=Regional, 3=Local
- regulatory_force: mandatory|recommended|informative
- legal_weight: 1=Low, 2=Low-Medium, 3=Medium, 4=Medium-High, 5=High
- domain: Primary domain of regulation
- source_type: official|expert|community
- All dates must be in ISO 8601 format (YYYY-MM-DD) or null if unknown

CRITICAL: Every field in the title, domain, and short_code MUST be grounded in the source document text. Do not hallucinate metadata.`;

  return { systemPrompt };
};

// ============================================================================
// LLM INTEGRATION
// ============================================================================

/**
 * Calculate optimal max_tokens based on document size.
 * Larger documents may need more tokens for comprehensive classification.
 *
 * @param {number} textLength - Length of document in characters
 * @returns {number} max_tokens value
 */
const calculateMaxTokens = (textLength) => {
  if (textLength > HALLUCINATION_CHECK_THRESHOLD) {
    return 2500;
  }
  return 1500;
};

/**
 * Call OpenAI with deterministic parameters.
 * Does NOT retry on its own (see callOpenAIWithRetry for retry logic).
 *
 * @param {string} normalizedText - Normalized document text
 * @param {object} logger - Logger instance
 * @returns {Promise<string>} LLM response content
 * @throws {Error} On API failure
 */
const callOpenAI = async (normalizedText, logger) => {
  logger.info('call_llm', { action: 'start', text_length: normalizedText.length });

  if (!process.env.OPENAI_API_KEY) {
    logger.error('call_llm', { reason: 'OPENAI_API_KEY not set' });
    throw new Error('OPENAI_API_KEY environment variable is not set');
  }

  const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  });

  const { systemPrompt } = buildPrompt();
  const maxTokens = calculateMaxTokens(normalizedText.length);

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: systemPrompt,
        },
        {
          role: 'user',
          content: `Analyze and classify the following regulatory document:\n\n${normalizedText}`,
        },
      ],
      temperature: 0.2,
      max_tokens: maxTokens,
    });

    logger.info('call_llm', { status: 'success', tokens_used: response.usage.total_tokens });

    if (!response.choices[0] || !response.choices[0].message) {
      logger.error('call_llm', { reason: 'invalid response structure' });
      throw new Error('Invalid response structure from OpenAI');
    }

    return response.choices[0].message.content;
  } catch (error) {
    logger.error('call_llm', { error_message: error.message });
    throw new Error(`OpenAI API call failed: ${error.message}`);
  }
};

/**
 * Call OpenAI with intelligent retry on JSON parsing failures.
 * Only retries if the JSON extraction fails, not on API errors.
 *
 * @param {string} normalizedText - Normalized document text
 * @param {object} logger - Logger instance
 * @returns {Promise<string>} LLM response content with valid JSON
 * @throws {Error} On persistent failures
 */
const callOpenAIWithRetry = async (normalizedText, logger) => {
  let lastError;

  for (let attempt = 1; attempt <= MAX_RETRY_ATTEMPTS; attempt++) {
    try {
      logger.info('call_llm_with_retry', { attempt, max_attempts: MAX_RETRY_ATTEMPTS });
      const response = await callOpenAI(normalizedText, logger);

      // Test if JSON can be extracted from response
      extractJsonObjectSafely(response, logger);

      // If we get here, JSON extraction succeeded
      logger.info('call_llm_with_retry', { status: 'success', attempt });
      return response;
    } catch (error) {
      lastError = error;

      // Only retry on JSON extraction errors, not API errors
      if (!error.message.includes('JSON') && !error.message.includes('brace')) {
        logger.error('call_llm_with_retry', { attempt, error_message: error.message, will_retry: false });
        throw error;
      }

      if (attempt < MAX_RETRY_ATTEMPTS) {
        logger.warn('call_llm_with_retry', { attempt, error_message: error.message, will_retry: true });
      }
    }
  }

  logger.error('call_llm_with_retry', { status: 'failed', attempts: MAX_RETRY_ATTEMPTS, final_error: lastError.message });
  throw new Error(`Failed to get valid JSON after ${MAX_RETRY_ATTEMPTS} attempts: ${lastError.message}`);
};

// ============================================================================
// HALLUCINATION GUARD
// ============================================================================

/**
 * Verify that critical fields are grounded in the source document.
 * Detects potential hallucinations where LLM invents metadata not in source.
 *
 * @param {object} normalized - Normalized object from LLM
 * @param {string} sourceText - Original document text
 * @param {object} logger - Logger instance
 * @throws {Error} If potential hallucination detected
 */
const antiHallucinationGuard = (normalized, sourceText, logger) => {
  logger.info('anti_hallucination_guard', { action: 'start' });

  const sourceTextLower = sourceText.toLowerCase();
  const issuesFound = [];

  // Check if title appears in source (approximate match)
  if (normalized.title) {
    const titleWords = normalized.title.toLowerCase().split(/\s+/).slice(0, 3); // First 3 words
    const hasAnyTitleWord = titleWords.some(word => sourceTextLower.includes(word));
    if (!hasAnyTitleWord && normalized.title.length > 10) {
      issuesFound.push(`title "${normalized.title}" not grounded in source`);
    }
  }

  // Check if domain appears in source
  if (normalized.domain) {
    if (!sourceTextLower.includes(normalized.domain.toLowerCase())) {
      issuesFound.push(`domain "${normalized.domain}" not found in source`);
    }
  }

  // Check if short_code appears in source
  if (normalized.short_code && normalized.short_code.length > 2) {
    if (!sourceText.includes(normalized.short_code)) {
      issuesFound.push(`short_code "${normalized.short_code}" not found in source`);
    }
  }

  if (issuesFound.length > 0) {
    logger.warn('anti_hallucination_guard', { issues: issuesFound });
    // Log warning but don't throw - allow document with warning flag
    return { hallucination_risk: true, issues: issuesFound };
  }

  logger.info('anti_hallucination_guard', { status: 'passed' });
  return { hallucination_risk: false, issues: [] };
};

// ============================================================================
// MAIN INGESTION FUNCTION
// ============================================================================

/**
 * Ingest a regulatory document and classify it using OpenAI.
 *
 * Pipeline:
 * 1. Validate input
 * 2. Normalize document size
 * 3. Call OpenAI with retry
 * 4. Parse JSON safely
 * 5. Normalize fields
 * 6. Validate schema
 * 7. Check for hallucinations
 * 8. Add engine version
 *
 * @param {string} documentText - Raw regulatory document text
 * @param {object} options - Configuration object
 * @param {object} options.logger - Optional external logger instance
 * @returns {Promise<object>} Classified regulatory document
 * @throws {Error} On validation or parsing failure
 */
const ingestRegulatoryDocument = async (documentText, options = {}) => {
  const logger = createLogger(options.logger);

  try {
    logger.info('ingest_start', { action: 'regulatory document ingestion started', engine_version: ENGINE_VERSION });

    // Step 1: Validate input
    const validatedText = validateInput(documentText, logger);

    // Step 2: Normalize document size
    const normalizedText = normalizeDocumentSize(validatedText, logger);

    // Step 3: Call OpenAI with retry on JSON failures
    const llmResponse = await callOpenAIWithRetry(normalizedText, logger);

    // Step 4: Parse JSON safely
    const parsedObject = extractJsonObjectSafely(llmResponse, logger);

    // Step 5: Normalize fields
    const normalizedObject = normalizeFields(parsedObject, logger);

    // Step 6: Validate schema
    const validatedObject = validateSchema(normalizedObject, logger);

    // Step 7: Anti-hallucination check
    const hallucination = antiHallucinationGuard(validatedObject, documentText, logger);
    validatedObject.hallucination_risk = hallucination.hallucination_risk;
    if (hallucination.issues.length > 0) {
      validatedObject.hallucination_issues = hallucination.issues;
    }

    // Step 8: Add engine version
    validatedObject.engine_version = ENGINE_VERSION;

    logger.info('ingest_completed', { status: 'success', object_keys: Object.keys(validatedObject).length });

    return validatedObject;
  } catch (error) {
    logger.error('ingest_error', { error_message: error.message });
    throw error;
  }
};

// ============================================================================
// EXPORTS
// ============================================================================

export { ingestRegulatoryDocument };
