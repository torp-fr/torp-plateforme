# 🔧 Fix: Database Error During Registration

## Problème
Erreur "database error saving new user" lors de l'inscription.

## Cause
Il manque la politique RLS (Row Level Security) **INSERT** pour la table `users`.
Lors de l'inscription, Supabase crée l'utilisateur dans `auth.users`, mais notre code ne peut pas insérer le profil dans `public.users` à cause du RLS.

## Solution Rapide (2 minutes)

### Étape 1: Ouvrir Supabase SQL Editor
1. Allez sur https://supabase.com/dashboard
2. Sélectionnez votre projet: **zvxasiwahpraasjzfhhl**
3. Cliquez sur **SQL Editor** dans la barre latérale gauche

### Étape 2: Exécuter le script de correction
1. Cliquez sur **New Query**
2. Copiez-collez ce code SQL:

```sql
-- Add missing INSERT policy for user registration
CREATE POLICY "Users can create their own profile during registration"
  ON public.users FOR INSERT
  WITH CHECK (auth.uid() = id);
```

3. Cliquez sur **Run** (ou appuyez sur `Ctrl+Enter`)
4. Vous devriez voir: **Success. No rows returned**

### Étape 3: Vérifier la politique
Exécutez cette requête pour confirmer:

```sql
SELECT policyname, cmd
FROM pg_policies
WHERE tablename = 'users'
ORDER BY policyname;
```

Vous devriez voir 3 politiques:
- ✅ Users can **create** their own profile during registration (INSERT)
- ✅ Users can **update** their own data (UPDATE)
- ✅ Users can **view** their own data (SELECT)

## Test
1. Retournez sur votre site
2. Cliquez sur **Inscription**
3. Remplissez le formulaire et créez un compte
4. ✅ Inscription réussie! Redirection vers le dashboard

## Technique
La politique RLS créée permet à un utilisateur nouvellement authentifié de créer son propre profil:
- `auth.uid()` = l'ID de l'utilisateur qui vient de s'inscrire dans Supabase Auth
- `id` = l'ID dans la table `users`
- `WITH CHECK (auth.uid() = id)` = permet l'insertion seulement si les IDs correspondent

Cela garantit qu'un utilisateur ne peut créer que son propre profil, pas celui d'un autre utilisateur.
