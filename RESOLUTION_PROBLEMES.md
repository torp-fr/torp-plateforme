# 🔧 Guide de Résolution des Problèmes TORP

## ⚠️ Problèmes Actuels et Solutions

### 1. ✅ RÉSOLU : Boutons Header "Particulier/Professionnel"
**Problème** : Les boutons redirigent vers des anciens dashboards mock obsolètes.

**Solution appliquée** :
- Les boutons "Particuliers" et "Professionnels BTP" redirigent maintenant vers `/register`
- Les anciens liens `/b2c-dashboard` et `/improved-b2b-dashboard` ont été remplacés

**Action requise** : Redéployer l'application pour voir les changements.

---

### 2. 🔍 Session ne persiste pas après fermeture du navigateur

**Diagnostic** :
La console affiche `[Auth State Change] Event: SIGNED_IN Session: true` mais vous devez vous reconnecter.

**Actions à vérifier** :

#### A. Vérifier les cookies dans votre navigateur
1. Ouvrez les DevTools (F12)
2. Onglet "Application" → "Storage" → "Local Storage"
3. Cherchez `sb-[project-id]-auth-token`
4. Si absent ou vide → problème de stockage

#### B. Vérifier la configuration Supabase
```typescript
// Déjà configuré dans src/lib/supabase.ts
{
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
    storage: window.localStorage
  }
}
```

#### C. Tester la restauration de session
1. Connectez-vous
2. Ouvrez la console
3. Vous devriez voir : `✓ Session restaurée: votre@email.com`
4. Fermez le navigateur
5. Rouvrez et allez sur le site
6. Si vous voyez `ℹ️ Aucune session active` → le localStorage n'a pas sauvegardé

**Solutions possibles** :
- Désactivez les extensions de navigateur (AdBlock, Privacy Badger) qui bloquent le localStorage
- Vérifiez que les cookies ne sont pas désactivés
- Testez en navigation privée désactivée
- Videz le cache : localStorage.clear() dans la console

---

### 3. 🚫 Redirection après login ne fonctionne pas

**Nouveau comportement** :
- Utilisateurs standard (B2C/B2B) → `/dashboard`
- Utilisateurs admin → `/admin/analytics`

**Logs à surveiller dans la console** :
```
[Login] Tentative de connexion avec: email@example.com
[Login] Connexion réussie, utilisateur: email@example.com Type: admin
[Login] Admin détecté, redirection vers /admin/analytics
```

**Si la redirection échoue** :
- Vérifiez que navigate() ne retourne pas d'erreur
- Vérifiez qu'il n'y a pas de ProtectedRoute bloquant l'accès
- Testez manuellement en allant sur `/dashboard` après connexion

---

### 4. ⏱️ Timeout "La migration Supabase n'a peut-être pas été appliquée"

**Problème** : L'AdminAnalytics prend plus de 10 secondes à charger.

**Solution appliquée** :
- Timeout augmenté de 10s → 30s
- Chaque appel de service capture maintenant ses erreurs individuellement
- Logs détaillés ajoutés pour identifier quel service échoue

**Logs à surveiller** :
```
[AdminAnalytics] Chargement des données...
[AdminAnalytics] Erreur getOverview: [détails]
[AdminAnalytics] Erreur getAllFeedbacks: [détails]
[AdminAnalytics] Données chargées: { overview: ..., feedback: ... }
```

**Si le timeout persiste** :
1. Exécutez le diagnostic SQL : `supabase/DIAGNOSTIC_COMPLET.sql`
2. Vérifiez que toutes les migrations sont appliquées
3. Vérifiez les RLS policies
4. Vérifiez que les fonctions RPC existent

---

### 5. 📊 Admin Analytics affiche des cartes vides

**Causes possibles** :

#### A. Migrations non appliquées
**Solution** : Appliquez les migrations dans l'ordre
```bash
# Dans le SQL Editor de Supabase, exécutez dans l'ordre :
1. supabase/migrations/001_initial_schema.sql
2. supabase/migrations/002_analytics_feedback.sql
3. supabase/migrations/004_admin_access_policies.sql
```

