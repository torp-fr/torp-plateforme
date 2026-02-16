# SUPABASE DATABASE EMERGENCY DIAGNOSTIC
## Issue: Login Failing - public.users Table Deleted
**Status:** CRITICAL - Production Down
**Date:** 2026-02-16
**Impact:** All user authentication, profile access, admin functions broken

---

## PROBLEM SUMMARY

The application is in a critical state because the `public.users` table was deleted, but the codebase still has multiple references to it:

1. **GET /rest/v1/profiles?select=* → 500 ERROR**
   - RLS policies fail
   - Database triggers fire incorrectly
   - Users cannot query profiles table

2. **RPC get_admin_status() → FAILS**
   - Error: `relation "public.users" does not exist`
   - Cannot check if system has admin
   - User login blocked at admin check

3. **New user registration FAILS**
   - `handle_new_user()` trigger tries to INSERT into deleted table
   - Auth users cannot create profiles
   - Cascade failures in auth flow

4. **Multiple RLS policies BROKEN**
   - Reference to `public.user_roles` (doesn't exist)
   - Subqueries against deleted `public.users`
   - System alerts policies crash

---

## ROOT CAUSES IDENTIFIED

### 1. Missing `public.users` Table
**Location:** Migrations 055, 056
**Impact:** All functions expecting this table fail

```sql
-- These migrations expect public.users to exist:
ALTER TABLE public.users ADD COLUMN...  -- FAILS
INSERT INTO public.users...  -- FAILS
SELECT FROM public.users...  -- FAILS
```

**Files affected:**
- `/home/user/torp-plateforme/supabase/migrations/055_fix_auth_sync_and_admin_roles.sql` (lines 10-189)
- `/home/user/torp-plateforme/supabase/migrations/056_sync_auth_users_complete.sql` (lines 11-55)

### 2. Broken RPC Functions

#### get_admin_status() - CRITICAL
**File:** `/home/user/torp-plateforme/supabase/migrations/055_fix_auth_sync_and_admin_roles.sql` (lines 147-161)
```sql
CREATE OR REPLACE FUNCTION get_admin_status()
RETURNS JSONB AS $$
BEGIN
  SELECT COUNT(*) INTO admin_count FROM public.users WHERE is_admin = TRUE;  -- ❌ TABLE MISSING
  ...
END;
```

**Called from:** `/home/user/torp-plateforme/src/api/admin.ts:13`

#### promote_user_to_admin() - CRITICAL
**File:** `/home/user/torp-plateforme/supabase/migrations/055_fix_auth_sync_and_admin_roles.sql` (lines 96-141)
```sql
CREATE OR REPLACE FUNCTION promote_user_to_admin(user_email TEXT)
RETURNS JSONB AS $$
BEGIN
  SELECT id INTO target_user_id FROM public.users WHERE email = user_email;  -- ❌ TABLE MISSING
  ...
END;
```

### 3. Broken Trigger Function
**File:** `/home/user/torp-plateforme/supabase/migrations/055_fix_auth_sync_and_admin_roles.sql` (lines 25-71)
```sql
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.users (...) VALUES (...);  -- ❌ TABLE MISSING
  INSERT INTO public.profiles (...) VALUES (...);  -- Only this works
  ...
END;
```

**Problem:** When new user signs up, auth.users fires trigger → tries INSERT into deleted public.users → FAILURE

### 4. Missing RPC Functions
These functions are called but don't exist:
- `is_user_admin(UUID)` - Used by AdminService
- `demote_admin_to_user(UUID)` - Used by AdminService
- `create_user_profile(...)` - Used by auth.service.ts registration

**Files expecting these:**
- `/home/user/torp-plateforme/src/services/api/supabase/admin.service.ts:64,86,108`
- `/home/user/torp-plateforme/src/services/api/supabase/auth.service.ts:168`

### 5. Broken RLS Policies
**File:** `/home/user/torp-plateforme/supabase/migrations/20260216000005_phase30_3_resilience.sql` (lines 323)
```sql
CREATE POLICY system_health_admin_read ON public.system_health_status
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles  -- ❌ TABLE DOESN'T EXIST
      WHERE user_id = auth.uid()
      ...
```

**Also in:** `/home/user/torp-plateforme/supabase/migrations/055_fix_auth_sync_and_admin_roles.sql` (line 171)
```sql
CREATE POLICY "Users can read own record" ON public.users
  USING (auth.uid() = id OR (SELECT is_admin FROM public.users WHERE id = auth.uid()) = TRUE);
  -- ❌ SELF-REFERENTIAL QUERY ON DELETED TABLE
```

### 6. Architecture Mismatch
The codebase has **TWO parallel user storage systems**:

| System | Table | Purpose | Status |
|--------|-------|---------|--------|
| Auth | `auth.users` | Authentication | ✅ Working |
| Old Model | `public.users` | Business data | ❌ **DELETED** |
| New Model | `public.profiles` | User profiles & roles | ✅ Working |

**Problem:** Code and migrations still reference the deleted `public.users` table instead of using only `public.profiles`

---

## IMMEDIATE ACTION REQUIRED

### Phase 1: EMERGENCY FIX (5-10 minutes)
Run `/home/user/torp-plateforme/SUPABASE_CRITICAL_FIXES.sql` in Supabase SQL Editor

**This will:**
1. Create missing `public.user_roles` table
2. Fix `handle_new_user()` trigger to use only profiles
3. Fix `get_admin_status()` to query profiles instead
4. Fix `promote_user_to_admin()` to use profiles only
5. Create missing RPC functions
6. Fix broken RLS policies
7. Sync all auth users to profiles table
8. Enable proper RLS

### Phase 2: VERIFICATION (2-3 minutes)
Run these queries to verify everything works:

```sql
-- 1. Test get_admin_status RPC
SELECT * FROM (SELECT public.get_admin_status()) as result;

-- 2. Check profiles table has data
SELECT COUNT(*) as total_profiles,
       COUNT(CASE WHEN is_admin THEN 1 END) as admin_count
FROM public.profiles;

-- 3. Check all auth.users are in profiles
SELECT COUNT(*) as orphaned_users
FROM auth.users
WHERE id NOT IN (SELECT id FROM public.profiles);

-- 4. Test RLS policies work
SELECT COUNT(*) FROM public.profiles WHERE id = auth.uid();

-- 5. Check RPC functions exist
SELECT routine_name FROM information_schema.routines
WHERE routine_schema = 'public'
AND routine_name IN ('get_admin_status', 'promote_user_to_admin', 'is_user_admin', 'demote_admin_to_user', 'create_user_profile');
```

### Phase 3: APPLICATION TESTING
After running SQL fixes:

1. **Test Login Flow:**
   ```bash
   curl -X POST https://your-app.com/api/login \
     -d '{"email":"user@test.com","password":"password"}'
   ```
   Expected: Should complete without errors

2. **Test Admin Check:**
   - Login with admin account
   - Check browser console for errors
   - Should see admin role reflected

3. **Test Registration:**
   - Create new account
   - Should complete without trigger errors
   - Profile should auto-create

4. **Test Admin Functions:**
   - Check user list loads
   - Try promoting user to admin
   - Should work without errors

---

## MIGRATION STRATEGY

### For Long-term Fix (non-emergency):

1. **Update migration 055** to skip public.users operations:
   ```sql
   -- File: supabase/migrations/055_fix_auth_sync_and_admin_roles.sql
   -- Remove lines 10-22 (ALTER TABLE public.users)
   -- Remove lines 29-46 (INSERT INTO public.users in trigger)
   -- Remove lines 77-90 (INSERT INTO public.users sync)
   ```

2. **Update migration 056** to use profiles instead:
   ```sql
   -- File: supabase/migrations/056_sync_auth_users_complete.sql
   -- Replace all public.users references with public.profiles
   ```

3. **Update migration 20260216000005** RLS policy:
   ```sql
   -- File: supabase/migrations/20260216000005_phase30_3_resilience.sql
   -- Line 323: Replace public.user_roles with profiles table check
   ```

4. **Create new cleanup migration** to prevent recurrence:
   ```sql
   -- File: supabase/migrations/XXXXX_remove_public_users_references.sql
   -- Drop all triggers and functions that reference deleted tables
   -- Ensure all code uses profiles table exclusively
   ```

---

## AFFECTED FILES

### Database Migrations (BROKEN)
- ❌ `/home/user/torp-plateforme/supabase/migrations/055_fix_auth_sync_and_admin_roles.sql`
- ❌ `/home/user/torp-plateforme/supabase/migrations/056_sync_auth_users_complete.sql`
- ❌ `/home/user/torp-plateforme/supabase/migrations/20260216000005_phase30_3_resilience.sql`

### Source Code (FUNCTIONAL BUT AFFECTED BY DB ISSUES)
- `/home/user/torp-plateforme/src/api/admin.ts` (calls get_admin_status RPC)
- `/home/user/torp-plateforme/src/services/api/supabase/admin.service.ts` (calls broken RPCs)
- `/home/user/torp-plateforme/src/services/api/supabase/auth.service.ts` (registration with broken trigger)

### Config Files (FINE)
- ✅ `/home/user/torp-plateforme/src/lib/supabase.ts` - Client initialization
- ✅ `/home/user/torp-plateforme/supabase/migrations/054_create_profiles_table.sql` - Profiles table definition

---

## WHY THIS HAPPENED

1. **Table Deleted but Functions Not Updated**
   - Someone dropped public.users table
   - But migrations 055 & 056 still tried to use it
   - Functions and triggers weren't refactored

2. **Multiple User Storage Systems**
   - Started with public.users (early design)
   - Added public.profiles (new auth model)
   - Never fully migrated code to use only profiles
   - Resulted in fragmented references

3. **RLS Policy Complexity**
   - Added references to non-existent public.user_roles
   - Some policies reference self (circular query)
   - Not enough validation during migration creation

---

## PREVENTION FOR FUTURE

1. **Use database schema validation** before migrations:
   ```sql
   -- Add to all migrations that modify schema:
   DO $$ BEGIN
     IF NOT EXISTS (SELECT FROM information_schema.tables WHERE table_name='users') THEN
       RAISE EXCEPTION 'Expected table public.users not found';
     END IF;
   END $$;
   ```

2. **Create migration validation tests:**
   - Run all migrations in order
   - Test all RPC functions exist
   - Verify all tables referenced in policies exist
   - Check triggers can execute

3. **Add pre-deployment checklist:**
   - [ ] All referenced tables exist
   - [ ] All RPC functions exist and can be called
   - [ ] All triggers execute without error
   - [ ] All RLS policies have valid table references
   - [ ] No circular dependencies

---

## ADDITIONAL CONTEXT

### Current Architecture
```
auth.users (Supabase managed)
  ↓ (trigger on_auth_user_created)
  ↓ [BROKEN: tries to use deleted public.users]
  ↓ [WORKS: inserts into public.profiles]
public.profiles (User profiles + roles)
  ← Used by auth.service.ts
  ← Used by admin.service.ts
  ← Queried via REST API /profiles endpoint
```

### Expected Architecture (after fix)
```
auth.users (Supabase managed)
  ↓ (trigger on_auth_user_created)
  ↓ [FIXED: inserts only into public.profiles]
public.profiles (User profiles + roles)
  ← Used by auth.service.ts ✅
  ← Used by admin.service.ts ✅
  ← Queried via REST API /profiles endpoint ✅
public.user_roles (Role assignments - optional)
  ← Reference by RLS policies for complex role checks
```

---

## EMERGENCY CONTACT

If SQL fixes don't resolve the issue:

1. **Database is unresponsive:**
   - Contact Supabase support with project URL
   - Request database health check

2. **RLS policies still broken:**
   - Verify auth.users table still exists
   - Check profiles table columns match expectations
   - Run constraint validation: `SELECT * FROM information_schema.table_constraints`

3. **Users can't login:**
   - Check auth logs in Supabase dashboard
   - Verify JWT signing key is correct
   - Check email confirmation requirements

---

## QUICK REFERENCE

| Issue | Cause | Fix |
|-------|-------|-----|
| 500 error on /profiles | RLS policy fails | Run CRITICAL_FIXES.sql |
| get_admin_status fails | Queries deleted table | Run CRITICAL_FIXES.sql |
| New users can't register | Trigger fails | Run CRITICAL_FIXES.sql |
| Admin functions not work | Missing RPC functions | Run CRITICAL_FIXES.sql |
| public.user_roles error | Table doesn't exist | Run CRITICAL_FIXES.sql |

**TL;DR: Execute SUPABASE_CRITICAL_FIXES.sql then test login**

---

## EXECUTION STEPS

### Step 1: Access Supabase Dashboard
1. Go to https://supabase.com/dashboard
2. Select your project
3. Click "SQL Editor" in left sidebar

### Step 2: Run Emergency Fixes
1. Create new query
2. Copy entire contents of `SUPABASE_CRITICAL_FIXES.sql`
3. Click "Run" (or Ctrl+Enter)
4. Wait for all statements to complete (should show ✅)

### Step 3: Verify No Errors
- Check "Output" tab for any red error messages
- All fixes should execute in < 30 seconds
- No "relation does not exist" errors should appear

### Step 4: Test Login
- Go to app login page
- Try logging in with existing user
- Should complete login flow without 500 errors

### Step 5: Monitor Logs
- Check browser console for errors
- Check Supabase function logs
- Check application logs for any warnings

---

**Document Version:** 1.0
**Last Updated:** 2026-02-16
**Status:** ACTIVE - Execute immediately for production recovery
