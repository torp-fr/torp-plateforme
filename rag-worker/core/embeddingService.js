import { OpenAI } from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const EMBEDDING_DIMENSION = 384;
const BATCH_SIZE = 20; // Process embeddings in batches

// Maximum characters allowed for embedding input.
// Matches smartChunker target size (~2800 chars).
// Prevents unnecessary trimming of valid chunks.
const MAX_EMBEDDING_CHARS = 4000;

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

    console.log(`[EmbeddingService] Processing batch of ${safeTexts.length} chunks`);

    const response = await openai.embeddings.create({
      model: "text-embedding-3-small",
      input: safeTexts,
      dimensions: EMBEDDING_DIMENSION,
    });

    const embeddings = response.data.map((item) => item.embedding);

    // Validate all embeddings
    for (let i = 0; i < embeddings.length; i++) {
      if (embeddings[i].length !== EMBEDDING_DIMENSION) {
        throw new Error(
          `Embedding ${i} has invalid dimension: ${embeddings[i].length} (expected ${EMBEDDING_DIMENSION})`
        );
      }
    }

    return embeddings;
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
