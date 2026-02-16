/**
 * Doctrine Document Ingestion Service (Phase 30)
 * Handles ingestion of real-world doctrine documents (DTU, norms, guides, case law)
 * Orchestrates normalization, classification, and storage
 */

import { supabase } from '@/lib/supabase';
import { normalizeDoctrineDocument, type NormalizedDocument } from './doctrineNormalization.service';
import { getDoctrineSource, type DoctrineSource } from './doctrineSourceRegistry';

export interface DoctrineDocumentMetadata {
  sourceId: string;
  filename: string;
  mimeType: string;
  fileSize: number;
  uploadedBy: string;
  uploadedAt: string;
}

export interface DoctrineIngestionResult {
  success: boolean;
  documentId?: string;
  sourceId?: string;
  normalized?: NormalizedDocument;
  errors?: string[];
  extractedObligations: number;
  extractedThresholds: number;
  extractedSanctions: number;
}


/**
 * Extract text from file buffer (simplified - assumes UTF-8 text)
 * In production: use pdf-parse, pptx, docx libraries
 */
function extractTextFromBuffer(buffer: Buffer, mimeType: string): string {
  try {
    // For PDF, would use: const pdf = require('pdf-parse');
    // For DOCX, would use: const Docxtemplater = require('docxtemplater');
    // For now, assume plain text or UTF-8 encoded

    if (mimeType.includes('pdf')) {
      console.warn('[DoctrineIngestion] PDF parsing requires pdf-parse library');
      return '';
    }

    if (mimeType.includes('word') || mimeType.includes('officedocument')) {
      console.warn('[DoctrineIngestion] DOCX parsing requires docxtemplater library');
      return '';
    }

    // Plain text extraction
    return buffer.toString('utf-8');
  } catch (error) {
    console.error('[DoctrineIngestion] Text extraction failed:', error);
    return '';
  }
}

/**
 * Validate document against source metadata
 */
function validateDocumentAgainstSource(
  text: string,
  source: DoctrineSource
): { valid: boolean; issues: string[] } {
  const issues: string[] = [];

  if (text.length < 100) {
    issues.push('Document too short (< 100 characters)');
  }

  if (text.length > 10000000) {
    issues.push('Document too long (> 10MB equivalent)');
  }

  // Check for required keywords based on source type
  const keywordChecks: { [key: string]: string[] } = {
    DTU: ['DTU', 'travaux', 'exécution', 'bâtiment'],
    NORME: ['NF', 'norme', 'standard'],
    GUIDE: ['guide', 'bonnes pratiques', 'recommandation'],
    JURISPRUDENCE: ['jugement', 'cour', 'jurisprudence', 'arrêt'],
    TECHNIQUE: ['fiche technique', 'produit', 'spécification'],
    GUIDE_ADEME: ['ADEME', 'guide', 'environnemental'],
  };

  const keywords = keywordChecks[source.sourceType] || [];
  const hasKeywords = keywords.some((kw) =>
    new RegExp(`\\b${kw}\\b`, 'i').test(text)
  );

  if (!hasKeywords && source.enforceable) {
    issues.push(`Missing expected keywords for ${source.sourceType}`);
  }

  return {
    valid: issues.length === 0,
    issues,
  };
}

/**
 * Store normalized document in Supabase
 */
async function storeNormalizedDocument(
  sourceId: string,
  normalized: NormalizedDocument,
  metadata: DoctrineDocumentMetadata
): Promise<string | null> {
  try {
    // Use shared supabase client

    // Store in knowledge_documents
    const { data: docData, error: docError } = await supabase
      .from('knowledge_documents')
      .insert({
        title: metadata.filename,
        category: 'doctrine',
        source: sourceId,
        version: '1.0',
        file_size: metadata.fileSize,
        created_by: metadata.uploadedBy,
        chunk_count: 1, // Will store normalized as single record
      })
      .select('id')
      .single();

    if (docError) {
      console.error('[DoctrineIngestion] Failed to store document:', docError);
      return null;
    }

    const documentId = docData?.id;

    if (!documentId) {
      console.error('[DoctrineIngestion] No document ID returned');
      return null;
    }

    // Store normalized data as JSON in knowledge_chunks
    const normalizedJson = JSON.stringify(normalized);

    const { error: chunkError } = await supabase
      .from('knowledge_chunks')
      .insert({
        document_id: documentId,
        content: JSON.stringify({
          type: 'doctrine_normalized',
          sourceId,
          obligations: normalized.obligations.length,
          thresholds: normalized.thresholds.length,
          sanctions: normalized.sanctions.length,
          summary: `DTU/Norme: ${normalized.keyTerms.join(', ')}`,
        }),
        chunk_index: 0,
        token_count: Math.ceil(normalizedJson.length / 4),
        embedding: null,
      });

    if (chunkError) {
      console.error('[DoctrineIngestion] Failed to store chunk:', chunkError);
      return null;
    }

    console.log(`[DoctrineIngestion] Stored normalized document: ${documentId}`);
    return documentId;
  } catch (error) {
    console.error('[DoctrineIngestion] Storage failed:', error);
    return null;
  }
}

/**
 * Store doctrine source reference
 */
async function storeDoctrineSource(
  sourceId: string,
  source: DoctrineSource,
  metadata: DoctrineDocumentMetadata
): Promise<boolean> {
  try {
    // Use shared supabase client

    const { error } = await supabase.from('doctrine_sources').upsert({
      source_id: sourceId,
      name: source.name,
      source_type: source.sourceType,
      authority_level: source.authorityLevel,
      legal_weight: source.legalWeight,
      enforceable: source.enforceable,
      sector_tags: source.sectorTags,
      issuing_authority: source.issuingAuthority,
      valid_from: source.validFrom,
      valid_until: source.validUntil,
      document_url: metadata.filename,
      uploaded_at: metadata.uploadedAt,
    });

    if (error) {
      console.error('[DoctrineIngestion] Failed to store source:', error);
      return false;
    }

    return true;
  } catch (error) {
    console.error('[DoctrineIngestion] Source storage failed:', error);
    return false;
  }
}

