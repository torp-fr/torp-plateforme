/**
 * API Resilience Service (Phase 30.3)
 * Provides retry logic, circuit breaker pattern, and fallback mode
 * Ensures platform resilience against API failures
 */

import { structuredLogger } from '@/services/observability/structured-logger';

const logger = structuredLogger;

export interface ResilientResult<T> {
  success: boolean;
  data?: T;
  error?: string;
  degraded: boolean;
  retryCount: number;
  executionTimeMs: number;
  circuitBreakerState?: 'closed' | 'open' | 'half-open';
}

export interface ResilienceOptions {
  retries?: number;
  timeoutMs?: number;
  circuitBreakerThreshold?: number;
  fallbackData?: any;
  onRetry?: (attempt: number, error: Error) => void;
}

interface CircuitBreakerState {
  state: 'closed' | 'open' | 'half-open';
  failureCount: number;
  lastFailureTime?: number;
  successCount: number;
}

class APIResilienceService {
  private circuitBreakers: Map<string, CircuitBreakerState> = new Map();
  private readonly DEFAULT_RETRIES = 3;
  private readonly DEFAULT_TIMEOUT_MS = 5000;
  private readonly DEFAULT_CB_THRESHOLD = 5; // failures before opening
  private readonly DEFAULT_CB_RESET_TIME = 60000; // 1 minute
  private readonly DEFAULT_CB_HALF_OPEN_ATTEMPTS = 2;

