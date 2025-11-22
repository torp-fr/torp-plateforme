# Configuration Vercel avec Supabase

Ce guide vous montre comment configurer les variables d'environnement Vercel pour activer le backend Supabase en production.

## 📋 Prérequis

✅ Projet Supabase créé : https://zvxasiwahpraasjzfhhl.supabase.co
✅ Anon Key récupérée
⏳ Schéma SQL appliqué (à faire si pas encore fait)
⏳ Storage bucket créé (à faire si pas encore fait)

---

## 🗄️ Étape 1 : Appliquer le Schéma SQL (SI PAS ENCORE FAIT)

### Dans Supabase Dashboard

1. **Ouvrir SQL Editor**
   - Aller sur : https://app.supabase.com/project/zvxasiwahpraasjzfhhl/sql
   - Cliquer **New Query**

2. **Copier le schéma**
   - Ouvrir le fichier local : `supabase/migrations/001_initial_schema.sql`
   - Copier TOUT le contenu (564 lignes)
   - Coller dans le SQL Editor

3. **Exécuter**
   - Cliquer **Run** (ou Ctrl+Enter)
   - Attendre le message : **"Success. No rows returned"**

4. **Vérifier les tables**
   - Aller dans **Table Editor**
   - Vous devriez voir 8 tables :
     - ✅ users
     - ✅ companies
     - ✅ projects
     - ✅ devis
     - ✅ payments
     - ✅ notifications
     - ✅ market_data
     - ✅ activity_logs

---

## 📦 Étape 2 : Créer le Storage Bucket (SI PAS ENCORE FAIT)

### Dans Supabase Dashboard

1. **Aller dans Storage**
   - https://app.supabase.com/project/zvxasiwahpraasjzfhhl/storage/buckets

2. **Create new bucket**
   ```
   Name: devis-uploads
   Public: ❌ NO (must be private)
   File size limit: 10485760 (10MB)
   Allowed MIME types: application/pdf, image/jpeg, image/png, application/msword, application/vnd.openxmlformats-officedocument.wordprocessingml.document
   ```

3. **Save**

---

## 🔐 Étape 3 : Appliquer les Storage Policies

### Dans Supabase SQL Editor

1. **Ouvrir SQL Editor**
   - New Query

2. **Copier les policies**
   - Ouvrir le fichier local : `supabase/storage-policies.sql`
   - Copier tout le contenu
   - Coller dans SQL Editor

3. **Run**
   - Attendre confirmation

4. **Vérifier**
   - Aller dans Storage → devis-uploads → Policies
   - Vous devriez voir 4 policies actives

---

## ⚙️ Étape 4 : Configurer Variables Vercel

### Dans Vercel Dashboard

1. **Ouvrir Settings**
   - https://vercel.com/torps-projects/quote-insight-tally/settings/environment-variables

2. **Ajouter ces variables** (cliquer "Add" pour chaque)

#### Variable 1
```
Name: VITE_AUTH_PROVIDER
Value: supabase
Environment: Production, Preview, Development (cocher les 3)
```

#### Variable 2
```
Name: VITE_SUPABASE_URL
Value: https://zvxasiwahpraasjzfhhl.supabase.co
Environment: Production, Preview, Development (cocher les 3)
```

#### Variable 3
```
Name: VITE_SUPABASE_ANON_KEY
Value: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inp2eGFzaXdhaHByYWFzanpmaGhsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjM0NTI0NjUsImV4cCI6MjA3OTAyODQ2NX0.h-pyJqeejzaNC68mxxXbsxx7VPvjWHRdAF_lebmJWYM
Environment: Production, Preview, Development (cocher les 3)
```

#### Variable 4
```
Name: VITE_MOCK_API
Value: false
Environment: Production, Preview, Development (cocher les 3)
```

#### Variable 5 (Optionnel mais recommandé)
```
Name: VITE_DEBUG_MODE
Value: false
Environment: Production seulement
```

3. **Save** après chaque variable

---

## 🚀 Étape 5 : Redéployer

### Option A : Auto-redeploy (Recommandé)

1. Aller dans **Deployments**
2. Cliquer sur le dernier déploiement (commit 43e5fff)
3. Cliquer **⋮** (trois points) → **Redeploy**
4. Confirmer

### Option B : Push un nouveau commit

