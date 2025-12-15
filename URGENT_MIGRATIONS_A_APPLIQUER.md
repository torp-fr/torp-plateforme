# 🚨 URGENT : Migrations critiques à appliquer sur Supabase

## ⚠️ Problèmes actuels

Vous rencontrez actuellement **3 problèmes critiques** :

### 1. ❌ Inscription bloquée - Profil utilisateur non créé
**Symptôme** :
```
Failed to fetch user profile after registration: 406
```
- L'utilisateur est créé dans `auth.users` (vous recevez l'email)
- Mais le profil n'est PAS créé dans `public.users`
- Le trigger `handle_new_user()` ne peut pas insérer à cause de RLS

**Cause** : Migration 005 non appliquée

### 2. ❌ Upload de fichiers bloqué
**Symptôme** :
```
"new row violates row-level security policy"
Failed to upload file: 400 (403 Unauthorized)
```
- Impossible d'uploader des devis
- Le bucket `devis-uploads` n'a pas de policies RLS

**Cause** : Migration 006 non appliquée

### 3. ⚠️ Email de confirmation pointe vers localhost
**Symptôme** :
```
redirect_to=http://localhost:3000
```
- C'est **NORMAL en développement local**
- En production Vercel, ça pointera vers le bon domaine automatiquement

---

## ✅ SOLUTION : Appliquer les migrations dans Supabase

### 📋 Étape 1 : Appliquer la migration 005 (Inscription)

Cette migration corrige le problème d'inscription en restaurant les policies RLS manquantes.

**Comment faire** :

1. Ouvrez **Supabase Dashboard** : https://supabase.com/dashboard
2. Sélectionnez votre projet
3. Allez dans **SQL Editor** (icône `</>` dans la sidebar gauche)
4. Cliquez sur **New query**
5. **Copiez tout le contenu** de `supabase/migrations/005_fix_user_insert_policy.sql`
6. Collez-le dans l'éditeur SQL
7. Cliquez sur **RUN** (ou Ctrl+Enter)
8. ✅ Vérifiez qu'il n'y a **pas d'erreurs** dans le résultat

### 📋 Étape 2 : Appliquer la migration 006 (Storage)

Cette migration configure le bucket storage et les policies RLS pour permettre l'upload.

**Comment faire** :

1. Dans le même **SQL Editor**
2. Cliquez sur **New query**
3. **Copiez tout le contenu** de `supabase/migrations/006_storage_policies.sql`
4. Collez-le dans l'éditeur SQL
5. Cliquez sur **RUN** (ou Ctrl+Enter)
6. ✅ Vérifiez qu'il n'y a **pas d'erreurs** dans le résultat

---

## 🧪 Test après application des migrations

### Test 1 : Inscription

1. **Supprimez l'utilisateur de test** dans Supabase :
   - Allez dans **Authentication** > **Users**
   - Trouvez l'utilisateur avec l'email de test
   - Cliquez sur les 3 points > **Delete user**

2. **Créez un nouveau compte** :
   - Retournez sur l'application
   - Créez un nouveau compte B2C avec un nouvel email
   - ✅ L'inscription devrait réussir sans erreur
   - ✅ Vérifiez que le profil apparaît dans **Database** > **users** table

### Test 2 : Upload de devis

1. **Connectez-vous** avec le compte créé
2. **Uploadez un devis PDF**
3. ✅ L'upload devrait réussir
4. ✅ Le fichier devrait apparaître dans **Storage** > **devis-uploads**
5. ✅ L'analyse TORP devrait se lancer

---

## 🔍 Vérification des policies appliquées

### Vérifier les policies sur la table users :

```sql
SELECT
  policyname,
  cmd as command,
  qual as using_expression
FROM pg_policies
WHERE tablename = 'users'
ORDER BY policyname;
```

**Résultat attendu** :
- ✅ `Enable insert for authenticated users during signup` (INSERT)
- ✅ `Users can update their own profile` (UPDATE)
- ✅ `Users can view their own profile` (SELECT)
- ✅ `Admins can view all users` (SELECT)

### Vérifier les policies sur le storage :

