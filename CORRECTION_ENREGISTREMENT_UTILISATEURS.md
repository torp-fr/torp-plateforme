# 🔧 Correction: Erreur 406 - Enregistrement utilisateurs

## 🎯 Problème identifié

L'enregistrement des nouveaux utilisateurs B2C échoue avec une **erreur 406** lors de la récupération du profil utilisateur.

### Cause racine

La migration `004_admin_access_policies.sql` a supprimé les policies RLS essentielles :
- ❌ Policy **INSERT** manquante → Les utilisateurs ne peuvent pas créer leur profil
- ❌ Policy **UPDATE** manquante → Les utilisateurs ne peuvent pas mettre à jour leur profil

## ✅ Solution

J'ai créé un script SQL de correction complet : **`supabase/FIX_USER_REGISTRATION_COMPLETE.sql`**

### Ce que fait le script :

1. **Restaure le trigger auto-create**
   - Crée automatiquement le profil dans `public.users` quand un utilisateur s'inscrit
   - Utilise `SECURITY DEFINER` pour contourner les RLS

2. **Réinstalle toutes les policies RLS**
   - SELECT : Utilisateurs voient leur propre profil
   - SELECT : Admins voient tous les utilisateurs
   - INSERT : Utilisateurs peuvent créer leur profil (backup si trigger échoue)
   - UPDATE : Utilisateurs peuvent mettre à jour leur profil

3. **Vérifie que tout fonctionne**
   - Confirme que le trigger existe
   - Confirme que les 4 policies sont en place

---

## 📋 Instructions d'application

### Étape 1 : Ouvrir Supabase SQL Editor

1. Allez sur https://supabase.com/dashboard
2. Sélectionnez votre projet TORP
3. Dans le menu latéral, cliquez sur **SQL Editor**

### Étape 2 : Exécuter le script de correction

1. Cliquez sur **"New query"**
2. Ouvrez le fichier `supabase/FIX_USER_REGISTRATION_COMPLETE.sql`
3. **Copiez tout le contenu** du fichier
4. **Collez-le** dans le SQL Editor
5. Cliquez sur **"Run"** (ou Ctrl+Enter)

### Étape 3 : Vérifier le résultat

Vous devriez voir dans l'output :

```
✓ Trigger on_auth_user_created créé avec succès
✓ 4 policies RLS configurées sur la table users

============================================
CORRECTION TERMINÉE AVEC SUCCÈS!
============================================
```

---

## 🧪 Test de l'enregistrement

### Test 1 : Nouvel utilisateur B2C

1. **Déconnectez-vous** de l'application
2. Allez sur la page **Inscription**
3. Créez un nouveau compte :
   - Email : `test@example.com`
   - Nom : `Test User`
   - Type : `B2C` (Particulier)
   - Mot de passe : `Test1234!`
4. Cliquez sur **S'inscrire**

### Résultat attendu ✅

- ✅ Inscription réussie sans erreur
- ✅ Redirection vers le dashboard
- ✅ Profil utilisateur visible dans Supabase :
  - Table `auth.users` : Utilisateur auth créé
  - Table `public.users` : Profil créé automatiquement

### Si ça ne marche toujours pas ❌

Vérifiez dans la console navigateur les erreurs et envoyez-moi :
1. Le message d'erreur exact
2. Le contenu de l'onglet Network (requête qui échoue)

---

## 🔍 Diagnostic complémentaire (optionnel)

Si le problème persiste, exécutez ce diagnostic dans Supabase SQL Editor :

```sql
-- Vérifier le trigger
SELECT
  trigger_name,
  event_manipulation,
  event_object_table
FROM information_schema.triggers
WHERE trigger_name = 'on_auth_user_created';

-- Vérifier les policies
SELECT
  policyname,
  cmd,
  qual IS NOT NULL as has_using,
  with_check IS NOT NULL as has_with_check
FROM pg_policies
WHERE tablename = 'users'
AND schemaname = 'public';

-- Vérifier les utilisateurs existants
SELECT id, email, name, user_type, created_at
FROM public.users
ORDER BY created_at DESC
LIMIT 5;
```

---

## 📝 Notes techniques

### Pourquoi l'erreur 406 ?

L'erreur **406 Not Acceptable** de Supabase signifie :
- La requête demande un format de réponse que l'API ne peut pas fournir
- Généralement causé par des RLS qui bloquent l'accès aux données

### Pourquoi utiliser un trigger ?

Le trigger `SECURITY DEFINER` :
- S'exécute avec les privilèges du créateur (superuser)
- Contourne les RLS lors de la création initiale
- Garantit que le profil est toujours créé

### Pourquoi garder aussi la policy INSERT ?

La policy INSERT sert de **backup** :
- Si le trigger échoue pour une raison quelconque
- L'utilisateur peut quand même créer son profil manuellement
- Meilleure résilience

---

## ✅ Checklist finale

Après avoir appliqué le script :

- [ ] Script exécuté sans erreur dans Supabase SQL Editor
- [ ] Message de succès affiché
- [ ] 4 policies visibles dans l'output
- [ ] Trigger confirmé créé
- [ ] Test d'inscription réussi
- [ ] Profil visible dans `public.users`

---

## 🆘 Besoin d'aide ?

Si le problème persiste après avoir suivi ces étapes :

1. Vérifiez que vous avez exécuté **tout le script** (pas juste une partie)
2. Vérifiez que vous êtes sur le **bon projet** Supabase
3. Envoyez-moi les logs de la console navigateur
4. Envoyez-moi l'output du script de diagnostic ci-dessus

---

**Bonne correction ! 🚀**
