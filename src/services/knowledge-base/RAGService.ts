/**
 * RAG Service (Retrieval-Augmented Generation)
 * Gère la recherche vectorielle et le contexte pour Claude
 */

import { supabase } from '@/lib/supabase';
import type { KBSearchResult, KBChunk } from './types';

export class RAGService {
  private readonly DEFAULT_LIMIT = 5;
  private readonly DEFAULT_THRESHOLD = 0.3;

  /**
   * Rechercher les documents pertinents
   */
  async retrieveRelevant(
    query: string,
    filters?: {
      docType?: string;
      region?: string;
      workTypes?: string[];
    },
    limit: number = this.DEFAULT_LIMIT
  ): Promise<KBSearchResult> {
    try {
      console.log(`🔍 Searching for: "${query}"`);

      // 1. Vectoriser la query
      const queryEmbedding = await this.getQueryEmbedding(query);

      // 2. Recherche vectorielle
      let results = await this.vectorSearch(queryEmbedding, limit);

      // 3. Appliquer les filtres si nécessaire
      if (filters) {
        results = this.applyFilters(results, filters);
      }

      console.log(`✅ Found ${results.chunks.length} relevant chunks`);

      return {
        chunks: results.chunks,
        distances: results.distances,
        totalResults: results.chunks.length,
      };
    } catch (error) {
      console.error('❌ Search error:', error);
      return {
        chunks: [],
        distances: [],
        totalResults: 0,
      };
    }
  }

