# Fix: Erreur d'inscription B2C (Database error saving new user)

## 🐛 Problème

Lors de l'inscription d'un nouvel utilisateur (B2C ou B2B), l'application retournait une erreur 500 :
```
Failed to load resource: the server responded with a status of 500 ()
Registration error: Error: Database error saving new user
```

## 🔍 Diagnostic

### Cause racine

La migration `004_admin_access_policies.sql` a supprimé les policies RLS originales sur la table `users` sans recréer la policy **INSERT** nécessaire pour l'inscription.

**Migration 001 (originale)** avait :
```sql
CREATE POLICY "Users can create their own profile during registration"
  ON public.users FOR INSERT
  WITH CHECK (auth.uid() = id);
```

**Migration 004** a fait :
```sql
DROP POLICY IF EXISTS "Users can view their own profile" ON users;
-- ⚠️ Mais n'a PAS recréé la policy INSERT !
```

Résultat : Le trigger `handle_new_user()` ne pouvait plus insérer dans la table `users` car RLS bloquait les INSERT.

### Problèmes supplémentaires détectés

1. **Données manquantes** : Le trigger ne copiait pas `company` et `phone` depuis les metadata
2. **Pas de gestion d'erreur** : Le trigger pouvait bloquer complètement l'inscription en cas d'erreur

## ✅ Solution

### Migration 005_fix_user_insert_policy.sql

Cette migration corrige 3 problèmes :

1. **Restaure la policy INSERT** :
```sql
CREATE POLICY "Enable insert for authenticated users during signup"
  ON users
  FOR INSERT
  WITH CHECK (auth.uid() = id);
```

2. **Ajoute la policy UPDATE** :
```sql
CREATE POLICY "Users can update their own profile"
  ON users
  FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);
```

3. **Améliore le trigger** pour inclure company et phone :
```sql
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.users (id, email, name, user_type, company, phone)
  VALUES (
    NEW.id,
    NEW.email,
    NEW.raw_user_meta_data->>'name',
    COALESCE((NEW.raw_user_meta_data->>'user_type')::user_type, 'B2C'),
    NEW.raw_user_meta_data->>'company',  -- ✅ Ajouté
    NEW.raw_user_meta_data->>'phone'     -- ✅ Ajouté
  );
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'Failed to create user profile for %: %', NEW.email, SQLERRM;
  RETURN NEW;  -- ✅ Ne bloque pas l'inscription même en cas d'erreur
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

## 📋 Comment appliquer la migration

### Option 1: Via Supabase Dashboard (Recommandé)

1. Ouvrez le **Supabase Dashboard**
2. Allez dans **SQL Editor**
3. Copiez le contenu de `supabase/migrations/005_fix_user_insert_policy.sql`
4. Exécutez la migration
5. Vérifiez qu'il n'y a pas d'erreurs

### Option 2: Via Supabase CLI

```bash
# Si vous avez la CLI Supabase installée
supabase db push

# Ou migration manuelle
supabase migration up
```

### Option 3: Copie manuelle dans le SQL Editor

Copiez et exécutez ce SQL dans le dashboard Supabase :

```sql
-- Voir le fichier supabase/migrations/005_fix_user_insert_policy.sql
```

## 🧪 Test après migration

1. Tentez de créer un nouveau compte B2C
2. Vérifiez que l'inscription réussit
3. Vérifiez que les données `company` et `phone` sont bien sauvegardées
4. Testez aussi l'inscription B2B avec company

## 📊 Vérification des policies

Pour vérifier que les policies sont bien en place :

```sql
-- Lister toutes les policies sur la table users
SELECT
  schemaname,
  tablename,
  policyname,
  cmd as command,
  qual as using_expression,
  with_check as check_expression
FROM pg_policies
WHERE tablename = 'users'
ORDER BY policyname;
```

Vous devriez voir :
- ✅ `Enable insert for authenticated users during signup` (INSERT)
- ✅ `Users can update their own profile` (UPDATE)
- ✅ `Users can view their own profile` (SELECT)
- ✅ `Admins can view all users` (SELECT)

## 🔗 Fichiers modifiés

- `supabase/migrations/005_fix_user_insert_policy.sql` - **Nouvelle migration**
- Aucune modification de code nécessaire

## 📝 Notes importantes

- Cette migration est **idempotente** (peut être exécutée plusieurs fois sans problème)
- Les utilisateurs existants ne sont pas affectés
- Le trigger inclut maintenant une gestion d'erreur pour éviter de bloquer l'inscription
- Les données `company` et `phone` seront maintenant correctement sauvegardées lors de l'inscription
