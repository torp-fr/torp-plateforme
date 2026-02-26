/**
 * Vectorization Service
 * Gère l'OCR, la structuration et la vectorisation des documents
 */

import { supabase } from '@/lib/supabase';
import type { KBChunk, ProcessedDocument, VectorizationResult } from './types';
import { log, warn, error, time, timeEnd } from '@/lib/logger';

export class VectorizationService {
  private readonly CHUNK_SIZE = 500; // tokens par chunk
  private readonly CHUNK_OVERLAP = 50; // overlap entre chunks

  /**
   * Vectoriser un document complet
   */
  async vectorizeDocument(docId: string): Promise<VectorizationResult> {
    try {
      log(`🔄 Starting vectorization for document: ${docId}`);

      // 1. Récupérer le document
      const { data: docData, error: docError } = await supabase
        .from('knowledge_base_documents')
        .select()
        .eq('id', docId)
        .single();

      if (docError) throw docError;
      if (!docData) throw new Error('Document not found');

      // 2. Marquer comme "processing"
      await supabase
        .from('knowledge_base_documents')
        .update({ status: 'processing' })
        .eq('id', docId);

      // 3. Extraire le texte (OCR) - Pour maintenant, on simule
      // En production: utiliser Tesseract.js ou Claude Vision
      const extractedText = await this.extractTextFromDocument(docData);

      // 4. Structurer le contenu
      const structured = await this.structureContent(extractedText);

      // 5. Chunker le contenu
      const chunks = this.chunkContent(structured);

      // 6. Vectoriser chaque chunk
      let vectorizedCount = 0;
      for (const chunk of chunks) {
        const embedding = await this.getEmbedding(chunk.content);

        // Insérer dans la DB
        const { error: insertError } = await supabase
          .from('knowledge_base_chunks')
          .insert({
            doc_id: docId,
            section_id: chunk.sectionId,
            content: chunk.content,
            keywords: chunk.keywords,
            embedding: embedding,
            metadata: {
              ...docData.metadata,
              pageNumber: chunk.pageNumber,
            },
          });

        if (insertError) {
          console.error(`❌ Error inserting chunk: ${insertError}`);
          continue;
        }

        vectorizedCount++;
      }

      // 7. Marquer comme "vectorized"
      await supabase
        .from('knowledge_base_documents')
        .update({
          status: 'vectorized',
          updated_at: new Date().toISOString(),
        })
        .eq('id', docId);

      log(`✅ Vectorization complete: ${vectorizedCount} chunks created`);

      return {
        docId,
        chunksCreated: vectorizedCount,
        totalTokens: chunks.reduce((sum, c) => sum + this.estimateTokens(c.content), 0),
        status: 'success',
      };
    } catch (error) {
      console.error('❌ Vectorization error:', error);

      // Marquer comme erreur
      await supabase
        .from('knowledge_base_documents')
        .update({ status: 'raw' })
        .eq('id', docId)
        .catch(e => console.error('Error updating status:', e));

      return {
        docId,
        chunksCreated: 0,
        totalTokens: 0,
        status: 'error',
        error: String(error),
      };
    }
  }

  /**
   * Extraire le texte d'un document
   * Note: Pour MVP, on simule. En production: OCR + Vision
   */
  private async extractTextFromDocument(doc: any): Promise<string> {
    try {
      // En production, télécharger le fichier et faire OCR
      // Pour MVP, retourner un texte simulé
      log(`📄 Extracting text from: ${doc.source_file}`);

      // Simuler l'extraction
      return `
Document: ${doc.title}
Type: ${doc.doc_type}

[CONTENU EXTRAIT PAR OCR]

Ceci est un simulateur pour MVP. En production:
1. Télécharger le fichier depuis Supabase Storage
2. Utiliser Tesseract.js pour OCR (client)
3. Utiliser Claude Vision pour images
4. Retourner le texte structuré

Contenu de démonstration du document.
      `;
    } catch (error) {
      console.error('❌ Text extraction error:', error);
      throw error;
    }
  }

  /**
   * Structurer le contenu en sections
   */
  private async structureContent(text: string): Promise<ProcessedDocument> {
    try {
      // Appel Claude pour structurer automatiquement
      // Pour MVP, on simule une structure simple
      const sections = text
        .split(/\n\n+/)
        .filter(s => s.trim().length > 0)
        .map((content, index) => ({
          sectionId: `section_${index}`,
          title: `Section ${index}`,
          content: content.trim(),
          keywords: this.extractKeywords(content),
          metadata: {},
        }));

      return {
        docId: 'temp',
        title: 'Structured Document',
        docType: 'guide',
        sections,
      };
    } catch (error) {
      console.error('❌ Structuring error:', error);
      throw error;
    }
  }

