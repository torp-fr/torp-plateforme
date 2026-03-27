/**
 * Task Registry
 *
 * Defines the task structure for category-based rule extraction automation.
 * Each task represents one extraction batch for a single document category.
 *
 * The registry is in-memory, initialized at import time with one task per
 * supported extraction category. The loop engine mutates task state in place.
 *
 * Supported categories (mirrors SUPPORTED_EXTRACTION_CATEGORIES):
 *   DTU | EUROCODE | NORMES | GUIDE_TECHNIQUE | CODE_CONSTRUCTION
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type TaskCategory =
  | 'DTU'
  | 'EUROCODE'
  | 'NORMES'
  | 'GUIDE_TECHNIQUE'
  | 'CODE_CONSTRUCTION';

export type TaskStatus =
  | 'pending'    // waiting to be picked up by the loop
  | 'running'    // currently executing
  | 'passed'     // extraction + validation succeeded
  | 'failed'     // terminal failure (max attempts reached or unrecoverable)
  | 'retrying';  // scheduled for another attempt (created by createRetryTask)

export interface ValidationRules {
  /**
   * Minimum number of unique rules (after cross-chunk deduplication) that must
   * be produced for the batch to be considered valid.
   */
  min_rules: number;
  /**
   * Maximum acceptable duplicate ratio across the batch.
   * 0.0 = no duplicates tolerated. 1.0 = all duplicates tolerated.
   * Computed as: (extracted - after_dedup) / extracted.
   */
  max_duplication_rate: number;
  /**
   * Whether a completely empty result (0 rules extracted) is acceptable.
   * True for categories whose documents may contain no actionable rules
   * (e.g. preamble-only legal chunks).
   */
  allow_empty: boolean;
  /**
   * Minimum confidence score for a rule to count toward the min_rules threshold.
   * Rules below this score are still stored but do not satisfy the minimum.
   */
  min_confidence: number;
}

export interface Task {
  /** Unique identifier — format: task_{CATEGORY}_{timestamp}_{random} */
  id: string;
  /** Document category this task targets */
  category: TaskCategory;
  /** Current lifecycle state */
  status: TaskStatus;
  /** Validation criteria that the extraction result must satisfy to pass */
  validation: ValidationRules;
  /** Maximum number of chunks to process in one run */
  batch_size: number;
  /** ISO timestamp of task creation */
  created_at: string;
  /** Current attempt number (starts at 1, increments on retry) */
  attempt: number;
  /** Maximum number of attempts before the task is permanently failed */
  max_attempts: number;
  /** ISO timestamp of the last execution start */
  last_run_at?: string;
  /** Human-readable failure reason (set on status = failed) */
  error?: string;
}

// ---------------------------------------------------------------------------
// Per-category validation profiles
// ---------------------------------------------------------------------------

/**
 * Validation thresholds tuned per category based on expected extraction density:
 *
 *   DTU/NORMES          — dense technical specs, many quantitative rules
 *   EUROCODE            — formulas + coefficients; fewer but precise rules
 *   GUIDE_TECHNIQUE     — non-binding recommendations; sparser signal
 *   CODE_CONSTRUCTION   — legal articles; very sparse, high confidence required
 */
const VALIDATION_PROFILES: Readonly<Record<TaskCategory, ValidationRules>> = {
  DTU: {
    min_rules:            10,
    max_duplication_rate: 0.30,
    allow_empty:          false,
    min_confidence:       0.60,
  },
  EUROCODE: {
    min_rules:            3,
    max_duplication_rate: 0.20,
    allow_empty:          false,
    min_confidence:       0.40, // formula detection starts at 0.40
  },
  NORMES: {
    min_rules:            8,
    max_duplication_rate: 0.30,
    allow_empty:          false,
    min_confidence:       0.60,
  },
  GUIDE_TECHNIQUE: {
    min_rules:            2,
    max_duplication_rate: 0.40,
    allow_empty:          true, // recommendation sections can be sparse
    min_confidence:       0.55,
  },
  CODE_CONSTRUCTION: {
    min_rules:            1,
    max_duplication_rate: 0.20,
    allow_empty:          true, // legal preamble chunks may have no obligations
    min_confidence:       0.70, // statutory language is precise
  },
};

/**
 * Batch sizes are tuned per category.
 * Legal and formula-heavy documents are processed in smaller batches
 * to bound per-run cost; prose-heavy categories use larger batches.
 */
const BATCH_SIZE_BY_CATEGORY: Readonly<Record<TaskCategory, number>> = {
  DTU:               20,
  EUROCODE:          15,
  NORMES:            20,
  GUIDE_TECHNIQUE:   25,
  CODE_CONSTRUCTION: 15,
};

// ---------------------------------------------------------------------------
// Ordered list of all supported categories (matches SUPPORTED_EXTRACTION_CATEGORIES)
// ---------------------------------------------------------------------------

export const TASK_CATEGORIES: TaskCategory[] = [
  'DTU',
  'EUROCODE',
  'NORMES',
  'GUIDE_TECHNIQUE',
  'CODE_CONSTRUCTION',
];

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

function makeTask(category: TaskCategory, attempt = 1): Task {
  const suffix = Math.random().toString(36).slice(2, 6);
  return {
    id:           `task_${category}_${Date.now()}_${suffix}`,
    category,
    status:       'pending',
    validation:   VALIDATION_PROFILES[category],
    batch_size:   BATCH_SIZE_BY_CATEGORY[category],
    created_at:   new Date().toISOString(),
    attempt,
    max_attempts: 3,
  };
}

// ---------------------------------------------------------------------------
// In-memory store
// ---------------------------------------------------------------------------

const store = new Map<string, Task>();

// Boot: one task per supported category, in priority order
for (const category of TASK_CATEGORIES) {
  const task = makeTask(category);
  store.set(task.id, task);
}

// ---------------------------------------------------------------------------
// Registry API
// ---------------------------------------------------------------------------

export const TaskRegistry = {
  /** Retrieve a task by its id. Returns undefined if not found. */
  get(id: string): Task | undefined {
    return store.get(id);
  },

  /**
   * Apply a partial patch to a task and return the updated task.
   * Throws if the task id does not exist.
   */
  update(id: string, patch: Partial<Task>): Task {
    const existing = store.get(id);
    if (!existing) throw new Error(`[TaskRegistry] Unknown task id: "${id}"`);
    const updated: Task = { ...existing, ...patch };
    store.set(id, updated);
    return updated;
  },

  /** Return a snapshot of all tasks in insertion order. */
  getAll(): Task[] {
    return [...store.values()];
  },

  /**
   * Return the next task eligible for execution.
   * Priority order: 'retrying' tasks first, then 'pending'.
   * Returns undefined when all tasks have reached a terminal state.
   */
  getNextPending(): Task | undefined {
    // Retrying tasks take priority over fresh pending tasks
    const retrying = [...store.values()].find((t) => t.status === 'retrying');
    if (retrying) return retrying;
    return [...store.values()].find((t) => t.status === 'pending');
  },

  /**
   * Create a retry task for a failed task and add it to the store.
   *
   * Returns the new task, or null when max_attempts has been reached.
   * The original failed task is NOT modified — the caller is responsible
   * for marking it as 'failed' before calling this.
   */
  createRetryTask(failed: Task): Task | null {
    if (failed.attempt >= failed.max_attempts) return null;
    const retry = makeTask(failed.category, failed.attempt + 1);
    retry.max_attempts = failed.max_attempts;
    retry.status = 'retrying';
    store.set(retry.id, retry);
    return retry;
  },
} as const;
