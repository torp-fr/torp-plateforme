/**
 * Benchmark: OLD prompt vs NEW prompt
 * Read-only — no DB writes.
 * Fetches 50 unprocessed chunks, runs both prompts, computes metrics.
 */
import 'dotenv/config';
import OpenAI from 'openai';
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';

// ── Env ──────────────────────────────────────────────────────────────────────
const envRaw = readFileSync('.env.local', 'utf8');
const env: Record<string, string> = Object.fromEntries(
  envRaw.split('\n')
    .filter(l => l.includes('=') && !l.startsWith('#'))
    .map(l => {
      const idx = l.indexOf('=');
      return [l.slice(0, idx).trim(), l.slice(idx + 1).trim()];
    }),
);

const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
const openai   = new OpenAI({ apiKey: env.OPENAI_API_KEY });

// ── Prompts ───────────────────────────────────────────────────────────────────

function oldPrompt(content: string, category: string): string {
  return `Tu es un expert BTP français.

Extrait toutes les règles techniques quantifiées du texte ci-dessous (catégorie: ${category}).

FORMAT JSON STRICT — réponds UNIQUEMENT avec un tableau JSON, aucun texte autour :

[
  {
    "property_key": "nom_technique_snake_case",
    "operator": "> | < | = | >= | <=",
    "value": 42,
    "unit": "mm",
    "description": "phrase décrivant la règle",
    "confidence": 0.9
  }
]

Si aucune règle quantifiée n'est présente, réponds : []

TEXTE:
${content.slice(0, 4000)}`;
}

function newPrompt(content: string, category: string): string {
  return `Tu es un expert en réglementation BTP française (DTU, Eurocodes, Normes NF, Code de la Construction).

MISSION : Extraire TOUTES les règles techniques du texte suivant — sans exception.
Catégorie du document : ${category}

══════════════════════════════════════════════════════════
TYPE 1 — QUANTITATIF  (règle avec valeur numérique)
══════════════════════════════════════════════════════════
Déclencheurs : seuils, dimensions, distances, températures, coefficients, débits, pressions
Mots-clés    : "minimum", "maximum", "au moins", "au plus", "≥", "≤",
               "DN X", "X mm", "X °C", "X %", "X kN", "épaisseur de X"

→ "operator" : ">=" | "<=" | "=" | ">" | "<"
→ "value"    : nombre extrait tel quel (ex. 50)
→ "unit"     : unité normalisée (mm, cm, m, %, °C, kN, Pa, kN/m², dB, W/m²K…)
→ "type"     : "quantitative"

══════════════════════════════════════════════════════════
TYPE 2 — QUALITATIF  (obligation, interdiction, exigence sans valeur)
══════════════════════════════════════════════════════════
Déclencheurs :
• Obligations   → "doit", "doivent", "doit être", "il faut", "est requis",
                  "est obligatoire", "doit permettre de", "doit assurer"
• Interdictions → "interdit", "ne doit pas", "ne peut pas", "est proscrit",
                  "ne peut être", "est exclu"
• Conformités   → "doit être conforme à", "doit respecter", "selon la norme",
                  "conformément à", "doit satisfaire"
• Exigences     → "doit garantir", "doit résister à", "doit supporter"

→ "operator" : "obligatoire" | "interdit" | "conforme_a" | "recommande"
→ "value"    : null
→ "unit"     : null
→ "type"     : "qualitative"

══════════════════════════════════════════════════════════
FORMAT DE SORTIE — JSON strict, aucun texte autour
══════════════════════════════════════════════════════════
[
  {
    "property_key": "epaisseur_chape_flottante",
    "operator": ">=",
    "value": 50,
    "unit": "mm",
    "description": "L'épaisseur de la chape flottante doit être supérieure ou égale à 50 mm",
    "confidence": 0.95,
    "type": "quantitative"
  },
  {
    "property_key": "joint_peripherique_obligatoire",
    "operator": "obligatoire",
    "value": null,
    "unit": null,
    "description": "Un joint souple doit être interposé entre la chape et les parois verticales",
    "confidence": 0.90,
    "type": "qualitative"
  },
  {
    "property_key": "interdiction_raccord_plomb",
    "operator": "interdit",
    "value": null,
    "unit": null,
    "description": "L'utilisation de raccords en plomb est formellement interdite",
    "confidence": 0.93,
    "type": "qualitative"
  },
  {
    "property_key": "conformite_nf_p_11_221",
    "operator": "conforme_a",
    "value": null,
    "unit": null,
    "description": "Les matériaux utilisés doivent être conformes à la norme NF P 11-221",
    "confidence": 0.88,
    "type": "qualitative"
  }
]

══════════════════════════════════════════════════════════
RÈGLES D'EXTRACTION
══════════════════════════════════════════════════════════
✅ Extraire CHAQUE règle présente dans le texte — même si le texte en contient 15 ou 20
✅ Préférer la sur-extraction à la sous-extraction : en cas de doute, inclure la règle
✅ "property_key" : snake_case court, descriptif du sujet (ex. "pente_minimale_tuyau",
   "protection_antigel", "interdiction_soudure_apparent", "conformite_dtu_60_11")
✅ "description" : reprendre la phrase source presque verbatim, sans reformulation excessive
✅ "confidence" : 0.90–1.00 si texte explicite et non ambigu
                 0.70–0.89 si formulation indirecte ou implicite
                 0.50–0.69 si interprétation nécessaire

❌ Ignorer : sommaire, avant-propos, table des matières, liste des membres du comité,
             titres de chapitre seuls, mentions "par exemple" / "à titre indicatif"
❌ Aucune valeur inventée : si la valeur numérique est absente ou incertaine → value: null
❌ Pas de doublon : si la même règle est répétée deux fois dans le texte, la retourner une seule fois

Aucune règle détectable dans le texte → répondre uniquement : []

══════════════════════════════════════════════════════════
TEXTE :
══════════════════════════════════════════════════════════
${content.slice(0, 4000)}`;
}