  /**
   * Rechercher par type de travail
   */
  async searchByWorkType(workType: string, limit = 10): Promise<KBChunk[]> {
    try {
      console.log(`🔧 Searching documents for work type: ${workType}`);

      // Chercher dans les métadatas et keywords
      const { data, error } = await supabase
        .from('knowledge_base_chunks')
        .select()
        .or(`keywords.cs.{"${workType}"}`)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) throw error;

      console.log(`✅ Found ${(data || []).length} documents for ${workType}`);
      return data || [];
    } catch (error) {
      console.error('❌ Work type search error:', error);
      return [];
    }
  }

  /**
   * Rechercher par région
   */
  async searchByRegion(
    region: string,
    workType?: string,
    limit = 10
  ): Promise<KBChunk[]> {
    try {
      console.log(`📍 Searching documents for region: ${region}`);

      let query = supabase
        .from('knowledge_base_chunks')
        .select()
        .filter('metadata', 'eq', `{"region":"${region}"}`);

      if (workType) {
        query = query.or(`keywords.cs.{"${workType}"}`);
      }

      const { data, error } = await query
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) throw error;

      console.log(`✅ Found ${(data || []).length} documents for ${region}`);
      return data || [];
    } catch (error) {
      console.error('❌ Region search error:', error);
      return [];
    }
  }

  /**
   * Recherche vectorielle pure
   */
  private async vectorSearch(
    embedding: number[],
    limit: number
  ): Promise<{ chunks: KBChunk[]; distances: number[] }> {
    try {
      // Convertir l'embedding en format Supabase
      const embeddingStr = `[${embedding.join(',')}]`;

      // Utiliser la fonction de recherche vectorielle
      const { data, error } = await supabase
        .rpc('search_kb_by_similarity', {
          query_embedding: embeddingStr,
          match_count: limit,
          distance_threshold: this.DEFAULT_THRESHOLD,
        });

      if (error) throw error;

      // Calculer les distances basées sur la similarité
      const chunks: KBChunk[] = (data || []).map((d: any) => ({
        id: d.chunk_id,
        docId: d.doc_id,
        sectionId: '', // À récupérer si nécessaire
        content: d.content,
        keywords: [],
        embedding: [],
        metadata: d.metadata || {},
        createdAt: new Date().toISOString(),
      }));

      const distances = (data || []).map((d: any) => 1 - (d.similarity || 0));

      return { chunks, distances };
    } catch (error) {
      console.error('❌ Vector search error:', error);
      return { chunks: [], distances: [] };
    }
  }

  /**
   * Appliquer les filtres aux résultats
   */
  private applyFilters(
    results: { chunks: KBChunk[]; distances: number[] },
    filters: {
      docType?: string;
      region?: string;
      workTypes?: string[];
    }
  ): { chunks: KBChunk[]; distances: number[] } {
    let filtered = results.chunks;

    if (filters.docType) {
      filtered = filtered.filter(
        c => c.metadata?.docType === filters.docType
      );
    }

    if (filters.region) {
      filtered = filtered.filter(
        c => c.metadata?.region === filters.region
      );
    }

    if (filters.workTypes && filters.workTypes.length > 0) {
      filtered = filtered.filter(c => {
        const chunkWorkTypes = c.metadata?.workTypes || [];
        return filters.workTypes!.some(w => chunkWorkTypes.includes(w));
      });
    }

    // Retourner les distances correspondantes
    const indices = results.chunks
      .map((c, i) => i)
      .filter(i => filtered.includes(results.chunks[i]));
    const distances = indices.map(i => results.distances[i]);

    return { chunks: filtered, distances };
  }

  /**
   * Préparer le contexte pour Claude
   */
  formatContextForClaude(
    chunks: KBChunk[],
    title: string = 'Documentation Métier Pertinente'
  ): string {
    if (chunks.length === 0) {
      return 'Aucune documentation métier pertinente trouvée.';
    }

    const formatted = `
## ${title}

${chunks
  .map((chunk, index) => {
    return `### Référence ${index + 1}
${chunk.content}

**Métadonnées:**
- Type: ${chunk.metadata?.docType || 'N/A'}
${chunk.metadata?.region ? `- Région: ${chunk.metadata.region}` : ''}
${chunk.metadata?.workTypes ? `- Travaux: ${chunk.metadata.workTypes.join(', ')}` : ''}
---`;
  })
  .join('\n\n')}
`;

    return formatted;
  }

  /**
   * Effectuer une recherche multi-critères complexe
   */
  async complexSearch(
    query: string,
    projectContext?: {
      workTypes?: string[];
      region?: string;
      projectType?: string;
    }
  ): Promise<KBChunk[]> {
    try {
      console.log(`🔎 Complex search: ${query}`);

      // 1. Recherche vectorielle
      const vectorResults = await this.retrieveRelevant(query, {
        region: projectContext?.region,
        workTypes: projectContext?.workTypes,
      });

      // 2. Recherche par mot-clé supplémentaires
      const additionalKeywords = this.extractKeywords(query);
      let allChunks = [...vectorResults.chunks];

      for (const keyword of additionalKeywords) {
        const keywordResults = await this.searchByWorkType(keyword);
        allChunks = [
          ...allChunks,
          ...keywordResults.filter(
            r => !allChunks.find(c => c.id === r.id)
          ),
        ];
      }

      // 3. Limiter et retourner
      return allChunks.slice(0, 10);
    } catch (error) {
      console.error('❌ Complex search error:', error);
      return [];
    }
  }

  /**
   * Obtenir un embedding pour une query
   */
  private async getQueryEmbedding(text: string): Promise<number[]> {
    try {
      // En production, utiliser Claude embeddings API
      // Pour MVP, simuler avec hash comme dans VectorizationService
      const hash = this.hashString(text);
      const embedding = Array(1536)
        .fill(0)
        .map((_, i) => {
          const seed = (hash + i) % 1000;
          return (Math.sin(seed) + Math.sin(seed * 2) + Math.sin(seed * 3)) / 3;
        });

      return embedding;
    } catch (error) {
      console.error('❌ Query embedding error:', error);
      return Array(1536).fill(0);
    }
  }

  /**
   * Calculer un hash simple
   */
  private hashString(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash;
    }
    return Math.abs(hash);
  }

  /**
   * Extraire les keywords d'une requête
   */
  private extractKeywords(query: string): string[] {
    return query
      .toLowerCase()
      .split(/\s+/)
      .filter(w => w.length > 3)
      .slice(0, 5);
  }

  /**
   * Récupérer les stats de la KB
   */
  async getStats(): Promise<{
    totalDocuments: number;
    totalChunks: number;
    docsByType: Record<string, number>;
  }> {
    try {
      // Compter les documents
      const { count: docCount } = await supabase
        .from('knowledge_base_documents')
        .select('*', { count: 'exact', head: true });

      // Compter les chunks
      const { count: chunkCount } = await supabase
        .from('knowledge_base_chunks')
        .select('*', { count: 'exact', head: true });

      // Compter par type
      const { data: byType } = await supabase
        .from('knowledge_base_documents')
        .select('doc_type');

      const docsByType = (byType || []).reduce(
        (acc, doc) => {
          acc[doc.doc_type] = (acc[doc.doc_type] || 0) + 1;
          return acc;
        },
        {} as Record<string, number>
      );

      return {
        totalDocuments: docCount || 0,
        totalChunks: chunkCount || 0,
        docsByType,
      };
    } catch (error) {
      console.error('❌ Get stats error:', error);
      return { totalDocuments: 0, totalChunks: 0, docsByType: {} };
    }
  }
}

export default new RAGService();
