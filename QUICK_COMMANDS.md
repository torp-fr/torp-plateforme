# ⚡ Commandes Rapides - Système de Recherche d'Entreprise

Commandes fréquemment utilisées pour gérer le système au quotidien.

---

## 🚀 Déploiement Initial

```bash
# Déploiement complet (script automatique)
./deploy-company-search.sh

# Ou manuellement
supabase db push
supabase secrets set PAPPERS_API_KEY=b02fe90a049bef5a160c7f4abc5d67f0c7ffcd71f4d11bbe
supabase functions deploy refresh-company-cache --no-verify-jwt
supabase functions deploy cleanup-company-cache --no-verify-jwt
supabase functions deploy test-company-search --no-verify-jwt
```

---

## 🧪 Tests

```bash
# Test complet du système
supabase functions invoke test-company-search --no-verify-jwt

# Ou via curl
curl https://YOUR_PROJECT.supabase.co/functions/v1/test-company-search \
  -H "Authorization: Bearer YOUR_ANON_KEY"
```

---

## 🔄 Rafraîchissement du Cache

```bash
# Rafraîchir 50 entreprises (mode automatique)
curl -X POST https://YOUR_PROJECT.supabase.co/functions/v1/refresh-company-cache \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{"maxCompanies": 50}'

# Rafraîchir une entreprise spécifique (par SIRET)
curl -X POST https://YOUR_PROJECT.supabase.co/functions/v1/refresh-company-cache \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{"sirets": ["73282932000074"]}'

# Force refresh de toutes les entreprises (batch 100)
curl -X POST https://YOUR_PROJECT.supabase.co/functions/v1/refresh-company-cache \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{"maxCompanies": 100, "forceAll": true}'
```

---

## 🧹 Nettoyage du Cache

```bash
# Dry run (preview des suppressions)
curl -X POST https://YOUR_PROJECT.supabase.co/functions/v1/cleanup-company-cache \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{"dryRun": true}'

# Cleanup réel
curl -X POST https://YOUR_PROJECT.supabase.co/functions/v1/cleanup-company-cache \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{"dryRun": false}'
```

---

## 📊 Monitoring & Statistiques

### Via Supabase SQL Editor

```sql
-- Cache hit rate (7 derniers jours)
SELECT
  COUNT(*) FILTER (WHERE cache_hit)::float / COUNT(*) * 100 as hit_rate_pct,
  COUNT(*) as total_searches,
  COUNT(*) FILTER (WHERE cache_hit) as cache_hits,
  COUNT(*) FILTER (WHERE NOT cache_hit) as cache_misses,
  AVG(response_time_ms) as avg_response_ms
FROM company_search_history
WHERE created_at > NOW() - INTERVAL '7 days';
```

```sql
-- Statistiques du cache
SELECT
  COUNT(*) as total_entries,
  AVG(fetch_count) as avg_fetch_count,
  AVG(quality_score) as avg_quality_score,
  COUNT(*) FILTER (WHERE refresh_strategy = 'frequent') as frequent_refresh,
  COUNT(*) FILTER (WHERE NOW() > next_refresh_at) as needs_refresh_now
FROM company_data_cache;
```

```sql
-- Top 10 entreprises les plus sollicitées
SELECT
  siret,
  company_name,
  fetch_count,
  quality_score,
  EXTRACT(EPOCH FROM (NOW() - last_fetched_at)) / 86400 as age_days,
  refresh_strategy
FROM company_data_cache
ORDER BY fetch_count DESC
LIMIT 10;
```

```sql
-- Entreprises nécessitant un rafraîchissement
SELECT
  siret,
  company_name,
  fetch_count,
  EXTRACT(EPOCH FROM (NOW() - last_fetched_at)) / 86400 as age_days,
  next_refresh_at,
  refresh_strategy
FROM company_data_cache
WHERE should_refresh_company_cache(siret) = true
ORDER BY next_refresh_at ASC
LIMIT 20;
```

```sql
-- Historique des recherches (dernières 24h)
SELECT
  DATE_TRUNC('hour', created_at) as hour,
  COUNT(*) as total_searches,
  COUNT(*) FILTER (WHERE cache_hit) as cache_hits,
  COUNT(*) FILTER (WHERE found) as found,
  AVG(response_time_ms) as avg_response_ms
FROM company_search_history
WHERE created_at > NOW() - INTERVAL '24 hours'
GROUP BY hour
ORDER BY hour DESC;
```

---

## 🔐 Gestion des Secrets

```bash
# Lister les secrets configurés
supabase secrets list

# Ajouter/Modifier un secret
supabase secrets set SECRET_NAME=value

# Secrets requis
supabase secrets set CLAUDE_API_KEY=sk-ant-...
supabase secrets set PAPPERS_API_KEY=b02fe90a049bef5a160c7f4abc5d67f0c7ffcd71f4d11bbe

# Supprimer un secret
supabase secrets unset SECRET_NAME
```

---

## 📝 Logs

```bash
# Logs en temps réel (toutes fonctions)
supabase functions logs --follow

# Logs d'une fonction spécifique
supabase functions logs refresh-company-cache
supabase functions logs cleanup-company-cache
supabase functions logs test-company-search

# Logs avec limite
supabase functions logs refresh-company-cache --limit 50

# Logs avec filtre de temps
supabase functions logs refresh-company-cache --since 1h
```

