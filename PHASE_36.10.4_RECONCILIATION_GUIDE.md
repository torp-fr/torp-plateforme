# PHASE 36.10.4 — Integrity & RPC Reconciliation Migration

**Status**: Recovery/Reconciliation Mode
**Date**: 2026-02-18
**Priority**: CRITICAL (Production Database Recovery)
**Safety Level**: SAFE & IDEMPOTENT

## 📋 Overview

This migration recovers a production database that is partially migrated:
- ✅ Base schema exists (constraints, columns, indexes from Phase 36.10.1)
- ❌ BUT critical RPC functions are **MISSING**
- ❌ AND secure views are **MISSING**
- ❌ AND audit tables are **MISSING**

**Migration 073** safely reconciles these missing components WITHOUT:
- ❌ Recreating existing constraints
- ❌ Modifying existing columns
- ❌ Causing any downtime
- ❌ Requiring data migration

## 🎯 What Gets Created

### Functions (6 total)

| Function | Purpose | Status |
|----------|---------|--------|
| `verify_embedding_integrity()` | Verify all chunks have embeddings | Application Layer |
| `audit_system_integrity()` | Find all broken documents | Admin Audit |
| `search_knowledge_by_embedding()` | Vector semantic search (1536-dim) | Critical RPC |
| `search_knowledge_by_keyword()` | Full-text keyword search | Critical RPC |
| `is_document_retrieval_safe()` | Guard function (runtime check) | Safety Layer |
| `log_ingestion_state_transition()` | Auto-log state changes (trigger fn) | Audit Trail |

### Tables (2 total)

| Table | Purpose | Columns |
|-------|---------|---------|
| `knowledge_ingestion_audit_log` | Ingestion state transitions | document_id, old_status, new_status, timestamp |
| `knowledge_retrieval_audit_log` | Retrieval attempt logging | attempted_document_id, document_state, error_type, timestamp |

### Views (2 total)

| View | Filters | Purpose |
|------|---------|---------|
| `knowledge_documents_ready` | status='complete' AND integrity_checked=TRUE AND active=TRUE | Safe document list |
| `knowledge_chunks_ready` | Inner join on documents_ready + embedding NOT NULL | Safe chunk retrieval |

### Trigger (1 total)

| Trigger | Event | Action |
|---------|-------|--------|
| `trigger_ingestion_state_transition` | UPDATE on knowledge_documents | Auto-log state changes |

### Indexes (5 total)

| Index | Table | Purpose |
|-------|-------|---------|
| `idx_audit_log_document_id` | knowledge_ingestion_audit_log | Fast document lookup |
| `idx_audit_log_created_at` | knowledge_ingestion_audit_log | Time-range queries |
| `idx_retrieval_audit_created_at` | knowledge_retrieval_audit_log | Time-range queries |
| `idx_documents_ready_composite` | knowledge_documents | Fast ready-doc filtering |
| `idx_chunks_ready_composite` | knowledge_chunks | Fast ready-chunk filtering |

## 🔒 Safety Guarantees

### Idempotency
✅ All operations use `CREATE OR REPLACE` or `IF NOT EXISTS`
✅ Safe to run multiple times without failure
✅ No destructive operations

### Production Safety
✅ No locks on application tables
✅ No data modification
✅ No column type changes
✅ Can be applied during business hours

### Data Integrity
✅ All functions use STABLE keyword (deterministic)
✅ Views are read-only projections
✅ RLS policies restrict audit access to admins
✅ Trigger only logs state transitions (no side effects)

## 📊 Component Status Mapping

### From Previous Phases

**Phase 36.10.1** created:
- Constraints: `valid_ingestion_status`, `complete_requires_integrity_check`, `progress_range` ✅
- Columns: `ingestion_status`, `ingestion_progress`, `ingestion_started_at`, etc. ✅
- Indexes: Various state tracking indexes ✅
- **Missing**: `verify_embedding_integrity()`, `audit_system_integrity()`

**Phase 36.10.2** designed:
- Views: `knowledge_documents_ready`, `knowledge_chunks_ready`
- RPCs: `search_knowledge_by_embedding()`, `search_knowledge_by_keyword()`
- Guard: `is_document_retrieval_safe()`
- Audit: `knowledge_retrieval_audit_log`
- **Status**: All missing from production DB

**Phase 36.10.3** ensured:
- Vector dimension upgraded to 1536 ✅
- `embedding_generated_at` column added ✅
- `region` column added ✅
- **NOTE**: This migration may not have been fully applied

### This Migration (073) Provides
✅ All Phase 36.10.1 missing functions
✅ All Phase 36.10.2 views and RPCs
✅ All audit infrastructure
✅ Complete retrieval safety layer

## 🚀 Deployment Steps

