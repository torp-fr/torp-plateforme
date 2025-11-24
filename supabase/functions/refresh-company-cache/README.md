# Refresh Company Cache Function

Automatically refreshes company data that needs updating based on the intelligent caching strategy.

## Usage

### Manual Trigger

```bash
curl -X POST https://your-project.supabase.co/functions/v1/refresh-company-cache \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "maxCompanies": 50,
    "forceAll": false
  }'
```

### Request Parameters

```typescript
{
  maxCompanies?: number;  // Max number to refresh per run (default: 50)
  forceAll?: boolean;     // Force refresh all companies (default: false)
  sirets?: string[];      // Specific SIRETs to refresh
}
```

### Response

```typescript
{
  success: boolean;
  refreshed: number;      // Number of companies successfully refreshed
  failed: number;         // Number of failed refreshes
  skipped: number;        // Number of companies skipped
  errors: string[];       // Error messages
  details: [{
    siret: string;
    status: 'refreshed' | 'failed' | 'skipped';
    error?: string;
  }]
}
```

## Cron Job Setup

### Using GitHub Actions

Create `.github/workflows/refresh-company-cache.yml`:

```yaml
name: Refresh Company Cache

on:
  schedule:
    # Run daily at 2 AM UTC
    - cron: '0 2 * * *'
  workflow_dispatch:  # Allow manual trigger

jobs:
  refresh:
    runs-on: ubuntu-latest
    steps:
      - name: Refresh Company Cache
        run: |
          curl -X POST ${{ secrets.SUPABASE_URL }}/functions/v1/refresh-company-cache \
            -H "Authorization: Bearer ${{ secrets.SUPABASE_SERVICE_KEY }}" \
            -H "Content-Type: application/json" \
            -d '{"maxCompanies": 100}'
```

### Using pg_cron (Supabase)

If you have pg_cron extension enabled:

```sql
-- Run daily at 2 AM UTC
SELECT cron.schedule(
  'refresh-company-cache',
  '0 2 * * *',
  $$
  SELECT
    net.http_post(
      url := 'https://your-project.supabase.co/functions/v1/refresh-company-cache',
      headers := '{"Content-Type": "application/json", "Authorization": "Bearer ' || current_setting('app.settings.service_key') || '"}'::jsonb,
      body := '{"maxCompanies": 100}'::jsonb
    ) as request_id;
  $$
);
```

### Using External Cron (e.g., cron-job.org)

1. Go to https://cron-job.org
2. Create new job
3. Set URL: `https://your-project.supabase.co/functions/v1/refresh-company-cache`
4. Set schedule: Daily at 2 AM
5. Add header: `Authorization: Bearer YOUR_SERVICE_KEY`
6. Set body: `{"maxCompanies": 100}`

## Refresh Strategy

The function automatically prioritizes companies for refresh:

1. **Expired companies** (`refresh_strategy = 'expired'`)
2. **Scheduled refresh** (`next_refresh_at < now()`)
3. **High-traffic old data** (`fetch_count > 10` AND `age > 30 days`)

## Recommendations

- **Daily refresh**: Run with `maxCompanies: 50-100` to keep active companies fresh
- **Weekly full refresh**: Run with `forceAll: true, maxCompanies: 500` for comprehensive update
- **Monitor errors**: Check the `errors` array in responses
- **Rate limiting**: Built-in 200ms delay between API calls

## Environment Variables Required

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `PAPPERS_API_KEY` (optional, for premium data)