```sql
SELECT
  policyname,
  cmd as command
FROM pg_policies
WHERE schemaname = 'storage' AND tablename = 'objects'
  AND policyname LIKE '%devis%'
ORDER BY policyname;
```

**Résultat attendu** :
- ✅ `Users can upload their own devis files` (INSERT)
- ✅ `Users can read their own devis files` (SELECT)
- ✅ `Users can update their own devis files` (UPDATE)
- ✅ `Users can delete their own devis files` (DELETE)
- ✅ `Admins can read all devis files` (SELECT)

### Vérifier que le bucket existe :

```sql
SELECT id, name, public, file_size_limit, allowed_mime_types
FROM storage.buckets
WHERE id = 'devis-uploads';
```

**Résultat attendu** :
```
id             | devis-uploads
name           | devis-uploads
public         | false
file_size_limit| 52428800 (50 MB)
allowed_mime_types | {application/pdf, image/png, image/jpeg, image/jpg}
```

---

## 📝 Notes importantes

### À propos du redirect localhost

Le redirect vers `http://localhost:3000` dans l'email de confirmation est **normal** si vous testez en local. Voici pourquoi :

```typescript
// Dans auth.service.ts ligne 121
emailRedirectTo: `${window.location.origin}/dashboard`
```

- **En local** : `window.location.origin` = `http://localhost:3000` ✅
- **En production** : `window.location.origin` = `https://votreapp.vercel.app` ✅

Donc **pas besoin de modifier le code**, ça fonctionne automatiquement selon l'environnement.

### Si vous voulez tester en production

1. Déployez sur Vercel
2. Testez l'inscription depuis l'URL de production
3. L'email pointera vers l'URL de production

### Ordre d'application des migrations

Il est **crucial** d'appliquer les migrations dans l'ordre :

1. ✅ Migration 005 d'abord (inscription)
2. ✅ Migration 006 ensuite (storage)

---

## ❓ Troubleshooting

### Erreur lors de l'application de la migration

Si vous avez une erreur, lisez le message d'erreur attentivement :

- **"function is_admin() does not exist"** :
  → Vous devez d'abord appliquer la migration 004

- **"bucket devis-uploads already exists"** :
  → Normal, la migration gère ce cas (ON CONFLICT)

- **"policy already exists"** :
  → Normal, la migration supprime les anciennes versions (DROP POLICY IF EXISTS)

### L'inscription échoue toujours après la migration

1. Vérifiez que la migration 005 s'est bien exécutée (pas d'erreur)
2. Vérifiez les policies avec la requête SQL ci-dessus
3. Supprimez l'ancien utilisateur de test
4. Essayez avec un nouvel email
5. Regardez les logs Supabase : **Logs** > **Postgres Logs**

### L'upload échoue toujours après la migration

1. Vérifiez que la migration 006 s'est bien exécutée
2. Vérifiez que le bucket existe avec la requête SQL ci-dessus
3. Vérifiez les policies storage avec la requête SQL ci-dessus
4. Assurez-vous d'être **bien connecté** (session active)
5. Regardez les logs : **Logs** > **Storage Logs**

---

## 🎯 Récapitulatif

**Avant les migrations** :
- ❌ Inscription bloquée (profil non créé)
- ❌ Upload bloqué (RLS storage)
- ⚠️ Email pointe vers localhost (normal en local)

**Après les migrations** :
- ✅ Inscription fonctionne (profil créé automatiquement)
- ✅ Upload fonctionne (policies RLS configurées)
- ✅ Email pointe vers le bon domaine selon l'environnement

**Action requise** :
1. Appliquer migration 005 dans Supabase SQL Editor
2. Appliquer migration 006 dans Supabase SQL Editor
3. Tester l'inscription avec un nouveau compte
4. Tester l'upload d'un devis

---

## 📞 Support

Si vous rencontrez des problèmes après avoir appliqué les migrations :

1. Vérifiez les logs Supabase (**Logs** dans la sidebar)
2. Vérifiez que les policies sont bien créées (requêtes SQL ci-dessus)
3. Essayez de supprimer et recréer le bucket si nécessaire
4. Contactez le support avec les logs d'erreur exacts
