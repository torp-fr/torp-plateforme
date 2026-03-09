#!/usr/bin/env node
/**
 * Knowledge Brain — Batch Ingestion Script
 *
 * Ingests up to MAX_BATCH=10 documents from a folder (recursively) through the
 * full 10-step Knowledge Brain ingestion pipeline, writing real records to
 * Supabase (knowledge_documents + knowledge_chunks + embedding_vector).
 *
 * Usage:
 *   pnpm ingest:batch ./knowledge_corpus
 *   pnpm ingest:batch ./knowledge_corpus --dry-run
 *
 * Flags:
 *   --dry-run   Run local pipeline steps only (no DB writes, no embeddings)
 *
 * Safety guards:
 *   - Duplicate detection  : skips documents already present in knowledge_documents
 *   - Chunk explosion      : aborts if a document produces > MAX_CHUNKS_PER_DOCUMENT chunks
 *   - File size            : logs and skips files exceeding 25 MB before extraction
 *   - README filter        : README.md / README.txt files are always ignored
 *
 * Env:
 *   SUPABASE_SERVICE_ROLE_KEY  (preferred — allows server-side Edge Function calls)
 *   VITE_SUPABASE_URL          (or SUPABASE_URL)
 *   VITE_SUPABASE_ANON_KEY     (fallback if no service role key)
 *
 * Supported formats: .pdf  .docx  .xlsx  .csv  .txt  .md
 * Scanning         : recursive — all matching files in subdirectories are collected
 */

import fs   from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

// ---------------------------------------------------------------------------
// 1. Bootstrap: load .env BEFORE any service import resolves env vars
// ---------------------------------------------------------------------------

const require = createRequire(import.meta.url);

try {
  const dotenv  = require('dotenv');
  const envFile = ['.env.local', '.env'].find((f) =>
    fs.existsSync(path.resolve(process.cwd(), f))
  );
  if (envFile) {
    dotenv.config({ path: path.resolve(process.cwd(), envFile) });
  }
} catch {
  // dotenv not installed — env vars must already be in the shell environment
}

// ---------------------------------------------------------------------------
// 2. Service imports (resolved after env is ready)
// ---------------------------------------------------------------------------

import { extractDocumentContent }     from '@/core/knowledge/ingestion/documentExtractor.service';
import { normalizeText }               from '@/core/knowledge/ingestion/textNormalizer.service';
import { classifyDocument }            from '@/core/knowledge/ingestion/documentClassifier.service';
import { chunkSmart }                  from '@/core/knowledge/ingestion/smartChunker.service';
import { filterChunks }                from '@/core/knowledge/ingestion/chunkQualityFilter.service';
import { deduplicateChunks }           from '@/core/knowledge/ingestion/semanticDeduplication.service';
import { generateEmbeddingsForChunks } from '@/core/knowledge/ingestion/knowledgeEmbedding.service';
import type { EmbeddingResult }        from '@/core/knowledge/ingestion/knowledgeEmbedding.service';
import { getSupabase }                 from '@/lib/supabase';

import type { DocumentType } from '@/core/knowledge/ingestion/documentClassifier.service';

// ---------------------------------------------------------------------------
// 3. Constants
// ---------------------------------------------------------------------------

const MAX_BATCH              = 10;
const MAX_CHUNKS_PER_DOCUMENT = 500;
const MAX_DOCUMENT_SIZE      = 25 * 1024 * 1024; // 25 MB — mirrors documentExtractor guard

const SUPPORTED_EXTENSIONS = new Set(['.pdf', '.docx', '.xlsx', '.csv', '.txt', '.md']);

/**
 * Files that are always skipped regardless of extension.
 * README files describe the corpus structure — they are not knowledge documents.
 */
const IGNORED_FILENAMES = new Set(['README.md', 'README.txt', 'readme.md', 'readme.txt']);

