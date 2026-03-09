/**
 * Knowledge Integrity Service
 * Validates and reports on knowledge document and chunk quality
 * DOES NOT modify existing indexing or chunking logic
 */

import { supabase } from '@/lib/supabase';
import { log, warn, error } from '@/lib/logger';
import type {
  DocumentIntegrityReport,
  ChunkIntegrityReport,
  IntegrityCheckResult,
  IntegrityCheckConfig,
  ChunkDataForIntegrity,
  DocumentDataForIntegrity,
} from './knowledgeIntegrity.types';

/**
 * Default configuration for integrity checks
 */
const DEFAULT_CONFIG: IntegrityCheckConfig = {
  minChunkContentLength: 50,
  maxChunkContentLength: 5000,
  minTokenCount: 10,
  maxTokenCount: 1000,
  requireAllChunksEmbedded: true,
  minIntegrityScoreForPublishing: 0.7,
  checkEmbeddingConsistency: true,
};

/**
 * Verify integrity of all chunks in a document
 * Called AFTER embedding generation is complete
 */
export async function verifyDocumentIntegrity(
  documentId: string,
  config: IntegrityCheckConfig = DEFAULT_CONFIG
): Promise<IntegrityCheckResult> {
  try {
    log('[KnowledgeIntegrity] Starting integrity verification for document:', documentId);

    const mergedConfig = { ...DEFAULT_CONFIG, ...config };

    // Fetch document and all its chunks
    const { data: docData, error: docError } = await supabase
      .from('knowledge_documents')
      .select('id, title, category, source, created_at')
      .eq('id', documentId)
      .single();

    if (docError || !docData) {
      const errorMsg = `Failed to fetch document: ${docError?.message || 'Unknown error'}`;
      console.error('[KnowledgeIntegrity]', errorMsg);
      return {
        documentId,
        success: false,
        report: createEmptyReport(documentId),
        error: errorMsg,
      };
    }

    // Fetch all chunks for this document
    const { data: chunksData, error: chunksError } = await supabase
      .from('knowledge_chunks')
      .select('id, document_id, content, chunk_index, token_count, embedding_vector')
      .eq('document_id', documentId)
      .order('chunk_index', { ascending: true });

    if (chunksError || !chunksData) {
      const errorMsg = `Failed to fetch chunks: ${chunksError?.message || 'Unknown error'}`;
      console.error('[KnowledgeIntegrity]', errorMsg);
      return {
        documentId,
        success: false,
        report: createEmptyReport(documentId),
        error: errorMsg,
      };
    }

    // Verify each chunk
    const chunkReports: ChunkIntegrityReport[] = [];
    let validChunks = 0;
    let chunksWithEmbeddings = 0;
    let totalTokens = 0;
    let totalContentLength = 0;
    const embeddingDimensions: number[] = [];

    for (const chunk of chunksData) {
      const chunkReport = verifyChunkIntegrity(chunk, mergedConfig);
      chunkReports.push(chunkReport);

      if (chunkReport.isValid) {
        validChunks++;
      }

      if (chunkReport.hasEmbedding) {
        chunksWithEmbeddings++;
        if (chunkReport.embeddingDimension) {
          embeddingDimensions.push(chunkReport.embeddingDimension);
        }
      }

      totalTokens += chunk.token_count || 0;
      totalContentLength += chunk.content?.length || 0;
    }

    // Calculate metrics
    const averageChunkLength = chunksData.length > 0 ? totalContentLength / chunksData.length : 0;
    const embeddingConsistency = calculateEmbeddingConsistency(embeddingDimensions);
    const contentQuality = calculateContentQuality(chunkReports, mergedConfig);
    const integrityScore = calculateIntegrityScore(
      validChunks,
      chunksData.length,
      chunksWithEmbeddings,
      embeddingConsistency,
      contentQuality,
      mergedConfig
    );

    // Determine if publishable
    const criticalIssues = chunkReports.filter((r) => r.issues.length > 0);
    const isPublishable =
      integrityScore >= (mergedConfig.minIntegrityScoreForPublishing || 0.7) &&
      criticalIssues.length === 0;

    const report: DocumentIntegrityReport = {
      documentId,
      totalChunks: chunksData.length,
      validChunks,
      invalidChunks: chunksData.length - validChunks,
      chunksWithEmbeddings,
      chunksWithoutEmbeddings: chunksData.length - chunksWithEmbeddings,
      averageChunkLength: Math.round(averageChunkLength),
      totalTokens,
      embeddingConsistency,
      contentQuality,
      integrityScore,
      issues: collectIssues(chunkReports),
      chunkReports,
      timestamp: new Date().toISOString(),
      isPublishable,
    };

    log('[KnowledgeIntegrity] Integrity verification complete');
    log('[KnowledgeIntegrity] Score:', integrityScore, '| Publishable:', isPublishable);

    return {
      documentId,
      success: true,
      report,
    };
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : 'Unknown error';
    console.error('[KnowledgeIntegrity] Verification failed:', errorMsg);
    return {
      documentId,
      success: false,
      report: createEmptyReport(documentId),
      error: errorMsg,
    };
  }
}

/**
 * Verify integrity of a single chunk
 */
