# 🚀 Activation Backend Supabase - 3 Étapes

Guide ultra-simplifié pour activer le backend Supabase en production.

---

## ✅ Prérequis

- Projet Supabase : https://zvxasiwahpraasjzfhhl.supabase.co
- Anon Key : `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inp2eGFzaXdhaHByYWFzanpmaGhsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjM0NTI0NjUsImV4cCI6MjA3OTAyODQ2NX0.h-pyJqeejzaNC68mxxXbsxx7VPvjWHRdAF_lebmJWYM`

---

## 📋 Étape 1 : Installer le Schéma SQL (2 minutes)

### Dans Supabase Dashboard

1. **Ouvrir SQL Editor**
   - https://app.supabase.com/project/zvxasiwahpraasjzfhhl/sql
   - Cliquer **New Query**

2. **Copier le script complet**
   - Ouvrir le fichier : `supabase/INSTALL_COMPLETE.sql`
   - Sélectionner TOUT (Ctrl+A)
   - Copier (Ctrl+C)

3. **Exécuter**
   - Coller dans SQL Editor (Ctrl+V)
   - Cliquer **RUN** (ou Ctrl+Enter)
   - Attendre ~10 secondes

4. **Vérifier le succès**
   - Message final : `🎉 INSTALLATION TERMINÉE !`
   - Table Editor → 8 tables visibles

---

## 📦 Étape 2 : Créer le Storage Bucket (1 minute)

### Dans Supabase Dashboard

1. **Storage** (icône dossier dans la barre latérale)
   - https://app.supabase.com/project/zvxasiwahpraasjzfhhl/storage/buckets

2. **Create new bucket**
   ```
   Name: devis-uploads
   Public bucket: ❌ NO (must be PRIVATE !)
   File size limit: 10485760 (10MB)
   Allowed MIME types: application/pdf, image/jpeg, image/png
   ```

3. **Save**

**Note** : Les storage policies ont déjà été créées automatiquement par le script SQL étape 1 !

---

## ⚙️ Étape 3 : Configurer Vercel (3 minutes)

### Dans Vercel Dashboard

1. **Ouvrir les variables d'environnement**
   - https://vercel.com/torps-projects/quote-insight-tally/settings/environment-variables

2. **Supprimer les anciennes variables** (si existantes)
   - `VITE_AUTH_PROVIDER`
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
   - `VITE_MOCK_API`

3. **Ajouter les nouvelles variables**

Cliquer **Add** pour chaque variable ci-dessous :

#### Variable 1
```
Key: VITE_AUTH_PROVIDER
Value: supabase
Environments: ✅ Production ✅ Preview ✅ Development
```

#### Variable 2
```
Key: VITE_SUPABASE_URL
Value: https://zvxasiwahpraasjzfhhl.supabase.co
Environments: ✅ Production ✅ Preview ✅ Development
```

#### Variable 3
```
Key: VITE_SUPABASE_ANON_KEY
Value: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inp2eGFzaXdhaHByYWFzanpmaGhsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjM0NTI0NjUsImV4cCI6MjA3OTAyODQ2NX0.h-pyJqeejzaNC68mxxXbsxx7VPvjWHRdAF_lebmJWYM
Environments: ✅ Production ✅ Preview ✅ Development
```

#### Variable 4
```
Key: VITE_MOCK_API
Value: false
Environments: ✅ Production ✅ Preview ✅ Development
```

#### Variable 5 (optionnelle - recommandée)
```
Key: VITE_APP_ENV
Value: production
Environments: ✅ Production only
```

4. **Save** (pour chaque variable)

5. **Redéployer**
   - Onglet **Deployments**
   - Dernier déploiement (commit c7d6aa8 ou plus récent)
   - Cliquer **⋮** (trois points) → **Redeploy**
   - Confirmer

---

## 🧪 Test Final

### Une fois Vercel redéployé (attendre 1-2 minutes)

1. **Ouvrir votre app** (URL Vercel)

2. **Console Browser** (F12)
   - Chercher : `[Services] Configuration:`
   - Doit afficher :
     ```
     mode: 'real'
     authProvider: 'supabase'
     services: {
       auth: 'SupabaseAuthService',
       devis: 'SupabaseDevisService',
       project: 'SupabaseProjectService'
     }
     ```

3. **Test Inscription**
   - Aller sur `/register`
   - S'inscrire avec email + password
   - **Vérifier dans Supabase** :
     - Authentication → Users (nouvel utilisateur)
     - Table Editor → users (profil créé automatiquement)

4. **Test Connexion**
   - Se connecter avec les credentials
   - Session devrait persister au refresh

5. **Test Création Projet**
   - Créer un nouveau projet
   - **Vérifier dans Supabase** :
     - Table Editor → projects (nouveau projet)

6. **Test Upload Devis**
   - Uploader un PDF ou image
   - **Vérifier dans Supabase** :
     - Storage → devis-uploads (fichier présent)
     - Table Editor → devis (record créé)

---

## ✅ Checklist Complète

- [ ] Script SQL exécuté (8 tables créées)
- [ ] Bucket `devis-uploads` créé (privé)
- [ ] 4 variables Vercel ajoutées
- [ ] Vercel redéployé
- [ ] Console affiche `mode: 'real'`
- [ ] Inscription fonctionne
- [ ] User créé dans Supabase
- [ ] Connexion fonctionne
- [ ] Projet créé et sauvegardé
- [ ] Upload devis fonctionne

---

## 🎉 Résultat

**Backend Supabase 100% opérationnel !**

- ✅ Auth réelle (inscription, connexion, session)
- ✅ Données persistantes (PostgreSQL)
- ✅ Upload fichiers (Supabase Storage)
- ✅ Sécurité multi-tenant (RLS policies)
- ✅ Prêt pour Phase 3 (AI/LLM)

---

## 🆘 Problèmes ?

### "Invalid API key"
- Vérifier l'anon key copiée (pas service_role)
- Redéployer Vercel

### "Row Level Security violation"
- Vérifier que le script SQL complet a été exécuté
- Table Editor → users → Policies (doit avoir des policies)

### Storage ne fonctionne pas
- Bucket nommé exactement `devis-uploads` (avec tiret)
- Bucket PRIVÉ (pas public)
- Storage policies créées par le script SQL

### Services toujours en mock
- Vérifier variables Vercel (4 variables présentes)
- Environnements cochés : Production + Preview + Development
- Redéployer (pas juste rebuild)

---

**Temps total : ~6 minutes** 🚀