  /**
   * Execute operation with resilience (retry, timeout, circuit breaker)
   */
  async executeWithResilience<T>(
    apiName: string,
    operation: () => Promise<T>,
    options: ResilienceOptions = {}
  ): Promise<ResilientResult<T>> {
    const startTime = Date.now();
    const retries = options.retries ?? this.DEFAULT_RETRIES;
    const timeoutMs = options.timeoutMs ?? this.DEFAULT_TIMEOUT_MS;
    const cbThreshold = options.circuitBreakerThreshold ?? this.DEFAULT_CB_THRESHOLD;

    // Check circuit breaker state
    const cbState = this.getOrInitCircuitBreaker(apiName, cbThreshold);
    if (cbState.state === 'open') {
      logger.warn(`[APIResilience] Circuit breaker OPEN for ${apiName}`);
      return {
        success: false,
        error: `Circuit breaker open for ${apiName}`,
        degraded: true,
        retryCount: 0,
        executionTimeMs: Date.now() - startTime,
        circuitBreakerState: 'open',
        data: options.fallbackData,
      };
    }

    let lastError: Error | null = null;
    let retryCount = 0;

    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        // Execute with timeout
        const result = await this.withTimeout(operation, timeoutMs);

        // Success: reset circuit breaker and update statistics
        this.resetCircuitBreaker(apiName);
        this.recordSuccess(apiName);

        logger.info(`[APIResilience] ${apiName} success on attempt ${attempt + 1}`);

        return {
          success: true,
          data: result,
          degraded: false,
          retryCount,
          executionTimeMs: Date.now() - startTime,
          circuitBreakerState: 'closed',
        };
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        retryCount = attempt + 1;

        // Log retry attempt
        logger.warn(
          `[APIResilience] ${apiName} attempt ${attempt + 1}/${retries + 1} failed: ${lastError.message}`
        );

        // Call retry callback if provided
        options.onRetry?.(attempt + 1, lastError);

        // Record failure
        this.recordFailure(apiName, cbThreshold);

        // Break early if circuit is open
        if (this.getCircuitBreaker(apiName)?.state === 'open') {
          logger.warn(`[APIResilience] Circuit breaker opened for ${apiName} after attempt ${attempt + 1}`);
          break;
        }

        // Exponential backoff before next retry
        if (attempt < retries) {
          const backoffMs = Math.min(1000 * Math.pow(2, attempt), 10000); // max 10s
          await this.delay(backoffMs);
        }
      }
    }

    // All retries exhausted
    const finalCBState = this.getCircuitBreaker(apiName);
    logger.error(
      `[APIResilience] ${apiName} failed after ${retryCount} attempts: ${lastError?.message}`
    );

    return {
      success: false,
      error: lastError?.message || 'Unknown error',
      degraded: true,
      retryCount,
      executionTimeMs: Date.now() - startTime,
      circuitBreakerState: finalCBState?.state,
      data: options.fallbackData,
    };
  }

  /**
   * Execute operation with timeout
   */
  private withTimeout<T>(operation: () => Promise<T>, timeoutMs: number): Promise<T> {
    return Promise.race([
      operation(),
      new Promise<T>((_, reject) =>
        setTimeout(() => reject(new Error(`Timeout after ${timeoutMs}ms`)), timeoutMs)
      ),
    ]);
  }

  /**
   * Get or initialize circuit breaker for API
   */
  private getOrInitCircuitBreaker(apiName: string, threshold: number): CircuitBreakerState {
    if (!this.circuitBreakers.has(apiName)) {
      this.circuitBreakers.set(apiName, {
        state: 'closed',
        failureCount: 0,
        successCount: 0,
      });
    }
    return this.circuitBreakers.get(apiName)!;
  }

  /**
   * Get circuit breaker state
   */
  private getCircuitBreaker(apiName: string): CircuitBreakerState | undefined {
    return this.circuitBreakers.get(apiName);
  }

  /**
   * Record successful API call
   */
  private recordSuccess(apiName: string): void {
    const cb = this.getOrInitCircuitBreaker(apiName, this.DEFAULT_CB_THRESHOLD);
    cb.successCount++;

    // If in half-open, check if we can close
    if (cb.state === 'half-open' && cb.successCount >= this.DEFAULT_CB_HALF_OPEN_ATTEMPTS) {
      cb.state = 'closed';
      cb.failureCount = 0;
      cb.successCount = 0;
      logger.info(`[APIResilience] Circuit breaker CLOSED for ${apiName}`);
    }
  }

  /**
   * Record failed API call
   */
  private recordFailure(apiName: string, threshold: number): void {
    const cb = this.getOrInitCircuitBreaker(apiName, threshold);
    cb.failureCount++;
    cb.lastFailureTime = Date.now();

    if (cb.state === 'closed' && cb.failureCount >= threshold) {
      cb.state = 'open';
      logger.error(`[APIResilience] Circuit breaker OPENED for ${apiName} (${cb.failureCount} failures)`);
    } else if (cb.state === 'half-open') {
      cb.state = 'open';
      cb.failureCount = threshold; // Reset for next attempt
      logger.warn(`[APIResilience] Circuit breaker REOPENED for ${apiName}`);
    }
  }

  /**
   * Reset circuit breaker (on success)
   */
  private resetCircuitBreaker(apiName: string): void {
    const cb = this.getOrInitCircuitBreaker(apiName, this.DEFAULT_CB_THRESHOLD);
    cb.failureCount = 0;
    cb.successCount = 0;
    if (cb.state !== 'closed') {
      cb.state = 'closed';
      logger.info(`[APIResilience] Circuit breaker reset for ${apiName}`);
    }
  }

  /**
   * Try to recover circuit breaker from open state
   */
  public tryRecoverCircuitBreaker(apiName: string): void {
    const cb = this.getCircuitBreaker(apiName);
    if (!cb) return;

    if (
      cb.state === 'open' &&
      cb.lastFailureTime &&
      Date.now() - cb.lastFailureTime >= this.DEFAULT_CB_RESET_TIME
    ) {
      cb.state = 'half-open';
      cb.failureCount = 0;
      cb.successCount = 0;
      logger.info(`[APIResilience] Circuit breaker HALF-OPEN for ${apiName} (attempting recovery)`);
    }
  }

  /**
   * Get circuit breaker status for all APIs
   */
  public getCircuitBreakerStatus(): Record<string, CircuitBreakerState> {
    const status: Record<string, CircuitBreakerState> = {};
    this.circuitBreakers.forEach((state, apiName) => {
      status[apiName] = { ...state };
    });
    return status;
  }

  /**
   * Reset specific circuit breaker (admin action)
   */
  public resetCircuitBreakerForAPI(apiName: string): void {
    this.resetCircuitBreaker(apiName);
    logger.info(`[APIResilience] Manual reset for ${apiName}`);
  }

  /**
   * Reset all circuit breakers (admin action)
   */
  public resetAllCircuitBreakers(): void {
    this.circuitBreakers.forEach((_, apiName) => {
      this.resetCircuitBreaker(apiName);
    });
    logger.info(`[APIResilience] Reset all circuit breakers`);
  }

  /**
   * Delay helper for backoff
   */
  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

// Export singleton instance
export const apiResilienceService = new APIResilienceService();
export default apiResilienceService;
