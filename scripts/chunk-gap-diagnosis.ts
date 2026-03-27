/**
 * Diagnose why 229 completed documents have 0 chunks.
 * Read-only — no DB writes.
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
const sep = '─'.repeat(64);

async function main() {
  console.log('═'.repeat(64));
  console.log('  CHUNK GAP DIAGNOSIS');
  console.log('═'.repeat(64));

  // ── Step 1: Fetch all completed docs and all chunk doc_ids ──────────────────
  const { data: completedDocs } = await sb
    .from('knowledge_documents')
    .select('id, title, category, file_path, last_ingestion_error, created_at')
    .eq('ingestion_status', 'completed');

  // Fetch ALL chunk doc_ids with pagination
  let allChunkDocIds = new Set<string>();
  let offset = 0;
  const PAGE = 1000;
  while (true) {
    const { data } = await sb
      .from('knowledge_chunks')
      .select('document_id')
      .range(offset, offset + PAGE - 1);
    if (!data || data.length === 0) break;
    data.forEach((r: any) => allChunkDocIds.add(r.document_id));
    if (data.length < PAGE) break;
    offset += PAGE;
  }

  const zeroDocs = (completedDocs ?? []).filter((d: any) => !allChunkDocIds.has(d.id));
  const withChunks = (completedDocs ?? []).filter((d: any) => allChunkDocIds.has(d.id));

  console.log(`\n  Total completed docs    : ${completedDocs?.length ?? 0}`);
  console.log(`  Docs WITH chunks        : ${withChunks.length}`);
  console.log(`  Docs with ZERO chunks   : ${zeroDocs.length}`);

  // ── Step 2: Classify by last_ingestion_error ────────────────────────────────
  console.log(`\n${'═'.repeat(64)}`);
  console.log('  STEP 2 — CLASSIFICATION BY last_ingestion_error');
  console.log('═'.repeat(64));

  const errorGroups: Record<string, any[]> = {};
  for (const d of zeroDocs) {
    const key = (d as any).last_ingestion_error ?? '(null — no error recorded)';
    if (!errorGroups[key]) errorGroups[key] = [];
    errorGroups[key].push(d);
  }

  const sortedGroups = Object.entries(errorGroups).sort((a, b) => b[1].length - a[1].length);
  for (const [err, docs] of sortedGroups) {
    console.log(`\n  [${docs.length} docs] "${err}"`);
    docs.slice(0, 3).forEach((d: any) =>
      console.log(`    ${d.id.slice(0, 8)}… [${d.category}] ${(d.title ?? '').slice(0, 50)}`));
    if (docs.length > 3) console.log(`    … and ${docs.length - 3} more`);
  }

  // ── Step 3: Storage verification for sample of 10 ──────────────────────────
  console.log(`\n${'═'.repeat(64)}`);
  console.log('  STEP 3 — STORAGE VERIFICATION (sample of 15)');
  console.log('═'.repeat(64));

  // Pick a spread: 5 from each top error group + some nulls
  const sample: any[] = [];
  for (const [, docs] of sortedGroups) {
    sample.push(...docs.slice(0, 5));
    if (sample.length >= 15) break;
  }
  const sampleSlice = sample.slice(0, 15);

  let existsCount = 0, missingCount = 0, nullPathCount = 0;

  for (const doc of sampleSlice) {
    const fp = (doc as any).file_path;
    if (!fp) {
      nullPathCount++;
      console.log(`  NULL PATH   ${doc.id.slice(0, 8)}… [${doc.category}] ${(doc.title ?? '').slice(0, 40)}`);
      continue;
    }

    // Try to get file metadata via storage API
    const { data: fileData, error: fileError } = await sb.storage
      .from('documents')
      .list(fp.includes('/') ? fp.substring(0, fp.lastIndexOf('/')) : '', {
        search: fp.includes('/') ? fp.substring(fp.lastIndexOf('/') + 1) : fp,
        limit: 1,
      });

    const found = !fileError && fileData && fileData.length > 0;
    const fileSize = found ? fileData[0]?.metadata?.size ?? '?' : '—';

    if (found) existsCount++;
    else missingCount++;

    const status = found ? '✅ EXISTS  ' : '❌ MISSING ';
    console.log(`  ${status} ${doc.id.slice(0, 8)}… path="${fp.slice(0, 45)}" size=${fileSize}  err="${((doc as any).last_ingestion_error ?? 'none').slice(0, 35)}"`);
  }

  console.log(`\n  Storage sample: ${existsCount} found, ${missingCount} missing, ${nullPathCount} null path`);

  // ── Step 4: NULL file_path count ────────────────────────────────────────────
  console.log(`\n${'═'.repeat(64)}`);
  console.log('  STEP 4 — NULL / EMPTY file_path');
  console.log('═'.repeat(64));

  const nullPath = zeroDocs.filter((d: any) => !d.file_path);
  const withPath = zeroDocs.filter((d: any) => !!d.file_path);
  console.log(`\n  null/empty file_path : ${nullPath.length}`);
  console.log(`  has file_path        : ${withPath.length}`);
  if (nullPath.length > 0) {
    nullPath.slice(0, 5).forEach((d: any) =>
      console.log(`    ${d.id.slice(0, 8)}… [${d.category}] "${d.title?.slice(0, 50)}"`));
  }

  // ── Step 5: Category distribution of zero-chunk docs ───────────────────────
  console.log(`\n${'═'.repeat(64)}`);
  console.log('  STEP 5 — CATEGORY DISTRIBUTION OF ZERO-CHUNK DOCS');
  console.log('═'.repeat(64));

  const catDist: Record<string, number> = {};
  for (const d of zeroDocs) catDist[(d as any).category ?? '(null)'] = (catDist[(d as any).category ?? '(null)'] ?? 0) + 1;
  const totalWithChunksByCat: Record<string, number> = {};
  for (const d of withChunks) totalWithChunksByCat[(d as any).category ?? '(null)'] = (totalWithChunksByCat[(d as any).category ?? '(null)'] ?? 0) + 1;

  const allCats = new Set([...Object.keys(catDist), ...Object.keys(totalWithChunksByCat)]);
  console.log();
  for (const cat of [...allCats].sort()) {
    const zero = catDist[cat] ?? 0;
    const has  = totalWithChunksByCat[cat] ?? 0;
    const total = zero + has;
    const pct = total > 0 ? (zero / total * 100).toFixed(0) : '0';
    console.log(`  ${cat.padEnd(22)} zero=${zero}  has_chunks=${has}  missing%=${pct}%`);
  }

  // ── Step 6: Docs with null error AND chunks (control group) ────────────────
  console.log(`\n${'═'.repeat(64)}`);
  console.log('  STEP 6 — CONTROL: COMPLETED DOCS WITH CHUNKS + NO ERROR');
  console.log('═'.repeat(64));
  const goodNoError = withChunks.filter((d: any) => !d.last_ingestion_error);
  const goodWithError = withChunks.filter((d: any) => !!d.last_ingestion_error);
  console.log(`\n  Completed + has chunks + no error  : ${goodNoError.length}`);
  console.log(`  Completed + has chunks + has error : ${goodWithError.length}`);

  // ── Step 7: Root cause classification ──────────────────────────────────────
  console.log(`\n${'═'.repeat(64)}`);
  console.log('  STEP 7 — ROOT CAUSE CLASSIFICATION');
  console.log('═'.repeat(64));

  // Map each error message to a root cause class
  const CLASS_A: any[] = []; // FILE MISSING
  const CLASS_B: any[] = []; // TEXT EXTRACTION FAILED
  const CLASS_C: any[] = []; // CHUNKING RETURNED EMPTY
  const CLASS_D: any[] = []; // INSERT FAILED
  const CLASS_E: any[] = []; // STATUS SET TOO EARLY / EDGE FUNCTION

  for (const d of zeroDocs) {
    const e: string = (d as any).last_ingestion_error ?? '';
    if (/storage|download|file not found|missing|path/i.test(e))  CLASS_A.push(d);
    else if (/text|extract|ocr|empty text|insufficient|no extractable/i.test(e)) CLASS_B.push(d);
    else if (/chunk|chunking/i.test(e))                            CLASS_C.push(d);
    else if (/insert|write|database/i.test(e))                     CLASS_D.push(d);
    else                                                            CLASS_E.push(d);
  }

  const total = zeroDocs.length;
  const pct = (n: number) => `${n} (${(n / total * 100).toFixed(1)}%)`;

  console.log(`\n  A — FILE MISSING / path problem    : ${pct(CLASS_A.length)}`);
  console.log(`  B — TEXT EXTRACTION FAILED         : ${pct(CLASS_B.length)}`);
  console.log(`  C — CHUNKING RETURNED EMPTY        : ${pct(CLASS_C.length)}`);
  console.log(`  D — INSERT FAILED                  : ${pct(CLASS_D.length)}`);
  console.log(`  E — STATUS SET TOO EARLY / OTHER   : ${pct(CLASS_E.length)}`);

  if (CLASS_E.length > 0) {
    console.log(`\n  Class E examples (null/unknown error):`);
    CLASS_E.slice(0, 5).forEach((d: any) =>
      console.log(`    ${d.id.slice(0, 8)}… [${d.category}] err="${(d.last_ingestion_error ?? 'null').slice(0, 60)}" title="${(d.title ?? '').slice(0, 40)}"`));
  }

  console.log(`\n${'═'.repeat(64)}`);
  console.log('  EXACT FAILURE POINTS IN WORKER CODE');
  console.log('═'.repeat(64));
  console.log(`
  B — worker.js line 258-268:
      if (!cleanedText || cleanedText.trim().length < 200)
        → marks as "completed" with last_ingestion_error = "No extractable text"
        → returns WITHOUT writing any chunks
        → NEVER marks as "failed"

  C — worker.js line 293-303:
      if (fallbackChunking returns 0 chunks)
        → marks as "completed" with last_ingestion_error = "Could not chunk document"
        → returns WITHOUT writing any chunks
        → NEVER marks as "failed"

  E — (null error) — worker.js line 206-208:
      if (claimError || !claimed) return;
        → document NOT in "pending" state was attempted via another path
        → status was set to "completed" outside the worker
        → possible paths: Edge Function rag-ingestion, manual update, old pipeline
  `);

  console.log('═'.repeat(64));
  console.log('  FINAL DIAGNOSIS SUMMARY');
  console.log('═'.repeat(64));
  console.log(`
  Total zero-chunk completed docs : ${total}

  CONFIRMED CODE PATHS (from worker.js):

    Path 1 (Class B) — "No extractable text"
      Location  : worker.js:258–268
      Trigger   : cleanedText.length < 200 after extraction+cleaning
      Causes    : scanned PDF with no OCR, corrupt file, image-only PDF
      Action    : set ingestion_status = "completed" immediately — NEVER retried
      Fix needed: set ingestion_status = "failed" instead

    Path 2 (Class C) — "Could not chunk document"
      Location  : worker.js:293–303
      Trigger   : smartChunker AND fallbackChunking both return []
      Causes    : text too short after cleaning, all-header content
      Action    : set ingestion_status = "completed" — NEVER retried
      Fix needed: same — set "failed" or add dedicated status

    Path 3 (Class E) — null error
      Location  : unknown (not worker.js)
      Trigger   : document completed by a different pipeline path
      Candidates: rag-ingestion Edge Function, legacy import, manual status reset
      Fix needed: investigate with DB created_at vs worker log timestamps
  `);
}

main().catch(err => { console.error(err); process.exit(1); });
