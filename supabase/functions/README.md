# Company Search Edge Functions

This directory contains the Edge Functions for the intelligent company search system.

## Functions Available

### 🔄 refresh-company-cache
Automatically refreshes company data that needs updating based on TTL and usage.

**Endpoint**: `/functions/v1/refresh-company-cache`

**Usage**:
```bash
curl -X POST https://YOUR_PROJECT.supabase.co/functions/v1/refresh-company-cache \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{"maxCompanies": 50}'
```

### 🧹 cleanup-company-cache
Removes old, unused cache entries to keep the database clean.

**Endpoint**: `/functions/v1/cleanup-company-cache`

**Usage**:
```bash
curl -X POST https://YOUR_PROJECT.supabase.co/functions/v1/cleanup-company-cache \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{"dryRun": true}'
```

### 🧪 test-company-search
Comprehensive test suite for the company search system.

**Endpoint**: `/functions/v1/test-company-search`

**Usage**:
```bash
curl https://YOUR_PROJECT.supabase.co/functions/v1/test-company-search \
  -H "Authorization: Bearer YOUR_ANON_KEY"
```

**Expected result**: `"passRate": "100.00%"` (12/12 tests)

---

## Deployment

These functions are automatically deployed via GitHub Actions workflow.

**Trigger deployment**: Any push to files in `supabase/functions/` triggers automatic deployment.

**Manual deployment**:
```bash
supabase functions deploy refresh-company-cache --no-verify-jwt
supabase functions deploy cleanup-company-cache --no-verify-jwt
supabase functions deploy test-company-search --no-verify-jwt
```

---

## Required Secrets (Supabase Dashboard)

Configure in: **Settings → Edge Functions → Secrets**

- `CLAUDE_API_KEY`: For intelligent SIRET extraction
- `PAPPERS_API_KEY`: For premium company data
- `SUPABASE_URL`: Auto-configured
- `SUPABASE_SERVICE_ROLE_KEY`: Auto-configured

---

## Documentation

- **Architecture**: `docs/ARCHITECTURE_COMPANY_SEARCH.md`
- **Quick Start**: `docs/QUICKSTART_COMPANY_SEARCH.md`
- **Main README**: `docs/COMPANY_SEARCH_README.md`

---

**Last updated**: 2025-11-24
