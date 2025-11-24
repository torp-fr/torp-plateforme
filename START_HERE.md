# 🚀 DÉMARRAGE RAPIDE - 5 COMMANDES À EXÉCUTER

> **⚠️ IMPORTANT : Exécutez ces commandes sur VOTRE MACHINE LOCALE (pas dans l'interface Claude)**

---

## 📍 Prérequis (Vérification Rapide)

```bash
# Vérifier que Supabase CLI est installé
supabase --version

# Si pas installé :
# macOS: brew install supabase/tap/supabase
# npm: npm install -g supabase
```

---

## ⚡ LES 5 COMMANDES ESSENTIELLES

### 📥 Étape 0 : Récupérer le Code

```bash
# Dans votre terminal, allez dans le dossier du projet
cd /path/to/quote-insight-tally

# Pull les derniers changements
git pull origin claude/configure-company-search-01Be9mHyZZNNd2KUWVjowoFs
```

---

### 1️⃣ MIGRATION DATABASE

```bash
supabase db push
```

**✅ Résultat attendu** : "Migration applied successfully"

---

### 2️⃣ SECRETS (Remplacez par vos vraies clés)

```bash
# Votre clé Claude (obtenez-la sur https://console.anthropic.com/settings/keys)
supabase secrets set CLAUDE_API_KEY=sk-ant-REMPLACEZ_PAR_VOTRE_CLÉ

# Clé Pappers (déjà fournie)
supabase secrets set PAPPERS_API_KEY=b02fe90a049bef5a160c7f4abc5d67f0c7ffcd71f4d11bbe
```

**✅ Résultat attendu** : "Secret set successfully"

---

### 3️⃣ DÉPLOIEMENT DES FONCTIONS

```bash
supabase functions deploy refresh-company-cache --no-verify-jwt && \
supabase functions deploy cleanup-company-cache --no-verify-jwt && \
supabase functions deploy test-company-search --no-verify-jwt
```

**✅ Résultat attendu** : "Deployed Function ... on project ..."

---

### 4️⃣ TESTS

```bash
supabase functions invoke test-company-search --no-verify-jwt
```

**✅ Résultat attendu** : `"passRate": "100.00%"`

---

### 5️⃣ VÉRIFICATION

```bash
# Vérifier les tables
supabase db remote query "SELECT COUNT(*) FROM company_data_cache;"

# Vérifier les fonctions
supabase functions list
```

**✅ Résultat attendu** : Tables et fonctions listées

---

## 🎉 C'EST TOUT !

Le système est maintenant **opérationnel** !

### 🔍 Test en Production

Maintenant, dans votre application :
1. **Uploadez** un devis PDF
2. **Vérifiez** que le SIRET est extrait
3. **Consultez** les données en cache :
   ```bash
   supabase db remote query "SELECT * FROM company_data_cache LIMIT 5;"
   ```

---

## 📊 Monitoring (Dans 1 Semaine)

```sql
-- Cache hit rate
SELECT
  COUNT(*) FILTER (WHERE cache_hit)::float / COUNT(*) * 100 as hit_rate
FROM company_search_history
WHERE created_at > NOW() - INTERVAL '7 days';
```

**Objectif** : > 80% après 1 mois

---

## 🆘 Problèmes ?

### ❌ "supabase: command not found"
**Solution** : Installez Supabase CLI
```bash
brew install supabase/tap/supabase
```

### ❌ "Not linked to a project"
**Solution** : Liez votre projet
```bash
supabase link --project-ref VOTRE_PROJECT_ID
```
Trouvez PROJECT_ID : Dashboard Supabase → Settings → General

### ❌ Tests échouent
**Solution** : Vérifiez les secrets
```bash
supabase secrets list
```

### ❌ Migration déjà appliquée
**Solution** : C'est normal, continuez !

---

## 📚 Documentation Complète

- **Guide interactif** : `./EXECUTE_DEPLOYMENT.sh`
- **Toutes les commandes** : `COMMANDES_A_EXECUTER.md`
- **Troubleshooting détaillé** : `DEPLOYMENT_GUIDE.md`
- **Architecture** : `docs/ARCHITECTURE_COMPANY_SEARCH.md`
- **Commandes quotidiennes** : `QUICK_COMMANDS.md`

---

## ✅ Checklist Finale

- [ ] Commande 0 : `git pull` ✓
- [ ] Commande 1 : `supabase db push` ✓
- [ ] Commande 2 : Secrets configurés ✓
- [ ] Commande 3 : Fonctions déployées ✓
- [ ] Commande 4 : Tests passent ✓
- [ ] Commande 5 : Vérification OK ✓

---

## 🎯 Temps Estimé

**5-10 minutes** au total (en copiant-collant les commandes)

---

**🚀 COMMENCEZ MAINTENANT : Ouvrez votre terminal et exécutez les 5 commandes !**
