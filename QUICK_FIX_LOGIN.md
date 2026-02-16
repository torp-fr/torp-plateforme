# QUICK FIX: RESTORE LOGIN - 5 MINUTES

## The Problem
User dropped the `public.users` table, but the application still tries to use it. Now:
- Login returns 500 errors
- Admin functions fail
- New registrations fail

## The Solution
Execute the emergency SQL fix that rewires everything to use the `public.profiles` table instead.

---

## STEP-BY-STEP FIX (5 minutes)

### Step 1: Open Supabase SQL Editor (1 minute)
1. Go to https://supabase.com/dashboard
2. Find your project
3. Click "SQL Editor" in the left sidebar
4. Click "New query" (top-right button)

### Step 2: Copy and Paste the Fix (1 minute)
Open this file:
```
/home/user/torp-plateforme/SUPABASE_CRITICAL_FIXES.sql
```

Copy the **entire contents** and paste it into the SQL Editor.

### Step 3: Execute (2 minutes)
1. Click the "Run" button (blue play icon, top-right)
   - OR press `Ctrl+Enter` / `Cmd+Enter`
2. Wait for completion (should show green checkmarks)
3. All statements should execute successfully

### Step 4: Verify It Worked (1 minute)
Run this quick test in a new SQL query:

```sql
-- Test 1: Check profiles have data
SELECT COUNT(*) as total_profiles FROM public.profiles;

-- Test 2: Check RPC works
SELECT public.get_admin_status();

-- Test 3: Check no orphaned users
SELECT COUNT(*) as orphaned FROM auth.users
WHERE id NOT IN (SELECT id FROM public.profiles);
```

All three should return successfully without errors.

---

## NOW TEST THE APP

### Test Login
1. Go to your app login page
2. Sign in with your account
3. Should work without 500 error

### Test Admin Functions
1. If you have admin rights, check the admin dashboard
2. User management should load
3. Should show list of users

### Test Registration
1. Try creating a new account
2. Should complete without errors
3. Should be able to login after

---

## IF IT STILL DOESN'T WORK

**Check 1: Did all SQL statements execute?**
- Look at the output panel
- Should see green checkmarks, no red error messages
- If there are errors, copy them and search the diagnostic document

**Check 2: Are there any "relation does not exist" errors?**
- This means the SQL didn't run properly
- Try running it again from the beginning
- Make sure you copied the entire file

**Check 3: Is your browser cache stale?**
- Hard refresh: `Ctrl+F5` (or `Cmd+Shift+R` on Mac)
- Clear browser cache
- Try in incognito/private window

**Check 4: Check Supabase logs**
- Dashboard → Logs
- Look for recent errors
- Screenshot and compare to the diagnostic document

---

## WHAT CHANGED

**Before (BROKEN):**
```
New User Registration
  ↓ Trigger fires
  ↓ Tries INSERT into deleted public.users table
  ❌ FAILS → User can't login
```

**After (FIXED):**
```
New User Registration
  ↓ Trigger fires
  ↓ Inserts into public.profiles table only
  ✅ WORKS → User can login
```

**Before (BROKEN):**
```
Admin check: get_admin_status()
  ↓ SELECT FROM public.users  (table deleted!)
  ❌ FAILS → "relation public.users does not exist"
```

**After (FIXED):**
```
Admin check: get_admin_status()
  ↓ SELECT FROM public.profiles
  ✅ WORKS → Returns correct admin status
```

---

## FILES CHANGED

These files were updated in the Supabase database:

| Component | What Changed | Why |
|-----------|-------------|-----|
| Trigger: `on_auth_user_created` | Now only inserts to profiles | Deleted table no longer exists |
| RPC: `get_admin_status()` | Now queries profiles table | Deleted table no longer exists |
| RPC: `promote_user_to_admin()` | Now updates profiles table | Deleted table no longer exists |
| RPC: `is_user_admin()` | Created new function | Was missing, causing errors |
| RPC: `demote_admin_to_user()` | Created new function | Was missing, causing errors |
| RPC: `create_user_profile()` | Created new function | Was missing, causing errors |
| Table: `public.user_roles` | Created new table | Was referenced by policies |
| RLS Policy | Fixed to use profiles | Was referencing deleted table |

---

## SUCCESS INDICATORS

### You know it worked if:
- ✅ Login page loads without errors
- ✅ You can sign in successfully
- ✅ Dashboard appears after login
- ✅ No 500 errors in browser console
- ✅ No "relation does not exist" errors
- ✅ Admin panel loads (if admin user)
- ✅ User list appears (if admin user)

### You know it's still broken if:
- ❌ Login page shows 500 error
- ❌ Browser console shows "relation" errors
- ❌ Dashboard doesn't load after login
- ❌ Admin panel shows empty or error

---

## WHAT NOT TO DO

❌ Don't try to recreate the public.users table
- Code has been updated to use profiles
- Old table would conflict

❌ Don't modify the SQL fix
- It's carefully ordered for dependencies
- Changing order can break it

❌ Don't skip the verification step
- Makes sure everything actually worked
- Better to catch issues now than in production

---

## ROLLBACK (If Needed)

If something goes wrong, the fix is designed to be safe:

1. **The fix doesn't delete anything** - only adds/updates
2. **All existing data is preserved**
3. **Can safely re-run the fix multiple times**

If you need to fully rollback:
1. Contact Supabase support to restore from backup
2. Don't try to manually drop the new functions
3. Have them restore from yesterday's backup

---

## CONTACT SUPPORT

If the fix doesn't work after following all steps:

1. **Gather information:**
   - Screenshot of SQL Editor output
   - Screenshot of error message
   - Exact URL of your Supabase project
   - Which step failed

2. **Contact Supabase:**
   - Go to Dashboard → Help
   - Submit support ticket with screenshots

3. **Mention:**
   - "public.users table was deleted"
   - "Need to migrate to public.profiles"
   - "Authentication failing with 500 errors"

---

## QUICK LINK REFERENCE

- 📄 Full Diagnostic: `SUPABASE_EMERGENCY_DIAGNOSTIC.md`
- 🔧 SQL Fix Script: `SUPABASE_CRITICAL_FIXES.sql`
- 🚀 This Guide: `QUICK_FIX_LOGIN.md`

---

## TIMING

| Task | Time |
|------|------|
| Open SQL Editor | 1 min |
| Copy & Paste SQL | 1 min |
| Execute | 2 min |
| Verify | 1 min |
| **Total** | **5 minutes** |

**Your application should be back online in under 5 minutes.**

---

Version: 1.0
Created: 2026-02-16
Status: READY TO EXECUTE
