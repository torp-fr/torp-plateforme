// ─────────────────────────────────────────────────────────────────────────────
// EventBus — Type-safe in-process pub/sub
// Supports synchronous and async handlers; handler failures are isolated.
// ─────────────────────────────────────────────────────────────────────────────

// ── Event catalog ────────────────────────────────────────────────────────────

export interface TORPEventMap {
  // Client lifecycle
  'client:created':          { clientId: string; email: string; nom: string; prenom: string; telephone?: string; adresse?: string; siret?: string };
  'client:enriched':         { clientId: string; quality_score?: number };
  'client:enrichment_failed': { clientId: string; error: string };

  // Project lifecycle
  'project:created':          { projectId: string; clientId: string; type: string; adresse: string };
  'project:enriched':         { projectId: string; domains: string[]; risks: unknown };
  'project:enrichment_failed': { projectId: string; error: string };

  // Devis lifecycle
  'devis:uploaded':      { devisId: string; projectId: string; clientId: string; fileUrl: string; fileName: string };
  'devis:analyzed':      { devisId: string; quality_score: number; certification_score: number; benchmark_position: number | null; insurance_covered: boolean };
  'devis:analysis_failed': { devisId: string; error: string };

  // Insurance lifecycle
  'insurance:uploaded':          { clientId: string; fileUrl: string; fileName: string };
  'insurance:validated':         { clientId: string; covered_activities: string[]; expiration_date: string | null; alerts: string[] };
  'insurance:validation_failed': { clientId: string; error: string };

  // Knowledge lifecycle
  'knowledge:uploaded':         { documentId: string; fileUrl: string; fileName: string; domain: string };
  'knowledge:ingested':         { documentId: string; chunks_count: number };
  'knowledge:ingestion_failed': { documentId: string; error: string };

  // System
  'system:pipeline_error': { failed_jobs_count: number };
  'system:health_ok':      { checked_at: string };
}

export type TORPEventType = keyof TORPEventMap;

export interface TORPEvent<T extends TORPEventType = TORPEventType> {
  type: T;
  payload: TORPEventMap[T];
  emittedAt?: Date;
}

type Handler<T extends TORPEventType> = (event: TORPEvent<T>) => void | Promise<void>;

// ── Implementation ────────────────────────────────────────────────────────────

class EventBusImpl {
  private readonly handlers = new Map<string, Handler<TORPEventType>[]>();

  /**
   * Subscribe to an event type. Returns an unsubscribe function.
   */
  on<T extends TORPEventType>(type: T, handler: Handler<T>): () => void {
    const list = this.handlers.get(type) ?? [];
    list.push(handler as Handler<TORPEventType>);
    this.handlers.set(type, list);

    return () => {
      const current = this.handlers.get(type) ?? [];
      this.handlers.set(type, current.filter(h => h !== handler));
    };
  }

  /**
   * Emit an event. All handlers run sequentially; failures are logged but do not
   * abort remaining handlers.
   */
  async emit<T extends TORPEventType>(type: T, payload: TORPEventMap[T]): Promise<void> {
    const event: TORPEvent<T> = { type, payload, emittedAt: new Date() };
    const list = this.handlers.get(type) ?? [];

    for (const handler of list) {
      try {
        await handler(event as TORPEvent<TORPEventType>);
      } catch (err) {
        console.error(`[EventBus] Handler error for event "${type}":`, err instanceof Error ? err.message : err);
      }
    }
  }

  /** Remove all handlers for a given event type. */
  off(type: TORPEventType): void {
    this.handlers.delete(type);
  }

  /** Remove all handlers for all event types. */
  clear(): void {
    this.handlers.clear();
  }

  /** Number of registered handlers (for testing/health checks). */
  handlerCount(type?: TORPEventType): number {
    if (type) return (this.handlers.get(type) ?? []).length;
    let total = 0;
    for (const list of this.handlers.values()) total += list.length;
    return total;
  }
}

// ── Module-level singleton ────────────────────────────────────────────────────

export const eventBus = new EventBusImpl();

// Also export the class for testing / creating isolated instances
export { EventBusImpl as EventBus };
