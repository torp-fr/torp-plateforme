# Test Company Search System

Suite de tests complète pour valider le système de recherche d'entreprise.

## Usage

### Exécuter tous les tests

```bash
curl https://your-project.supabase.co/functions/v1/test-company-search \
  -H "Authorization: Bearer YOUR_ANON_KEY"
```

### Résultat attendu

```json
{
  "totalTests": 12,
  "totalPassed": 12,
  "totalFailed": 0,
  "totalDuration": 3245,
  "passRate": "100.00%",
  "suites": [
    {
      "suiteName": "SIRET/SIREN Validation",
      "tests": [...],
      "passed": 5,
      "failed": 0,
      "duration": 15
    },
    {
      "suiteName": "SIRET Extraction",
      "tests": [...],
      "passed": 3,
      "failed": 0,
      "duration": 1250
    },
    {
      "suiteName": "Company Search Service",
      "tests": [...],
      "passed": 3,
      "failed": 0,
      "duration": 1800
    },
    {
      "suiteName": "Database Functions",
      "tests": [...],
      "passed": 2,
      "failed": 0,
      "duration": 180
    }
  ],
  "environment": {
    "hasPappersKey": true,
    "hasClaudeKey": true,
    "hasSupabase": true
  }
}
```

## Tests Inclus

### Suite 1 : Validation SIRET/SIREN
- ✅ SIRET valide (avec espaces)
- ✅ SIRET valide (sans espaces)
- ✅ SIRET invalide (mauvaise longueur)
- ✅ SIRET invalide (échec Luhn)
- ✅ SIREN valide

### Suite 2 : Extraction SIRET
- ✅ Extraction depuis texte formaté
- ✅ Extraction depuis format compact
- ✅ Gestion d'absence de SIRET

### Suite 3 : Service de Recherche
- ✅ Recherche par SIRET (appel API)
- ✅ Recherche par SIRET (cache hit)
- ✅ Force refresh (bypass cache)

**Note** : Ces tests nécessitent `PAPPERS_API_KEY` configuré.

### Suite 4 : Fonctions Base de Données
- ✅ Table `company_data_cache` existe
- ✅ Table `company_search_history` existe

## Déploiement

```bash
# Déployer la fonction de test
supabase functions deploy test-company-search

# Exécuter les tests
curl https://your-project.supabase.co/functions/v1/test-company-search \
  -H "Authorization: Bearer YOUR_ANON_KEY"
```

## Intégration CI/CD

### GitHub Actions

Ajouter dans `.github/workflows/test.yml` :

```yaml
name: Test Company Search

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - name: Run Company Search Tests
        run: |
          RESULT=$(curl -s ${{ secrets.SUPABASE_URL }}/functions/v1/test-company-search \
            -H "Authorization: Bearer ${{ secrets.SUPABASE_ANON_KEY }}")

          PASS_RATE=$(echo $RESULT | jq -r '.passRate')
          FAILED=$(echo $RESULT | jq -r '.totalFailed')

          echo "Pass Rate: $PASS_RATE"
          echo "Failed Tests: $FAILED"

          if [ "$FAILED" -gt "0" ]; then
            echo "Tests failed!"
            exit 1
          fi

          echo "All tests passed!"
```

## Troubleshooting

### Tous les tests de recherche échouent

**Cause** : `PAPPERS_API_KEY` non configuré ou invalide

**Solution** :
```bash
supabase secrets set PAPPERS_API_KEY=your_key_here
```

### Tests d'extraction échouent

**Cause** : `CLAUDE_API_KEY` non configuré

**Solution** :
```bash
supabase secrets set CLAUDE_API_KEY=sk-ant-...
```

### Tests de base de données échouent

**Cause** : Migration non appliquée

**Solution** :
```bash
supabase migration up
```

## Métriques de Performance

**Benchmarks attendus** :
- Validation SIRET : < 5ms par test
- Extraction SIRET : 100-500ms (selon méthode)
- Recherche API : 1000-2000ms (cache miss)
- Recherche cache : < 100ms (cache hit)
- Tests DB : < 200ms par test

**Pass Rate attendu** : 100%
