/**
 * RAG — Embedding Cache Service
 * In-memory LRU cache for embedding vectors.
 * Avoids redundant API calls for repeated or near-identical queries.
 */

const MAX_ENTRIES = 1000;

// Insertion-ordered Map acts as the LRU structure:
// - newest entries sit at the tail
// - when the limit is reached, the head (oldest) is evicted
const cache = new Map<string, number[]>();

/**
 * Normalise a query string to a stable cache key.
 * Collapses whitespace and lowercases so minor variations share the same entry.
 */
function normalise(text: string): string {
  return text.trim().toLowerCase().replace(/\s+/g, ' ');
}

/**
 * Return the cached embedding for `text`, or undefined on a miss.
 */
export function getCachedEmbedding(text: string): number[] | undefined {
  const key = normalise(text);
  const hit = cache.get(key);
  if (!hit) return undefined;

  // Refresh recency: delete + re-insert moves the entry to the tail
  cache.delete(key);
  cache.set(key, hit);
  return hit;
}

/**
 * Store an embedding in the cache, evicting the oldest entry if full.
 */
export function setCachedEmbedding(text: string, embedding: number[]): void {
  const key = normalise(text);

  if (cache.size >= MAX_ENTRIES) {
    // Map iterator yields keys in insertion order — first key is the oldest
    const oldest = cache.keys().next().value;
    if (oldest !== undefined) cache.delete(oldest);
  }

  cache.set(key, embedding);
}

/** Current number of cached entries (for observability / tests). */
export function embeddingCacheSize(): number {
  return cache.size;
}

/** Clear the entire cache (useful in tests). */
export function clearEmbeddingCache(): void {
  cache.clear();
}
