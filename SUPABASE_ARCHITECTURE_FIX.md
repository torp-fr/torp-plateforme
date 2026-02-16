# SUPABASE ARCHITECTURE FIX - TECHNICAL REFERENCE

## Executive Summary

The Supabase database was using a dual user storage model:
1. **Old Model:** `public.users` table (now deleted) ❌
2. **New Model:** `public.profiles` table (should be primary) ✅

The application code and database functions were **not fully migrated** from the old model to the new model. When someone deleted `public.users`, everything broke.

**Solution:** Fully migrate all remaining references to use only `public.profiles`.

---

## Architecture BEFORE (Broken)

```
┌─────────────────────────────────────────────────────────────┐
│                      APPLICATION LAYER                       │
├─────────────────────────────────────────────────────────────┤
│  SupabaseAuthService.register()                              │
│  ├─ auth.signUp() → Creates auth.users                       │
│  ├─ Trigger fires: on_auth_user_created                      │
│  │  ├─ INSERT INTO public.users ❌ DELETED TABLE             │
│  │  └─ INSERT INTO public.profiles ✅ Works                  │
│  └─ RPC: create_user_profile() → Bypasses registration       │
│                                                               │
│  AdminService.getCurrentUserAdminStatus()                     │
│  ├─ RPC: get_admin_status() → Queries public.users ❌        │
│  └─ SELECT FROM public.profiles ✅ Works                     │
│                                                               │
│  AuthRoute.tsx → checkAdminStatus()                          │
│  └─ RPC: get_admin_status() ❌ FAILS with 500 error         │
└─────────────────────────────────────────────────────────────┘
            ↓                    ↓                ↓
┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐
│   auth.users     │  │  public.users    │  │ public.profiles  │
│   ✅ Exists      │  │  ❌ DELETED      │  │ ✅ Exists        │
└──────────────────┘  └──────────────────┘  └──────────────────┘
```

---

## Architecture AFTER (Fixed)

```
┌─────────────────────────────────────────────────────────────┐
│                      APPLICATION LAYER                       │
├─────────────────────────────────────────────────────────────┤
│  SupabaseAuthService.register()                              │
│  ├─ auth.signUp() → Creates auth.users                       │
│  ├─ Trigger fires: on_auth_user_created                      │
│  │  └─ INSERT INTO public.profiles ✅ Fixed                  │
│  └─ RPC: create_user_profile() → Inserts profile ✅          │
│                                                               │
│  AdminService.getCurrentUserAdminStatus()                     │
│  ├─ RPC: get_admin_status() → Queries public.profiles ✅     │
│  └─ SELECT FROM public.profiles ✅ Works                     │
│                                                               │
│  AuthRoute.tsx → checkAdminStatus()                          │
│  └─ RPC: get_admin_status() ✅ Works correctly              │
└─────────────────────────────────────────────────────────────┘
            ↓                                    ↓
┌──────────────────┐                  ┌──────────────────┐
│   auth.users     │                  │ public.profiles  │
│   ✅ Exists      │                  │ ✅ Primary       │
└──────────────────┘                  └──────────────────┘
         ↓ (on INSERT/UPDATE trigger)         ↓
         └──────────────────────────────────────┘
           Syncs to profiles via trigger
```

---

## Changes Made by Emergency Fix

### 1. Trigger Function: `handle_new_user()`

**BEFORE (Broken):**
```sql
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  -- This fails because public.users table no longer exists
  INSERT INTO public.users (
    id, email, name, user_type, role, is_admin, can_upload_kb, created_at, updated_at
  ) VALUES (NEW.id, NEW.email, ...);

  -- This works but first INSERT failed
  INSERT INTO public.profiles (
    id, email, full_name, role, is_admin, can_upload_kb, created_at, updated_at
  ) VALUES (NEW.id, NEW.email, ...);

  RETURN NEW;
END;
```

**AFTER (Fixed):**
```sql
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  -- Only insert into profiles table (which exists)
  INSERT INTO public.profiles (
    id, email, full_name, role, is_admin, can_upload_kb, created_at, updated_at
  ) VALUES (NEW.id, NEW.email, COALESCE(...), 'user', FALSE, FALSE, now(), now())
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    full_name = EXCLUDED.full_name,
    updated_at = now();

  RETURN NEW;
END;
```

**Impact:** New user registrations now work without trigger failures.

---

