# 🚀 Guide de Déploiement - Système de Recherche d'Entreprise

## Méthode Rapide (Automatique)

```bash
# Depuis la racine du projet
./deploy-company-search.sh
```

Le script vous guidera à travers toutes les étapes automatiquement.

---

## Méthode Manuelle (Étape par Étape)

### Prérequis

1. **Installer Supabase CLI** (si pas déjà fait) :

```bash
# macOS
brew install supabase/tap/supabase

# npm
npm install -g supabase

# Linux
# Voir https://supabase.com/docs/guides/cli
```

2. **Se connecter à Supabase** :

```bash
supabase login
```

3. **Lier le projet** (si pas déjà fait) :

```bash
supabase link --project-ref YOUR_PROJECT_ID
```

---

## 📋 Étape 1 : Vérifier les Migrations

```bash
# Lister les migrations disponibles
supabase migration list

# Devrait afficher :
# 001_initial_schema.sql
# 002_knowledge_base_pgvector.sql
# 003_company_data_cache.sql ← NOUVEAU
```

---

## 🗄️ Étape 2 : Appliquer la Migration

### Option A : Via Supabase CLI (Recommandé)

```bash
# Appliquer toutes les migrations en attente
supabase db push

# Ou appliquer une migration spécifique
supabase migration up
```

**Vérification** :

```bash
# Vérifier que la table existe
supabase db remote query "
  SELECT table_name
  FROM information_schema.tables
  WHERE table_schema = 'public'
  AND table_name IN ('company_data_cache', 'company_search_history');
"
# Devrait retourner 2 lignes
```

```bash
# Vérifier que les fonctions existent
supabase db remote query "
  SELECT proname
  FROM pg_proc
  WHERE proname LIKE '%company%'
  ORDER BY proname;
"
# Devrait retourner 5 fonctions :
# - clean_expired_company_cache
# - get_cached_company_data
# - increment_company_cache_fetch_count
# - should_refresh_company_cache
# - upsert_company_cache
```

### Option B : Via Supabase Dashboard

1. Aller sur https://supabase.com/dashboard/project/YOUR_PROJECT_ID/sql
2. Ouvrir `supabase/migrations/003_company_data_cache.sql`
3. Copier tout le contenu
4. Coller dans l'éditeur SQL
5. Cliquer sur "Run"

**Vérification** :
- Aller dans l'onglet "Table Editor"
- Vérifier que `company_data_cache` et `company_search_history` existent

---

## 🔐 Étape 3 : Configurer les Secrets

### Secrets OBLIGATOIRES

```bash
# CLAUDE_API_KEY (pour extraction SIRET intelligente)
supabase secrets set CLAUDE_API_KEY=sk-ant-xxxxxxxxxxxxx

# SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY sont déjà configurés automatiquement
```

### Secrets OPTIONNELS (mais recommandés)

```bash
# PAPPERS_API_KEY (votre clé personnelle)
supabase secrets set PAPPERS_API_KEY=b02fe90a049bef5a160c7f4abc5d67f0c7ffcd71f4d11bbe

# API_ENTREPRISE (optionnel - pour endpoints authentifiés)
supabase secrets set API_ENTREPRISE_TOKEN=your_token_here
supabase secrets set API_ENTREPRISE_RECIPIENT=your_siret
```

**Vérification** :

```bash
# Lister tous les secrets configurés
supabase secrets list
```

---

## 🚀 Étape 4 : Déployer les Edge Functions

### 4.1 Fonction de Rafraîchissement

```bash
supabase functions deploy refresh-company-cache --no-verify-jwt
```

**Résultat attendu** :
```
✓ Deployed Function refresh-company-cache on project YOUR_PROJECT_ID
✓ URL: https://YOUR_PROJECT_ID.supabase.co/functions/v1/refresh-company-cache
```

### 4.2 Fonction de Nettoyage

```bash
supabase functions deploy cleanup-company-cache --no-verify-jwt
```

### 4.3 Fonction de Test

```bash
supabase functions deploy test-company-search --no-verify-jwt
```

### Déployer Toutes les Fonctions en Une Fois

```bash
# Déployer les 3 fonctions
supabase functions deploy refresh-company-cache --no-verify-jwt && \
supabase functions deploy cleanup-company-cache --no-verify-jwt && \
supabase functions deploy test-company-search --no-verify-jwt
```

---

## 🧪 Étape 5 : Tester le Système

### Test 1 : Suite de Tests Complète

```bash
# Via Supabase CLI
supabase functions invoke test-company-search --no-verify-jwt
```

**Ou via curl** :

```bash
curl https://YOUR_PROJECT_ID.supabase.co/functions/v1/test-company-search \
  -H "Authorization: Bearer YOUR_ANON_KEY"
```

**Résultat attendu** :

```json
{
  "totalTests": 12,
  "totalPassed": 12,
  "totalFailed": 0,
  "passRate": "100.00%",
  "suites": [...]
}
```

### Test 2 : Rafraîchissement Manuel

```bash
curl -X POST https://YOUR_PROJECT_ID.supabase.co/functions/v1/refresh-company-cache \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{"maxCompanies": 5}'
```

