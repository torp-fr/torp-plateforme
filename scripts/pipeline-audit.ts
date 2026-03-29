/**
 * Pipeline Audit — Read-only.
 * Runs all 7 audit tasks and prints a structured report.
 */
import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';

const envRaw = readFileSync('.env.local', 'utf8');
const env: Record<string, string> = Object.fromEntries(
  envRaw.split('\n')
    .filter(l => l.includes('=') && !l.startsWith('#'))
    .map(l => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; }),
);

const sb = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

const SUPPORTED = new Set(['DTU', 'EUROCODE', 'NORMES', 'GUIDE_TECHNIQUE', 'CODE_CONSTRUCTION']);

const sep  = (n = 60) => '─'.repeat(n);
const head = (t: string) => `\n${'═'.repeat(60)}\n  ${t}\n${'═'.repeat(60)}`;

async function main() {
  console.log(head('PIPELINE AUDIT REPORT'));
  console.log(`  Date: ${new Date().toISOString()}`);

  // ══════════════════════════════════════════════════════════════
  // TASK 1 — Document Audit
  // ══════════════════════════════════════════════════════════════
  console.log(head('TASK 1 — DOCUMENT AUDIT'));

  const { data: docs, error: docsErr } = await sb
    .from('knowledge_documents')
    .select('id, title, category, ingestion_status, created_at');

  if (docsErr || !docs) { console.error('ERROR fetching documents:', docsErr); process.exit(1); }

  const totalDocs = docs.length;
  const byStatus: Record<string, number> = {};
  for (const d of docs) byStatus[d.ingestion_status] = (byStatus[d.ingestion_status] ?? 0) + 1;

  console.log(`\n  Total documents : ${totalDocs}`);
  console.log('  By status:');
  for (const [s, n] of Object.entries(byStatus).sort()) {
    const flag = s !== 'completed' ? ' ⚠️' : ' ✅';
    console.log(`    ${s.padEnd(14)}: ${n}${flag}`);
  }

  const notCompleted = docs.filter(d => d.ingestion_status !== 'completed');
  console.log(`\n  Not completed (${notCompleted.length}):`);
  if (notCompleted.length === 0) {
    console.log('    ✅ All documents completed');
  } else {
    for (const d of notCompleted) {
      console.log(`    [${d.ingestion_status.padEnd(12)}] ${d.id.slice(0,8)}… ${(d.title ?? '(no title)').slice(0,45)}  cat=${d.category ?? 'NULL'}`);
    }
  }

  const nullCat = docs.filter(d => !d.category);
  console.log(`\n  NULL category (${nullCat.length}):`);
  if (nullCat.length === 0) console.log('    ✅ None');
  else nullCat.forEach(d => console.log(`    ${d.id.slice(0,8)}… ${(d.title ?? '').slice(0,50)}`));

  // ══════════════════════════════════════════════════════════════
  // TASK 2 — Category Consistency
  // ══════════════════════════════════════════════════════════════
  console.log(head('TASK 2 — CATEGORY CONSISTENCY'));

  const catCount: Record<string, number> = {};
  for (const d of docs) {
    const c = d.category ?? '(null)';
    catCount[c] = (catCount[c] ?? 0) + 1;
  }

  const valid:   string[] = [];
  const unknown: string[] = [];
  for (const cat of Object.keys(catCount)) {
    (SUPPORTED.has(cat) ? valid : unknown).push(cat);
  }

  console.log('\n  All distinct categories:');
  for (const [cat, n] of Object.entries(catCount).sort((a, b) => b[1] - a[1])) {
    const tag = SUPPORTED.has(cat) ? '✅ valid    ' : '⚠️  UNKNOWN  ';
    console.log(`    ${tag} ${cat.padEnd(24)} count=${n}`);
  }
  console.log(`\n  Valid categories   : ${valid.join(', ') || '(none)'}`);
  console.log(`  Unknown categories : ${unknown.join(', ') || '(none)'}`);

  // ══════════════════════════════════════════════════════════════
  // TASK 3 — Chunk Audit
  // ══════════════════════════════════════════════════════════════
  console.log(head('TASK 3 — CHUNK AUDIT'));

  const { data: chunks, error: chunksErr } = await sb
    .from('knowledge_chunks')
    .select('id, document_id, content, rule_processed');

  if (chunksErr || !chunks) { console.error('ERROR fetching chunks:', chunksErr); process.exit(1); }

  const totalChunks = chunks.length;
  const chunksByDoc: Record<string, number> = {};
  let emptyContent = 0;
  for (const c of chunks) {
    chunksByDoc[c.document_id] = (chunksByDoc[c.document_id] ?? 0) + 1;
    if (!c.content || c.content.trim() === '') emptyContent++;
  }

  console.log(`\n  Total chunks       : ${totalChunks}`);
  console.log(`  Empty content      : ${emptyContent}${emptyContent > 0 ? ' ⚠️' : ' ✅'}`);
  console.log(`  Avg chunks/doc     : ${totalDocs > 0 ? (totalChunks / totalDocs).toFixed(1) : 'N/A'}`);

  // Documents with 0 chunks
  const docIds = new Set(docs.map(d => d.id));
  const chunkedDocIds = new Set(Object.keys(chunksByDoc));
  const docsWithNoChunks = docs.filter(d => !chunkedDocIds.has(d.id));
  console.log(`\n  Documents with 0 chunks (${docsWithNoChunks.length}):`);
  if (docsWithNoChunks.length === 0) {
    console.log('    ✅ All documents have chunks');
  } else {
    docsWithNoChunks.forEach(d => console.log(`    ${d.id.slice(0,8)}… [${d.ingestion_status}] ${(d.title ?? '').slice(0,50)}  cat=${d.category}`));
  }

  // Abnormal chunk counts
  const counts = Object.values(chunksByDoc);
  const maxC = Math.max(...counts);
  const minC = Math.min(...counts);
  const p95  = counts.sort((a, b) => a - b)[Math.floor(counts.length * 0.95)] ?? 0;

  console.log(`\n  Chunk distribution : min=${minC}  max=${maxC}  p95=${p95}`);

  const abnormal = Object.entries(chunksByDoc).filter(([, n]) => n > p95 * 2 || n < 1);
  if (abnormal.length > 0) {
    console.log(`  Abnormal chunk counts (${abnormal.length}):`);
    abnormal.slice(0, 10).forEach(([docId, n]) => {
      const doc = docs.find(d => d.id === docId);
      console.log(`    ${docId.slice(0,8)}…  chunks=${n}  ${(doc?.title ?? '').slice(0,40)}`);
    });
  } else {
    console.log('  Abnormal counts    : ✅ None');
  }

  // ══════════════════════════════════════════════════════════════
  // TASK 4 — Rule Coverage
  // ══════════════════════════════════════════════════════════════
  console.log(head('TASK 4 — RULE COVERAGE'));

  const { data: rules, error: rulesErr } = await sb
    .from('rules')
    .select('id, document_id, structured_data, confidence_score');

  if (rulesErr) { console.error('ERROR fetching rules:', rulesErr); process.exit(1); }

  const totalRules = rules?.length ?? 0;
  const rulesByDoc: Record<string, number> = {};
  for (const r of rules ?? []) {
    rulesByDoc[r.document_id] = (rulesByDoc[r.document_id] ?? 0) + 1;
  }

  console.log(`\n  Total rules        : ${totalRules}`);
  console.log(`  Rules/document     : ${totalDocs > 0 ? (totalRules / totalDocs).toFixed(1) : 'N/A'}`);
  console.log(`  Rules/chunk (approx): ${totalChunks > 0 ? (totalRules / totalChunks).toFixed(2) : 'N/A'}`);

  const docsWithNoRules = docs
    .filter(d => d.ingestion_status === 'completed' && !rulesByDoc[d.id])
    .map(d => `${d.id.slice(0,8)}… [${d.category}] ${(d.title ?? '').slice(0,45)}`);

  console.log(`\n  Completed docs with 0 rules (${docsWithNoRules.length}):`);
  if (docsWithNoRules.length === 0) {
    console.log('    ✅ All completed documents have rules');
  } else {
    docsWithNoRules.slice(0, 15).forEach(s => console.log(`    ⚠️  ${s}`));
    if (docsWithNoRules.length > 15) console.log(`    … and ${docsWithNoRules.length - 15} more`);
  }

  // ══════════════════════════════════════════════════════════════
  // TASK 5 — Pipeline Completion
  // ══════════════════════════════════════════════════════════════
  console.log(head('TASK 5 — PIPELINE COMPLETION'));

  const unprocessed = chunks.filter(c => c.rule_processed === false);
  const processed   = chunks.filter(c => c.rule_processed === true);

  console.log(`\n  rule_processed = true  : ${processed.length}`);
  console.log(`  rule_processed = false : ${unprocessed.length}${unprocessed.length > 0 ? ' ⚠️  PIPELINE INCOMPLETE' : ' ✅'}`);
  console.log(`  rule_processed = null  : ${chunks.filter(c => c.rule_processed === null).length}`);

  if (unprocessed.length > 0) {
    // Sample which docs they belong to
    const unprDocIds: Record<string, number> = {};
    for (const c of unprocessed) unprDocIds[c.document_id] = (unprDocIds[c.document_id] ?? 0) + 1;
    const top = Object.entries(unprDocIds).sort((a, b) => b[1] - a[1]).slice(0, 5);
    console.log(`\n  Top unprocessed docs:`);
    for (const [docId, n] of top) {
      const doc = docs.find(d => d.id === docId);
      console.log(`    ${docId.slice(0,8)}…  unprocessed=${n}  [${doc?.category}] ${(doc?.title ?? '').slice(0,40)}`);
    }
  }

  // ══════════════════════════════════════════════════════════════
  // TASK 6 — Data Quality
  // ══════════════════════════════════════════════════════════════
  console.log(head('TASK 6 — DATA QUALITY'));

  let nullSD = 0, nullPropKey = 0, nullValue = 0, qualitative = 0, quantitative = 0;
  for (const r of rules ?? []) {
    const sd = r.structured_data as any;
    if (!sd)                                    { nullSD++; continue; }
    if (!sd.property_key)                       nullPropKey++;
    if (sd.value === null || sd.value === undefined) nullValue++;
    if (sd.qualitative === true)                qualitative++;
    else                                        quantitative++;
  }

  console.log(`\n  structured_data IS NULL  : ${nullSD}${nullSD > 0 ? ' ⚠️' : ' ✅'}`);
  console.log(`  property_key IS NULL     : ${nullPropKey}${nullPropKey > 0 ? ' ⚠️' : ' ✅'}`);
  console.log(`  value IS NULL            : ${nullValue} (includes qualitative rules)`);
  console.log(`  Qualitative rules        : ${qualitative} (${totalRules > 0 ? (qualitative/totalRules*100).toFixed(1) : 0}%)`);
  console.log(`  Quantitative rules       : ${quantitative} (${totalRules > 0 ? (quantitative/totalRules*100).toFixed(1) : 0}%)`);

  // Malformed: no property_key AND not qualitative
  const malformed = (rules ?? []).filter((r: any) => {
    const sd = r.structured_data;
    return sd && !sd.property_key && sd.qualitative !== true;
  });
  console.log(`  Malformed rules          : ${malformed.length}${malformed.length > 0 ? ' ⚠️' : ' ✅'}`);

  // ══════════════════════════════════════════════════════════════
  // TASK 7 — Final Verdict
  // ══════════════════════════════════════════════════════════════
  console.log(head('TASK 7 — FINAL VERDICT'));

  const isIngestionComplete  = unprocessed.length === 0;
  const isDataConsistent     = emptyContent === 0 && nullSD === 0 && docsWithNoChunks.length === 0;
  const hasUnknownCategories = unknown.length > 0;
  const hasNotCompleted      = notCompleted.length > 0;
  const safeToRestart        = isIngestionComplete && !hasNotCompleted;

  const yn = (v: boolean) => v ? 'YES ✅' : 'NO  ❌';

  console.log(`
  A. Ingestion COMPLETE?              ${yn(isIngestionComplete)}
  B. Data CONSISTENT?                 ${yn(isDataConsistent)}
  C. Safe to restart ingestion?       ${yn(safeToRestart)}
`);

  console.log('  BLOCKERS:');
  const blockers: string[] = [];
  if (!isIngestionComplete)  blockers.push(`${unprocessed.length} chunks with rule_processed=false — rule extraction pipeline not finished`);
  if (hasNotCompleted)       blockers.push(`${notCompleted.length} document(s) not in completed state: ${notCompleted.map(d=>d.ingestion_status).join(', ')}`);
  if (emptyContent > 0)      blockers.push(`${emptyContent} chunk(s) with empty content`);
  if (nullSD > 0)            blockers.push(`${nullSD} rule(s) with NULL structured_data`);
  if (docsWithNoChunks.length > 0) blockers.push(`${docsWithNoChunks.length} completed document(s) with 0 chunks`);

  if (blockers.length === 0) {
    console.log('    ✅ None');
  } else {
    blockers.forEach((b, i) => console.log(`    ${i + 1}. ⛔ ${b}`));
  }

  console.log('\n  RECOMMENDED ACTIONS:');
  const actions: string[] = [];
  if (!isIngestionComplete)  actions.push('Run `pnpm worker:rules` to finish rule extraction on unprocessed chunks');
  if (hasNotCompleted)       actions.push('Run `pnpm fix:pipeline` to reset stuck documents and retry failed ones');
  if (hasUnknownCategories)  actions.push(`Normalize unknown categories: ${unknown.join(', ')}`);
  if (docsWithNoRules.length > 0) actions.push('Investigate completed documents with 0 rules — may be non-technical corpus');
  if (emptyContent > 0)      actions.push('Delete or re-ingest chunks with empty content');

  if (actions.length === 0) {
    console.log('    ✅ Pipeline is clean. Safe to upload new documents.\n');
  } else {
    actions.forEach((a, i) => console.log(`    ${i + 1}. ${a}`));
  }

  console.log('\n' + sep(60));
  console.log(`  SUMMARY: docs=${totalDocs}  chunks=${totalChunks}  rules=${totalRules}  unprocessed=${unprocessed.length}`);
  console.log(sep(60));
}

main().catch(err => { console.error(err); process.exit(1); });
