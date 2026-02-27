/**
 * Analysis Services
 *
 * UNIFIED RAG ARCHITECTURE:
 * All analysis operations now go through Supabase Edge Functions.
 * Frontend should call: supabase.functions.invoke('rag-query', {...})
 */

// Services consolidated into Edge Functions
// See: supabase/functions/rag-query/
