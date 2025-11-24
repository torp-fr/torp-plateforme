# Quick Start : Système de Recherche d'Entreprise

Guide rapide pour démarrer avec le système de recherche d'entreprise intelligent.

## 🚀 Installation (5 minutes)

### 1. Appliquer la Migration

```bash
# Via Supabase CLI
cd /path/to/quote-insight-tally
supabase migration up

# Ou manuellement
psql -h db.xxx.supabase.co -U postgres -f supabase/migrations/003_company_data_cache.sql
```

### 2. Configurer les Variables d'Environnement

Dans Supabase Dashboard → Settings → Edge Functions → Secrets :

```bash
# Obligatoire
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJ...
CLAUDE_API_KEY=sk-ant-...

# Pour les fonctionnalités premium
PAPPERS_API_KEY=b02fe90a049bef5a160c7f4abc5d67f0c7ffcd71f4d11bbe
```

### 3. Déployer les Edge Functions

```bash
# Déployer les fonctions de maintenance
supabase functions deploy refresh-company-cache
supabase functions deploy cleanup-company-cache

# Définir le secret Pappers
supabase secrets set PAPPERS_API_KEY=b02fe90a049bef5a160c7f4abc5d67f0c7ffcd71f4d11bbe
```

### 4. Tester l'Installation

```bash
# Test basique
curl -X POST https://xxx.supabase.co/functions/v1/refresh-company-cache \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{"maxCompanies": 1}'

# Doit retourner: {"success": true, "refreshed": 0, ...}
```

✅ **Installation terminée !** Le système est prêt à l'emploi.

---

## 📱 Utilisation Basique

### Rechercher une Entreprise

```typescript
import { createCompanySearchService } from '@/supabase/functions/_shared/company-search.service';

// Créer le service
const service = createCompanySearchService();

// Recherche par SIRET
const result = await service.searchCompany({
  siret: '85315147000017' // SIRET de test
});

console.log(result.companyName); // Nom de l'entreprise
console.log(result.cached); // true/false
console.log(result.qualityScore); // 0-100
console.log(result.riskLevel); // 'low' | 'medium' | 'high' | 'critical'
```

### Extraction depuis un Devis

```typescript
import { extractCompanyInfo } from '@/supabase/functions/_shared/siret-extractor';

const devisText = `
  DEVIS N° 2024-001
  Entreprise: BTP SOLUTIONS
  SIRET: 123 456 789 00012
  ...
`;

const extraction = await extractCompanyInfo(devisText, CLAUDE_API_KEY);

if (extraction.success) {
  console.log(extraction.siret); // '12345678900012'
  console.log(extraction.companyName); // 'BTP SOLUTIONS'
}
```

---

## ⚙️ Configuration du Cron (Optionnel)

### Option 1 : GitHub Actions (Recommandé)

Créer `.github/workflows/company-cache-maintenance.yml` :

```yaml
name: Company Cache Maintenance

on:
  schedule:
    - cron: '0 2 * * *'  # Daily refresh at 2 AM
    - cron: '0 3 * * 0'  # Weekly cleanup on Sunday at 3 AM

jobs:
  refresh:
    if: github.event.schedule == '0 2 * * *'
    runs-on: ubuntu-latest
    steps:
      - run: |
          curl -X POST ${{ secrets.SUPABASE_URL }}/functions/v1/refresh-company-cache \
            -H "Authorization: Bearer ${{ secrets.SUPABASE_SERVICE_KEY }}" \
            -d '{"maxCompanies": 100}'

  cleanup:
    if: github.event.schedule == '0 3 * * 0'
    runs-on: ubuntu-latest
    steps:
      - run: |
          curl -X POST ${{ secrets.SUPABASE_URL }}/functions/v1/cleanup-company-cache \
            -H "Authorization: Bearer ${{ secrets.SUPABASE_SERVICE_KEY }}" \
            -d '{"dryRun": false}'
```

### Option 2 : Cron-Job.org (Alternative Simple)

1. Aller sur https://cron-job.org
2. Créer un job "Company Cache Refresh"
   - URL : `https://xxx.supabase.co/functions/v1/refresh-company-cache`
   - Schedule : Every day at 02:00
   - Method : POST
   - Header : `Authorization: Bearer YOUR_SERVICE_KEY`
   - Body : `{"maxCompanies": 100}`
3. Créer un job "Company Cache Cleanup"
   - URL : `https://xxx.supabase.co/functions/v1/cleanup-company-cache`
   - Schedule : Every Sunday at 03:00
   - Method : POST
   - Header : `Authorization: Bearer YOUR_SERVICE_KEY`
   - Body : `{"dryRun": false}`

---

## 📊 Vérifier que Tout Fonctionne

### 1. Tester l'Extraction SIRET

```sql
-- Dans Supabase SQL Editor
SELECT * FROM company_data_cache LIMIT 5;
```

Devrait retourner des entrées si le système a déjà traité des devis.

### 2. Tester le Rafraîchissement

```bash
curl -X POST https://xxx.supabase.co/functions/v1/refresh-company-cache \
  -H "Authorization: Bearer YOUR_SERVICE_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "maxCompanies": 5,
    "forceAll": false
  }'
```

Devrait retourner :
```json
{
  "success": true,
  "refreshed": 0-5,
  "failed": 0,
  "errors": []
}
```

### 3. Tester le Cleanup (Dry Run)

```bash
curl -X POST https://xxx.supabase.co/functions/v1/cleanup-company-cache \
  -H "Authorization: Bearer YOUR_SERVICE_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "dryRun": true
  }'
```

