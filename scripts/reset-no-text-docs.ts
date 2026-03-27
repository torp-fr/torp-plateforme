/**
 * Reset 40 documents stuck as "completed" with no chunks.
 * Sets ingestion_status = 'pending' so the worker picks them up again.
 */
import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';

const env: Record<string, string> = Object.fromEntries(
  readFileSync('.env.local', 'utf8').split('\n')
    .filter(l => l.includes('=') && !l.startsWith('#'))
    .map(l => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; })
);
const sb = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

async function main() {
  // Dry-run: count affected rows first
  const { count, error: countErr } = await sb
    .from('knowledge_documents')
    .select('*', { count: 'exact', head: true })
    .eq('last_ingestion_error', 'No extractable text');

  if (countErr) { console.error('Count error:', countErr); process.exit(1); }
  console.log(`Rows matching last_ingestion_error = 'No extractable text': ${count}`);

  if (!count || count === 0) {
    console.log('Nothing to reset.');
    return;
  }

  // Execute reset
  const { data, error } = await sb
    .from('knowledge_documents')
    .update({
      ingestion_status:   'pending',
      ingestion_progress: 0,
    })
    .eq('last_ingestion_error', 'No extractable text')
    .select('id, title, category');

  if (error) { console.error('Update error:', error); process.exit(1); }

  console.log(`\n✅ Reset ${data?.length ?? 0} documents to pending:\n`);
  (data ?? []).forEach((d: any) =>
    console.log(`  ${d.id.slice(0, 8)}… [${d.category}] ${(d.title ?? '').slice(0, 55)}`));

  // Confirm final state
  const { count: pendingNow } = await sb
    .from('knowledge_documents')
    .select('*', { count: 'exact', head: true })
    .eq('ingestion_status', 'pending');

  console.log(`\nDocuments now in pending state: ${pendingNow}`);
}

main().catch(err => { console.error(err); process.exit(1); });
