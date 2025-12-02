# Guide d'Installation - Système de Tickets TORP

## 🚀 Migration SQL automatique

Le fichier `20250102_ticket_system_complete.sql` configure automatiquement :
- ✅ Colonnes ticket dans `pro_devis_analyses`
- ✅ Table `ticket_tracking_events`
- ✅ Fonction SQL `increment_ticket_view_count`
- ✅ Policies RLS pour accès public
- ✅ Index de performance
- ✅ Vue statistiques

## 📋 Instructions d'installation

### Méthode 1 : Via Supabase Dashboard (Recommandé)

1. **Ouvrez votre projet Supabase**
   - Allez sur https://app.supabase.com
   - Sélectionnez votre projet

2. **Accédez au SQL Editor**
   - Menu latéral → SQL Editor
   - Cliquez sur "New query"

3. **Collez le script SQL**
   - Copiez tout le contenu de `20250102_ticket_system_complete.sql`
   - Collez-le dans l'éditeur

4. **Exécutez le script**
   - Cliquez sur "Run" (ou Ctrl+Enter)
   - Attendez la confirmation (messages ✅)

5. **Vérifiez les résultats**
   - Vous devriez voir des messages de type :
     ```
     NOTICE: Colonne ticket_code ajoutée
     NOTICE: ✅ Toutes les colonnes ticket sont présentes
     NOTICE: ✅ Fonction increment_ticket_view_count créée
     NOTICE: Migration terminée !
     ```

### Méthode 2 : Via Supabase CLI

```bash
# Si vous utilisez les migrations Supabase
supabase migration new ticket_system_complete
# Copiez le contenu du fichier SQL dans le nouveau fichier créé
supabase db push
```

## 📦 Créer le Storage Bucket (MANUEL)

**⚠️ IMPORTANT** : Le bucket Storage ne peut pas être créé en SQL. Vous devez le créer manuellement :

### Étapes :

1. **Dans Supabase Dashboard**
   - Menu latéral → Storage
   - Cliquez sur "New bucket"

2. **Configuration du bucket**
   - Name : `pro-tickets`
   - ✅ **COCHER "Public bucket"** (CRITICAL)
   - Cliquez sur "Create bucket"

3. **Vérifier les policies Storage**
   - Le bucket doit être PUBLIC
   - Les fichiers doivent être accessibles sans auth
   - URL : `https://[project].supabase.co/storage/v1/object/public/pro-tickets/...`

### Configuration des policies Storage (optionnel)

Si les policies ne sont pas correctes, ajoutez-les via SQL :

```sql
-- Policy d'upload (authentifié seulement)
INSERT INTO storage.policies (name, bucket_id, definition, check_type)
VALUES (
  'Authenticated users can upload tickets',
  'pro-tickets',
  'bucket_id = ''pro-tickets'' AND (auth.role() = ''authenticated'')',
  'INSERT'
);

-- Policy de lecture (PUBLIC)
INSERT INTO storage.policies (name, bucket_id, definition, check_type)
VALUES (
  'Public can view tickets',
  'pro-tickets',
  'bucket_id = ''pro-tickets''',
  'SELECT'
);
```

## ✅ Tests de vérification

Après la migration, testez avec ces requêtes :

```sql
-- 1. Vérifier les colonnes
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'pro_devis_analyses'
AND column_name LIKE '%ticket%';

-- Résultat attendu : 6 colonnes (ticket_genere, ticket_code, etc.)

-- 2. Vérifier la table tracking
SELECT * FROM ticket_tracking_events LIMIT 1;

-- 3. Vérifier la fonction
SELECT increment_ticket_view_count('00000000-0000-0000-0000-000000000000'::uuid);

-- 4. Vérifier les policies publiques
SELECT policyname, cmd 
FROM pg_policies 
WHERE tablename IN ('pro_devis_analyses', 'pro_company_profiles')
AND policyname LIKE '%Public%';

-- Résultat attendu : 2+ policies

-- 5. Tester l'accès public (sans auth)
SELECT id, ticket_code, grade, score_total
FROM pro_devis_analyses
WHERE ticket_genere = true
LIMIT 1;

-- Doit fonctionner même sans être authentifié !

-- 6. Vérifier le bucket Storage
SELECT name, public FROM storage.buckets WHERE name = 'pro-tickets';

-- Résultat attendu : 1 ligne avec public = true
```

