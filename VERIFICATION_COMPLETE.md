# ✅ VÉRIFICATION COMPLÈTE DU DÉPLOIEMENT

**Date** : 2025-11-25
**Projet** : Système de Recherche d'Entreprise avec Cache Intelligent

---

## 📋 CHECKLIST DE VÉRIFICATION

Suivez ces vérifications une par une et cochez ce qui fonctionne :

---

## 1️⃣ VÉRIFICATION BASE DE DONNÉES

### A. Tables Créées

**Allez sur** : https://supabase.com/dashboard/project/zvxasiwahpraasjzfhhl/editor

**Cherchez ces tables dans la liste** :

- [ ] `company_data_cache` existe
- [ ] `company_search_history` existe

**Si les tables existent** ✅ → Passez à la vérification B

**Si les tables n'existent pas** ❌ → La migration SQL n'a pas été appliquée correctement. Retournez à l'ÉTAPE 1.

---

### B. Fonctions PostgreSQL Créées

**Allez sur** : https://supabase.com/dashboard/project/zvxasiwahpraasjzfhhl/sql/new

**Exécutez cette requête** :

```sql
SELECT proname
FROM pg_proc
WHERE proname LIKE '%company%cache%'
ORDER BY proname;
```

**Résultats attendus (5 fonctions)** :

- [ ] `clean_expired_company_cache`
- [ ] `get_cached_company_data`
- [ ] `increment_company_cache_fetch_count`
- [ ] `should_refresh_company_cache`
- [ ] `upsert_company_cache`

**Si vous voyez les 5 fonctions** ✅ → Base de données OK !

---

## 2️⃣ VÉRIFICATION EDGE FUNCTIONS

**Allez sur** : https://supabase.com/dashboard/project/zvxasiwahpraasjzfhhl/functions

**Cherchez ces fonctions dans la liste** :

- [ ] `refresh-company-cache` existe
- [ ] `cleanup-company-cache` existe
- [ ] `test-company-search` existe

**Si les 3 fonctions existent** ✅ → Edge Functions déployées !

**Si les fonctions n'existent pas** ❌ → Le workflow GitHub Actions a échoué ou n'a pas été relancé.

---

## 3️⃣ VÉRIFICATION SECRETS

### A. Secrets GitHub Actions

**Allez sur** : https://github.com/torp-fr/quote-insight-tally/settings/secrets/actions

**Vérifiez que ces secrets existent** :

- [ ] `SUPABASE_ACCESS_TOKEN` configuré
- [ ] `SUPABASE_PROJECT_ID` configuré
- [ ] `SUPABASE_DB_PASSWORD` configuré

---

### B. Secrets Supabase Edge Functions

**Allez sur** : https://supabase.com/dashboard/project/zvxasiwahpraasjzfhhl/settings/functions

**Cliquez sur "Edge Function Secrets"**

**Vérifiez que ces secrets existent** :

- [ ] `CLAUDE_API_KEY` configuré
- [ ] `PAPPERS_API_KEY` configuré

---

## 4️⃣ VÉRIFICATION WORKFLOW GITHUB ACTIONS

**Allez sur** : https://github.com/torp-fr/quote-insight-tally/actions

**Trouvez le dernier workflow "Deploy Company Search System"**

**Vérifiez le statut** :

- [ ] Le workflow a une **pastille verte** ✅ (Success)
- [ ] Toutes les étapes sont vertes (pas de rouge)

**Si le workflow est rouge** ❌ → Cliquez dessus, regardez quelle étape a échoué, et partagez-moi le message d'erreur.

---

## 5️⃣ TEST FONCTIONNEL

### A. Test de la Fonction de Tests

**Allez sur** : https://supabase.com/dashboard/project/zvxasiwahpraasjzfhhl/functions

**Cliquez sur** : `test-company-search`

**Cliquez sur** : "Invoke function"

**Résultat attendu** :

```json
{
  "success": true,
  "totalTests": 13,
  "passed": 13,
  "failed": 0,
  "duration": "1-2s",
  "results": [...]
}
```

- [ ] La fonction s'exécute sans erreur
- [ ] `"success": true`
- [ ] `"passed": 13`

**Si vous avez des erreurs** → Copiez le message d'erreur complet.

---

### B. Test du Cache (Vérifier que la table fonctionne)

**SQL Editor** : https://supabase.com/dashboard/project/zvxasiwahpraasjzfhhl/sql/new

**Exécutez** :