### 2. RPC Function: `get_admin_status()`

**BEFORE (Broken):**
```sql
CREATE OR REPLACE FUNCTION get_admin_status()
RETURNS JSONB AS $$
DECLARE
  admin_count INTEGER;
BEGIN
  -- Query deleted table → ERROR: relation "public.users" does not exist
  SELECT COUNT(*) INTO admin_count FROM public.users WHERE is_admin = TRUE;

  RETURN jsonb_build_object(
    'has_admin', admin_count > 0,
    'admin_count', admin_count,
    'can_create_admin', admin_count = 0
  );
END;
```

**Called from:**
- `/home/user/torp-plateforme/src/api/admin.ts:13` - `checkAdminStatus()`

**Error:**
```
Error: relation "public.users" does not exist at character 82
```

**AFTER (Fixed):**
```sql
CREATE OR REPLACE FUNCTION get_admin_status()
RETURNS JSONB AS $$
DECLARE
  admin_count INTEGER;
BEGIN
  -- Query profiles table (which exists)
  SELECT COUNT(*) INTO admin_count FROM public.profiles WHERE is_admin = TRUE;

  RETURN jsonb_build_object(
    'has_admin', admin_count > 0,
    'admin_count', admin_count,
    'can_create_admin', admin_count = 0
  );
END;
```

**Impact:** Admin status checks now work. Login flow unblocked.

---

### 3. RPC Function: `promote_user_to_admin()`

**BEFORE (Broken):**
```sql
CREATE OR REPLACE FUNCTION promote_user_to_admin(user_email TEXT)
RETURNS JSONB AS $$
DECLARE
  target_user_id UUID;
BEGIN
  -- Query deleted table → ERROR
  SELECT id INTO target_user_id FROM public.users WHERE email = user_email;

  IF target_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'User not found');
  END IF;

  -- Update deleted table → ERROR
  UPDATE public.users SET role = 'admin', is_admin = TRUE, ...
  WHERE id = target_user_id;

  -- Update existing table
  UPDATE public.profiles SET role = 'admin', is_admin = TRUE, ...
  WHERE id = target_user_id;

  RETURN jsonb_build_object('success', true, ...);
END;
```

**AFTER (Fixed):**
```sql
CREATE OR REPLACE FUNCTION promote_user_to_admin(user_email TEXT)
RETURNS JSONB AS $$
DECLARE
  target_user_id UUID;
BEGIN
  -- Query profiles table only
  SELECT id INTO target_user_id FROM public.profiles WHERE email = user_email;

  IF target_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'User not found');
  END IF;

  -- Update profiles table only
  UPDATE public.profiles
  SET role = 'admin', is_admin = TRUE, can_upload_kb = TRUE, ...
  WHERE id = target_user_id;

  RETURN jsonb_build_object('success', true, ...);
END;
```

**Impact:** Admin promotion functions work again.

---

### 4. NEW RPC Functions (Were Missing)

These functions were **called but didn't exist** in the database:

#### `is_user_admin(UUID)`
```sql
CREATE OR REPLACE FUNCTION is_user_admin(user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = user_id AND (role = 'admin' OR role = 'super_admin')
  );
END;
```

**Called from:** `/home/user/torp-plateforme/src/services/api/supabase/admin.service.ts:108`

#### `demote_admin_to_user(UUID)`
```sql
CREATE OR REPLACE FUNCTION demote_admin_to_user(user_id UUID)
RETURNS JSONB AS $$
BEGIN
  UPDATE public.profiles
  SET role = 'user', is_admin = FALSE, can_upload_kb = FALSE, ...
  WHERE id = user_id;

  RETURN jsonb_build_object('success', true, ...);
END;
```

**Called from:** `/home/user/torp-plateforme/src/services/api/supabase/admin.service.ts:86`

#### `create_user_profile(UUID, TEXT, TEXT, TEXT, TEXT, TEXT)`
```sql
CREATE OR REPLACE FUNCTION create_user_profile(
  p_user_id UUID,
  p_email TEXT,
  p_name TEXT,
  p_user_type TEXT,
  p_company TEXT DEFAULT NULL,
  p_phone TEXT DEFAULT NULL
)
RETURNS JSONB AS $$
BEGIN
  INSERT INTO public.profiles (
    id, email, full_name, role, is_admin, can_upload_kb, created_at, updated_at
  ) VALUES (p_user_id, p_email, p_name, 'user', FALSE, FALSE, now(), now())
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    full_name = EXCLUDED.full_name,
    updated_at = now();

  RETURN jsonb_build_object('success', true, ...);
END;
```

