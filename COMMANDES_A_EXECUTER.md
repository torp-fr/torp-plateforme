# 📋 COMMANDES À EXÉCUTER - Copier/Coller

> **À exécuter sur VOTRE MACHINE LOCALE dans le répertoire du projet**

---

## ⚡ Méthode Rapide (Tout en Une Fois)

```bash
# 1. Pull les derniers changements
git pull origin claude/configure-company-search-01Be9mHyZZNNd2KUWVjowoFs

# 2. Lancer le guide interactif
./EXECUTE_DEPLOYMENT.sh
```

Le script vous guidera étape par étape. **Suivez les instructions à l'écran.**

---

## 📝 Méthode Manuelle (Commandes Individuelles)

Si vous préférez exécuter les commandes une par une :

### 0️⃣ Prérequis

```bash
# Vérifier que Supabase CLI est installé
supabase --version

# Se connecter à Supabase (si pas déjà fait)
supabase login

# Lier le projet (remplacez VOTRE_PROJECT_ID)
supabase link --project-ref VOTRE_PROJECT_ID
```

---

### 1️⃣ Migration Database

```bash
# Appliquer la migration
supabase db push
```

**Vérification** :
```bash
# Vérifier que les tables existent
supabase db remote query "
  SELECT table_name
  FROM information_schema.tables
  WHERE table_name LIKE 'company%';
"
# Attendu : 2 lignes (company_data_cache, company_search_history)

# Vérifier que les fonctions existent
supabase db remote query "
  SELECT proname
  FROM pg_proc
  WHERE proname LIKE '%company%'
  ORDER BY proname;
"
# Attendu : 5 fonctions
```

---

### 2️⃣ Configuration des Secrets

```bash
# Secret 1 : CLAUDE_API_KEY (OBLIGATOIRE)
# Remplacez par votre clé Claude : https://console.anthropic.com/settings/keys
supabase secrets set CLAUDE_API_KEY=sk-ant-VOTRE_CLÉ_ICI

# Secret 2 : PAPPERS_API_KEY (RECOMMANDÉ)
supabase secrets set PAPPERS_API_KEY=b02fe90a049bef5a160c7f4abc5d67f0c7ffcd71f4d11bbe
```

**Vérification** :
```bash
# Lister les secrets configurés
supabase secrets list
# Attendu : CLAUDE_API_KEY, PAPPERS_API_KEY, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
```

---

### 3️⃣ Déploiement des Edge Functions

```bash
# Fonction 1 : Rafraîchissement
supabase functions deploy refresh-company-cache --no-verify-jwt

# Fonction 2 : Nettoyage
supabase functions deploy cleanup-company-cache --no-verify-jwt

# Fonction 3 : Tests
supabase functions deploy test-company-search --no-verify-jwt
```

**Vérification** :
```bash
# Lister les fonctions déployées
supabase functions list
# Attendu : refresh-company-cache, cleanup-company-cache, test-company-search
```

---

### 4️⃣ Tests

```bash
# Lancer la suite de tests complète
supabase functions invoke test-company-search --no-verify-jwt
```

**Résultat attendu** :
```json
{
  "totalTests": 12,
  "totalPassed": 12,
  "totalFailed": 0,
  "passRate": "100.00%"
}
```

**Si des tests échouent** :
```bash
# Vérifier les logs
supabase functions logs test-company-search --limit 50

# Vérifier les secrets
supabase secrets list
```

---

### 5️⃣ Vérifications Post-Déploiement

```bash
# Vérifier le cache (devrait être vide au début)
supabase db remote query "SELECT COUNT(*) FROM company_data_cache;"

# Vérifier l'historique
supabase db remote query "SELECT COUNT(*) FROM company_search_history;"

# Voir les logs en temps réel
supabase functions logs --follow
```

---

## 🎯 Tests Manuels (Optionnel)

### Test 1 : Rafraîchissement Manuel

Obtenez votre `SUPABASE_URL` et `ANON_KEY` depuis :
Dashboard Supabase → Settings → API

```bash
# Remplacez YOUR_PROJECT et YOUR_ANON_KEY
curl -X POST https://YOUR_PROJECT.supabase.co/functions/v1/refresh-company-cache \
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
  "skipped": 0
}
```

### Test 2 : Nettoyage (Dry Run)

```bash
curl -X POST https://YOUR_PROJECT.supabase.co/functions/v1/cleanup-company-cache \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{"dryRun": true}'
```

---

## ⏰ Configuration Cron (Optionnel)

Créer `.github/workflows/company-cache-maintenance.yml` :

