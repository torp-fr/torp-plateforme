# Configuration Supabase pour TORP

Ce guide explique comment configurer complètement Supabase pour le projet TORP.

## 📋 Table des matières

1. [Base de données (Tables)](#base-de-données)
2. [Storage (Buckets)](#storage)
3. [Vérification](#vérification)
4. [Troubleshooting](#troubleshooting)

---

## 🗄️ Base de Données

### Étape 1: Exécuter les migrations de schéma

1. Aller dans **Supabase Dashboard** → **SQL Editor**
2. Créer une nouvelle requête
3. Copier le contenu complet de `supabase/migrations/001_init_schema.sql`
4. Cliquer **Run**

**Tables créées:**
- ✅ ccf (projets)
- ✅ client_enriched_data (données enrichies + embeddings)
- ✅ quote_uploads (uploads de devis)
- ✅ quote_analysis (résultats d'analyse)
- ✅ rag_context_cache (cache RAG)
- ✅ audit_log (logs d'actions)

### Étape 2: Vérifier les tables

Exécuter cette requête dans SQL Editor:

```sql
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public'
ORDER BY table_name;
```

**Résultat attendu:**
```
audit_log
ccf
client_enriched_data
quote_analysis
quote_uploads
rag_context_cache
```

### Étape 3: Vérifier la RPC function

Exécuter:

```sql
SELECT routine_name FROM information_schema.routines
WHERE routine_name = 'match_enriched_data';
```

**Résultat attendu:** `match_enriched_data`

---

## 📁 Storage

### Étape 1: Créer le bucket quote-uploads

1. Aller dans **Supabase Dashboard** → **Storage**
2. Cliquer **Create new bucket**
3. Configurer:
   - **Bucket name:** `quote-uploads`
   - **Public bucket:** ✅ OUI (cocher "Public bucket")
   - **File size limit:** 50 MB (optionnel)
   - **Allowed MIME types:** `application/pdf` (optionnel)
4. Cliquer **Create bucket**

### Étape 2: Ajouter les policies RLS

Dans **Supabase Dashboard** → **Storage** → **quote-uploads** → **Policies**:

#### Policy 1: Allow Read (Development)

- **Name:** `quote_uploads_allow_read_dev`
- **Target roles:** public (ou laisser vide)
- **Allowed operation:** SELECT
- **Policy definition:**
```sql
(bucket_id = 'quote-uploads')
```
- Cliquer **Create Policy**

#### Policy 2: Allow Upload (Development)

- **Name:** `quote_uploads_allow_insert_dev`
- **Target roles:** public
- **Allowed operation:** INSERT
- **Policy definition:**
```sql
(bucket_id = 'quote-uploads')
```
- Cliquer **Create Policy**

#### Policy 3: Allow Update (Development)

- **Name:** `quote_uploads_allow_update_dev`
- **Target roles:** public
- **Allowed operation:** UPDATE
- **Policy definition:**
```sql
(bucket_id = 'quote-uploads')
```
- Cliquer **Create Policy**

#### Policy 4: Allow Delete (Development)

- **Name:** `quote_uploads_allow_delete_dev`
- **Target roles:** public
- **Allowed operation:** DELETE
- **Policy definition:**
```sql
(bucket_id = 'quote-uploads')
```
- Cliquer **Create Policy**

### Étape 3: Exécuter la migration des policies

Optionnel - Pour automatiser les policies (SQL Editor):

```sql
-- Copier le contenu de:
-- supabase/migrations/033_quote_uploads_storage.sql
```

---

## ✅ Vérification

### Vérifier les tables

```bash
curl -X GET "https://<project-id>.supabase.co/rest/v1/ccf?limit=0" \
  -H "apikey: <anon-key>"
```

Résultat: `200 OK` ou `404` (normal si vide)

### Vérifier le storage

```bash
curl -X GET "https://<project-id>.supabase.co/storage/v1/bucket" \
  -H "Authorization: Bearer <anon-key>"
```

Vous devez voir `quote-uploads` dans la liste.

### Test complet (depuis l'app)

1. **Démarrer l'app:**
   ```bash
   npm run dev
   ```

2. **Tester le flux complet:**
   - Créer un CCF → `/quote`
   - Vérifier qu'il apparaît dans Supabase
   - Uploader un PDF → `/quote-upload`
   - Vérifier que le PDF est dans Storage
   - Voir l'analyse → `/quote-analysis`

3. **Vérifier la base de données:**
   - **Supabase Dashboard → SQL Editor**
   - Exécuter:
   ```sql
   SELECT id, client_name, project_name, status
   FROM ccf
   ORDER BY created_at DESC
   LIMIT 5;
   ```

---

## 🐛 Troubleshooting

### Erreur: "Bucket not found"

**Cause:** Le bucket `quote-uploads` n'a pas été créé

**Solution:**
1. Aller dans **Storage → Create bucket**
2. Créer `quote-uploads` comme public
3. Redémarrer l'app

### Erreur: "Access Denied" au upload

**Cause:** Les policies RLS ne sont pas correctes

**Solution:**
1. Aller dans **Storage → quote-uploads → Policies**
2. Vérifier que 4 policies existent
3. Chaque policy doit avoir la définition correcte
4. Supprimer et recréer si nécessaire

### Erreur: "Auth session missing"

**Cause:** L'utilisateur n'est pas authentifié (normal en dev)

**Solution:** Les policies de développement (`*_dev`) permettent l'accès sans auth. Si vous utilisez les policies de production, authentifier l'utilisateur.

### Erreur: "Database error: ..."

**Cause:** Les policies RLS sur les tables bloquent les inserts

**Solution:**
1. Vérifier dans **Supabase Dashboard → Authentication → Policies**
2. Les policies actuelles sont `allow-all` pour le développement
3. Pour la production, les adapter selon les besoins

### Le PDF n'apparaît pas dans Storage

**Cause:** Peut être plusieurs raisons

**Debug:**
1. Ouvrir **Browser DevTools → Console**
2. Chercher les logs `[uploadQuotePDF]`
3. Noter les messages d'erreur
4. Vérifier dans **Supabase → Storage → quote-uploads → Objects**

---

## 📝 Checklist de configuration

- [ ] Migration `001_init_schema.sql` exécutée
- [ ] 6 tables créées (ccf, client_enriched_data, etc.)
- [ ] RPC function `match_enriched_data` existe
- [ ] Bucket `quote-uploads` créé en public
- [ ] 4 policies RLS ajoutées au bucket
- [ ] App peut créer un CCF
- [ ] App peut uploader un PDF
- [ ] Données visibles dans Supabase Dashboard

---

## 🔐 Passage en Production

Avant de déployer en production:

1. **Remplacer les policies "dev" par les policies "production"**
   - Voir `supabase/migrations/033_quote_uploads_storage.sql`
   - Décommenter la section "Production Policies"

2. **Activer l'authentification:**
   - Configurer Auth dans Supabase Dashboard
   - Adapter les RLS policies aux rôles utilisateurs

3. **Sécuriser le storage:**
   - Rendre `quote-uploads` privé (non-public)
   - Ajouter les policies d'accès utilisateur

4. **Configurer les env vars de production:**
   ```env
   VITE_SUPABASE_URL=https://your-prod-url.supabase.co
   VITE_SUPABASE_ANON_KEY=your-prod-anon-key
   ```

---

## 📚 Ressources

- [Supabase Storage Docs](https://supabase.com/docs/guides/storage)
- [RLS Policies Guide](https://supabase.com/docs/guides/auth/row-level-security)
- [Supabase SQL Editor](https://supabase.com/dashboard)

---

**Dernière mise à jour:** 2026-02-12