Devrait retourner :
```json
{
  "success": true,
  "deleted": 0,
  "dryRun": true,
  "deletedEntries": []
}
```

### 4. Vérifier les Statistiques du Cache

```sql
-- Cache hit rate (devrait être > 80% après quelques semaines)
SELECT
  COUNT(*) FILTER (WHERE cache_hit = true)::float / COUNT(*) * 100 as cache_hit_rate,
  COUNT(*) as total_searches,
  AVG(response_time_ms) as avg_response_time
FROM company_search_history
WHERE created_at > NOW() - INTERVAL '7 days';

-- Top entreprises sollicitées
SELECT
  company_name,
  fetch_count,
  last_fetched_at,
  quality_score
FROM company_data_cache
ORDER BY fetch_count DESC
LIMIT 10;
```

---

## 🎯 Cas d'Usage Courants

### Cas 1 : Upload d'un Devis

**Workflow automatique** :
1. Utilisateur upload un PDF
2. OCR extrait le texte
3. Service extrait automatiquement le SIRET
4. Service recherche l'entreprise (cache ou API)
5. Données enrichissent le RAG context
6. Score TORP calculé avec données entreprise

**Code (déjà intégré dans `rag-orchestrator.ts`)** :
```typescript
const ragContext = await orchestrateRAG({
  devisText: extractedText
});

// Les données entreprise sont automatiquement incluses
console.log(ragContext.entreprise);
// {
//   identite: {...},
//   certifications: {...},
//   score: 180/250,
//   alertes: ["ATTENTION: Pas de certification RGE"],
//   cached: true,
//   cacheAge: 10,
//   qualityScore: 85,
//   riskLevel: 'low'
// }
```

### Cas 2 : Recherche Manuelle d'Entreprise

**Frontend** :
```typescript
// Dans un composant React/Vue
const searchCompany = async (siret: string) => {
  const { data, error } = await supabase.functions.invoke('search-company', {
    body: { siret }
  });

  if (data.success) {
    console.log('Entreprise trouvée:', data.companyName);
    console.log('Données depuis:', data.cached ? 'Cache' : 'API');
    console.log('Score qualité:', data.qualityScore);
  }
};
```

### Cas 3 : Rafraîchir Manuellement une Entreprise

**Admin Dashboard** :
```typescript
const refreshCompany = async (siret: string) => {
  const { data } = await supabase.functions.invoke('refresh-company-cache', {
    body: {
      sirets: [siret],
      forceAll: true
    }
  });

  console.log('Rafraîchissement:', data.refreshed ? 'Succès' : 'Échec');
};
```

---

## 🐛 Troubleshooting

### Problème : "Missing PAPPERS_API_KEY"

**Solution** :
```bash
supabase secrets set PAPPERS_API_KEY=b02fe90a049bef5a160c7f4abc5d67f0c7ffcd71f4d11bbe
supabase functions deploy refresh-company-cache
```

### Problème : "Cache always misses"

**Diagnostic** :
```sql
-- Vérifier que le cache contient des données
SELECT COUNT(*) FROM company_data_cache;

-- Vérifier les logs de recherche
SELECT * FROM company_search_history ORDER BY created_at DESC LIMIT 10;
```

**Solution** : Le cache se remplit progressivement. Normal si le système est nouveau.

### Problème : "Quality score too low"

**Solution** : Activer Pappers systématiquement
```typescript
const result = await service.searchCompany({
  siret: '...',
  usePappers: true  // Force Pappers pour meilleure qualité
});
```

### Problème : "Refresh function times out"

**Solution** : Réduire `maxCompanies`
```bash
curl ... -d '{"maxCompanies": 20}'  # Au lieu de 100
```

---

## 📈 Métriques de Succès

Après 1 mois d'utilisation, vous devriez voir :

- ✅ **Cache Hit Rate** : 85-95%
- ✅ **Response Time (cache hit)** : < 100ms
- ✅ **Quality Score moyen** : > 80
- ✅ **Crédits Pappers économisés** : 90%

Vérifier avec :
```sql
SELECT
  -- Cache performance
  COUNT(*) FILTER (WHERE cache_hit)::float / COUNT(*) * 100 as cache_hit_rate,
  AVG(response_time_ms) FILTER (WHERE cache_hit) as avg_cache_response,
  AVG(response_time_ms) FILTER (WHERE NOT cache_hit) as avg_api_response,

  -- Data quality
  (SELECT AVG(quality_score) FROM company_data_cache) as avg_quality_score,
  (SELECT COUNT(*) FROM company_data_cache) as total_cached_companies

FROM company_search_history
WHERE created_at > NOW() - INTERVAL '30 days';
```

---

## 🎓 Ressources Supplémentaires

- **Documentation complète** : `docs/ARCHITECTURE_COMPANY_SEARCH.md`
- **Refresh function README** : `supabase/functions/refresh-company-cache/README.md`
- **Cleanup function README** : `supabase/functions/cleanup-company-cache/README.md`

---

## 💬 Questions ?

Le système est maintenant opérationnel ! 🎉

Pour toute question :
1. Consulter les logs Supabase
2. Vérifier la base de données
3. Tester les endpoints manuellement

**Prochaines étapes recommandées** :
1. Configurer le cron job pour maintenance automatique
2. Créer un dashboard de monitoring (Grafana/Metabase)
3. Définir des alertes sur les métriques clés

---

**Bon développement !** 🚀
