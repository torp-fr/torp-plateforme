#!/usr/bin/env node
/**
 * Knowledge Brain — Manual Pipeline Test Harness
 *
 * Runs the full ingestion pipeline on a single local file and logs every
 * stage so each service can be inspected in isolation without deploying.
 *
 * Usage:
 *   pnpm tsx scripts/testKnowledgePipeline.ts <path-to-file>
 *
 * Example:
 *   pnpm tsx scripts/testKnowledgePipeline.ts ./test_corpus/sample.pdf
 *
 * Env:
 *   Expects VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in .env (or .env.local).
 *   Steps 7-10 also require an authenticated Supabase session — they degrade
 *   gracefully when auth is unavailable (error logged, pipeline continues).
 */

import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

// ---------------------------------------------------------------------------
// Bootstrap: load .env before any service import resolves env vars
// ---------------------------------------------------------------------------

const require = createRequire(import.meta.url);

// Attempt to load dotenv — tolerate missing package so the script also works
// when dotenv is not installed (env vars already set in shell)
try {
  const dotenv = require('dotenv');
  const envFile = ['.env.local', '.env'].find((f) =>
    fs.existsSync(path.resolve(process.cwd(), f))
  );
  if (envFile) {
    dotenv.config({ path: path.resolve(process.cwd(), envFile) });
    pipelineLog('Bootstrap', `Loaded env from ${envFile}`);
  }
} catch {
  // dotenv not available — rely on ambient env
}

// ---------------------------------------------------------------------------
// Imports (after env bootstrap)
// ---------------------------------------------------------------------------

import { extractDocumentContent } from '@/core/knowledge/ingestion/documentExtractor.service';
import { normalizeText }          from '@/core/knowledge/ingestion/textNormalizer.service';
import { classifyDocument }        from '@/core/knowledge/ingestion/documentClassifier.service';
import { chunkSmart }              from '@/core/knowledge/ingestion/smartChunker.service';
import { filterChunks }            from '@/core/knowledge/ingestion/chunkQualityFilter.service';
import { deduplicateChunks }       from '@/core/knowledge/ingestion/semanticDeduplication.service';
import {
  generateEmbeddingsForChunks,
}                                  from '@/core/knowledge/ingestion/knowledgeEmbedding.service';
import {
  indexChunks,
}                                  from '@/core/knowledge/ingestion/knowledgeIndex.service';
import {
  verifyDocumentIntegrity,
}                                  from '@/core/knowledge/integrity/knowledgeIntegrity.service';
import {
  getKnowledgeConflictService,
}                                  from '@/core/knowledge/conflicts/knowledgeConflict.service';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Pipeline stage label width — keeps columns aligned */
const LABEL_WIDTH = 22;

function pipelineLog(stage: string, message: string): void {
  const label = `[Pipeline:${stage}]`.padEnd(LABEL_WIDTH + 10);
  console.log(`${label} ${message}`);
}

function pipelineError(stage: string, err: unknown): void {
  const message = err instanceof Error ? err.message : String(err);
  console.error(`[Pipeline ERROR:${stage}] ${message}`);
}