**Résultat attendu** :

```json
{
  "success": true,
  "refreshed": 0,
  "failed": 0,
  "skipped": 0,
  "errors": []
}
```

### Test 3 : Nettoyage (Dry Run)

```bash
curl -X POST https://YOUR_PROJECT_ID.supabase.co/functions/v1/cleanup-company-cache \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{"dryRun": true}'
```

---

## 🔍 Vérification Post-Déploiement

### 1. Vérifier les Logs

```bash
# Logs en temps réel
supabase functions logs --follow

# Logs d'une fonction spécifique
supabase functions logs refresh-company-cache
```

### 2. Vérifier la Base de Données

```sql
-- Nombre d'entrées dans le cache
SELECT COUNT(*) FROM company_data_cache;

-- Historique des recherches
SELECT COUNT(*) FROM company_search_history;

-- Vérifier les index
SELECT
  tablename,
  indexname
FROM pg_indexes
WHERE tablename LIKE 'company%';
```

### 3. Dashboard Supabase

Aller sur https://supabase.com/dashboard/project/YOUR_PROJECT_ID

- ✅ **Table Editor** → Vérifier `company_data_cache` et `company_search_history`
- ✅ **Edge Functions** → Vérifier que les 3 fonctions sont déployées
- ✅ **Logs** → Vérifier qu'il n'y a pas d'erreurs

---

## 🛠️ Troubleshooting

### Problème : "Migration already applied"

**Solution** : C'est normal si vous avez déjà appliqué la migration.

```bash
# Vérifier l'état des migrations
supabase migration list
```

### Problème : "Function deployment failed"

**Causes possibles** :
1. Secrets non configurés
2. Erreur de syntaxe TypeScript
3. Dépendances manquantes

**Solutions** :

```bash
# 1. Vérifier les secrets
supabase secrets list

# 2. Tester localement
supabase functions serve test-company-search

# 3. Voir les logs détaillés
supabase functions logs test-company-search --limit 50
```

### Problème : "Cannot find module"

**Cause** : Import incorrect dans les Edge Functions

**Solution** :

```bash
# Redéployer avec --no-verify-jwt
supabase functions deploy FUNCTION_NAME --no-verify-jwt
```

### Problème : Tests échouent

**Vérifications** :

```bash
# 1. PAPPERS_API_KEY configuré ?
supabase secrets list | grep PAPPERS

# 2. CLAUDE_API_KEY configuré ?
supabase secrets list | grep CLAUDE

# 3. Migration appliquée ?
supabase db remote query "SELECT * FROM company_data_cache LIMIT 1;"
```

---

## 📊 Vérifier les Performances

### Après 24h

```sql
-- Cache hit rate
SELECT
  COUNT(*) FILTER (WHERE cache_hit)::float / COUNT(*) * 100 as hit_rate,
  AVG(response_time_ms) as avg_response
FROM company_search_history
WHERE created_at > NOW() - INTERVAL '24 hours';
```

### Après 1 semaine

```sql
-- Statistiques globales
SELECT
  COUNT(*) as total_cached,
  AVG(fetch_count) as avg_usage,
  AVG(quality_score) as avg_quality
FROM company_data_cache;
```

---

## 🎯 Prochaines Étapes

### 1. Configurer le Cron Job (Optionnel mais recommandé)

Voir `docs/QUICKSTART_COMPANY_SEARCH.md` section "Configuration du Cron"

**Recommandations** :
- **Refresh** : Quotidien à 2h du matin
- **Cleanup** : Hebdomadaire le dimanche à 3h

### 2. Configurer le Monitoring

- Alertes sur cache hit rate < 80%
- Alertes sur error rate > 5%
- Dashboard Grafana/Metabase (optionnel)

### 3. Tester en Production

1. Uploader un devis PDF
2. Vérifier que le SIRET est extrait
3. Vérifier que les données entreprise sont récupérées
4. Vérifier le scoring TORP enrichi

---

## 📚 Documentation Complète

- **Architecture** : `docs/ARCHITECTURE_COMPANY_SEARCH.md`
- **Quick Start** : `docs/QUICKSTART_COMPANY_SEARCH.md`
- **README** : `docs/COMPANY_SEARCH_README.md`

---

## ✅ Checklist de Déploiement

- [ ] Migration database appliquée
- [ ] Tables `company_data_cache` et `company_search_history` créées
- [ ] 5 fonctions PostgreSQL créées
- [ ] Secrets configurés (CLAUDE_API_KEY, PAPPERS_API_KEY)
- [ ] 3 Edge Functions déployées
- [ ] Tests passent (12/12)
- [ ] Logs sans erreurs
- [ ] Cron job configuré (optionnel)

---

## 🆘 Support

En cas de problème :

1. **Vérifier les logs** : `supabase functions logs`
2. **Consulter la doc** : `docs/COMPANY_SEARCH_README.md`
3. **Vérifier les secrets** : `supabase secrets list`
4. **Tester localement** : `supabase functions serve`

---

**Bon déploiement !** 🚀
