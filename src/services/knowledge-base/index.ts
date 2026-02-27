/**
 * Knowledge Base Services Index
 *
 * UNIFIED RAG ARCHITECTURE:
 * All RAG operations now go through Supabase Edge Functions:
 * - rag-query: Main RAG endpoint for searches and analysis
 * - ingest-document: Document ingestion with OCR and embeddings
 * - generate-embedding: Vector embedding generation
 *
 * Frontend should call: supabase.functions.invoke('rag-query', {...})
 *
 * Type definitions still exported for reference.
 */

export * from './types';
