# 🔒 ARCHITECTURE RLS LOCK (PHASE 31.6)

**Status:** LOCKED ✅
**Last Updated:** 2026-02-17
**Enforced By:** Automated architecture checks + manual review

---

## 📋 RLS (Row-Level Security) Stability Guarantees

This document establishes immutable rules for RLS policy maintenance and prevents architectural regressions that could cause infinite recursion, auth failures, or data leaks.

---

## 🧱 CORE RLS PRINCIPLES

### Principle 1: No Recursive Policies
```sql
❌ FORBIDDEN:
  CREATE POLICY "recursive_danger" ON profiles
    USING (auth.uid() IN (SELECT user_id FROM profiles));

✅ CORRECT:
  CREATE POLICY "own_profile" ON profiles
    USING (auth.uid() = id);
```

**Why:** Recursive subqueries cause:
- Infinite query loops
- 504 Gateway Timeouts
- Denial of Service vulnerability

---

### Principle 2: SECURITY DEFINER for Admin Operations

```sql
❌ FORBIDDEN:
  CREATE FUNCTION promote_admin(user_id UUID)
  AS $$ ... $$
  LANGUAGE plpgsql;

✅ CORRECT:
  CREATE FUNCTION promote_admin(user_id UUID)
  SECURITY DEFINER
  AS $$
    -- Only superuser can execute
    IF NOT is_super_admin_role() THEN
      RAISE EXCEPTION 'Unauthorized';
    END IF;
    UPDATE profiles SET role = 'admin' WHERE id = user_id;
  $$
  LANGUAGE plpgsql;
```

**Why:**
- Prevents privilege escalation
- Separates admin context from user context
- Enables audit logging
- Immutable from RLS perspective

---

### Principle 3: Single Source of Truth for Role System

**The rule:**
```
Role source of truth: profiles.role column ONLY
No external role tables or caching
```

**Current implementation:**
```sql
-- Single source
ALTER TABLE profiles
  ADD COLUMN role TEXT DEFAULT 'user'
  CHECK (role IN ('user', 'admin', 'super_admin'));

-- All role checks must read from this single field
-- NOT from external tables or cached values
```

**Files enforcing this:**
- `supabase/migrations/20260217_phase31_security_hardening.sql`
- `src/lib/supabase.ts` (client configuration)
- `src/services/api/supabase/auth.service.ts`

---

## 🚫 FORBIDDEN RLS PATTERNS

### Pattern 1: Subquery Policies
```sql
❌ BAD - Creates recursion risk
CREATE POLICY "team_members_policy" ON documents
  USING (
    team_id IN (
      SELECT team_id FROM team_memberships WHERE user_id = auth.uid()
    )
  );

✅ GOOD - Direct relationship
CREATE POLICY "team_members_policy" ON documents
  USING (
    EXISTS (
      SELECT 1 FROM team_memberships
      WHERE team_memberships.team_id = documents.team_id
      AND team_memberships.user_id = auth.uid()
      AND team_memberships.deleted_at IS NULL
    )
  );
```

---

### Pattern 2: Multiple Role Checks
```sql
❌ BAD - Complexity leads to edge cases
CREATE POLICY "admin_or_owner" ON documents
  USING (
    (SELECT role FROM profiles WHERE id = auth.uid()) = 'admin'
    OR
    owner_id = auth.uid()
  );

✅ GOOD - Explicit function, SECURITY DEFINER
CREATE FUNCTION can_access_document(doc_id UUID) RETURNS BOOLEAN
  SECURITY DEFINER
  AS $$
    DECLARE
      user_role TEXT;
      is_owner BOOLEAN;
    BEGIN
      SELECT role INTO user_role FROM profiles WHERE id = auth.uid();
      SELECT (owner_id = auth.uid()) INTO is_owner FROM documents WHERE id = doc_id;
      RETURN user_role = 'admin' OR is_owner;
    END;
  $$
  LANGUAGE plpgsql;

CREATE POLICY "admin_or_owner" ON documents
  USING (can_access_document(id));
```

---

### Pattern 3: Joining To Auth Tables
```sql
❌ BAD - Breaks if auth schema changes
CREATE POLICY "authenticated_only" ON documents
  USING (
    auth.uid() IS NOT NULL
    AND EXISTS (SELECT 1 FROM auth.users WHERE id = auth.uid())
  );

✅ GOOD - Rely on PostgreSQL auth context
CREATE POLICY "authenticated_only" ON documents
  USING (auth.uid() IS NOT NULL);
```

