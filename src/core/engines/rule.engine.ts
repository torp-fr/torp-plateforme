/**
 * Rule Engine v2.0
 *
 * Fetches rules from the Supabase `rules` table, converts them into
 * ProtoDecisions via the Decision Builder, then resolves them into a single
 * authoritative bound per (element, property, unit) key via the Decision
 * Resolver.
 *
 * Resolved decisions are stored on `executionContext.resolvedDecisions` for
 * downstream engines (audit, comparison, etc.).
 *
 * Tone: advisory — never punitive.
 */

import { supabase } from '@/lib/supabase';
import { log, warn } from '@/lib/logger';
import type { EngineExecutionContext } from '@/core/platform/engineExecutionContext';
import {
  buildDecisions,
  groupDecisionsByKey,
  type RuleRow,
  type DecisionContext,
  type BuildingType,
} from '@/core/decision/decisionBuilder';

function normalizeBuildingType(input?: string): BuildingType | undefined {
  if (!input) return undefined;
  const val = input.toLowerCase();
  if (val.includes('erp'))      return 'erp';
  if (val.includes('maison'))   return 'maison';
  if (val.includes('industri')) return 'industrie';
  return 'autre';
}
import {
  resolveDecisions,
  type ResolvedDecision,
} from '@/core/decision/decisionResolver';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Kept for backward compatibility with downstream engines. */
export interface RuleObligation {
  id: string;
  category: string;
  obligation: string;
  ruleType: 'legal' | 'regulatory' | 'advisory' | 'commercial';
  severity: 'low' | 'medium' | 'high' | 'critical';
  weight: number;
  source?: string;
}

export interface RuleEngineResult {
  obligations: string[];
  uniqueObligations: string[];
  detailedObligations: RuleObligation[];
  uniqueDetailedObligations: RuleObligation[];
  obligationCount: number;
  ruleCount: number;
  totalWeight: number;
  severityBreakdown: {
    critical: number;
    high: number;
    medium: number;
    low: number;
  };
  typeBreakdown: {
    legal: number;
    regulatory: number;
    advisory: number;
    commercial: number;
  };
  categorySummary: Record<string, number>;
  /** Primary output of v2.0 — one resolved constraint per property key. */
  resolvedDecisions: ResolvedDecision[];
  meta: {
    engineVersion: string;
    createdAt: string;
    processingTime: number;
    rulesFetched: number;
    decisionsBuilt: number;
    decisionsResolved: number;
  };
}

// ---------------------------------------------------------------------------
// DB row shape (only fields we consume)
// ---------------------------------------------------------------------------

interface DbRuleRow {
  id: string;
  document_id: string | null;
  domain: string | null;
  category: string | null;
  rule_type: string;
  confidence_score: number;
  description: string | null;
  structured_data: {
    property?: string | null;
    property_key?: string | null;
    property_category?: string | null;
    operator?: string | null;
    value?: number | string | null;
    unit?: string | null;
    element?: string | null;
  };
}

// ---------------------------------------------------------------------------
// Rule types treated as actionable numeric constraints
// ---------------------------------------------------------------------------

// 'formula' is included so Eurocode rules (all stored as formula type) flow
// into buildDecisions and are filtered by the Eurocode-specific semantic checks.
const ACTIONABLE_RULE_TYPES = new Set(['constraint', 'requirement', 'formula']);

// ---------------------------------------------------------------------------
// DB fetch
// ---------------------------------------------------------------------------

async function fetchRules(domains: string[]): Promise<RuleRow[]> {
  try {
    let query = supabase
      .from('rules')
      .select('id, document_id, domain, category, rule_type, confidence_score, description, structured_data')
      .in('rule_type', ['constraint', 'requirement', 'formula'])
      .limit(500);

    if (domains.length > 0) {
      query = query.in('domain', domains);
    }

    const { data, error } = await query;

    if (error) {
      warn('[RuleEngine] DB fetch failed, falling back to empty rule set', {
        message: error.message,
        domains,
      });
      return [];
    }

    const rows = (data ?? []) as DbRuleRow[];
    log(`[RuleEngine] Fetched ${rows.length} rules from DB`, { domains });

    return rows.map((row): RuleRow => {
      const sd = row.structured_data ?? {};
      return {
        property:          sd.property          ?? null,
        property_key:      sd.property_key      ?? null,
        property_category: sd.property_category ?? null,
        operator:          sd.operator          ?? null,
        value:             sd.value             ?? null,
        unit:              sd.unit              ?? null,
        element:           sd.element           ?? null,
        domain:            row.domain           ?? null,
        category:          row.category         ?? null,
        description:       row.description      ?? null,
        // Map DB rule_type → classification understood by buildDecisions
        classification: ACTIONABLE_RULE_TYPES.has(row.rule_type)
          ? 'actionable_numeric'
          : row.rule_type,
        confidence_score:  row.confidence_score ?? null,
        source_document_id: row.document_id     ?? null,
      };
    });
  } catch (err) {
    warn('[RuleEngine] Unexpected error during rule fetch, using empty fallback', {
      error: err instanceof Error ? err.message : String(err),
    });
    return [];
  }
}

// ---------------------------------------------------------------------------
// Obligation helpers (backward compat for downstream engines)
// ---------------------------------------------------------------------------

