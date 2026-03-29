/**
 * Task Loop Engine — Self-Healing Edition
 *
 * Full lifecycle: RUN → VALIDATE → DIAGNOSE → FIX → RETEST
 *
 * For each task the engine:
 *   1. Runs extraction via runTask()
 *   2. Validates the result via validateResult()
 *   3. If validation PASSES → marks task as 'passed'
 *   4. If validation FAILS  → enters the fix cycle:
 *        a. diagnoseFailure() identifies the root cause
 *        b. applyFix()        mutates the task config in the registry
 *        c. runTask()         re-runs with the updated config
 *        d. validateResult()  re-checks the new result
 *        e. Repeat up to MAX_FIX_ATTEMPTS times
 *   5. If still failing after all fix attempts → marks 'failed',
 *      creates a standard retry task when attempts remain
 *
 * Guarantees:
 *   - Each fix attempt tries a NEW strategy (no repeated fixes)
 *   - MAX_FIX_ATTEMPTS = 3 per task per outer attempt
 *   - The task object is always re-fetched from the registry before
 *     each re-run so the updated batch_size / validation is used
 *   - All events are logged: run metrics, diagnosis, fix delta, improvement
 *
 * Entry point: runLoop()
 * Can also be run directly: npx tsx tasks/taskLoop.ts
 */

import 'dotenv/config';
import { TaskRegistry, TASK_CATEGORIES } from './taskRegistry';
import type { Task } from './taskRegistry';
import { runTask } from './taskRunner';
import type { TaskRunResult } from './taskRunner';
import { validateResult } from './taskValidator';
import type { ValidationResult } from './taskValidator';
import { diagnoseFailure } from './taskDiagnoser';
import type { Diagnosis, FixStrategy } from './taskDiagnoser';
import { applyFix } from './taskFixer';
import type { AppliedFix } from './taskFixer';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Maximum fix attempts per task per outer attempt before giving up */
const MAX_FIX_ATTEMPTS = 3;

/** Pause between sequential tasks (ms) */
const INTER_TASK_DELAY_MS = 500;

// ---------------------------------------------------------------------------
// Structured logger
// ---------------------------------------------------------------------------

function ts(): string {
  return new Date().toISOString();
}

function logTask(task: Task, event: string, data?: Record<string, unknown>): void {
  const prefix =
    `[TaskLoop][${ts()}]` +
    ` task_id=${task.id}` +
    ` category=${task.category}` +
    ` attempt=${task.attempt}/${task.max_attempts}`;
  const payload = data ? ` | ${JSON.stringify(data)}` : '';
  console.log(`${prefix} | ${event}${payload}`);
}

function logLoop(event: string, data?: Record<string, unknown>): void {
  const prefix  = `[TaskLoop][${ts()}]`;
  const payload = data ? ` | ${JSON.stringify(data)}` : '';
  console.log(`${prefix} ${event}${payload}`);
}

// ---------------------------------------------------------------------------
// Improvement metric
// ---------------------------------------------------------------------------

/**
 * Compare two consecutive run results and produce a human-readable improvement
 * summary for logging. Positive deltas indicate improvement.
 */
function computeImprovement(
  before: TaskRunResult,
  after:  TaskRunResult,
): Record<string, unknown> {
  const rulesDelta  = after.rules_after_dedup  - before.rules_after_dedup;
  const dupImprove  = before.duplication_rate  - after.duplication_rate;  // positive = lower dup
  const errorImprove = before.errors.length    - after.errors.length;      // positive = fewer errors

  const direction =
    rulesDelta > 0 || dupImprove > 0.005 || errorImprove > 0
      ? 'improved'
      : rulesDelta < 0 || dupImprove < -0.005 || errorImprove < 0
        ? 'degraded'
        : 'unchanged';

  return {
    direction,
    rules_before:     before.rules_after_dedup,
    rules_after:      after.rules_after_dedup,
    rules_delta:      rulesDelta >= 0 ? `+${rulesDelta}` : String(rulesDelta),
    dup_rate_before:  `${(before.duplication_rate * 100).toFixed(1)}%`,
    dup_rate_after:   `${(after.duplication_rate * 100).toFixed(1)}%`,
    dup_improvement:  `${(dupImprove * 100).toFixed(1)}pp`,
    errors_before:    before.errors.length,
    errors_after:     after.errors.length,
    duration_before:  `${before.duration_ms}ms`,
    duration_after:   `${after.duration_ms}ms`,
  };
}

