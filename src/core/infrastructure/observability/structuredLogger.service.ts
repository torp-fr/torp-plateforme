/**
 * Structured Logger Service - PHASE 31
 * Provides structured logging for observability
 * All logs include context, timestamps, and severity
 *
 * @module structuredLogger
 */

export type LogLevel = 'info' | 'warn' | 'error' | 'debug' | 'trace';

export interface LogEntry {
  timestamp: string;
  level: LogLevel;
  context: string;
  message: string;
  data?: Record<string, any>;
  stack?: string;
  duration?: number;
}

export interface LoggerConfig {
  enableConsole: boolean;
  enableRemote: boolean;
  minLevel: LogLevel;
  maxBufferSize: number;
}

/**
 * Structured Logger Service
 * Provides enterprise-grade logging with structured data
 */
export class StructuredLoggerService {
  private config: LoggerConfig;
  private buffer: LogEntry[] = [];
  private levelPriority: Record<LogLevel, number> = {
    'trace': 0,
    'debug': 1,
    'info': 2,
    'warn': 3,
    'error': 4
  };

  constructor(config: Partial<LoggerConfig> = {}) {
    this.config = {
      enableConsole: true,
      enableRemote: false,
      minLevel: 'debug',
      maxBufferSize: 1000,
      ...config
    };
  }

  /**
   * Log structured event
   */
  log(
    level: LogLevel,
    context: string,
    message: string,
    data?: Record<string, any>
  ): void {
    // Check if we should log this level
    if (
      this.levelPriority[level] <
      this.levelPriority[this.config.minLevel]
    ) {
      return;
    }

    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      context,
      message,
      data
    };

    // Add to buffer
    this.buffer.push(entry);
    if (this.buffer.length > this.config.maxBufferSize) {
      this.buffer.shift();
    }

    // Console output
    if (this.config.enableConsole) {
      this.logToConsole(entry);
    }

    // Remote logging would go here
    // if (this.config.enableRemote) {
    //   await this.sendToRemote(entry);
    // }
  }

  /**
   * Log info level
   */
  info(context: string, message: string, data?: Record<string, any>): void {
    this.log('info', context, message, data);
  }

  /**
   * Log warning level
   */
  warn(context: string, message: string, data?: Record<string, any>): void {
    this.log('warn', context, message, data);
  }

  /**
   * Log error level
   */
  error(context: string, message: string, error?: Error | Record<string, any>): void {
    const data = error instanceof Error
      ? {
          errorName: error.name,
          errorMessage: error.message,
          stack: error.stack
        }
      : error;

    this.log('error', context, message, data);
  }

  /**
   * Log debug level
   */
  debug(context: string, message: string, data?: Record<string, any>): void {
    this.log('debug', context, message, data);
  }

  /**
   * Log with performance timing
   */
  async logPerformance<T>(
    context: string,
    operation: string,
    fn: () => Promise<T>
  ): Promise<T> {
    const start = performance.now();

    try {
      const result = await fn();
      const duration = performance.now() - start;

      this.log('debug', context, `${operation} completed`, {
        operation,
        duration,
        success: true
      });

      return result;
    } catch (error) {
      const duration = performance.now() - start;

      this.error(context, `${operation} failed`, {
        operation,
        duration,
        error: error instanceof Error ? error.message : String(error)
      });

      throw error;
    }
  }

  /**
   * Output log to console with color coding
   */
  private logToConsole(entry: LogEntry): void {
    const colors = {
      info: '\x1b[36m',     // Cyan
      warn: '\x1b[33m',     // Yellow
      error: '\x1b[31m',    // Red
      debug: '\x1b[90m',    // Gray
      trace: '\x1b[2m'      // Dim
    };
    const reset = '\x1b[0m';

    const prefix = `${colors[entry.level]}[${entry.level.toUpperCase()}]${reset}`;
    const time = `${entry.timestamp}`;
    const ctx = `[${entry.context}]`;

    let message = `${prefix} ${time} ${ctx} ${entry.message}`;

    if (entry.data && Object.keys(entry.data).length > 0) {
      message += `\n${JSON.stringify(entry.data, null, 2)}`;
    }

    console.log(message);
  }

  /**
   * Get buffered logs
   */
  getBuffer(): LogEntry[] {
    return [...this.buffer];
  }

  /**
   * Clear buffer
   */
  clearBuffer(): void {
    this.buffer = [];
  }

  /**
   * Export logs as JSON
   */
  exportAsJSON(): string {
    return JSON.stringify(this.buffer, null, 2);
  }

  /**
   * Export logs as CSV
   */
  exportAsCSV(): string {
    if (this.buffer.length === 0) {
      return 'No logs to export';
    }

    const headers = ['timestamp', 'level', 'context', 'message', 'data'];
    const rows = this.buffer.map(entry => [
      entry.timestamp,
      entry.level,
      entry.context,
      entry.message,
      entry.data ? JSON.stringify(entry.data) : ''
    ]);

    const csv = [
      headers.join(','),
      ...rows.map(row =>
        row.map(cell =>
          typeof cell === 'string' && cell.includes(',')
            ? `"${cell.replace(/"/g, '""')}"`
            : cell
        ).join(',')
      )
    ].join('\n');

    return csv;
  }
}

// Export singleton instance
export const logger = new StructuredLoggerService({
  enableConsole: true,
  minLevel: import.meta.env.DEV ? 'debug' : 'info'
});

/**
 * Helper function for compatibility
 */
export function logEvent(
  level: LogLevel,
  context: string,
  payload: any
): void {
  logger.log(
    level,
    context,
    typeof payload === 'string' ? payload : 'Event',
    typeof payload === 'object' ? payload : { value: payload }
  );
}
