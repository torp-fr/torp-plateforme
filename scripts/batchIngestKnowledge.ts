#!/usr/bin/env node
/**
 * Knowledge Brain — Batch Ingestion Script
 *
 * Ingests up to MAX_BATCH=10 documents from a folder through the full
 * 10-step Knowledge Brain ingestion pipeline, writing real records to
 * Supabase (knowledge_documents + knowledge_chunks + embedding_vector).
 *
 * Usage:
 *   pnpm ingest:batch ./knowledge_corpus
 *   pnpm ingest:batch ./knowledge_corpus --dry-run
 *
 * Flags:
 *   --dry-run   Run local pipeline steps only (no DB writes, no embeddings)
 *
 * Env:
 *   VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in .env / .env.local
 *
 * Supported formats: .pdf  .docx  .xlsx  .csv  .txt  .md
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
import { indexChunks }                 from '@/core/knowledge/ingestion/knowledgeIndex.service';
import { verifyDocumentIntegrity }     from '@/core/knowledge/integrity/knowledgeIntegrity.service';
import { getKnowledgeConflictService } from '@/core/knowledge/conflicts/knowledgeConflict.service';
import { supabase }                    from '@/lib/supabase';

import type { DocumentType } from '@/core/knowledge/ingestion/documentClassifier.service';

// ---------------------------------------------------------------------------
// 3. Constants
// ---------------------------------------------------------------------------

const MAX_BATCH = 10;

const SUPPORTED_EXTENSIONS = new Set(['.pdf', '.docx', '.xlsx', '.csv', '.txt', '.md']);

/** Maps pipeline DocumentType → valid knowledge_documents.category enum value */
const DOC_TYPE_TO_CATEGORY: Record<DocumentType, string> = {
  regulation:        'REGULATION',
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

async function createDocument(
  filename:      string,
  normalizedText: string,
  fileSize:      number,
  docType:       DocumentType,
): Promise<string | null> {
  const { data: { user } } = await supabase.auth.getUser().catch(() => ({ data: { user: null } }));

  const { data: doc, error } = await supabase
    .from('knowledge_documents')
    .insert({
      title:              filename,
      content:            normalizedText,          // NOT NULL — use normalized text
      category:           DOC_TYPE_TO_CATEGORY[docType],
      source:             'internal',
      file_size:          fileSize > 0 ? fileSize : 1,
      chunk_count:        0,                       // updated after chunking completes
      is_publishable:     false,                   // set by integrity service post-index
      ingestion_status:   'processing',
      ingestion_started_at: new Date().toISOString(),
      created_by:         user?.id ?? null,
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
): Promise<boolean> {
  const records = chunks.map((c, i) => ({
    document_id: documentId,
    content:     c.content,
    chunk_index: i,
    token_count: c.tokenCount,
    metadata:    c.metadata ?? {},
  }));

  const { error } = await supabase.from('knowledge_chunks').insert(records);
  if (error) {
    fail('DB', `Chunk insert failed: ${error.message}`);
    return false;
  }
  return true;
}

async function updateDocumentStatus(
  documentId: string,
  status: 'complete' | 'failed',
  extras: Record<string, unknown> = {},
): Promise<void> {
  const patch: Record<string, unknown> = {
    ingestion_status: status,
    ...extras,
  };
  if (status === 'complete') {
    patch.ingestion_completed_at = new Date().toISOString();
    patch.ingestion_progress     = 100;
  }

  await supabase.from('knowledge_documents').update(patch).eq('id', documentId);
}

async function updateChunkCount(documentId: string, count: number): Promise<void> {
  await supabase.from('knowledge_documents').update({ chunk_count: count }).eq('id', documentId);
}

// ---------------------------------------------------------------------------
// 6. Per-document result type
// ---------------------------------------------------------------------------

interface DocResult {
  filename:        string;
  docType:         DocumentType;
  chunksGenerated: number;
  chunksFiltered:  number;
  chunksDeduped:   number;
  embeddings:      number;
  integrityScore:  number;
  conflicts:       number;
  durationMs:      number;
  error:           string | null;
}

// ---------------------------------------------------------------------------
// 7. Single-document ingestion
// ---------------------------------------------------------------------------

async function ingestDocument(
  filePath: string,
  dryRun:   boolean,
): Promise<DocResult> {
  const filename   = path.basename(filePath);
  const fileBuffer = fs.readFileSync(filePath);
  const docStart   = Date.now();

  const result: DocResult = {
    filename,
    docType:         'generic',
    chunksGenerated: 0,
    chunksFiltered:  0,
    chunksDeduped:   0,
    embeddings:      0,
    integrityScore:  0,
    conflicts:       0,
    durationMs:      0,
    error:           null,
  };

  let documentId: string | null = null;

  try {
    sep();
    info('Doc', `▶ ${filename}  (${formatBytes(fileBuffer.length)})`);

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
      const t = Date.now();
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
      const t    = Date.now();
      qualityChunks           = filterChunks(rawChunks);
      result.chunksFiltered   = qualityChunks.length;
      const removed           = rawChunks.length - qualityChunks.length;
      info('5 Filter', `${removed} removed → ${qualityChunks.length} remaining  (${ms(t)})`);
    }

    // ── Step 6: Semantic deduplication ────────────────────────────────────
    let dedupedChunks;
    {
      const t = Date.now();
      dedupedChunks         = await deduplicateChunks(qualityChunks);
      result.chunksDeduped  = dedupedChunks.length;
      const removed         = qualityChunks.length - dedupedChunks.length;
      info('6 Dedup', `${removed} duplicates removed → ${dedupedChunks.length} remaining  (${ms(t)})`);
    }

    if (dedupedChunks.length === 0) {
      warn('Doc', 'No chunks survived — document has no indexable content; skipping DB write');
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
        throw new Error('Failed to create document record in Supabase');
      }
      ok('DB:Doc', `document created: ${documentId}  (${ms(t)})`);

      // Insert chunk rows so indexChunks() can update them with embeddings
      const t2 = Date.now();
      const inserted = await insertChunks(documentId, dedupedChunks);
      if (!inserted) {
        throw new Error('Failed to insert chunk records');
      }
      await updateChunkCount(documentId, dedupedChunks.length);
      ok('DB:Chunks', `${dedupedChunks.length} chunk records inserted  (${ms(t2)})`);
    } else {
      info('DryRun', 'Skipping DB writes (--dry-run)');
    }

    // ── Step 7: Generate embeddings ───────────────────────────────────────
    {
      const t = Date.now();
      const embedResults  = await generateEmbeddingsForChunks(pipelineChunks);
      result.embeddings   = embedResults.length;
      info('7 Embeddings',
        `${result.embeddings}/${pipelineChunks.length} embeddings` +
        `  dims=${embedResults[0]?.embedding.length ?? 'n/a'}` +
        `  (${ms(t)})`
      );
    }

    // ── Step 8: Index (write embedding_vector column) ─────────────────────
    if (documentId) {
      const t = Date.now();
      const indexed = await indexChunks(documentId, pipelineChunks);
      info('8 Index',
        indexed
          ? `${pipelineChunks.length} chunks indexed  (${ms(t)})`
          : `indexChunks returned false — check logs  (${ms(t)})`
      );
    } else if (!dryRun) {
      warn('8 Index', 'No document ID — skipping index');
    }

    // ── Step 9: Integrity check ───────────────────────────────────────────
    if (documentId) {
      const t = Date.now();
      const report         = await verifyDocumentIntegrity(documentId);
      result.integrityScore = report.integrityScore;
      info('9 Integrity',
        `score: ${report.integrityScore.toFixed(4)}` +
        `  publishable: ${report.isPublishable}` +
        `  valid: ${report.validChunks}/${report.totalChunks}` +
        `  embeddings: ${report.chunksWithEmbeddings}/${report.totalChunks}` +
        `  (${ms(t)})`
      );
      if (report.issues.length > 0) {
        warn('9 Integrity', report.issues.slice(0, 3).join(' | '));
      }
    }

    // ── Step 10: Conflict detection ───────────────────────────────────────
    if (documentId) {
      const t = Date.now();
      const svc          = getKnowledgeConflictService();
      const cResult      = await svc.detectKnowledgeConflicts(documentId);
      result.conflicts   = cResult.conflictsDetected;
      info('10 Conflicts', `${result.conflicts} conflict(s) detected  (${ms(t)})`);
      if (result.conflicts > 0) {
        cResult.conflicts.slice(0, 2).forEach((c, i) => {
          info('10 Conflicts',
            `  #${i + 1} type=${c.conflictType}  similarity=${c.similarityScore.toFixed(4)}`
          );
        });
      }
    }

    // ── Mark complete ─────────────────────────────────────────────────────
    if (documentId) {
      await updateDocumentStatus(documentId, 'complete', {
        is_publishable:  result.integrityScore >= 0.7,
        ingestion_progress: 100,
      });
      ok('DB', `status → complete`);
    }

  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    result.error = msg;
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
  // ── CLI args ──────────────────────────────────────────────────────────────
  const args    = process.argv.slice(2);
  const folder  = args.find((a) => !a.startsWith('--'));
  const dryRun  = args.includes('--dry-run');

  if (!folder) {
    console.error('Usage: pnpm ingest:batch <folder> [--dry-run]');
    process.exit(1);
  }

  const folderAbs = path.resolve(process.cwd(), folder);
  if (!fs.existsSync(folderAbs) || !fs.statSync(folderAbs).isDirectory()) {
    console.error(`[BatchIngest] Not a directory: ${folderAbs}`);
    process.exit(1);
  }

  // ── Discover files ────────────────────────────────────────────────────────
  const allFiles = fs.readdirSync(folderAbs)
    .filter((f) => SUPPORTED_EXTENSIONS.has(path.extname(f).toLowerCase()))
    .map((f) => path.join(folderAbs, f))
    .sort();                                     // deterministic order

  const batch = allFiles.slice(0, MAX_BATCH);

  sep2();
  console.log('  Knowledge Brain — Batch Ingestion');
  sep2();
  info('Init', `Folder    : ${folderAbs}`);
  info('Init', `Files found: ${allFiles.length}  (processing ${batch.length}/${MAX_BATCH} max)`);
  info('Init', `Dry run   : ${dryRun ? 'yes (--dry-run)' : 'no'}`);
  sep2();

  if (batch.length === 0) {
    warn('Init', `No supported files in folder (${[...SUPPORTED_EXTENSIONS].join(', ')})`);
    process.exit(0);
  }

  if (allFiles.length > MAX_BATCH) {
    warn('Init',
      `${allFiles.length - MAX_BATCH} file(s) skipped (exceeded MAX_BATCH=${MAX_BATCH})`
    );
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

    // Per-document summary line
    const status = docResult.error ? '✗ FAILED' : '✓ OK    ';
    info('Result',
      `${status}  type=${docResult.docType}` +
      `  chunks=${docResult.chunksDeduped}` +
      `  emb=${docResult.embeddings}` +
      `  integrity=${docResult.integrityScore > 0 ? docResult.integrityScore.toFixed(3) : 'n/a'}` +
      `  ${docResult.durationMs}ms`
    );
    if (docResult.error) {
      fail('Error', docResult.error.slice(0, 120));
    }
  }

  // ── Batch summary ─────────────────────────────────────────────────────────
  const succeeded     = results.filter((r) => !r.error);
  const failed        = results.filter((r) =>  r.error);
  const totalChunks   = results.reduce((a, r) => a + r.chunksDeduped, 0);
  const totalEmb      = results.reduce((a, r) => a + r.embeddings, 0);
  const totalDuration = Date.now() - globalStart;

  sep2();
  console.log('  BATCH SUMMARY');
  sep2();
  info('Summary', `Documents processed  : ${results.length}`);
  info('Summary', `Documents succeeded  : ${succeeded.length}`);
  info('Summary', `Documents failed     : ${failed.length}`);
  info('Summary', `Total chunks created : ${totalChunks}`);
  info('Summary', `Total embeddings     : ${totalEmb}`);
  info('Summary', `Total elapsed        : ${totalDuration}ms`);
  sep2();

  // ── Per-document table ────────────────────────────────────────────────────
  console.log('');
  console.log('  Document                         Type               Chks  Emb   Integrity  Time');
  console.log('  ' + '─'.repeat(70));
  for (const r of results) {
    const name   = r.filename.padEnd(32).slice(0, 32);
    const type   = r.docType.padEnd(18).slice(0, 18);
    const chunks = String(r.chunksDeduped).padStart(4);
    const emb    = String(r.embeddings).padStart(4);
    const score  = r.integrityScore > 0 ? r.integrityScore.toFixed(3) : '  n/a';
    const dur    = `${r.durationMs}ms`.padStart(7);
    const err    = r.error ? '  ← FAILED' : '';
    console.log(`  ${name} ${type} ${chunks} ${emb}    ${score}  ${dur}${err}`);
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
