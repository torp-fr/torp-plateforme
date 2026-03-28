/**
 * Rule Extraction — Test Runner
 *
 * Dry-run: fetches up to 10 DTU chunks, runs deterministic rule extraction,
 * and logs results. Does NOT write to the database.
 *
 * Usage:
 *   npm run test:rules
 */

import { runRuleExtractionTest } from '../src/workers/ruleExtraction.worker';
import { buildChecksFromRules, logCheckSample } from '../src/services/checkBuilder.service';
import { extractRulesFromChunk } from '../src/services/ruleExtraction.service';
import { consolidateRules, logConsolidationStats } from '../src/services/ruleConsolidation.service';
import { supabase } from '../src/lib/supabase';

async function main(): Promise<void> {
  console.log('ENV CHECK → SUPABASE_URL:', process.env.SUPABASE_URL ? 'OK' : 'MISSING');
  console.log('🧪 Running Rule Extraction Test...\n');
  await runRuleExtractionTest();

  // ── Check Builder demo ────────────────────────────────────────────────────
  console.log('\n🔧 Running Check Builder demo (same chunks, no DB write)...');

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data } = await (supabase as any)
    .from('knowledge_chunks')
    .select('id, content, document_id, knowledge_documents!inner(category)')
    .eq('rule_processed', false)
    .eq('knowledge_documents.category', 'DTU')
    .limit(10);

  const allRules = (data ?? []).flatMap((row: { id: string; content: string; document_id: string; knowledge_documents: { category: string } }) =>
    extractRulesFromChunk({
      id: row.id,
      content: row.content,
      document_id: row.document_id,
      category: row.knowledge_documents.category,
    }),
  );

  const checks = buildChecksFromRules(allRules);
  logCheckSample(checks, 8);

  // ── Rule Consolidation demo ────────────────────────────────────────────────
  console.log('\n🔗 Running Rule Consolidation demo...');
  const consolidated = consolidateRules(allRules);
  logConsolidationStats(allRules, consolidated);
  console.log('[Consolidation] Sample:');
  console.log(consolidated.slice(0, 5));

  console.log('\n✅ Test completed');
}

main().catch((err) => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});
