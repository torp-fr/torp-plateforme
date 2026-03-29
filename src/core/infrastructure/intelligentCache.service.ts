/**
 * Intelligent Cache Service (Phase 30.3)
 * Provides configurable TTL caching with automatic refresh
 * Reduces API calls and improves response time
 */

import { structuredLogger } from '@/services/observability/structured-logger';

const logger = structuredLogger;

export interface CacheEntry<T> {
  key: string;
  data: T;
  timestamp: number;
  ttlMs: number;
  hits: number;
  misses: number;
}

export interface CacheStats {
  totalEntries: number;
  hitCount: number;
  missCount: number;
  hitRatio: number;
  averageAge: number;
}

interface CacheTTLConfig {
  [source: string]: number;
}

async function hashString(input: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(input);
  const hashBuffer = await window.crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hashBuffer))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

class IntelligentCacheService {
  private cache: Map<string, CacheEntry<any>> = new Map();
  private hitCount = 0;
  private missCount = 0;
  private refreshIntervals: Map<string, number> = new Map();

  private ttlConfig: CacheTTLConfig = {
    enterprise_verifications: 24 * 60 * 60 * 1000,
    geo_context_cache: 7 * 24 * 60 * 60 * 1000,
    rge_certifications: 7 * 24 * 60 * 60 * 1000,
    api_response: 60 * 60 * 1000,
    doctrine_sources: 24 * 60 * 60 * 1000,
    fraud_patterns: 60 * 60 * 1000,
  };

  private async generateCacheKey(source: string, params: Record<string, any>): Promise<string> {
    const paramString = JSON.stringify(params);
    const hash = await hashString(paramString);
    return `${source}:${hash}`;
  }

  async get<T>(source: string, params: Record<string, any>): Promise<T | null> {
    const key = await this.generateCacheKey(source, params);
    const entry = this.cache.get(key);

    if (!entry) {
      this.missCount++;
      logger.debug(`[Cache] MISS: ${key}`);
      return null;
    }

    const age = Date.now() - entry.timestamp;
    if (age > entry.ttlMs) {
      this.cache.delete(key);
      this.missCount++;
      logger.debug(`[Cache] EXPIRED: ${key} (age: ${age}ms, ttl: ${entry.ttlMs}ms)`);
      return null;
    }

    this.hitCount++;
    entry.hits++;
    logger.debug(`[Cache] HIT: ${key} (age: ${age}ms)`);
    return entry.data as T;
  }

  async set<T>(source: string, params: Record<string, any>, data: T): Promise<void> {
    const key = await this.generateCacheKey(source, params);
    const ttlMs = this.ttlConfig[source] || 60 * 60 * 1000;

    this.cache.set(key, {
      key,
      data,
      timestamp: Date.now(),
      ttlMs,
      hits: 0,
      misses: 0,
    });

    logger.debug(`[Cache] SET: ${key} (ttl: ${ttlMs}ms)`);
  }

  async invalidate(source: string, params: Record<string, any>): Promise<boolean> {
    const key = await this.generateCacheKey(source, params);
    const deleted = this.cache.delete(key);

    if (deleted) {
      logger.info(`[Cache] INVALIDATED: ${key}`);
    }

    return deleted;
  }

  /**
   * Clear all cache for a source
   */
  invalidateSource(source: string): number {
    let count = 0;
    this.cache.forEach((_, key) => {
      if (key.startsWith(source + ':')) {
        this.cache.delete(key);
        count++;
      }
    });

    if (count > 0) {
      logger.info(`[Cache] INVALIDATED source ${source}: ${count} entries`);
    }

    return count;
  }

  /**
   * Clear expired entries
   */
  cleanExpired(): number {
    let count = 0;
    const now = Date.now();

    this.cache.forEach((entry, key) => {
      if (now - entry.timestamp > entry.ttlMs) {
        this.cache.delete(key);
        count++;
      }
    });

    if (count > 0) {
      logger.debug(`[Cache] Cleaned ${count} expired entries`);
    }

    return count;
  }

  clear(): void {
    this.cache.clear();
    this.hitCount = 0;
    this.missCount = 0;
    this.refreshIntervals.forEach(id => clearInterval(id));
    this.refreshIntervals.clear();
    logger.info('[Cache] Cleared all cache');
  }

  /**
   * Get cache statistics
   */
  getStats(): CacheStats {
    let totalAge = 0;
    this.cache.forEach((entry) => {
      totalAge += Date.now() - entry.timestamp;
    });

    const totalCount = this.hitCount + this.missCount;
    const hitRatio = totalCount > 0 ? this.hitCount / totalCount : 0;

    return {
      totalEntries: this.cache.size,
      hitCount: this.hitCount,
      missCount: this.missCount,
      hitRatio: Math.round(hitRatio * 10000) / 100, // as percentage
      averageAge: this.cache.size > 0 ? Math.round(totalAge / this.cache.size) : 0,
    };
  }

  /**
   * Get all entries for a source
   */
  getSourceEntries(source: string): Map<string, CacheEntry<any>> {
    const entries = new Map<string, CacheEntry<any>>();

    this.cache.forEach((entry, key) => {
      if (key.startsWith(source + ':')) {
        entries.set(key, entry);
      }
    });

    return entries;
  }

  /**
   * Set TTL for cache source
   */
  setTTL(source: string, ttlMs: number): void {
    this.ttlConfig[source] = ttlMs;
    logger.info(`[Cache] Updated TTL for ${source}: ${ttlMs}ms`);
  }

  /**
   * Get TTL for cache source
   */
  getTTL(source: string): number {
    return this.ttlConfig[source] || 60 * 60 * 1000;
  }

  scheduleRefresh(
    source: string,
    params: Record<string, any>,
    refreshFn: () => Promise<any>,
    refreshIntervalMs: number = 30 * 60 * 1000
  ): number {
    const intervalId = setInterval(async () => {
      try {
        logger.debug(`[Cache] Refreshing ${source}...`);
        const data = await refreshFn();
        await this.set(source, params, data);
        logger.info(`[Cache] Refreshed ${source}`);
      } catch (error) {
        logger.error(
          `[Cache] Error refreshing ${source}: ${error instanceof Error ? error.message : String(error)}`
        );
      }
    }, refreshIntervalMs);

    this.refreshIntervals.set(`${source}:${Date.now()}`, intervalId);
    return intervalId;
  }

  async getEntryDetails(source: string, params: Record<string, any>): Promise<CacheEntry<any> | null> {
    const key = await this.generateCacheKey(source, params);
    const entry = this.cache.get(key);

    if (entry) {
      const age = Date.now() - entry.timestamp;
      const remaining = Math.max(0, entry.ttlMs - age);

      return {
        ...entry,
        ttlMs: remaining,
      };
    }

    return null;
  }

  /**
   * Get all cache entries (for admin dashboard)
   */
  getAllEntries(): CacheEntry<any>[] {
    return Array.from(this.cache.values()).map((entry) => ({
      ...entry,
      ttlMs: Math.max(0, entry.ttlMs - (Date.now() - entry.timestamp)), // Remaining TTL
    }));
  }
}

// Export singleton instance
export const intelligentCacheService = new IntelligentCacheService();
export default intelligentCacheService;