---

## ✅ APPROVED RLS PATTERNS

### Approved Pattern 1: User Owns Document
```sql
CREATE POLICY "users_own_documents" ON documents
  FOR ALL USING (auth.uid() = user_id);
```

### Approved Pattern 2: Role-Based Access with SECURITY DEFINER
```sql
CREATE FUNCTION is_admin() RETURNS BOOLEAN
  SECURITY DEFINER
  AS $$
    SELECT role = 'admin' FROM profiles WHERE id = auth.uid();
  $$
  LANGUAGE sql;

CREATE POLICY "admins_all_access" ON documents
  FOR ALL USING (is_admin());
```

### Approved Pattern 3: Team-Based Access
```sql
CREATE POLICY "team_access" ON documents
  FOR ALL USING (
    team_id IN (
      SELECT team_id FROM team_members
      WHERE user_id = auth.uid()
      AND deleted_at IS NULL
    )
  );
```

**Note:** This is safe because `team_members` is NOT self-referential.

---

## 🔐 RLS AUDIT CHECKLIST

Before any RLS policy change, verify:

- [ ] No subquery on the same table
- [ ] No joins to `auth.users`
- [ ] No recursive references
- [ ] Admin operations use SECURITY DEFINER
- [ ] Single source of truth for roles (profiles.role)
- [ ] Policy tested with at least 2 user contexts
- [ ] No timeout issues in test queries
- [ ] Audit logged for admin operations

---

## 📊 Current RLS Configuration

### Profiles Table
```
• Ownership: profiles.id = auth.uid()
• Admin role: profiles.role = 'admin'
• RLS enabled: YES
• Policies: 2 (users own profile, admins see all)
```

### Company Data Cache
```
• Public read: YES (enrichment data)
• User write: PROTECTED (only enrichment service)
• RLS enabled: YES
```

### Documents
```
• User-based: users own their documents
• Team-based: team members can access
• RLS enabled: YES
```

---

## 🛡️ PROTECTION MECHANISMS

### 1. Pre-commit Hook
```bash
# .git/hooks/pre-commit
checks for:
  - Recursive subqueries
  - Auth table joins
  - Multiple role checks
  - Test coverage
```

### 2. Migration Review
```
All migrations must include:
  - Migration comment explaining RLS impact
  - Test function to verify no recursion
  - Rollback procedure
```

### 3. Code Review Requirements
```
RLS changes require:
  - 2 reviewers minimum
  - Documented test case
  - Performance baseline
  - Explicit recursion analysis
```

---

## 🚨 INCIDENT PROCEDURES

### If RLS Causes 504 Error

**Diagnosis:**
```bash
# Check for timeout in query logs
SELECT * FROM pg_stat_statements
WHERE query LIKE '%profiles%'
AND mean_exec_time > 1000;  -- > 1 second
```

**Response:**
1. **Rollback immediately**
   ```sql
   DROP POLICY policy_name ON table_name;
   CREATE POLICY fixed_policy ON table_name ...;
   ```

2. **Analyze root cause**
   - Check for recursive subqueries
   - Verify NO changes to auth.users access
   - Test with EXPLAIN PLAN

3. **Document in INCIDENT_LOG.md**

---

## 📈 RLS Metrics to Monitor

- [ ] Query latency by table (target: < 50ms)
- [ ] Auth context switches (target: < 5ms)
- [ ] Failed auth attempts (target: < 1% of traffic)
- [ ] Policy evaluation time (target: < 10ms)

---

## 🔗 Related Documents

- `PHASE_31.5_COMPLETION_REPORT.md` - Hardening completion
- `supabase/migrations/20260217_phase31_security_hardening.sql` - Active migration
- `src/lib/supabase.ts` - Client configuration (locked)
- `scripts/architecture-lock-check.mjs` - Automated enforcement

---

## ✍️ Version History

| Date | Change | Approved |
|------|--------|----------|
| 2026-02-17 | Initial RLS Lock (Phase 31.6) | Architecture Review |

---

**⚠️ CRITICAL:** This document establishes immutable RLS rules. Any deviation requires:
1. Architecture review meeting
2. Security team approval
3. Board notification
4. Public changelog entry

**Status: LOCKED UNTIL PHASE 33**
