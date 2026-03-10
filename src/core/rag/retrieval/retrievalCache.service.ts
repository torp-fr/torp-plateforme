/**
 * RAG — Retrieval Result Cache Service
 * Caches search results to eliminate redundant retrieval operations.
 *
 * Purpose: For repeated or near-identical queries (same text + category + region),
 * return cached results instead of re-running the expensive hybrid search
 * (embeddings + pgvector + FTS + reranking).
 *
 * Cache key: hash(query + category + region)
 * TTL: 5 minutes per entry
 * Memory: Unbounded (cleanup via TTL expiration)
 */

import { SearchResult } from '../types';
import { log, warn } from '@/lib/logger';
import * as crypto from 'crypto';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

interface CacheEntry<T> {
  data: T;
  timestamp: number; // milliseconds since epoch
  ttlMs: number; // time-to-live in milliseconds
}

// ─────────────────────────────────────────────────────────────────────────────
// Configuration
// ─────────────────────────────────────────────────────────────────────────────

const DEFAULT_TTL_MS = 5 * 60 * 1000; // 5 minutes
const CLEANUP_INTERVAL_MS = 60 * 1000; // Cleanup every 1 minute

// ─────────────────────────────────────────────────────────────────────────────
// Cache Implementation
// ─────────────────────────────────────────────────────────────────────────────

class RetrievalCache {
  private cache = new Map<string, CacheEntry<SearchResult[]>>();
  private cleanupTimer: NodeJS.Timeout | null = null;
  private stats = {
    hits: 0,
    misses: 0,
    evictions: 0,
  };

  constructor() {
    this.startCleanupTimer();
  }

  /**
   * Generate a cache key from query parameters.
   * Uses SHA256 hash of concatenated parameters for consistent, compact keys.
   */
  private generateKey(query: string, category?: string, region?: string): string {
    const input = `${query}|${category || ''}|${region || ''}`;
    return crypto.createHash('sha256').update(input).digest('hex');
  }

  /**
   * Check if a cache entry is still valid (not expired).
   */
  private isValid(entry: CacheEntry<SearchResult[]>): boolean {
    const age = Date.now() - entry.timestamp;
    return age < entry.ttlMs;
  }

  /**
   * Retrieve cached results if available and valid.
   */
  get(query: string, category?: string, region?: string): SearchResult[] | null {
    const key = this.generateKey(query, category, region);
    const entry = this.cache.get(key);

    if (!entry) {
      this.stats.misses++;
      return null;
    }

    if (!this.isValid(entry)) {
      // Entry expired — remove and count as miss
      this.cache.delete(key);
      this.stats.misses++;
      log('[RAG:Cache] ♻️ Expired cache entry evicted:', key.substring(0, 8));
      return null;
    }

    // Cache hit
    this.stats.hits++;
    const age = Date.now() - entry.timestamp;
    log('[RAG:Cache] ✅ Cache hit (age: ', Math.round(age / 1000), 's):', key.substring(0, 8));
    return entry.data;
  }

  /**
   * Store results in cache.
   */
  set(query: string, results: SearchResult[], category?: string, region?: string): void {
    const key = this.generateKey(query, category, region);

    this.cache.set(key, {
      data: results,
      timestamp: Date.now(),
      ttlMs: DEFAULT_TTL_MS,
    });

    log('[RAG:Cache] 💾 Cached retrieval result:', {
      key: key.substring(0, 8),
      chunks: results.length,
      ttlMin: DEFAULT_TTL_MS / 1000 / 60,
    });
  }

  /**
   * Manually clear the entire cache.
   */
  clear(): void {
    const size = this.cache.size;
    this.cache.clear();
    log('[RAG:Cache] 🗑️ Cache cleared —', size, 'entries removed');
  }

  /**
   * Get cache statistics.
   */
  getStats(): { hits: number; misses: number; evictions: number; hitRate: string; size: number } {
    const total = this.stats.hits + this.stats.misses;
    const hitRate = total > 0 ? ((this.stats.hits / total) * 100).toFixed(1) : '0.0';

    return {
      hits: this.stats.hits,
      misses: this.stats.misses,
      evictions: this.stats.evictions,
      hitRate: `${hitRate}%`,
      size: this.cache.size,
    };
  }

  /**
   * Reset statistics.
   */
  resetStats(): void {
    this.stats = { hits: 0, misses: 0, evictions: 0 };
    log('[RAG:Cache] 📊 Cache statistics reset');
  }

  /**
   * Run periodic cleanup of expired entries.
   */
  private cleanup(): void {
    let evicted = 0;
    const now = Date.now();

    for (const [key, entry] of this.cache.entries()) {
      if (!this.isValid(entry)) {
        this.cache.delete(key);
        evicted++;
      }
    }

    if (evicted > 0) {
      this.stats.evictions += evicted;
      log('[RAG:Cache] ♻️ Cleanup: evicted', evicted, 'expired entries');
    }
  }

  /**
   * Start periodic cleanup timer.
   */
  private startCleanupTimer(): void {
    if (this.cleanupTimer) return; // Already running
    this.cleanupTimer = setInterval(() => this.cleanup(), CLEANUP_INTERVAL_MS);
    log('[RAG:Cache] ⏱️ Cleanup timer started (interval: ', CLEANUP_INTERVAL_MS / 1000, 's)');
  }

  /**
   * Stop cleanup timer (for graceful shutdown).
   */
  stopCleanupTimer(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
      log('[RAG:Cache] ⏹️ Cleanup timer stopped');
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Singleton Export
// ─────────────────────────────────────────────────────────────────────────────

export const retrievalCache = new RetrievalCache();

/**
 * Check cache for existing results.
 */
export function getCachedResults(query: string, category?: string, region?: string): SearchResult[] | null {
  return retrievalCache.get(query, category, region);
}

/**
 * Store results in cache.
 */
export function cacheResults(query: string, results: SearchResult[], category?: string, region?: string): void {
  retrievalCache.set(query, results, category, region);
}

/**
 * Clear the entire cache.
 */
export function clearCache(): void {
  retrievalCache.clear();
}

/**
 * Get cache statistics for monitoring.
 */
export function getCacheStats(): { hits: number; misses: number; evictions: number; hitRate: string; size: number } {
  return retrievalCache.getStats();
}

/**
 * Reset cache statistics.
 */
export function resetCacheStats(): void {
  retrievalCache.resetStats();
}
