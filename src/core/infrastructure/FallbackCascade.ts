// ─────────────────────────────────────────────────────────────────────────────
// FallbackCascade — Never fail completely. Always has a data source.
//
// Strategy per data type:
//   Enterprise (SIRET):  Pappers → INSEE → data.gouv.fr → Cache
//   Location (Address):  BANO → Nominatim → postal centroid
//   Regulation:          Légifrance → GitHub scrape → local copy
//   RGE Certs:           Qualibat DB → data.gouv.fr → cache
// ─────────────────────────────────────────────────────────────────────────────

// ── Types ────────────────────────────────────────────────────────────────────

export interface FallbackLayer<T> {
  name: string;
  priority: number;             // 0 = primary, 1 = first fallback, etc.
  execute: (context?: unknown) => Promise<T>;
  timeout_ms: number;
  isRetryable: (error: Error) => boolean;
}

export interface CascadeResult<T> {
  status: 'success' | 'cascaded_exhausted';
  data: T | null;
  layer_used: string;
  health_status: 'online' | 'degraded' | 'severely_degraded' | 'all_apis_down';
  timeline: CascadeEvent[];
  duration_ms: number;
  queued_request_id?: string;
}

export interface CascadeEvent {
  layer_index: number;
  layer_name: string;
  status: 'attempting' | 'success' | 'failed' | 'queued';
  error?: string;
  duration_ms?: number;
  timestamp: Date;
}

export interface QueuedRequest {
  id: string;
  entity_id?: string;
  entity_type?: string;
  cascade_layers: string[];
  timeline: CascadeEvent[];
  created_at: Date;
  retry_count: number;
  next_retry_at: Date;
  status: 'queued' | 'retrying' | 'resolved';
}

// ── FallbackCascade ───────────────────────────────────────────────────────────

export class FallbackCascade {
  readonly fallbackQueue: Map<string, QueuedRequest> = new Map();

  /**
   * Execute request through a cascade of fallback layers.
   * Never returns null when at least one layer succeeds.
   * When all layers fail, queues the request and returns a 'cascaded_exhausted' result.
   */
  async executeWithFallback<T>(
    requestId: string,
    layers: FallbackLayer<T>[],
    context?: { entityId?: string; entityType?: string }
  ): Promise<CascadeResult<T>> {
    const startTime = Date.now();
    const timeline: CascadeEvent[] = [];

    for (let i = 0; i < layers.length; i++) {
      const layer = layers[i];

      timeline.push({
        layer_index: i,
        layer_name: layer.name,
        status: 'attempting',
        timestamp: new Date(),
      });

      try {
        const result = await this.executeLayerWithRetry(layer, context);

        const layerDuration = Date.now() - startTime;

        timeline.push({
          layer_index: i,
          layer_name: layer.name,
          status: 'success',
          duration_ms: layerDuration,
          timestamp: new Date(),
        });

        const healthStatus =
          i === 0 ? 'online'
          : i === 1 ? 'degraded'
          : 'severely_degraded';

        console.info(`[FallbackCascade] Succeeded via layer ${i} (${layer.name}), requestId=${requestId}`);

        return {
          status: 'success',
          data: result,
          layer_used: layer.name,
          health_status: healthStatus,
          timeline,
          duration_ms: layerDuration,
        };
      } catch (err) {
        const error = err instanceof Error ? err : new Error(String(err));

        timeline.push({
          layer_index: i,
          layer_name: layer.name,
          status: 'failed',
          error: error.message,
          timestamp: new Date(),
        });

        console.warn(`[FallbackCascade] Layer ${i} (${layer.name}) failed: ${error.message}, requestId=${requestId}`);
      }
    }

    // All layers exhausted — queue for retry
    timeline.push({
      layer_index: -1,
      layer_name: 'QUEUE_FOR_RETRY',
      status: 'queued',
      timestamp: new Date(),
    });

    const queuedRequest: QueuedRequest = {
      id: requestId,
      entity_id: context?.entityId,
      entity_type: context?.entityType,
      cascade_layers: layers.map(l => l.name),
      timeline,
      created_at: new Date(),
      retry_count: 0,
      next_retry_at: new Date(Date.now() + 30_000),
      status: 'queued',
    };

    this.fallbackQueue.set(requestId, queuedRequest);

    console.error(`[FallbackCascade] All layers exhausted, requestId=${requestId} queued for retry`);

    return {
      status: 'cascaded_exhausted',
      data: null,
      layer_used: 'QUEUED_FOR_RETRY',
      health_status: 'all_apis_down',
      timeline,
      duration_ms: Date.now() - startTime,
      queued_request_id: requestId,
    };
  }

  /**
   * Execute a single layer with exponential backoff retries.
   * Base delay: 2s, 4s, 8s (×2 each attempt, up to maxAttempts=3).
   */
  async executeLayerWithRetry<T>(
    layer: FallbackLayer<T>,
    context?: unknown,
    attempt: number = 1
  ): Promise<T> {
    const maxAttempts = 3;
    const baseDelay = 2_000;

    try {
      const result = await Promise.race<T>([
        layer.execute(context),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error(`Timeout after ${layer.timeout_ms}ms`)), layer.timeout_ms)
        ),
      ]);
      return result;
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));

      if (!layer.isRetryable(error) || attempt >= maxAttempts) {
        throw error;
      }

      const delay = baseDelay * Math.pow(2, attempt - 1) + Math.random() * 1_000;

      console.debug(`[FallbackCascade] Layer ${layer.name} retry ${attempt} in ${Math.round(delay)}ms`);

      await new Promise(r => setTimeout(r, delay));

      return this.executeLayerWithRetry(layer, context, attempt + 1);
    }
  }

  /** Returns all currently queued requests (for admin dashboard). */
  getQueuedRequests(): QueuedRequest[] {
    return Array.from(this.fallbackQueue.values());
  }

  /** Mark a queued request as retrying (for manual retry via admin panel). */
  manuallyRetry(requestId: string): void {
    const queued = this.fallbackQueue.get(requestId);
    if (!queued) throw new Error(`Request not found: ${requestId}`);

    queued.retry_count++;
    queued.next_retry_at = new Date(Date.now() + 30_000);
    queued.status = 'retrying';

    console.info(`[FallbackCascade] Manual retry initiated, requestId=${requestId}, attempt=${queued.retry_count}`);
  }

  /** Mark a queued request as resolved. */
  resolveRequest(requestId: string): void {
    const queued = this.fallbackQueue.get(requestId);
    if (!queued) throw new Error(`Request not found: ${requestId}`);
    queued.status = 'resolved';
  }
}
