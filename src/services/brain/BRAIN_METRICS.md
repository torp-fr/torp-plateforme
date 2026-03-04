# Brain Metrics Layer

Read-only analytics layer for RAG (Knowledge Brain) engine monitoring.

## Overview

The Brain Metrics Layer provides comprehensive metrics for monitoring the health and performance of the RAG (Retrieval-Augmented Generation) engine without impacting the ingestion pipeline or modifying any existing data.

### Key Features

- **Read-Only**: All operations are SELECT-only, no data mutations
- **Zero Impact**: No triggers, no side effects, no impact on existing pipelines
- **Real-Time**: Views provide current snapshot of metrics
- **Comprehensive**: Covers health, embeddings, and performance metrics

## Views

### 1. `brain_health_metrics`

Overall brain health snapshot with document counts, statuses, and quality scores.

**Metrics:**
- Total documents
- Publishable vs non-publishable split
- Ingestion status breakdown (pending, processing, complete, failed, chunking, embedding)
- Average, min, and max integrity scores
- Documents with errors
- Total and average chunks per document

**Usage:**
```typescript
const metrics = await brainMetricsService.getBrainHealthMetrics();
console.log(`Total documents: ${metrics.total_documents}`);
console.log(`Publishable: ${metrics.publishable_documents}`);
console.log(`Average integrity: ${metrics.avg_integrity_score}`);
```

### 2. `brain_embedding_metrics`

Embedding coverage and distribution metrics.

**Metrics:**
- Total chunks
- Chunks with/without embeddings
- Embedding coverage percentage
- Unique document categories
- Average token count per chunk
- Category-based breakdown (JSON)

**Usage:**
```typescript
const metrics = await brainMetricsService.getBrainEmbeddingMetrics();
console.log(`Coverage: ${metrics.embedding_coverage_percent}%`);
console.log(`Category breakdown:`, metrics.category_breakdown);
```

### 3. `brain_global_health`

Comprehensive health status including composite health score and RPC performance.

**Metrics:**
- Overall health score (0-100 composite)
- System status (HEALTHY, DEGRADED, CRITICAL)
- Document metrics (total, publishable percentage)
- Search performance (last 24h)
  - Total searches
  - Success rate
  - Average query time
- RPC performance details (JSON)

**Health Score Calculation:**
```
Score = (40% × publishability_ratio) +
        (30% × avg_integrity_score) +
        (20% × search_success_rate) +
        (10% × responsiveness)
```

**Usage:**
```typescript
const health = await brainMetricsService.getBrainGlobalHealth();
console.log(`Status: ${health.system_status}`);
console.log(`Health Score: ${health.overall_health_score}/100`);
console.log(`24h Searches: ${health.searches_last_24h}`);
```

### 4. `brain_metrics_summary`

Quick snapshot of all key metrics in a single view.

**Usage:**
```typescript
const summary = await brainMetricsService.getBrainMetricsSummary();
// Returns: health_score, status, doc_count, embedding_coverage, search_stats
```

## Service API

### `getBrainMetrics()`

Retrieve all metrics (health, embedding, global health, summary).

```typescript
const response = await brainMetricsService.getBrainMetrics();

if ('error' in response) {
  console.error('Failed to retrieve metrics:', response.message);
} else {
  console.log(response.health);        // Health metrics
  console.log(response.embedding);     // Embedding metrics
  console.log(response.global_health); // Global health
  console.log(response.summary);       // Summary
}
```

### `getBrainHealthMetrics()`

Get document health metrics only.

```typescript
const health = await brainMetricsService.getBrainHealthMetrics();
```

### `getBrainEmbeddingMetrics()`

Get embedding coverage metrics only.

```typescript
const embedding = await brainMetricsService.getBrainEmbeddingMetrics();
```

### `getBrainGlobalHealth()`

Get global health and RPC performance.

```typescript
const health = await brainMetricsService.getBrainGlobalHealth();
```

### `getBrainMetricsSummary()`

Get quick summary of all metrics.

```typescript
const summary = await brainMetricsService.getBrainMetricsSummary();
```

### `isBrainHealthy()`

Quick boolean check: is Brain healthy?

Returns `true` if:
- `overall_health_score >= 70` AND
- `system_status !== 'CRITICAL'`

```typescript
const healthy = await brainMetricsService.isBrainHealthy();
if (healthy) {
  console.log('Brain is operating normally');
}
```

### `getHealthStatus()`

Get human-readable health status string.

```typescript
const status = await brainMetricsService.getHealthStatus();
// Example output: "✅ HEALTHY (Score: 85/100, Docs: 1250)"
```

## Usage Examples

### Admin Dashboard

