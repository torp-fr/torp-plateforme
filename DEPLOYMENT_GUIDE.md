# 🚀 Guide de Déploiement - Admin Panel & Knowledge Base

## ⚠️ Problème Rencontré

```
Error: Failed to run sql query: ERROR: 42P01: relation "profiles" does not exist
```

**Cause:** La table `profiles` n'existait pas dans Supabase

**Solution:** Migration 049 créée avec `CREATE TABLE IF NOT EXISTS`

---

## 📋 Deployment Steps

### Step 1: Deploy Migration to Supabase

**Option A: Via CLI (Recommended)**
```bash
supabase db push
```

**Option B: Via Supabase Dashboard**
1. Go to `SQL Editor`
2. Open file: `supabase/migrations/049_fix_profiles_and_add_kb.sql`
3. Copy entire content
4. Paste in SQL Editor
5. Click "Run"

**Option C: Via Direct SQL**
If you have direct database access:
```bash
psql postgresql://user:password@host/db < supabase/migrations/049_fix_profiles_and_add_kb.sql
```

---

## ✅ Verify Migration Success

After running migration:

### 1. Check Tables Created
```sql
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
  AND table_name LIKE 'knowledge_%';
```

Expected output:
```
knowledge_documents
knowledge_document_sections
knowledge_vectors
knowledge_queries_log
```

### 2. Check Profiles Table
```sql
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'profiles';
```

Should include new columns:
```
role (TEXT)
is_admin (BOOLEAN)
can_upload_kb (BOOLEAN)
created_role_date (TIMESTAMP)
updated_role_date (TIMESTAMP)
```

### 3. Check Functions Created
```sql
SELECT routine_name 
FROM information_schema.routines 
WHERE routine_schema = 'public' 
  AND routine_name LIKE '%admin%';
```

Expected:
```
promote_user_to_admin
demote_admin_to_user
is_user_admin
```

---

## 🔧 Initialize First Admin User

After migration is deployed, initialize the first admin:

### Option 1: Via Direct SQL
```sql
-- First, ensure user profile exists
INSERT INTO profiles (id, email, full_name, role, is_admin, can_upload_kb)
SELECT id, email, 'Admin User', 'admin', true, true
FROM auth.users
WHERE email = 'your-email@example.com'
ON CONFLICT (id) DO UPDATE
SET role = 'admin', is_admin = true, can_upload_kb = true, updated_role_date = NOW();
```

### Option 2: Via Application
1. Go to `/admin/users` (as any user)
2. See "Access Denied" message
3. Have a super_admin manually promote you via SQL above
4. Reload page
5. Now you can see user management

### Option 3: Via Supabase Dashboard
1. Go to `Authentication` → `Users`
2. Find your user
3. Note their `UUID`
4. Go to `SQL Editor`
5. Run:
```sql
UPDATE profiles 
SET role = 'admin', is_admin = true, can_upload_kb = true
WHERE id = 'YOUR_USER_UUID';
```

---

## 🎯 What Each Migration Does

### Migration 048 (Original - Skip if using 049)
- ❌ Failed because profiles table didn't exist
- ❌ Tried to ALTER TABLE profiles

### Migration 049 (Fixed - Use This)
- ✅ `CREATE TABLE IF NOT EXISTS profiles`
- ✅ Includes all columns (new + existing)
- ✅ Uses idempotent SQL patterns
- ✅ Handles existing RLS policies gracefully
- ✅ Creates all KB tables
- ✅ Creates SQL functions for admin operations

**Key Pattern Used:**
```sql
DO $$ BEGIN
  CREATE POLICY "name" ON table ...
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
```

This prevents errors if the object already exists!

---

## 📚 After Migration: Next Steps

### 1. Test Admin Access
```
User A (regular user):
  - Go to /analytics
  - See "Access Denied" ✓

User B (admin):
  - Go to /analytics
  - See tabs: Overview | KB Upload | Users | Settings ✓
  - Click "KB Upload" tab
  - Upload a PDF/TXT document ✓
```

### 2. Test User Management
```
Admin user:
  - Go to /analytics
  - Click "Users" tab
  - Click "Manage Users" button
  - Navigate to /admin/users
  - See list of all users ✓
  - Promote/demote buttons work ✓
```

### 3. Upload First Document
```
Admin user:
  - Go to /analytics
  - Click "KB Upload" tab
  - Select document (PDF/TXT)
  - Fill in: Title, Category, WorkTypes (optional), Source
  - Click "Upload"
  - See success message ✓
```

### 4. Verify Database
```sql
-- Check documents uploaded
SELECT title, category, source, confidence_score 
FROM knowledge_documents 
LIMIT 5;

-- Check audit log
SELECT admin_id, action, created_at 
FROM admin_audit_log 
LIMIT 5;

-- Check KB queries
SELECT query_text, results_count 
FROM knowledge_queries_log 
LIMIT 5;
```

---

## 🔒 Security Checklist

After deployment, verify:

- [ ] Profile RLS policies working (users can only see own profile)
- [ ] Knowledge documents RLS working (public docs visible, admin-only docs hidden)
- [ ] Admin audit log RLS working (only admins can view)
- [ ] Functions are SECURITY DEFINER (safe to call from app)
- [ ] No direct database access from frontend (use services only)

---

## 🐛 Troubleshooting

### Error: "relation profiles does not exist"
**Solution:** Run migration 049

### Error: "duplicate_object"
**Solution:** Migration 049 is idempotent - safe to re-run

### Error: "permission denied for schema public"
**Solution:** Check Supabase user permissions - should have CREATE/ALTER rights

### Error: "vector type does not exist"
**Solution:** pgvector extension not enabled - run this first:
```sql
CREATE EXTENSION IF NOT EXISTS vector;
```

### Can't upload KB documents
**Checklist:**
1. Are you logged in as admin? ✓
2. Is `can_upload_kb = true` in your profile? ✓
3. Did migration 049 run successfully? ✓
4. Is file PDF or TXT? ✓
5. Is file less than 10MB? ✓

---

## 📊 Migration Files

```
supabase/migrations/
├─ 048_add_user_roles_and_kb_tables.sql (Original - DON'T USE)
└─ 049_fix_profiles_and_add_kb.sql (Fixed - USE THIS)
```

**Recommendation:** Delete 048, keep 049

---

## 🚀 One-Line Deploy

If you have Supabase CLI installed:

```bash
supabase db push && echo "✅ Migration deployed!"
```

---

## 📞 Support

If you encounter issues:

1. Check `TROUBLESHOOTING` section above
2. Run verification queries
3. Check Supabase logs (Dashboard → Logs)
4. Verify migration ran successfully (Dashboard → SQL → Migrations)

---

**Status:** ✅ Ready to deploy
**Migration:** 049_fix_profiles_and_add_kb.sql
**Safe to re-run:** Yes (idempotent)
**Required:** Yes (for admin panel + KB functionality)
