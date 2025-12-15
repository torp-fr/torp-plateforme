-- ============================================
-- Migration: RAG Maintenance Functions
-- Fonctions de diagnostic et nettoyage pour la base de connaissances
-- ============================================

-- 1. Fonction de diagnostic rapide de la santé RAG
CREATE OR REPLACE FUNCTION rag_health_check()
RETURNS TABLE (
  metric TEXT,
  value BIGINT
)
LANGUAGE SQL
AS $$
  -- Documents totaux
  SELECT 'total_documents'::TEXT, COUNT(*)::BIGINT FROM knowledge_documents
  UNION ALL
  -- Documents indexés
  SELECT 'indexed_documents'::TEXT, COUNT(*)::BIGINT FROM knowledge_documents WHERE status = 'indexed'
  UNION ALL
  -- Documents en erreur
  SELECT 'error_documents'::TEXT, COUNT(*)::BIGINT FROM knowledge_documents WHERE status = 'error'
  UNION ALL
  -- Documents en attente
  SELECT 'pending_documents'::TEXT, COUNT(*)::BIGINT FROM knowledge_documents WHERE status = 'pending'
  UNION ALL
  -- Chunks totaux
  SELECT 'total_chunks'::TEXT, COUNT(*)::BIGINT FROM knowledge_chunks
  UNION ALL
  -- Chunks avec embedding
  SELECT 'chunks_with_embedding'::TEXT, COUNT(*)::BIGINT FROM knowledge_chunks WHERE embedding IS NOT NULL
  UNION ALL
  -- Chunks vides
  SELECT 'empty_chunks'::TEXT, COUNT(*)::BIGINT FROM knowledge_chunks WHERE content IS NULL OR content = ''
  UNION ALL
  -- Chunks courts (< 50 caractères)
  SELECT 'short_chunks'::TEXT, COUNT(*)::BIGINT FROM knowledge_chunks WHERE content_length < 50
  UNION ALL
  -- Chunks orphelins
  SELECT 'orphan_chunks'::TEXT, COUNT(*)::BIGINT
  FROM knowledge_chunks kc
  WHERE NOT EXISTS (SELECT 1 FROM knowledge_documents kd WHERE kd.id = kc.document_id)
$$;

COMMENT ON FUNCTION rag_health_check() IS 'Retourne les métriques de santé de la base RAG';


-- 2. Fonction de suppression progressive des chunks vides (par lots)
CREATE OR REPLACE FUNCTION cleanup_empty_chunks(
  p_batch_size INTEGER DEFAULT 100,
  p_max_iterations INTEGER DEFAULT 100
)
RETURNS INTEGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_total INTEGER := 0;
  v_deleted INTEGER;
  v_iteration INTEGER := 0;
BEGIN
  LOOP
    v_iteration := v_iteration + 1;

    -- Supprimer un lot de chunks vides
    WITH to_delete AS (
      SELECT id FROM knowledge_chunks
      WHERE content IS NULL OR content = ''
      LIMIT p_batch_size
    )
    DELETE FROM knowledge_chunks
    WHERE id IN (SELECT id FROM to_delete);

    GET DIAGNOSTICS v_deleted = ROW_COUNT;
    v_total := v_total + v_deleted;

    -- Sortir si plus rien à supprimer ou max iterations
    EXIT WHEN v_deleted = 0 OR v_iteration >= p_max_iterations;

    -- Petite pause pour ne pas bloquer la DB
    PERFORM pg_sleep(0.05);
  END LOOP;

  RETURN v_total;
END;
$$;

COMMENT ON FUNCTION cleanup_empty_chunks(INTEGER, INTEGER) IS 'Supprime les chunks vides par lots pour éviter les timeouts';


-- 3. Fonction de suppression progressive des chunks courts
CREATE OR REPLACE FUNCTION cleanup_short_chunks(
  p_min_length INTEGER DEFAULT 20,
  p_batch_size INTEGER DEFAULT 100,
  p_max_iterations INTEGER DEFAULT 100
)
RETURNS INTEGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_total INTEGER := 0;
  v_deleted INTEGER;
  v_iteration INTEGER := 0;
BEGIN
  LOOP
    v_iteration := v_iteration + 1;

    -- Supprimer un lot de chunks courts
    WITH to_delete AS (
      SELECT id FROM knowledge_chunks
      WHERE content_length < p_min_length
      LIMIT p_batch_size
    )
    DELETE FROM knowledge_chunks
    WHERE id IN (SELECT id FROM to_delete);

    GET DIAGNOSTICS v_deleted = ROW_COUNT;
    v_total := v_total + v_deleted;

    EXIT WHEN v_deleted = 0 OR v_iteration >= p_max_iterations;

    PERFORM pg_sleep(0.05);
  END LOOP;

  RETURN v_total;
END;
$$;

COMMENT ON FUNCTION cleanup_short_chunks(INTEGER, INTEGER, INTEGER) IS 'Supprime les chunks trop courts par lots';