// ---------------------------------------------------------------------------
// Log helpers for individual steps
// ---------------------------------------------------------------------------

function logRunComplete(task: Task, result: TaskRunResult, tag = ''): void {
  logTask(task, `RUN_COMPLETE${tag}`, {
    chunks_fetched:    result.chunks_fetched,
    chunks_processed:  result.chunks_processed,
    chunks_skipped:    result.chunks_skipped,
    rules_extracted:   result.rules_extracted,
    rules_after_dedup: result.rules_after_dedup,
    rules_inserted:    result.rules_inserted,
    duplication_rate:  `${(result.duplication_rate * 100).toFixed(1)}%`,
    errors:            result.errors.length,
    duration_ms:       result.duration_ms,
  });
}

function logValidate(task: Task, validation: ValidationResult, tag = ''): void {
  logTask(task, `VALIDATE${tag}:${validation.passed ? 'PASS' : 'FAIL'}`, {
    summary: validation.summary,
    checks: validation.checks.map((c) => ({
      name:    c.name,
      passed:  c.passed,
      actual:  c.actual,
      message: c.message,
    })),
  });
}

function logDiagnose(task: Task, diagnosis: Diagnosis, fixN: number): void {
  logTask(task, `DIAGNOSE [fix=${fixN}/${MAX_FIX_ATTEMPTS}]`, {
    code:            diagnosis.code,
    severity:        diagnosis.severity,
    description:     diagnosis.description,
    root_cause:      diagnosis.root_cause,
    suggested_fixes: diagnosis.suggested_fixes,
    metrics:         diagnosis.metrics,
  });
}

function logFixApplied(task: Task, fix: AppliedFix, fixN: number): void {
  logTask(task, `FIX_APPLIED [fix=${fixN}/${MAX_FIX_ATTEMPTS}]`, {
    strategy:     fix.strategy,
    description:  fix.description,
    param_before: fix.param_before,
    param_after:  fix.param_after,
    applied:      fix.applied,
  });
}

function logImprovement(
  task:       Task,
  before:     TaskRunResult,
  after:      TaskRunResult,
  fixN:       number,
): void {
  logTask(task, `IMPROVEMENT [fix=${fixN}/${MAX_FIX_ATTEMPTS}]`, computeImprovement(before, after));
}

// ---------------------------------------------------------------------------
// Fix cycle state (per task, per outer attempt)
// ---------------------------------------------------------------------------

interface FixCycleState {
  fix_attempt:    number;
  applied_fixes:  FixStrategy[];
}

// ---------------------------------------------------------------------------
// Single-task lifecycle: RUN → VALIDATE → [DIAGNOSE → FIX → RETEST]* → DECIDE
// ---------------------------------------------------------------------------

/**
 * Run one task through the full self-healing lifecycle.
 *
 * @returns true  when the task ultimately passes (with or without fixes)
 *          false when it fails after exhausting all fix attempts
 */
