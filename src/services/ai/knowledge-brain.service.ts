/**
 * Knowledge Brain Service — Legacy Re-export Shim
 *
 * The knowledge brain has been refactored into a clean modular architecture:
 *   src/core/rag/
 *
 * This file preserves all existing import paths for backward compatibility.
 * All logic now lives in src/core/rag/rag.service.ts and its sub-services.
 */

export {
  ragService,
  ragService as knowledgeBrainService,
  knowledgeBrainService as default,
} from '@/core/rag/rag.service';

export type {
  KnowledgeDocument,
  SearchResult,
  SimilarDocument,
  MarketPriceReference,
  SystemIntegrityViolation,
} from '@/core/rag/rag.service';
