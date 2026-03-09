# Knowledge Schema Audit Script Guide

## Overview

The `knowledge_schema_inspector.sql` script provides a comprehensive read-only audit of the Supabase knowledge base schema. It helps verify that:

1. **pgvector is installed** and configured correctly
2. **Embedding vectors** use the correct dimensions (vector(1536))
3. **Table schemas** match the expected structure
4. **Indexes** are properly configured for vector search
5. **Constraints** are correctly defined (especially category constraint)

## Running the Script

### Option 1: Via Supabase Web Console

1. Go to **Supabase Dashboard** → **SQL Editor**
2. Create new query
3. Copy entire content of `knowledge_schema_inspector.sql`
4. Click **Run** (executes all sections)
5. Review output in sections

### Option 2: Via psql Command Line

```bash
# Connect to Supabase database
psql "postgresql://[user]:[password]@[host]:5432/[database]?sslmode=require" \
  -f supabase/audit/knowledge_schema_inspector.sql

# Or pipe output to file
psql "postgresql://..." \
  -f supabase/audit/knowledge_schema_inspector.sql > audit_results.txt
```

### Option 3: Via Supabase CLI

```bash
supabase db pull  # Sync schema locally
supabase start    # Start local development
# Then run script via psql on local instance
```

## Output Sections

### Section 1: Installed Extensions

Shows all PostgreSQL extensions, with focus on `vector` (pgvector).

**What to look for:**
```
✓ EXPECTED: vector extension listed with version >= 0.4.0
✗ PROBLEM: No vector extension (pgvector not installed)
```

**Example:**
```
 extname |      extversion      | schema |     description
---------+----------------------+--------+-------------------
 plpgsql | 1.0                  | public | ...
 uuid    | 1.1                  | public | ...
 vector  | 0.5.0                | public | pg Vector type
```

### Section 2: Knowledge Base Tables

Lists all `knowledge_*` tables with their sizes.

**What to look for:**
```
✓ EXPECTED:
  - knowledge_documents (table)
  - knowledge_chunks (table)

✗ PROBLEM:
  - Missing either table
  - Unexpected table count
```

### Section 3: knowledge_documents Schema

Shows all columns in `knowledge_documents` table.

**What to look for:**
```
✓ EXPECTED columns:
  - id (UUID)
  - title (VARCHAR/TEXT)
  - category (VARCHAR) - with CHECK constraint
  - source (VARCHAR)
  - version (VARCHAR)
  - file_size (INTEGER)
  - chunk_count (INTEGER)
  - created_by (UUID) - FK to auth.users
  - created_at (TIMESTAMP)
  - updated_at (TIMESTAMP)

⚠ Check the category column constraint carefully!
```

**Category Constraint Issue:**
The script will show this CHECK constraint:

```sql
CHECK (category IN (
  'norme', 'fiche_technique', 'jurisprudence', 'manuel', 'autre'
))
```

**This is the critical finding from the audit:**
- ❌ Only 5 categories allowed in database
- ❌ But frontend sends 18 different categories
- 🔴 This causes upload failures!

### Section 4: knowledge_chunks Schema

Shows detailed schema of knowledge chunks with embedding column details.

**What to look for:**
```
✓ EXPECTED:
  - id (UUID)
  - document_id (UUID) - FK to knowledge_documents
  - content (TEXT)
  - chunk_index (INTEGER)
  - token_count (INTEGER)
  - embedding (vector type)
  - created_at (TIMESTAMP)
  - updated_at (TIMESTAMP)

⚠ CRITICAL: Verify embedding column type!
```

### Section 5: Indexes on knowledge_chunks

Lists all indexes including vector indexes.

**What to look for:**
```
✓ EXPECTED index on document_id:
  idx_knowledge_chunks_document_id

✓ OPTIONAL vector search indexes:
  idx_knowledge_chunks_embedding_hnsw  (for HNSW algorithm)
  OR
  idx_knowledge_chunks_embedding_flat  (for IVFFlat algorithm)

⚠ Vector indexes needed for semantic search performance
```

