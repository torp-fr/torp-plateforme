# 🚨 Solution complète : Inscription qui ne crée pas de profil

## 📊 Problème actuel

Lors de l'inscription, l'utilisateur est créé dans `auth.users` mais **PAS** dans `public.users`.

**Symptômes** :
- ✅ Vous recevez l'email de confirmation
- ❌ Erreur 406 lors de la récupération du profil
- ❌ L'utilisateur n'apparaît pas dans la table `users`
- ❌ Impossible d'uploader un devis (pas de profil = pas d'auth)

**Cause racine** : Le trigger `handle_new_user()` échoue à cause de RLS ou d'un problème de permissions.

---

## 🎯 Solution en 3 étapes

### ÉTAPE 1 : Diagnostic (OPTIONNEL mais recommandé)

**Fichier** : `DIAGNOSTIC_INSCRIPTION.sql`

Ce script affiche toutes les informations nécessaires pour comprendre le problème.

**Comment l'utiliser** :
1. Ouvrez **Supabase Dashboard** > **SQL Editor**
2. Créez une nouvelle requête
3. Copiez-collez **tout le contenu** de `DIAGNOSTIC_INSCRIPTION.sql`
4. Cliquez sur **RUN**
5. **Notez les résultats**, surtout :
   - Nombre d'utilisateurs dans "AUTH USERS"
   - Nombre d'utilisateurs dans "PUBLIC USERS"
   - Liste des "ORPHAN USERS" (utilisateurs sans profil)
   - Résultat du "Test de création de profil"

---

### ÉTAPE 2 : Fix définitif du trigger ⭐ **OBLIGATOIRE**

**Fichier** : `FIX_TRIGGER_DEFINITIVE.sql`

Ce script recrée complètement le trigger avec :
- ✅ `SECURITY DEFINER` pour bypasser RLS
- ✅ Meilleure gestion d'erreurs avec logs
- ✅ Policy simplifiée qui permet au trigger d'insérer
- ✅ Test automatique inclus

**Comment l'utiliser** :
1. Ouvrez **Supabase Dashboard** > **SQL Editor**
2. Créez une **nouvelle requête**
3. Copiez-collez **tout le contenu** de `FIX_TRIGGER_DEFINITIVE.sql`
4. Cliquez sur **RUN**
5. Attendez que ça se termine (peut prendre 10-20 secondes)
6. ✅ Vérifiez qu'il n'y a **pas d'erreurs**
7. ✅ Vous devriez voir "✓ TEST RÉUSSI : Le profil a été créé automatiquement !"

**Résultats attendus** :
- Le trigger `on_auth_user_created` est actif
- La fonction `handle_new_user()` a `SECURITY DEFINER` activé
- Une policy `Allow trigger to insert user profiles` existe
- Le test automatique affiche "✓ TEST RÉUSSI"

---

### ÉTAPE 3 : Créer les profils manquants ⭐ **OBLIGATOIRE**

**Fichier** : `FIX_ORPHAN_USERS.sql`

Ce script crée manuellement les profils pour tous les utilisateurs qui n'en ont pas encore.

**Comment l'utiliser** :
1. Ouvrez **Supabase Dashboard** > **SQL Editor**
2. Créez une **nouvelle requête**
3. Copiez-collez **tout le contenu** de `FIX_ORPHAN_USERS.sql`
4. Cliquez sur **RUN**
5. Attendez les résultats
6. ✅ Vous devriez voir la liste des profils créés avec `success = true`
7. ✅ "REMAINING ORPHANS" devrait être vide

**Ce que ça fait** :
- Trouve tous les utilisateurs dans `auth.users` qui n'ont pas de profil dans `public.users`
- Crée automatiquement leur profil avec les données de `raw_user_meta_data`
- Affiche les succès et les éventuelles erreurs

---

## 🧪 Vérification finale

Après avoir exécuté les 3 étapes, vérifiez :

### 1. Compter les utilisateurs

```sql
-- Devrait retourner le même nombre partout
SELECT
  (SELECT COUNT(*) FROM auth.users) as auth_users,
  (SELECT COUNT(*) FROM public.users) as public_users,
  (SELECT COUNT(*) FROM auth.users au LEFT JOIN public.users pu ON au.id = pu.id WHERE pu.id IS NULL) as orphans;
```

**Résultat attendu** :
- `auth_users` = 2 (par exemple)
- `public_users` = 2 (même nombre !)
- `orphans` = 0 (aucun orphelin)

