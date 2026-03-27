/**
 * End-to-End Pipeline Test
 * Tests the full flow: Context Deduction → Lot Detection → Rule Loading → Summary
 *
 * Uses real Supabase (rule counts) + real contextDeduction service.
 * Run: pnpm tsx scripts/test-e2e-pipeline.ts
 */
import 'dotenv/config';
import { readFileSync } from 'fs';
import { createClient } from '@supabase/supabase-js';
import {
  enrichWithImpliedDomains,
  deduceImpliedDomains,
} from '../src/core/reasoning/contextDeduction.service';

// ── Supabase ──────────────────────────────────────────────────────────────────

const envRaw = readFileSync('.env.local', 'utf8');
const env: Record<string, string> = Object.fromEntries(
  envRaw
    .split('\n')
    .filter((l) => l.includes('=') && !l.startsWith('#'))
    .map((l) => {
      const i = l.indexOf('=');
      return [l.slice(0, i).trim(), l.slice(i + 1).trim()];
    }),
);

const sb = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

// ── Helpers ───────────────────────────────────────────────────────────────────

const sep = (n = 60) => '─'.repeat(n);
const ok  = (msg: string) => console.log(`  ✅ ${msg}`);
const fail = (msg: string) => console.log(`  ❌ ${msg}`);
const info = (msg: string) => console.log(`     ${msg}`);

async function countRulesForDomains(domains: string[]): Promise<number> {
  if (domains.length === 0) return 0;
  const { count, error } = await sb
    .from('rules')
    .select('*', { count: 'exact', head: true })
    .in('domain', domains)
    .in('rule_type', ['constraint', 'requirement', 'formula']);
  if (error) throw new Error(`DB error: ${error.message}`);
  return count ?? 0;
}

async function getRuleCountByDomain(domains: string[]): Promise<Record<string, number>> {
  if (domains.length === 0) return {};
  const { data, error } = await sb
    .from('rules')
    .select('domain')
    .in('domain', domains)
    .in('rule_type', ['constraint', 'requirement', 'formula']);
  if (error) throw new Error(`DB error: ${error.message}`);
  const counts: Record<string, number> = {};
  for (const row of data ?? []) {
    counts[row.domain] = (counts[row.domain] ?? 0) + 1;
  }
  return counts;
}

/** Minimal lot categorization (mirrors lot.engine.ts categorizeLot + LOT_TO_DOMAIN) */
function detectLotsFromLines(
  lines: Array<{ description: string; amount: number }>,
): Array<{ label: string; category: string; domain: string | null }> {
  const LOT_TO_DOMAIN: Record<string, string> = {
    electricite: 'électrique',
    plomberie:   'hydraulique',
    toiture:     'structure',
    structure:   'structure',
    chauffage:   'thermique',
  };

  const PATTERNS: Array<{ regex: RegExp; category: string }> = [
    { regex: /elec|electri|électr|câbl|cablag|tableau|circuit|prises|interrupteur/i, category: 'electricite' },
    { regex: /plomb|tuyau|sanitair|robinet|filtr|pompe|assainiss|canalisation|eau chaude|eau froide|evacuation/i, category: 'plomberie' },
    { regex: /toit|couverture|zinguerie|ardoise|tuile/i, category: 'toiture' },
    { regex: /terras|fouille|excavation|fondation|béton|beton|armature|ferrail|coffrage|dalle|maçon|macon|gros.oeuvre|structur|mur porteur|voile|bassin/i, category: 'structure' },
    { regex: /chauffage|chauffe|climatisation|clim|ventilation|vmc|cvc|thermopompe|pompe.chaleur|chaudière|chaudiere|radiateur|plancher chauffant/i, category: 'chauffage' },
  ];

  return lines.map((line) => {
    for (const p of PATTERNS) {
      if (p.regex.test(line.description)) {
        return {
          label: line.description,
          category: p.category,
          domain: LOT_TO_DOMAIN[p.category] ?? null,
        };
      }
    }
    return { label: line.description, category: 'autre', domain: null };
  });
}

// ── Test runner ───────────────────────────────────────────────────────────────

interface DevisTest {
  label: string;
  projectData: Record<string, any>;
  lines: Array<{ description: string; amount: number }>;
}

