# 🚀 Déploiement Manuel - Guide Ultra-Simple

**Durée** : 5 minutes
**Date** : 2025-11-25

---

## ✅ ÉTAPE 1 : Appliquer la Migration SQL (2 minutes)

### 1. Ouvrir le SQL Editor

Allez sur : https://supabase.com/dashboard/project/zvxasiwahpraasjzfhhl/sql/new

### 2. Copier le SQL

Ouvrez le fichier : `supabase/migrations/003_company_data_cache.sql`

**OU** copiez directement depuis GitHub :
https://github.com/torp-fr/quote-insight-tally/blob/claude/configure-company-search-01Be9mHyZZNNd2KUWVjowoFs/supabase/migrations/003_company_data_cache.sql

### 3. Coller et Exécuter

1. Copiez **TOUT le contenu** du fichier SQL (446 lignes)
2. Collez dans le SQL Editor de Supabase
3. Cliquez sur **"Run"** (ou Ctrl+Enter)

**Résultat attendu** :
```
Success. No rows returned
```

### 4. Vérifier

Allez dans : Database → Tables

Vous devriez maintenant voir :
- ✅ `company_data_cache`
- ✅ `company_search_history`

---

## ✅ ÉTAPE 2 : Déployer les Edge Functions (3 minutes)

### Option A : Via Supabase Dashboard (Recommandé)

#### Fonction 1 : refresh-company-cache

1. Allez sur : https://supabase.com/dashboard/project/zvxasiwahpraasjzfhhl/functions
2. Cliquez "Create a new function"
3. Nom : `refresh-company-cache`
4. Copiez le code depuis : `supabase/functions/refresh-company-cache/index.ts`
5. Cliquez "Deploy function"

#### Fonction 2 : cleanup-company-cache

1. Cliquez "Create a new function"
2. Nom : `cleanup-company-cache`
3. Copiez le code depuis : `supabase/functions/cleanup-company-cache/index.ts`
4. Cliquez "Deploy function"

#### Fonction 3 : test-company-search

1. Cliquez "Create a new function"
2. Nom : `test-company-search`
3. Copiez le code depuis : `supabase/functions/test-company-search/index.ts`
4. Cliquez "Deploy function"

### Option B : Via GitHub Actions (Alternative)

Les workflows GitHub Actions sont déjà configurés, mais ils échouent actuellement.

**Pour les faire fonctionner** :

1. Allez sur : https://github.com/torp-fr/quote-insight-tally/settings/secrets/actions

2. Vérifiez/Mettez à jour ces secrets :

   - **SUPABASE_ACCESS_TOKEN** = `sbp_d4b4dffb68c525feaf59577f0c427f2d2f49dea6`
   - **SUPABASE_PROJECT_ID** = `zvxasiwahpraasjzfhhl`
   - **SUPABASE_DB_PASSWORD** = `m0UHSGV7nHJizOr4`

3. Relancez le workflow :
   - GitHub Actions → Deploy Company Search System → Re-run all jobs

---

## ✅ ÉTAPE 3 : Configurer les Secrets Supabase (1 minute)

1. Allez sur : https://supabase.com/dashboard/project/zvxasiwahpraasjzfhhl/settings/functions

2. Cliquez sur "Edge Function Secrets"

3. Ajoutez ces 2 secrets :

   **Secret 1** :
   ```
   Name: CLAUDE_API_KEY
   Value: votre_claude_api_key
   ```

   **Secret 2** :
   ```
   Name: PAPPERS_API_KEY
   Value: b02fe90a049bef5a160c7f4abc5d67f0c7ffcd71f4d11bbe
   ```

4. Cliquez "Save"

---

## 🧪 ÉTAPE 4 : Tester (2 minutes)

### Test 1 : Vérifier les Tables

Database → Tables → Cherchez :
- `company_data_cache`
- `company_search_history`

### Test 2 : Tester la Fonction

Edge Functions → `test-company-search` → Invoke

**Résultat attendu** :
```json
{
  "success": true,
  "totalTests": 13,
  "passed": 13
}
```

### Test 3 : Vérifier les Fonctions PostgreSQL

SQL Editor → Exécutez :
```sql
SELECT proname
FROM pg_proc
WHERE proname LIKE '%company%cache%'
ORDER BY proname;
```

**Résultat attendu** (5 fonctions) :
- `clean_expired_company_cache`
- `get_cached_company_data`
- `increment_company_cache_fetch_count`
- `should_refresh_company_cache`
- `upsert_company_cache`

---

## 📊 RÉSUMÉ

```
ÉTAPE 1 : Migration SQL        → 2 min
ÉTAPE 2 : Edge Functions       → 3 min
ÉTAPE 3 : Secrets Supabase     → 1 min
ÉTAPE 4 : Tests                → 2 min
───────────────────────────────────────
TOTAL                          → 8 min
```

---

## 🎯 CHECKLIST FINALE

Après avoir terminé, vous devriez avoir :

- [x] 2 nouvelles tables dans Database
- [x] 5 nouvelles fonctions PostgreSQL
- [x] 3 Edge Functions déployées
- [x] 2 secrets configurés
- [x] Tests passent (13/13)

---

## 🔗 LIENS DIRECTS

- **SQL Editor** : https://supabase.com/dashboard/project/zvxasiwahpraasjzfhhl/sql/new
- **Edge Functions** : https://supabase.com/dashboard/project/zvxasiwahpraasjzfhhl/functions
- **Tables** : https://supabase.com/dashboard/project/zvxasiwahpraasjzfhhl/editor
- **Secrets** : https://supabase.com/dashboard/project/zvxasiwahpraasjzfhhl/settings/functions

---

## ❓ BESOIN D'AIDE ?

Si vous rencontrez un problème à une étape, partagez-moi :
1. Le numéro de l'étape
2. Le message d'erreur exact
3. Je vous guiderai pour corriger immédiatement

---

**Commencez par l'ÉTAPE 1 - C'est très simple ! 🚀**