### 2. Vérifier le trigger

```sql
SELECT
  trigger_name,
  event_object_table,
  action_statement
FROM information_schema.triggers
WHERE trigger_name = 'on_auth_user_created';
```

**Résultat attendu** : 1 ligne avec `trigger_name = on_auth_user_created`

### 3. Vérifier les policies

```sql
SELECT policyname, cmd
FROM pg_policies
WHERE tablename = 'users'
ORDER BY policyname;
```

**Résultat attendu** (au moins 4 policies) :
- `Admins can view all users` (SELECT)
- `Allow trigger to insert user profiles` (INSERT)
- `Users can update their own profile` (UPDATE)
- `Users can view their own profile` (SELECT)

---

## 🎉 Test final : Créer un nouveau compte

1. **Supprimez les anciens comptes de test** :
   ```
   Supabase Dashboard > Authentication > Users
   Supprimez tous les utilisateurs de test
   ```

2. **Créez un nouveau compte** :
   - Allez sur votre application
   - Créez un compte B2C avec un **nouvel email**
   - ✅ L'inscription devrait réussir sans erreur

3. **Vérifiez le profil** :
   ```sql
   SELECT * FROM public.users ORDER BY created_at DESC LIMIT 1;
   ```
   ✅ Vous devriez voir le nouvel utilisateur

4. **Testez l'upload** :
   - Uploadez un PDF de devis
   - ✅ L'upload devrait réussir
   - ✅ L'analyse TORP devrait se lancer

---

## ❓ Troubleshooting

### Le test dans FIX_TRIGGER_DEFINITIVE échoue

**Erreur possible** : "permission denied for table users"

**Solution** :
```sql
GRANT ALL ON public.users TO postgres;
GRANT ALL ON public.users TO service_role;
ALTER TABLE public.users OWNER TO postgres;
```

### Les profils ne sont toujours pas créés automatiquement

**Vérifications** :

1. Le trigger est-il actif ?
   ```sql
   SELECT * FROM information_schema.triggers WHERE trigger_name = 'on_auth_user_created';
   ```

2. La fonction a-t-elle SECURITY DEFINER ?
   ```sql
   SELECT proname, prosecdef FROM pg_proc WHERE proname = 'handle_new_user';
   ```
   `prosecdef` doit être `true`

3. Regardez les logs Postgres :
   ```
   Supabase Dashboard > Logs > Postgres Logs
   ```
   Cherchez "[handle_new_user]" pour voir les messages du trigger

### FIX_ORPHAN_USERS retourne des erreurs

Si vous voyez `success = false` avec un `error_message`, partagez l'erreur exacte.

**Erreurs communes** :
- "duplicate key value" → Le profil existe déjà, ignorez
- "permission denied" → Exécutez les GRANT ci-dessus
- "violates row-level security" → La policy INSERT n'est pas correcte

---

## 📝 Ordre d'exécution (récapitulatif)

1. ✅ **DIAGNOSTIC_INSCRIPTION.sql** (optionnel) - Comprendre le problème
2. ✅ **FIX_TRIGGER_DEFINITIVE.sql** (obligatoire) - Corriger le trigger
3. ✅ **FIX_ORPHAN_USERS.sql** (obligatoire) - Créer les profils manquants
4. ✅ Vérifications SQL ci-dessus
5. ✅ Test avec un nouveau compte

---

## 🆘 Si rien ne fonctionne

1. Partagez-moi les résultats de **DIAGNOSTIC_INSCRIPTION.sql**
2. Partagez-moi les logs Postgres (Supabase Dashboard > Logs)
3. Partagez-moi les erreurs exactes de FIX_TRIGGER_DEFINITIVE.sql

---

## 📊 Différence entre les fichiers

| Fichier | But | Quand l'utiliser |
|---------|-----|------------------|
| `DIAGNOSTIC_INSCRIPTION.sql` | Comprendre le problème | Avant de fix, pour diagnostiquer |
| `FIX_TRIGGER_DEFINITIVE.sql` | Fix permanent du trigger | Obligatoire, pour les futurs utilisateurs |
| `FIX_ORPHAN_USERS.sql` | Créer les profils existants | Obligatoire, pour les utilisateurs actuels |
| `QUICK_FIX_ALL_IN_ONE.sql` | Fix rapide migrations 005+006 | Déjà exécuté (storage OK) |

---

Bonne chance ! 🚀
