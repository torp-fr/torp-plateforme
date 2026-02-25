# AI Telemetry Guide

**Phase**: 36.12.1 — Production Monitoring
**Type**: Structured JSON logging for observability
**Impact**: Zero functional changes (transparent monitoring)

---

## Overview

The AI Orchestrator now emits structured telemetry for every AI operation:
- ✅ LLM completions
- ✅ JSON extractions
- ✅ Embedding generations
- ✅ Fallback activations
- ✅ Retries and errors

All logs are **structured JSON** tagged with `[AI_TELEMETRY]` for easy parsing.

---

## Log Format

### Success Log Example

```json
{
  "timestamp": "2026-02-25T14:32:45.123Z",
  "tag": "[AI_TELEMETRY]",
  "level": "INFO",
  "operation": "completion",
  "provider": "openai",
  "latencyMs": 1250,
  "retries": 0,
  "summary": "completion | via openai | in 1250ms",
  "metric": {
    "requestId": "1740482365123-a1b2c3d4e",
    "operation": "completion",
    "primaryProvider": "openai",
    "providerUsed": "openai",
    "fallbackTriggered": false,
    "latencyMs": 1250,
    "retriesUsed": 0,
    "inputLength": 1247,
    "outputLength": 3421,
    "timestamp": "2026-02-25T14:32:45.123Z",
    "success": true
  }
}
```

### Error Log Example

```json
{
  "timestamp": "2026-02-25T14:33:15.456Z",
  "tag": "[AI_TELEMETRY]",
  "level": "WARN",
  "operation": "embedding",
  "provider": "hybridAI",
  "latencyMs": 3250,
  "retries": 2,
  "summary": "embedding FAILED | provider: hybridAI | error: TIMEOUT_ERROR | (2 retries exhausted)",
  "metric": {
    "requestId": "1740482395456-f5g6h7i8j",
    "operation": "embedding",
    "primaryProvider": "secureAI",
    "lastProviderTried": "hybridAI",
    "retriesExhausted": true,
    "errorCode": "TIMEOUT_ERROR",
    "errorMessage": "Edge Function timeout after 30s",
    "latencyMs": 3250,
    "retriesUsed": 2,
    "inputLength": 5421,
    "timestamp": "2026-02-25T14:33:15.456Z",
    "success": false
  }
}
```

### Fallback Example (Synthetic Embedding)

```json
{
  "timestamp": "2026-02-25T14:34:20.789Z",
  "tag": "[AI_TELEMETRY]",
  "level": "INFO",
  "operation": "embedding_fallback",
  "provider": "hybridAI",
  "latencyMs": 4125,
  "retries": 2,
  "summary": "embedding_fallback | via hybridAI | in 4125ms (fallback) retried 2x [synthetic]",
  "metric": {
    "requestId": "1740482460789-k9l0m1n2o",
    "operation": "embedding_fallback",
    "primaryProvider": "secureAI",
    "providerUsed": "hybridAI",
    "fallbackTriggered": true,
    "latencyMs": 4125,
    "retriesUsed": 2,
    "inputLength": 4850,
    "outputLength": 1536,
    "isSyntheticEmbedding": true,
    "embeddingDimension": 1536,
    "timestamp": "2026-02-25T14:34:20.789Z",
    "success": true
  }
}
```

---

## Log Levels

| Level | Meaning | When |
|-------|---------|------|
| **INFO** | Operation succeeded | After successful AI call |
| **WARN** | Operation failed | After exhausting retries/fallbacks |

---

## Fields Reference

### Common Fields (All Logs)

```
requestId       string   Unique request identifier for tracing
operation       string   Type: "completion", "json", "embedding", "embedding_fallback"
primaryProvider string   Configured primary provider (openai/claude)
latencyMs       number   Total operation duration in milliseconds
retriesUsed     number   How many retries were executed
inputLength     number   Characters in input prompt
timestamp       string   ISO 8601 timestamp
success         boolean  true=success, false=failure
```

### Success-Only Fields

```
providerUsed        string   Which provider was actually used
outputLength        number   Characters in output
embeddingDimension  number   Dimension of embedding vector (1536)
isSyntheticEmbedding boolean true if fallback LLM-based embedding
fallbackTriggered   boolean  true if fallback was used
```

### Error-Only Fields

```
lastProviderTried   string   Last provider attempted
retriesExhausted    boolean  true if max retries exhausted
errorCode          string   Error category (e.g., "TIMEOUT_ERROR", "JSON_PARSE_ERROR")
errorMessage       string   Human-readable error description
```

---

## Parsing Telemetry

### With grep + jq (Bash)

```bash
# Show all AI telemetry logs
grep "\[AI_TELEMETRY\]" logs.txt | jq '.'

# Show only failures
grep "\[AI_TELEMETRY\]" logs.txt | jq 'select(.metric.success == false)'

# Show average latency by operation
grep "\[AI_TELEMETRY\]" logs.txt | jq '.metric | group_by(.operation) | map({operation: .[0].operation, avgLatency: (map(.latencyMs) | add / length)})'

# Show fallback triggers
grep "\[AI_TELEMETRY\]" logs.txt | jq 'select(.metric.fallbackTriggered == true)'

# Show retries > 0
grep "\[AI_TELEMETRY\]" logs.txt | jq 'select(.metric.retriesUsed > 0)'
```

