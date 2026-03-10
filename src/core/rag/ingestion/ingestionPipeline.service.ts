/**
 * RAG — Ingestion Pipeline Service
 * Manages document retry logic and background chunk processing.
 */

import { supabase } from '@/lib/supabase';
import { triggerStepRunner } from '@/api/knowledge-step-trigger';
import { log, warn } from '@/lib/logger';

/**
 * Trigger background chunk processing for a document.
 * Delegates to the server-side step runner.
 */
export async function processChunksAsync(
  documentId: string,
  _content: string,
  _category: string,
  _region: string | undefined,
  _originalContent: string
): Promise<void> {
  log('[RAG:Pipeline] 🚀 Triggering async chunk processing for document:', documentId);
  try {
    await triggerStepRunner(documentId);
    log('[RAG:Pipeline] ✅ Step runner triggered for document:', documentId);
  } catch (err) {
    console.error('[RAG:Pipeline] ❌ Failed to trigger step runner:', err);
  }
}

/**
 * Retry ingestion for a failed document.
 * Deletes existing chunks, resets state, and relaunches the pipeline.
 */
export async function retryIngestion(
  documentId: string,
  onRetry?: (retryCount: number) => void
): Promise<boolean> {
  try {
    log('[RAG:Pipeline] 🔄 Starting retry ingestion for document:', documentId);

    const { data: doc, error: fetchError } = await supabase
      .from('knowledge_documents')
      .select('*')
      .eq('id', documentId)
      .single();

    if (fetchError || !doc) {
      console.error('[RAG:Pipeline] ❌ Document not found:', fetchError);
      return false;
    }

    if (doc.ingestion_status !== 'failed') {
      warn('[RAG:Pipeline] ⚠️ Document is not in failed state:', doc.ingestion_status);
      return false;
    }

    log('[RAG:Pipeline] 🗑️ Deleting existing chunks...');
    const { error: deleteError } = await supabase
      .from('knowledge_chunks')
      .delete()
      .eq('document_id', documentId);

    if (deleteError) {
      console.error('[RAG:Pipeline] ❌ Failed to delete chunks:', deleteError);
      return false;
    }

    log('[RAG:Pipeline] 🔄 Resetting ingestion_status to pending...');
    const { error: statusError } = await supabase
      .from('knowledge_documents')
      .update({ ingestion_status: 'pending' })
      .eq('id', documentId);

    if (statusError) {
      console.error('[RAG:Pipeline] ❌ Failed to reset ingestion_status:', statusError);
      return false;
    }

    log('[RAG:Pipeline] 🚀 Relaunching pipeline...');
    onRetry?.(1);

    // Do not use setTimeout in serverless — execution stops when HTTP response is sent.
    // Directly await the async operation.
    await processChunksAsync(
      documentId,
      doc.content,
      doc.category,
      doc.region,
      doc.content
    );

    log('[RAG:Pipeline] ✅ Retry initiated successfully');
    return true;
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    console.error('[RAG:Pipeline] 💥 Retry ingestion error:', msg);
    return false;
  }
}