function formatObligationText(rd: ResolvedDecision): string {
  const parts: string[] = [];
  if (rd.element) parts.push(rd.element);
  parts.push(rd.property);

  const bounds: string[] = [];
  if (rd.min !== undefined) bounds.push(`≥ ${rd.min}${rd.unit ? ' ' + rd.unit : ''}`);
  if (rd.max !== undefined) bounds.push(`≤ ${rd.max}${rd.unit ? ' ' + rd.unit : ''}`);
  if (rd.exact !== undefined) bounds.push(`= ${rd.exact}${rd.unit ? ' ' + rd.unit : ''}`);
  if (bounds.length > 0) parts.push(`(${bounds.join(', ')})`);

  return parts.join(' — ');
}

function severityFromConfidence(
  confidence: number
): RuleObligation['severity'] {
  if (confidence >= 0.9) return 'high';
  if (confidence >= 0.75) return 'medium';
  return 'low';
}

function toDetailedObligation(rd: ResolvedDecision): RuleObligation {
  return {
    id: `${rd.element ?? ''}|${rd.property}|${rd.unit ?? ''}`,
    category: rd.domain,
    obligation: formatObligationText(rd),
    ruleType: 'regulatory',
    severity: severityFromConfidence(rd.confidence),
    weight: rd.confidence,
    source: rd.sources[0],
  };
}

// ---------------------------------------------------------------------------
// Engine entry point
// ---------------------------------------------------------------------------

export async function runRuleEngine(
  executionContext: EngineExecutionContext
): Promise<RuleEngineResult> {
  const startTime = Date.now();

  try {
    log('[RuleEngine] Starting rule evaluation (v2.0 — DB-backed)');

    // 1. Extract unique domains from lots produced by Lot Engine
    const normalizedLots: any[] = executionContext.lots?.normalizedLots ?? [];
    const domains = [...new Set<string>(
      normalizedLots
        .map((lot) => lot.category as string | undefined)
        .filter((c): c is string => !!c && c !== 'unknown' && c !== 'autre')
    )];

    // 2. Fetch → Build → Resolve
    const rawRules = await fetchRules(domains);

    // Extract building type from project data for context-aware priority weighting
    const decisionContext: DecisionContext = {
      buildingType: normalizeBuildingType(
        executionContext.projectData?.buildingType
          ?? executionContext.projectData?.building_type
      ),
    };

    const decisions = buildDecisions(rawRules, decisionContext);
    log(`[RuleEngine] Built ${decisions.length} proto-decisions`);

    const grouped = groupDecisionsByKey(decisions);
    const resolved = resolveDecisions(grouped);
    log(`[RuleEngine] Resolved ${resolved.length} decisions`);

    // 3. Store on context for downstream engines
    executionContext.resolvedDecisions = resolved;

    // 4. Derive backward-compat obligation fields from resolved decisions
    const detailedObligations = resolved.map(toDetailedObligation);
    const obligations = detailedObligations.map((o) => o.obligation);
    const totalWeight = resolved.reduce((sum, rd) => sum + rd.confidence, 0);

    const severityBreakdown = { critical: 0, high: 0, medium: 0, low: 0 };
    const categorySummary: Record<string, number> = {};

    for (const o of detailedObligations) {
      severityBreakdown[o.severity]++;
      categorySummary[o.category] = (categorySummary[o.category] ?? 0) + 1;
    }

    const processingTime = Date.now() - startTime;

    const result: RuleEngineResult = {
      obligations,
      uniqueObligations: [...new Set(obligations)],
      detailedObligations,
      uniqueDetailedObligations: detailedObligations, // already unique by key
      obligationCount: obligations.length,
      ruleCount: resolved.length,
      totalWeight,
      severityBreakdown,
      typeBreakdown: {
        legal: 0,
        regulatory: resolved.length,
        advisory: 0,
        commercial: 0,
      },
      categorySummary,
      resolvedDecisions: resolved,
      meta: {
        engineVersion: '2.0',
        createdAt: new Date().toISOString(),
        processingTime,
        rulesFetched: rawRules.length,
        decisionsBuilt: decisions.length,
        decisionsResolved: resolved.length,
      },
    };

    log('[RuleEngine] Rule evaluation completed', {
      rulesFetched: rawRules.length,
      decisionsBuilt: decisions.length,
      decisionsResolved: resolved.length,
      conflicts: resolved.filter((r) => r.conflict).length,
      processingTime,
    });

    return result;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    warn('[RuleEngine] Unexpected error during rule evaluation', { message });

    return {
      obligations: [],
      uniqueObligations: [],
      detailedObligations: [],
      uniqueDetailedObligations: [],
      obligationCount: 0,
      ruleCount: 0,
      totalWeight: 0,
      severityBreakdown: { critical: 0, high: 0, medium: 0, low: 0 },
      typeBreakdown: { legal: 0, regulatory: 0, advisory: 0, commercial: 0 },
      categorySummary: {},
      resolvedDecisions: [],
      meta: {
        engineVersion: '2.0',
        createdAt: new Date().toISOString(),
        processingTime: Date.now() - startTime,
        rulesFetched: 0,
        decisionsBuilt: 0,
        decisionsResolved: 0,
      },
    };
  }
}

// ---------------------------------------------------------------------------
// Metadata
// ---------------------------------------------------------------------------

export function getRuleEngineMetadata() {
  return {
    id: 'ruleEngine',
    name: 'Rule Engine',
    version: '2.0',
    description: 'Fetch rules from DB, build and resolve decisions per property key',
    capabilities: [
      'DB-backed rule fetching (filtered by domain)',
      'Decision building with operator normalization',
      'Conflict detection (min > max, divergent exact)',
      'Resolved decisions stored on execution context',
    ],
    inputs: ['normalizedLots from lotEngine'],
    outputs: ['resolvedDecisions', 'obligations (compat)', 'ruleCount'],
    dependencies: ['lotEngine', 'supabase.rules'],
  };
}