-- 4. Fonction de suppression des chunks orphelins
CREATE OR REPLACE FUNCTION cleanup_orphan_chunks(
  p_batch_size INTEGER DEFAULT 100,
  p_max_iterations INTEGER DEFAULT 100
)
RETURNS INTEGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_total INTEGER := 0;
  v_deleted INTEGER;
  v_iteration INTEGER := 0;
BEGIN
  LOOP
    v_iteration := v_iteration + 1;

    -- Supprimer les chunks dont le document parent n'existe plus
    WITH to_delete AS (
      SELECT kc.id
      FROM knowledge_chunks kc
      LEFT JOIN knowledge_documents kd ON kd.id = kc.document_id
      WHERE kd.id IS NULL
      LIMIT p_batch_size
    )
    DELETE FROM knowledge_chunks
    WHERE id IN (SELECT id FROM to_delete);

    GET DIAGNOSTICS v_deleted = ROW_COUNT;
    v_total := v_total + v_deleted;

    EXIT WHEN v_deleted = 0 OR v_iteration >= p_max_iterations;

    PERFORM pg_sleep(0.05);
  END LOOP;

  RETURN v_total;
END;
$$;

COMMENT ON FUNCTION cleanup_orphan_chunks(INTEGER, INTEGER) IS 'Supprime les chunks orphelins (document parent supprimé)';


-- 5. Fonction de suppression des chunks sans embeddings
CREATE OR REPLACE FUNCTION cleanup_no_embedding_chunks(
  p_batch_size INTEGER DEFAULT 100,
  p_max_iterations INTEGER DEFAULT 100
)
RETURNS INTEGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_total INTEGER := 0;
  v_deleted INTEGER;
  v_iteration INTEGER := 0;
BEGIN
  LOOP
    v_iteration := v_iteration + 1;

    WITH to_delete AS (
      SELECT id FROM knowledge_chunks
      WHERE embedding IS NULL
      LIMIT p_batch_size
    )
    DELETE FROM knowledge_chunks
    WHERE id IN (SELECT id FROM to_delete);

    GET DIAGNOSTICS v_deleted = ROW_COUNT;
    v_total := v_total + v_deleted;

    EXIT WHEN v_deleted = 0 OR v_iteration >= p_max_iterations;

    PERFORM pg_sleep(0.05);
  END LOOP;

  RETURN v_total;
END;
$$;

COMMENT ON FUNCTION cleanup_no_embedding_chunks(INTEGER, INTEGER) IS 'Supprime les chunks sans embeddings par lots';


-- 6. Fonction de nettoyage complet
CREATE OR REPLACE FUNCTION rag_full_cleanup(
  p_batch_size INTEGER DEFAULT 100,
  p_delete_no_embedding BOOLEAN DEFAULT FALSE
)
RETURNS TABLE (
  cleanup_type TEXT,
  deleted_count INTEGER
)
LANGUAGE plpgsql
AS $$
DECLARE
  v_empty INTEGER;
  v_short INTEGER;
  v_orphan INTEGER;
  v_no_emb INTEGER := 0;
BEGIN
  -- Nettoyer les chunks vides
  v_empty := cleanup_empty_chunks(p_batch_size, 1000);

  -- Nettoyer les chunks courts
  v_short := cleanup_short_chunks(20, p_batch_size, 1000);

  -- Nettoyer les chunks orphelins
  v_orphan := cleanup_orphan_chunks(p_batch_size, 1000);

  -- Optionnel: nettoyer les chunks sans embeddings
  IF p_delete_no_embedding THEN
    v_no_emb := cleanup_no_embedding_chunks(p_batch_size, 1000);
  END IF;

  -- Retourner les résultats
  RETURN QUERY
  SELECT 'empty_chunks'::TEXT, v_empty
  UNION ALL
  SELECT 'short_chunks'::TEXT, v_short
  UNION ALL
  SELECT 'orphan_chunks'::TEXT, v_orphan
  UNION ALL
  SELECT 'no_embedding_chunks'::TEXT, v_no_emb;
END;
$$;

COMMENT ON FUNCTION rag_full_cleanup(INTEGER, BOOLEAN) IS 'Exécute un nettoyage complet de la base RAG';


-- 7. Fonction pour obtenir les statistiques par document
CREATE OR REPLACE FUNCTION rag_document_stats()
RETURNS TABLE (
  document_id UUID,
  document_name TEXT,
  doc_type TEXT,
  status TEXT,
  chunks_count BIGINT,
  chunks_with_embedding BIGINT,
  empty_chunks BIGINT,
  avg_chunk_length NUMERIC
)
LANGUAGE SQL
AS $$
  SELECT
    kd.id AS document_id,
    COALESCE(kd.title, kd.original_name, kd.filename) AS document_name,
    kd.doc_type,
    kd.status,
    COUNT(kc.id) AS chunks_count,
    COUNT(kc.id) FILTER (WHERE kc.embedding IS NOT NULL) AS chunks_with_embedding,
    COUNT(kc.id) FILTER (WHERE kc.content IS NULL OR kc.content = '') AS empty_chunks,
    ROUND(AVG(kc.content_length)::NUMERIC, 0) AS avg_chunk_length
  FROM knowledge_documents kd
  LEFT JOIN knowledge_chunks kc ON kc.document_id = kd.id
  GROUP BY kd.id, kd.title, kd.original_name, kd.filename, kd.doc_type, kd.status
  ORDER BY chunks_count DESC;
