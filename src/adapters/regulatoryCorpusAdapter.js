// ============================================================================
// REGULATORY CORPUS ADAPTER
// ============================================================================
// Fetches regulatory documents from Supabase with deterministic queries

// ============================================================================
// CONSTANTS
// ============================================================================

const CORPUS_TABLE = 'regulatory_documents';
const CORPUS_FIELDS = [
  'id',
  'title',
  'short_code',
  'authority_level',
  'legal_weight',
  'regulatory_force',
  'domain',
  'applicable_project_types',
  'effective_date',
  'expiration_date',
  'source_type',
  'summary',
  'key_obligations',
  'risk_implications',
  'applicability_conditions',
  'risk_categories',
  'created_at',
];

// ============================================================================
// VALIDATION
// ============================================================================

/**
 * Validate Supabase client
 *
 * @param {object} supabaseClient - Supabase client instance
 * @throws {Error} If client is invalid
 */
const validateSupabaseClient = (supabaseClient) => {
  if (!supabaseClient) {
    throw new Error('supabaseClient is required');
  }

  if (typeof supabaseClient.from !== 'function') {
    throw new Error('supabaseClient must be a valid Supabase client instance');
  }
};

// ============================================================================
// FETCH CORPUS
// ============================================================================

/**
 * Fetch all regulatory documents from corpus.
 *
 * Query strategy:
 * - Deterministic ordering (by created_at, then id)
 * - Return only necessary fields for exposure computation
 * - Filter out soft-deleted records (if deleted_at is present)
 *
 * @param {object} supabaseClient - Supabase client instance
 * @returns {Promise<array>} Array of regulatory documents
 * @throws {Error} On database query failure
 */
const fetchRegulatoryCorpus = async (supabaseClient) => {
  validateSupabaseClient(supabaseClient);

  try {
    const { data, error } = await supabaseClient
      .from(CORPUS_TABLE)
      .select(CORPUS_FIELDS.join(','))
      .is('deleted_at', null)
      .order('created_at', { ascending: true })
      .order('id', { ascending: true });

    if (error) {
      throw new Error(`Supabase query failed: ${error.message}`);
    }

    if (!data) {
      return [];
    }

    // Validate and normalize response
    return normalizeCorpus(data);
  } catch (error) {
    throw new Error(`Failed to fetch regulatory corpus: ${error.message}`);
  }
};

/**
 * Normalize corpus data for deterministic processing.
 *
 * - Ensure arrays are properly typed
 * - Ensure dates are ISO format or null
 * - Trim string fields
 *
 * @param {array} rawData - Raw Supabase response
 * @returns {array} Normalized documents
 */
const normalizeCorpus = (rawData) => {
  return rawData.map(doc => {
    const normalized = {
      id: doc.id || null,
      title: (doc.title || '').trim(),
      short_code: (doc.short_code || '').trim(),
      authority_level: doc.authority_level || 1,
      legal_weight: doc.legal_weight || 1,
      regulatory_force: doc.regulatory_force || 'mandatory',
      domain: (doc.domain || '').trim(),
      applicable_project_types: Array.isArray(doc.applicable_project_types)
        ? doc.applicable_project_types.map(t => (typeof t === 'string' ? t.trim() : t))
        : [],
      effective_date: doc.effective_date || null,
      expiration_date: doc.expiration_date || null,
      source_type: doc.source_type || 'official',
      summary: (doc.summary || '').trim(),
      key_obligations: Array.isArray(doc.key_obligations) ? doc.key_obligations : [],
      risk_implications: Array.isArray(doc.risk_implications) ? doc.risk_implications : [],
      applicability_conditions: Array.isArray(doc.applicability_conditions)
        ? doc.applicability_conditions
        : [],
      risk_categories: Array.isArray(doc.risk_categories) ? doc.risk_categories : [],
      created_at: doc.created_at || null,
    };

    return normalized;
  });
};

// ============================================================================
// FETCH WITH FILTERS
// ============================================================================

/**
 * Fetch regulatory documents filtered by authority level.
 *
 * @param {object} supabaseClient - Supabase client instance
 * @param {number} authorityLevel - Authority level to filter (1, 2, or 3)
 * @returns {Promise<array>} Filtered documents
 * @throws {Error} On database query failure
 */
const fetchRegulatoryCorpusByAuthorityLevel = async (supabaseClient, authorityLevel) => {
  validateSupabaseClient(supabaseClient);

  if (!Number.isInteger(authorityLevel) || ![1, 2, 3].includes(authorityLevel)) {
    throw new Error('authorityLevel must be 1, 2, or 3');
  }

  try {
    const { data, error } = await supabaseClient
      .from(CORPUS_TABLE)
      .select(CORPUS_FIELDS.join(','))
      .eq('authority_level', authorityLevel)
      .is('deleted_at', null)
      .order('created_at', { ascending: true })
      .order('id', { ascending: true });

    if (error) {
      throw new Error(`Supabase query failed: ${error.message}`);
    }

    return data ? normalizeCorpus(data) : [];
  } catch (error) {
    throw new Error(`Failed to fetch regulatory corpus by authority level: ${error.message}`);
  }
};

/**
 * Fetch regulatory documents filtered by regulatory force.
 *
 * @param {object} supabaseClient - Supabase client instance
 * @param {string} regulatoryForce - Force type (mandatory|recommended|informative)
 * @returns {Promise<array>} Filtered documents
 * @throws {Error} On database query failure
 */
const fetchRegulatoryCorpusByForce = async (supabaseClient, regulatoryForce) => {
  validateSupabaseClient(supabaseClient);

  const validForces = ['mandatory', 'recommended', 'informative'];
  if (!validForces.includes(regulatoryForce)) {
    throw new Error(`regulatoryForce must be one of: ${validForces.join(', ')}`);
  }

  try {
    const { data, error } = await supabaseClient
      .from(CORPUS_TABLE)
      .select(CORPUS_FIELDS.join(','))
      .eq('regulatory_force', regulatoryForce)
      .is('deleted_at', null)
      .order('created_at', { ascending: true })
      .order('id', { ascending: true });

    if (error) {
      throw new Error(`Supabase query failed: ${error.message}`);
    }

    return data ? normalizeCorpus(data) : [];
  } catch (error) {
    throw new Error(`Failed to fetch regulatory corpus by force: ${error.message}`);
  }
};

// ============================================================================
// EXPORTS
// ============================================================================

export {
  fetchRegulatoryCorpus,
  fetchRegulatoryCorpusByAuthorityLevel,
  fetchRegulatoryCorpusByForce,
};