function separator(): void {
  console.log('─'.repeat(72));
}

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 ** 2) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 ** 2).toFixed(2)} MB`;
}

function elapsed(startMs: number): string {
  return `${Date.now() - startMs}ms`;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function run(): Promise<void> {
  // ── CLI argument ──────────────────────────────────────────────────────────
  const filePath = process.argv[2];

  if (!filePath) {
    console.error('Usage: pnpm tsx scripts/testKnowledgePipeline.ts <file>');
    process.exit(1);
  }

  const absolutePath = path.resolve(process.cwd(), filePath);

  if (!fs.existsSync(absolutePath)) {
    console.error(`[Pipeline ERROR] File not found: ${absolutePath}`);
    process.exit(1);
  }

  const fileBuffer = fs.readFileSync(absolutePath);
  const filename   = path.basename(absolutePath);

  separator();
  console.log('  Knowledge Brain — Ingestion Pipeline Test Harness');
  separator();
  pipelineLog('Init', `File : ${filename}`);
  pipelineLog('Init', `Size : ${formatBytes(fileBuffer.length)}`);
  pipelineLog('Init', `Path : ${absolutePath}`);
  separator();

  const globalStart = Date.now();

  // ── Step 1: Document extraction ───────────────────────────────────────────
  let rawText = '';
  {
    const t = Date.now();
    try {
      rawText = await extractDocumentContent(fileBuffer, filename);
      pipelineLog('1 Extract',
        `Extracted ${rawText.length.toLocaleString()} characters  (${elapsed(t)})`);
    } catch (err) {
      pipelineError('1 Extract', err);
      process.exit(1);           // Cannot continue without text
    }
  }

  // ── Step 2: Normalisation ─────────────────────────────────────────────────
  let normalizedText = '';
  {
    const t = Date.now();
    normalizedText = normalizeText(rawText);
    const delta = rawText.length - normalizedText.length;
    pipelineLog('2 Normalize',
      `${normalizedText.length.toLocaleString()} characters after normalisation` +
      (delta > 0 ? `  (removed ${delta})` : '') +
      `  (${elapsed(t)})`);
  }

  // ── Step 3: Classification ────────────────────────────────────────────────
  const docType = classifyDocument(normalizedText);
  pipelineLog('3 Classify', `Document classified as: ${docType}`);

  // ── Step 4: Smart chunking ────────────────────────────────────────────────
  let smartChunks;
  {
    const t = Date.now();
    smartChunks = chunkSmart(normalizedText, docType);
    pipelineLog('4 SmartChunker',
      `Produced ${smartChunks.length} chunks  (${elapsed(t)})`);

    separator();
    console.log('  First 3 chunks (raw — before filter):');
    separator();
    smartChunks.slice(0, 3).forEach((c, i) => {
      console.log(`  Chunk ${i + 1}  tokens=${c.tokenCount}  strategy=${c.metadata?.strategy ?? 'n/a'}`);
      console.log(`  ${c.content.slice(0, 200).replace(/\n/g, '↵')}${c.content.length > 200 ? '…' : ''}`);
      console.log();
    });
    separator();
  }

  // ── Step 5: Quality filter ────────────────────────────────────────────────
  let qualityChunks;
  {
    const t = Date.now();
    qualityChunks = filterChunks(smartChunks);
    const removed = smartChunks.length - qualityChunks.length;
    pipelineLog('5 QualityFilter',
      `Removed ${removed} chunks — ${qualityChunks.length} remaining  (${elapsed(t)})`);

    // Show quality score distribution
    const scores = qualityChunks
      .map((c) => c.metadata?.qualityScore as number | undefined)
      .filter((s): s is number => typeof s === 'number');
    if (scores.length > 0) {
      const avg = (scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(3);
      const min = Math.min(...scores).toFixed(3);
      const max = Math.max(...scores).toFixed(3);
      pipelineLog('5 QualityFilter', `  qualityScore  avg=${avg}  min=${min}  max=${max}`);
    }
  }

  // ── Step 6: Semantic deduplication ───────────────────────────────────────
  let dedupedChunks;
  {
    const t = Date.now();
    try {
      dedupedChunks = await deduplicateChunks(qualityChunks);
      const removed = qualityChunks.length - dedupedChunks.length;
      pipelineLog('6 Dedup',
        `Removed ${removed} duplicates — ${dedupedChunks.length} remaining  (${elapsed(t)})`);
    } catch (err) {
      pipelineError('6 Dedup', err);
      pipelineLog('6 Dedup', 'Skipping dedup — using quality-filtered chunks');
      dedupedChunks = qualityChunks;
    }
  }

  pipelineLog('Progress', `Remaining chunks entering embedding: ${dedupedChunks.length}`);
  separator();

  // ── Step 7: Embedding generation ─────────────────────────────────────────
  // Convert to the shape expected by generateEmbeddingsForChunks
  const chunksForEmbed = dedupedChunks.map((c) => ({
    content:    c.content,
    tokenCount: c.tokenCount,
    startIndex: 0,
    endIndex:   c.content.length,
  }));

  let embeddings;
  {
    const t = Date.now();
    pipelineLog('7 Embeddings', `Generating embeddings for ${chunksForEmbed.length} chunks…`);
    try {
      embeddings = await generateEmbeddingsForChunks(chunksForEmbed);
      pipelineLog('7 Embeddings',
        `Generated ${embeddings.length} embeddings  dims=${embeddings[0]?.embedding.length ?? 'n/a'}  (${elapsed(t)})`);
    } catch (err) {
      pipelineError('7 Embeddings', err);
      embeddings = [];
      pipelineLog('7 Embeddings', 'Embedding failed — steps 8-10 will use a synthetic document ID');
    }
  }

  // ── Steps 8-10: DB-dependent — use a synthetic document ID ───────────────
  // A real run writes to Supabase; this harness uses a fixed test UUID so that
  // the DB steps can be exercised when credentials are available, and degrade
  // cleanly when they are not.
  const SYNTHETIC_DOC_ID = '00000000-0000-0000-0000-000000000001';

  // ── Step 8: Index ─────────────────────────────────────────────────────────
  {
    const t = Date.now();
    pipelineLog('8 Index', `Indexing ${chunksForEmbed.length} chunks (docId=${SYNTHETIC_DOC_ID})…`);
    try {
      const ok = await indexChunks(SYNTHETIC_DOC_ID, chunksForEmbed);
      pipelineLog('8 Index',
        ok
          ? `Indexed ${chunksForEmbed.length} chunks  (${elapsed(t)})`
          : `indexChunks returned false  (${elapsed(t)})`);
    } catch (err) {
      pipelineError('8 Index', err);
    }
  }

  // ── Step 9: Integrity check ───────────────────────────────────────────────
  {
    const t = Date.now();
    pipelineLog('9 Integrity', `Verifying document integrity…`);
    try {
      const report = await verifyDocumentIntegrity(SYNTHETIC_DOC_ID);
      pipelineLog('9 Integrity',
        `Score: ${report.integrityScore.toFixed(4)}` +
        `  publishable: ${report.isPublishable}` +
        `  validChunks: ${report.validChunks}/${report.totalChunks}` +
        `  (${elapsed(t)})`);
      if (report.issues.length > 0) {
        pipelineLog('9 Integrity', `  Issues: ${report.issues.join(' | ')}`);
      }
    } catch (err) {
      pipelineError('9 Integrity', err);
    }
  }

  // ── Step 10: Conflict detection ───────────────────────────────────────────
  {
    const t = Date.now();
    pipelineLog('10 Conflicts', `Running conflict detection…`);
    try {
      const svc    = getKnowledgeConflictService();
      const result = await svc.detectKnowledgeConflicts(SYNTHETIC_DOC_ID);
      pipelineLog('10 Conflicts',
        `Detected ${result.conflictsDetected} conflict(s)  (${elapsed(t)})`);
      if (result.conflictsDetected > 0) {
        result.conflicts.slice(0, 3).forEach((c, i) => {
          pipelineLog('10 Conflicts',
            `  #${i + 1}  type=${c.conflictType}  similarity=${c.similarityScore}`);
        });
      }
    } catch (err) {
      pipelineError('10 Conflicts', err);
    }
  }

  // ── Summary ───────────────────────────────────────────────────────────────
  separator();
  pipelineLog('Summary', `Total elapsed: ${elapsed(globalStart)}`);
  pipelineLog('Summary', `Input:         ${rawText.length.toLocaleString()} chars`);
  pipelineLog('Summary', `DocType:       ${docType}`);
  pipelineLog('Summary', `After chunk:   ${smartChunks.length} chunks`);
  pipelineLog('Summary', `After filter:  ${qualityChunks.length} chunks`);
  pipelineLog('Summary', `After dedup:   ${dedupedChunks.length} chunks`);
  pipelineLog('Summary', `Embeddings:    ${embeddings.length}`);
  separator();
}

run().catch((err) => {
  console.error('[Pipeline FATAL]', err);
  process.exit(1);
});
