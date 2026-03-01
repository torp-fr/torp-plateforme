import { supabase } from "./supabaseClient.js";
import { generateSingleEmbedding } from "./embeddingService.js";

const EMBEDDING_DIMENSION = 1536;
const DEFAULT_MATCH_COUNT = 10;

async function searchKnowledgeExpert(query, options = {}) {
  const { matchCount = DEFAULT_MATCH_COUNT, filterCategory = null, filterMetier = null } = options;

  console.log(`🔍 Searching knowledge base for: "${query}"`);

  try {
    if (!query || query.trim().length === 0) {
      throw new Error("Query cannot be empty");
    }

    console.log(`  📊 Generating query embedding...`);
    const queryEmbedding = await generateSingleEmbedding(query);

    if (!Array.isArray(queryEmbedding) || queryEmbedding.length !== EMBEDDING_DIMENSION) {
      throw new Error(
        `Invalid embedding dimension: ${queryEmbedding?.length || 0} (expected ${EMBEDDING_DIMENSION})`
      );
    }

    console.log(`  ✅ Embedding generated (${EMBEDDING_DIMENSION}-dim)`);

    const rpcParams = {
      query_embedding: queryEmbedding,
      match_count: matchCount,
    };

    if (filterCategory) {
      rpcParams.filter_category = filterCategory;
      console.log(`  🏷️ Filter by category: ${filterCategory}`);
    }

    if (filterMetier) {
      rpcParams.filter_metier = filterMetier;
      console.log(`  🎯 Filter by metier: ${filterMetier}`);
    }

    console.log(`  🚀 Calling RPC search_knowledge_expert...`);
    const { data, error } = await supabase.rpc("search_knowledge_expert", rpcParams);

    if (error) {
      throw new Error(`RPC execution failed: ${error.message}`);
    }

    if (!Array.isArray(data)) {
      throw new Error("RPC returned invalid data format");
    }

    const sortedResults = data.sort((a, b) => (b.final_score || 0) - (a.final_score || 0));

    console.log(`  ✅ Found ${sortedResults.length} relevant chunks`);

    if (sortedResults.length > 0) {
      const topResult = sortedResults[0];
      console.log(`  📌 Top result score: ${topResult.final_score?.toFixed(4) || "N/A"}`);
    }

    return {
      query,
      embedding: queryEmbedding,
      filters: {
        category: filterCategory,
        metier: filterMetier,
      },
      results: sortedResults,
      count: sortedResults.length,
    };
  } catch (error) {
    console.error(`❌ Knowledge search failed: ${error.message}`);
    throw new Error(`Knowledge expert search error: ${error.message}`);
  }
}

async function searchKnowledgeByCategory(query, category, options = {}) {
  return searchKnowledgeExpert(query, {
    ...options,
    filterCategory: category,
  });
}

async function searchKnowledgeByMetier(query, metier, options = {}) {
  return searchKnowledgeExpert(query, {
    ...options,
    filterMetier: metier,
  });
}

async function searchKnowledgeFiltered(query, category, metier, options = {}) {
  return searchKnowledgeExpert(query, {
    ...options,
    filterCategory: category,
    filterMetier: metier,
  });
}

export {
  searchKnowledgeExpert,
  searchKnowledgeByCategory,
  searchKnowledgeByMetier,
  searchKnowledgeFiltered,
};
