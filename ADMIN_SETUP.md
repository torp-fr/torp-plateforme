# 🔧 Configuration Admin - TORP Analytics Dashboard

## 🚨 Problème : Les feedbacks/inscriptions ne s'affichent pas ?

Si vous voyez des statistiques (ex: "1 feedback") mais que les tableaux restent vides, c'est que les **politiques RLS (Row Level Security)** de Supabase bloquent l'accès admin.

### ✅ Solution rapide

Appliquez la migration SQL pour débloquer l'accès admin :

#### Option 1 : Via CLI Supabase (recommandé)

```bash
cd /home/user/quote-insight-tally
supabase db push
```

#### Option 2 : Via Dashboard Supabase

1. Connectez-vous à votre [Dashboard Supabase](https://app.supabase.com)
2. Sélectionnez votre projet TORP
3. Allez dans **SQL Editor** (dans le menu de gauche)
4. Cliquez sur **New Query**
5. Copiez-collez le contenu du fichier :
   ```
   supabase/migrations/004_admin_access_policies.sql
   ```
6. Cliquez sur **Run** (ou Ctrl+Enter)

### 📋 Que fait cette migration ?

La migration `004_admin_access_policies.sql` configure :

- ✅ **Fonction `is_admin()`** : Vérifie si l'utilisateur est admin
- ✅ **Fonction `get_all_feedbacks()`** : Récupère tous les feedbacks (admin uniquement)
- ✅ **Fonction `get_all_users()`** : Récupère tous les utilisateurs (admin uniquement)
- ✅ **Fonction `get_all_analyses()`** : Récupère toutes les analyses (admin uniquement)
- ✅ **Politiques RLS** : Autorise l'accès admin tout en maintenant la sécurité

### 🔍 Vérifier que ça fonctionne

Après avoir appliqué la migration :

1. Retournez sur `/admin/analytics`
2. Cliquez sur le bouton **"Actualiser"** en haut à droite
3. Les tableaux doivent maintenant afficher les données

### 🐛 Logs de diagnostic

Ouvrez la **Console JavaScript** du navigateur (F12) pour voir les logs :

✅ **Succès (avec migration)** :
```
✓ Feedbacks loaded via RPC: 5
✓ Users loaded via RPC: 12
✓ Analyses loaded via RPC: 8
```

⚠️ **Fallback (sans migration)** :
```
⚠️ RPC get_all_feedbacks failed, trying direct query
💡 Appliquez la migration 004_admin_access_policies.sql
✓ Feedbacks loaded via direct query: 5
```

❌ **Erreur (RLS bloque tout)** :
```
❌ Direct query also failed: [RLS policy violation]
```

### 📊 Fonctionnalités disponibles après migration

- ✅ **Onglet Inscriptions** : Liste complète des utilisateurs
- ✅ **Onglet Analyses** : Détails des analyses de devis (scores TORP)
- ✅ **Onglet Feedbacks** : Messages complets avec satisfaction
- ✅ **Onglet Scores TORP** : Moyennes par type d'utilisateur
- ✅ **Bouton Actualiser** : Recharge les données en temps réel

### 🔒 Sécurité

Les fonctions RPC utilisent `SECURITY DEFINER` mais vérifient que l'utilisateur est admin via `is_admin()`. Seuls les utilisateurs avec `user_type = 'admin'` dans la table `users` peuvent accéder aux données.

### 🆘 Besoin d'aide ?

- Consultez les logs de la console (F12 → Console)
- Vérifiez que votre utilisateur a bien `user_type = 'admin'` dans Supabase
- Contactez le support technique si le problème persiste

---

**Dernière mise à jour** : 2025-11-26
**Version migration** : 004_admin_access_policies.sql