  /**
   * Chunker le contenu en segments
   */
  private chunkContent(doc: ProcessedDocument): {
    sectionId: string;
    content: string;
    keywords: string[];
    pageNumber?: number;
  }[] {
    const chunks = [];

    for (const section of doc.sections) {
      const words = section.content.split(/\s+/);
      let currentChunk = '';
      let chunkCount = 0;

      for (const word of words) {
        const testChunk = currentChunk ? `${currentChunk} ${word}` : word;
        const tokenCount = this.estimateTokens(testChunk);

        if (tokenCount > this.CHUNK_SIZE && currentChunk) {
          // Créer un chunk
          chunks.push({
            sectionId: `${section.sectionId}_chunk_${chunkCount}`,
            content: currentChunk,
            keywords: section.keywords,
          });

          // Commencer un nouveau chunk avec overlap
          const overlapWords = currentChunk
            .split(/\s+/)
            .slice(-this.CHUNK_OVERLAP);
          currentChunk = overlapWords.join(' ');
          chunkCount++;
        } else {
          currentChunk = testChunk;
        }
      }

      // Ajouter le dernier chunk
      if (currentChunk.trim()) {
        chunks.push({
          sectionId: `${section.sectionId}_chunk_${chunkCount}`,
          content: currentChunk,
          keywords: section.keywords,
        });
      }
    }

    return chunks;
  }

  /**
   * Extraire les keywords d'un texte
   */
  private extractKeywords(text: string): string[] {
    // Simple extraction: prendre les mots > 5 caractères
    const words = text
      .toLowerCase()
      .split(/\s+/)
      .filter(w => w.length > 5 && !this.isStopword(w));

    // Retourner les top 10 mots uniques
    return [...new Set(words)].slice(0, 10);
  }

  /**
   * Vérifier si un mot est un stopword
   */
  private isStopword(word: string): boolean {
    const stopwords = [
      'le', 'la', 'les', 'de', 'des', 'un', 'une', 'et', 'ou', 'mais', 'donc',
      'car', 'a', 'pour', 'par', 'avec', 'sans', 'dans', 'sur', 'sous', 'entre',
      'avant', 'apres', 'pendant', 'depuis', 'vers', 'jusqu', 'pres', 'loin',
    ];
    return stopwords.includes(word);
  }

  /**
   * Obtenir un embedding pour un texte
   * Utilise Claude API
   */
  private async getEmbedding(text: string): Promise<number[]> {
    try {
      // Pour MVP, retourner un embedding simulé de 1536 dimensions
      // En production: utiliser Claude embeddings API
      // const response = await fetch('https://api.anthropic.com/v1/embeddings', {
      //   method: 'POST',
      //   headers: {
      //     'x-api-key': process.env.CLAUDE_API_KEY,
      //     'content-type': 'application/json',
      //   },
      //   body: JSON.stringify({
      //     model: 'claude-3-5-sonnet-20241022',
      //     input: text,
      //   }),
      // });

      // Simuler un embedding pour MVP
      const hash = this.hashString(text);
      const embedding = Array(1536)
        .fill(0)
        .map((_, i) => {
          const seed = (hash + i) % 1000;
          return (Math.sin(seed) + Math.sin(seed * 2) + Math.sin(seed * 3)) / 3;
        });

      return embedding;
    } catch (error) {
      console.error('❌ Embedding error:', error);
      // Retourner un embedding par défaut en cas d'erreur
      return Array(1536).fill(0);
    }
  }

  /**
   * Calculer un hash simple pour simulation d'embedding
   */
  private hashString(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return Math.abs(hash);
  }

  /**
   * Estimer le nombre de tokens
   */
  private estimateTokens(text: string): number {
    // Approximation simple: 1 token ≈ 4 caractères
    return Math.ceil(text.length / 4);
  }

  /**
   * Récupérer les chunks d'un document
   */
  async getDocumentChunks(docId: string): Promise<KBChunk[]> {
    try {
      const { data, error } = await supabase
        .from('knowledge_base_chunks')
        .select()
        .eq('doc_id', docId)
        .order('created_at', { ascending: true });

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('❌ Get chunks error:', error);
      throw error;
    }
  }

  /**
   * Supprimer tous les chunks d'un document
   */
  async deleteDocumentChunks(docId: string): Promise<void> {
    try {
      const { error } = await supabase
        .from('knowledge_base_chunks')
        .delete()
        .eq('doc_id', docId);

      if (error) throw error;
      log(`✅ Deleted chunks for document: ${docId}`);
    } catch (error) {
      console.error('❌ Delete chunks error:', error);
      throw error;
    }
  }
}

export default new VectorizationService();