function verifyChunkIntegrity(
  chunk: ChunkDataForIntegrity,
  config: IntegrityCheckConfig
): ChunkIntegrityReport {
  const issues: string[] = [];
  const contentLength = chunk.content?.length || 0;
  const tokenCount = chunk.token_count || 0;
  const hasEmbedding = !!chunk.embedding_vector && chunk.embedding_vector.length > 0;
  const embeddingDimension = hasEmbedding ? chunk.embedding_vector!.length : undefined;

  // Check content length
  if (contentLength < (config.minChunkContentLength || 50)) {
    issues.push(
      `Content too short: ${contentLength} chars (min: ${config.minChunkContentLength})`
    );
  }

  if (contentLength > (config.maxChunkContentLength || 5000)) {
    issues.push(
      `Content too long: ${contentLength} chars (max: ${config.maxChunkContentLength})`
    );
  }

  // Check token count
  if (tokenCount < (config.minTokenCount || 10)) {
    issues.push(`Token count too low: ${tokenCount} (min: ${config.minTokenCount})`);
  }

  if (tokenCount > (config.maxTokenCount || 1000)) {
    issues.push(`Token count too high: ${tokenCount} (max: ${config.maxTokenCount})`);
  }

  // Check embedding
  if (config.requireAllChunksEmbedded && !hasEmbedding) {
    issues.push('Missing embedding');
  }

  // Check for suspicious patterns
  if (!hasEmbedding && contentLength > 500) {
    issues.push('Large chunk without embedding');
  }

  return {
    chunkId: chunk.id,
    chunkIndex: chunk.chunk_index,
    contentLength,
    tokenCount,
    hasEmbedding,
    embeddingDimension,
    issues,
    isValid: issues.length === 0,
  };
}

/**
 * Calculate embedding consistency (all embeddings have same dimension)
 */
function calculateEmbeddingConsistency(dimensions: number[]): number {
  if (dimensions.length === 0) return 0;

  const uniqueDimensions = new Set(dimensions);
  if (uniqueDimensions.size === 1) return 1;

  // Penalize for inconsistency
  return 1 - uniqueDimensions.size / dimensions.length;
}

/**
 * Calculate content quality score based on chunk reports
 */
function calculateContentQuality(reports: ChunkIntegrityReport[], config: IntegrityCheckConfig): number {
  if (reports.length === 0) return 0;

  let qualityScore = 0;

  // Check chunk validity
  const validPercentage = reports.filter((r) => r.isValid).length / reports.length;
  qualityScore += validPercentage * 0.4; // 40% weight on validity

  // Check token count distribution
  const avgTokens = reports.reduce((sum, r) => sum + r.tokenCount, 0) / reports.length;
  const tokenCountScore =
    avgTokens > (config.minTokenCount || 10) && avgTokens < (config.maxTokenCount || 1000) ? 1 : 0.5;
  qualityScore += tokenCountScore * 0.3; // 30% weight on token count

  // Check content length distribution
  const avgLength = reports.reduce((sum, r) => sum + r.contentLength, 0) / reports.length;
  const contentLengthScore =
    avgLength > (config.minChunkContentLength || 50) &&
    avgLength < (config.maxChunkContentLength || 5000)
      ? 1
      : 0.5;
  qualityScore += contentLengthScore * 0.3; // 30% weight on content length

  return Math.min(qualityScore, 1);
}

/**
 * Calculate overall integrity score
 */
function calculateIntegrityScore(
  validChunks: number,
  totalChunks: number,
  chunksWithEmbeddings: number,
  embeddingConsistency: number,
  contentQuality: number,
  config: IntegrityCheckConfig
): number {
  if (totalChunks === 0) return 0;

  let score = 0;

  // Validity weight: 40%
  const validityScore = validChunks / totalChunks;
  score += validityScore * 0.4;

  // Embedding coverage weight: 30%
  const embeddingCoverage = chunksWithEmbeddings / totalChunks;
  score += embeddingCoverage * 0.3;

  // Embedding consistency weight: 15%
  score += embeddingConsistency * 0.15;

  // Content quality weight: 15%
  score += contentQuality * 0.15;

  return Math.min(Math.max(score, 0), 1); // Clamp between 0 and 1
}

/**
 * Collect all issues from chunk reports
 */
function collectIssues(chunkReports: ChunkIntegrityReport[]): string[] {
  const issues: string[] = [];

  for (const report of chunkReports) {
    if (report.issues.length > 0) {
      issues.push(`Chunk ${report.chunkIndex}: ${report.issues.join('; ')}`);
    }
  }

  return issues;
}

/**
 * Create empty report (used for errors)
 */
function createEmptyReport(documentId: string): DocumentIntegrityReport {
  return {
    documentId,
    totalChunks: 0,
    validChunks: 0,
    invalidChunks: 0,
    chunksWithEmbeddings: 0,
    chunksWithoutEmbeddings: 0,
    averageChunkLength: 0,
    totalTokens: 0,
    embeddingConsistency: 0,
    contentQuality: 0,
    integrityScore: 0,
    issues: ['Integrity verification failed'],
    chunkReports: [],
    timestamp: new Date().toISOString(),
    isPublishable: false,
  };
}

/**
 * Persist integrity report to database
 * Updates knowledge_documents table with integrity metadata
 */
export async function persistIntegrityReport(
  documentId: string,
  report: DocumentIntegrityReport
): Promise<boolean> {
  // integrity updates disabled in ingestion runtime
  // knowledge_documents writes are forbidden from ingestion services
  log('[KnowledgeIntegrity] persistIntegrityReport: NOOP (writes to knowledge_documents disabled)');
  return true;
}

/**
 * Verify and persist integrity in one call (convenience function)
 */
export async function verifyAndPersistIntegrity(
  documentId: string,
  config?: IntegrityCheckConfig
): Promise<IntegrityCheckResult> {
  const result = await verifyDocumentIntegrity(documentId, config);

  if (result.success) {
    const persisted = await persistIntegrityReport(documentId, result.report);
    if (!persisted) {
      warn('[KnowledgeIntegrity] Report generated but failed to persist');
    }
  }

  return result;
}
