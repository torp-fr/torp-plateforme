#!/usr/bin/env tsx
/**
 * claudeBootstrap.ts — Session bootstrap for AI-assisted development
 *
 * Reads CLAUDE.md and PROJECT_CONTEXT.md, scans live repo state,
 * and prints a concise session summary so Claude Code understands
 * the project before making any changes.
 *
 * Usage:
 *   pnpm claude:bootstrap
 */

import fs   from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

// ─── helpers ──────────────────────────────────────────────────────────────────

function exists(p: string): boolean {
  return fs.existsSync(p);
}

function countFiles(dir: string, ext: RegExp): number {
  if (!exists(dir)) return 0;
  let count = 0;
  function walk(d: string): void {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      if (e.isDirectory() && e.name !== 'node_modules' && e.name !== '__tests__') {
        walk(path.join(d, e.name));
      } else if (e.isFile() && ext.test(e.name)) {
        count++;
      }
    }
  }
  walk(dir);
  return count;
}

function listDir(dir: string, filter?: (n: string) => boolean): string[] {
  if (!exists(dir)) return [];
  const entries = fs.readdirSync(dir);
  return filter ? entries.filter(filter) : entries;
}

const C = {
  bold:  '\x1b[1m',
  cyan:  '\x1b[36m',
  green: '\x1b[32m',
  yellow:'\x1b[33m',
  dim:   '\x1b[2m',
  reset: '\x1b[0m',
};

function h1(t: string): void {
  console.log(`\n${C.bold}${C.cyan}${'═'.repeat(64)}${C.reset}`);
  console.log(`${C.bold}${C.cyan}  ${t}${C.reset}`);
  console.log(`${C.bold}${C.cyan}${'═'.repeat(64)}${C.reset}`);
}

function h2(t: string): void {
  console.log(`\n${C.bold}── ${t} ${'─'.repeat(Math.max(0, 58 - t.length))}${C.reset}`);
}

function row(label: string, value: string): void {
  const pad = 28;
  console.log(`  ${C.dim}${label.padEnd(pad)}${C.reset}${value}`);
}

// ─── scan ─────────────────────────────────────────────────────────────────────

const engines = [
  ...listDir(path.join(ROOT, 'src/core/engines'), n => n.endsWith('.engine.ts')),
  ...listDir(path.join(ROOT, 'src/core/trust'), n => n.endsWith('.engine.ts')),
];

const edgeFunctions = listDir(path.join(ROOT, 'supabase/functions'), n => !n.startsWith('_') && !n.includes('.'));
const migrations    = listDir(path.join(ROOT, 'supabase/migrations'), n => n.endsWith('.sql'));
const aiServices    = listDir(path.join(ROOT, 'src/services/ai'), n => n.endsWith('.service.ts'));
const ragServices   = countFiles(path.join(ROOT, 'src/core/rag'), /\.service\.ts$/);
const workerFiles   = countFiles(path.join(ROOT, 'rag-worker'), /\.(js|ts)$/);
const ingestionFiles = countFiles(path.join(ROOT, 'src/core/knowledge/ingestion'), /\.ts$/);

const hasClaude  = exists(path.join(ROOT, 'CLAUDE.md'));
const hasContext = exists(path.join(ROOT, 'PROJECT_CONTEXT.md'));

// ─── print ────────────────────────────────────────────────────────────────────

h1('TORP Platform — Claude Session Bootstrap');

console.log(`\n  ${C.dim}Project: TORP — Construction Quote Analysis (Devis BTP → Trust Score A–E)${C.reset}`);

h2('Context files');
row('CLAUDE.md', hasClaude  ? `${C.green}✓ present${C.reset}` : `${C.yellow}⚠ missing — run: pnpm context:generate${C.reset}`);
row('PROJECT_CONTEXT.md', hasContext ? `${C.green}✓ present${C.reset}` : `${C.yellow}⚠ missing — run: pnpm context:generate${C.reset}`);

h2('Engine pipeline');
for (const e of engines) {
  const name = e.replace('.engine.ts', '');
  console.log(`  ${C.dim}·${C.reset} ${name}`);
}
row('\nTotal engines', `${C.bold}${engines.length}${C.reset}`);

h2('AI & RAG');
row('AI services', String(aiServices.length));
row('RAG services', String(ragServices));
row('Ingestion files', String(ingestionFiles));

h2('Infrastructure');
row('Edge Functions', String(edgeFunctions.length));
row('DB migrations', String(migrations.length));
row('Worker files', String(workerFiles));

h2('Key subsystems');
console.log(`
  ${C.bold}1. Engine pipeline${C.reset}
     ${C.dim}src/core/engines/ + src/core/trust/${C.reset}
     ${C.dim}Orchestrated by: src/core/platform/engineOrchestrator.ts${C.reset}

  ${C.bold}2. RAG knowledge system${C.reset}
     ${C.dim}src/core/rag/ — semantic + hybrid search, context building${C.reset}
     ${C.dim}Table: knowledge_chunks.embedding_vector VECTOR(1536) (Phase 42)${C.reset}

  ${C.bold}3. Knowledge ingestion${C.reset}
     ${C.dim}Frontend: src/services/knowledge/knowledgeStepRunner.service.ts${C.reset}
     ${C.dim}Worker:   rag-worker/worker.js (standalone Node.js)${C.reset}
     ${C.dim}Trigger:  on_document_pending → rag-ingestion Edge Function${C.reset}

  ${C.bold}4. AI orchestration${C.reset}
     ${C.dim}src/services/ai/aiOrchestrator.service.ts${C.reset}
     ${C.dim}src/services/ai/hybrid-ai.service.ts (Claude + OpenAI fallback)${C.reset}
     ${C.dim}src/services/ai/knowledge-brain.service.ts (RAG-augmented)${C.reset}
`);

h2('Critical constraints — read before editing');
console.log(`
  ${C.yellow}⚠${C.reset}  knowledge_chunks column is ${C.bold}embedding_vector${C.reset} (not "embedding")
  ${C.yellow}⚠${C.reset}  VECTOR(1536) — Edge Function must use dimensions=1536 (Phase 42)
  ${C.yellow}⚠${C.reset}  rag-worker/worker.js is ${C.bold}standalone${C.reset} — changes in src/ do not apply to it
  ${C.yellow}⚠${C.reset}  Engine order in orchestrator is ${C.bold}fixed${C.reset} — do not reorder
  ${C.yellow}⚠${C.reset}  Migrations applied via dashboard — CLI shows all as untracked
  ${C.yellow}⚠${C.reset}  Use SUPABASE_SERVICE_ROLE_KEY for server-side knowledge writes
`);

h2('Dev commands');
console.log(`
  ${C.dim}pnpm health:check          →${C.reset} 9-point pipeline health check
  ${C.dim}pnpm fix:pipeline          →${C.reset} reset stuck / failed documents
  ${C.dim}pnpm reindex:embeddings    →${C.reset} backfill NULL embedding_vector chunks
  ${C.dim}pnpm context:generate      →${C.reset} regenerate PROJECT_CONTEXT.md
  ${C.dim}pnpm claude:bootstrap      →${C.reset} this screen
`);

console.log(`${C.bold}${C.cyan}${'═'.repeat(64)}${C.reset}`);
console.log(`${C.dim}  Read CLAUDE.md for full architecture documentation.${C.reset}`);
console.log(`${C.bold}${C.cyan}${'═'.repeat(64)}${C.reset}\n`);
