import { OpenAI } from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const EMBEDDING_DIMENSION = 1536;
const BATCH_SIZE = 10; // Process embeddings in batches

export async function generateBatchEmbeddings(texts) {
  try {
    if (!texts || texts.length === 0) {
      throw new Error("No texts provided for embedding");
    }

    const response = await openai.embeddings.create({
      model: "text-embedding-3-small",
      input: texts,
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
