/**
 * Knowledge Chunker Service v1.0
 * Intelligently splits documents into semantic chunks for RAG
 */

/**
 * Chunk with metadata
 */
export interface KnowledgeChunk {
  content: string;
  tokenCount: number;
  startIndex: number;
  endIndex: number;
}

/**
 * Estimate token count (rough approximation)
 * Actual token counting would use tokenizers
 */
function estimateTokenCount(text: string): number {
  // Rough estimation: 1 token ≈ 4 characters
  // More accurate would use GPT tokenizer
  return Math.ceil(text.length / 4);
}

/**
 * Chunk document using semantic boundaries
 * Strategy:
 * 1. Split by paragraphs first
 * 2. Combine paragraphs until chunk size limit
 * 3. Ensure chunks don't split mid-sentence
 */
export function chunkDocument(
  text: string,
  maxTokensPerChunk: number = 500,
  overlapTokens: number = 50
): KnowledgeChunk[] {
  try {
    console.log('[KnowledgeChunker] Chunking document, max tokens:', maxTokensPerChunk);

    const chunks: KnowledgeChunk[] = [];

    // Split into paragraphs (double newline)
    const paragraphs = text
      .split(/\n\n+/)
      .map((p) => p.trim())
      .filter((p) => p.length > 0);

    console.log('[KnowledgeChunker] Found', paragraphs.length, 'paragraphs');

    let currentChunk = '';
    let currentTokenCount = 0;
    let chunkStartIndex = 0;

    for (let i = 0; i < paragraphs.length; i++) {
      const paragraph = paragraphs[i];
      const paragraphTokens = estimateTokenCount(paragraph);

      // If adding this paragraph exceeds limit and we have content, save chunk
      if (
        currentTokenCount + paragraphTokens > maxTokensPerChunk &&
        currentChunk.length > 0
      ) {
        chunks.push({
          content: currentChunk.trim(),
          tokenCount: currentTokenCount,
          startIndex: chunkStartIndex,
          endIndex: chunkStartIndex + currentChunk.length,
        });

        // Add overlap from end of current chunk
        const overlapText = currentChunk.split(/[.!?]/).slice(-2).join('. ');
        const overlapTokens = estimateTokenCount(overlapText);

        currentChunk = overlapText + ' ';
        currentTokenCount = overlapTokens;
        chunkStartIndex = Math.max(0, chunkStartIndex + currentChunk.length - overlapText.length);
      }

      // Add paragraph to current chunk
      currentChunk += (currentChunk.length > 0 ? '\n\n' : '') + paragraph;
      currentTokenCount += paragraphTokens;
    }

    // Add remaining content
    if (currentChunk.trim().length > 0) {
      chunks.push({
        content: currentChunk.trim(),
        tokenCount: currentTokenCount,
        startIndex: chunkStartIndex,
        endIndex: chunkStartIndex + currentChunk.length,
      });
    }

    console.log('[KnowledgeChunker] Created', chunks.length, 'chunks');

    // Log chunk statistics
    const avgTokens = chunks.length > 0
      ? Math.round(chunks.reduce((sum, c) => sum + c.tokenCount, 0) / chunks.length)
      : 0;

    console.log('[KnowledgeChunker] Avg tokens per chunk:', avgTokens);

    return chunks;
  } catch (error) {
    console.error('[KnowledgeChunker] Chunking failed:', error);
    // Fallback: split by fixed size
    return fallbackChunk(text, maxTokensPerChunk);
  }
}

/**
 * Fallback chunking by fixed size
 */
function fallbackChunk(text: string, maxTokensPerChunk: number): KnowledgeChunk[] {
  const chunks: KnowledgeChunk[] = [];
  const maxChars = maxTokensPerChunk * 4; // Rough conversion

  let currentIndex = 0;

  while (currentIndex < text.length) {
    let endIndex = Math.min(currentIndex + maxChars, text.length);

    // Try to find sentence boundary
    const lastPeriod = text.lastIndexOf('.', endIndex);
    if (lastPeriod > currentIndex && lastPeriod > endIndex - maxChars * 0.2) {
      endIndex = lastPeriod + 1;
    }

    const chunk = text.substring(currentIndex, endIndex).trim();
    if (chunk.length > 0) {
      chunks.push({
        content: chunk,
        tokenCount: estimateTokenCount(chunk),
        startIndex: currentIndex,
        endIndex: endIndex,
      });
    }

    currentIndex = endIndex;
  }

  return chunks;
}

/**
 * Estimate document reading time
 */
export function estimateReadingTime(text: string): number {
  // Average reading speed: 200 words per minute
  const wordCount = text.split(/\s+/).length;
  return Math.ceil(wordCount / 200);
}

/**
 * Extract key terms from text (simple TF-IDF approximation)
 */
export function extractKeyTerms(text: string, limit: number = 10): string[] {
  try {
    // Split into words and normalize
    const words = text
      .toLowerCase()
      .replace(/[^\w\s]/g, '')
      .split(/\s+/)
      .filter((w) => w.length > 3);

    // Count frequencies
    const frequencies: Record<string, number> = {};
    words.forEach((word) => {
      frequencies[word] = (frequencies[word] || 0) + 1;
    });

    // Sort by frequency and return top N
    return Object.entries(frequencies)
      .sort((a, b) => b[1] - a[1])
      .slice(0, limit)
      .map((entry) => entry[0]);
  } catch (error) {
    console.warn('[KnowledgeChunker] Failed to extract key terms:', error);
    return [];
  }
}

/**
 * Validate chunk quality
 */
export function validateChunk(chunk: KnowledgeChunk): { valid: boolean; issues: string[] } {
  const issues: string[] = [];

  if (chunk.content.length < 50) {
    issues.push('Chunk too short (< 50 characters)');
  }

  if (chunk.content.length > 5000) {
    issues.push('Chunk too long (> 5000 characters)');
  }

  if (chunk.tokenCount < 10) {
    issues.push('Chunk too sparse (< 10 tokens)');
  }

  if (chunk.tokenCount > 1000) {
    issues.push('Chunk too dense (> 1000 tokens)');
  }

  // Check for incomplete sentences
  if (
    !chunk.content.endsWith('.') &&
    !chunk.content.endsWith('!') &&
    !chunk.content.endsWith('?')
  ) {
    issues.push('Chunk may end mid-sentence');
  }

  return {
    valid: issues.length === 0,
    issues,
  };
}
