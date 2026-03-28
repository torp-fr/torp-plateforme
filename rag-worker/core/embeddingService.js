import { OpenAI } from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const EMBEDDING_DIMENSION = 384;
// Max chunks per OpenAI request. 200 chunks × ~900 tokens = ~180k tokens,
// safely below the 300k token limit per request.
const BATCH_SIZE = 200;

// Maximum characters allowed for embedding input.
// Matches smartChunker target size (~2800 chars).
// Prevents unnecessary trimming of valid chunks.
const MAX_EMBEDDING_CHARS = 4000;

/**
 * Send a single batch of texts to OpenAI and return their embeddings.
 * @param {string[]} batch - Pre-validated texts, max BATCH_SIZE items
 * @returns {Promise<number[][]>}
 */
async function processBatch(batch) {
  const response = await openai.embeddings.create({
    model: "text-embedding-3-small",
    input: batch,
    dimensions: EMBEDDING_DIMENSION,
  });

  const embeddings = response.data.map((item) => item.embedding);

  for (let i = 0; i < embeddings.length; i++) {
    if (embeddings[i].length !== EMBEDDING_DIMENSION) {
      throw new Error(
        `Embedding ${i} has invalid dimension: ${embeddings[i].length} (expected ${EMBEDDING_DIMENSION})`
      );
    }
  }

  return embeddings;
}

export async function generateBatchEmbeddings(texts) {
  try {
    if (!texts || texts.length === 0) {
      throw new Error("No texts provided for embedding");
    }

    // Defensive trim: ensure no individual text exceeds the embedding limit
    const safeTexts = texts.map((text, i) => {
      if (text.length > MAX_EMBEDDING_CHARS) {
        console.warn(
          `[EmbeddingService] Chunk ${i} too large (${text.length} chars), trimming to ${MAX_EMBEDDING_CHARS}`
        );
        return text.slice(0, MAX_EMBEDDING_CHARS);
      }
      return text;
    });

    const totalBatches = Math.ceil(safeTexts.length / BATCH_SIZE);
    console.log(`[EmbeddingService] Processing ${safeTexts.length} chunks in ${totalBatches} batch(es) of ${BATCH_SIZE}`);

    const allEmbeddings = [];

    for (let i = 0; i < safeTexts.length; i += BATCH_SIZE) {
      const batch = safeTexts.slice(i, i + BATCH_SIZE);
      console.log(`[Embedding] Processing batch ${Math.floor(i / BATCH_SIZE) + 1}/${totalBatches} (${batch.length} chunks)`);
      const batchEmbeddings = await processBatch(batch);
      allEmbeddings.push(...batchEmbeddings);
    }

    return allEmbeddings;
  } catch (error) {
    throw new Error(`Embedding generation failed: ${error.message}`);
  }
}

export async function generateSingleEmbedding(text) {
  try {
    const [embedding] = await generateBatchEmbeddings([text]);
    return embedding;
  } catch (error) {
    throw new Error(`Single embedding failed: ${error.message}`);
  }
}

export function validateEmbeddingDimension(embedding) {
  if (!Array.isArray(embedding)) {
    return false;
  }
  return embedding.length === EMBEDDING_DIMENSION;
}
