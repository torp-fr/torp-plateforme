/**
 * Knowledge Ingestion Service v2.0
 *
 * ARCHITECTURE RULES (MANDATORY):
 *  - This service NEVER creates documents in knowledge_documents.
 *  - The caller (API or test script) is solely responsible for creating the
 *    document record and passing the resulting documentId here.
 *  - This service is READ-ONLY for knowledge_documents.
 *    It only writes to knowledge_chunks.
 *
 * Pipeline:
 *   extract text → normalize → classify → chunk → filter → dedup
 *   → INSERT knowledge_chunks (BLOCKING, defines success)
 *   → index / integrity (NON-BLOCKING, failures do not fail ingestion)
 */

import { supabase } from '@/lib/supabase';
import { log, warn } from '@/lib/logger';
import { normalizeText } from './textNormalizer.service';
import { classifyDocument } from './documentClassifier.service';
import { extractDocumentContent } from './documentExtractor.service';
import { chunkSmart } from './smartChunker.service';
import { filterChunks } from './chunkQualityFilter.service';
import { deduplicateChunks } from './semanticDeduplication.service';

// ─────────────────────────────────────────────────────────────────────────────
// Public Types
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Knowledge document metadata (kept for external consumers that import this type)
 */
export interface KnowledgeDocumentMetadata {
  title: string;
  category: 'norme' | 'fiche_technique' | 'jurisprudence' | 'manuel' | 'autre';
  source?: string;
  version?: string;
}

/**
 * Knowledge document record
 */
export interface KnowledgeDocument {
  id: string;
  title: string;
  category: string;
  source?: string;
  version?: string;
  file_size: number;
  created_by: string;
  created_at: string;
  chunk_count: number;
}

/**
 * Knowledge chunk record
 */
export interface KnowledgeChunk {
  id: string;
  document_id: string;
  content: string;
  chunk_index: number;
  token_count: number;
  embedding_vector?: number[];
  created_at: string;
}

/**
 * Ingestion result
 */