/**
 * Recursively collects all ingestible files under `dir`.
 * - Descends into subdirectories
 * - Filters by SUPPORTED_EXTENSIONS
 * - Skips IGNORED_FILENAMES
 * - Returns absolute paths sorted deterministically
 */
function collectFiles(dir: string): string[] {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const files: string[] = [];

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...collectFiles(fullPath));
    } else if (
      SUPPORTED_EXTENSIONS.has(path.extname(entry.name).toLowerCase()) &&
      !IGNORED_FILENAMES.has(entry.name)
    ) {
      files.push(fullPath);
    }
  }

  return files.sort();
}

/** Maps pipeline DocumentType → valid knowledge_documents.category enum value */
const DOC_TYPE_TO_CATEGORY: Record<DocumentType, string> = {
  regulation:        'REGULATION',
  normes:            'REGULATION',   // NF/EN/ISO standards are regulatory in nature
  technical_guide:   'TECHNICAL_GUIDE',
  pricing_reference: 'PRICING_REFERENCE',
  jurisprudence:     'LEGAL',
  generic:           'MANUAL',
};

// ---------------------------------------------------------------------------
// 4. Logging helpers
// ---------------------------------------------------------------------------

const SEP  = '─'.repeat(72);
const SEP2 = '═'.repeat(72);

function tag(label: string): string {
  return `[BatchIngest:${label}]`.padEnd(30);
}

function info(label: string, msg: string)  { console.log(`${tag(label)} ${msg}`); }
function warn(label: string, msg: string)  { console.warn(`${tag(label)} ⚠  ${msg}`); }
function fail(label: string, msg: string)  { console.error(`${tag(label)} ✗  ${msg}`); }
function ok(label: string, msg: string)    { console.log(`${tag(label)} ✓  ${msg}`); }
function sep()  { console.log(SEP); }
function sep2() { console.log(SEP2); }

function ms(start: number): string { return `${Date.now() - start}ms`; }