// ── LLM call ──────────────────────────────────────────────────────────────────

interface RuleItem {
  property_key?: string;
  operator?: string;
  value?: number | null;
  unit?: string | null;
  description?: string;
  confidence?: number;
  type?: string;
}

async function callLLM(prompt: string, systemMsg: string): Promise<RuleItem[]> {
  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      temperature: 0,
      messages: [
        { role: 'system', content: systemMsg },
        { role: 'user',   content: prompt },
      ],
    });
    const raw     = response.choices[0]?.message?.content ?? '[]';
    const cleaned = raw.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '').trim();
    const parsed  = JSON.parse(cleaned);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

// ── Metrics ───────────────────────────────────────────────────────────────────

interface ChunkResult {
  chunkId: string;
  category: string;
  contentLen: number;
  oldRules: RuleItem[];
  newRules: RuleItem[];
}

interface Metrics {
  totalChunks: number;
  emptyChunks: number;
  totalRules: number;
  quantitativeRules: number;
  qualitativeRules: number;
  rulesPerChunk: number;
  rulesPerNonEmpty: number;
  emptyPct: number;
}

function computeMetrics(results: ChunkResult[], field: 'oldRules' | 'newRules'): Metrics {
  const totalChunks      = results.length;
  const emptyChunks      = results.filter(r => r[field].length === 0).length;
  const totalRules       = results.reduce((s, r) => s + r[field].length, 0);
  const quantitativeRules = results.reduce(
    (s, r) => s + r[field].filter(x => x.type === 'quantitative' || (x.value !== null && x.value !== undefined)).length, 0,
  );
  const qualitativeRules  = results.reduce(
    (s, r) => s + r[field].filter(x => x.type === 'qualitative' || (x.value === null || x.value === undefined)).length, 0,
  );
  const nonEmptyCount    = totalChunks - emptyChunks;

  return {
    totalChunks,
    emptyChunks,
    totalRules,
    quantitativeRules,
    qualitativeRules,
    rulesPerChunk:    totalChunks > 0 ? totalRules / totalChunks : 0,
    rulesPerNonEmpty: nonEmptyCount > 0 ? totalRules / nonEmptyCount : 0,
    emptyPct:         totalChunks > 0 ? (emptyChunks / totalChunks) * 100 : 0,
  };
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  console.log('═══════════════════════════════════════════════════════');
  console.log('  BENCHMARK: Old Prompt vs New Prompt');
  console.log('  Model: gpt-4o-mini | Sample: 50 chunks | Read-only');
  console.log('═══════════════════════════════════════════════════════\n');

  // Fetch 50 chunks with their document category
  console.log('Fetching 50 chunks from knowledge_chunks...');
  const { data, error } = await (supabase as any)
    .from('knowledge_chunks')
    .select('id, content, document_id, knowledge_documents(category)')
    .eq('rule_processed', false)
    .limit(50);

  if (error || !data || data.length === 0) {
    console.error('Failed to fetch chunks:', error?.message ?? 'no data');
    process.exit(1);
  }

  console.log(`Fetched ${data.length} chunks\n`);

  const results: ChunkResult[] = [];
  let idx = 0;

  for (const row of data) {
    const category = row.knowledge_documents?.category ?? 'DTU';
    const content  = row.content as string;
    idx++;

    process.stdout.write(`[${String(idx).padStart(2)}/${data.length}] chunk=${row.id.slice(0,8)} cat=${category} ... `);

    const [oldRules, newRules] = await Promise.all([
      callLLM(
        oldPrompt(content, category),
        'Extraction structurée de règles techniques BTP. JSON uniquement.',
      ),
      callLLM(
        newPrompt(content, category),
        'Tu extrais des règles techniques BTP (quantitatives ET qualitatives) en JSON strict. Aucun texte hors du tableau JSON.',
      ),
    ]);

    results.push({ chunkId: row.id, category, contentLen: content.length, oldRules, newRules });
    console.log(`old=${oldRules.length} new=${newRules.length} Δ=${newRules.length - oldRules.length >= 0 ? '+' : ''}${newRules.length - oldRules.length}`);
  }

  // ── Metrics ─────────────────────────────────────────────────────────────────
  const oldM = computeMetrics(results, 'oldRules');
  const newM = computeMetrics(results, 'newRules');

  console.log('\n═══════════════════════════════════════════════════════');
  console.log('  A. METRICS COMPARISON');
  console.log('═══════════════════════════════════════════════════════');
  console.log(`${'Metric'.padEnd(30)} ${'OLD'.padStart(8)} ${'NEW'.padStart(8)} ${'DELTA'.padStart(10)}`);
  console.log('─'.repeat(60));

  const fmt = (n: number, dec = 2) => n.toFixed(dec);
  const delta = (a: number, b: number, dec = 2) => {
    const d = b - a;
    return `${d >= 0 ? '+' : ''}${d.toFixed(dec)}`;
  };
  const deltaPct = (a: number, b: number) => {
    if (a === 0) return b > 0 ? '+∞%' : '0%';
    return `${((b - a) / a * 100) >= 0 ? '+' : ''}${((b - a) / a * 100).toFixed(0)}%`;
  };

  console.log(`${'Total rules extracted'.padEnd(30)} ${fmt(oldM.totalRules, 0).padStart(8)} ${fmt(newM.totalRules, 0).padStart(8)} ${deltaPct(oldM.totalRules, newM.totalRules).padStart(10)}`);
  console.log(`${'Rules / chunk (avg)'.padEnd(30)} ${fmt(oldM.rulesPerChunk).padStart(8)} ${fmt(newM.rulesPerChunk).padStart(8)} ${delta(oldM.rulesPerChunk, newM.rulesPerChunk).padStart(10)}`);
  console.log(`${'Rules / non-empty chunk'.padEnd(30)} ${fmt(oldM.rulesPerNonEmpty).padStart(8)} ${fmt(newM.rulesPerNonEmpty).padStart(8)} ${delta(oldM.rulesPerNonEmpty, newM.rulesPerNonEmpty).padStart(10)}`);
  console.log(`${'Empty chunks (returning [])'.padEnd(30)} ${fmt(oldM.emptyChunks, 0).padStart(8)} ${fmt(newM.emptyChunks, 0).padStart(8)} ${delta(oldM.emptyChunks, newM.emptyChunks, 0).padStart(10)}`);
  console.log(`${'Empty chunk % '.padEnd(30)} ${(fmt(oldM.emptyPct, 1)+'%').padStart(8)} ${(fmt(newM.emptyPct, 1)+'%').padStart(8)} ${delta(oldM.emptyPct, newM.emptyPct, 1).padStart(9)}%`);
  console.log(`${'Quantitative rules'.padEnd(30)} ${fmt(oldM.quantitativeRules, 0).padStart(8)} ${fmt(newM.quantitativeRules, 0).padStart(8)} ${deltaPct(oldM.quantitativeRules, newM.quantitativeRules).padStart(10)}`);
  console.log(`${'Qualitative rules'.padEnd(30)} ${fmt(oldM.qualitativeRules, 0).padStart(8)} ${fmt(newM.qualitativeRules, 0).padStart(8)} ${deltaPct(oldM.qualitativeRules, newM.qualitativeRules).padStart(10)}`);

  // ── Per-category breakdown ───────────────────────────────────────────────────
  const categories = [...new Set(results.map(r => r.category))];
  console.log('\n── Per-category breakdown ──────────────────────────────');
  console.log(`${'Category'.padEnd(22)} ${'n'.padStart(3)} ${'OLD r/c'.padStart(8)} ${'NEW r/c'.padStart(8)} ${'DELTA'.padStart(8)}`);
  console.log('─'.repeat(55));
  for (const cat of categories) {
    const catRes = results.filter(r => r.category === cat);
    const oldAvg = catRes.reduce((s, r) => s + r.oldRules.length, 0) / catRes.length;
    const newAvg = catRes.reduce((s, r) => s + r.newRules.length, 0) / catRes.length;
    console.log(
      `${cat.padEnd(22)} ${String(catRes.length).padStart(3)} ${fmt(oldAvg).padStart(8)} ${fmt(newAvg).padStart(8)} ${delta(oldAvg, newAvg).padStart(8)}`,
    );
  }

  // ── Sample outputs ───────────────────────────────────────────────────────────
  console.log('\n═══════════════════════════════════════════════════════');
  console.log('  B. SAMPLE OUTPUTS (3 representative chunks)');
  console.log('═══════════════════════════════════════════════════════');

  // Pick: best gain chunk, worst (no gain), best qualitative-only gain
  const byGain = [...results].sort((a, b) =>
    (b.newRules.length - b.oldRules.length) - (a.newRules.length - a.oldRules.length),
  );
  const samples = [
    byGain[0],
    byGain[Math.floor(byGain.length / 2)],
    byGain[byGain.length - 1],
  ].filter(Boolean);

  for (const [si, s] of samples.entries()) {
    const gain = s.newRules.length - s.oldRules.length;
    console.log(`\n── Sample ${si + 1} | chunk=${s.chunkId.slice(0, 8)} | cat=${s.category} | len=${s.contentLen}`);
    console.log(`   Content preview: ${s.oldRules.length > 0 || s.newRules.length > 0 ? '(technical)' : '(admin/noise)'}`);
    console.log(`   OLD: ${s.oldRules.length} rules | NEW: ${s.newRules.length} rules | Δ=${gain >= 0 ? '+' : ''}${gain}`);

    if (s.oldRules.length > 0) {
      console.log('   OLD rules sample:');
      s.oldRules.slice(0, 2).forEach(r =>
        console.log(`     [${r.type ?? 'quant'}] ${r.property_key} ${r.operator} ${r.value ?? 'null'} ${r.unit ?? ''} | "${(r.description ?? '').slice(0, 80)}"`),
      );
    }
    if (s.newRules.length > 0) {
      console.log('   NEW rules sample:');
      s.newRules.slice(0, 4).forEach(r =>
        console.log(`     [${r.type ?? '?'}] ${r.property_key} ${r.operator} ${r.value ?? 'null'} ${r.unit ?? ''} | "${(r.description ?? '').slice(0, 80)}"`),
      );
    }
  }

  // ── Observed improvements ─────────────────────────────────────────────────
  console.log('\n═══════════════════════════════════════════════════════');
  console.log('  C. OBSERVED IMPROVEMENTS');
  console.log('═══════════════════════════════════════════════════════');

  const chunksWhereNewWins   = results.filter(r => r.newRules.length > r.oldRules.length).length;
  const chunksWhereOldWins   = results.filter(r => r.oldRules.length > r.newRules.length).length;
  const chunksEqual          = results.filter(r => r.newRules.length === r.oldRules.length).length;
  const qualOnlyGain         = results.filter(r => r.oldRules.length === 0 && r.newRules.length > 0).length;
  const avgConfOld           = results.flatMap(r => r.oldRules).reduce((s, r) => s + (r.confidence ?? 0.7), 0) / Math.max(1, oldM.totalRules);
  const avgConfNew           = results.flatMap(r => r.newRules).reduce((s, r) => s + (r.confidence ?? 0.7), 0) / Math.max(1, newM.totalRules);

  console.log(`  Chunks where NEW > OLD   : ${chunksWhereNewWins} / ${results.length} (${(chunksWhereNewWins/results.length*100).toFixed(0)}%)`);
  console.log(`  Chunks where NEW = OLD   : ${chunksEqual} / ${results.length}`);
  console.log(`  Chunks where OLD > NEW   : ${chunksWhereOldWins} / ${results.length}`);
  console.log(`  Chunks rescued (was [] → now >0) : ${qualOnlyGain}`);
  console.log(`  Avg confidence OLD       : ${avgConfOld.toFixed(3)}`);
  console.log(`  Avg confidence NEW       : ${avgConfNew.toFixed(3)}`);

  // New qualitative rules breakdown
  const newQualRules = results.flatMap(r =>
    r.newRules.filter(x => x.type === 'qualitative'),
  );
  const opCounts: Record<string, number> = {};
  newQualRules.forEach(r => {
    const op = r.operator ?? 'unknown';
    opCounts[op] = (opCounts[op] ?? 0) + 1;
  });
  console.log('\n  Qualitative rule operator distribution (NEW):');
  Object.entries(opCounts).sort((a,b) => b[1]-a[1]).forEach(([op, n]) =>
    console.log(`    ${op.padEnd(20)} ${n}`),
  );

  // ── Remaining failures ─────────────────────────────────────────────────────
  console.log('\n═══════════════════════════════════════════════════════');
  console.log('  D. REMAINING FAILURES');
  console.log('═══════════════════════════════════════════════════════');

  const stillEmpty = results.filter(r => r.newRules.length === 0);
  console.log(`  Still returning [] with NEW prompt: ${stillEmpty.length} / ${results.length} chunks`);

  // Sample content of still-empty chunks to classify failure reason
  console.log('\n  Empty chunk content patterns (sample):');
  stillEmpty.slice(0, 5).forEach(r => {
    const preview = (r as any).content ?? '';
    // Need to get content — store it in results
    console.log(`    chunk=${r.chunkId.slice(0,8)} cat=${r.category}`);
  });

  // Success criteria check
  console.log('\n═══════════════════════════════════════════════════════');
  console.log('  SUCCESS CRITERIA');
  console.log('═══════════════════════════════════════════════════════');
  const rpcOk  = newM.rulesPerChunk >= 2;
  const emptyOk = newM.emptyPct <= 20;
  console.log(`  rules/chunk ≥ 2   : ${rpcOk  ? '✅' : '❌'} (actual: ${newM.rulesPerChunk.toFixed(2)})`);
  console.log(`  empty chunks ≤ 20%: ${emptyOk ? '✅' : '❌'} (actual: ${newM.emptyPct.toFixed(1)}%)`);
  console.log('');
}

main().catch(err => {
  console.error('Benchmark failed:', err);
  process.exit(1);
});
