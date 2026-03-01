import { OpenAI } from 'openai';

// ============================================================================
// CONSTANTS
// ============================================================================

const MAX_DOCUMENT_SIZE = 25000;
const VALID_AUTHORITY_LEVELS = [1, 2, 3];
const VALID_REGULATORY_FORCES = ['mandatory', 'recommended', 'informative'];
const VALID_LEGAL_WEIGHTS = [1, 2, 3, 4, 5];
const VALID_SOURCE_TYPES = ['official', 'expert', 'community'];
const ISO_DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

// ============================================================================
// LOGGING UTILITIES
// ============================================================================

const log = (step, data = {}) => {
  const timestamp = new Date().toISOString();
  const logEntry = {
    timestamp,
    module: 'REGULATORY_INGESTION',
    step,
    ...data,
  };
  console.log(JSON.stringify(logEntry));
};

// ============================================================================
// VALIDATION FUNCTIONS
// ============================================================================

const validateInput = (documentText) => {
  log('validate_input', { action: 'start' });

  if (!documentText || typeof documentText !== 'string') {
    log('validate_input', { status: 'error', reason: 'documentText is not a string' });
    throw new Error('documentText must be a non-empty string');
  }

  if (documentText.trim().length === 0) {
    log('validate_input', { status: 'error', reason: 'documentText is empty' });
    throw new Error('documentText cannot be empty');
  }

  log('validate_input', { status: 'success', length: documentText.length });
  return documentText;
};

const validateSchema = (parsedObject) => {
  log('validate_schema', { action: 'start' });

  const errors = [];

  // Required string fields
  const requiredStringFields = ['title', 'short_code', 'domain', 'summary', 'source_type'];
  for (const field of requiredStringFields) {
    if (!parsedObject[field] || typeof parsedObject[field] !== 'string') {
      errors.push(`${field} must be a non-empty string`);
    }
  }

  // Required number fields with enum validation
  if (!Number.isInteger(parsedObject.authority_level) || !VALID_AUTHORITY_LEVELS.includes(parsedObject.authority_level)) {
    errors.push(`authority_level must be one of ${VALID_AUTHORITY_LEVELS.join(', ')}`);
  }

  if (!VALID_REGULATORY_FORCES.includes(parsedObject.regulatory_force)) {
    errors.push(`regulatory_force must be one of ${VALID_REGULATORY_FORCES.join(', ')}`);
  }

  if (!Number.isInteger(parsedObject.legal_weight) || !VALID_LEGAL_WEIGHTS.includes(parsedObject.legal_weight)) {
    errors.push(`legal_weight must be one of ${VALID_LEGAL_WEIGHTS.join(', ')}`);
  }

  if (!VALID_SOURCE_TYPES.includes(parsedObject.source_type)) {
    errors.push(`source_type must be one of ${VALID_SOURCE_TYPES.join(', ')}`);
  }

  if (!Number.isInteger(parsedObject.version_number) || parsedObject.version_number < 1) {
    errors.push('version_number must be a positive integer');
  }

  // Array validations
  const arrayFields = ['risk_categories', 'applicable_project_types', 'key_obligations', 'risk_implications', 'applicability_conditions'];
  for (const field of arrayFields) {
    if (!Array.isArray(parsedObject[field])) {
      errors.push(`${field} must be an array`);
    }
  }

  // Date validations (ISO 8601 or null)
  const dateFields = ['effective_date', 'expiration_date'];
  for (const field of dateFields) {
    if (parsedObject[field] !== null && parsedObject[field] !== undefined) {
      if (typeof parsedObject[field] !== 'string' || !ISO_DATE_REGEX.test(parsedObject[field])) {
        errors.push(`${field} must be ISO 8601 format (YYYY-MM-DD) or null`);
      }
    }
  }

  if (errors.length > 0) {
    log('validate_schema', { status: 'error', errors });
    throw new Error(`Schema validation failed: ${errors.join('; ')}`);
  }

  log('validate_schema', { status: 'success' });
  return parsedObject;
};

// ============================================================================
// TEXT PROCESSING FUNCTIONS
// ============================================================================