**Example index definition:**
```sql
CREATE INDEX idx_knowledge_chunks_embedding_hnsw
  ON knowledge_chunks
  USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 200);
```

### Section 6: pgvector Configuration

Shows pgvector version and compatibility.

**What to look for:**
```
✓ EXPECTED:
  - pgvector version >= 0.4.0
  - Functions like: vector_avg, vector_dims, etc.

✗ PROBLEM:
  - pgvector not installed
  - Old version without HNSW support
```

### Section 7: Embedding Vector Dimensions

**CRITICAL VERIFICATION SECTION**

Shows the actual embedding column type and verifies dimensions.

**What to look for:**
```
✓ EXPECTED:
  format_type = 'vector(1536)'
  Status: ✓ CORRECT (vector(1536))

⚠ PROBLEMS:
  - vector(384): Wrong dimension (incompatible with Claude embeddings)
  - vector(768): Wrong dimension
  - vector (no dimension): Misconfigured
  - Not a vector type: Serious schema problem
```

**Why 1536 dimensions?**
- Claude 3 Sonnet embeddings use 1536 dimensions
- Reference: https://docs.anthropic.com/en/docs/guides/embeddings
- Must match or semantic search will fail

### Section 8: Table Relationships

Shows foreign key relationships between knowledge tables.

**What to look for:**
```
✓ EXPECTED:
  - knowledge_chunks.document_id → knowledge_documents.id
  - DELETE CASCADE (cleanup when document deleted)
```

### Section 9: Triggers and Functions

Shows automated triggers (e.g., updating timestamps).

**What to look for:**
```
✓ EXPECTED triggers:
  - knowledge_documents_updated_at (updates updated_at on changes)
  - knowledge_chunks_updated_at (updates updated_at on changes)
  - knowledge_chunks_count_update (updates chunk_count)

⚠ Missing triggers may cause data inconsistency
```

### Section 10: RLS Policies

Shows row-level security configuration (if enabled).

**What to look for:**
```
✓ If RLS is enabled (rowsecurity = t):
  - Verify policies allow appropriate access
  - Check auth.uid() filters

⚠ If RLS is disabled (rowsecurity = f):
  - May be intentional for service role access
  - Verify intentional in security design
```

### Section 11: Audit Summary

Quick summary of critical items.

**What to look for:**
```
✓ All items should show status
- pgvector: INSTALLED
- Tables: 2 (knowledge_documents, knowledge_chunks)
- knowledge_documents: EXISTS
- knowledge_chunks: EXISTS
- Embedding: vector(1536) or similar
```

## Common Issues & Fixes

### Issue 1: pgvector Not Installed

**Symptom:**
```
pgvector_status | MISSING
```

**Cause:** Vector extension not enabled on Supabase project

**Fix:**
```sql
-- Run as superuser/service role
CREATE EXTENSION IF NOT EXISTS vector;
```

### Issue 2: Wrong Embedding Dimensions

**Symptom:**
```
current_type | vector(384)
dimension_status | ⚠ vector(384) - different dimension
```

**Cause:** Embeddings created with wrong model/dimensions

**Fix:** Requires data migration (complex - consult team)

### Issue 3: Missing Vector Indexes

**Symptom:**
No HNSW or IVFFlat indexes shown in Section 5

**Cause:** Indexes not created for performance

**Fix:**
```sql
-- Create HNSW index for fast vector search
CREATE INDEX idx_knowledge_chunks_embedding_hnsw
  ON knowledge_chunks
  USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 200);
```

### Issue 4: Category Constraint Mismatch

**Symptom:**
```
constraint_definition | CHECK (category IN ('norme', 'fiche_technique', 'jurisprudence', 'manuel', 'autre'))
```

**Cause:** Database only allows 5 categories but frontend sends 18

**Fix:** Update migration to include all 18 categories (see DOCUMENT_CATEGORY_AUDIT.md)

