// ─────────────────────────────────────────────────────────────────────────────
// PipelineCache — TTL-based in-process cache for pipeline results
// ─────────────────────────────────────────────────────────────────────────────

interface CacheEntry<T> {
  data: T;
  cachedAt: Date;
  expiresAt: Date;
}

/**
 * Simple in-process LRU-style cache with TTL expiry.
 * Shared across all BasePipeline instances via module singleton.
 * Production upgrade path: swap backing store for Redis without changing callers.
 */
export class PipelineCache {
  private static readonly store = new Map<string, CacheEntry<unknown>>();
  private static readonly MAX_ENTRIES = 500;

  /**
   * Retrieve cached value. Returns null if missing or expired.
   */
  async get<T>(key: string): Promise<{ data: T; cachedAt: Date } | null> {
    const entry = PipelineCache.store.get(key) as CacheEntry<T> | undefined;
    if (!entry) return null;

    if (Date.now() > entry.expiresAt.getTime()) {
      PipelineCache.store.delete(key);
      return null;
    }

    return { data: entry.data, cachedAt: entry.cachedAt };
  }

  /**
   * Store a value with TTL (in milliseconds).
   */
  async set<T>(key: string, data: T, ttlMs: number): Promise<void> {
    // Evict oldest entry if at capacity
    if (PipelineCache.store.size >= PipelineCache.MAX_ENTRIES) {
      const firstKey = PipelineCache.store.keys().next().value;
      if (firstKey) PipelineCache.store.delete(firstKey);
    }

    const now = new Date();
    PipelineCache.store.set(key, {
      data,
      cachedAt: now,
      expiresAt: new Date(now.getTime() + ttlMs),
    });
  }

  /**
   * Invalidate a specific key.
   */
  async delete(key: string): Promise<void> {
    PipelineCache.store.delete(key);
  }

  /**
   * Invalidate all keys matching a prefix.
   */
  async invalidatePrefix(prefix: string): Promise<void> {
    for (const key of PipelineCache.store.keys()) {
      if (key.startsWith(prefix)) PipelineCache.store.delete(key);
    }
  }

  /** Current number of cached entries (for health checks). */
  size(): number {
    return PipelineCache.store.size;
  }
}
