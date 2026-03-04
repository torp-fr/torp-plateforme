#!/usr/bin/env node
/**
 * Knowledge Brain — Manual Pipeline Test Harness v2
 *
 * Runs the full 10-step ingestion pipeline on a single local file, creates a
 * real Supabase document record, and logs detailed metrics for every stage.
 *
 * Usage:
 *   pnpm tsx --tsconfig tsconfig.json scripts/testKnowledgePipeline.ts <file> [--cleanup]
 *
 * Examples:
 *   pnpm test:pipeline ./test_corpus/regulation_sample.txt
 *   pnpm test:pipeline ./test_corpus/pricing_sample.csv --cleanup
 *
 * Flags:
 *   --cleanup   Delete the test document and its chunks from Supabase after the run
 *
 * Env:
 *   VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in .env / .env.local
 *   Steps 6-10 degrade gracefully when Supabase is unreachable.
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

import { extractDocumentContent }    from '@/core/knowledge/ingestion/documentExtractor.service';
import { normalizeText }              from '@/core/knowledge/ingestion/textNormalizer.service';
import { classifyDocument }           from '@/core/knowledge/ingestion/documentClassifier.service';
import { chunkSmart }                 from '@/core/knowledge/ingestion/smartChunker.service';
import { filterChunks }               from '@/core/knowledge/ingestion/chunkQualityFilter.service';
import { deduplicateChunks }          from '@/core/knowledge/ingestion/semanticDeduplication.service';
import { generateEmbeddingsForChunks } from '@/core/knowledge/ingestion/knowledgeEmbedding.service';
import { indexChunks }                from '@/core/knowledge/ingestion/knowledgeIndex.service';
import { verifyDocumentIntegrity }    from '@/core/knowledge/integrity/knowledgeIntegrity.service';
import { getKnowledgeConflictService } from '@/core/knowledge/conflicts/knowledgeConflict.service';
import { supabase }                   from '@/lib/supabase';

import type { DocumentType } from '@/core/knowledge/ingestion/documentClassifier.service';

// ---------------------------------------------------------------------------
// 3. Logging helpers
// ---------------------------------------------------------------------------

const SEP = '─'.repeat(72);

function log(stage: string, message: string): void {
  const label = `[Pipeline:${stage}]`.padEnd(32);
  console.log(`${label} ${message}`);
}

function err(stage: string, e: unknown): void {
  const msg = e instanceof Error ? e.message : String(e);
  console.error(`[Pipeline ERROR:${stage}] ${msg}`);
}

function sep(): void { console.log(SEP); }

function formatBytes(n: number): string {
  if (n < 1024)        return `${n} B`;
  if (n < 1024 ** 2)   return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 ** 2).toFixed(2)} MB`;
}

function ms(start: number): string { return `${Date.now() - start}ms`; }

// ---------------------------------------------------------------------------
// 4. Map DocumentType → valid knowledge_documents.category value
// ---------------------------------------------------------------------------

const DOC_TYPE_TO_CATEGORY: Record<DocumentType, string> = {
  regulation:        'REGULATION',
  technical_guide:   'TECHNICAL_GUIDE',
  pricing_reference: 'PRICING_REFERENCE',
  jurisprudence:     'LEGAL',
  generic:           'MANUAL',
};

// ---------------------------------------------------------------------------
// 5. DB helpers: create document, insert chunks, cleanup
// ---------------------------------------------------------------------------

async function createTestDocument(
  filename:   string,
  fileSize:   number,
  docType:    DocumentType,
  chunkCount: number,
): Promise<string | null> {
  // Attempt to get the current user so created_by can be populated.
  // Falls back to null — nullable in the schema after migration 053.
  const { data: { user } } = await supabase.auth.getUser().catch(() => ({ data: { user: null } }));

  const { data: doc, error: docError } = await supabase
    .from('knowledge_documents')
    .insert({
      title:       `[TEST] ${filename} — ${new Date().toISOString()}`,
      category:    DOC_TYPE_TO_CATEGORY[docType],
      source:      'internal',
      file_size:   fileSize > 0 ? fileSize : 1,   // satisfies file_size > 0 CHECK
      chunk_count: chunkCount,
      is_publishable: false,
      created_by:  user?.id ?? null,
    })
    .select('id')
    .single();

  if (docError || !doc) {
    err('DB:CreateDoc', docError?.message ?? 'No data returned');
    return null;
  }

  return doc.id as string;
}

async function insertChunkRecords(
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

  const { error: chunkError } = await supabase
    .from('knowledge_chunks')
    .insert(records);

  if (chunkError) {
    err('DB:InsertChunks', chunkError.message);
    return false;
  }

  return true;
}

async function cleanupTestDocument(documentId: string): Promise<void> {
  await supabase.from('knowledge_chunks').delete().eq('document_id', documentId);
  await supabase.from('knowledge_documents').delete().eq('id', documentId);
  log('Cleanup', `Deleted document ${documentId} and its chunks`);
}

// ---------------------------------------------------------------------------
// 6. Token distribution helper
// ---------------------------------------------------------------------------

function tokenStats(tokens: number[]): { avg: number; min: number; max: number } {
  if (tokens.length === 0) return { avg: 0, min: 0, max: 0 };
  const sum = tokens.reduce((a, b) => a + b, 0);
  return {
    avg: Math.round(sum / tokens.length),
    min: Math.min(...tokens),
    max: Math.max(...tokens),
  };
}

// ---------------------------------------------------------------------------
// 7. Main
// ---------------------------------------------------------------------------

async function run(): Promise<void> {
  // ── CLI args ──────────────────────────────────────────────────────────────
  const args       = process.argv.slice(2);
  const filePath   = args.find((a) => !a.startsWith('--'));
  const doCleanup  = args.includes('--cleanup');

  if (!filePath) {
    console.error(
      'Usage: pnpm tsx --tsconfig tsconfig.json scripts/testKnowledgePipeline.ts <file> [--cleanup]'
    );
    process.exit(1);
  }

  const absolutePath = path.resolve(process.cwd(), filePath);
  if (!fs.existsSync(absolutePath)) {
    console.error(`[Pipeline ERROR] File not found: ${absolutePath}`);
    process.exit(1);
  }

  const fileBuffer = fs.readFileSync(absolutePath);
  const filename   = path.basename(absolutePath);

  // Summary accumulators
  let integrityScore   = 0;
  let conflictsFound   = 0;
  let embeddingsCount  = 0;
  let documentId: string | null = null;

  sep();
  console.log('  Knowledge Brain — Ingestion Pipeline Test Harness v2');
  sep();
  log('Init', `File    : ${filename}`);
  log('Init', `Size    : ${formatBytes(fileBuffer.length)}`);
  log('Init', `Cleanup : ${doCleanup ? 'yes (--cleanup)' : 'no'}`);
  sep();

  const globalStart = Date.now();

  // ── Step 1: Extract ───────────────────────────────────────────────────────
  let rawText = '';
  {
    const t = Date.now();
    try {
      rawText = await extractDocumentContent(fileBuffer, filename);
      log('1 Extract', `${rawText.length.toLocaleString()} characters extracted  (${ms(t)})`);
    } catch (e) {
      err('1 Extract', e);
      process.exit(1);
    }
  }

  // ── Step 2: Normalize ─────────────────────────────────────────────────────
  let normalizedText = '';
  {
    const t = Date.now();
    normalizedText  = normalizeText(rawText);
    const removed   = rawText.length - normalizedText.length;
    log('2 Normalize',
      `${normalizedText.length.toLocaleString()} characters` +
      (removed > 0 ? `  (noise removed: ${removed} chars)` : '') +
      `  (${ms(t)})`
    );
  }

  // ── Step 3: Classify ──────────────────────────────────────────────────────
  const docType = classifyDocument(normalizedText);
  log('3 Classify', `Document type → ${docType}`);

  // ── Step 4: Smart chunking ────────────────────────────────────────────────
  let smartChunks;
  {
    const t   = Date.now();
    smartChunks = chunkSmart(normalizedText, docType);

    const toks  = smartChunks.map((c) => c.tokenCount);
    const stats = tokenStats(toks);

    log('4 SmartChunker', `${smartChunks.length} chunks produced  (${ms(t)})`);
    log('4 SmartChunker', `  Tokens avg: ${stats.avg}  min: ${stats.min}  max: ${stats.max}`);

    // ── Visual inspection: first 3 raw chunks ──────────────────────────────
    sep();
    console.log('  First 3 chunks (raw — before quality filter):');
    sep();
    smartChunks.slice(0, 3).forEach((c, i) => {
      const preview = c.content.slice(0, 200).replace(/\n/g, '↵');
      console.log(
        `  [${i + 1}] tokens=${c.tokenCount}` +
        `  strategy=${c.metadata?.strategy ?? 'n/a'}` +
        (c.metadata?.articleHeader  ? `  article="${c.metadata.articleHeader}"` : '') +
        (c.metadata?.sectionHeader  ? `  section="${c.metadata.sectionHeader}"` : '')
      );
      console.log(`       ${preview}${c.content.length > 200 ? '…' : ''}`);
      console.log();
    });
    sep();
  }

  // ── Step 5: Quality filter ────────────────────────────────────────────────
  let qualityChunks;
  {
    const t = Date.now();
    qualityChunks   = filterChunks(smartChunks);
    const removed   = smartChunks.length - qualityChunks.length;

    log('5 QualityFilter',
      `${removed} chunk(s) removed — ${qualityChunks.length} remaining  (${ms(t)})`
    );

    const scores = qualityChunks
      .map((c) => c.metadata?.qualityScore as number | undefined)
      .filter((s): s is number => typeof s === 'number');

    if (scores.length > 0) {
      const s = tokenStats(scores.map((x) => Math.round(x * 1000)));
      log('5 QualityFilter',
        `  qualityScore  avg: ${(s.avg / 1000).toFixed(3)}` +
        `  min: ${(s.min / 1000).toFixed(3)}` +
        `  max: ${(s.max / 1000).toFixed(3)}`
      );
    }
  }

  // ── Step 6: Semantic deduplication ────────────────────────────────────────
  let dedupedChunks;
  {
    const t = Date.now();
    try {
      dedupedChunks       = await deduplicateChunks(qualityChunks);
      const removed       = qualityChunks.length - dedupedChunks.length;
      log('6 Dedup',
        `${removed} near-duplicate(s) removed — ${dedupedChunks.length} remaining  (${ms(t)})`
      );
    } catch (e) {
      err('6 Dedup', e);
      log('6 Dedup', 'Dedup skipped — using quality-filtered chunks');
      dedupedChunks = qualityChunks;
    }
  }

  log('Progress', `→ ${dedupedChunks.length} chunks entering DB + embedding pipeline`);
  sep();

  // ── 6b: Create real Supabase document record ──────────────────────────────
  // Must happen before indexChunks(), which fetches chunk rows by document_id.
  {
    const t = Date.now();
    log('DB:CreateDoc', 'Inserting test document into knowledge_documents…');
    documentId = await createTestDocument(filename, fileBuffer.length, docType, dedupedChunks.length);

    if (!documentId) {
      log('DB:CreateDoc', 'Insert failed — steps 7-10 will be skipped');
    } else {
      log('DB:CreateDoc', `Document created: ${documentId}  (${ms(t)})`);

      // Insert chunk records so indexChunks() can update them with embeddings
      const t2 = Date.now();
      log('DB:InsertChunks', `Inserting ${dedupedChunks.length} chunk records…`);
      const ok = await insertChunkRecords(documentId, dedupedChunks);
      if (ok) {
        log('DB:InsertChunks', `${dedupedChunks.length} chunk records inserted  (${ms(t2)})`);
      }
    }
  }

  // Convert to shape expected by generateEmbeddingsForChunks / indexChunks
  const chunksForPipeline = dedupedChunks.map((c) => ({
    content:    c.content,
    tokenCount: c.tokenCount,
    startIndex: 0,
    endIndex:   c.content.length,
  }));

  // ── Step 7: Generate embeddings ───────────────────────────────────────────
  {
    const t = Date.now();
    log('7 Embeddings', `Generating embeddings for ${chunksForPipeline.length} chunks…`);
    try {
      const results    = await generateEmbeddingsForChunks(chunksForPipeline);
      embeddingsCount  = results.length;
      log('7 Embeddings',
        `${embeddingsCount} embeddings generated` +
        `  dims=${results[0]?.embedding.length ?? 'n/a'}` +
        `  (${ms(t)})`
      );
    } catch (e) {
      err('7 Embeddings', e);
      log('7 Embeddings', 'Embedding failed — index step may be incomplete');
    }
  }

  // ── Steps 8-10 require a valid documentId ────────────────────────────────
  if (!documentId) {
    log('Skip', 'No document ID — skipping index, integrity, and conflict steps');
  } else {
    // ── Step 8: Index ────────────────────────────────────────────────────────
    {
      const t = Date.now();
      log('8 Index', `Indexing into embedding_vector column (docId: ${documentId})…`);
      try {
        const ok = await indexChunks(documentId, chunksForPipeline);
        log('8 Index',
          ok
            ? `${chunksForPipeline.length} chunks indexed  (${ms(t)})`
            : `indexChunks returned false — check logs  (${ms(t)})`
        );
      } catch (e) {
        err('8 Index', e);
      }
    }

    // ── Step 9: Integrity check ───────────────────────────────────────────────
    {
      const t = Date.now();
      log('9 Integrity', 'Verifying document integrity…');
      try {
        const report   = await verifyDocumentIntegrity(documentId);
        integrityScore = report.integrityScore;
        log('9 Integrity',
          `Score: ${report.integrityScore.toFixed(4)}` +
          `  publishable: ${report.isPublishable}` +
          `  valid chunks: ${report.validChunks}/${report.totalChunks}` +
          `  embedding coverage: ${report.chunksWithEmbeddings}/${report.totalChunks}` +
          `  (${ms(t)})`
        );
        if (report.issues.length > 0) {
          log('9 Integrity', `  Issues: ${report.issues.slice(0, 5).join(' | ')}`);
        }
      } catch (e) {
        err('9 Integrity', e);
      }
    }

    // ── Step 10: Conflict detection ───────────────────────────────────────────
    {
      const t = Date.now();
      log('10 Conflicts', 'Running conflict detection…');
      try {
        const svc    = getKnowledgeConflictService();
        const result = await svc.detectKnowledgeConflicts(documentId);
        conflictsFound = result.conflictsDetected;
        log('10 Conflicts', `${conflictsFound} conflict(s) detected  (${ms(t)})`);
        if (conflictsFound > 0) {
          result.conflicts.slice(0, 3).forEach((c, i) => {
            log('10 Conflicts',
              `  #${i + 1}  type: ${c.conflictType}` +
              `  similarity: ${c.similarityScore.toFixed(4)}`
            );
          });
        }
      } catch (e) {
        err('10 Conflicts', e);
      }
    }

    // ── Optional cleanup ──────────────────────────────────────────────────────
    if (doCleanup) {
      sep();
      log('Cleanup', `--cleanup flag set — removing test data…`);
      try {
        await cleanupTestDocument(documentId);
      } catch (e) {
        err('Cleanup', e);
      }
    } else {
      log('Info', `Test document retained in DB: ${documentId}`);
      log('Info', 'Re-run with --cleanup to delete it after inspection');
    }
  }

  // ── Summary ───────────────────────────────────────────────────────────────
  sep();
  console.log('  PIPELINE SUMMARY');
  sep();
  log('Summary', `Total elapsed      : ${ms(globalStart)}`);
  log('Summary', `Input characters   : ${rawText.length.toLocaleString()}`);
  log('Summary', `Document type      : ${docType}`);
  log('Summary', `Chunks generated   : ${smartChunks.length}`);
  log('Summary', `Chunks after filter: ${qualityChunks.length}`);
  log('Summary', `Chunks after dedup : ${dedupedChunks.length}`);
  log('Summary', `Embeddings generated: ${embeddingsCount}`);
  log('Summary', `Integrity score    : ${integrityScore > 0 ? integrityScore.toFixed(4) : 'n/a'}`);
  log('Summary', `Conflicts detected : ${conflictsFound}`);
  log('Summary', `Document ID        : ${documentId ?? 'none (DB unavailable)'}`);
  sep();
}

run().catch((e) => {
  console.error('[Pipeline FATAL]', e instanceof Error ? e.message : e);
  process.exit(1);
});