```sql
-- Vérifier que la table accepte des insertions
INSERT INTO company_data_cache (
  siret,
  siren,
  company_name,
  data_source,
  cached_data,
  quality_score
) VALUES (
  '12345678901234',
  '123456789',
  'Test Company',
  'manual',
  '{"test": true}'::jsonb,
  50
)
ON CONFLICT (siret) DO NOTHING;

-- Vérifier qu'on peut lire
SELECT siret, company_name, quality_score
FROM company_data_cache
WHERE siret = '12345678901234';

-- Nettoyer le test
DELETE FROM company_data_cache WHERE siret = '12345678901234';
```

**Résultat attendu** :

```
INSERT 0 1
siret          | company_name | quality_score
12345678901234 | Test Company | 50
DELETE 1
```

- [ ] L'insertion fonctionne
- [ ] La lecture fonctionne
- [ ] La suppression fonctionne

---

## 6️⃣ TEST AVEC UN VRAI DEVIS (Optionnel)

Si vous avez déjà l'application fonctionnelle :

1. **Uploadez un devis PDF** contenant un SIRET

2. **Vérifiez le cache** :

```sql
SELECT
  siret,
  company_name,
  data_source,
  quality_score,
  fetch_count,
  last_fetched_at,
  next_refresh_at
FROM company_data_cache
ORDER BY last_fetched_at DESC
LIMIT 5;
```

**Résultat attendu** :
- Vous devriez voir une entrée avec le SIRET du devis
- `data_source` = 'pappers' (ou autre)
- `quality_score` > 0
- `fetch_count` = 1

3. **Uploadez le même devis à nouveau**

4. **Vérifiez que `fetch_count` a augmenté** :

```sql
SELECT siret, company_name, fetch_count
FROM company_data_cache
WHERE siret = 'LE_SIRET_DU_DEVIS';
```

- [ ] Le cache se remplit après upload
- [ ] `fetch_count` augmente lors du 2ème upload (cache hit!)

---

## 📊 RÉSUMÉ DES VÉRIFICATIONS

### Base de Données
- [ ] 2 tables créées
- [ ] 5 fonctions PostgreSQL créées
- [ ] Tables fonctionnelles (insert/select/delete OK)

### Edge Functions
- [ ] 3 fonctions déployées
- [ ] Fonction `test-company-search` s'exécute
- [ ] Tests passent (13/13)

### Configuration
- [ ] 3 secrets GitHub configurés
- [ ] 2 secrets Supabase configurés

### Workflow
- [ ] Dernier workflow GitHub Actions vert ✅

### Tests Fonctionnels
- [ ] Cache fonctionne (insert/select)
- [ ] Test avec devis réel (optionnel)

---

## ✅ STATUT GLOBAL

Comptez vos ✅ :

- **20+ coches** : 🎉 **PARFAIT !** Le système est 100% opérationnel !
- **15-19 coches** : ⚠️ **Presque !** Quelques ajustements nécessaires
- **10-14 coches** : 🔧 **Partiel** - Il manque des composants importants
- **< 10 coches** : ❌ **Incomplet** - Revérifiez les étapes de déploiement

---

## 🚨 EN CAS DE PROBLÈME

### Tables n'apparaissent pas
→ La migration SQL n'a pas été appliquée. Retournez au SQL Editor et exécutez `003_company_data_cache.sql`

### Edge Functions n'apparaissent pas
→ Le workflow GitHub Actions a échoué. Vérifiez les secrets GitHub et relancez le workflow.

### Tests échouent
→ Les secrets Supabase (`CLAUDE_API_KEY`, `PAPPERS_API_KEY`) ne sont pas configurés correctement.

### Erreur "relation does not exist"
→ Les tables ne sont pas créées. Appliquez la migration SQL.

---

## 📞 PARTAGER LES RÉSULTATS

**Pour que je puisse confirmer que tout fonctionne, partagez-moi** :

1. **Nombre de coches total** : X/25

2. **Tables** :
   - `company_data_cache` : ✅ ou ❌
   - `company_search_history` : ✅ ou ❌

3. **Edge Functions** :
   - `refresh-company-cache` : ✅ ou ❌
   - `cleanup-company-cache` : ✅ ou ❌
   - `test-company-search` : ✅ ou ❌

4. **Test de la fonction** :
   - Résultat de l'invoke de `test-company-search` : ✅ ou ❌
   - Si erreur, copiez le message

5. **Workflow GitHub** :
   - Dernier workflow : 🟢 Vert ou 🔴 Rouge

---

**Suivez cette checklist et dites-moi les résultats ! 🚀**
