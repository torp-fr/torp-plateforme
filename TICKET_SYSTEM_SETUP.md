# 🎫 PROCÉDURE COMPLÈTE : Configuration du système de tickets TORP

Cette procédure vous permet de rendre opérationnel le système de génération de tickets.

---

## 📋 **ÉTAPE 1 : Configuration de la base de données**

### 1.1 - Exécuter la migration principale

**Dans Supabase Dashboard → SQL Editor**, exécutez :

```sql
-- Contenu du fichier : supabase/migrations/20250102_ticket_system_complete.sql
```

✅ **Résultat attendu :** Messages de succès confirmant :
- Colonnes ticket ajoutées
- Table ticket_tracking_events créée
- Fonction increment_ticket_view_count créée
- Policies RLS pour tables créées

---

## 📦 **ÉTAPE 2 : Configuration du Storage**

### 2.1 - Vérifier/Créer le bucket tickets-torp

**Dans Supabase Dashboard → Storage** :

1. Vérifiez si le bucket `tickets-torp` existe
2. S'il n'existe pas, créez-le :
   - Name: `tickets-torp`
   - **Public : ✅ COCHER** (critique !)
   - File size limit: 10 MB
   - Allowed MIME types: `application/pdf`

### 2.2 - Configurer les policies RLS Storage

**Dans SQL Editor**, exécutez :

```sql
-- Contenu du fichier : supabase/migrations/20250102_ticket_storage_setup.sql
```

✅ **Résultat attendu :**
- 4 policies créées pour `tickets-torp`
- Confirmations ✅ dans les messages

### 2.3 - Vérifier les policies

**Exécutez cette requête** :

```sql
SELECT
  policyname,
  cmd as operation,
  roles
FROM pg_policies
WHERE tablename = 'objects'
AND policyname LIKE 'tickets_torp%'
ORDER BY policyname;
```

✅ **Vous devez voir :**
- `tickets_torp_insert_auth` (INSERT, authenticated)
- `tickets_torp_select_public` (SELECT, public)
- `tickets_torp_update_auth` (UPDATE, authenticated)
- `tickets_torp_delete_auth` (DELETE, authenticated)

---

## 🔄 **ÉTAPE 3 : Réinitialiser l'application**

### 3.1 - Nettoyer les anciens tickets

**Dans SQL Editor** :

```sql
-- Supprimer tous les anciens tickets pour repartir de zéro
UPDATE pro_devis_analyses
SET
  ticket_genere = false,
  ticket_code = NULL,
  ticket_url = NULL,
  ticket_generated_at = NULL,
  ticket_view_count = 0,
  ticket_last_viewed_at = NULL
WHERE ticket_genere = true;
```

### 3.2 - Vider le Storage

**Dans Supabase Dashboard → Storage → tickets-torp** :

1. Sélectionnez tous les fichiers (si présents)
2. Supprimez-les

### 3.3 - Forcer le rechargement de l'application

**Dans votre navigateur** :

1. Ouvrez les DevTools (F12)
2. **Clic droit sur le bouton Rafraîchir** → "Vider le cache et actualiser"
3. Ou utilisez **Ctrl+Shift+R** (Windows) / **Cmd+Shift+R** (Mac)

---

## ✅ **ÉTAPE 4 : Test de génération**

### 4.1 - Vérifier votre profil utilisateur

**Exécutez** :

```sql
SELECT
  id as user_id,
  email
FROM auth.users
WHERE email = 'support@torp.fr';
```

Notez le `user_id` (ex: `21cc8b68-2136-4a37-bbae-73ac0c524b0b`)

### 4.2 - Générer un ticket test

1. Connectez-vous à l'application
2. Ouvrez une analyse complétée
3. Cliquez sur **"Générer le ticket TORP"**
4. **Ouvrez la console** (F12)

### 4.3 - Vérifier les logs

✅ **Si succès, vous devez voir** :
- Aucune erreur dans la console
- Redirection vers la page `/pro/analyses/{id}/ticket`
- Le ticket s'affiche avec :
  - Code de vérification
  - Lien public
  - Bouton "Télécharger le PDF"
  - Aperçu du QR code

❌ **Si erreur** :
- Copiez le message complet
- Vérifiez l'URL du POST dans Network (F12 → Network)
- Elle doit pointer vers `tickets-torp` (pas `pro-tickets`)

### 4.4 - Vérifier dans Storage

**Dans Supabase Dashboard → Storage → tickets-torp** :

Vous devez voir un fichier :
```
{user_id}/ticket-torp-{code}.pdf
```

Par exemple :
```
21cc8b68-2136-4a37-bbae-73ac0c524b0b/ticket-torp-a7k9m2.pdf
```

### 4.5 - Vérifier dans la base de données

```sql
SELECT
  id,
  reference_devis,
  ticket_genere,
  ticket_code,
  ticket_url,
  ticket_generated_at
FROM pro_devis_analyses
WHERE ticket_genere = true
ORDER BY ticket_generated_at DESC
LIMIT 1;
```

✅ **Vous devez voir** :
- `ticket_genere = true`
- `ticket_code` rempli (ex: `A7K9M2`)
- `ticket_url` pointant vers Storage (ex: `https://zvxasiwahpraasjzfhhl.supabase.co/storage/v1/object/public/tickets-torp/...`)

---

## 🌐 **ÉTAPE 5 : Test de la page publique**

### 5.1 - Accéder à la page publique