async function runTest(t: DevisTest): Promise<void> {
  console.log(`\n${'═'.repeat(60)}`);
  console.log(`🧪 TEST: ${t.label}`);
  console.log('═'.repeat(60));

  // STEP 1 — Context Deduction
  console.log('\nSTEP 1 — Context Deduction');
  const enriched = enrichWithImpliedDomains(t.projectData);
  const impliedDomains = enriched.impliedDomains;
  const confidence = enriched.contextDeductionConfidence;
  ok(`${impliedDomains.length} domains inferred (confidence: ${confidence})`);
  info(`type: "${t.projectData.type ?? '?'}"`);
  info(`impliedDomains: [${impliedDomains.join(', ')}]`);

  // STEP 2 — Lot Detection (simulates lot.engine)
  console.log('\nSTEP 2 — Lot Detection (lot.engine simulation)');
  const lots = detectLotsFromLines(t.lines);
  const lotDomains = [...new Set(lots.map((l) => l.domain).filter(Boolean) as string[])];
  ok(`${lots.length} lines processed, ${lotDomains.length} lot domains detected`);
  lots.forEach((l) => {
    const tag = l.domain ? `→ ${l.domain}` : '→ autre (no domain)';
    info(`"${l.label}" [${l.category}] ${tag}`);
  });

  // STEP 3 — Domain Merge
  console.log('\nSTEP 3 — Domain Merge (lot UNION implied)');
  const mergedDomains = [...new Set([...lotDomains, ...impliedDomains])];
  ok(`${mergedDomains.length} unique domains after merge`);
  info(`lotDomains:     [${lotDomains.join(', ') || '(none)'}]`);
  info(`impliedDomains: [${impliedDomains.join(', ')}]`);
  info(`merged:         [${mergedDomains.join(', ')}]`);

  // STEP 4 — Rule Loading (real DB query)
  console.log('\nSTEP 4 — Rule Loading (Supabase)');
  const totalRules = await countRulesForDomains(mergedDomains);
  const perDomain  = await getRuleCountByDomain(mergedDomains);
  if (totalRules > 0) {
    ok(`${totalRules.toLocaleString()} actionable rules loaded`);
  } else {
    fail(`0 rules loaded — check domains`);
  }
  mergedDomains.forEach((d) => {
    info(`${d}: ${(perDomain[d] ?? 0).toLocaleString()} rules`);
  });

  // STEP 5 — Completeness Check
  console.log('\nSTEP 5 — Coverage Check');
  const totalDevisAmount = t.lines.reduce((s, l) => s + l.amount, 0);
  const classifiedLines  = lots.filter((l) => l.category !== 'autre').length;
  const coveragePct      = Math.round((classifiedLines / lots.length) * 100);
  if (coveragePct === 100) {
    ok(`100% lines classified`);
  } else if (coveragePct >= 50) {
    ok(`${coveragePct}% lines classified (${classifiedLines}/${lots.length})`);
  } else {
    fail(`Only ${coveragePct}% lines classified — lot detection weak`);
  }
  info(`Total devis amount: ${totalDevisAmount.toLocaleString()} €`);
  info(`Implied domains cover: ${mergedDomains.length}/9 total DB domains`);

  // STEP 6 — Summary
  console.log('\nSTEP 6 — Summary');
  const pipelineFunctional = totalRules > 0;
  if (pipelineFunctional) {
    ok('Pipeline FUNCTIONAL — rules loaded, audit is possible');
  } else {
    fail('Pipeline BLOCKED — 0 rules loaded');
  }
  info(`Rules available for audit: ${totalRules.toLocaleString()}`);
  info(`Domains queried: ${mergedDomains.length}`);
  info(`Context confidence: ${confidence}`);
  console.log();
}

// ── Test Cases ────────────────────────────────────────────────────────────────

const TESTS: DevisTest[] = [
  {
    label: 'Piscine enterrée 10×4m',
    projectData: { type: 'piscine', dimensions: '10x4m', depth: '2m' },
    lines: [
      { description: 'Terrassement et fouilles',         amount: 8000 },
      { description: 'Structure béton armé bassin',       amount: 15000 },
      { description: 'Plomberie réseau filtration',       amount: 6000 },
      { description: 'Installation électrique pompe',     amount: 3000 },
      { description: 'Carrelage fond et parois',          amount: 5000 },
    ],
  },
  {
    label: 'Électricité seule — refonte complète',
    projectData: { type: 'electricite_seule' },
    lines: [
      { description: 'Refonte tableau électrique TGBT',  amount: 2000 },
      { description: 'Câblage circuits spécialisés',     amount: 3000 },
      { description: 'Prises et interrupteurs',          amount: 1000 },
    ],
  },
];

// ── Main ──────────────────────────────────────────────────────────────────────

(async () => {
  console.log('\n' + '═'.repeat(60));
  console.log('  END-TO-END PIPELINE TEST — TORP Phase 2');
  console.log('  Context Deduction + Lot Detection + Rule Loading');
  console.log('═'.repeat(60));

  const results: Array<{ label: string; ok: boolean }> = [];

  for (const t of TESTS) {
    try {
      await runTest(t);
      results.push({ label: t.label, ok: true });
    } catch (err) {
      console.error(`\n  ❌ FATAL ERROR in "${t.label}":`, err);
      results.push({ label: t.label, ok: false });
    }
  }

  console.log('\n' + '═'.repeat(60));
  console.log('  GLOBAL RESULT');
  console.log(sep());
  results.forEach((r) => {
    console.log(`  ${r.ok ? '✅' : '❌'} ${r.label}`);
  });
  const allPassed = results.every((r) => r.ok);
  console.log();
  console.log(`  Pipeline: ${allPassed ? '✅ FULLY FUNCTIONAL' : '❌ ISSUES DETECTED'}`);
  console.log('═'.repeat(60) + '\n');

  process.exit(allPassed ? 0 : 1);
})();