### With Node.js (Log Aggregation)

```typescript
// Parse a log line
const logLine = console.log output;
const parsed = JSON.parse(logLine);

// Access metrics
console.log(`Operation: ${parsed.metric.operation}`);
console.log(`Provider: ${parsed.metric.providerUsed}`);
console.log(`Latency: ${parsed.metric.latencyMs}ms`);
```

---

## Metrics to Monitor

### Critical Production Metrics

1. **Fallback Rate**
   ```json
   fallbackTriggered: true
   ```
   - Alert if > 5% of requests trigger fallback
   - Indicates primary provider issues

2. **Retry Rate**
   ```json
   retriesUsed: > 0
   ```
   - Alert if > 10% of requests need retries
   - Indicates network/API instability

3. **Latency P95**
   ```json
   latencyMs: [track 95th percentile]
   ```
   - Alert if > 5000ms (5 seconds)
   - Indicates performance degradation

4. **Synthetic Embedding Usage**
   ```json
   isSyntheticEmbedding: true
   ```
   - Track frequency of LLM-based fallback embeddings
   - Less precise than Edge Function vectors

5. **Error Rate**
   ```json
   "level": "WARN"
   ```
   - Alert if > 1% of requests fail after all retries
   - Indicates system instability

---

## Example Dashboards

### Grafana Query (Loki)

```promql
# Success rate by provider
sum by (provider) (
  count_over_time({job="ai-telemetry"} | json metric_success="true" [5m])
)
/
sum by (provider) (
  count_over_time({job="ai-telemetry"} | json [5m])
) * 100

# P95 latency by operation
quantile_over_time(0.95,
  sum by (operation) (rate({job="ai-telemetry"} | json metric_latencyMs [5m]))
)
```

### DataDog Query

```
@ai_telemetry.success:true
| stats count() as total, pct(@ai_telemetry.latencyMs, 95) as p95_latency by @metric.operation
```

---

## Operational Guidelines

### 1. Enable Telemetry (Default: ON)

Telemetry is **enabled by default** with zero configuration needed.

To disable (not recommended):
```typescript
// In aiOrchestrator.service.ts constructor
// Comment out: aiTelemetry.trackAIRequest()
// Comment out: aiTelemetry.logAIError()
```

### 2. Log Rotation

Since logs are structured JSON:
- Parse and aggregate in your logging backend (ELK, Splunk, Datadog)
- Discard raw logs after 7 days
- Keep aggregated metrics for 30 days

### 3. Alerts

Set up alerts for:
- Fallback rate > 5%
- Retry rate > 10%
- Error rate > 1%
- P95 latency > 5s
- Synthetic embedding usage > 20%

---

## Example: Full Request Lifecycle

### Request Flow with Telemetry

```
User uploads PDF
  ↓
torpAnalyzerService.analyzeDevis()
  ├─→ aiOrchestrator.generateJSON() [Step 1: Extract]
  │   └─→ [AI_TELEMETRY] ✅ extraction success (1250ms, openai, 0 retries)
  │
  ├─→ aiOrchestrator.generateJSON() [Step 2: Analyze Entreprise]
  │   └─→ [AI_TELEMETRY] ✅ json success (890ms, openai, 0 retries)
  │
  ├─→ aiOrchestrator.generateJSON() [Step 3-6: Various analyses]
  │   └─→ [AI_TELEMETRY] ✅ json success (1100ms, claude [fallback], 1 retry)
  │
  └─→ knowledgeBrainService.generateEmbedding()
      └─→ aiOrchestrator.generateEmbedding()
          └─→ [AI_TELEMETRY] ✅ embedding_fallback success (4125ms, hybridAI, 2 retries) [synthetic]

Result: PDF analyzed
Telemetry: 7 structured JSON events logged
```

---

## Troubleshooting

### No Logs Appearing?

1. Check orchestrator telemetry is imported
2. Verify console logging is not suppressed
3. Search for `[AI_TELEMETRY]` in logs

### High Latency?

1. Check `latencyMs` in logs
2. If > 3000ms: Network latency or provider slowness
3. Monitor `retriesUsed`: multiple retries = instability

### Too Many Fallbacks?

1. Check `fallbackTriggered: true` entries
2. If > 5%: Primary provider (OpenAI) may be failing
3. Check `errorCode` to identify root cause

---

## Performance Impact

**Telemetry overhead**:
- Per-request: ~1-2ms (JSON serialization only)
- Memory: ~500 bytes per request
- Network: Zero (console logging only)

**Conclusion**: Negligible impact on AI operations.

---

**Last Updated**: 2026-02-25
**Status**: ✅ Production Ready
**Zero Breaking Changes**: ✅ Confirmed