### Step 1: Pre-Migration Validation
```sql
-- Check what functions are MISSING
SELECT routine_name FROM information_schema.routines
WHERE routine_schema = 'public'
  AND routine_name IN (
    'verify_embedding_integrity',
    'audit_system_integrity',
    'search_knowledge_by_embedding',
    'search_knowledge_by_keyword'
  );
-- Expected: 0 rows if all are missing
```

### Step 2: Apply Migration
```bash
# Via Supabase CLI
supabase migration up

# Or manually in psql/Supabase console:
# 1. Open SQL editor
# 2. Copy content of: 073_phase36_10_4_integrity_reconciliation.sql
# 3. Execute in target database
```

### Step 3: Post-Migration Verification
```sql
-- Run the comprehensive verification queries
-- File: PHASE_36.10.4_VERIFICATION_QUERIES.sql

-- Or quick check:
SELECT 'verify_embedding_integrity' as fn,
  EXISTS (SELECT 1 FROM information_schema.routines
    WHERE routine_name = 'verify_embedding_integrity') as exists;
-- Expected: true
```

### Step 4: Application Deployment
```bash
# After migration is confirmed:
# 1. Deploy updated TypeScript service code
# 2. Services now use RPC functions instead of direct SQL
# 3. All retrieval automatically safety-checked
# 4. Audit logs automatically populated
```

## 🔍 Verification Commands

### Check All Components
```sql
-- Copy content of PHASE_36.10.4_VERIFICATION_QUERIES.sql
-- Run in database
-- All components should return 'true' or 'PASS'
```

### Quick Component Check
```sql
-- Functions
SELECT COUNT(*) FROM information_schema.routines
WHERE routine_schema = 'public'
  AND routine_name IN (
    'verify_embedding_integrity',
    'audit_system_integrity',
    'search_knowledge_by_embedding',
    'search_knowledge_by_keyword',
    'is_document_retrieval_safe',
    'log_ingestion_state_transition'
  );
-- Expected: 6

-- Views
SELECT COUNT(*) FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_type = 'VIEW'
  AND table_name IN ('knowledge_documents_ready', 'knowledge_chunks_ready');
-- Expected: 2

-- Tables
SELECT COUNT(*) FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_type = 'BASE TABLE'
  AND table_name IN (
    'knowledge_ingestion_audit_log',
    'knowledge_retrieval_audit_log'
  );
-- Expected: 2
```

### Test Function Calls
```sql
-- Test audit function
SELECT * FROM audit_system_integrity() LIMIT 5;
-- Should return 0+ rows with no errors

-- Test embedding integrity check (if documents exist)
SELECT * FROM verify_embedding_integrity('some-uuid-here');
-- Should return integrity report

-- Test vector search (with sample embedding)
SELECT * FROM search_knowledge_by_embedding(
  '[0.1, 0.2, 0.3, ...]'::vector(1536),
  0.5,
  5
);
-- Should return 0+ matching chunks

-- Test keyword search
SELECT * FROM search_knowledge_by_keyword('search term', 5);
-- Should return 0+ matching chunks

-- Test retrieval safety guard
SELECT is_document_retrieval_safe('some-uuid-here');
-- Should return true/false
```

### Monitor Audit Logs
```sql
-- Check ingestion transitions
SELECT document_id, old_status, new_status, created_at
FROM knowledge_ingestion_audit_log
ORDER BY created_at DESC
LIMIT 10;

-- Check retrieval attempts
SELECT attempted_document_id, error_type, created_at
FROM knowledge_retrieval_audit_log
ORDER BY created_at DESC
LIMIT 10;
```

## ⚠️ Known Limitations

### Vector Dimension
- Functions expect 1536-dimensional vectors (OpenAI standard)
- If embedding dimension is still 384, Migration 072 must be applied first
- Vector search will fail with dimension mismatch error

### French Locale Dependency
- Keyword search uses `to_tsvector('french', ...)`
- PostgreSQL must have French locale available
- If not available, install via: `CREATE TEXT SEARCH CONFIGURATION french (...)`

### Performance Considerations
- Vector search uses L2 distance by default (`<=>` operator)
- For very large knowledge bases (100k+ chunks), consider HNSW index
- Keyword search uses full-table scan on first run (gets cached)

## 🔄 Rollback Procedure

If issues occur, this migration can be safely rolled back:

