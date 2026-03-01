/**
 * Test Obligation Extraction Route
 *
 * Temporary endpoint for testing obligation extraction on a specific chunk
 * POST /api/test-obligation
 *
 * Returns: { inserted_count, statistics, obligations }
 */

import { createClient } from '@supabase/supabase-js';
import OpenAI from 'openai';
import { extractObligationsFromChunk } from '../engines/obligationExtractionEngine.js';

// ============================================================================
// CONFIGURATION
// ============================================================================

const CHUNK_ID = '8ef07503-fcaf-4087-beec-2430f7d12c5e';
const DOCUMENT_ID = '563ff093-d87c-4fcf-8b65-be732d7cd4e1';

// ============================================================================
// ROUTE HANDLER
// ============================================================================

/**
 * POST /api/test-obligation
 * Manually trigger obligation extraction from a specific chunk
 *
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
export async function testObligationRoute(req, res) {
  console.log('🧠 Manual obligation extraction triggered');

  try {
    // ======================================================================
    // VALIDATE ENVIRONMENT VARIABLES
    // ======================================================================
    if (!process.env.SUPABASE_URL) {
      return res.status(500).json({
        success: false,
        error: 'SUPABASE_URL environment variable is required',
      });
    }

    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return res.status(500).json({
        success: false,
        error: 'SUPABASE_SERVICE_ROLE_KEY environment variable is required',
      });
    }

    if (!process.env.OPENAI_API_KEY) {
      return res.status(500).json({
        success: false,
        error: 'OPENAI_API_KEY environment variable is required',
      });
    }

    // ======================================================================
    // INITIALIZE CLIENTS
    // ======================================================================
    console.log('✅ Initializing clients...');

    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });

    console.log('✅ Clients initialized');

    // ======================================================================
    // LOAD CHUNK FROM SUPABASE
    // ======================================================================
    console.log(`📥 Loading chunk: ${CHUNK_ID}`);

    const { data: chunk, error: loadError } = await supabase
      .from('knowledge_chunks')
      .select('*')
      .eq('id', CHUNK_ID)
      .single();

    if (loadError || !chunk) {
      return res.status(404).json({
        success: false,
        error: `Chunk not found: ${loadError?.message || 'Unknown error'}`,
      });
    }

    console.log(`✅ Chunk loaded (${chunk.content?.length || 0} characters)`);

    // ======================================================================
    // EXTRACT OBLIGATIONS
    // ======================================================================
    console.log('🔍 Extracting obligations...');

    const result = await extractObligationsFromChunk(
      chunk,
      DOCUMENT_ID,
      supabase,
      openai,
      {
        logger: null, // Use default logger
      }
    );

    console.log(`✅ Extraction completed: ${result.inserted_count} obligations inserted`);

    // ======================================================================
    // RETURN RESULT
    // ======================================================================
    return res.status(200).json({
      success: true,
      inserted_count: result.inserted_count,
      statistics: result.statistics || null,
      obligations: result.obligations || [],
      chunk_id: CHUNK_ID,
      document_id: DOCUMENT_ID,
    });
  } catch (error) {
    console.error('❌ Extraction failed:', error.message);

    return res.status(500).json({
      success: false,
      error: error.message || 'Internal server error',
    });
  }
}

// ============================================================================
// EXPORTS
// ============================================================================

export default testObligationRoute;