```bash
# Créer un commit vide pour trigger le déploiement
git commit --allow-empty -m "chore: Trigger Vercel redeploy with Supabase env vars"
git push origin claude/setup-new-project-01624XSUdEvM9W9a3pNtSxME
```

---

## ✅ Étape 6 : Tester la Production

Une fois le déploiement terminé :

### Test 1 : Vérifier les services actifs

1. Ouvrir votre app Vercel
2. Ouvrir la console développeur (F12)
3. Vous devriez voir dans les logs :
   ```
   [Services] Configuration: {
     mode: 'real',
     authProvider: 'supabase',
     services: {
       auth: 'SupabaseAuthService',
       devis: 'SupabaseDevisService',
       project: 'SupabaseProjectService'
     }
   }
   ```

### Test 2 : Inscription

1. Aller sur `/register`
2. S'inscrire avec un email et mot de passe
3. Vérifier dans Supabase :
   - **Authentication** → **Users** : Nouvel utilisateur présent
   - **Table Editor** → **users** : Profil créé automatiquement

### Test 3 : Connexion

1. Se connecter avec les credentials
2. Devrait fonctionner sans erreur
3. Vérifier que la session persiste au refresh

### Test 4 : Créer un projet

1. Créer un nouveau projet
2. Vérifier dans Supabase :
   - **Table Editor** → **projects** : Nouveau projet présent

### Test 5 : Upload devis

1. Uploader un PDF ou image
2. Vérifier dans Supabase :
   - **Storage** → **devis-uploads** : Fichier présent
   - **Table Editor** → **devis** : Record créé

---

## 🔍 Troubleshooting

### Erreur : "Invalid API key"

**Cause** : Mauvaise anon key ou URL

**Solution** :
1. Vérifier Settings → API dans Supabase
2. Copier à nouveau l'anon/public key (PAS service_role)
3. Mettre à jour la variable Vercel
4. Redéployer

### Erreur : "Row Level Security policy violation"

**Cause** : Policies RLS pas appliquées

**Solution** :
1. Vérifier que le schéma SQL complet a été exécuté
2. Aller dans Table Editor → users → Policies
3. Vérifier que les policies existent
4. Si pas présentes, réexécuter le schéma complet

### Erreur : "Storage bucket not found"

**Cause** : Bucket pas créé ou mauvais nom

**Solution** :
1. Aller dans Storage
2. Vérifier qu'un bucket nommé exactement `devis-uploads` existe
3. Vérifier qu'il est **privé** (pas public)

### Services toujours en mode mock

**Cause** : Variables env pas chargées

**Solution** :
1. Vérifier que toutes les 4 variables sont bien ajoutées dans Vercel
2. Vérifier qu'elles sont activées pour "Production"
3. Redéployer (pas juste rebuild)
4. Clear cache navigateur

---

## 📊 Checklist Complète

Avant de marquer comme terminé :

- [ ] Schéma SQL exécuté dans Supabase
- [ ] 8 tables créées et visibles
- [ ] Authentication Email activée
- [ ] Storage bucket `devis-uploads` créé (privé)
- [ ] Storage policies appliquées (4 policies)
- [ ] 4 variables env ajoutées dans Vercel
- [ ] Vercel redéployé
- [ ] Test inscription réussie
- [ ] Test connexion réussie
- [ ] Test création projet réussie
- [ ] Test upload devis réussi
- [ ] Console affiche "mode: 'real'"

---

## 🎯 Résultat Attendu

Après configuration complète :

✅ **Mode Mock → Mode Supabase** activé
✅ **Authentication réelle** fonctionnelle
✅ **Données persistantes** en PostgreSQL
✅ **Upload fichiers** dans Supabase Storage
✅ **RLS policies** protègent les données
✅ **Zero downtime** (backward compatible)

---

## 📞 Support

- **Supabase Docs** : https://supabase.com/docs
- **Vercel Docs** : https://vercel.com/docs
- **Migration Guide** : Voir `docs/BACKEND_MIGRATION_GUIDE.md`
- **Troubleshooting** : Voir `docs/BACKEND_MIGRATION_GUIDE.md` section Troubleshooting

---

**Note** : Si vous préférez rester en mode mock pour l'instant, supprimez simplement les variables Vercel ou mettez `VITE_MOCK_API=true`. Le système basculera automatiquement.
