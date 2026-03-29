/**
 * @deprecated
 *
 * This file has been renamed to `lotContext.engine.ts` to disambiguate it
 * from `src/services/contextEngine.service.ts`.
 *
 * These are two DIFFERENT services:
 *   lotContext.engine.ts        — reads structured lot/space data from the
 *                                 engine pipeline, produces ContextEngineResult
 *   contextEngine.service.ts    — applies ProjectContext to EnrichedRules,
 *                                 produces ContextualRule[]
 *
 * Update your import:
 *   import { ... } from '@/core/engines/lotContext.engine';
 */
export * from './lotContext.engine';
