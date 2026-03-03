/**
 * Knowledge Integrity Module - Public API
 * Validates and reports on knowledge document and chunk quality
 */

export {
  verifyDocumentIntegrity,
  persistIntegrityReport,
  verifyAndPersistIntegrity,
} from './knowledgeIntegrity.service';

export type {
  ChunkIntegrityReport,
  DocumentIntegrityReport,
  IntegrityCheckResult,
  IntegrityCheckConfig,
  ChunkDataForIntegrity,
  DocumentDataForIntegrity,
} from './knowledgeIntegrity.types';