**Called from:** `/home/user/torp-plateforme/src/services/api/supabase/auth.service.ts:168`

**Impact:** Registration RPC now works. Admin management functions work.

---

### 5. Missing Table: `public.user_roles`

**Created:**
```sql
CREATE TABLE IF NOT EXISTS public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user', 'admin', 'super_admin')),
  assigned_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  assigned_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  UNIQUE(user_id, role)
);
```

**Reason:** RLS policy in migration 20260216000005 references this table. Now it exists.

**Usage:** Can be used for complex role queries in future, but for now profiles table is primary.

---

### 6. Fixed RLS Policies

**BEFORE (Broken) - Line 323 of migration 20260216000005:**
```sql
CREATE POLICY system_health_admin_read ON public.system_health_status
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles  -- ❌ TABLE DOESN'T EXIST
      WHERE user_id = auth.uid()
      AND role IN ('admin', 'super_admin')
    )
  );
```

**AFTER (Fixed):**
```sql
CREATE POLICY system_health_admin_read ON public.system_health_status
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles  -- ✅ USES PROFILES TABLE
      WHERE id = auth.uid()
      AND (role = 'admin' OR role = 'super_admin')
    )
  );
```

**Impact:** System alerts and health checks now accessible to admins.

---

## Data Migration (Automatic)

The emergency fix includes automatic synchronization:

```sql
INSERT INTO public.profiles (
  id, email, full_name, role, is_admin, can_upload_kb, created_at, updated_at
)
SELECT
  au.id,
  au.email,
  COALESCE(au.raw_user_meta_data->>'name', au.raw_user_meta_data->>'full_name', au.email),
  'user',
  FALSE,
  FALSE,
  au.created_at,
  au.updated_at
FROM auth.users au
WHERE NOT EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = au.id)
ON CONFLICT (id) DO UPDATE SET
  email = EXCLUDED.email,
  full_name = EXCLUDED.full_name,
  updated_at = now();
```

**Result:**
- All existing auth users automatically synced to profiles
- No data loss
- Profiles table becomes single source of truth

---

## Data Model Comparison

### Old Model (Deleted)
```
public.users
├─ id (UUID)
├─ email (TEXT)
├─ name (TEXT)
├─ user_type (user_type enum)
├─ role (TEXT)
├─ is_admin (BOOLEAN)
├─ can_upload_kb (BOOLEAN)
├─ company (TEXT)
├─ phone (TEXT)
├─ city (TEXT)
├─ postal_code (TEXT)
├─ property_type (TEXT)
├─ company_siret (TEXT)
└─ ... many other B2C/B2B specific fields
```

### New Model (Current - Authoritative)
```
public.profiles
├─ id (UUID, FK to auth.users)
├─ email (TEXT)
├─ full_name (TEXT)
├─ avatar_url (TEXT)
├─ role (TEXT) ← admin / super_admin / user
├─ is_admin (BOOLEAN)
├─ can_upload_kb (BOOLEAN)
├─ created_at (TIMESTAMP)
├─ updated_at (TIMESTAMP)
└─ updated_role_date (TIMESTAMP)
```

**Note:** Old model had many B2C/B2B fields. New model is minimal. For complex user data, should use separate tables or extend profiles table with additional columns.

---

## System Health Check After Fix

### Verification Queries

**1. Check profiles table has data:**
```sql
SELECT
  COUNT(*) as total_profiles,
  COUNT(CASE WHEN is_admin THEN 1 END) as admin_count,
  COUNT(CASE WHEN is_admin = FALSE THEN 1 END) as user_count
FROM public.profiles;
```

Expected: Should have profiles for all auth users.

**2. Check RPC functions exist:**
```sql
SELECT routine_name, routine_type
FROM information_schema.routines
WHERE routine_schema = 'public'
AND routine_name IN (
  'get_admin_status',
  'promote_user_to_admin',
  'is_user_admin',
  'demote_admin_to_user',
  'create_user_profile'
)
ORDER BY routine_name;
```

Expected: All 5 functions should exist and be FUNCTION type.

**3. Check no orphaned auth users:**
```sql
SELECT COUNT(*) as orphaned_users
FROM auth.users
WHERE id NOT IN (SELECT id FROM public.profiles);
```

