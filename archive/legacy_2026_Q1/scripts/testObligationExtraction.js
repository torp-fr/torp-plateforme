#!/usr/bin/env node

/**
 * Test Obligation Extraction Engine
 * Standalone script to test obligation extraction from a knowledge chunk
 *
 * Usage: node scripts/testObligationExtraction.js
 *
 * Environment variables:
 * - SUPABASE_URL
 * - SUPABASE_SERVICE_ROLE_KEY
 * - OPENAI_API_KEY
 */

import { createClient } from '@supabase/supabase-js';
import OpenAI from 'openai';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

// ============================================================================
// SETUP
// ============================================================================

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
const requiredEnvVars = [
  'SUPABASE_URL',
  'SUPABASE_SERVICE_ROLE_KEY',
  'OPENAI_API_KEY'
];

const missingEnvVars = requiredEnvVars.filter(key => !process.env[key]);
if (missingEnvVars.length > 0) {
  console.error(`❌ Missing environment variables: ${missingEnvVars.join(', ')}`);
  process.exit(1);
}

const CHUNK_ID = '7c660b7c-1c3c-462b-b433-2e7cac3166c6';

// ============================================================================
// INITIALIZE CLIENTS
// ============================================================================

console.log('🔧 Initializing clients...');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const openaiClient = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

console.log('✅ Clients initialized');

// ============================================================================
// LOAD EXTRACTION ENGINE
// ============================================================================

console.log('📦 Loading obligation extraction engine...');

let extractObligationsFromChunk;
try {
  const engineModule = await import('../src/engines/obligationExtractionEngine.js');
  extractObligationsFromChunk = engineModule.extractObligationsFromChunk;
  if (!extractObligationsFromChunk) {
    throw new Error('extractObligationsFromChunk not exported from engine');
  }
  console.log('✅ Engine loaded');
} catch (error) {
  console.error('❌ Failed to load engine:', error.message);
  process.exit(1);
}

// ============================================================================
// FETCH CHUNK FROM SUPABASE
// ============================================================================

console.log(`📥 Fetching chunk: ${CHUNK_ID}`);

let chunk;
try {
  const { data, error } = await supabase
    .from('knowledge_chunks')
    .select('*')
    .eq('id', CHUNK_ID)
    .single();

  if (error) {
    throw new Error(`Supabase error: ${error.message}`);
  }

  if (!data) {
    throw new Error(`Chunk not found: ${CHUNK_ID}`);
  }

  chunk = data;
  console.log(`✅ Chunk fetched (${chunk.content?.length || 0} bytes)`);
} catch (error) {
  console.error('❌ Failed to fetch chunk:', error.message);
  process.exit(1);
}

// ============================================================================
// GET DOCUMENT ID
// ============================================================================

console.log('📋 Fetching document info...');

let documentId;
try {
  const { data, error } = await supabase
    .from('knowledge_documents')
    .select('id')
    .eq('id', chunk.document_id)
    .single();

  if (error) {
    throw new Error(`Supabase error: ${error.message}`);
  }

  if (!data) {
    throw new Error(`Document not found: ${chunk.document_id}`);
  }

  documentId = data.id;
  console.log(`✅ Document ID: ${documentId}`);
} catch (error) {
  console.error('❌ Failed to fetch document:', error.message);
  process.exit(1);
}

// ============================================================================
// EXECUTE EXTRACTION
// ============================================================================

console.log('\n🚀 Starting obligation extraction...\n');

const executionStartTime = Date.now();

let extractionResult;
try {
  extractionResult = await extractObligationsFromChunk(
    chunk,
    documentId,
    supabase,
    openaiClient,
    {
      // Optional configuration
      logger: null // Uses default console logger
    }
  );

  const executionDuration = Date.now() - executionStartTime;

  // ========================================================================
  // RESULTS
  // ========================================================================

  console.log('\n' + '='.repeat(80));
  console.log('✅ EXTRACTION COMPLETE');
  console.log('='.repeat(80));

  console.log('\n📊 SUMMARY:');
  console.log(`  Chunk ID:          ${chunk.id}`);
  console.log(`  Document ID:       ${documentId}`);
  console.log(`  Content length:    ${chunk.content?.length || 0} bytes`);
  console.log(`  Execution time:    ${executionDuration}ms`);

  if (extractionResult.obligations && extractionResult.obligations.length > 0) {
    console.log(`  Obligations found: ${extractionResult.obligations.length}`);
  } else {
    console.log(`  Obligations found: 0`);
  }

  if (extractionResult.inserted_count !== undefined) {
    console.log(`  Inserted to DB:    ${extractionResult.inserted_count}`);
  }

  console.log('\n📝 FULL RESULT:');
  console.log(JSON.stringify(extractionResult, null, 2));

  console.log('\n' + '='.repeat(80));

  process.exit(0);
} catch (error) {
  const executionDuration = Date.now() - executionStartTime;

  console.log('\n' + '='.repeat(80));
  console.log('❌ EXTRACTION FAILED');
  console.log('='.repeat(80));
  console.log(`  Execution time: ${executionDuration}ms`);
  console.log(`  Error: ${error.message}`);

  if (error.stack) {
    console.log('\n📋 Stack trace:');
    console.log(error.stack);
  }

  process.exit(1);
}