async function processTask(task: Task): Promise<boolean> {

  // ── Mark running ───────────────────────────────────────────────────────────
  TaskRegistry.update(task.id, {
    status:      'running',
    last_run_at: new Date().toISOString(),
  });
  logTask(task, 'STARTED');

  // ── Initial run ────────────────────────────────────────────────────────────
  let result: TaskRunResult;
  try {
    result = await runTask(task);
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    logTask(task, 'RUN_ERROR', { error });
    TaskRegistry.update(task.id, { status: 'failed', error });
    // An unhandled throw (e.g. DB unreachable) is not diagnosable — defer to
    // the standard retry mechanism.
    const retry = TaskRegistry.createRetryTask(task);
    if (retry) {
      logTask(retry, 'RETRY_CREATED', { attempt: retry.attempt, reason: 'run_error' });
    } else {
      logTask(task, 'MAX_ATTEMPTS_REACHED');
    }
    return false;
  }

  logRunComplete(task, result);

  // ── Initial validation ─────────────────────────────────────────────────────
  let validation: ValidationResult = validateResult(result, task.validation);
  logValidate(task, validation);

  if (validation.passed) {
    TaskRegistry.update(task.id, { status: 'passed' });
    logTask(task, 'STATUS → passed');
    return true;
  }

  // ── Fix cycle ──────────────────────────────────────────────────────────────
  const fixState: FixCycleState = { fix_attempt: 0, applied_fixes: [] };

  for (let n = 1; n <= MAX_FIX_ATTEMPTS; n++) {
    fixState.fix_attempt = n;

    // Always work from the latest registry state — prior fixes may have
    // already mutated batch_size or validation on this task id.
    const currentTask: Task = TaskRegistry.get(task.id) ?? task;

    // ── Diagnose ─────────────────────────────────────────────────────────────
    const diagnosis: Diagnosis = diagnoseFailure(currentTask, validation, result);
    logDiagnose(currentTask, diagnosis, n);

    // ── Fix ──────────────────────────────────────────────────────────────────
    const fix: AppliedFix = applyFix(currentTask, diagnosis, fixState.applied_fixes);
    logFixApplied(currentTask, fix, n);

    if (!fix.applied) {
      // NO_FIX_AVAILABLE: no strategy left to try; exit fix cycle early.
      logTask(currentTask, `FIX_UNAVAILABLE [fix=${n}/${MAX_FIX_ATTEMPTS}]`, {
        diagnosis_code:  diagnosis.code,
        tried:           fixState.applied_fixes,
        reason:          'All suggested strategies already applied or none available',
      });
      break;
    }

    fixState.applied_fixes.push(fix.strategy);

    // ── Retest ───────────────────────────────────────────────────────────────
    // Re-fetch the task so runTask receives the updated batch_size / validation.
    const retestTask: Task = TaskRegistry.get(task.id) ?? currentTask;
    logTask(retestTask, `RETEST [fix=${n}/${MAX_FIX_ATTEMPTS}]`, {
      strategy:   fix.strategy,
      batch_size: retestTask.batch_size,
      min_rules:  retestTask.validation.min_rules,
      max_dup:    `${(retestTask.validation.max_duplication_rate * 100).toFixed(0)}%`,
    });

    const prevResult = result;
    try {
      result = await runTask(retestTask);
    } catch (err) {
      const error = err instanceof Error ? err.message : String(err);
      logTask(retestTask, `RETEST_ERROR [fix=${n}/${MAX_FIX_ATTEMPTS}]`, { error });
      // Abort the fix cycle — the retest itself crashed.
      break;
    }

    logRunComplete(retestTask, result, ` [fix=${n}/${MAX_FIX_ATTEMPTS}]`);
    logImprovement(retestTask, prevResult, result, n);

    // ── Re-validate ──────────────────────────────────────────────────────────
    // Use the UPDATED task's validation thresholds (a fix may have relaxed them).
    validation = validateResult(result, retestTask.validation);
    logValidate(retestTask, validation, ` [fix=${n}/${MAX_FIX_ATTEMPTS}]`);

    if (validation.passed) {
      TaskRegistry.update(task.id, { status: 'passed' });
      logTask(retestTask, 'STATUS → passed (self-healed)', {
        fixes_applied:  fixState.applied_fixes,
        fix_cycles:     n,
      });
      return true;
    }
  }

  // ── All fix attempts exhausted — fall through to standard retry ────────────
  TaskRegistry.update(task.id, {
    status: 'failed',
    error:  validation.summary,
  });
  logTask(task, 'STATUS → failed', {
    reason:        validation.summary,
    fixes_applied: fixState.applied_fixes,
    fix_cycles:    fixState.fix_attempt,
  });

  const retry = TaskRegistry.createRetryTask(task);
  if (retry) {
    logTask(retry, 'RETRY_CREATED', {
      attempt:      retry.attempt,
      max_attempts: retry.max_attempts,
    });
  } else {
    logTask(task, 'MAX_ATTEMPTS_REACHED — task permanently retired');
  }

  return false;
}

