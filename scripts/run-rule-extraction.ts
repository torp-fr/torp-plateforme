/**
 * Rule Extraction Worker — Production Entry Point
 *
 * Fetches unprocessed DTU chunks, extracts rules, and persists them to the
 * `rules` table. Chunks are marked rule_processed = true after insert.
 *
 * Usage:
 *   npm run worker:rules
 *
 * Requirements:
 *   SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in .env.local
 */

// dotenv MUST be loaded before any module that reads process.env
import dotenv from 'dotenv';
dotenv.config();
dotenv.config({ path: '.env.local' });

import { runRuleExtraction } from '../src/workers/ruleExtraction.worker';

async function main(): Promise<void> {
  console.log('ENV CHECK → SUPABASE_URL:', process.env.SUPABASE_URL ? 'OK' : 'MISSING');
  console.log('🚀 Starting full ingestion loop...');

  let iteration = 0;

  while (true) {
    iteration++;
    console.log(`\n🔁 Iteration ${iteration}`);

    if (iteration > 1000) {
      console.warn('⚠️ Max iterations reached — stopping to avoid infinite loop');
      break;
    }

    const result = await runRuleExtraction();
    const processed = result?.chunksProcessed ?? 0;

    if (processed === 0) {
      console.log('✅ No more chunks to process. Stopping.');
      break;
    }

    console.log(`✔ Processed ${processed} chunks`);
  }

  console.log('🏁 Full ingestion complete');
}

main().catch((err) => {
  console.error('❌ Worker failed:', err);
  process.exit(1);
});
