# Guide de Nettoyage des Contenus Incompréhensibles

## 📋 Vue d'ensemble

Ce guide vous explique comment identifier et supprimer les contenus incompréhensibles (OCR défaillant, caractères illisibles, chunks vides) de votre base de données Supabase.

## 🚀 Utilisation rapide

### Option 1 : Via l'interface Supabase SQL Editor

1. Connectez-vous à votre projet Supabase
2. Allez dans **SQL Editor**
3. Ouvrez le fichier `cleanup-unreadable-content.sql`

### Option 2 : Via le CLI Supabase

```bash
# Se connecter à la base de données
supabase db reset --db-url "postgresql://..."

# Exécuter le script
psql "postgresql://..." -f cleanup-unreadable-content.sql
```

## 📊 Étape 1 : Analyser avant de supprimer

Exécutez d'abord **toute la PARTIE 1** du script pour voir ce qui sera supprimé :

```sql
-- Voir les documents en erreur
SELECT id, filename, status, processing_error
FROM knowledge_documents
WHERE status = 'error';

-- Voir les statistiques
SELECT 'Total documents' as metric, COUNT(*) as count
FROM knowledge_documents
UNION ALL
SELECT 'Documents en erreur', COUNT(*)
FROM knowledge_documents WHERE status = 'error'
-- ... etc
```

### Critères de détection

Un contenu est considéré comme "incompréhensible" si :

| Critère | Seuil | Description |
|---------|-------|-------------|
| **Longueur** | < 30 caractères | Chunk trop court pour être utile |
| **Caractères spéciaux** | > 60% | Plus de caractères illisibles que lisibles |
| **Contenu vide** | `TRIM(content) = ''` | Seulement des espaces/retours à la ligne |
| **Status** | `status = 'error'` | Document non traité correctement |

## 🗑️ Étape 2 : Nettoyer de manière ciblée

### Option A : Suppression progressive (recommandée)

Décommentez et exécutez une par une les requêtes de la **PARTIE 2** :

```sql
-- 1. D'abord, supprimer les documents en erreur
DELETE FROM knowledge_documents
WHERE status = 'error';

-- 2. Ensuite, supprimer les chunks trop courts
DELETE FROM knowledge_chunks
WHERE content_length < 30;

-- 3. Puis les chunks vides
DELETE FROM knowledge_chunks
WHERE TRIM(content) = '' OR content ~ '^[\s\n\r\t]+$';

-- 4. Enfin, nettoyer les documents orphelins
DELETE FROM knowledge_documents
WHERE id NOT IN (SELECT DISTINCT document_id FROM knowledge_chunks);
```

### Option B : Nettoyage complet en une fois

⚠️ **ATTENTION : Cette opération est irréversible !**

Décommentez et exécutez toute la **PARTIE 3** :

```sql
BEGIN;

-- Supprime tous les chunks problématiques
DELETE FROM knowledge_chunks
WHERE
  content_length < 30
  OR TRIM(content) = ''
  OR content ~ '^[\s\n\r\t]+$'
  OR (
    content_length > 0
    AND LENGTH(REGEXP_REPLACE(content, '[a-zA-Z0-9àâäéèêëïîôùûüÿçÀÂÄÉÈÊËÏÎÔÙÛÜŸÇ\s]', '', 'g')) * 100.0 / NULLIF(content_length, 0) > 60
  );

-- Met à jour les compteurs
UPDATE knowledge_documents kd
SET chunks_count = (
  SELECT COUNT(*)
  FROM knowledge_chunks kc
  WHERE kc.document_id = kd.id
);

-- Supprime les documents vides
DELETE FROM knowledge_documents
WHERE chunks_count = 0 OR status = 'error';

COMMIT;
```

## ✅ Étape 3 : Vérifier le résultat

Exécutez la **PARTIE 4** pour confirmer le nettoyage :

```sql
SELECT
  'Documents restants' as metric,
  COUNT(*) as count
FROM knowledge_documents
WHERE status = 'indexed'
UNION ALL
SELECT
  'Chunks restants' as metric,
  COUNT(*) as count
FROM knowledge_chunks;
```

## 🔧 Personnalisation des seuils

Vous pouvez ajuster les seuils selon vos besoins :

```sql
-- Exemple : être plus strict (supprimer les chunks < 100 caractères)
DELETE FROM knowledge_chunks
WHERE content_length < 100;

-- Exemple : être plus permissif (garder les chunks avec 70% de caractères spéciaux)
DELETE FROM knowledge_chunks
WHERE content_length > 0
  AND LENGTH(REGEXP_REPLACE(content, '[a-zA-Z0-9àâäéèêëïîôùûüÿçÀÂÄÉÈÊËÏÎÔÙÛÜŸÇ\s]', '', 'g')) * 100.0 / NULLIF(content_length, 0) > 70;
```

## 📈 Statistiques typiques

Après nettoyage, vous devriez observer :

- ✅ **0 documents** avec `status = 'error'`
- ✅ **Longueur moyenne des chunks** : 500-2000 caractères
- ✅ **Ratio de caractères lisibles** : > 70%
- ✅ **Tous les documents** ont au moins 1 chunk

## ⚠️ Précautions

1. **Sauvegardez** votre base avant nettoyage :
   ```bash
   pg_dump "postgresql://..." > backup_before_cleanup.sql
   ```

2. **Testez** d'abord sur un environnement de développement

3. **Analysez** les résultats de la PARTIE 1 avant de supprimer

4. **Utilisez BEGIN/COMMIT** pour pouvoir faire ROLLBACK en cas d'erreur

## 🔄 Automatisation

Pour éviter d'accumuler des contenus problématiques, vous pouvez :

1. **Améliorer l'OCR** : voir `supabase/functions/ingest-document-standalone/index.ts`
2. **Valider à l'ingestion** : rejeter les documents avec trop peu de contenu
3. **Monitorer** : créer des alertes sur le nombre de documents en erreur

## 📞 Support

En cas de problème :
- Vérifiez les logs Supabase
- Consultez les `processing_error` dans `knowledge_documents`
- Testez manuellement l'OCR sur un document problématique