export interface IngestionResult {
  success: boolean;
  documentId?: string;
  chunksCreated?: number;
  totalTokens?: number;
  errors?: string[];
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Ingestion Entry Point
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Ingest a knowledge document.
 *
 * The caller MUST have already inserted the document row into `knowledge_documents`
 * and obtained its `documentId`.  This function NEVER writes to `knowledge_documents`.
 *
 * SUCCESS is defined solely by chunk insertion.
 * Deduplication and indexing are non-blocking — their failures never fail ingestion.
 *
 * @param documentId  UUID of the pre-existing knowledge_documents row
 * @param filename    Original filename (used for format detection / extraction)
 * @param buffer      Raw file content as a Node.js Buffer
 */
export async function ingestKnowledgeDocument({
  documentId,
  filename,
  buffer,
}: {
  documentId: string;
  filename: string;
  buffer: Buffer;
}): Promise<IngestionResult> {
  log('[KnowledgeIngestion] Starting ingestion for:', filename, '| documentId:', documentId);

  if (!documentId) {
    return { success: false, errors: ['documentId is required — create the document record first'] };
  }

  // ── STEP 1 (CRITICAL): Extract text ────────────────────────────────────────
  let rawText: string;
  try {
    rawText = await extractDocumentContent(buffer, filename);
    log('[KnowledgeIngestion] Text extracted:', rawText.length, 'characters');
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    console.error('[KnowledgeIngestion] Text extraction failed:', msg);
    return { success: false, errors: [`Text extraction failed: ${msg}`] };
  }

  // ── STEP 2 (CRITICAL): Normalize → classify → chunk → filter ──────────────
  const normalizedText = normalizeText(rawText);
  log('[KnowledgeIngestion] Text normalized:', normalizedText.length, 'characters');

  const docType = classifyDocument(normalizedText);
  log('[KnowledgeIngestion] Document classified as:', docType);

  const rawChunks = chunkSmart(normalizedText, docType);
  log('[KnowledgeIngestion] Raw chunks:', rawChunks.length);

  const qualityChunks = filterChunks(rawChunks);
  log('[KnowledgeIngestion] Chunks after quality filter:', qualityChunks.length);

  // ── STEP 3 (NON-CRITICAL): Deduplication ────────────────────────────────────
  let dedupedChunks = qualityChunks;
  try {
    dedupedChunks = await deduplicateChunks(qualityChunks);
    log('[KnowledgeIngestion] Chunks after deduplication:', dedupedChunks.length);
  } catch (err) {
    warn('[KnowledgeIngestion] Deduplication failed (non-blocking) — using all quality chunks:', err);
  }

  const chunks = dedupedChunks.map((c) => ({
    content: c.content,
    tokenCount: c.tokenCount,
    metadata: c.metadata ?? {},
    startIndex: 0,
    endIndex: c.content.length,
  }));

  if (chunks.length === 0) {
    return { success: false, chunksCreated: 0, errors: ['No chunks produced from document'] };
  }

  // ── STEP 4 (CRITICAL): Insert chunks ────────────────────────────────────────
  const chunkRecords = chunks.map((chunk, index) => ({
    document_id: documentId,
    content: chunk.content,
    chunk_index: index,
    token_count: chunk.tokenCount,
    metadata: chunk.metadata ?? {},
  }));

  let insertedCount = 0;
  try {
    const { error: chunkError } = await supabase
      .from('knowledge_chunks')
      .insert(chunkRecords);

    if (chunkError) {
      console.error('[KnowledgeIngestion] Chunk insert error:', chunkError);
      return { success: false, errors: [`Failed to insert chunks: ${chunkError.message}`] };
    }

    insertedCount = chunkRecords.length;
    log('[KnowledgeIngestion] Chunks inserted successfully:', insertedCount);
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    console.error('[KnowledgeIngestion] Chunk insert exception:', msg);
    return { success: false, errors: [`Failed to insert chunks: ${msg}`] };
  }

  if (insertedCount === 0) {
    return { success: false, chunksCreated: 0, errors: ['Zero chunks were inserted'] };
  }

  // ── STEP 5 (NON-CRITICAL): Index + integrity verification ───────────────────
  try {
    const { indexChunks } = await import('./knowledgeIndex.service');
    await indexChunks(documentId, chunks);
  } catch (err) {
    warn('[KnowledgeIngestion] Indexing failed (non-blocking) — ingestion still successful:', err);
  }

  return {
    success: true,
    documentId,
    chunksCreated: insertedCount,
    totalTokens: chunks.reduce((sum, c) => sum + c.tokenCount, 0),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Utility: extract raw text from buffer (kept for external callers)
// ─────────────────────────────────────────────────────────────────────────────

export function extractTextFromBuffer(buffer: Buffer, filename: string): string {
  try {
    if (filename.endsWith('.txt') || filename.endsWith('.md')) {
      return buffer.toString('utf-8');
    }
    const text = buffer.toString('utf-8');
    if (text.length > 0) return text;
    throw new Error(`Unsupported file format: ${filename}`);
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    console.error('[KnowledgeIngestion] Text extraction failed:', msg);
    throw err;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Utility: keyword search on chunks
// ─────────────────────────────────────────────────────────────────────────────

export async function searchKnowledge(query: string, limit: number = 10): Promise<KnowledgeChunk[]> {
  try {
    log('[KnowledgeIngestion] Searching for:', query);

    const { data, error } = await supabase
      .from('knowledge_chunks')
      .select('*')
      .ilike('content', `%${query}%`)
      .limit(limit);

    if (error) {
      throw new Error(`Search failed: ${error.message}`);
    }

    log('[KnowledgeIngestion] Found', data?.length || 0, 'results');
    return data || [];
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    console.error('[KnowledgeIngestion] Search failed:', msg);
    return [];
  }
}