// ---------------------------------------------------------------------------
// Public entry point
// ---------------------------------------------------------------------------

/**
 * Run the self-healing task automation engine until all tasks reach a
 * terminal state ('passed' or 'failed' with exhausted retries).
 *
 * Usage:
 *   import { runLoop } from './tasks/taskLoop';
 *   await runLoop();
 *
 * Or directly:
 *   npx tsx tasks/taskLoop.ts
 */
export async function runLoop(): Promise<void> {
  const initial = TaskRegistry.getAll();

  logLoop('ENGINE STARTING', {
    mode:       'self-healing',
    tasks:      initial.length,
    max_fixes:  MAX_FIX_ATTEMPTS,
    categories: TASK_CATEGORIES,
  });

  console.log('\n── Initial task set ────────────────────────────────────────');
  for (const t of initial) {
    console.log(
      `  ○  ${t.category.padEnd(20)}` +
      `  batch=${t.batch_size}` +
      `  min_rules=${t.validation.min_rules}` +
      `  max_dup=${(t.validation.max_duplication_rate * 100).toFixed(0)}%` +
      `  max_attempts=${t.max_attempts}`,
    );
  }
  console.log('────────────────────────────────────────────────────────────\n');

  let tasksProcessed = 0;
  let task = TaskRegistry.getNextPending();

  while (task) {
    tasksProcessed++;
    await processTask(task);
    task = TaskRegistry.getNextPending();
    if (task) await new Promise<void>((r) => setTimeout(r, INTER_TASK_DELAY_MS));
  }

  // ── Final summary ──────────────────────────────────────────────────────────
  const all     = TaskRegistry.getAll();
  const passed  = all.filter((t) => t.status === 'passed');
  const failed  = all.filter((t) => t.status === 'failed');
  const pending = all.filter((t) => t.status === 'pending' || t.status === 'retrying');

  logLoop('ENGINE COMPLETE', {
    tasks_processed: tasksProcessed,
    passed:          passed.length,
    failed:          failed.length,
    remaining:       pending.length,
  });

  console.log('\n── Final results ───────────────────────────────────────────');
  for (const t of all) {
    const icon   = t.status === 'passed' ? '✓' : t.status === 'failed' ? '✗' : '○';
    const errMsg = t.error
      ? ` — ${t.error.length > 80 ? t.error.slice(0, 77) + '…' : t.error}`
      : '';
    console.log(
      `  ${icon}  ${t.category.padEnd(20)}` +
      `  attempt=${t.attempt}/${t.max_attempts}` +
      `  status=${t.status}${errMsg}`,
    );
  }
  console.log('────────────────────────────────────────────────────────────');
  console.log(`     passed=${passed.length}  failed=${failed.length}  pending=${pending.length}`);
  console.log('────────────────────────────────────────────────────────────\n');
}

// ---------------------------------------------------------------------------
// Direct execution: npx tsx tasks/taskLoop.ts
// ---------------------------------------------------------------------------

const isMain =
  typeof process !== 'undefined' &&
  process.argv[1]?.replace(/\\/g, '/').endsWith('tasks/taskLoop.ts');

if (isMain) {
  runLoop().catch((err) => {
    console.error('[TaskLoop] Unhandled fatal error:', err);
    process.exit(1);
  });
}
