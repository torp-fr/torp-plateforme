-- =====================================================
-- TORP Security Fixes - PHASE 4D: FONCTIONS RAG
-- Description: Fonctions RAG (Retrieval Augmented Generation)
-- Exécuter après Phase 4C
-- =====================================================

-- Note: Les tables rag_chunks et rag_documents n'existent pas.
-- On utilise knowledge_chunks et knowledge_documents à la place.
-- DROP FUNCTION ajoutés pour éviter les erreurs de changement de type

-- 4.27 cleanup_empty_chunks
DROP FUNCTION IF EXISTS public.cleanup_empty_chunks() CASCADE;
CREATE OR REPLACE FUNCTION public.cleanup_empty_chunks()
RETURNS INTEGER
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM public.knowledge_chunks
  WHERE content IS NULL OR TRIM(content) = '';

  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$;

-- 4.28 cleanup_orphan_chunks
DROP FUNCTION IF EXISTS public.cleanup_orphan_chunks() CASCADE;
CREATE OR REPLACE FUNCTION public.cleanup_orphan_chunks()
RETURNS INTEGER
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM public.knowledge_chunks c
  WHERE NOT EXISTS (
    SELECT 1 FROM public.knowledge_documents d WHERE d.id = c.document_id
  );

  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$;

-- 4.29 cleanup_short_chunks
DROP FUNCTION IF EXISTS public.cleanup_short_chunks(INTEGER) CASCADE;
CREATE OR REPLACE FUNCTION public.cleanup_short_chunks(min_length INTEGER DEFAULT 50)
RETURNS INTEGER
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM public.knowledge_chunks
  WHERE LENGTH(content) < min_length;

  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$;

-- 4.30 cleanup_no_embedding_chunks
DROP FUNCTION IF EXISTS public.cleanup_no_embedding_chunks() CASCADE;
CREATE OR REPLACE FUNCTION public.cleanup_no_embedding_chunks()
RETURNS INTEGER
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM public.knowledge_chunks
  WHERE embedding IS NULL
  AND created_at < (NOW() - INTERVAL '7 days');

  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$;

-- 4.31 rag_full_cleanup
DROP FUNCTION IF EXISTS public.rag_full_cleanup() CASCADE;
CREATE OR REPLACE FUNCTION public.rag_full_cleanup()
RETURNS TABLE(
  empty_deleted INTEGER,
  orphan_deleted INTEGER,
  short_deleted INTEGER,
  no_embedding_deleted INTEGER
)
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  empty_deleted := public.cleanup_empty_chunks();
  orphan_deleted := public.cleanup_orphan_chunks();
  short_deleted := public.cleanup_short_chunks();
  no_embedding_deleted := public.cleanup_no_embedding_chunks();

  RETURN NEXT;
END;
$$;

-- 4.32 rag_document_stats
DROP FUNCTION IF EXISTS public.rag_document_stats() CASCADE;
CREATE OR REPLACE FUNCTION public.rag_document_stats()
RETURNS TABLE(
  total_documents BIGINT,
  total_chunks BIGINT,
  chunks_with_embedding BIGINT,
  avg_chunk_length DECIMAL
)
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    (SELECT COUNT(*) FROM public.knowledge_documents)::BIGINT,
    (SELECT COUNT(*) FROM public.knowledge_chunks)::BIGINT,
    (SELECT COUNT(*) FROM public.knowledge_chunks WHERE embedding IS NOT NULL)::BIGINT,
    (SELECT AVG(LENGTH(content))::DECIMAL FROM public.knowledge_chunks);
END;
$$;

-- 4.33 rag_health_check
DROP FUNCTION IF EXISTS public.rag_health_check() CASCADE;
CREATE OR REPLACE FUNCTION public.rag_health_check()
RETURNS TABLE(
  status TEXT,
  documents_count BIGINT,
  chunks_count BIGINT,
  embedding_coverage DECIMAL,
  orphan_chunks BIGINT,
  empty_chunks BIGINT
)
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  doc_count BIGINT;
  chunk_count BIGINT;
  embed_count BIGINT;
  orphan_count BIGINT;
  empty_count BIGINT;
  health_status TEXT;
BEGIN
  SELECT COUNT(*) INTO doc_count FROM public.knowledge_documents;
  SELECT COUNT(*) INTO chunk_count FROM public.knowledge_chunks;
  SELECT COUNT(*) INTO embed_count FROM public.knowledge_chunks WHERE embedding IS NOT NULL;
  SELECT COUNT(*) INTO orphan_count FROM public.knowledge_chunks c
    WHERE NOT EXISTS (SELECT 1 FROM public.knowledge_documents d WHERE d.id = c.document_id);
  SELECT COUNT(*) INTO empty_count FROM public.knowledge_chunks WHERE content IS NULL OR TRIM(content) = '';

  IF chunk_count = 0 THEN
    health_status := 'empty';
  ELSIF orphan_count > 0 OR empty_count > 0 THEN
    health_status := 'needs_cleanup';
  ELSIF embed_count::DECIMAL / NULLIF(chunk_count, 0) < 0.9 THEN
    health_status := 'partial_embeddings';
  ELSE
    health_status := 'healthy';
  END IF;

  RETURN QUERY SELECT
    health_status,
    doc_count,
    chunk_count,
    COALESCE(embed_count::DECIMAL / NULLIF(chunk_count, 0), 0),
    orphan_count,
    empty_count;
END;
$$;

-- 4.34 rag_problematic_documents
DROP FUNCTION IF EXISTS public.rag_problematic_documents() CASCADE;
CREATE OR REPLACE FUNCTION public.rag_problematic_documents()
RETURNS TABLE(
  document_id UUID,
  title TEXT,
  chunks_count BIGINT,
  missing_embeddings BIGINT
)
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    d.id,
    d.title,
    COUNT(c.id)::BIGINT,
    COUNT(c.id) FILTER (WHERE c.embedding IS NULL)::BIGINT
  FROM public.knowledge_documents d
  LEFT JOIN public.knowledge_chunks c ON c.document_id = d.id
  GROUP BY d.id, d.title
  HAVING COUNT(c.id) FILTER (WHERE c.embedding IS NULL) > 0;
END;
$$;

-- 4.35 update_knowledge_timestamp
DROP FUNCTION IF EXISTS public.update_knowledge_timestamp() CASCADE;
CREATE OR REPLACE FUNCTION public.update_knowledge_timestamp()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

-- 4.36 process_text_document
DROP FUNCTION IF EXISTS public.process_text_document(TEXT, INT, INT) CASCADE;
CREATE OR REPLACE FUNCTION public.process_text_document(
  doc_content TEXT,
  chunk_size INT DEFAULT 1000,
  chunk_overlap INT DEFAULT 200
)
RETURNS TABLE(
  chunk_index INT,
  chunk_content TEXT
)
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
AS $$
DECLARE
  doc_length INT;
  current_pos INT := 1;
  chunk_idx INT := 0;
BEGIN
  doc_length := LENGTH(doc_content);

  WHILE current_pos < doc_length LOOP
    chunk_idx := chunk_idx + 1;

    RETURN QUERY SELECT
      chunk_idx,
      SUBSTRING(doc_content FROM current_pos FOR chunk_size);

    current_pos := current_pos + chunk_size - chunk_overlap;
  END LOOP;
END;
$$;

-- =====================================================
-- FIN PHASE 4D
-- =====================================================