$$;

COMMENT ON FUNCTION rag_document_stats() IS 'Retourne les statistiques détaillées par document';


-- 8. Fonction pour identifier les documents problématiques
CREATE OR REPLACE FUNCTION rag_problematic_documents()
RETURNS TABLE (
  document_id UUID,
  document_name TEXT,
  issues TEXT[]
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  WITH doc_stats AS (
    SELECT
      kd.id,
      COALESCE(kd.title, kd.original_name, kd.filename) AS name,
      kd.status,
      COUNT(kc.id) AS total_chunks,
      COUNT(kc.id) FILTER (WHERE kc.content IS NULL OR kc.content = '') AS empty_count,
      COUNT(kc.id) FILTER (WHERE kc.embedding IS NULL) AS no_embedding_count,
      COALESCE(AVG(kc.content_length), 0) AS avg_length
    FROM knowledge_documents kd
    LEFT JOIN knowledge_chunks kc ON kc.document_id = kd.id
    GROUP BY kd.id, kd.title, kd.original_name, kd.filename, kd.status
  )
  SELECT
    ds.id AS document_id,
    ds.name AS document_name,
    ARRAY_REMOVE(ARRAY[
      CASE WHEN ds.total_chunks = 0 THEN 'NO_CHUNKS' END,
      CASE WHEN ds.status = 'error' THEN 'STATUS_ERROR' END,
      CASE WHEN ds.status = 'pending' THEN 'NOT_PROCESSED' END,
      CASE WHEN ds.empty_count > ds.total_chunks * 0.3 THEN 'TOO_MANY_EMPTY' END,
      CASE WHEN ds.no_embedding_count > ds.total_chunks * 0.2 THEN 'MISSING_EMBEDDINGS' END,
      CASE WHEN ds.avg_length < 100 AND ds.total_chunks > 0 THEN 'CHUNKS_TOO_SHORT' END,
      CASE WHEN ds.avg_length > 8000 THEN 'CHUNKS_TOO_LONG' END
    ], NULL) AS issues
  FROM doc_stats ds
  WHERE
    ds.total_chunks = 0
    OR ds.status IN ('error', 'pending')
    OR ds.empty_count > ds.total_chunks * 0.3
    OR ds.no_embedding_count > ds.total_chunks * 0.2
    OR (ds.avg_length < 100 AND ds.total_chunks > 0)
    OR ds.avg_length > 8000;
END;
$$;

COMMENT ON FUNCTION rag_problematic_documents() IS 'Identifie les documents avec des problèmes de qualité';


-- 9. Index supplémentaires pour optimiser les requêtes de maintenance
CREATE INDEX IF NOT EXISTS idx_knowledge_chunks_content_length
ON knowledge_chunks(content_length);

CREATE INDEX IF NOT EXISTS idx_knowledge_chunks_has_embedding
ON knowledge_chunks((embedding IS NOT NULL));

CREATE INDEX IF NOT EXISTS idx_knowledge_documents_status
ON knowledge_documents(status);


-- 10. Vue pour le dashboard de santé RAG
CREATE OR REPLACE VIEW rag_health_dashboard AS
SELECT
  (SELECT COUNT(*) FROM knowledge_documents) AS total_documents,
  (SELECT COUNT(*) FROM knowledge_documents WHERE status = 'indexed') AS indexed_documents,
  (SELECT COUNT(*) FROM knowledge_documents WHERE status = 'error') AS error_documents,
  (SELECT COUNT(*) FROM knowledge_documents WHERE status = 'pending') AS pending_documents,
  (SELECT COUNT(*) FROM knowledge_chunks) AS total_chunks,
  (SELECT COUNT(*) FROM knowledge_chunks WHERE embedding IS NOT NULL) AS chunks_with_embeddings,
  (SELECT COUNT(*) FROM knowledge_chunks WHERE content IS NULL OR content = '') AS empty_chunks,
  (SELECT COUNT(*) FROM knowledge_chunks WHERE content_length < 50) AS short_chunks,
  ROUND(
    (SELECT COUNT(*) FROM knowledge_chunks WHERE embedding IS NOT NULL)::NUMERIC /
    NULLIF((SELECT COUNT(*) FROM knowledge_chunks), 0) * 100,
    1
  ) AS embedding_coverage_percent,
  ROUND(
    (SELECT AVG(content_length) FROM knowledge_chunks),
    0
  ) AS avg_chunk_length;

COMMENT ON VIEW rag_health_dashboard IS 'Vue consolidée des métriques de santé RAG';