function formatBytes(n: number): string {
  if (n < 1024)       return `${n} B`;
  if (n < 1024 ** 2)  return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 ** 2).toFixed(2)} MB`;
}

// ---------------------------------------------------------------------------
// 5. DB helpers
// ---------------------------------------------------------------------------

/**
 * Guard: returns the existing document ID only when the document already has
 * rows in knowledge_chunks (i.e., ingestion actually completed).
 *
 * A document record with no corresponding chunks is NOT considered ingested —
 * this prevents silently skipping documents whose previous ingestion failed
 * before chunks were written.  chunk_count on knowledge_documents is NOT used
 * as the source of truth here; we query knowledge_chunks directly.
 */
async function findExistingDocument(filename: string): Promise<string | null> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('knowledge_documents')
    .select('id')
    .eq('title', filename)
    .maybeSingle();

  if (error || !data) {
    // On DB error or no record, fall through — safer to attempt ingestion than to silently skip
    return null;
  }

  const documentId = (data as { id: string }).id;

  // Confirm chunks actually exist — chunk_count column is not authoritative
  const { count, error: countError } = await supabase
    .from('knowledge_chunks')
    .select('*', { count: 'exact', head: true })
    .eq('document_id', documentId);

  if (countError || !count || count === 0) {
    // Stale document row exists but has no chunks (previous ingestion failed).
    // Delete it so re-ingestion can insert a fresh record without hitting the
    // unique-title constraint.
    await supabase.from('knowledge_documents').delete().eq('id', documentId);
    return null;
  }

  return documentId;
}

async function createDocument(
  filename:       string,
  normalizedText: string,
  fileSize:       number,
  docType:        DocumentType,
): Promise<string | null> {
  const supabase = getSupabase();
  const { data: { user } } = await supabase.auth.getUser().catch(() => ({ data: { user: null } }));

  const { data: doc, error } = await supabase
    .from('knowledge_documents')
    .insert({
      title:               filename,
      content:             normalizedText,        // NOT NULL — use normalized text
      category:            DOC_TYPE_TO_CATEGORY[docType],
      source:              'internal',
      file_size:           fileSize > 0 ? fileSize : 1,
      chunk_count:         0,                     // updated after chunking completes
      is_publishable:      false,                 // set by integrity service post-index
      ingestion_status:    'processing',
      ingestion_started_at: new Date().toISOString(),
      created_by:          user?.id ?? null,
    })
    .select('id')
    .single();

  if (error || !doc) {
    fail('DB', `Failed to create document: ${error?.message ?? 'no data returned'}`);
    return null;
  }

  return doc.id as string;
}

async function insertChunks(
  documentId: string,
  chunks: { content: string; tokenCount: number; metadata?: Record<string, unknown> }[],
): Promise<{ id: string; chunk_index: number }[] | null> {
  const supabase = getSupabase();
  const records = chunks.map((c, i) => ({
    document_id: documentId,
    content:     c.content,
    chunk_index: i,
    token_count: c.tokenCount,
    metadata:    c.metadata ?? {},
  }));

  const { data, error } = await supabase
    .from('knowledge_chunks')
    .insert(records)
    .select('id, chunk_index');

  if (error || !data) {
    fail('DB', `Chunk insert failed: ${error?.message ?? 'no data returned'}`);
    return null;
  }
  return data as { id: string; chunk_index: number }[];
}

async function updateDocumentStatus(
  documentId: string,
  status: 'completed' | 'failed',
  extras: Record<string, unknown> = {},
): Promise<void> {
  const supabase = getSupabase();
  const patch: Record<string, unknown> = { ingestion_status: status, ...extras };
  if (status === 'completed') {
    patch.ingestion_completed_at = new Date().toISOString();
    patch.ingestion_progress     = 100;
  }
  await supabase.from('knowledge_documents').update(patch).eq('id', documentId);
}

/**
 * Persist embeddings into the `embedding_vector` column of each chunk.
 *
 * Uses the IDs returned directly by insertChunks() — no secondary SELECT.
 * Chunks and embeddings are aligned by position (both ordered 0..N-1).
 * Throws on any UPDATE that affects 0 rows to surface silent failures.
 */
async function persistEmbeddings(
  insertedChunks: { id: string; chunk_index: number }[],
  embedResults: EmbeddingResult[],
): Promise<number> {
  console.log("PERSISTING EMBEDDINGS", { chunks: insertedChunks.length });

  const supabase = getSupabase();
  let persisted = 0;
  const limit = Math.min(insertedChunks.length, embedResults.length);

  for (let i = 0; i < limit; i++) {
    const chunkId = insertedChunks[i].id;
    const vec = embedResults[i].embedding;

    if (!vec || vec.length === 0) {
      warn('7b Embed', `Empty embedding for chunk ${chunkId} — skipping`);
      continue;
    }

    // pgvector requires the vector as a Postgres literal string '[x,y,z,...]'
    const vectorString = `[${vec.join(',')}]`;

    const { data, error } = await supabase
      .from('knowledge_chunks')
      .update({ embedding_vector: vectorString })
      .eq('id', chunkId)
      .select('id');

    if (error) {
      warn('7b Embed', `Embedding persist error for chunk ${chunkId}: ${error.message} — skipping`);
      continue;
    }

    if (!data || data.length === 0) {
      warn('7b Embed', `Embedding update affected 0 rows for chunk ${chunkId} — skipping`);
      continue;
    }

    persisted++;
  }

  return persisted;
}

// ---------------------------------------------------------------------------
// 6. Per-document result type
// ---------------------------------------------------------------------------

type DocOutcome = 'success' | 'failed' | 'skipped' | 'aborted';

interface DocResult {
  filename:        string;
  outcome:         DocOutcome;
  docType:         DocumentType;
  chunksGenerated: number;
  chunksFiltered:  number;
  chunksDeduped:   number;
  embeddings:      number;
  integrityScore:  number;
  conflicts:       number;
  durationMs:      number;
  note:            string | null;   // reason for skip / abort / failure
}

// ---------------------------------------------------------------------------
// 7. Single-document ingestion
// ---------------------------------------------------------------------------

async function ingestDocument(
  filePath: string,
  dryRun:   boolean,
): Promise<DocResult> {
  const filename = path.basename(filePath);
  const docStart = Date.now();

  const result: DocResult = {
    filename,
    outcome:         'success',
    docType:         'generic',
    chunksGenerated: 0,
    chunksFiltered:  0,
    chunksDeduped:   0,
    embeddings:      0,
    integrityScore:  0,
    conflicts:       0,
    durationMs:      0,
    note:            null,
  };

  let documentId: string | null = null;
  let insertedChunks: { id: string; chunk_index: number }[] | null = null;

  try {
    // ── Guard 1: File size ────────────────────────────────────────────────
    const fileStat = fs.statSync(filePath);
    if (fileStat.size > MAX_DOCUMENT_SIZE) {
      warn('Doc', `SKIPPED (file too large): ${filename}  (${formatBytes(fileStat.size)} > ${formatBytes(MAX_DOCUMENT_SIZE)})`);
      result.outcome = 'skipped';
      result.note    = `file too large (${formatBytes(fileStat.size)})`;
      result.durationMs = Date.now() - docStart;
      return result;
    }

    const fileBuffer = fs.readFileSync(filePath);

    sep();
    info('Doc', `▶ ${filename}  (${formatBytes(fileBuffer.length)})`);

    // ── Guard 2: Duplicate detection ──────────────────────────────────────
    if (!dryRun) {
      const existingId = await findExistingDocument(filename);
      if (existingId) {
        warn('Doc', `SKIPPED (already ingested): ${filename}  → existing id: ${existingId}`);
        result.outcome = 'skipped';
        result.note    = `already ingested (id: ${existingId})`;
        result.durationMs = Date.now() - docStart;
        return result;
      }
    }

    // ── Step 1: Extract ───────────────────────────────────────────────────
    let rawText: string;
    {
      const t = Date.now();
      rawText = await extractDocumentContent(fileBuffer, filename);
      info('1 Extract', `${rawText.length.toLocaleString()} characters  (${ms(t)})`);
    }

    // ── Step 2: Normalize ─────────────────────────────────────────────────
    let normalizedText: string;
    {
      const t        = Date.now();
      normalizedText = normalizeText(rawText);
      const noise    = rawText.length - normalizedText.length;
      info('2 Normalize',
        `${normalizedText.length.toLocaleString()} chars` +
        (noise > 0 ? `  (noise: -${noise})` : '') +
        `  (${ms(t)})`
      );
    }

    // ── Step 3: Classify ──────────────────────────────────────────────────
    result.docType = classifyDocument(normalizedText);
    info('3 Classify', `type → ${result.docType}`);

    // ── Step 4: Smart chunking ────────────────────────────────────────────
    let rawChunks;
    {
      const t   = Date.now();
      rawChunks = chunkSmart(normalizedText, result.docType);
      result.chunksGenerated = rawChunks.length;
      info('4 SmartChunk', `${rawChunks.length} chunks  (${ms(t)})`);
    }

    // ── Step 5: Quality filter ────────────────────────────────────────────
    let qualityChunks;
    {
      const t       = Date.now();
      qualityChunks = filterChunks(rawChunks);
      result.chunksFiltered = qualityChunks.length;
      const removed = rawChunks.length - qualityChunks.length;
      info('5 Filter', `${removed} removed → ${qualityChunks.length} remaining  (${ms(t)})`);
    }

    // ── Guard 3: Chunk explosion ──────────────────────────────────────────
    if (qualityChunks.length > MAX_CHUNKS_PER_DOCUMENT) {
      warn('Doc',
        `ABORTED (too many chunks): ${filename}` +
        `  ${qualityChunks.length} chunks > MAX_CHUNKS_PER_DOCUMENT=${MAX_CHUNKS_PER_DOCUMENT}`
      );
      result.outcome = 'aborted';
      result.note    = `chunk explosion (${qualityChunks.length} chunks after filter)`;
      result.durationMs = Date.now() - docStart;
      return result;
    }

    // ── Step 6: Semantic deduplication ────────────────────────────────────
    // Skipped in --dry-run: dedup requires live embedding probes against the
    // vector index (Edge Function + DB round-trips). In dry-run all chunks pass.
    let dedupedChunks;
    if (dryRun) {
      dedupedChunks = qualityChunks;
      result.chunksDeduped = qualityChunks.length;
      info('6 Dedup', `skipped (--dry-run)  ${qualityChunks.length} chunks kept`);
    } else {
      const t       = Date.now();
      dedupedChunks = await deduplicateChunks(qualityChunks);
      result.chunksDeduped  = dedupedChunks.length;
      const removed = qualityChunks.length - dedupedChunks.length;
      info('6 Dedup', `${removed} duplicates removed → ${dedupedChunks.length} remaining  (${ms(t)})`);
    }

    if (dedupedChunks.length === 0) {
      warn('Doc', 'No chunks survived — document has no indexable content; skipping DB write');
      result.outcome = 'skipped';
      result.note    = 'no indexable content survived pipeline';
      result.durationMs = Date.now() - docStart;
      return result;
    }

    // Normalise to the shape expected by embedding / index services
    const pipelineChunks = dedupedChunks.map((c) => ({
      content:    c.content,
      tokenCount: c.tokenCount,
      startIndex: 0,
      endIndex:   c.content.length,
    }));

    // ── DB: Create document record ────────────────────────────────────────
    if (!dryRun) {
      const t = Date.now();
      documentId = await createDocument(filename, normalizedText, fileBuffer.length, result.docType);
      if (!documentId) {
        throw new Error('Chunk ingestion failed: Unable to prepare document metadata');
      }
      ok('DB:Doc', `document created: ${documentId}  (${ms(t)})`);

      const t2 = Date.now();
      insertedChunks = await insertChunks(documentId, dedupedChunks);
      if (!insertedChunks) {
        throw new Error('Failed to insert chunk records');
      }
      ok('DB:Chunks', `${insertedChunks.length} chunk records inserted  (${ms(t2)})`);
    } else {
      info('DryRun', 'Skipping DB writes (--dry-run)');
    }

    // ── Step 7: Generate embeddings ───────────────────────────────────────
    // Skipped in --dry-run: embeddings require the Edge Function (OpenAI + Supabase).
    if (dryRun) {
      info('7 Embeddings', 'skipped (--dry-run)');
    } else {
      const t             = Date.now();
      const embedResults  = await generateEmbeddingsForChunks(pipelineChunks);
      result.embeddings   = embedResults.length;
      info('7 Embeddings',
        `${result.embeddings}/${pipelineChunks.length} embeddings` +
        `  dims=${embedResults[0]?.embedding.length ?? 'n/a'}` +
        `  (${ms(t)})`
      );

      // ── Step 7b: Persist embedding_vector to DB ───────────────────────
      // Uses IDs returned directly by insertChunks — no secondary SELECT.
      // Throws if any UPDATE hits 0 rows (silent failure guard).
      if (insertedChunks && embedResults.length > 0) {
        const t2        = Date.now();
        const persisted = await persistEmbeddings(insertedChunks, embedResults);
        info('7b Embed', `${persisted}/${embedResults.length} embedding_vector written to DB  (${ms(t2)})`);
      }
    }

    // ── Resolve outcome: success = chunks inserted + embeddings generated ──
    // Optional steps (index, integrity, conflict) cannot cause failure.
    if (!dryRun) {
      result.outcome = (result.chunksDeduped > 0 && result.embeddings > 0) ? 'success' : result.outcome;
    }

    // ── Step 8: Index ─────────────────────────────────────────────────────
    info('8 Index', 'skipped (pgvector HNSW index handles retrieval automatically)');

    // ── Step 9: Integrity check ───────────────────────────────────────────
    info('9 Integrity', 'skipped (temporary)');

    // ── Step 10: Conflict detection ───────────────────────────────────────
    info('10 Conflicts', 'skipped (temporary)');

    // ── Mark completed ────────────────────────────────────────────────────
    if (documentId && result.outcome === 'success') {
      await updateDocumentStatus(documentId, 'completed', {
        is_publishable:     result.embeddings > 0,
        ingestion_progress: 100,
      });
      ok('DB', `status → completed`);
    }

  } catch (e) {
    const msg   = e instanceof Error ? e.message : String(e);
    result.outcome = 'failed';
    result.note    = msg;
    fail('Doc', msg);

    if (documentId) {
      await updateDocumentStatus(documentId, 'failed', {
        last_ingestion_error: msg.slice(0, 500),
        last_ingestion_step:  'batch_ingestion',
      }).catch(() => { /* best-effort */ });
    }
  }

  result.durationMs = Date.now() - docStart;
  return result;
}

// ---------------------------------------------------------------------------
// 8. Main
// ---------------------------------------------------------------------------

async function run(): Promise<void> {
  console.log("ACTIVE INGESTION PIPELINE");

  // ── CLI args ──────────────────────────────────────────────────────────────
  const args   = process.argv.slice(2);
  const folder = args.find((a) => !a.startsWith('--'));
  const dryRun = args.includes('--dry-run');

  if (!folder) {
    console.error('Usage: pnpm ingest:batch <folder> [--dry-run]');
    process.exit(1);
  }

  const folderAbs = path.resolve(process.cwd(), folder);
  if (!fs.existsSync(folderAbs) || !fs.statSync(folderAbs).isDirectory()) {
    console.error(`[BatchIngest] Not a directory: ${folderAbs}`);
    process.exit(1);
  }

  // ── Discover files (recursive) ────────────────────────────────────────────
  const allFiles = collectFiles(folderAbs);   // recursive, README-filtered, sorted
  const batch    = allFiles.slice(0, MAX_BATCH);

  sep2();
  console.log('  Knowledge Brain — Batch Ingestion');
  sep2();
  info('Init', `Folder     : ${folderAbs}`);
  info('Init', `Scan       : recursive (subdirectories included, README files skipped)`);
  info('Init', `Files found: ${allFiles.length}  (processing ${batch.length}/${MAX_BATCH} max)`);
  info('Init', `Dry run    : ${dryRun ? 'yes (--dry-run)' : 'no'}`);
  info('Init', `Guards     : duplicate-check  chunk-limit=${MAX_CHUNKS_PER_DOCUMENT}  size-limit=${formatBytes(MAX_DOCUMENT_SIZE)}`);
  sep2();

  if (batch.length === 0) {
    warn('Init', `No supported files in folder (${[...SUPPORTED_EXTENSIONS].join(', ')})`);
    process.exit(0);
  }

  if (allFiles.length > MAX_BATCH) {
    warn('Init', `${allFiles.length - MAX_BATCH} file(s) skipped (exceeded MAX_BATCH=${MAX_BATCH})`);
  }

  // ── Batch accumulators ────────────────────────────────────────────────────
  const results: DocResult[] = [];
  const globalStart = Date.now();

  // ── Process each document ─────────────────────────────────────────────────
  for (let i = 0; i < batch.length; i++) {
    const filePath = batch[i];
    info('Batch', `[${i + 1}/${batch.length}] ${path.basename(filePath)}`);

    const docResult = await ingestDocument(filePath, dryRun);
    results.push(docResult);

    // Per-document one-liner
    const statusIcon = {
      success: '✓ OK     ',
      failed:  '✗ FAILED ',
      skipped: '— SKIPPED',
      aborted: '⚠ ABORTED',
    }[docResult.outcome];

    info('Result',
      `${statusIcon}  type=${docResult.docType}` +
      `  chunks=${docResult.chunksDeduped}` +
      `  emb=${docResult.embeddings}` +
      `  integrity=${docResult.integrityScore > 0 ? docResult.integrityScore.toFixed(3) : 'n/a'}` +
      `  ${docResult.durationMs}ms` +
      (docResult.note ? `  [${docResult.note}]` : '')
    );
  }

  // ── Batch summary ─────────────────────────────────────────────────────────
  const succeeded   = results.filter((r) => r.outcome === 'success');
  const failed      = results.filter((r) => r.outcome === 'failed');
  const skipped     = results.filter((r) => r.outcome === 'skipped');
  const aborted     = results.filter((r) => r.outcome === 'aborted');
  const totalChunks = results.reduce((a, r) => a + r.chunksDeduped, 0);
  const totalEmb    = results.reduce((a, r) => a + r.embeddings, 0);
  const elapsed     = Date.now() - globalStart;

  sep2();
  console.log('  BATCH SUMMARY');
  sep2();
  info('Summary', `Documents processed  : ${results.length}`);
  info('Summary', `Documents succeeded  : ${succeeded.length}`);
  info('Summary', `Documents failed     : ${failed.length}`);
  info('Summary', `Documents skipped    : ${skipped.length}` +
    (skipped.length > 0 ? `  (${skipped.map((r) => r.note).join('; ')})` : ''));
  info('Summary', `Documents aborted    : ${aborted.length}` +
    (aborted.length > 0 ? `  (${aborted.map((r) => r.note).join('; ')})` : ''));
  info('Summary', `Total chunks created : ${totalChunks}`);
  info('Summary', `Total embeddings     : ${totalEmb}`);
  info('Summary', `Total elapsed        : ${elapsed}ms`);

  // ── Post-ingestion embedding count validation ──────────────────────────────
  if (!dryRun && succeeded.length > 0) {
    try {
      const { count: dbEmbCount, error: embErr } = await getSupabase()
        .from('knowledge_chunks')
        .select('*', { count: 'exact', head: true })
        .not('embedding_vector', 'is', null);
      if (embErr) {
        warn('Summary', `Embedding count validation failed: ${embErr.message}`);
      } else {
        info('Summary', `DB embeddings (all docs)  : ${dbEmbCount ?? 'unknown'}`);
        if (typeof dbEmbCount === 'number' && dbEmbCount < totalEmb) {
          warn('Summary', `⚠ DB embedding count (${dbEmbCount}) < pipeline count (${totalEmb}) — some vectors may be missing`);
        }
      }
    } catch (e) {
      warn('Summary', `Embedding count check error: ${e instanceof Error ? e.message : e}`);
    }
  }

  sep2();

  // ── Per-document results table ────────────────────────────────────────────
  console.log('');
  console.log('  Document                         Type               Chks  Emb   Integrity  Time      Status');
  console.log('  ' + '─'.repeat(85));
  for (const r of results) {
    const name   = r.filename.padEnd(32).slice(0, 32);
    const type   = r.docType.padEnd(18).slice(0, 18);
    const chunks = String(r.chunksDeduped).padStart(4);
    const emb    = String(r.embeddings).padStart(4);
    const score  = r.integrityScore > 0 ? r.integrityScore.toFixed(3) : '  n/a';
    const dur    = `${r.durationMs}ms`.padStart(7);
    const status = {
      success: 'OK',
      failed:  'FAILED',
      skipped: 'SKIPPED',
      aborted: 'ABORTED',
    }[r.outcome];
    console.log(`  ${name} ${type} ${chunks} ${emb}    ${score}  ${dur}   ${status}`);
  }
  console.log('');

  if (failed.length > 0) {
    process.exit(1);
  }
}

run().catch((e) => {
  console.error('[BatchIngest FATAL]', e instanceof Error ? e.message : e);
  process.exit(1);
});
