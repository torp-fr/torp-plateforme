/**
 * Manual Obligation Extraction Test
 *
 * Test script to manually extract obligations from a specific chunk in Supabase
 *
 * Usage: node manualObligationTest.js
 *
 * Required environment variables:
 * - SUPABASE_URL
 * - SUPABASE_SERVICE_ROLE_KEY
 * - OPENAI_API_KEY
 */

import { createClient } from '@supabase/supabase-js';
import OpenAI from 'openai';
import { extractObligationsFromChunk } from './src/engines/obligationExtractionEngine.js';

// ============================================================================
// CONFIGURATION
// ============================================================================

const CHUNK_ID = '8ef07503-fcaf-4087-beec-2430f7d12c5e';
const DOCUMENT_ID = '563ff093-d87c-4fcf-8b65-be732d7cd4e1';

// ============================================================================
// INITIALIZE CLIENTS
// ============================================================================

function initializeClients() {
  // Validate environment variables
  if (!process.env.SUPABASE_URL) {
    throw new Error('❌ SUPABASE_URL environment variable is required');
  }
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error('❌ SUPABASE_SERVICE_ROLE_KEY environment variable is required');
  }
  if (!process.env.OPENAI_API_KEY) {
    throw new Error('❌ OPENAI_API_KEY environment variable is required');
  }

  // Initialize Supabase client
  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );

  // Initialize OpenAI client
  const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  });

  console.log('✅ Clients initialized successfully');

  return { supabase, openai };
}

// ============================================================================
// LOAD CHUNK FROM SUPABASE
// ============================================================================

async function loadChunk(supabase, chunkId) {
  console.log(`\n📥 Loading chunk: ${chunkId}`);

  try {
    const { data, error } = await supabase
      .from('knowledge_chunks')
      .select('*')
      .eq('id', chunkId)
      .single();

    if (error) {
      throw new Error(`Supabase query failed: ${error.message}`);
    }

    if (!data) {
      throw new Error(`Chunk not found with ID: ${chunkId}`);
    }

    console.log(`✅ Chunk loaded successfully`);
    console.log(`   - Content length: ${data.content?.length || 0} characters`);
    console.log(`   - Document ID: ${data.document_id}`);
    console.log(`   - Section title: ${data.section_title || 'N/A'}`);

    return data;
  } catch (error) {
    console.error(`❌ Failed to load chunk: ${error.message}`);
    throw error;
  }
}

// ============================================================================
// EXTRACT OBLIGATIONS
// ============================================================================

async function extractObligations(chunk, documentId, supabase, openai) {
  console.log(`\n🔍 Extracting obligations from chunk...`);

  try {
    const result = await extractObligationsFromChunk(
      chunk,
      documentId,
      supabase,
      openai,
      {
        logger: null, // Use default console logger
      }
    );

    console.log(`✅ Extraction completed successfully`);

    return result;
  } catch (error) {
    console.error(`❌ Extraction failed: ${error.message}`);
    throw error;
  }
}

// ============================================================================
// DISPLAY RESULTS
// ============================================================================

function displayResults(result) {
  console.log(`\n${'='.repeat(80)}`);
  console.log('📊 EXTRACTION RESULTS');
  console.log(`${'='.repeat(80)}\n`);

  // Display inserted count
  console.log(`✅ Inserted count: ${result.inserted_count}`);

  // Display statistics if available
  if (result.statistics) {
    console.log(`\n📈 Statistics:`);
    console.log(JSON.stringify(result.statistics, null, 2));
  }

  // Display extracted obligations
  if (result.obligations && result.obligations.length > 0) {
    console.log(`\n📋 Extracted Obligations (${result.obligations.length} total):`);
    console.log(`${'─'.repeat(80)}`);

    result.obligations.forEach((obligation, index) => {
      console.log(`\nObligation ${index + 1}:`);
      console.log(`  - Type: ${obligation.obligation_type || 'N/A'}`);
      console.log(`  - Text: ${obligation.obligation_text?.substring(0, 100) || 'N/A'}...`);
      console.log(`  - Article: ${obligation.article_reference || 'N/A'}`);
      console.log(`  - Applicable Phase: ${obligation.applicable_phase || 'N/A'}`);
      console.log(`  - Sanction Risk: ${obligation.sanction_risk || 'N/A'}`);
    });
  } else {
    console.log(`\n⚠️  No obligations extracted`);
  }

  console.log(`\n${'='.repeat(80)}\n`);
}

// ============================================================================
// MAIN EXECUTION
// ============================================================================

async function main() {
  console.log('🚀 Manual Obligation Extraction Test\n');

  try {
    // Initialize clients
    const { supabase, openai } = initializeClients();

    // Load chunk
    const chunk = await loadChunk(supabase, CHUNK_ID);

    // Extract obligations
    const result = await extractObligations(chunk, DOCUMENT_ID, supabase, openai);

    // Display results
    displayResults(result);

    console.log('✅ Test completed successfully');
    process.exit(0);
  } catch (error) {
    console.error(`\n💥 Test failed: ${error.message}`);
    process.exit(1);
  }
}

// Run the test
main();
