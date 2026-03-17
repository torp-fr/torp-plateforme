/**
 * RAG — Keyword Search Service
 * Keyword/full-text fallback search via Supabase RPC.
 * Only searches verified, publishable documents.
 */

import { supabase } from '@/lib/supabase';
import { SearchResult } from '../types';
import { log } from '@/lib/logger';

/**
 * Keyword fallback search using the `search_knowledge_by_keyword` RPC.
 * Enforced to use knowledge_documents_ready and knowledge_chunks_ready views.
 */
export async function keywordSearch(
  query: string,
  limit: number,
  options?: {
    category?: string;
    region?: string;
    min_reliability?: number;
  }
): Promise<SearchResult[]> {
  try {
    log('[RAG:KeywordSearch] 📝 Keyword search starting (verified docs only)...');

    const { data, error } = await supabase.rpc('search_knowledge_by_keyword', {
      search_query: query,
      match_count: limit,
      p_category: options?.category || null,
    });

    if (error) {
      console.error('[RAG:KeywordSearch] 🔴 Keyword search RPC failed:', error.message);
      return [];
    }

    if (!data || data.length === 0) {
      log('[RAG:KeywordSearch] ℹ️ Keyword search: no results found');
      return [];
    }

    log('[RAG:KeywordSearch] ✅ Keyword search found', data.length, 'verified chunks');

    // Publishability is enforced at the database level:
    // knowledge_documents_ready view filters is_publishable = TRUE,
    // and search_knowledge_by_keyword queries that view exclusively.
    // No application-level filter needed here.

    return data.map((item: any) => ({
      id: item.id,
      source: item.doc_source,
      category: item.doc_category,
      content: item.content,
      reliability_score: 1.0,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      relevance_score: item.relevance_score || 0,
      embedding_similarity: 0,
    }));
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    console.error('[RAG:KeywordSearch] 💥 Keyword search error:', msg);
    return [];
  }
}
