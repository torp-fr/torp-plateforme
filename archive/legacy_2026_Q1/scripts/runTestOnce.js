#!/usr/bin/env node

/**
 * TEMPORARY: One-time obligation extraction test runner
 * This script is designed to execute during Railway deployment
 * to validate the extraction engine with document_type strategy
 *
 * After testing, revert package.json start script to: "node src/server.js"
 */

import { createClient } from '@supabase/supabase-js';
import OpenAI from 'openai';

// ============================================================================
// VALIDATION
// ============================================================================

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

// ============================================================================
// INITIALIZATION
// ============================================================================

console.log('🔧 Initializing clients...');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const openaiClient = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

console.log('✅ Clients initialized\n');

// ============================================================================
// LOAD AND EXECUTE TEST
// ============================================================================

console.log('📦 Loading test script...');

try {
  // Import and execute the actual test
  const testModule = await import('./testObligationExtraction.js');

  // The test script auto-exits, so we just need to ensure it's loaded
  console.log('✅ Test script loaded and executing...\n');

  // Give the test script time to complete before exit
  setTimeout(() => {
    console.log('\n⏱️  Test execution timeout - forcing exit');
    process.exit(0);
  }, 120000); // 2 minute timeout

} catch (error) {
  console.error('❌ Failed to load test:', error.message);
  if (error.stack) {
    console.error(error.stack);
  }
  process.exit(1);
}