## 🔍 Rollback (si nécessaire)

Si vous devez annuler la migration :

```sql
-- Supprimer les policies
DROP POLICY IF EXISTS "Public can view ticket data" ON pro_devis_analyses;
DROP POLICY IF EXISTS "Public can view company for tickets" ON pro_company_profiles;
DROP POLICY IF EXISTS "Public can track ticket views" ON ticket_tracking_events;

-- Supprimer la table tracking
DROP TABLE IF EXISTS ticket_tracking_events CASCADE;

-- Supprimer la fonction
DROP FUNCTION IF EXISTS increment_ticket_view_count;

-- Supprimer les colonnes ticket (ATTENTION : perte de données)
ALTER TABLE pro_devis_analyses 
  DROP COLUMN IF EXISTS ticket_genere,
  DROP COLUMN IF EXISTS ticket_code,
  DROP COLUMN IF EXISTS ticket_url,
  DROP COLUMN IF EXISTS ticket_generated_at,
  DROP COLUMN IF EXISTS ticket_view_count,
  DROP COLUMN IF EXISTS ticket_last_viewed_at;

-- Supprimer le bucket (via Dashboard)
-- Storage → pro-tickets → Delete bucket
```

## 🐛 Troubleshooting

### Erreur : "permission denied"
**Solution** : Vérifiez que vous êtes connecté en tant que propriétaire du projet

### Erreur : "relation already exists"
**Solution** : C'est normal ! Le script utilise `IF NOT EXISTS`, il peut être exécuté plusieurs fois

### Erreur : "could not find relation pro_devis_analyses"
**Solution** : La table principale n'existe pas. Assurez-vous que votre base est initialisée

### Le bucket public ne fonctionne pas
**Solution** : 
1. Vérifiez que le bucket est marqué comme PUBLIC
2. Testez l'URL : `https://[project].supabase.co/storage/v1/object/public/pro-tickets/test.pdf`
3. Si erreur 404, vérifiez les policies Storage

### Les policies RLS bloquent l'accès
**Solution** : 
```sql
-- Vérifier si RLS est activé
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public' 
AND tablename IN ('pro_devis_analyses', 'pro_company_profiles');

-- Désactiver temporairement pour tester
ALTER TABLE pro_devis_analyses DISABLE ROW LEVEL SECURITY;
-- (NE PAS FAIRE EN PRODUCTION !)
```

## 📊 Monitoring

Après la mise en production, surveillez :

```sql
-- Vue des statistiques globales
SELECT * FROM ticket_stats;

-- Analyses récentes des tickets
SELECT 
  id,
  ticket_code,
  ticket_view_count,
  ticket_last_viewed_at
FROM pro_devis_analyses
WHERE ticket_genere = true
ORDER BY ticket_generated_at DESC
LIMIT 10;

-- Tracking des dernières 24h
SELECT 
  event_type,
  COUNT(*) as count
FROM ticket_tracking_events
WHERE created_at > now() - interval '24 hours'
GROUP BY event_type;
```

## 📝 Checklist finale

- [ ] Migration SQL exécutée sans erreur
- [ ] Bucket `pro-tickets` créé et PUBLIC
- [ ] Policies RLS configurées
- [ ] Tests de vérification passés
- [ ] Accès public fonctionne (test `/t/:code`)
- [ ] Tracking des vues fonctionne
- [ ] Upload PDF fonctionne

## 🎉 C'est prêt !

Une fois tous les tests passés, le système de tickets TORP est opérationnel !

**Prochaines étapes :**
1. Tester la génération d'un ticket depuis l'interface
2. Vérifier que le PDF est uploadé dans Storage
3. Scanner le QR code pour tester l'accès public
4. Monitorer les statistiques de vues
