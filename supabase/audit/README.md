# Supabase Knowledge Base Schema Audit

This directory contains tools and documentation for auditing the Supabase database schema used by the RAG knowledge ingestion system.

## Quick Start

1. **Run the audit script:**
   ```bash
   # Via Supabase Web Console:
   # 1. Open SQL Editor
   # 2. Copy contents of knowledge_schema_inspector.sql
   # 3. Run query

   # Or via psql:
   psql "postgresql://user:pass@host/db" \
     -f supabase/audit/knowledge_schema_inspector.sql
   ```

2. **Review the output** against `SCHEMA_AUDIT_GUIDE.md`

3. **Address any issues** identified in the audit

## Files in This Directory

### 1. `knowledge_schema_inspector.sql` ⭐

**Purpose:** Read-only SQL audit script that inspects the database schema

**What it checks:**
- Installed PostgreSQL extensions (especially pgvector)
- All `knowledge_*` tables
- Column definitions for knowledge_documents and knowledge_chunks
- Indexes on knowledge_chunks (including vector indexes)
- pgvector configuration and version
- **Critical:** Embedding vector dimensions (should be vector(1536))
- Table relationships and constraints
- Triggers and functions
- RLS policies

**Key features:**
- ✅ 100% READ-ONLY (no modifications)
- ✅ Safe to run on production
- ✅ Comprehensive output with 11 detailed sections
- ✅ Includes verification checklist

**Run time:** 30-60 seconds

### 2. `SCHEMA_AUDIT_GUIDE.md` 📖

**Purpose:** Comprehensive guide to understanding audit script output

**Contents:**
- How to run the script (3 different methods)
- What each output section means
- What to look for in each section
- Common issues and fixes
- Expected output template
- Verification workflow
- Safety information

**Use this when:**
- First time running the audit
- Understanding unexpected output
- Troubleshooting schema issues

### 3. `README.md`

This file - overview and navigation

## Related Documentation

### In This Repository

- **`DOCUMENT_CATEGORY_AUDIT.md`** - Audit of category field design
  - ❌ Frontend sends 18 categories
  - ❌ Database only allows 5 categories
  - 🔴 This causes upload failures!
  - ✅ Includes recommended fix

- **Migration Files:**
  - `supabase/migrations/20260216000000_phase29_knowledge_ingestion.sql` - Current schema
  - `supabase/migrations/060_knowledge_documents.sql` - Original schema

### External

- Anthropic Embeddings Docs: https://docs.anthropic.com/en/docs/guides/embeddings
- pgvector GitHub: https://github.com/pgvector/pgvector
- PostgreSQL System Catalogs: https://www.postgresql.org/docs/current/catalogs.html

## Critical Audit Findings

### 🔴 CATEGORY CONSTRAINT MISMATCH

The database schema has a constraint that only allows 5 categories:
```
'norme', 'fiche_technique', 'jurisprudence', 'manuel', 'autre'
```

But the frontend tries to send 18 categories:
```
DTU, EUROCODE, NORM, REGULATION, GUIDELINE, BEST_PRACTICE,
TECHNICAL_GUIDE, TRAINING, MANUAL, HANDBOOK, SUSTAINABILITY,
ENERGY_EFFICIENCY, LEGAL, LIABILITY, WARRANTY, CASE_STUDY,
LESSONS_LEARNED, PRICING_REFERENCE
```

**Result:** Database INSERT fails for 15 of 18 categories

**See:** `../DOCUMENT_CATEGORY_AUDIT.md` for full analysis and recommended fix

### ⚠️ EMBEDDING VECTOR DIMENSIONS

The audit script verifies that embedding vectors use `vector(1536)`:
- ✅ Required for Claude 3 Sonnet embeddings
- ⚠️ If different: Vector search will fail
- 🔴 If missing: pgvector extension not installed

## Audit Checklist

Use this checklist when running audits:

- [ ] pgvector extension installed
- [ ] knowledge_documents table exists with correct schema
- [ ] knowledge_chunks table exists with correct schema
- [ ] embedding column is vector(1536) or matches expected dimension
- [ ] Vector indexes created (HNSW preferred)
- [ ] Foreign keys configured correctly
- [ ] Triggers in place for automation
- [ ] Category constraint reviewed (see category audit)
- [ ] RLS policies configured (if needed)
- [ ] No errors or warnings in audit output

## Common Problems & Solutions

### pgvector Not Installed
```sql
CREATE EXTENSION IF NOT EXISTS vector;
```

### Embedding Wrong Dimensions
See `SCHEMA_AUDIT_GUIDE.md` Issue 2

### Vector Indexes Missing
See `SCHEMA_AUDIT_GUIDE.md` Issue 3

### Category Constraint Wrong
See `../DOCUMENT_CATEGORY_AUDIT.md` - Required migration

### Missing Triggers
See `SCHEMA_AUDIT_GUIDE.md` Issue 5

## Running Audits Regularly

**Recommended frequency:** After each migration or schema change

**Automated approach:**
```bash
#!/bin/bash
# run_audit.sh
DATE=$(date +%Y%m%d_%H%M%S)
OUTPUT_FILE="audit_results_${DATE}.txt"

psql "$DATABASE_URL" \
  -f supabase/audit/knowledge_schema_inspector.sql \
  > "audit_results/${OUTPUT_FILE}"

echo "Audit saved to: audit_results/${OUTPUT_FILE}"
```

## Integration with CI/CD

To verify schema in CI/CD pipelines:

```yaml
# .github/workflows/schema-audit.yml
name: Database Schema Audit
on: [push, pull_request]

jobs:
  audit:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Run Schema Audit
        env:
          DATABASE_URL: ${{ secrets.DATABASE_URL }}
        run: |
          psql "$DATABASE_URL" \
            -f supabase/audit/knowledge_schema_inspector.sql \
            > audit_output.txt
      - name: Archive Audit
        uses: actions/upload-artifact@v3
        with:
          name: schema-audit-${{ github.run_id }}
          path: audit_output.txt
```

## Troubleshooting

### "ERROR: permission denied"
- Need superuser or service_role for extension queries
- In Supabase: Use Service Role key in connection

### "ERROR: extension "vector" does not exist"
- pgvector not installed
- Run: `CREATE EXTENSION vector;`

### Script Times Out
- Large dataset (millions of rows)
- Indexes not yet built
- Try running during off-peak hours

### Unexpected Output Format
- PostgreSQL version differences
- psql output formatting
- Check `psql --version`

## Support

For issues:
1. Check `SCHEMA_AUDIT_GUIDE.md` for troubleshooting
2. Review `DOCUMENT_CATEGORY_AUDIT.md` for category issues
3. Compare with expected schema in migrations
4. Check Supabase dashboard for error logs

## Version Info

- **Created:** 2026-03-09
- **Schema Version:** PHASE 29 (Knowledge Ingestion)
- **pgvector Compatibility:** 0.4.0+
- **PostgreSQL Compatibility:** 12+
- **Supabase Compatible:** Yes

## Security Note

This audit script is completely read-only and safe to run:
- ✅ No CREATE statements
- ✅ No ALTER statements
- ✅ No DELETE statements
- ✅ Only SELECT queries
- ✅ Safe on production databases
- ✅ Can be run unlimited times

## Next Steps

1. Run `knowledge_schema_inspector.sql` on your Supabase instance
2. Compare output to `SCHEMA_AUDIT_GUIDE.md`
3. Address any issues found:
   - **Category issue?** → See `DOCUMENT_CATEGORY_AUDIT.md`
   - **pgvector issue?** → Run CREATE EXTENSION
   - **Embedding dims?** → Check vector(1536) configured
   - **Indexes?** → Create vector indexes
4. Re-run audit to verify fixes
5. Archive audit results for compliance

---

**Last Updated:** 2026-03-09
**Maintained by:** Development Team
**Related Issues:** [Category Constraint Mismatch, Vector Search Setup]
