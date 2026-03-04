/**
 * Knowledge Conflict Detection Module
 * Exports all conflict detection functionality
 *
 * HARDENED: Includes configuration types and health metrics support
 */

export * from './knowledgeConflict.types';
export {
  KnowledgeConflictService,
  getKnowledgeConflictService,
  resetKnowledgeConflictService,
} from './knowledgeConflict.service';
