/**
 * Context Compression Service
 * Compresses retrieved chunks to reduce token usage and improve answer quality.
 * Uses LLM-based extraction to preserve only query-relevant information.
 */

import { log, error, warn } from '@/lib/logger';

export interface CompressibleChunk {
  content: string;
  [key: string]: any;
}

/**
 * Compress retrieved chunks using LLM-based extraction.
 * Extracts only information relevant to the query while preserving key facts.
 *
 * @param query - The original search query
 * @param chunks - Chunks to compress
 * @returns Array of compressed chunk contents
 */
export async function compressContext(
  query: string,
  chunks: CompressibleChunk[]
): Promise<string[]> {
  // Check if compression is enabled
  const compressionEnabled = process.env.ENABLE_CONTEXT_COMPRESSION === 'true';
  if (!compressionEnabled) {
    log('[ContextCompression] Compression disabled, returning original chunks');
    return chunks.map(c => c.content);
  }

  try {
    const { openai } = await import('@/lib/openai');
    const compressed: string[] = [];

    for (const chunk of chunks) {
      try {
        const prompt = `Query: ${query}

Context:
${chunk.content}

Extract only the information relevant to the query. Return a concise version preserving key facts and avoiding redundancy.`;

        const response = await openai.chat.completions.create({
          model: 'gpt-4o-mini',
          messages: [
            {
              role: 'user',
              content: prompt,
            },
          ],
          temperature: 0,
          max_tokens: 500,
        });

        const compressedContent = response.choices[0]?.message?.content;
        if (!compressedContent) {
          warn('[ContextCompression] Empty response from LLM, using original chunk');
          compressed.push(chunk.content);
        } else {
          log('[ContextCompression] Compressed chunk:', {
            originalLength: chunk.content.length,
            compressedLength: compressedContent.length,
            ratio: ((compressedContent.length / chunk.content.length) * 100).toFixed(1) + '%',
          });
          compressed.push(compressedContent);
        }
      } catch (chunkError) {
        error('[ContextCompression] Failed to compress individual chunk:', chunkError);
        compressed.push(chunk.content);
      }
    }

    log('[ContextCompression] Compression complete:', {
      chunksCompressed: compressed.length,
      totalOriginalLength: chunks.reduce((sum, c) => sum + c.content.length, 0),
      totalCompressedLength: compressed.reduce((sum, c) => sum + c.length, 0),
    });

    return compressed;
  } catch (err) {
    error('[ContextCompression] Compression pipeline failed, returning original chunks:', err);
    // Graceful fallback: return original chunks if compression fails
    return chunks.map(c => c.content);
  }
}