---

## 🗄️ Database

```bash
# Connexion à la DB
supabase db remote

# Exécuter une requête SQL
supabase db remote query "SELECT COUNT(*) FROM company_data_cache;"

# Backup de la DB
supabase db dump -f backup.sql

# Reset de la DB (DANGER)
supabase db reset
```

---

## 🔄 Redéploiement

```bash
# Redéployer une fonction après modification
supabase functions deploy refresh-company-cache --no-verify-jwt

# Redéployer toutes les fonctions
supabase functions deploy refresh-company-cache --no-verify-jwt && \
supabase functions deploy cleanup-company-cache --no-verify-jwt && \
supabase functions deploy test-company-search --no-verify-jwt
```

---

## 🧹 Maintenance Manuelle

### Forcer le rafraîchissement d'une entreprise

```sql
-- Marquer une entreprise comme expirée
UPDATE company_data_cache
SET refresh_strategy = 'expired',
    next_refresh_at = NOW()
WHERE siret = '73282932000074';
```

### Supprimer une entreprise du cache

```sql
-- Supprimer une entrée spécifique
DELETE FROM company_data_cache
WHERE siret = '73282932000074';
```

### Vider complètement le cache

```sql
-- DANGER : Supprime toutes les données en cache
TRUNCATE company_data_cache;
TRUNCATE company_search_history;
```

### Réinitialiser les compteurs

```sql
-- Reset fetch_count pour toutes les entreprises
UPDATE company_data_cache
SET fetch_count = 0;
```

---

## 📦 Sauvegarde & Restauration

```bash
# Sauvegarder uniquement les tables du cache
supabase db dump --data-only \
  --table company_data_cache \
  --table company_search_history \
  -f cache_backup_$(date +%Y%m%d).sql

# Restaurer depuis une sauvegarde
psql -h db.YOUR_PROJECT.supabase.co \
     -U postgres \
     -d postgres \
     -f cache_backup_20250124.sql
```

---

## 🎯 Commandes de Debug

```bash
# Tester l'extraction SIRET
echo "SIRET: 732 829 320 00074" | \
  supabase functions invoke test-company-search --no-verify-jwt

# Tester la recherche Pappers
curl -X GET "https://api.pappers.fr/v2/entreprise?api_token=YOUR_KEY&siren=732829320"

# Vérifier la connexion Supabase
supabase status

# Vérifier les variables d'environnement
supabase secrets list
```

---

## 🔧 Utilitaires

### Générer un rapport de cache

```sql
-- Rapport complet du cache
SELECT
  'Cache Statistics' as section,
  COUNT(*) as total_entries,
  AVG(fetch_count) as avg_fetch,
  AVG(quality_score) as avg_quality,
  COUNT(*) FILTER (WHERE cache_hit) as cache_hits
FROM company_data_cache
UNION ALL
SELECT
  'Search History (7d)',
  COUNT(*),
  AVG(response_time_ms),
  NULL,
  COUNT(*) FILTER (WHERE cache_hit)
FROM company_search_history
WHERE created_at > NOW() - INTERVAL '7 days';
```

### Exporter les données pour analyse

```sql
-- Export CSV des entreprises en cache
COPY (
  SELECT
    siret,
    company_name,
    quality_score,
    fetch_count,
    last_fetched_at,
    refresh_strategy
  FROM company_data_cache
  ORDER BY fetch_count DESC
) TO '/tmp/company_cache_export.csv' CSV HEADER;
```

---

## 📱 Raccourcis Alias (Optionnel)

Ajoutez dans votre `~/.bashrc` ou `~/.zshrc` :

```bash
# Aliases Supabase Company Search
alias sbc-test='supabase functions invoke test-company-search --no-verify-jwt'
alias sbc-refresh='curl -X POST https://YOUR_PROJECT.supabase.co/functions/v1/refresh-company-cache -H "Authorization: Bearer YOUR_KEY" -H "Content-Type: application/json" -d "{\"maxCompanies\": 50}"'
alias sbc-cleanup='curl -X POST https://YOUR_PROJECT.supabase.co/functions/v1/cleanup-company-cache -H "Authorization: Bearer YOUR_KEY" -H "Content-Type: application/json" -d "{\"dryRun\": false}"'
alias sbc-logs='supabase functions logs --follow'
alias sbc-stats='supabase db remote query "SELECT COUNT(*) as total, AVG(quality_score) as avg_quality FROM company_data_cache;"'
```

---

## 🆘 Troubleshooting Rapide

```bash
# Problème : Tests échouent
supabase secrets list | grep -E "(CLAUDE|PAPPERS)"
supabase db remote query "SELECT COUNT(*) FROM company_data_cache;"

# Problème : Fonction ne répond pas
supabase functions logs refresh-company-cache --limit 20

# Problème : Cache ne fonctionne pas
supabase db remote query "SELECT * FROM company_data_cache LIMIT 5;"

# Problème : Migration non appliquée
supabase migration list
supabase db push
```

---

**📌 Commandes à exécuter régulièrement** :

- **Quotidien** : `sbc-refresh` (ou via cron)
- **Hebdomadaire** : `sbc-cleanup` + vérifier `sbc-stats`
- **Mensuel** : Analyser les logs et optimiser le cache

---

**Bon développement !** ⚡