```sql
-- Drop functions (CREATE OR REPLACE can be removed)
DROP FUNCTION IF EXISTS verify_embedding_integrity(uuid);
DROP FUNCTION IF EXISTS audit_system_integrity();
DROP FUNCTION IF EXISTS search_knowledge_by_embedding(vector(1536), float, int);
DROP FUNCTION IF EXISTS search_knowledge_by_keyword(text, int, text);
DROP FUNCTION IF EXISTS is_document_retrieval_safe(uuid);
DROP FUNCTION IF EXISTS log_ingestion_state_transition();

-- Drop views (will cascade)
DROP VIEW IF EXISTS knowledge_chunks_ready CASCADE;
DROP VIEW IF EXISTS knowledge_documents_ready CASCADE;

-- Drop trigger
DROP TRIGGER IF EXISTS trigger_ingestion_state_transition ON knowledge_documents;

-- Drop audit tables (optional - safe to keep for historical data)
DROP TABLE IF EXISTS knowledge_retrieval_audit_log;
DROP TABLE IF EXISTS knowledge_ingestion_audit_log;

-- Drop indexes
DROP INDEX IF EXISTS idx_audit_log_document_id;
DROP INDEX IF EXISTS idx_audit_log_created_at;
DROP INDEX IF EXISTS idx_retrieval_audit_created_at;
DROP INDEX IF EXISTS idx_documents_ready_composite;
DROP INDEX IF EXISTS idx_chunks_ready_composite;
```

## 📝 Migration Code Structure

The migration is organized into 13 sections:

1. **Safety Check** - Pre-migration diagnostics
2. **Audit Table Creation** - knowledge_ingestion_audit_log
3. **Retrieval Audit Table** - knowledge_retrieval_audit_log
4. **verify_embedding_integrity()** - Embed integrity function
5. **audit_system_integrity()** - System audit function
6. **log_ingestion_state_transition()** - Trigger function
7. **is_document_retrieval_safe()** - Guard function
8. **search_knowledge_by_embedding()** - Vector RPC
9. **search_knowledge_by_keyword()** - Keyword RPC
10. **knowledge_documents_ready view** - Safe docs view
11. **knowledge_chunks_ready view** - Safe chunks view
12. **Trigger Creation** - State transition logging
13. **RLS Policies** - Audit access control

## 🎓 How It Works

### Retrieval Safety Flow
```
User Request
    ↓
search_knowledge_by_embedding() RPC
    ↓
Inner Join: knowledge_chunks_ready
    ↓
Inner Join: knowledge_documents_ready
    ↓
Filter: embedding_similarity > threshold
    ↓
Return: ONLY complete, verified docs
```

### Integrity Audit Flow
```
User Updates Document Status
    ↓
trigger_ingestion_state_transition fires
    ↓
log_ingestion_state_transition() executes
    ↓
Entry logged to knowledge_ingestion_audit_log
    ↓
Admin can query audit_system_integrity()
    ↓
Get all documents with violations
```

## ✅ Post-Deployment Checklist

- [ ] Migration 073 applied successfully
- [ ] All 6 functions exist (verify with verification queries)
- [ ] Both views exist and return data
- [ ] Both audit tables exist
- [ ] Trigger is active
- [ ] RLS policies applied
- [ ] Application code uses RPC functions
- [ ] Vector search tested with sample embedding
- [ ] Keyword search tested
- [ ] Retrieval guard function tested
- [ ] Audit logs are populating
- [ ] No errors in application logs
- [ ] Phase 37 approved for deployment

## 📞 Troubleshooting

### "Function does not exist" errors
**Cause**: Migration didn't apply properly
**Fix**: Run verification queries to confirm, re-apply migration if needed

### "Vector dimension mismatch" errors
**Cause**: Embeddings are 384-dim but functions expect 1536-dim
**Fix**: Apply Migration 072 first to upgrade vector dimension

### "Cannot retrieve any documents"
**Cause**: No documents in 'complete' state with integrity checked
**Fix**: This is expected for new databases; ingest test documents

### "Audit logs not populating"
**Cause**: Trigger not firing (syntax error in function)
**Fix**: Check `log_ingestion_state_transition()` syntax, recreate if needed

### "RLS policy error on audit queries"
**Cause**: User not admin, trying to access audit logs
**Fix**: Confirm user has admin role in profiles table

## 🔗 Related Migrations

- **Phase 36.10.1** (Migration 069): State machine & integrity tracking
- **Phase 36.10.2** (Migration 071): Retrieval hardlock (original design)
- **Phase 36.10.3** (Migration 072): Vector standardization
- **Phase 36.10.4** (Migration 073): **← You are here**

## 📌 Important Notes

✅ **This migration is re-runnable** - Apply multiple times safely
✅ **Zero data loss** - Only creates new components
✅ **Production-safe** - Can apply during business hours
✅ **Backward compatible** - Existing code keeps working
❌ **NOT reversible in place** - Only rollback via manual SQL

---

**Generated**: 2026-02-18
**For**: TORP Platform Phase 36.10.4 Recovery
**By**: Claude Code AI Assistant
