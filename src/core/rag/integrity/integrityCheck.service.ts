/**
 * RAG — Integrity Check Service
 * Verifies embedding integrity and performs system-wide audits.
 */

import { supabase } from '@/lib/supabase';
import { log, warn } from '@/lib/logger';

export interface EmbeddingIntegrityResult {
  valid: boolean;
  total_chunks: number;
  embedded_chunks: number;
  missing_embeddings: number;
}

export interface SystemIntegrityViolation {
  document_id: string;
  ingestion_status: string;
  embedding_integrity_checked: boolean;
  total_chunks: number;
  missing_embeddings: number;
  violation_type: string;
}

/**
 * Verify embedding integrity for a single document.
 * Ensures all chunks have embeddings before marking as complete.
 */
export async function verifyEmbeddingIntegrity(
  documentId: string,
  onFailure?: () => void
): Promise<EmbeddingIntegrityResult> {
  const emptyResult: EmbeddingIntegrityResult = {
    valid: false,
    total_chunks: 0,
    embedded_chunks: 0,
    missing_embeddings: 0,
  };

  try {
    log('[RAG:Integrity] 🔍 Verifying embedding integrity for:', documentId);

    const { data, error } = await supabase.rpc('verify_embedding_integrity', {
      p_document_id: documentId,
    });

    if (error) {
      console.error('[RAG:Integrity] ❌ Integrity check failed:', error);
      onFailure?.();
      return emptyResult;
    }

    if (!data || data.length === 0) {
      warn('[RAG:Integrity] ⚠️ No integrity data returned');
      return emptyResult;
    }

    const result = data[0];
    const isValid = result.is_valid === true || result.missing_embeddings === 0;

    log('[RAG:Integrity] 📊 Integrity check result:', {
      document_id: documentId,
      total_chunks: result.total_chunks,
      embedded_chunks: result.embedded_chunks,
      missing_embeddings: result.missing_embeddings,
      is_valid: isValid,
    });

    if (!isValid) {
      onFailure?.();
    }

    return {
      valid: isValid,
      total_chunks: result.total_chunks,
      embedded_chunks: result.embedded_chunks,
      missing_embeddings: result.missing_embeddings,
    };
  } catch (err) {
    console.error('[RAG:Integrity] 💥 Integrity verification error:', err);
    onFailure?.();
    return emptyResult;
  }
}

/**
 * Run a system-wide integrity audit.
 * Returns all documents with embedding integrity violations.
 */
export async function verifySystemIntegrity(): Promise<SystemIntegrityViolation[]> {
  try {
    log('[RAG:Integrity] 🔐 Verifying system integrity...');

    const { data, error } = await supabase.rpc('audit_system_integrity');

    if (error) {
      console.error('[RAG:Integrity] ❌ Audit function failed:', error);
      return [];
    }

    if (!data || data.length === 0) {
      log('[RAG:Integrity] ✅ System integrity OK - no violations found');
      return [];
    }

    console.error('[RAG:Integrity] 🚨 CRITICAL: System integrity violations detected:', {
      count: data.length,
      violations: data,
    });

    return data;
  } catch (err) {
    console.error('[RAG:Integrity] 💥 Integrity verification error:', err);
    return [];
  }
}
