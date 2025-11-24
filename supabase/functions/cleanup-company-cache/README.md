# Cleanup Company Cache Function

Removes old, unused cache entries to keep the database clean and performant.

## Usage

### Manual Trigger

```bash
# Dry run (preview what would be deleted)
curl -X POST https://your-project.supabase.co/functions/v1/cleanup-company-cache \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "dryRun": true
  }'

# Actual cleanup
curl -X POST https://your-project.supabase.co/functions/v1/cleanup-company-cache \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "dryRun": false
  }'
```

### Request Parameters

```typescript
{
  dryRun?: boolean;   // Preview without deleting (default: false)
  maxAge?: number;    // Max age in days (default: 365)
}
```

### Response

```typescript
{
  success: boolean;
  deleted: number;
  dryRun: boolean;
  criteria: {
    neverUsedOlderThan: 180;     // days
    rarelyUsedOlderThan: 365;    // days
  };
  deletedEntries: [{
    siret: string;
    companyName: string;
    age: number;              // in days
    fetchCount: number;
    reason: string;
  }];
  error?: string;
}
```

## Cleanup Criteria

The function removes cache entries that meet these conditions:

1. **Never used**: `fetch_count = 0` AND `age > 180 days`
2. **Rarely used**: `fetch_count < 5` AND `age > 365 days`

## Cron Job Setup

### Using GitHub Actions

Create `.github/workflows/cleanup-company-cache.yml`:

```yaml
name: Cleanup Company Cache

on:
  schedule:
    # Run weekly on Sunday at 3 AM UTC
    - cron: '0 3 * * 0'
  workflow_dispatch:

jobs:
  cleanup:
    runs-on: ubuntu-latest
    steps:
      - name: Cleanup Company Cache
        run: |
          curl -X POST ${{ secrets.SUPABASE_URL }}/functions/v1/cleanup-company-cache \
            -H "Authorization: Bearer ${{ secrets.SUPABASE_SERVICE_KEY }}" \
            -H "Content-Type: application/json" \
            -d '{"dryRun": false}'
```

### Using pg_cron (Supabase)

```sql
-- Run weekly on Sunday at 3 AM UTC
SELECT cron.schedule(
  'cleanup-company-cache',
  '0 3 * * 0',
  $$
  SELECT
    net.http_post(
      url := 'https://your-project.supabase.co/functions/v1/cleanup-company-cache',
      headers := '{"Content-Type": "application/json", "Authorization": "Bearer ' || current_setting('app.settings.service_key') || '"}'::jsonb,
      body := '{"dryRun": false}'::jsonb
    ) as request_id;
  $$
);
```

## Recommendations

- **Weekly cleanup**: Run every Sunday to keep the cache lean
- **Always dry run first**: Test with `dryRun: true` before actual cleanup
- **Monitor deletions**: Check `deletedEntries` to understand what's being removed
- **Adjust criteria**: Modify the PostgreSQL function if cleanup is too aggressive or lenient

## Safety Features

- **Dry run mode**: Preview deletions without committing
- **Conservative criteria**: Only removes truly stale data
- **Detailed logging**: Shows exactly what was deleted and why
- **Preserves active data**: Never deletes frequently accessed companies

## Direct PostgreSQL Function

You can also call the cleanup function directly in SQL:

```sql
-- Run cleanup
SELECT clean_expired_company_cache();

-- Returns: number of deleted entries
```

## Monitoring

After running cleanup, check:

1. **Number of deletions**: Should be reasonable (< 10% of total cache)
2. **Deletion reasons**: Ensure they make sense
3. **Cache hit rate**: Should not drop significantly after cleanup

```sql
-- Check cache statistics
SELECT
  COUNT(*) as total_entries,
  AVG(fetch_count) as avg_fetch_count,
  AVG(EXTRACT(EPOCH FROM (NOW() - last_fetched_at)) / 86400) as avg_age_days,
  COUNT(*) FILTER (WHERE fetch_count = 0) as never_used
FROM company_data_cache;
```