```typescript
import { getBrainMetricsService } from '@/services/brain';

export async function getBrainStatus(req, res) {
  const metricsService = getBrainMetricsService();
  const metrics = await metricsService.getBrainMetrics();

  if ('error' in metrics) {
    return res.status(500).json(metrics);
  }

  res.json({
    health_score: metrics.global_health.overall_health_score,
    status: metrics.global_health.system_status,
    documents: metrics.health.total_documents,
    publishable: metrics.health.publishable_documents,
    embedding_coverage: metrics.embedding.embedding_coverage_percent,
    searches_24h: metrics.global_health.searches_last_24h,
  });
}
```

### Health Check Endpoint

```typescript
export async function healthCheck(req, res) {
  const metricsService = getBrainMetricsService();
  const healthy = await metricsService.isBrainHealthy();

  res.status(healthy ? 200 : 503).json({
    healthy,
    status: await metricsService.getHealthStatus(),
  });
}
```

### Monitoring & Alerting

```typescript
export async function checkAndAlert() {
  const metricsService = getBrainMetricsService();
  const health = await metricsService.getBrainGlobalHealth();

  if ('error' in health) {
    console.error('Cannot retrieve metrics:', health.message);
    return;
  }

  if (health.system_status === 'CRITICAL') {
    // Send alert
    await sendAlert({
      level: 'critical',
      message: `Brain is in CRITICAL state. Score: ${health.overall_health_score}/100`,
      metrics: health,
    });
  } else if (health.search_success_rate_percent < 95) {
    // Send warning
    await sendAlert({
      level: 'warning',
      message: `Search success rate low: ${health.search_success_rate_percent}%`,
    });
  }
}
```

## Constraints

### ✅ What This Layer Does

- **Read-Only**: All operations are SELECT-only
- **Non-Invasive**: No triggers, no side effects
- **Real-Time**: Current metrics snapshot
- **Comprehensive**: Health, embedding, and performance views

### ❌ What This Layer Does NOT Do

- Modify any existing tables
- Create indexes on transactional tables
- Impact ingestion pipeline
- Trigger any background jobs
- Cache data (views are real-time)

## Performance

### Query Performance

- **Quick queries** (< 100ms):
  - `brain_metrics_summary`
  - Single metric views with small datasets

- **Medium queries** (100-300ms):
  - All metric views on medium datasets
  - Aggregate queries with multiple tables

- **Potential slow queries** (> 500ms):
  - Large knowledge bases (> 100k documents)
  - Complex JSON aggregations

### Optimization Tips

1. **Cache at Application Level**
   ```typescript
   // Cache metrics for 5 minutes
   const cached = cache.get('brain-metrics');
   if (!cached) {
     const fresh = await metricsService.getBrainMetrics();
     cache.set('brain-metrics', fresh, 5 * 60 * 1000);
   }
   ```

2. **Use Summary for Quick Checks**
   ```typescript
   // Instead of fetching all metrics
   const summary = await metricsService.getBrainMetricsSummary();
   ```

3. **Limit Query Frequency**
   - Don't call in tight loops
   - Cache results for 1-5 minutes
   - Use health check endpoint sparingly

## Schema Details

### Underlying Tables

All views are derived from existing tables:
- `knowledge_documents` - Document metadata, status, scores
- `knowledge_chunks` - Chunk content, embeddings, tokens
- `knowledge_rpc_metrics` - RPC call performance (last 24h)

### No New Columns

No new columns are added to existing tables. This ensures:
- Zero impact on storage
- Zero impact on existing queries
- Backward compatibility

## Troubleshooting

### "No data returned" errors

This typically means the view is returning NULL or empty results.

```typescript
// Check if any documents exist
const health = await metricsService.getBrainHealthMetrics();
if (health.total_documents === 0) {
  console.log('No documents in knowledge base');
}
```

### Slow metric queries

Large knowledge bases (> 100k documents) may have slow aggregate queries.

**Solution**: Cache results at application level or increase timeout.

```typescript
// Increase timeout
const result = await metricsService.getBrainGlobalHealth();
// Use result from cache if available, or show cached previous result
```

### RPC performance metrics missing

The `brain_global_health` view only shows metrics from the last 24 hours.

If your RPC calls are older than 24h, they won't appear in the performance metrics.

## Related Services

- **KnowledgeIntegrityService** - Calculates integrity_score and is_publishable
- **KnowledgeBrainService** - RAG search using brain_health_metrics
- **HealthService** - System-level health monitoring

## Future Enhancements

Potential additions (not currently implemented):

- Historical metrics storage (time-series)
- Trend analysis (improvement/degradation)
- Automatic alerting rules
- Custom metric aggregations
- Real-time dashboards
- Performance baselines

## Support

For issues or questions about Brain Metrics:

1. Check the `getBrainMetrics()` return value for error details
2. Review the constraint checks in `isBrainHealthy()`
3. Check the logs for warning/error messages
4. Verify network connectivity to Supabase
5. Ensure RLS policies allow viewing views

---

**Version**: 1.0
**Status**: Production Ready
**Last Updated**: March 2026