#### B. RLS bloque l'accès admin
**Solution** : Vérifiez que vous êtes bien admin
```sql
-- Dans SQL Editor :
SELECT id, email, user_type FROM users WHERE email = 'votre@email.com';

-- Si user_type != 'admin', corrigez :
UPDATE users SET user_type = 'admin' WHERE email = 'votre@email.com';

-- Testez :
SELECT is_admin(); -- Doit retourner TRUE
```

#### C. Aucune donnée dans les tables
**Solution** : Vérifiez les données
```sql
-- Comptez les enregistrements :
SELECT
  (SELECT COUNT(*) FROM user_feedback) AS total_feedbacks,
  (SELECT COUNT(*) FROM analytics_events) AS total_events,
  (SELECT COUNT(*) FROM devis_analysis_metrics) AS total_analyses;
```

#### D. Erreurs RPC
**Logs à vérifier dans la console** :
```
[AdminAnalytics] Erreur getAllFeedbacks: [message d'erreur]
✓ Feedbacks loaded via RPC: 5
⚠️ RPC failed, trying direct query
```

---

## 🛠️ Procédure de Diagnostic Complète

### Étape 1 : Diagnostic SQL
```bash
# Dans Supabase SQL Editor, exécutez :
supabase/DIAGNOSTIC_COMPLET.sql
```

Ce script vérifie :
- ✅ Tables existantes
- ✅ Fonctions RPC
- ✅ RLS Policies
- ✅ Nombre d'enregistrements
- ✅ Utilisateurs admin
- ✅ Test fonction is_admin()

### Étape 2 : Diagnostic Frontend
```bash
# Dans la console du navigateur (F12), recherchez :
[Supabase Config] URL: https://...
[Auth State Change] Event: SIGNED_IN
[Login] Connexion réussie
[AdminAnalytics] Données chargées
```

### Étape 3 : Page de diagnostic
```
Accédez à : /admin/diagnostic
```

Cette page teste :
1. Connexion Supabase
2. Utilisateur connecté
3. Profil utilisateur (admin ?)
4. RPC get_all_feedbacks
5. Table user_feedback (accès direct)
6. RPC get_all_users
7. Table analytics_events
8. Fonction is_admin()

---

## 🔄 Checklist de Redéploiement

Après avoir appliqué les corrections :

- [ ] Redéployer l'application (Vercel/votre plateforme)
- [ ] Vider le cache du navigateur (Ctrl+Shift+Delete)
- [ ] localStorage.clear() dans la console
- [ ] Fermer tous les onglets
- [ ] Rouvrir et tester la connexion
- [ ] Vérifier que les logs apparaissent dans la console
- [ ] Tester la fermeture/réouverture du navigateur
- [ ] Tester /admin/analytics
- [ ] Tester /admin/diagnostic

---

## 📞 Informations de Débug à Fournir

Si les problèmes persistent, fournissez :

1. **Logs de connexion** (depuis la console) :
```
[Login] Tentative de connexion...
[getCurrentUser] ...
[Auth State Change] ...
```

2. **Résultat du diagnostic SQL** (DIAGNOSTIC_COMPLET.sql)

3. **Résultat de /admin/diagnostic**

4. **État du localStorage** :
```javascript
// Dans la console :
console.log(Object.keys(localStorage).filter(k => k.includes('supabase')));
```

5. **Erreurs dans la console** (copier toutes les erreurs rouges)

---

## 💡 Tips

### Forcer une reconnexion propre
```javascript
// Dans la console du navigateur :
localStorage.clear();
sessionStorage.clear();
window.location.href = '/login';
```

### Vérifier la session en cours
```javascript
// Dans la console :
supabase.auth.getSession().then(console.log);
```

### Tester les RPC manuellement
```sql
-- Dans SQL Editor :
SELECT * FROM get_all_feedbacks() LIMIT 5;
SELECT * FROM get_all_users() LIMIT 5;
SELECT * FROM get_all_analyses() LIMIT 5;
```