/**
 * Main ingestion workflow
 * Validates, normalizes, and stores doctrine document
 */
export async function ingestDoctrineDocument(
  fileBuffer: Buffer,
  filename: string,
  sourceId: string,
  userId: string
): Promise<DoctrineIngestionResult> {
  try {
    console.log(`[DoctrineIngestion] Starting ingestion: ${filename} for source: ${sourceId}`);

    // Step 1: Get source metadata
    const source = getDoctrineSource(sourceId);
    if (!source) {
      return {
        success: false,
        errors: [`Source not found: ${sourceId}`],
        extractedObligations: 0,
        extractedThresholds: 0,
        extractedSanctions: 0,
      };
    }

    console.log(`[DoctrineIngestion] Source found: ${source.name}`);

    // Step 2: Extract text from buffer
    const mimeType = filename.endsWith('.pdf') ? 'application/pdf' : 'text/plain';
    const text = extractTextFromBuffer(fileBuffer, mimeType);

    if (!text || text.length === 0) {
      return {
        success: false,
        errors: ['Failed to extract text from document'],
        extractedObligations: 0,
        extractedThresholds: 0,
        extractedSanctions: 0,
      };
    }

    console.log(`[DoctrineIngestion] Extracted ${text.length} characters`);

    // Step 3: Validate document
    const validation = validateDocumentAgainstSource(text, source);
    if (!validation.valid) {
      console.warn('[DoctrineIngestion] Validation issues:', validation.issues);
    }

    // Step 4: Normalize document
    const normalized = normalizeDoctrineDocument(sourceId, text);

    console.log(
      `[DoctrineIngestion] Normalized: ${normalized.obligations.length} obligations, ${normalized.thresholds.length} thresholds`
    );

    // Step 5: Store source reference
    const metadata: DoctrineDocumentMetadata = {
      sourceId,
      filename,
      mimeType,
      fileSize: fileBuffer.length,
      uploadedBy: userId,
      uploadedAt: new Date().toISOString(),
    };

    const sourceStored = await storeDoctrineSource(sourceId, source, metadata);
    if (!sourceStored) {
      return {
        success: false,
        errors: ['Failed to store source reference'],
        extractedObligations: normalized.obligations.length,
        extractedThresholds: normalized.thresholds.length,
        extractedSanctions: normalized.sanctions.length,
      };
    }

    // Step 6: Store normalized document
    const documentId = await storeNormalizedDocument(sourceId, normalized, metadata);
    if (!documentId) {
      return {
        success: false,
        errors: ['Failed to store normalized document'],
        extractedObligations: normalized.obligations.length,
        extractedThresholds: normalized.thresholds.length,
        extractedSanctions: normalized.sanctions.length,
      };
    }

    console.log(`[DoctrineIngestion] Ingestion complete: ${documentId}`);

    return {
      success: true,
      documentId,
      sourceId,
      normalized,
      extractedObligations: normalized.obligations.length,
      extractedThresholds: normalized.thresholds.length,
      extractedSanctions: normalized.sanctions.length,
    };
  } catch (error) {
    console.error('[DoctrineIngestion] Ingestion failed:', error);
    return {
      success: false,
      errors: [error instanceof Error ? error.message : 'Unknown error'],
      extractedObligations: 0,
      extractedThresholds: 0,
      extractedSanctions: 0,
    };
  }
}

/**
 * Batch ingest multiple doctrine sources
 */
export async function batchIngestDoctrineDocuments(
  files: Array<{ buffer: Buffer; filename: string; sourceId: string }>,
  userId: string
): Promise<DoctrineIngestionResult[]> {
  try {
    console.log(`[DoctrineIngestion] Batch ingestion: ${files.length} documents`);

    const results: DoctrineIngestionResult[] = [];

    for (const file of files) {
      const result = await ingestDoctrineDocument(file.buffer, file.filename, file.sourceId, userId);
      results.push(result);
    }

    const successCount = results.filter((r) => r.success).length;
    console.log(`[DoctrineIngestion] Batch complete: ${successCount}/${files.length} successful`);

    return results;
  } catch (error) {
    console.error('[DoctrineIngestion] Batch ingestion failed:', error);
    return [];
  }
}

/**
 * Get ingestion statistics
 */
export async function getDoctrineIngestionStats(): Promise<{
  totalSources: number;
  documentCount: number;
  totalObligations: number;
  totalThresholds: number;
  totalSanctions: number;
}> {
  try {
    // Use shared supabase client

    const { count: sourceCount } = await supabase
      .from('doctrine_sources')
      .select('*', { count: 'exact', head: true });

    const { count: docCount } = await supabase
      .from('knowledge_documents')
      .select('*', { count: 'exact', head: true })
      .eq('category', 'doctrine');

    return {
      totalSources: sourceCount || 0,
      documentCount: docCount || 0,
      totalObligations: 0, // Would aggregate from stored normalized data
      totalThresholds: 0,
      totalSanctions: 0,
    };
  } catch (error) {
    console.error('[DoctrineIngestion] Failed to get stats:', error);
    return {
      totalSources: 0,
      documentCount: 0,
      totalObligations: 0,
      totalThresholds: 0,
      totalSanctions: 0,
    };
  }
}
