// ─────────────────────────────────────────────────────────────────────
// Cron worker — Phase 3A
// Scheduled refresh jobs for pipeline data (Railway cron / standalone)
// Start with: node --loader ts-node/esm src/workers/cron.ts
// ─────────────────────────────────────────────────────────────────────

import { PipelineOrchestrator } from '../core/orchestration/PipelineOrchestrator.js';

const orchestrator = new PipelineOrchestrator();

// ─────────────────────────────────────────────────────────────────
// Simple cron scheduler (avoid heavy dependencies for now)
// Replace with node-cron if preferred: npm i node-cron @types/node-cron
// ─────────────────────────────────────────────────────────────────

interface Job {
  name: string;
  intervalMs: number;
  handler: () => Promise<void>;
  lastRun?: Date;
}

const ONE_DAY_MS    = 24 * 60 * 60 * 1000;
const SEVEN_DAYS_MS = 7 * ONE_DAY_MS;
const TWO_WEEKS_MS  = 14 * ONE_DAY_MS;

const JOBS: Job[] = [
  {
    name:       'entreprise-enrichment-refresh',
    intervalMs: SEVEN_DAYS_MS,
    handler:    async () => {
      console.log('[cron] Running weekly entreprise enrichment refresh...');
      await orchestrator.refreshAllEntreprises();
      console.log('[cron] Entreprise refresh complete');
    },
  },
  {
    name:       'project-context-refresh',
    intervalMs: TWO_WEEKS_MS,
    handler:    async () => {
      console.log('[cron] Running fortnightly project context refresh...');
      await orchestrator.refreshAllProjectContexts();
      console.log('[cron] Project context refresh complete');
    },
  },
];

function shouldRun(job: Job): boolean {
  if (!job.lastRun) return true;
  return Date.now() - job.lastRun.getTime() >= job.intervalMs;
}

async function runDueJobs(): Promise<void> {
  for (const job of JOBS) {
    if (!shouldRun(job)) continue;

    try {
      await job.handler();
      job.lastRun = new Date();
    } catch (err) {
      console.error(`[cron] Job "${job.name}" failed:`, err);
    }
  }
}

// Check every hour which jobs are due
const CHECK_INTERVAL_MS = 60 * 60 * 1000;

console.log('[cron] Worker started. Checking jobs every hour.');
console.log('[cron] Registered jobs:', JOBS.map(j => j.name).join(', '));

// Run immediately on startup, then on interval
runDueJobs();
setInterval(runDueJobs, CHECK_INTERVAL_MS);

// Keep process alive
process.on('SIGTERM', () => { console.log('[cron] SIGTERM received — shutting down'); process.exit(0); });
process.on('SIGINT',  () => { console.log('[cron] SIGINT received — shutting down');  process.exit(0); });
