# 🔐 Configuration des Secrets GitHub pour le Déploiement Automatique

Le workflow GitHub Actions a été créé pour déployer automatiquement le système de recherche d'entreprise sur Supabase.

**⚠️ IMPORTANT** : Vous devez configurer ces secrets GitHub pour que le déploiement automatique fonctionne.

---

## 📋 Secrets à Configurer

Allez sur : **GitHub → Repository → Settings → Secrets and variables → Actions → New repository secret**

### 1️⃣ SUPABASE_ACCESS_TOKEN

**Obtenir ce token** :
1. Allez sur https://supabase.com/dashboard/account/tokens
2. Cliquez sur "Generate new token"
3. Nommez-le "GitHub Actions"
4. Copiez le token

**Ajouter dans GitHub** :
- Name: `SUPABASE_ACCESS_TOKEN`
- Value: `sbp_xxxxxxxxxxxxxxxxxxxxx`

---

### 2️⃣ SUPABASE_PROJECT_ID

**Obtenir ce Project ID** :
1. Allez sur https://supabase.com/dashboard
2. Sélectionnez votre projet
3. Settings → General → Reference ID

**Ajouter dans GitHub** :
- Name: `SUPABASE_PROJECT_ID`
- Value: `xxxxxxxxxxxxxxxxxxxx` (20 caractères)

---

### 3️⃣ SUPABASE_DB_PASSWORD

**Obtenir ce mot de passe** :
1. Dashboard Supabase → Settings → Database
2. Utilisez le mot de passe que vous avez défini lors de la création du projet
3. ⚠️ Si vous l'avez perdu, vous pouvez le réinitialiser (mais attention aux impacts)

**Ajouter dans GitHub** :
- Name: `SUPABASE_DB_PASSWORD`
- Value: `votre_mot_de_passe_db`

---

## 🔑 Secrets Supabase (À Configurer Manuellement)

Ces secrets doivent être configurés dans **Supabase Dashboard** (pas dans GitHub) :

### Dans Supabase Dashboard → Settings → Edge Functions → Secrets

1. **CLAUDE_API_KEY**
   ```bash
   Valeur: sk-ant-VOTRE_CLÉ_CLAUDE
   ```
   Obtenir : https://console.anthropic.com/settings/keys

2. **PAPPERS_API_KEY**
   ```bash
   Valeur: b02fe90a049bef5a160c7f4abc5d67f0c7ffcd71f4d11bbe
   ```
   (Cette clé vous a été fournie)

**Comment configurer dans Supabase** :
```bash
# Méthode 1 : Via Dashboard
Settings → Edge Functions → Secrets → Add secret

# Méthode 2 : Via CLI (si vous préférez)
supabase secrets set CLAUDE_API_KEY=sk-ant-xxx
supabase secrets set PAPPERS_API_KEY=b02fe90a049bef5a160c7f4abc5d67f0c7ffcd71f4d11bbe
```

---

## ✅ Vérification

### Après avoir configuré les secrets GitHub :

1. **Push le code** (déjà fait automatiquement)
2. **Allez dans Actions** : https://github.com/VOTRE_ORG/quote-insight-tally/actions
3. **Vérifiez le workflow** "Deploy Company Search System"
4. **Si vert ✅** : Le déploiement a réussi !
5. **Si rouge ❌** : Cliquez dessus pour voir les logs

---

## 🚀 Déclenchement du Workflow

Le workflow se déclenche automatiquement quand :
- ✅ Vous pushez sur la branche `claude/configure-company-search-01Be9mHyZZNNd2KUWVjowoFs`
- ✅ Vous modifiez les fichiers dans `supabase/migrations/` ou `supabase/functions/`
- ✅ Vous le déclenchez manuellement (bouton "Run workflow")

---

## 📊 Ce que fait le Workflow

1. ✅ Clone le code
2. ✅ Installe Supabase CLI
3. ✅ Lie le projet Supabase
4. ✅ Déploie la migration database (003_company_data_cache)
5. ✅ Déploie les 3 Edge Functions
6. ✅ Exécute les tests
7. ✅ Vérifie que tout est OK

**Durée** : ~3-5 minutes

---

## 🆘 Troubleshooting

### ❌ "Authentication failed"
**Solution** : Vérifiez `SUPABASE_ACCESS_TOKEN` et `SUPABASE_PROJECT_ID`

### ❌ "Database password incorrect"
**Solution** : Vérifiez `SUPABASE_DB_PASSWORD`

### ❌ "Migration already applied"
**Solution** : C'est normal ! Le workflow continue quand même

### ❌ "Secrets not found in Edge Functions"
**Solution** : Configurez `CLAUDE_API_KEY` et `PAPPERS_API_KEY` dans Supabase Dashboard

---

## 📝 Checklist Complète

### Dans GitHub (Secrets)
- [ ] SUPABASE_ACCESS_TOKEN configuré
- [ ] SUPABASE_PROJECT_ID configuré
- [ ] SUPABASE_DB_PASSWORD configuré

### Dans Supabase Dashboard (Edge Functions Secrets)
- [ ] CLAUDE_API_KEY configuré
- [ ] PAPPERS_API_KEY configuré

### Vérification
- [ ] Workflow exécuté avec succès (GitHub Actions)
- [ ] Tests passent (12/12)
- [ ] Tables créées (company_data_cache, company_search_history)
- [ ] Fonctions déployées (3 fonctions)

---

## 🎯 Une fois les secrets configurés

Le déploiement sera **100% automatique** ! À chaque push sur la branche, le système se redéploie automatiquement.

---

**Besoin d'aide ?** Consultez les logs du workflow dans GitHub Actions.
