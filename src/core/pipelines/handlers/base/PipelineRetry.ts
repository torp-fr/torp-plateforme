// ─────────────────────────────────────────────────────────────────────────────
// PipelineRetry — Exponential backoff with error classification
// ─────────────────────────────────────────────────────────────────────────────

// Error patterns that indicate a transient failure (worth retrying)
const TRANSIENT_PATTERNS = [
  'timeout', 'timed out', 'econnreset', 'econnrefused',
  'rate limit', '429', '503', '502', '504',
  'network', 'socket', 'aborted', 'fetch failed',
];

// Error patterns that indicate a permanent failure (don't retry)
const PERMANENT_PATTERNS = [
  '400', '401', '403', '404', '422',
  'invalid api key', 'unauthorized', 'forbidden',
  'not found', 'validation', 'malformed',
];

export class PipelineRetry {
  /**
   * Returns the delay in ms before the next attempt.
   * Uses exponential backoff with jitter to prevent thundering herd.
   */
  getBackoffDelay(attempt: number, err?: Error): number {
    const base = parseInt(process.env.RETRY_BACKOFF_MS ?? '1000', 10);
    // 1s → 2s → 4s → 8s...
    const exponential = base * Math.pow(2, attempt - 1);
    // ±20% jitter
    const jitter = exponential * 0.2 * (Math.random() - 0.5);
    // Rate-limit errors: wait longer
    const multiplier = err && this.isRateLimitError(err) ? 3 : 1;
    return Math.round((exponential + jitter) * multiplier);
  }

  /**
   * Classify whether an error is worth retrying.
   */
  isRetryable(err: Error): boolean {
    const msg = err.message.toLowerCase();
    if (PERMANENT_PATTERNS.some(p => msg.includes(p))) return false;
    if (TRANSIENT_PATTERNS.some(p => msg.includes(p))) return true;
    // Default: unknown errors are treated as transient for resilience
    return true;
  }

  private isRateLimitError(err: Error): boolean {
    const msg = err.message.toLowerCase();
    return msg.includes('429') || msg.includes('rate limit') || msg.includes('too many');
  }
}