```yaml
name: Company Cache Maintenance

on:
  schedule:
    - cron: '0 2 * * *'   # Daily at 2 AM UTC
    - cron: '0 3 * * 0'   # Sunday at 3 AM UTC
  workflow_dispatch:      # Allow manual trigger

jobs:
  refresh:
    if: github.event.schedule == '0 2 * * *' || github.event_name == 'workflow_dispatch'
    runs-on: ubuntu-latest
    steps:
      - name: Refresh Company Cache
        run: |
          curl -X POST ${{ secrets.SUPABASE_URL }}/functions/v1/refresh-company-cache \
            -H "Authorization: Bearer ${{ secrets.SUPABASE_SERVICE_KEY }}" \
            -H "Content-Type: application/json" \
            -d '{"maxCompanies": 100}'

  cleanup:
    if: github.event.schedule == '0 3 * * 0' || github.event_name == 'workflow_dispatch'
    runs-on: ubuntu-latest
    steps:
      - name: Cleanup Company Cache
        run: |
          curl -X POST ${{ secrets.SUPABASE_URL }}/functions/v1/cleanup-company-cache \
            -H "Authorization: Bearer ${{ secrets.SUPABASE_SERVICE_KEY }}" \
            -H "Content-Type: application/json" \
            -d '{"dryRun": false}'
```

**Configurer les secrets GitHub** :
- Repository → Settings → Secrets and variables → Actions
- Ajouter :
  - `SUPABASE_URL` : https://VOTRE_PROJECT.supabase.co
  - `SUPABASE_SERVICE_KEY` : Depuis Dashboard → Settings → API → service_role key

---

## ✅ Checklist de Vérification

Après avoir exécuté toutes les commandes :

- [ ] Migration appliquée (`supabase db push` ✓)
- [ ] 2 tables créées (`company_data_cache`, `company_search_history` ✓)
- [ ] 5 fonctions PostgreSQL créées ✓
- [ ] 2 secrets configurés (`CLAUDE_API_KEY`, `PAPPERS_API_KEY` ✓)
- [ ] 3 Edge Functions déployées ✓
- [ ] Tests passent 12/12 ✓
- [ ] Logs sans erreurs ✓
- [ ] Cron job configuré (optionnel) ⏭️

---

## 🚀 Test en Production

Maintenant, testez le système complet :

1. **Uploader un devis PDF** dans votre application
2. **Vérifier** que le SIRET est extrait automatiquement
3. **Consulter** la table `company_data_cache` :
   ```sql
   SELECT * FROM company_data_cache LIMIT 5;
   ```
4. **Vérifier** le scoring TORP enrichi avec les données entreprise

---

## 📊 Monitoring (Dans 1 Semaine)

```sql
-- Cache hit rate
SELECT
  COUNT(*) FILTER (WHERE cache_hit)::float / COUNT(*) * 100 as hit_rate_pct,
  AVG(response_time_ms) as avg_response_ms
FROM company_search_history
WHERE created_at > NOW() - INTERVAL '7 days';

-- Statistiques du cache
SELECT
  COUNT(*) as total_cached,
  AVG(fetch_count) as avg_usage,
  AVG(quality_score) as avg_quality
FROM company_data_cache;
```

**Objectifs après 1 mois** :
- ✅ Cache Hit Rate > 85%
- ✅ Quality Score moyen > 80
- ✅ Response Time < 100ms (cache hit)

---

## 🆘 Troubleshooting

### Problème : "Migration already applied"
**Solution** : C'est normal, la migration existe déjà. Continuez.

### Problème : "Secrets not found"
**Solution** :
```bash
supabase secrets set CLAUDE_API_KEY=sk-ant-...
supabase secrets set PAPPERS_API_KEY=b02fe90a049bef5a160c7f4abc5d67f0c7ffcd71f4d11bbe
```

### Problème : "Function deployment failed"
**Solution** :
```bash
# Voir les logs détaillés
supabase functions logs FUNCTION_NAME --limit 50

# Redéployer
supabase functions deploy FUNCTION_NAME --no-verify-jwt
```

### Problème : Tests échouent
**Solution** :
```bash
# 1. Vérifier les secrets
supabase secrets list

# 2. Vérifier la migration
supabase db remote query "SELECT COUNT(*) FROM company_data_cache;"

# 3. Voir les logs
supabase functions logs test-company-search --limit 50
```

---

## 📚 Documentation

- **Architecture complète** : `docs/ARCHITECTURE_COMPANY_SEARCH.md`
- **Guide rapide** : `docs/QUICKSTART_COMPANY_SEARCH.md`
- **README principal** : `docs/COMPANY_SEARCH_README.md`
- **Commandes fréquentes** : `QUICK_COMMANDS.md`
- **Guide de déploiement** : `DEPLOYMENT_GUIDE.md`

---

## 🎉 Félicitations !

Le système de recherche d'entreprise intelligent est maintenant **opérationnel** ! 🚀

**Prochaines étapes** :
1. Tester avec des devis réels
2. Configurer le monitoring
3. Activer le cron job
4. Consulter les statistiques après 1 semaine

**Besoin d'aide ?**
- Consultez `DEPLOYMENT_GUIDE.md` (section Troubleshooting)
- Vérifiez les logs : `supabase functions logs --follow`
- Consultez la documentation complète dans `docs/`

---

**Bon développement !** 🎊
