#!/usr/bin/env tsx

/**
 * Diagnostic script to test Edge Function invocation
 * Usage: npx tsx scripts/diagnoseEmbeddingIssue.ts
 */

import { config } from 'dotenv';
config({ path: '.env.local' });
config({ path: '.env' });

import { createClient } from '@supabase/supabase-js';

async function diagnose() {
  console.log('\n========== EDGE FUNCTION INVOCATION DIAGNOSTIC ==========\n');

  // Check environment variables
  console.log('1️⃣  CHECKING ENVIRONMENT VARIABLES');
  console.log('━'.repeat(50));

  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const anonKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;
  const openaiKey = process.env.OPENAI_API_KEY;

  console.log(`SUPABASE_URL: ${url ? '✅ SET' : '❌ MISSING'}`);
  console.log(`SUPABASE_SERVICE_ROLE_KEY: ${serviceKey ? '✅ SET' : '❌ MISSING'}`);
  console.log(`VITE_SUPABASE_ANON_KEY: ${anonKey ? '✅ SET' : '❌ MISSING'}`);
  console.log(`OPENAI_API_KEY: ${openaiKey ? '✅ SET' : '❌ MISSING'}`);

  if (!url || !serviceKey) {
    console.error('\n❌ CRITICAL: Missing required environment variables');
    process.exit(1);
  }

  // Create Supabase client
  console.log('\n2️⃣  CREATING SUPABASE CLIENT');
  console.log('━'.repeat(50));

  const supabase = createClient(url, serviceKey);
  console.log('✅ Supabase client created');

  // Test Edge Function invocation
  console.log('\n3️⃣  TESTING EDGE FUNCTION INVOCATION');
  console.log('━'.repeat(50));

  const testInputs = ['Hello world', 'This is a test'];
  console.log(`Testing with inputs: ${JSON.stringify(testInputs)}`);

  try {
    console.log('\nCalling supabase.functions.invoke("generate-embedding")...\n');

    const { data, error } = await supabase.functions.invoke('generate-embedding', {
      body: {
        inputs: testInputs,
        model: 'text-embedding-3-small',
        dimensions: 384,
      },
    });

    console.log('Response received:');
    console.log(`  error: ${error ? 'YES' : 'NO'}`);
    console.log(`  data: ${data ? 'YES' : 'NO'}`);

    if (error) {
      console.error('\n❌ ERROR RESPONSE:');
      console.error(`  Type: ${error.constructor.name}`);
      console.error(`  Message: ${error.message}`);
      console.error(`  Status: ${(error as any).status}`);
      console.error(`  Full error:`, JSON.stringify(error, null, 2));
    } else {
      console.log('\n✅ SUCCESS');
      console.log(`  Response data:`, JSON.stringify(data, null, 2));

      if (data?.embeddings) {
        console.log(`  ✅ Embeddings array present`);
        console.log(`  Embeddings count: ${data.embeddings.length}`);
        if (data.embeddings[0]) {
          console.log(`  First embedding dimensions: ${data.embeddings[0].length}`);
        }
      } else {
        console.error('  ❌ No embeddings in response');
      }
    }
  } catch (err: any) {
    console.error('\n❌ EXCEPTION THROWN:');
    console.error(`  Type: ${err.constructor.name}`);
    console.error(`  Message: ${err.message}`);
    console.error(`  Stack: ${err.stack}`);
  }

  console.log('\n========== DIAGNOSTIC COMPLETE ==========\n');
}

diagnose().catch(console.error);
