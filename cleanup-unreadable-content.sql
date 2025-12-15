-- ============================================
-- Script de nettoyage des contenus incompréhensibles
-- ============================================

-- =============================================
-- PARTIE 1 : ANALYSE DES CONTENUS PROBLÉMATIQUES
-- =============================================

-- 1. Analyser les documents avec erreurs
SELECT
  id,
  filename,
  doc_type,
  status,
  processing_error,
  chunks_count,
  created_at
FROM knowledge_documents
WHERE status = 'error'
ORDER BY created_at DESC;

-- 2. Analyser les chunks trop courts (moins de 50 caractères)
SELECT
  kc.id,
  kd.filename,
  kc.content_length,
  LEFT(kc.content, 100) as preview,
  kc.chunk_index
FROM knowledge_chunks kc
JOIN knowledge_documents kd ON kc.document_id = kd.id
WHERE kc.content_length < 50
ORDER BY kc.content_length ASC
LIMIT 100;

-- 3. Analyser les chunks avec ratio élevé de caractères spéciaux
-- (plus de 30% de caractères non-alphanumériques)
SELECT
  kc.id,
  kd.filename,
  kc.content_length,
  LEFT(kc.content, 100) as preview,
  -- Calcul du ratio de caractères non-alphanumériques
  LENGTH(REGEXP_REPLACE(kc.content, '[a-zA-Z0-9àâäéèêëïîôùûüÿçÀÂÄÉÈÊËÏÎÔÙÛÜŸÇ\s]', '', 'g')) * 100.0 / NULLIF(kc.content_length, 0) as special_char_percentage
FROM knowledge_chunks kc
JOIN knowledge_documents kd ON kc.document_id = kd.id
WHERE kc.content_length > 0
  AND LENGTH(REGEXP_REPLACE(kc.content, '[a-zA-Z0-9àâäéèêëïîôùûüÿçÀÂÄÉÈÊËÏÎÔÙÛÜŸÇ\s]', '', 'g')) * 100.0 / NULLIF(kc.content_length, 0) > 30
ORDER BY special_char_percentage DESC
LIMIT 100;

-- 4. Analyser les chunks avec seulement des espaces ou caractères vides
SELECT
  kc.id,
  kd.filename,
  kc.content_length,
  kc.content as preview
FROM knowledge_chunks kc
JOIN knowledge_documents kd ON kc.document_id = kd.id
WHERE TRIM(kc.content) = ''
   OR kc.content ~ '^[\s\n\r\t]+$'
LIMIT 100;

-- 5. Statistiques globales
SELECT
  'Total documents' as metric,
  COUNT(*) as count
FROM knowledge_documents
UNION ALL
SELECT
  'Documents en erreur' as metric,
  COUNT(*) as count
FROM knowledge_documents
WHERE status = 'error'
UNION ALL
SELECT
  'Total chunks' as metric,
  COUNT(*) as count
FROM knowledge_chunks
UNION ALL
SELECT
  'Chunks < 50 caractères' as metric,
  COUNT(*) as count
FROM knowledge_chunks
WHERE content_length < 50
UNION ALL
SELECT
  'Chunks vides' as metric,
  COUNT(*) as count
FROM knowledge_chunks
WHERE TRIM(content) = '';

-- =============================================
-- PARTIE 2 : SUPPRESSION DES CONTENUS PROBLÉMATIQUES
-- =============================================

-- ATTENTION : Ces requêtes sont destructives !
-- Décommentez et exécutez-les une par une après avoir vérifié les résultats de l'analyse.

-- 1. Supprimer tous les documents avec status 'error'
-- (les chunks associés seront automatiquement supprimés via CASCADE)
-- DELETE FROM knowledge_documents
-- WHERE status = 'error';

-- 2. Supprimer les chunks trop courts (moins de 30 caractères)
-- DELETE FROM knowledge_chunks
-- WHERE content_length < 30;

-- 3. Supprimer les chunks avec seulement des espaces
-- DELETE FROM knowledge_chunks
-- WHERE TRIM(content) = ''
--    OR content ~ '^[\s\n\r\t]+$';

-- 4. Supprimer les chunks avec plus de 50% de caractères spéciaux
-- DELETE FROM knowledge_chunks
-- WHERE content_length > 0
--   AND LENGTH(REGEXP_REPLACE(content, '[a-zA-Z0-9àâäéèêëïîôùûüÿçÀÂÄÉÈÊËÏÎÔÙÛÜŸÇ\s]', '', 'g')) * 100.0 / NULLIF(content_length, 0) > 50;

-- 5. Supprimer les documents qui n'ont plus de chunks après nettoyage
-- DELETE FROM knowledge_documents
-- WHERE id IN (
--   SELECT kd.id
--   FROM knowledge_documents kd
--   LEFT JOIN knowledge_chunks kc ON kd.id = kc.document_id
--   WHERE kc.id IS NULL
-- );

-- =============================================
-- PARTIE 3 : REQUÊTE DE NETTOYAGE COMPLÈTE
-- =============================================

-- Requête tout-en-un pour supprimer les contenus incompréhensibles
-- ATTENTION : À utiliser avec précaution !

-- BEGIN;

-- Étape 1 : Supprimer les chunks problématiques
-- DELETE FROM knowledge_chunks
-- WHERE
--   -- Chunks trop courts
--   content_length < 30
--   -- Chunks vides ou seulement des espaces
--   OR TRIM(content) = ''
--   OR content ~ '^[\s\n\r\t]+$'
--   -- Chunks avec trop de caractères spéciaux (> 60%)
--   OR (
--     content_length > 0
--     AND LENGTH(REGEXP_REPLACE(content, '[a-zA-Z0-9àâäéèêëïîôùûüÿçÀÂÄÉÈÊËÏÎÔÙÛÜŸÇ\s]', '', 'g')) * 100.0 / NULLIF(content_length, 0) > 60
--   );

-- Étape 2 : Mettre à jour le chunks_count des documents
-- UPDATE knowledge_documents kd
-- SET chunks_count = (
--   SELECT COUNT(*)
--   FROM knowledge_chunks kc
--   WHERE kc.document_id = kd.id
-- );

-- Étape 3 : Supprimer les documents sans chunks ou en erreur
-- DELETE FROM knowledge_documents
-- WHERE chunks_count = 0 OR status = 'error';

-- COMMIT;

-- =============================================
-- PARTIE 4 : VÉRIFICATION POST-NETTOYAGE
-- =============================================

-- À exécuter après le nettoyage pour vérifier les résultats
-- SELECT
--   'Documents restants' as metric,
--   COUNT(*) as count
-- FROM knowledge_documents
-- WHERE status = 'indexed'
-- UNION ALL
-- SELECT
--   'Chunks restants' as metric,
--   COUNT(*) as count
-- FROM knowledge_chunks
-- UNION ALL
-- SELECT
--   'Taille moyenne des chunks' as metric,
--   ROUND(AVG(content_length)) as count
-- FROM knowledge_chunks;
