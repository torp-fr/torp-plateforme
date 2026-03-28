// ─────────────────────────────────────────────────────────────────────────────
// embedding.fallback.ts — Synthetic TF-IDF embedding fallback.
//
// Used when OpenAI embeddings API is unavailable (network error, quota, outage).
// Produces a deterministic 384-dim vector via character n-gram hashing.
//
// ⚠️  Synthetic embeddings have lower semantic accuracy than real embeddings.
//     They are acceptable for:
//       - Keeping ingestion unblocked during outages
//       - Structural similarity (same words → same vector)
//     They should be recomputed with real embeddings when the API recovers.
//
// Records marked with is_synthetic=true can be identified and re-embedded via:
//   SELECT id FROM knowledge_chunks WHERE is_synthetic = true;
//   (add is_synthetic column to knowledge_chunks if you want to track this)
// ─────────────────────────────────────────────────────────────────────────────

export interface SyntheticEmbeddingResult {
  embedding: number[];
  is_synthetic: true;
  method: 'tfidf-hash';
}

// ── Constants ─────────────────────────────────────────────────────────────────

const DEFAULT_DIMS = 384;

// ── Core algorithm ────────────────────────────────────────────────────────────

/**
 * Deterministic FNV-1a hash of a string → integer.
 * FNV-1a has good distribution for short strings (tokens).
 */
function fnv1a(str: string): number {
  let hash = 2166136261; // FNV offset basis (32-bit)
  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i);
    hash = (hash * 16777619) >>> 0; // FNV prime, keep as uint32
  }
  return hash;
}

/**
 * Tokenize text into unigrams + bigrams.
 * Lowercases, removes punctuation, splits on whitespace.
 */
function tokenize(text: string): string[] {
  const words = text
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length > 0);

  const tokens: string[] = [...words];

  // Add bigrams for slightly better phrase awareness
  for (let i = 0; i < words.length - 1; i++) {
    tokens.push(`${words[i]}_${words[i + 1]}`);
  }

  return tokens;
}

/**
 * Compute term frequency map for a list of tokens.
 */
function termFrequency(tokens: string[]): Map<string, number> {
  const tf = new Map<string, number>();
  for (const token of tokens) {
    tf.set(token, (tf.get(token) ?? 0) + 1);
  }
  return tf;
}

/**
 * Normalize a vector to unit length (L2 norm).
 * Returns the original array mutated in-place.
 */
function l2Normalize(vec: number[]): number[] {
  const magnitude = Math.sqrt(vec.reduce((sum, v) => sum + v * v, 0));
  if (magnitude < 1e-10) return vec; // zero vector — leave as-is
  for (let i = 0; i < vec.length; i++) {
    vec[i] /= magnitude;
  }
  return vec;
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Generate a synthetic 384-dim embedding for the given text.
 *
 * Algorithm:
 *   1. Tokenize into unigrams + bigrams
 *   2. Compute TF per token
 *   3. Hash each token to a vector dimension (FNV-1a % dims)
 *   4. Accumulate weighted values at each dimension
 *   5. L2-normalize the result
 *
 * @param text  Input text to embed (any length; long texts are sampled)
 * @param dims  Output dimension count (default 384 to match pgvector schema)
 */
export function generateSyntheticEmbedding(
  text: string,
  dims: number = DEFAULT_DIMS
): SyntheticEmbeddingResult {
  if (!text || text.trim().length === 0) {
    return {
      embedding: new Array(dims).fill(0),
      is_synthetic: true,
      method: 'tfidf-hash',
    };
  }

  // Cap input length to keep computation bounded
  const inputText = text.length > 8000 ? text.slice(0, 8000) : text;

  const tokens = tokenize(inputText);
  const tf     = termFrequency(tokens);

  const vector = new Array(dims).fill(0);

  for (const [token, freq] of tf) {
    const primaryIdx   = fnv1a(token) % dims;
    const secondaryIdx = fnv1a(`_${token}_`) % dims; // second probe for collision mitigation

    // IDF-like weight: penalise extremely common tokens
    const idfWeight = 1 / (1 + Math.log(1 + freq));

    vector[primaryIdx]   += freq * idfWeight;
    vector[secondaryIdx] += freq * idfWeight * 0.5;
  }

  l2Normalize(vector);

  return {
    embedding: vector,
    is_synthetic: true,
    method: 'tfidf-hash',
  };
}

/**
 * Compute cosine similarity between two vectors.
 * Useful for testing that synthetic embeddings of similar texts are closer
 * than embeddings of unrelated texts.
 */
export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) throw new Error('Vectors must have equal dimensions');

  let dot = 0;
  let magA = 0;
  let magB = 0;

  for (let i = 0; i < a.length; i++) {
    dot  += a[i] * b[i];
    magA += a[i] * a[i];
    magB += b[i] * b[i];
  }

  const denom = Math.sqrt(magA) * Math.sqrt(magB);
  return denom < 1e-10 ? 0 : dot / denom;
}
