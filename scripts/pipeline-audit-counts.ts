import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';

const env: Record<string, string> = Object.fromEntries(
  readFileSync('.env.local', 'utf8').split('\n')
    .filter(l => l.includes('=') && !l.startsWith('#'))
    .map(l => { const i = l.indexOf('='); return [l.slice(0,i).trim(), l.slice(i+1).trim()]; })
);
const sb = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

async function main() {
  const [
    { count: totalChunks },
    { count: procTrue },
    { count: procFalse },
    { count: emptyContent },
    { count: totalRules },
    { count: totalDocs },
    { count: completedDocs },
    { count: failedDocs },
    { count: pendingDocs },
    { count: processingDocs },
    { count: nullSD },
    { count: nullPropKey },
  ] = await Promise.all([
    sb.from('knowledge_chunks').select('*', { count: 'exact', head: true }),
    sb.from('knowledge_chunks').select('*', { count: 'exact', head: true }).eq('rule_processed', true),
    sb.from('knowledge_chunks').select('*', { count: 'exact', head: true }).eq('rule_processed', false),
    sb.from('knowledge_chunks').select('*', { count: 'exact', head: true }).is('content', null),
    sb.from('rules').select('*', { count: 'exact', head: true }),
    sb.from('knowledge_documents').select('*', { count: 'exact', head: true }),
    sb.from('knowledge_documents').select('*', { count: 'exact', head: true }).eq('ingestion_status', 'completed'),
    sb.from('knowledge_documents').select('*', { count: 'exact', head: true }).eq('ingestion_status', 'failed'),
    sb.from('knowledge_documents').select('*', { count: 'exact', head: true }).eq('ingestion_status', 'pending'),
    sb.from('knowledge_documents').select('*', { count: 'exact', head: true }).eq('ingestion_status', 'processing'),
    sb.from('rules').select('*', { count: 'exact', head: true }).is('structured_data', null),
    sb.from('rules').select('*', { count: 'exact', head: true }).is('structured_data->>property_key' as any, null),
  ]);

  // Chunks per doc — use aggregate via small sample to detect 0-chunk docs
  const { data: docChunkCounts } = await sb
    .from('knowledge_chunks')
    .select('document_id')
    .limit(10000); // above current total

  const chunkDocIds = new Set((docChunkCounts ?? []).map((r: any) => r.document_id));

  const { data: allDocs } = await sb
    .from('knowledge_documents')
    .select('id, title, category, ingestion_status')
    .eq('ingestion_status', 'completed');

  const docsWithNoChunks = (allDocs ?? []).filter((d: any) => !chunkDocIds.has(d.id));

  console.log('═══ TRUE PIPELINE COUNTS ═══════════════════════════════');
  console.log();
  console.log('DOCUMENTS');
  console.log(`  total      : ${totalDocs}`);
  console.log(`  completed  : ${completedDocs}`);
  console.log(`  failed     : ${failedDocs}`);
  console.log(`  pending    : ${pendingDocs}`);
  console.log(`  processing : ${processingDocs}`);
  console.log();
  console.log('CHUNKS');
  console.log(`  total                  : ${totalChunks}`);
  console.log(`  rule_processed = true  : ${procTrue}`);
  console.log(`  rule_processed = false : ${procFalse}`);
  console.log(`  empty content (null)   : ${emptyContent}`);
  const processed_pct = totalChunks ? ((procTrue ?? 0) / totalChunks * 100).toFixed(1) : '0';
  console.log(`  extraction progress    : ${procTrue}/${totalChunks} = ${processed_pct}%`);
  console.log();
  console.log('RULES');
  console.log(`  total           : ${totalRules}`);
  console.log(`  NULL struct     : ${nullSD}`);
  console.log(`  NULL prop_key   : ${nullPropKey}`);
  const rpc = totalChunks ? ((totalRules ?? 0) / (totalChunks ?? 1)).toFixed(2) : 'N/A';
  const rpd = totalDocs   ? ((totalRules ?? 0) / (totalDocs ?? 1)).toFixed(1) : 'N/A';
  console.log(`  rules/chunk     : ${rpc}`);
  console.log(`  rules/doc       : ${rpd}`);
  console.log();
  console.log('COMPLETED DOCS WITH 0 CHUNKS');
  console.log(`  count : ${docsWithNoChunks.length}`);
  if (docsWithNoChunks.length > 0) {
    docsWithNoChunks.slice(0, 10).forEach((d: any) =>
      console.log(`    ${d.id.slice(0,8)}… [${d.category}] ${(d.title ?? '').slice(0,50)}`));
    if (docsWithNoChunks.length > 10) console.log(`    … and ${docsWithNoChunks.length - 10} more`);
  }
}
main().catch(err => { console.error(err); process.exit(1); });
