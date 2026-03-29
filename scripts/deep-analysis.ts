/**
 * Deep Analysis — Phase 7
 *
 * Runs the NEW prompt on 50 chunks and performs quality audit:
 *   1. Classifies every empty-result chunk as A / B / C
 *   2. Identifies false positives in non-empty results
 *   3. Outputs A/B/C distribution + final bottleneck diagnosis
 *
 * Read-only — NO DB writes.
 */
import 'dotenv/config';
import OpenAI from 'openai';
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';

// ── Env ───────────────────────────────────────────────────────────────────────
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

const SAMPLE_SIZE = 50;

// ── NEW prompt (identical to ruleExtraction.worker.ts) ────────────────────────

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
• Obligations fortes → "doit", "doivent", "doit être", "il faut", "est requis",
                       "est obligatoire", "doit permettre de", "doit assurer"
• Obligations douces → "il est nécessaire", "il convient de", "il est recommandé de",
                       "il est préférable de", "on veillera à", "il y a lieu de"
• Interdictions      → "interdit", "ne doit pas", "ne peut pas", "est proscrit",
                       "ne peut être", "est exclu"
• Conformités        → "doit être conforme à", "doit respecter", "selon la norme",
                       "conformément à", "doit satisfaire"
• Exigences          → "doit garantir", "doit résister à", "doit supporter"

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
  }
]

══════════════════════════════════════════════════════════
RÈGLES D'EXTRACTION
══════════════════════════════════════════════════════════
✅ Extraire CHAQUE règle présente dans le texte — même si le texte en contient 15 ou 20
✅ Préférer la sur-extraction à la sous-extraction : en cas de doute, inclure la règle
✅ "property_key" : snake_case court, descriptif du sujet
✅ "description" : reprendre la phrase source presque verbatim
✅ "confidence" : 0.90–1.00 si texte explicite, 0.70–0.89 si indirect, 0.50–0.69 si interprétation
✅ Inclure aussi :
   - résultats de vérification technique (ex : "doit être inférieur à", "doit vérifier que")
   - calculs contenant une contrainte physique explicite
   - valeurs issues d'une condition de sécurité ou de résistance

⚠️ IMPORTANT :
Si une phrase contient une contrainte technique implicite ou une exigence,
même formulée de manière indirecte, elle DOIT être extraite.

❌ Ignorer uniquement :
   - sommaire, table des matières, avant-propos
   - listes administratives (membres de comité, auteurs)
   - mentions légales et notices de droits d'auteur
   CONSERVER les exemples techniques s'ils expriment une contrainte ou une limite.

❌ Aucune valeur inventée : si la valeur numérique est absente ou incertaine → value: null
❌ Pas de doublon : si la même règle est répétée deux fois, la retourner une seule fois

Aucune règle détectable dans le texte → répondre uniquement : []

