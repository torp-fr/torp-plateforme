/**
 * Knowledge Integrity Service Types
 * Validates and reports on knowledge document and chunk quality
 */

/**
 * Integrity check for a single chunk
 */
export interface ChunkIntegrityReport {
  chunkId: string;
  chunkIndex: number;
  contentLength: number;
  tokenCount: number;
  hasEmbedding: boolean;
  embeddingDimension?: number;
  issues: string[];
  isValid: boolean;
}

/**
 * Complete integrity report for a document
 */
export interface DocumentIntegrityReport {
  documentId: string;
  totalChunks: number;
  validChunks: number;
  invalidChunks: number;
  chunksWithEmbeddings: number;
  chunksWithoutEmbeddings: number;
  averageChunkLength: number;
  totalTokens: number;
  embeddingConsistency: number; // 0-1, how consistent embedding dimensions are
  contentQuality: number; // 0-1 based on various checks
  integrityScore: number; // 0-1 overall score
  issues: string[];
  chunkReports: ChunkIntegrityReport[];
  timestamp: string;
  isPublishable: boolean; // true if score >= 0.7 and no critical issues
}

/**
 * Summary of integrity check results
 */
export interface IntegrityCheckResult {
  documentId: string;
  success: boolean;
  report: DocumentIntegrityReport;
  error?: string;
}

/**
 * Configuration for integrity checks
 */
export interface IntegrityCheckConfig {
  minChunkContentLength?: number; // Default: 50 chars
  maxChunkContentLength?: number; // Default: 5000 chars
  minTokenCount?: number; // Default: 10 tokens
  maxTokenCount?: number; // Default: 1000 tokens
  requireAllChunksEmbedded?: boolean; // Default: true
  minIntegrityScoreForPublishing?: number; // Default: 0.7
  checkEmbeddingConsistency?: boolean; // Default: true
}

/**
 * Chunk data for integrity verification
 */
export interface ChunkDataForIntegrity {
  id: string;
  document_id: string;
  content: string;
  chunk_index: number;
  token_count: number;
  embedding?: number[];
}

/**
 * Document data for integrity verification
 */
export interface DocumentDataForIntegrity {
  id: string;
  title: string;
  category: string;
  source: string;
  created_at: string;
  chunks: ChunkDataForIntegrity[];
}
