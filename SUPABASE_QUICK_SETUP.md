# 🚀 Configuration Rapide Supabase pour TORP

Guide simplifié en 5 étapes pour configurer Supabase.

**Projet Supabase :** https://zvxasiwahpraasjzfhhl.supabase.co

---

## ⚠️ Important

Votre projet contient déjà des tables d'un autre schéma. Il faut réinitialiser la base de données avant d'appliquer le schéma TORP.

---

## 📝 Étape 1 : Réinitialiser la Base de Données

### Dans Supabase Dashboard

1. **Aller dans SQL Editor**
   - https://app.supabase.com/project/zvxasiwahpraasjzfhhl/sql
   - Cliquer **New Query**

2. **Copier le script de reset**

   Ouvrir le fichier `supabase/000_reset_database.sql` et copier TOUT le contenu.

   Ou copier directement ci-dessous :

```sql
-- TORP Database Reset Script
DROP TABLE IF EXISTS public.projects CASCADE;
DROP TABLE IF EXISTS public.user_profiles CASCADE;
DROP TABLE IF EXISTS public.tenants CASCADE;
DROP TABLE IF EXISTS public.activity_logs CASCADE;
DROP TABLE IF EXISTS public.market_data CASCADE;
DROP TABLE IF EXISTS public.notifications CASCADE;
DROP TABLE IF EXISTS public.payments CASCADE;
DROP TABLE IF EXISTS public.devis CASCADE;
DROP TABLE IF EXISTS public.companies CASCADE;
DROP TABLE IF EXISTS public.users CASCADE;

DROP FUNCTION IF EXISTS public.get_user_tenant() CASCADE;
DROP FUNCTION IF EXISTS public.update_updated_at_column() CASCADE;
DROP FUNCTION IF EXISTS public.handle_new_user() CASCADE;
DROP FUNCTION IF EXISTS public.calculate_torp_score(UUID) CASCADE;
DROP FUNCTION IF EXISTS public.assign_grade(INTEGER) CASCADE;

DROP TYPE IF EXISTS user_type CASCADE;
DROP TYPE IF EXISTS project_status CASCADE;
DROP TYPE IF EXISTS devis_status CASCADE;
DROP TYPE IF EXISTS payment_status CASCADE;
DROP TYPE IF EXISTS notification_type CASCADE;

REVOKE ALL ON ALL TABLES IN SCHEMA public FROM authenticated;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA public FROM authenticated;

SELECT 'Database reset complete. Ready for TORP schema.' as status;
```

3. **Exécuter**
   - Coller dans SQL Editor
   - Cliquer **Run** (Ctrl+Enter)
   - Attendre le message : `"Database reset complete. Ready for TORP schema."`

4. **Vérifier**
   - Table Editor → Devrait être vide (aucune table)

---

## 📝 Étape 2 : Appliquer le Schéma TORP

### Dans Supabase SQL Editor

1. **Nouvelle Query**
   - New Query