Depuis le ticket généré, cliquez sur **"Voir la page publique"** ou accédez à :
```
http://localhost:5173/t/{CODE}
```

✅ **Vous devez voir** :
- Le grade (A+, A, B, etc.)
- Le score total /1000
- Les 6 axes détaillés
- Les informations entreprise
- Les documents vérifiés

### 5.2 - Télécharger le PDF

Cliquez sur **"Télécharger le PDF"**

✅ **Le PDF doit s'ouvrir** avec :
- Bandeau coloré à gauche avec le grade
- Informations entreprise
- QR code à droite
- Code de vérification

### 5.3 - Scanner le QR code

1. Téléchargez le PDF
2. Scannez le QR code avec votre smartphone
3. Vous devez être redirigé vers la page publique

---

## 🐛 **DÉPANNAGE**

### Erreur : "new row violates row-level security policy"

**Cause :** Les policies RLS Storage ne sont pas configurées

**Solution :**
1. Réexécutez `20250102_ticket_storage_setup.sql`
2. Vérifiez que les 4 policies `tickets_torp_*` existent
3. Videz le cache du navigateur (Ctrl+Shift+R)

---

### Erreur : "Failed to load resource: 400"

**Cause :** Le bucket n'est pas PUBLIC ou n'existe pas

**Solution :**
1. Allez dans Storage → tickets-torp → Settings
2. Vérifiez que **"Public bucket"** = ✅
3. Si le bucket n'existe pas, créez-le

---

### Le QR code ne fonctionne pas

**Cause :** Le bucket n'est pas PUBLIC

**Solution :**
1. Storage → tickets-torp → Settings
2. Cochez **"Public bucket"**
3. Régénérez le ticket

---

### L'URL pointe vers "pro-tickets" au lieu de "tickets-torp"

**Cause :** Cache du navigateur

**Solution :**
1. Videz complètement le cache (Ctrl+Shift+Delete)
2. Ou utilisez le mode incognito
3. Rechargez l'application

---

### Le PDF ne s'affiche pas dans la prévisualisation

**Cause :** Le ticket n'a pas été généré correctement

**Solution :**
1. Réinitialisez le ticket en base :
```sql
UPDATE pro_devis_analyses
SET ticket_genere = false, ticket_code = NULL
WHERE id = '{analysis_id}';
```
2. Régénérez le ticket depuis l'interface

---

## 📊 **VÉRIFICATION FINALE**

Exécutez ce script pour vérifier que tout est OK :

```sql
-- Vérifier la configuration complète
DO $$
DECLARE
  table_cols integer;
  storage_policies integer;
  table_policies integer;
  bucket_exists boolean;
BEGIN
  RAISE NOTICE '========================================';
  RAISE NOTICE 'VÉRIFICATION DU SYSTÈME DE TICKETS';
  RAISE NOTICE '========================================';

  -- 1. Colonnes ticket
  SELECT COUNT(*) INTO table_cols
  FROM information_schema.columns
  WHERE table_name = 'pro_devis_analyses'
  AND column_name LIKE 'ticket%';

  IF table_cols >= 6 THEN
    RAISE NOTICE '✅ Colonnes ticket : % trouvées', table_cols;
  ELSE
    RAISE WARNING '⚠️ Colonnes ticket : % trouvées (attendu: 6)', table_cols;
  END IF;

  -- 2. Policies Storage
  SELECT COUNT(*) INTO storage_policies
  FROM pg_policies
  WHERE tablename = 'objects'
  AND policyname LIKE 'tickets_torp%';

  IF storage_policies >= 4 THEN
    RAISE NOTICE '✅ Policies Storage : % configurées', storage_policies;
  ELSE
    RAISE WARNING '⚠️ Policies Storage : % configurées (attendu: 4)', storage_policies;
  END IF;

  -- 3. Policies tables
  SELECT COUNT(*) INTO table_policies
  FROM pg_policies
  WHERE policyname LIKE '%Public%'
  AND tablename IN ('pro_devis_analyses', 'pro_company_profiles');

  IF table_policies >= 2 THEN
    RAISE NOTICE '✅ Policies tables : % configurées', table_policies;
  ELSE
    RAISE WARNING '⚠️ Policies tables : % configurées (attendu: 2)', table_policies;
  END IF;

  -- 4. Bucket
  SELECT EXISTS (
    SELECT 1 FROM storage.buckets WHERE name = 'tickets-torp'
  ) INTO bucket_exists;

  IF bucket_exists THEN
    RAISE NOTICE '✅ Bucket tickets-torp : existe';
  ELSE
    RAISE WARNING '⚠️ Bucket tickets-torp : n''existe pas !';
  END IF;

  -- 5. Fonction
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'increment_ticket_view_count') THEN
    RAISE NOTICE '✅ Fonction increment_ticket_view_count : existe';
  ELSE
    RAISE WARNING '⚠️ Fonction increment_ticket_view_count : manquante';
  END IF;

  RAISE NOTICE '========================================';
  RAISE NOTICE 'VÉRIFICATION TERMINÉE';
  RAISE NOTICE '========================================';
END $$;
```

✅ **Si tous les éléments sont ✅, votre système est opérationnel !**

---

## 📞 **Support**

Si vous rencontrez toujours des problèmes après avoir suivi cette procédure :

1. Exécutez le script de vérification finale ci-dessus
2. Copiez les messages de la console (F12)
3. Vérifiez les logs Supabase Dashboard → Logs
4. Fournissez ces informations pour diagnostic
