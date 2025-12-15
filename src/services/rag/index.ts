/**
 * TORP RAG Services
 * Services de Retrieval-Augmented Generation pour l'enrichissement des documents
 */

export {
  KnowledgeService,
  DTU_CATALOG,
  type KnowledgeSearchResult,
  type KnowledgeSearchOptions,
  type DTUReference,
  type CCTPEnrichmentContext,
  type CCTPPrescription,
} from './knowledge.service';

// Catalogue DTU enrichi avec prescriptions détaillées
export {
  DTU_CATALOG_ENRICHED,
  getDTUsForCategory,
  getDTUByCode,
  getAllCategories,
  getTotalDTUCount,
  type DTUReferenceEnriched,
} from './dtu-catalog';
