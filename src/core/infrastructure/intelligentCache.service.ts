/**
 * Intelligent Cache Service (Phase 30.3)
 * Provides configurable TTL caching with automatic refresh
 * Reduces API calls and improves response time
 */

import { logger } from '@/core/platform/logger';
import crypto from 'crypto';

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
  [source: string]: number; // TTL in milliseconds
}

class IntelligentCacheService {
  private cache: Map<string, CacheEntry<any>> = new Map();
  private hitCount = 0;
  private missCount = 0;

  private ttlConfig: CacheTTLConfig = {
    // Enterprise verification: 24 hours (can be refreshed on demand)
    enterprise_verifications: 24 * 60 * 60 * 1000,
    // Geo context: 7 days (geographic data doesn't change often)
    geo_context_cache: 7 * 24 * 60 * 60 * 1000,
    // RGE certification: 7 days (quarterly updates)
    rge_certifications: 7 * 24 * 60 * 60 * 1000,
    // API response cache: 1 hour
    api_response: 60 * 60 * 1000,
    // Doctrine sources: 24 hours
    doctrine_sources: 24 * 60 * 60 * 1000,
    // Fraud patterns: 1 hour (more dynamic)
    fraud_patterns: 60 * 60 * 1000,
  };

  /**
   * Generate cache key from parameters
   */
  private generateCacheKey(source: string, params: Record<string, any>): string {
    const paramString = JSON.stringify(params);
    const hash = crypto.createHash('sha256').update(paramString).digest('hex');
    return `${source}:${hash}`;
  }

  /**
   * Get cached data if available and not expired
   */
  get<T>(source: string, params: Record<string, any>): T | null {
    const key = this.generateCacheKey(source, params);
    const entry = this.cache.get(key);

    if (!entry) {
      this.missCount++;
      logger.debug(`[Cache] MISS: ${key}`);
      return null;
    }

    const age = Date.now() - entry.timestamp;
    if (age > entry.ttlMs) {
      // Expired
      this.cache.delete(key);
      this.missCount++;
      logger.debug(`[Cache] EXPIRED: ${key} (age: ${age}ms, ttl: ${entry.ttlMs}ms)`);
      return null;
    }

    // Hit
    this.hitCount++;
    entry.hits++;
    logger.debug(`[Cache] HIT: ${key} (age: ${age}ms)`);
    return entry.data as T;
  }

  /**
   * Set cache data
   */
  set<T>(source: string, params: Record<string, any>, data: T): void {
    const key = this.generateCacheKey(source, params);
    const ttlMs = this.ttlConfig[source] || 60 * 60 * 1000; // Default 1 hour

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

  /**
   * Clear specific cache entry
   */
  invalidate(source: string, params: Record<string, any>): boolean {
    const key = this.generateCacheKey(source, params);
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

  /**
   * Clear all cache
   */
  clear(): void {
    this.cache.clear();
    this.hitCount = 0;
    this.missCount = 0;
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

  /**
   * Automatic refresh for critical cache entries (background)
   */
  scheduleRefresh(
    source: string,
    params: Record<string, any>,
    refreshFn: () => Promise<any>,
    refreshIntervalMs: number = 30 * 60 * 1000 // 30 minutes default
  ): NodeJS.Timer {
    return setInterval(async () => {
      try {
        logger.debug(`[Cache] Refreshing ${source}...`);
        const data = await refreshFn();
        this.set(source, params, data);
        logger.info(`[Cache] Refreshed ${source}`);
      } catch (error) {
        logger.error(
          `[Cache] Error refreshing ${source}: ${error instanceof Error ? error.message : String(error)}`
        );
      }
    }, refreshIntervalMs);
  }

  /**
   * Get cache entry details (for debugging)
   */
  getEntryDetails(source: string, params: Record<string, any>): CacheEntry<any> | null {
    const key = this.generateCacheKey(source, params);
    const entry = this.cache.get(key);

    if (entry) {
      const age = Date.now() - entry.timestamp;
      const remaining = Math.max(0, entry.ttlMs - age);

      return {
        ...entry,
        ttlMs: remaining, // Show remaining TTL
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
