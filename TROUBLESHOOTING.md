# 🐛 Dépannage - Dashboard Admin TORP

## Problème : Les cartes restent vides (feedbacks, inscriptions, analyses)

### 🔍 Étape 1 : Diagnostic

**Allez sur la page de diagnostic** :
👉 http://localhost:5173/admin/diagnostic (dev)
👉 https://votre-app.vercel.app/admin/diagnostic (prod)

Ou cliquez sur le bouton **🔧 Diagnostic** en haut à droite de `/admin/analytics`

Cette page va tester :
- ✅ Connexion Supabase
- ✅ Utilisateur connecté
- ✅ Type d'utilisateur (admin ou non)
- ✅ Fonctions RPC (get_all_feedbacks, get_all_users, etc.)
- ✅ Accès aux tables

### 📋 Étape 2 : Identifier le problème

Selon les résultats du diagnostic :

---

#### ❌ **Problème A : "Fonction is_admin() n'existe pas"**

**Cause** : La migration 004 n'a pas été appliquée

**Solution** :

```bash
cd /home/user/quote-insight-tally
supabase db push
```

Ou via Dashboard Supabase :
1. Dashboard Supabase → SQL Editor
2. Copiez `supabase/migrations/004_admin_access_policies.sql`
3. Collez et **Run**

---

#### ⚠️ **Problème B : "FALSE (vous n'êtes PAS admin)"**

**Cause** : Votre utilisateur n'a pas le type 'admin'

**Solution** : Modifier votre profil dans Supabase

1. Dashboard Supabase → Table Editor → **users**
2. Trouvez votre ligne (par email)
3. Modifiez `user_type` → changez en **`admin`**
4. Retournez sur `/admin/analytics` et cliquez **Actualiser**

**Exemple SQL** :
```sql
UPDATE users
SET user_type = 'admin'
WHERE email = 'votre-email@example.com';
```

---

#### ❌ **Problème C : "Connexion Supabase échouée"**

**Cause** : Variables d'environnement incorrectes

**Solution** : Vérifier `.env.local`

```bash
VITE_SUPABASE_URL=https://xxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

Sur Vercel, vérifiez les **Environment Variables** dans Settings.

---

#### ⚠️ **Problème D : Tables vides mais connexion OK**

**Cause** : Aucune donnée en base

**Solution** : Créez des données de test

1. **Créez un compte** : Allez sur `/register` et créez un compte
2. **Soumettez un feedback** : Utilisez le widget de feedback
3. **Retournez sur** `/admin/analytics` et cliquez **Actualiser**

---

### 🔧 Étape 3 : Vérification finale

Après avoir résolu le problème :

1. ✅ Retournez sur `/admin/analytics`
2. ✅ Cliquez sur **🔄 Actualiser**
3. ✅ Ouvrez la **Console JavaScript** (F12)
4. ✅ Vérifiez les logs :

**Logs attendus (succès)** :
```
✓ Feedbacks loaded via RPC: 5
✓ Users loaded via RPC: 12
✓ Analyses loaded via RPC: 8
```

**Logs de fallback (fonctionne mais pas optimal)** :
```
⚠️ RPC get_all_feedbacks failed, trying direct query
✓ Feedbacks loaded via direct query: 5
```

---

## 📊 Vérifier que les données existent vraiment

### Option 1 : Via Supabase Dashboard

1. Dashboard Supabase → **Table Editor**
2. Sélectionnez `user_feedback` → Voyez-vous des lignes ?
3. Sélectionnez `users` → Voyez-vous votre compte ?
4. Sélectionnez `analytics_events` → Voyez-vous des événements ?

### Option 2 : Via SQL Editor

```sql
-- Compter les feedbacks
SELECT COUNT(*) FROM user_feedback;

-- Compter les utilisateurs
SELECT COUNT(*) FROM users;

-- Compter les événements analytics
SELECT COUNT(*) FROM analytics_events;

-- Voir votre profil utilisateur
SELECT * FROM users WHERE email = 'votre-email@example.com';
```

---

## 🚨 Cas spéciaux

### Déploiement Vercel

Si ça fonctionne en local mais pas en prod :

1. ✅ Variables d'environnement définies dans **Vercel → Settings → Environment Variables**
2. ✅ Redéployer après avoir ajouté les variables : **Deployments → Redeploy**
3. ✅ Vérifier que les migrations sont appliquées sur Supabase (pas en local !)

### Migration déjà appliquée mais ne fonctionne toujours pas

Réappliquez la migration :

```sql
-- 1. Supprimer les anciennes fonctions
DROP FUNCTION IF EXISTS is_admin();
DROP FUNCTION IF EXISTS get_all_feedbacks();
DROP FUNCTION IF EXISTS get_all_users();
DROP FUNCTION IF EXISTS get_all_analyses();

-- 2. Re-coller tout le contenu de 004_admin_access_policies.sql
-- (le fichier complet)
```

---

## 🆘 Support

### Checklist avant de demander de l'aide :

- [ ] J'ai lancé le diagnostic (`/admin/diagnostic`)
- [ ] J'ai vérifié que je suis admin (`user_type = 'admin'`)
- [ ] J'ai appliqué la migration 004
- [ ] J'ai actualisé la page
- [ ] J'ai vérifié la console (F12) pour les erreurs
- [ ] Les tables contiennent des données (vérfié dans Supabase)

### Logs à fournir :

1. **Console JavaScript** (F12 → Console) - copier les logs
2. **Page de diagnostic** - screenshot des résultats
3. **Supabase logs** - Dashboard → Logs

---

**Dernière mise à jour** : 2025-11-26
