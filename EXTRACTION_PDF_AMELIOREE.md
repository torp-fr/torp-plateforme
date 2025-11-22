# 📖 Extraction PDF Améliorée - Texte Lisible

## ❌ Problème identifié

L'extraction PDF basique produisait du **charabia binaire** au lieu de texte lisible :

```
Mendstream alQ%dSXfax- endstream (\000\000\000\377\377\377...
```

**Cause :** Regex primitives qui extrayaient les streams PDF internes au lieu du texte.

## ✅ Solution : pdf.js

Nouvelle version utilisant **pdf.js** - la vraie bibliothèque Mozilla pour parser les PDFs.

### Stratégie d'extraction (par ordre de priorité)

1. **pdf.js** (priorité) → Texte propre et lisible
2. **Fallback amélioré** → Si pdf.js échoue, utilise extraction basique améliorée avec :
   - Détection UTF-8 vs Latin1
   - Décodage des séquences d'échappement (`\n`, `\t`, etc.)
   - Filtrage des objets PDF internes

### Logs attendus

```
[OCR] Using pdf.js for text extraction
[OCR] ✅ Extracted 25432 characters from 15 pages
```

Au lieu de :
```
[OCR] Using basic PDF text extraction
```

## 🚀 DÉPLOIEMENT URGENT

### Étape 1 : Déployer sur Supabase

**Option A - Dashboard (RECOMMANDÉ)**

1. Allez sur https://app.supabase.com
2. Votre projet → **Edge Functions**
3. Cliquez sur **`ingest-document-standalone`**
4. **COPIEZ** le nouveau code depuis :
   - Fichier local : `supabase/functions/ingest-document-standalone/index.ts` (709 lignes)
   - OU GitHub : `supabase/functions/ingest-document-standalone-COPIER-COLLER.ts`
5. **REMPLACEZ** tout le code actuel
6. **SAUVEGARDEZ** et **DÉPLOYEZ**
7. Répétez pour **`ingest-document`** (même code)

**Option B - CLI (si disponible localement)**

```bash
git pull origin claude/fix-railway-errors-01UVb1eK5A6yZqDPPysftDEJ
supabase functions deploy ingest-document-standalone
supabase functions deploy ingest-document
```

### Étape 2 : Nettoyer les anciens chunks illisibles

Les documents déjà traités contiennent du charabia binaire. Il faut les supprimer.

**Via Supabase SQL Editor :**

```sql
-- OPTION 1 : Supprimer TOUS les chunks et documents existants
-- (À utiliser si tous vos documents sont illisibles)
TRUNCATE TABLE knowledge_chunks;
UPDATE knowledge_documents SET
  status = 'pending',
  chunks_count = 0,
  indexed_at = NULL;

-- OPTION 2 : Supprimer seulement les chunks illisibles
-- (Garde les documents, permet de les re-traiter)
DELETE FROM knowledge_chunks
WHERE content LIKE '%endstream%'
   OR content LIKE '%\000%'
   OR content LIKE '%\377%';

UPDATE knowledge_documents SET
  status = 'pending',
  chunks_count = 0,
  indexed_at = NULL
WHERE id IN (
  SELECT DISTINCT document_id
  FROM knowledge_chunks
  WHERE content LIKE '%endstream%'
);

-- OPTION 3 : Vérifier d'abord combien de chunks sont affectés
SELECT
  COUNT(*) as total_chunks,
  SUM(CASE WHEN content LIKE '%endstream%' THEN 1 ELSE 0 END) as garbage_chunks,
  SUM(CASE WHEN content LIKE '%endstream%' THEN 0 ELSE 1 END) as clean_chunks
FROM knowledge_chunks;
```

### Étape 3 : Re-traiter les documents

Une fois les chunks nettoyés :

1. **Via votre interface** : Re-uploadez les PDFs
2. **Via API** : Appelez l'action `process` pour chaque document en status `pending`

```typescript
// Exemple d'appel API
await fetch('https://YOUR_PROJECT.supabase.co/functions/v1/ingest-document-standalone', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
  },
  body: JSON.stringify({
    action: 'process',
    documentId: 'YOUR_DOC_ID'
  })
});
```

## 📊 Vérification

Après re-traitement, vérifiez que le contenu est lisible :

```sql
-- Voir un échantillon du nouveau contenu
SELECT
  id,
  LEFT(content, 200) as preview,
  LENGTH(content) as length,
  metadata->>'method' as extraction_method
FROM knowledge_chunks
ORDER BY created_at DESC
LIMIT 5;
```

**Vous devriez voir** :
- `extraction_method` = `"pdf.js"` ou `"Extraction basique (fallback)"`
- `preview` = du texte français lisible
- Pas de `\000`, `\377`, `endstream`, etc.

## ⚠️ Notes importantes

1. **pdf.js peut échouer** sur certains PDFs (sécurisés, corrompus)
   - Dans ce cas, le fallback amélioré sera utilisé
   - Si le fallback produit aussi du charabia → convertissez en images PNG

2. **PDFs scannés** (images dans un PDF)
   - pdf.js ne fera pas d'OCR
   - Le système suggèrera de convertir en images pour OpenAI Vision

3. **Performance**
   - pdf.js est plus lent que la méthode basique (~2-5 secondes par PDF)
   - Mais produit du texte LISIBLE

## 🎯 Résultat attendu

**Avant :**
```
content: "Mendstream alQ%dSXfax- endstream (\000\000\000..."
```

**Après :**
```
content: "NF DTU 25.41 P2 - Décembre 2012
Travaux de bâtiment - Ouvrages en plaques de plâtre
Plaques face cartonnées - Partie 2: Cahier des clauses..."
```

---

**Déployez maintenant et re-traitez vos documents pour avoir du texte lisible ! 🚀**
