/**
 * PHASE 36.8: Intelligent Text Chunking
 * Splits large documents into manageable chunks while preserving semantic boundaries
 */

export interface ChunkingStats {
  total_text_length: number;
  total_chunks: number;
  total_tokens: number;
  largest_chunk_tokens: number;
  average_chunk_tokens: number;
  chunks: Array<{
    index: number;
    length: number;
    tokens: number;
  }>;
}

/**
 * Estimate token count from text length
 * Heuristic: 1 token ≈ 4 characters (conservative estimate)
 */
function estimateTokenCount(text: string): number {
  return Math.ceil(text.length / 4);
}

/**
 * Split text into intelligent chunks
 * Strategy:
 * 1. Split by double newlines (paragraphs)
 * 2. If still too large, split by single newlines (sentences)
 * 3. If still too large, split by words with safety buffer
 * 4. Never split multi-byte characters
 *
 * @param text - Text to chunk
 * @param maxTokens - Maximum tokens per chunk (default: 1000 ≈ 4000 chars)
 * @returns Array of chunk strings
 */
export function chunkText(text: string, maxTokens: number = 1000): string[] {
  if (!text || text.trim().length === 0) {
    return [];
  }

  const maxChars = maxTokens * 4; // Convert tokens to approximate character limit
  const chunks: string[] = [];
  let currentChunk = '';
  let currentTokens = 0;

  // Strategy 1: Split by double newlines (paragraphs)
  const paragraphs = text.split(/\n\n+/);

  for (const paragraph of paragraphs) {
    // Strategy 2: Split by single newlines if paragraph is too large
    const sentences = paragraph.split(/\n+/);

    for (const sentence of sentences) {
      const sentenceTokens = estimateTokenCount(sentence);
      const sentenceLength = sentence.length;

      // If adding this sentence would exceed limit
      if (currentTokens + sentenceTokens > maxTokens && currentChunk.length > 0) {
        // Save current chunk and start new one
        chunks.push(currentChunk.trim());
        currentChunk = sentence;
        currentTokens = sentenceTokens;
      } else {
        // Add sentence to current chunk
        if (currentChunk.length > 0) {
          currentChunk += '\n' + sentence;
          currentTokens += sentenceTokens + 1; // +1 for newline
        } else {
          currentChunk = sentence;
          currentTokens = sentenceTokens;
        }
      }

      // Strategy 3: If even a single sentence/paragraph is too large, split by words
      if (currentTokens > maxTokens) {
        const words = currentChunk.split(/\s+/);
        currentChunk = '';
        currentTokens = 0;

        for (const word of words) {
          const wordTokens = estimateTokenCount(word);

          if (currentTokens + wordTokens > maxTokens && currentChunk.length > 0) {
            chunks.push(currentChunk.trim());
            currentChunk = word;
            currentTokens = wordTokens;
          } else {
            if (currentChunk.length > 0) {
              currentChunk += ' ' + word;
              currentTokens += wordTokens + 1; // +1 for space
            } else {
              currentChunk = word;
              currentTokens = wordTokens;
            }
          }
        }
      }
    }
  }

  // Don't forget the last chunk
  if (currentChunk.trim().length > 0) {
    chunks.push(currentChunk.trim());
  }

  return chunks;
}

/**
 * Get detailed chunking statistics
 */
export function getChunkingStats(text: string, chunks: string[]): ChunkingStats {
  const tokenCounts = chunks.map((chunk) => estimateTokenCount(chunk));
  const maxTokens = tokenCounts.length > 0 ? Math.max(...tokenCounts) : 0;
  const totalTokens = tokenCounts.reduce((sum, tokens) => sum + tokens, 0);
  const avgTokens = chunks.length > 0 ? Math.round(totalTokens / chunks.length) : 0;

  return {
    total_text_length: text.length,
    total_chunks: chunks.length,
    total_tokens: totalTokens,
    largest_chunk_tokens: maxTokens,
    average_chunk_tokens: avgTokens,
    chunks: chunks.map((chunk, index) => ({
      index,
      length: chunk.length,
      tokens: estimateTokenCount(chunk),
    })),
  };
}

/**
 * Validate chunks before insertion
 * Ensures no chunk is empty or malformed
 */
export function validateChunks(chunks: string[]): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!Array.isArray(chunks)) {
    errors.push('Chunks must be an array');
    return { valid: false, errors };
  }

  if (chunks.length === 0) {
    errors.push('No chunks provided');
    return { valid: false, errors };
  }

  chunks.forEach((chunk, index) => {
    if (typeof chunk !== 'string') {
      errors.push(`Chunk ${index}: not a string (type: ${typeof chunk})`);
    } else if (chunk.trim().length === 0) {
      errors.push(`Chunk ${index}: empty or whitespace only`);
    }
  });

  return {
    valid: errors.length === 0,
    errors,
  };
}
