/**
 * Structured Logger - Centralized logging service
 * Provides structured logging with context for debugging and monitoring
 * Phase 32.1: Observability integration
 */

interface LogContext {
  service?: string;
  method?: string;
  message: string;
  [key: string]: unknown;
}

class StructuredLogger {
  /**
   * Log info level message
   */
  info(context: LogContext): void {
    console.log(
      `[${context.service || 'APP'}:${context.method || 'INFO'}]`,
      context.message,
      context
    );
  }

  /**
   * Log debug level message
   */
  debug(context: LogContext): void {
    if (process.env.NODE_ENV === 'development') {
      console.debug(
        `[${context.service || 'APP'}:${context.method || 'DEBUG'}]`,
        context.message,
        context
      );
    }
  }

  /**
   * Log warning level message
   */
  warn(context: LogContext): void {
    console.warn(
      `[${context.service || 'APP'}:${context.method || 'WARN'}]`,
      context.message,
      context
    );
  }

  /**
   * Log error level message
   */
  error(context: LogContext): void {
    console.error(
      `[${context.service || 'APP'}:${context.method || 'ERROR'}]`,
      context.message,
      context
    );
  }
}

export const structuredLogger = new StructuredLogger();
export default structuredLogger;