### Issue 5: Missing Triggers

**Symptom:**
No triggers shown in Section 9

**Cause:** Triggers not created in schema

**Fix:**
```sql
-- Create timestamp update trigger
CREATE OR REPLACE FUNCTION update_knowledge_documents_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER knowledge_documents_updated_at
  BEFORE UPDATE ON knowledge_documents
  FOR EACH ROW
  EXECUTE FUNCTION update_knowledge_documents_timestamp();
```

## Expected Output Template

Here's what a healthy knowledge schema should show:

```
SECTION 1: INSTALLED EXTENSIONS
✓ vector extension installed (version >= 0.4.0)

SECTION 2: KNOWLEDGE BASE TABLES
✓ knowledge_documents exists
✓ knowledge_chunks exists
✓ Both tables have reasonable sizes

SECTION 3: KNOWLEDGE_DOCUMENTS SCHEMA
✓ All expected columns present
✓ category column has CHECK constraint
✓ created_by references auth.users
✓ Proper data types for all columns

SECTION 4: KNOWLEDGE_CHUNKS SCHEMA
✓ All expected columns present
✓ embedding column exists
✓ Proper data types and constraints

SECTION 5: INDEXES
✓ idx_knowledge_chunks_document_id exists
✓ Full-text search index exists
✓ Vector index exists (HNSW or IVFFlat)

SECTION 6: PGVECTOR CONFIGURATION
✓ pgvector >= 0.4.0 installed
✓ Vector functions available

SECTION 7: EMBEDDING VECTOR DIMENSIONS
✓ embedding column is vector(1536)

SECTION 8-10: RELATIONSHIPS, TRIGGERS, RLS
✓ Foreign keys configured correctly
✓ Triggers in place for automation
✓ RLS policies (if enabled) properly configured
```

## Script Safety

**Important:** This script is 100% READ-ONLY

- ✅ Uses only SELECT queries
- ✅ No INSERT, UPDATE, DELETE, ALTER, CREATE, DROP
- ✅ Safe to run multiple times
- ✅ Safe to run on production
- ✅ No data modification
- ✅ No schema changes

## Verification Workflow

1. **Run the script** → capture output
2. **Review Section 1** → pgvector installed?
3. **Review Section 3** → category constraint correct?
4. **Review Section 4** → embedding vector(1536)?
5. **Review Section 5** → indexes present?
6. **Review Section 7** → embedding dimensions confirmed?
7. **Compare to expected schema** → any differences?
8. **Note any issues** → create migration if needed

## Output Files

Save script output for documentation:

```bash
# Save to file for archival
supabase db pull
psql -c "\i supabase/audit/knowledge_schema_inspector.sql" > audit_results_$(date +%Y%m%d).txt

# Compare between runs
diff audit_results_20260309.txt audit_results_20260310.txt
```

## Related Documentation

- **Category Audit:** `DOCUMENT_CATEGORY_AUDIT.md`
- **Schema Migrations:** `supabase/migrations/20260216000000_phase29_knowledge_ingestion.sql`
- **Anthropic Embeddings:** https://docs.anthropic.com/en/docs/guides/embeddings
- **pgvector Documentation:** https://github.com/pgvector/pgvector

## Next Steps

After running the audit:

1. ✅ **If all checks pass:** Schema is healthy, proceed with ingestion
2. ⚠️ **If pgvector missing:** Install with `CREATE EXTENSION vector`
3. ⚠️ **If wrong embedding dims:** Requires data migration
4. 🔴 **If category constraint wrong:** See DOCUMENT_CATEGORY_AUDIT.md
5. ⚠️ **If indexes missing:** Create vector indexes for performance

## Questions?

If audit reveals unexpected results:

1. Check Supabase dashboard for migration status
2. Review recent migrations in `supabase/migrations/`
3. Compare current schema with expected schema
4. Check PostgreSQL version compatibility
5. Review audit logs in Supabase console
