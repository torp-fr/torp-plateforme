# 🔧 FIX FINAL: Registration Database Error

## Le Problème

L'erreur "database error saving new user" survient parce que:
1. Après `signUp()`, l'utilisateur n'a pas encore de session active (en attente de confirmation email)
2. Sans session active, `auth.uid()` n'est pas disponible
3. La politique RLS bloque l'insertion car `auth.uid()` est NULL

## La Solution: Trigger de Base de Données

Au lieu d'insérer manuellement le profil utilisateur après inscription, on utilise un **trigger automatique** qui s'exécute avec `SECURITY DEFINER` (bypass RLS).

---

## 📋 Actions Requises (5 minutes)

### Étape 1: Exécuter le script de correction

1. Ouvrez Supabase: https://supabase.com/dashboard/project/zvxasiwahpraasjzfhhl
2. Cliquez sur **SQL Editor** dans la barre latérale
3. Cliquez sur **New Query**
4. Copiez-collez ce script:

```sql
-- Drop old INSERT policy (no longer needed)
DROP POLICY IF EXISTS "Users can create their own profile during registration" ON public.users;

-- Update the trigger function to include all user fields
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  INSERT INTO public.users (
    id,
    email,
    name,
    user_type,
    company,
    phone,
    email_verified,
    onboarding_completed,
    created_at,
    updated_at
  )
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'name', ''),
    COALESCE((NEW.raw_user_meta_data->>'user_type')::user_type, 'B2C'),
    NEW.raw_user_meta_data->>'company',
    NEW.raw_user_meta_data->>'phone',
    NEW.email_confirmed_at IS NOT NULL,
    FALSE,
    NOW(),
    NOW()
  );
  RETURN NEW;
END;
$$;

-- Recreate trigger
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();
```

5. Cliquez sur **Run** (ou `Ctrl+Enter`)
6. Vous devriez voir: **"Success. No rows returned"**

### Étape 2: Redéployer l'application

Les changements de code ont déjà été poussés sur Git.

Vercel va automatiquement redéployer, ou vous pouvez:
1. Aller sur https://vercel.com
2. Trouver votre projet
3. Cliquer **Redeploy**

---

## ✅ Vérification

### 1. Vérifier le trigger

```sql
SELECT trigger_name, event_object_table, action_statement
FROM information_schema.triggers
WHERE trigger_name = 'on_auth_user_created';
```

Résultat attendu: 1 ligne montrant le trigger sur `auth.users`

### 2. Vérifier les politiques RLS

```sql
SELECT policyname, cmd
FROM pg_policies
WHERE tablename = 'users'
ORDER BY cmd;
```

Résultat attendu: **2 politiques seulement** (plus d'INSERT policy)
- SELECT: Users can view their own data
- UPDATE: Users can update their own data

---

## 🧪 Test

1. Sur votre site, cliquez **Inscription**
2. Remplissez le formulaire:
   - **Nom**: Test User
   - **Email**: test123@example.com
   - **Mot de passe**: TestPass123!
   - **Confirmer**: TestPass123!
3. Cliquez **Créer mon compte**
4. ✅ Succès! Redirection vers le dashboard

### Vérification dans Supabase

1. **Authentication → Users**: Vous devriez voir `test123@example.com`
2. **Table Editor → users**: Le profil utilisateur devrait exister automatiquement

---

## 🔍 Comment ça marche

### Avant (ne fonctionnait pas)
```
1. signUp() → crée auth.users
2. Code essaie d'insérer dans public.users
3. ❌ RLS bloque (pas de session active)
```

### Après (fonctionne!)
```
1. signUp() → crée auth.users
2. ✅ Trigger s'exécute automatiquement
3. ✅ Profil créé avec SECURITY DEFINER (bypass RLS)
4. Code récupère le profil créé
```

### Avantages
- ✅ Pas de problème RLS
- ✅ Garantit que chaque utilisateur a un profil
- ✅ Ne peut pas être oublié ou sauté
- ✅ Fonctionne même sans confirmation email
- ✅ Atomique (tout ou rien)

---

## 🆘 En cas de problème

### Si l'erreur persiste après le script

1. Vérifiez que le trigger existe:
```sql
\df public.handle_new_user
```

2. Testez manuellement le trigger (en tant que superuser):
```sql
-- Cela devrait créer un utilisateur test
INSERT INTO auth.users (id, email, raw_user_meta_data)
VALUES (
  gen_random_uuid(),
  'trigger-test@example.com',
  '{"name": "Trigger Test", "user_type": "B2C"}'::jsonb
);

-- Vérifiez que le profil a été créé
SELECT * FROM public.users WHERE email = 'trigger-test@example.com';
```

3. Ouvrez la console du navigateur et partagez l'erreur complète

---

## 📝 Notes Techniques

- Le trigger utilise `SECURITY DEFINER` qui l'exécute avec les privilèges du propriétaire de la fonction
- Cela bypass RLS de manière sécurisée uniquement pour cette opération spécifique
- Les données utilisateur viennent de `raw_user_meta_data` (passé via `signUp()`)
- `COALESCE()` garantit qu'on a toujours une valeur valide (même si vide)