══════════════════════════════════════════════════════════
TEXTE :
══════════════════════════════════════════════════════════
${content.slice(0, 4000)}`;
}

// ── LLM call ──────────────────────────────────────────────────────────────────

async function runLLM(content: string, category: string): Promise<any[]> {
  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      temperature: 0,
      messages: [
        { role: 'system', content: 'Tu extrais des règles techniques BTP (quantitatives ET qualitatives) en JSON strict. Aucun texte hors du tableau JSON.' },
        { role: 'user',   content: newPrompt(content, category) },
      ],
    });
    const raw = response.choices[0]?.message?.content ?? '[]';
    const cleaned = raw.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '').trim();
    const parsed = JSON.parse(cleaned);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

// ── Classification heuristics ─────────────────────────────────────────────────

/**
 * Signals that a chunk is non-technical (A).
 * Strong markers: TOC keywords, admin lists, header-only content.
 */
const NON_TECHNICAL_SIGNALS = [
  /\bsommaire\b/i,
  /\btable des matières\b/i,
  /\bavant[-\s]propos\b/i,
  /\bintroduction\b.{0,80}\n/i,
  /\bavertissement\b/i,
  /\bpréface\b/i,
  /\bdroits? d[''']auteur/i,
  /\b(AFNOR|CSTB|COPREC|UNTEC)\b.{0,50}(membres?|président|secrétaire|commission)/i,
  /\bcomité de rédaction\b/i,
  /\bgroupe de travail\b/i,
  /\brésumé\s*:/i,
  /^(\d+\.?\s+){3,}/m,                       // dense numbered list (TOC)
  /\bindex\b.{0,40}\n/i,
  /\bbiographie\b|\bbibliographie\b/i,
  /\bremerciments?\b|\bremerciements?\b/i,
];

/**
 * Signals that a chunk contains technical content.
 */
const TECHNICAL_SIGNALS = [
  /\b(mm|cm|m²|m³|kN|MPa|Pa|°C|kPa|dB|W\/m²K|N\/mm²|kN\/m)\b/,
  /\b(épaisseur|largeur|hauteur|longueur|diamètre|profondeur|section|pente|entraxe)\b/i,
  /≥|≤|[<>]=?\s*\d/,
  /\b(minimum|maximum|au moins|au plus|supérieur|inférieur|maximal|minimal)\b/i,
  /\b(doit|doivent|il faut|est requis|est obligatoire|est interdit|ne doit pas)\b/i,
  /\b(conforme|conformément|selon la norme|doit respecter|doit satisfaire)\b/i,
  /\b(résistance|charge|contrainte|pression|débit|coefficient|facteur)\b/i,
  /\b(DTU|Eurocode|NF P|NF EN|ISO \d|EN \d{4})\b/i,
  /\b(\d+,\d+|\d+\.\d+)\s*(mm|cm|m|kN|MPa|Pa|°C|%)\b/i,
];

/**
 * Strong extraction trigger: these keywords almost guarantee a rule exists.
 * If chunk has these AND LLM returned [], it's likely a missed extraction (C).
 */
const STRONG_RULE_SIGNALS = [
  /\bdoit\s+(être|permettre|assurer|garantir|résister|supporter)\b/i,
  /\bne doit pas\b/i,
  /\bil faut\b/i,
  /\best\s+(obligatoire|interdit|proscrit|exclu)\b/i,
  /\bdoit être conforme\b/i,
  /≥\s*\d|≤\s*\d/,
  /\bminimum\s+de\s+\d/i,
  /\bmaximum\s+de\s+\d/i,
  /\bau moins\s+\d/i,
  /\bau plus\s+\d/i,
  /\bépaisseur\b.{0,50}\d+\s*(mm|cm)/i,
  /\bdiamètre\b.{0,50}\d+\s*(mm|cm)/i,
  /\b\d+\s*mm\b/,
  /\b\d+\s*(kN|MPa|Pa|N\/mm²)\b/,
];

type EmptyClass = 'A' | 'B' | 'C';

function classifyEmptyChunk(content: string): { cls: EmptyClass; reason: string } {
  const text = content.slice(0, 4000);

  // Count matching non-technical signals
  const nonTechCount = NON_TECHNICAL_SIGNALS.filter(p => p.test(text)).length;
  const techCount    = TECHNICAL_SIGNALS.filter(p => p.test(text)).length;
  const strongCount  = STRONG_RULE_SIGNALS.filter(p => p.test(text)).length;

  // Very short chunk = administrative noise
  const wordCount = text.trim().split(/\s+/).length;
  if (wordCount < 60) {
    return { cls: 'A', reason: `short chunk (${wordCount} words) — header or section label` };
  }

  // Strong non-technical markers dominate
  if (nonTechCount >= 2 && techCount === 0) {
    return { cls: 'A', reason: `${nonTechCount} non-technical markers, no technical signals` };
  }

  // Mostly non-technical with minimal tech
  if (nonTechCount >= 3 && techCount <= 1 && strongCount === 0) {
    return { cls: 'A', reason: `TOC/admin content (${nonTechCount} markers), no rule triggers` };
  }

  // Has technical content but no strong rule triggers → descriptive/definitional
  if (techCount >= 1 && strongCount === 0) {
    return { cls: 'B', reason: `${techCount} technical signals but 0 strong rule triggers — descriptive content` };
  }

  // Has some non-technical markers but also strong rule signals → possible miss
  if (strongCount >= 1 && nonTechCount <= 1) {
    return { cls: 'C', reason: `${strongCount} strong rule trigger(s) — LLM likely missed extraction` };
  }

  // Mixed: technical signals and some non-technical noise
  if (strongCount >= 2) {
    return { cls: 'C', reason: `${strongCount} strong rule triggers despite ${nonTechCount} noise markers` };
  }

  return { cls: 'B', reason: `${techCount} technical signals but ambiguous — definitional or contextual only` };
}

// ── False positive detection ──────────────────────────────────────────────────

interface ExtractedItem {
  property_key?: string;
  operator?: string;
  value?: number | null;
  unit?: string | null;
  description?: string;
  confidence?: number;
  type?: string;
}

function detectFalsePositives(
  rules: ExtractedItem[],
  content: string,
  chunkId: string,
): Array<{ chunkId: string; rule: ExtractedItem; reason: string }> {
  const fps: Array<{ chunkId: string; rule: ExtractedItem; reason: string }> = [];

  for (const rule of rules) {
    // 1. Very low confidence
    if (typeof rule.confidence === 'number' && rule.confidence < 0.55) {
      fps.push({ chunkId, rule, reason: `confidence=${rule.confidence} — below reliable threshold` });
      continue;
    }

    // 2. property_key is too generic or meaningless
    const key = rule.property_key ?? '';
    const tooGeneric = ['n_a', 'n/a', 'regle', 'règle', 'valeur', 'texte', 'contenu', 'general', 'none'];
    if (tooGeneric.includes(key.toLowerCase())) {
      fps.push({ chunkId, rule, reason: `generic property_key="${key}" — not a real property` });
      continue;
    }

    // 3. Quantitative rule with null value (should have been qualitative)
    if (rule.type === 'quantitative' && rule.value === null) {
      fps.push({ chunkId, rule, reason: 'type=quantitative but value=null — misclassified type' });
      continue;
    }

    // 4. Description doesn't seem to state a constraint (too short, just a label)
    const desc = rule.description ?? '';
    if (desc.length < 20 && rule.type === 'qualitative') {
      fps.push({ chunkId, rule, reason: `description too short (${desc.length} chars) — not a real rule` });
      continue;
    }

    // 5. Rule extracts a value that is clearly a reference number (article, section, year)
    if (
      rule.type === 'quantitative' &&
      typeof rule.value === 'number' &&
      rule.unit === null &&
      rule.value >= 1900 && rule.value <= 2030
    ) {
      fps.push({ chunkId, rule, reason: `value=${rule.value} with no unit looks like a year/reference, not a measurement` });
      continue;
    }

    // 6. Operator doesn't match declared type
    const qualOps = ['obligatoire', 'interdit', 'conforme_a', 'recommande'];
    const quantOps = ['>=', '<=', '=', '>', '<'];
    const op = rule.operator ?? '';
    if (rule.type === 'qualitative' && quantOps.includes(op)) {
      fps.push({ chunkId, rule, reason: `type=qualitative but operator="${op}" — inconsistent` });
      continue;
    }
    if (rule.type === 'quantitative' && qualOps.includes(op)) {
      fps.push({ chunkId, rule, reason: `type=quantitative but operator="${op}" — inconsistent` });
      continue;
    }
  }

  return fps;
}

// ── Snippet extraction helper ──────────────────────────────────────────────────

function extractRelevantSnippet(content: string, maxLen = 300): string {
  // Try to find a sentence with a strong rule trigger
  for (const pattern of STRONG_RULE_SIGNALS) {
    const match = pattern.exec(content);
    if (match) {
      const start = Math.max(0, match.index - 60);
      const end   = Math.min(content.length, match.index + 200);
      return content.slice(start, end).replace(/\s+/g, ' ').trim();
    }
  }
  return content.slice(0, maxLen).replace(/\s+/g, ' ').trim();
}

function inferMissedRule(content: string): string {
  // Best-effort inference of what rule should have been extracted
  for (const pattern of STRONG_RULE_SIGNALS) {
    const match = pattern.exec(content);
    if (match) {
      const ctx = content.slice(Math.max(0, match.index - 30), match.index + 150);
      return `"${ctx.replace(/\s+/g, ' ').trim()}"`;
    }
  }
  return '(could not pinpoint exact rule sentence)';
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('  DEEP ANALYSIS — New Prompt Quality Audit');
  console.log('═══════════════════════════════════════════════════════════════\n');

  // 1. Fetch chunks
  console.log(`Fetching ${SAMPLE_SIZE} chunks...`);
  const { data: chunks, error } = await supabase
    .from('knowledge_chunks')
    .select(`
      id,
      content,
      document_id,
      chunk_index,
      knowledge_documents!left(category)
    `)
    .limit(SAMPLE_SIZE)
    .order('created_at', { ascending: false });

  if (error || !chunks) {
    console.error('Fetch error:', error);
    process.exit(1);
  }

  console.log(`Fetched ${chunks.length} chunks.\n`);

  // 2. Run LLM on all chunks
  console.log('Running LLM extraction (this may take ~2 min)...\n');

  interface ChunkResult {
    id: string;
    chunkIndex: number;
    category: string;
    content: string;
    rules: ExtractedItem[];
    isEmpty: boolean;
    emptyClass?: EmptyClass;
    emptyReason?: string;
  }

  const results: ChunkResult[] = [];

  // Process in batches of 5 to avoid rate limits
  const CONCURRENCY = 5;
  for (let i = 0; i < chunks.length; i += CONCURRENCY) {
    const batch = chunks.slice(i, i + CONCURRENCY);
    const batchResults = await Promise.all(batch.map(async (chunk: any) => {
      const category = (Array.isArray(chunk.knowledge_documents)
        ? chunk.knowledge_documents[0]?.category
        : chunk.knowledge_documents?.category) ?? 'DTU';

      const rules = await runLLM(chunk.content, category);
      const isEmpty = rules.length === 0;

      const result: ChunkResult = {
        id:         chunk.id,
        chunkIndex: chunk.chunk_index,
        category,
        content:    chunk.content,
        rules,
        isEmpty,
      };

      if (isEmpty) {
        const { cls, reason } = classifyEmptyChunk(chunk.content);
        result.emptyClass  = cls;
        result.emptyReason = reason;
      }

      return result;
    }));
    results.push(...batchResults);
    process.stdout.write(`  Processed ${Math.min(i + CONCURRENCY, chunks.length)}/${chunks.length}\r`);
  }
  console.log('\nDone.\n');

  // 3. Aggregate metrics
  const totalChunks   = results.length;
  const emptyChunks   = results.filter(r => r.isEmpty);
  const nonEmpty      = results.filter(r => !r.isEmpty);
  const totalRules    = nonEmpty.reduce((s, r) => s + r.rules.length, 0);
  const rulesPerChunk = totalRules / totalChunks;

  const classA = emptyChunks.filter(r => r.emptyClass === 'A');
  const classB = emptyChunks.filter(r => r.emptyClass === 'B');
  const classC = emptyChunks.filter(r => r.emptyClass === 'C');

  // Adjusted empty rate excluding A (non-technical is expected to be empty)
  const adjustedEmpty    = emptyChunks.length - classA.length;
  const technicalChunks  = totalChunks - classA.length;
  const adjustedEmptyPct = technicalChunks > 0 ? (adjustedEmpty / technicalChunks) * 100 : 0;

  // Category breakdown
  const byCategory: Record<string, { total: number; empty: number; rules: number }> = {};
  for (const r of results) {
    if (!byCategory[r.category]) byCategory[r.category] = { total: 0, empty: 0, rules: 0 };
    byCategory[r.category].total++;
    if (r.isEmpty) byCategory[r.category].empty++;
    else byCategory[r.category].rules += r.rules.length;
  }

  // Qualitative vs quantitative
  let qualCount  = 0;
  let quantCount = 0;
  for (const r of nonEmpty) {
    for (const rule of r.rules) {
      if (rule.type === 'qualitative') qualCount++;
      else quantCount++;
    }
  }

  // False positives
  const allFPs: Array<{ chunkId: string; rule: ExtractedItem; reason: string }> = [];
  for (const r of nonEmpty) {
    allFPs.push(...detectFalsePositives(r.rules, r.content, r.id));
  }
  const fpRate = nonEmpty.length > 0 ? (allFPs.length / totalRules) * 100 : 0;

  // ── Output ────────────────────────────────────────────────────────────────

  console.log('═══════════════════════════════════════════════════════════════');
  console.log('  SECTION 1 — OVERALL METRICS');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log(`  Total chunks sampled    : ${totalChunks}`);
  console.log(`  Chunks with rules       : ${nonEmpty.length} (${(nonEmpty.length/totalChunks*100).toFixed(1)}%)`);
  console.log(`  Empty chunks            : ${emptyChunks.length} (${(emptyChunks.length/totalChunks*100).toFixed(1)}%)`);
  console.log(`  Total rules extracted   : ${totalRules}`);
  console.log(`  Rules/chunk (all)       : ${rulesPerChunk.toFixed(2)}`);
  console.log(`  Rules/chunk (non-empty) : ${nonEmpty.length > 0 ? (totalRules/nonEmpty.length).toFixed(2) : 'N/A'}`);
  console.log(`  Qualitative rules       : ${qualCount} (${totalRules > 0 ? (qualCount/totalRules*100).toFixed(1) : 0}%)`);
  console.log(`  Quantitative rules      : ${quantCount} (${totalRules > 0 ? (quantCount/totalRules*100).toFixed(1) : 0}%)`);
  console.log();

  console.log('═══════════════════════════════════════════════════════════════');
  console.log('  SECTION 2 — EMPTY CHUNK CLASSIFICATION (A / B / C)');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log(`  A — Non-technical content  : ${classA.length} (${(classA.length/emptyChunks.length*100).toFixed(1)}% of empty)`);
  console.log(`  B — Technical, no rule     : ${classB.length} (${(classB.length/emptyChunks.length*100).toFixed(1)}% of empty)`);
  console.log(`  C — Missed extraction ⚠️   : ${classC.length} (${(classC.length/emptyChunks.length*100).toFixed(1)}% of empty)`);
  console.log();
  console.log(`  Technical chunks (total - A) : ${technicalChunks}`);
  console.log(`  Adjusted empty rate (B+C)    : ${adjustedEmptyPct.toFixed(1)}%`);
  console.log();

  console.log('═══════════════════════════════════════════════════════════════');
  console.log('  SECTION 3 — CATEGORY BREAKDOWN');
  console.log('═══════════════════════════════════════════════════════════════');
  for (const [cat, stats] of Object.entries(byCategory).sort((a, b) => b[1].total - a[1].total)) {
    const emptyPct = (stats.empty / stats.total * 100).toFixed(0);
    const rpc      = stats.total - stats.empty > 0
      ? (stats.rules / (stats.total - stats.empty)).toFixed(1)
      : 'N/A';
    console.log(`  ${cat.padEnd(22)} total=${stats.total}  empty=${stats.empty} (${emptyPct}%)  rules=${stats.rules}  rules/non-empty=${rpc}`);
  }
  console.log();

  console.log('═══════════════════════════════════════════════════════════════');
  console.log('  SECTION 4 — CLASS A SAMPLES (Non-technical — expected empty)');
  console.log('═══════════════════════════════════════════════════════════════');
  for (const r of classA.slice(0, 5)) {
    console.log(`\n  [A] ${r.id.slice(0, 8)}… (${r.category}) chunk_index=${r.chunkIndex}`);
    console.log(`      Reason: ${r.emptyReason}`);
    console.log(`      Content: "${r.content.slice(0, 150).replace(/\n/g, ' ').trim()}…"`);
  }
  console.log();

  console.log('═══════════════════════════════════════════════════════════════');
  console.log('  SECTION 5 — CLASS B SAMPLES (Technical but no rule)');
  console.log('═══════════════════════════════════════════════════════════════');
  for (const r of classB.slice(0, 5)) {
    console.log(`\n  [B] ${r.id.slice(0, 8)}… (${r.category}) chunk_index=${r.chunkIndex}`);
    console.log(`      Reason: ${r.emptyReason}`);
    console.log(`      Content: "${r.content.slice(0, 200).replace(/\n/g, ' ').trim()}…"`);
  }
  console.log();

  console.log('═══════════════════════════════════════════════════════════════');
  console.log('  SECTION 6 — CLASS C EXAMPLES (Missed extractions — CRITICAL)');
  console.log('═══════════════════════════════════════════════════════════════');
  if (classC.length === 0) {
    console.log('  ✅ No class C chunks detected.');
  } else {
    for (const r of classC.slice(0, 5)) {
      const snippet   = extractRelevantSnippet(r.content);
      const missedRule = inferMissedRule(r.content);
      console.log(`\n  [C] ${r.id.slice(0, 8)}… (${r.category}) chunk_index=${r.chunkIndex}`);
      console.log(`      Reason: ${r.emptyReason}`);
      console.log(`      Snippet: "${snippet}"`);
      console.log(`      Rule that SHOULD have been extracted: ${missedRule}`);
      console.log(`      Why LLM missed it: likely over-filtered by abstract framing or implicit constraint`);
    }
  }
  console.log();

  console.log('═══════════════════════════════════════════════════════════════');
  console.log('  SECTION 7 — FALSE POSITIVES (Top 5)');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log(`  Detected: ${allFPs.length}/${totalRules} rules flagged (${fpRate.toFixed(1)}%)\n`);
  if (allFPs.length === 0) {
    console.log('  ✅ No false positives detected by heuristics.');
  } else {
    for (const fp of allFPs.slice(0, 5)) {
      console.log(`\n  [FP] chunk=${fp.chunkId.slice(0, 8)}…`);
      console.log(`       key="${fp.rule.property_key}"  op="${fp.rule.operator}"  val=${fp.rule.value}  type=${fp.rule.type}`);
      console.log(`       desc: "${(fp.rule.description ?? '').slice(0, 100)}"`);
      console.log(`       flag: ${fp.reason}`);
    }
  }
  console.log();

  console.log('═══════════════════════════════════════════════════════════════');
  console.log('  SECTION 8 — FINAL DIAGNOSIS');
  console.log('═══════════════════════════════════════════════════════════════');

  const bottleneck = diagnose({
    totalChunks,
    classA: classA.length,
    classB: classB.length,
    classC: classC.length,
    emptyTotal: emptyChunks.length,
    fpRate,
    technicalChunks,
    adjustedEmptyPct,
    byCategory,
  });

  console.log(bottleneck);
  console.log();
}

interface DiagnoseInput {
  totalChunks: number;
  classA: number;
  classB: number;
  classC: number;
  emptyTotal: number;
  fpRate: number;
  technicalChunks: number;
  adjustedEmptyPct: number;
  byCategory: Record<string, { total: number; empty: number; rules: number }>;
}

function diagnose(d: DiagnoseInput): string {
  const lines: string[] = [];

  const pctA = d.emptyTotal > 0 ? (d.classA / d.emptyTotal * 100) : 0;
  const pctC = d.emptyTotal > 0 ? (d.classC / d.emptyTotal * 100) : 0;

  lines.push('  ┌─────────────────────────────────────────────────────────┐');
  lines.push('  │  BOTTLENECK ANALYSIS                                    │');
  lines.push('  └─────────────────────────────────────────────────────────┘');

  // Primary bottleneck
  if (d.classA > d.classB && d.classA > d.classC) {
    lines.push(`\n  PRIMARY BOTTLENECK: DATA QUALITY / CORPUS COMPOSITION`);
    lines.push(`  ${pctA.toFixed(0)}% of empty chunks are non-technical (A class) — they should not`);
    lines.push(`  produce rules by design. The empty rate is inflated by corpus noise.`);
    lines.push(`  → Action: Pre-filter non-technical chunks before extraction pass.`);
  } else if (d.classC > d.classB && pctC > 20) {
    lines.push(`\n  PRIMARY BOTTLENECK: PROMPT QUALITY`);
    lines.push(`  ${pctC.toFixed(0)}% of empty chunks have strong rule signals that were missed.`);
    lines.push(`  The prompt is not aggressive enough for implicit or technical constraint phrasing.`);
    lines.push(`  → Action: Add more trigger patterns, lower confidence threshold, chain-of-thought.`);
  } else if (d.classB > d.classA && d.classC < d.classB * 0.5) {
    lines.push(`\n  PRIMARY BOTTLENECK: INHERENTLY NON-EXTRACTABLE CONTENT`);
    lines.push(`  Most empty chunks are technical but contain definitions, context, or`);
    lines.push(`  descriptive prose without obligations (B class). This is a data reality,`);
    lines.push(`  not a prompt failure — no prompt can extract rules that don't exist.`);
    lines.push(`  → Adjusted empty rate (B+C only): ${d.adjustedEmptyPct.toFixed(1)}%`);
    lines.push(`  → Action: Accept current performance. Focus on chunking strategy instead.`);
  } else {
    lines.push(`\n  PRIMARY BOTTLENECK: MIXED — DATA + CHUNKING`);
    lines.push(`  Empty chunks are split across A/B/C without a dominant class.`);
    lines.push(`  Prompt is working but corpus has structural issues (too much admin/context content).`);
    lines.push(`  → Action: Review chunking strategy to create rule-dense chunks.`);
  }

  // False positive verdict
  lines.push('');
  if (d.fpRate < 5) {
    lines.push(`  NOISE: Low (${d.fpRate.toFixed(1)}%) — extraction precision is acceptable.`);
  } else if (d.fpRate < 15) {
    lines.push(`  NOISE: Moderate (${d.fpRate.toFixed(1)}%) — some rule-like non-rules are being extracted.`);
    lines.push(`  → Review confidence threshold; consider raising minimum to 0.65.`);
  } else {
    lines.push(`  NOISE: High (${d.fpRate.toFixed(1)}%) — too many false positives, risk of DB pollution.`);
    lines.push(`  → Strengthen property_key validation and operator/type consistency checks.`);
  }

  // Category-specific notes
  lines.push('');
  lines.push('  CATEGORY NOTES:');
  for (const [cat, stats] of Object.entries(d.byCategory)) {
    const emptyPct = stats.total > 0 ? (stats.empty / stats.total * 100) : 0;
    if (emptyPct > 80) {
      lines.push(`  ⚠️  ${cat}: ${emptyPct.toFixed(0)}% empty — likely non-technical corpus (e.g. housing policy text)`);
    } else if (emptyPct > 50) {
      lines.push(`  ⚡ ${cat}: ${emptyPct.toFixed(0)}% empty — mixed content, chunking may be too coarse`);
    } else if (emptyPct <= 30 && stats.total >= 5) {
      lines.push(`  ✅ ${cat}: ${emptyPct.toFixed(0)}% empty — good extraction density`);
    }
  }

  lines.push('');
  lines.push(`  SUMMARY TABLE:`);
  lines.push(`  A (non-technical)   : ${d.classA.toString().padStart(3)} / ${d.emptyTotal} empty = ${pctA.toFixed(0)}%  → expected empty, not a failure`);
  lines.push(`  B (technical/defn)  : ${d.classB.toString().padStart(3)} / ${d.emptyTotal} empty = ${(d.emptyTotal > 0 ? d.classB/d.emptyTotal*100 : 0).toFixed(0)}%  → inherently non-extractable`);
  lines.push(`  C (missed)          : ${d.classC.toString().padStart(3)} / ${d.emptyTotal} empty = ${pctC.toFixed(0)}%  → prompt/chunking failure`);
  lines.push(`  False positives     : ${d.fpRate.toFixed(1)}% of extracted rules`);

  return lines.join('\n');
}

main().catch(err => { console.error(err); process.exit(1); });