2. **Copier le schéma TORP**

   Ouvrir le fichier `supabase/migrations/001_initial_schema.sql` (564 lignes)

   **Copier TOUT le contenu** (du début `-- TORP Database Schema` jusqu'à la fin)

3. **Exécuter**
   - Coller dans SQL Editor
   - Cliquer **Run**
   - Attendre ~5-10 secondes

4. **Vérifier les tables créées**
   - Table Editor → Vous devriez voir **8 tables** :
     - ✅ users
     - ✅ companies
     - ✅ projects
     - ✅ devis
     - ✅ payments
     - ✅ notifications
     - ✅ market_data
     - ✅ activity_logs

---

## 📝 Étape 3 : Créer le Storage Bucket

### Dans Supabase Dashboard

1. **Aller dans Storage**
   - https://app.supabase.com/project/zvxasiwahpraasjzfhhl/storage/buckets

2. **Create new bucket**
   ```
   Name: devis-uploads
   Public: ❌ NO (must be PRIVATE)
   File size limit: 10485760 (10MB)
   Allowed MIME types: application/pdf, image/jpeg, image/png
   ```

3. **Save**

---

## 📝 Étape 4 : Appliquer les Storage Policies

### Dans Supabase SQL Editor

1. **New Query**

2. **Copier les storage policies**

   Ouvrir le fichier `supabase/storage-policies.sql` (corrigé) et copier TOUT le contenu.

   Ou copier ci-dessous :

```sql
-- Storage Policies for devis-uploads bucket

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can upload devis to their folder" ON storage.objects;
DROP POLICY IF EXISTS "Users can view their own devis files" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their own devis files" ON storage.objects;
DROP POLICY IF EXISTS "Users can update their own devis files" ON storage.objects;

-- Policy 1: Upload
CREATE POLICY "Users can upload devis to their folder"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'devis-uploads' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

-- Policy 2: View
CREATE POLICY "Users can view their own devis files"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'devis-uploads' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

-- Policy 3: Delete
CREATE POLICY "Users can delete their own devis files"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'devis-uploads' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

-- Policy 4: Update
CREATE POLICY "Users can update their own devis files"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'devis-uploads' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

SELECT 'Storage policies created successfully.' as status;
```

3. **Run**
   - Attendre le message de confirmation

4. **Vérifier**
   - Storage → devis-uploads → Policies
   - Devrait voir 4 policies actives

---

## 📝 Étape 5 : Activer Email Authentication

### Dans Supabase Dashboard

1. **Authentication** → **Providers**
2. **Email** : Activer
   - ✅ Enable Email provider
   - ✅ Confirm email : **Enabled** (recommandé)
3. **Save**

---

## ✅ Vérification Complète

Checklist avant de passer à Vercel :

- [ ] Base de données réinitialisée
- [ ] 8 tables TORP créées
- [ ] Bucket `devis-uploads` créé (privé)
- [ ] 4 storage policies appliquées
- [ ] Email auth activée

---

## ⚙️ Configurer Vercel

Une fois Supabase configuré, aller dans Vercel :

### Variables à ajouter

https://vercel.com/torps-projects/quote-insight-tally/settings/environment-variables

Cliquer **Add** pour chaque variable :

#### Variable 1
```
Name: VITE_AUTH_PROVIDER
Value: supabase
Environments: ✅ Production ✅ Preview ✅ Development
```

#### Variable 2
```
Name: VITE_SUPABASE_URL
Value: https://zvxasiwahpraasjzfhhl.supabase.co
Environments: ✅ Production ✅ Preview ✅ Development
```

#### Variable 3
```
Name: VITE_SUPABASE_ANON_KEY
Value: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inp2eGFzaXdhaHByYWFzanpmaGhsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjM0NTI0NjUsImV4cCI6MjA3OTAyODQ2NX0.h-pyJqeejzaNC68mxxXbsxx7VPvjWHRdAF_lebmJWYM
Environments: ✅ Production ✅ Preview ✅ Development
```

#### Variable 4
```
Name: VITE_MOCK_API
Value: false
Environments: ✅ Production ✅ Preview ✅ Development
```

### Redéployer

1. **Deployments** tab
2. Dernier déploiement (commit 1e3721e ou plus récent)
3. **⋮** (trois points) → **Redeploy**
4. Confirmer

---

## 🧪 Tester

Une fois Vercel redéployé :

### Test 1 : Console Logs
1. Ouvrir votre app Vercel
2. F12 (Console développeur)
3. Chercher : `[Services] Configuration:`
4. Devrait afficher `mode: 'real'`

### Test 2 : Inscription
1. Aller sur `/register`
2. S'inscrire avec email + password
3. Vérifier dans Supabase :
   - Authentication → Users (nouvel utilisateur)
   - Table Editor → users (profil créé)

### Test 3 : Connexion
1. Se connecter
2. Session devrait persister au refresh

### Test 4 : Créer Projet
1. Créer un projet
2. Vérifier dans Table Editor → projects

### Test 5 : Upload Devis
1. Uploader un PDF
2. Vérifier :
   - Storage → devis-uploads (fichier présent)
   - Table Editor → devis (record créé)

---

## ✅ Succès !

Si tous les tests passent :
- ✅ Backend Supabase 100% fonctionnel
- ✅ Données persistantes
- ✅ Prêt pour Phase 3 (AI/LLM)

---

## 🆘 Problèmes ?

### Erreur : "Invalid API key"
- Vérifier l'anon key dans Settings → API
- Mettre à jour dans Vercel
- Redéployer

### Erreur : "Row Level Security violation"
- Vérifier que le schéma complet a été exécuté
- Table Editor → users → Policies (doit avoir des policies)

### Storage ne fonctionne pas
- Vérifier nom bucket : exactement `devis-uploads`
- Vérifier : bucket est PRIVÉ (pas public)
- Vérifier : 4 policies créées

---

**Temps estimé total : 15-20 minutes**

Bonne configuration ! 🚀
