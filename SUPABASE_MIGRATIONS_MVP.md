# Supabase Migrations - Quote Insight Tally MVP

## 📋 Status

✅ **Cleaned up:** 34 unnecessary migrations removed (phases 0-4, advanced features)
✅ **Kept:** 13 core MVP migrations
✅ **New:** Cleanup migration added (for existing DBs)

---

## 🚀 MVP Migrations to Apply

Apply these migrations **IN ORDER** in Supabase SQL Editor:

### Step 1: Foundation
```
000_mvp_clean_slate.sql          ← RESET: Clears old schema
001_init_schema.sql              ← CREATE: Core tables
```

### Step 2: Core Features
```
002_analytics_feedback.sql       ← Analytics & feedback
003_company_data_cache.sql       ← Company caching system
004_admin_access_policies.sql    ← RLS policies for admins
005_fix_user_insert_policy.sql   ← Fix user registration
```

### Step 3: Storage & API
```
006_storage_policies.sql         ← Storage reference (setup manually)
007_comparisons_table.sql        ← Quote comparison
008_notifications_and_b2b.sql    ← Notifications table
```

### Step 4: Enrichment
```
009_enrich_companies_table.sql   ← Add company enrichment
010_enrich_devis_table.sql       ← Add quote enrichment
```

### Step 5: Essential MVP Tables
```
011_essential_tables_mvp.sql     ← Create profiles, audit, rate limits
```

### Step 6: Storage Uploads
```
033_quote_uploads_storage.sql    ← Documentation reference
034_cleanup_advanced_features.sql ← Optional: cleans if upgrading
```

---

## 📖 How to Apply Migrations

### Option A: Manual (via Dashboard)
1. Go to **Supabase Dashboard → SQL Editor**
2. For each migration file (in order):
   - Copy entire SQL file content
   - Paste into SQL Editor
   - Click **Run**
   - Wait for ✅ success

### Option B: CLI (if project linked)
```bash
# Link to Supabase
supabase link --project-ref iixxzfgexmiofvmfrnuy

# Apply all migrations
supabase push
```

---

## 🪣 Storage Buckets - Manual Setup

Migrations reference these buckets but **CANNOT create them via SQL**.

### Create via Dashboard:

1. **quote-uploads** (for PDF devis)
   - Public: YES
   - Max size: 50 MB
   - MIME types: .pdf

2. **devis-uploads** (alternative name, if needed)
   - Public: YES
   - Max size: 50 MB

---

## 🔐 Storage Policies - Manual Setup

Migrations reference policies but **CANNOT create them via SQL**.

### Add via Dashboard: Storage → quote-uploads → Policies

```
1️⃣ SELECT (Read)
   Name: quote_uploads_allow_read_dev
   Operation: SELECT
   Policy: (bucket_id = 'quote-uploads')

2️⃣ INSERT (Upload)
   Name: quote_uploads_allow_insert_dev
   Operation: INSERT
   Policy: (bucket_id = 'quote-uploads')

3️⃣ UPDATE (Modify)
   Name: quote_uploads_allow_update_dev
   Operation: UPDATE
   Policy: (bucket_id = 'quote-uploads')

4️⃣ DELETE (Delete)
   Name: quote_uploads_allow_delete_dev
   Operation: DELETE
   Policy: (bucket_id = 'quote-uploads')
```

---

## 📊 Tables Created

### Users & Auth
- `auth.users` (native Supabase)
- `profiles` (user profiles, auto-created on signup)

### Business
- `companies` (contractor companies)
- `ccf` (Cahier des Charges - project specs)
- `devis` (quotes)
- `devis_photos` (photo attachments for quotes)
- `quote_analysis` (quote analysis results)
- `quote_uploads` (uploaded PDFs)

### Enrichment
- `client_enriched_data` (addresses, DPE, cadastre, regulatory)
- `company_data_cache` (cached company search results)

### Tracking & Analytics
- `analytics_events` (usage tracking)
- `audit_trail` (complete action audit log)
- `api_rate_limits` (API usage tracking)
- `user_feedback` (feedback/ratings)
- `search_history` (search logs)
- `comparisons` (quote comparisons)
- `notifications` (user notifications)

### Configuration
- `feature_flags` (feature toggles for MVP)

---

## 🧹 Cleanup Script

If upgrading an existing database with old migrations:

```sql
-- Run after 010_enrich_devis_table.sql
-- This will DELETE all phase 0-4, B2B, and advanced feature tables
SELECT * FROM migration_034_cleanup_advanced_features;
```

---

## ✅ Verification

After applying all migrations, verify in **SQL Editor**:

```sql
-- Should return core tables only
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
ORDER BY table_name;
```

**Expected output (15 tables):**
```
analytics_events
api_rate_limits
audit_trail
ccf
client_enriched_data
companies
company_data_cache
comparisons
devis
devis_photos
feature_flags
notifications
profiles
quote_analysis
quote_uploads
search_history
user_feedback
```

---

## 🐛 Troubleshooting

### Error: "type already exists"
- Table/type was created in previous migration
- This is normal - "IF EXISTS" clauses handle it
- Safe to continue

### Error: "relation doesn't exist"
- Migration references non-existent table
- Check if earlier migrations ran successfully
- Run migrations IN ORDER

### Error: "permission denied"
- You need owner/admin role in Supabase
- Check project access

### Storage policies not working
- Ensure `quote-uploads` bucket exists first
- Policies MUST be added via Dashboard (not SQL)
- Check bucket visibility is "Public"

---

## 📝 Notes

- ✅ Filename sanitization in upload fixed
- ✅ Button "Parcourir les fichiers" fixed
- ✅ All 3 app commits pushed:
  - `Fix: Sanitize PDF filenames`
  - `Fix: File input button click handler`
  - `Feat: Add cleanup migration + remove unnecessary migrations`

- ⏳ Next: Apply these migrations to your Supabase project
- ⏳ Then: Test upload flow on `/quote-upload`

---

## 🔗 References

- Supabase SQL Editor: https://supabase.com/dashboard
- Storage policies: Dashboard → Storage → Buckets → Policies
- RLS docs: https://supabase.com/docs/guides/auth/row-level-security