const normalizeDocumentSize = (documentText) => {
  if (documentText.length > MAX_DOCUMENT_SIZE) {
    log('normalize_document_size', { status: 'warning', truncated: true, original_length: documentText.length, new_length: MAX_DOCUMENT_SIZE });
    return documentText.substring(0, MAX_DOCUMENT_SIZE);
  }
  return documentText;
};

const extractJsonSafely = (responseText) => {
  log('extract_json', { action: 'start' });

  const jsonMatch = responseText.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    log('extract_json', { status: 'error', reason: 'no JSON object found' });
    throw new Error('No valid JSON object found in LLM response');
  }

  try {
    const parsed = JSON.parse(jsonMatch[0]);
    log('extract_json', { status: 'success' });
    return parsed;
  } catch (error) {
    log('extract_json', { status: 'error', reason: 'JSON parsing failed', error_message: error.message });
    throw new Error(`Failed to parse JSON from LLM response: ${error.message}`);
  }
};

const normalizeFields = (obj) => {
  log('normalize_fields', { action: 'start' });

  // Ensure all string fields are trimmed
  for (const field of ['title', 'short_code', 'domain', 'summary']) {
    if (typeof obj[field] === 'string') {
      obj[field] = obj[field].trim();
    }
  }

  // Ensure arrays are always present
  const arrayFields = ['risk_categories', 'applicable_project_types', 'key_obligations', 'risk_implications', 'applicability_conditions'];
  for (const field of arrayFields) {
    if (!Array.isArray(obj[field])) {
      obj[field] = [];
    }
  }

  // Ensure dates are null if not valid
  for (const field of ['effective_date', 'expiration_date']) {
    if (obj[field] && !ISO_DATE_REGEX.test(obj[field])) {
      obj[field] = null;
    }
  }

  log('normalize_fields', { status: 'success' });
  return obj;
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
- All dates must be in ISO 8601 format (YYYY-MM-DD) or null if unknown`;

  return { systemPrompt };
};

// ============================================================================
// LLM INTEGRATION
// ============================================================================

const callOpenAI = async (normalizedText) => {
  log('call_llm', { action: 'start', text_length: normalizedText.length });

  if (!process.env.OPENAI_API_KEY) {
    log('call_llm', { status: 'error', reason: 'OPENAI_API_KEY not set' });
    throw new Error('OPENAI_API_KEY environment variable is not set');
  }

  const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  });

  const { systemPrompt } = buildPrompt();

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
      max_tokens: 2000,
    });

    log('call_llm', { status: 'success', tokens_used: response.usage.total_tokens });

    if (!response.choices[0] || !response.choices[0].message) {
      log('call_llm', { status: 'error', reason: 'invalid response structure' });
      throw new Error('Invalid response structure from OpenAI');
    }

    return response.choices[0].message.content;
  } catch (error) {
    log('call_llm', { status: 'error', error_message: error.message });
    throw new Error(`OpenAI API call failed: ${error.message}`);
  }
};

// ============================================================================
// MAIN INGESTION FUNCTION
// ============================================================================

const ingestRegulatoryDocument = async (documentText) => {
  try {
    log('ingest_start', { action: 'regulatory document ingestion started' });

    // Step 1: Validate input
    const validatedText = validateInput(documentText);

    // Step 2: Normalize document size
    const normalizedText = normalizeDocumentSize(validatedText);

    // Step 3: Call OpenAI
    const llmResponse = await callOpenAI(normalizedText);

    // Step 4: Parse JSON safely
    const parsedObject = extractJsonSafely(llmResponse);

    // Step 5: Normalize fields
    const normalizedObject = normalizeFields(parsedObject);

    // Step 6: Validate schema
    const validatedObject = validateSchema(normalizedObject);

    log('ingest_completed', { status: 'success', object_keys: Object.keys(validatedObject) });

    return validatedObject;
  } catch (error) {
    log('ingest_error', { status: 'error', error_message: error.message });
    throw error;
  }
};

// ============================================================================
// EXPORTS
// ============================================================================

export { ingestRegulatoryDocument };
