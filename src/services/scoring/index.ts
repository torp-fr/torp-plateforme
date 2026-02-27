export { innovationDurableScoringService } from './innovation-durable.scoring';
export { rgeCoherenceService } from './rge-coherence.service';
export type { RGECoherenceResult, TravauxDetecte, CoherenceItem, IncoherenceItem, AlerteCoherence, DomaineRGE } from './rge-coherence.service';
export { transparencyScoringService } from './transparency-scoring.service';
export type { TransparencyAnalysis, CritereScore, ElementDetecte, TransparencyInput } from './transparency-scoring.service';

// Contextual Scoring moved to Edge Functions
// Use: supabase.functions.invoke('rag-query', {...}) for contextual analysis
