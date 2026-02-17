/**
 * Error Tracking - Centralized error handling and reporting
 * Provides error context capture for debugging and monitoring
 * Phase 32.1: Observability integration
 */

interface ErrorContext {
  context?: string;
  [key: string]: unknown;
}

class ErrorTracking {
  /**
   * Capture exception with context
   */
  captureException(error: unknown, context?: ErrorContext): void {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorStack = error instanceof Error ? error.stack : undefined;

    console.error('[ErrorTracking] Exception captured:', {
      message: errorMessage,
      stack: errorStack,
      context: context?.context,
      ...context,
    });

    // Future: Send to error reporting service (Sentry, etc.)
  }

  /**
   * Capture message with context
   */
  captureMessage(message: string, context?: ErrorContext): void {
    console.warn('[ErrorTracking] Message captured:', {
      message,
      context: context?.context,
      ...context,
    });
  }
}

export const errorTracking = new ErrorTracking();
export default errorTracking;