Expected: Should return 0.

**4. Check RLS is enabled:**
```sql
SELECT tablename, rowsecurity
FROM pg_tables
WHERE tablename IN ('profiles', 'system_health_status')
ORDER BY tablename;
```

Expected: rowsecurity = TRUE for both.

**5. Test RPC directly:**
```sql
SELECT public.get_admin_status();
SELECT public.is_user_admin('550e8400-e29b-41d4-a716-446655440000'::UUID);
```

Expected: Both return JSONB/BOOLEAN without errors.

---

## Files Modified in Database

| File | Type | Changes |
|------|------|---------|
| Trigger: `on_auth_user_created` | Database | Removed INSERT to public.users |
| Function: `get_admin_status` | Database | Changed query source from public.users to public.profiles |
| Function: `promote_user_to_admin` | Database | Changed query/update source from public.users to public.profiles |
| Function: `is_user_admin` | Database | CREATED - was missing |
| Function: `demote_admin_to_user` | Database | CREATED - was missing |
| Function: `create_user_profile` | Database | CREATED - was missing |
| Table: `public.user_roles` | Database | CREATED - referenced by policies |
| Policy: `system_health_admin_read` | Database | Changed query from user_roles to profiles |
| Policy: `Users can read their own profile` | Database | Verified correct |
| Policy: `Admins can read all profiles` | Database | Verified correct |

---

## Source Code Not Changed

The application source code **does not need changes** because:

1. **auth.service.ts** already uses profiles table
   - ✅ Queries from profiles for login
   - ✅ Calls create_user_profile RPC for registration

2. **admin.service.ts** already calls correct RPCs
   - ✅ Calls get_admin_status, promote_user_to_admin, etc.
   - ✅ RPCs now exist and work correctly

3. **admin.ts** already calls get_admin_status
   - ✅ RPC now works without "relation does not exist" error

**The bug was in the database implementation, not the app code.**

---

## Rollback Plan (If Needed)

If the fix causes unexpected issues:

1. **Don't manually revert changes**
2. **Contact Supabase support** with error details
3. **Request database restore** from pre-fix backup
4. **Re-run the fix** after debugging

The fix is safe to re-run multiple times without data loss because all changes use `IF NOT EXISTS` or `ON CONFLICT` clauses.

---

## Prevention for Future

### 1. Pre-Migration Validation
Before deploying any migration:
```bash
# Check all referenced tables exist
SELECT COUNT(*) FROM information_schema.tables
WHERE table_schema = 'public'
AND table_name IN (/* list all tables referenced in migration */);
```

### 2. Function Validation
```bash
# Check all functions exist
SELECT COUNT(*) FROM information_schema.routines
WHERE routine_schema = 'public'
AND routine_name IN (/* list all functions referenced */);
```

### 3. Trigger Validation
```bash
# Check all triggers execute without error
SELECT pg_get_triggerdef(oid) FROM pg_trigger;
-- Test each trigger manually
```

### 4. Migration Checklist
Before each migration:
- [ ] All referenced tables exist or are created in migration
- [ ] All referenced functions exist or are created in migration
- [ ] No circular references
- [ ] All triggers tested
- [ ] RLS policies validated
- [ ] Data integrity checked

---

## Timeline of Events

| Date | Event | Impact |
|------|-------|--------|
| 2026-02-?? | `public.users` table created | System working |
| 2026-02-?? | `public.profiles` created as new model | Dual system |
| 2026-02-?? | Code migrated to use profiles | Migration incomplete |
| 2026-02-?? | `public.users` table deleted | **CRITICAL: All breaks** |
| 2026-02-16 | Emergency fix deployed | **System restored** |

---

## Long-term Recommendations

1. **Use profiles table exclusively**
   - Remove all references to deleted tables
   - Make profiles the single user record source

2. **Consider extending profiles with business data**
   - Add company info columns to profiles
   - Or create separate user_profile_extended table

3. **Set up automated validation**
   - Database schema tests on each PR
   - Function existence checks before deployment
   - Trigger execution tests

4. **Implement migration safeguards**
   - Schema versioning
   - Rollback testing
   - Dry-run validation

---

**Document Version:** 1.0
**Created:** 2026-02-16
**Last Updated:** 2026-02-16
**Status:** Active - Architecture now fixed and stable
