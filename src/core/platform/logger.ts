/**
 * Simple logger utility for the TORP platform
 * Used across infrastructure services (resilience, cache, monitoring, etc.)
 */

type LogLevel = 'info' | 'warn' | 'error' | 'debug';

interface LogEntry {
  level: LogLevel;
  message: string;
  timestamp: string;
}

class Logger {
  private logs: LogEntry[] = [];
  private maxLogs = 1000;

  /**
   * Log info level message
   */
  info(message: string): void {
    this.log('info', message);
  }

  /**
   * Log warning level message
   */
  warn(message: string): void {
    this.log('warn', message);
  }

  /**
   * Log error level message
   */
  error(message: string): void {
    this.log('error', message);
  }

  /**
   * Log debug level message
   */
  debug(message: string): void {
    this.log('debug', message);
  }

  /**
   * Internal logging method
   */
  private log(level: LogLevel, message: string): void {
    const timestamp = new Date().toISOString();
    const entry: LogEntry = { level, message, timestamp };

    // Store in memory (limited)
    this.logs.push(entry);
    if (this.logs.length > this.maxLogs) {
      this.logs.shift();
    }

    // Console output in development
    if (typeof window === 'undefined' || process.env.NODE_ENV === 'development') {
      const prefix = `[${timestamp}] [${level.toUpperCase()}]`;
      switch (level) {
        case 'error':
          console.error(prefix, message);
          break;
        case 'warn':
          console.warn(prefix, message);
          break;
        case 'debug':
          console.debug(prefix, message);
          break;
        case 'info':
        default:
          console.log(prefix, message);
      }
    }
  }

  /**
   * Get all stored logs
   */
  getLogs(): LogEntry[] {
    return [...this.logs];
  }

  /**
   * Clear stored logs
   */
  clear(): void {
    this.logs = [];
  }

  /**
   * Get logs filtered by level
   */
  getLogsByLevel(level: LogLevel): LogEntry[] {
    return this.logs.filter(log => log.level === level);
  }
}

// Export singleton instance
export const logger = new Logger();
