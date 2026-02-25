/**
 * Error Tracking Service - PHASE 31
 * Centralized error tracking and reporting
 * Captures errors for debugging and monitoring
 *
 * @module errorTracking
 */

import { logger } from './structuredLogger.service';

export interface ErrorReport {
  id: string;
  timestamp: string;
  type: string;
  message: string;
  stack?: string;
  context?: string;
  userAgent?: string;
  url?: string;
  userId?: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  resolved: boolean;
  metadata?: Record<string, any>;
}

/**
 * Error Tracking Service
 * Centralizes error collection and reporting
 */
export class ErrorTrackingService {
  private errors: ErrorReport[] = [];
  private maxErrors = 100;

  constructor() {
    this.setupGlobalErrorHandlers();
  }

  /**
   * Setup global error handlers
   */
  private setupGlobalErrorHandlers(): void {
    // Handle uncaught errors
    window.addEventListener('error', (event) => {
      this.captureError(
        event.error,
        'uncaught-error',
        'Global uncaught error handler'
      );
    });

    // Handle unhandled promise rejections
    window.addEventListener('unhandledrejection', (event) => {
      this.captureError(
        event.reason,
        'unhandled-promise-rejection',
        'Global unhandled promise rejection'
      );
    });
  }

  /**
   * Capture error
   */
  captureError(
    error: Error | any,
    type: string = 'error',
    context?: string
  ): ErrorReport {
    const errorReport: ErrorReport = {
      id: this.generateId(),
      timestamp: new Date().toISOString(),
      type,
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      context,
      userAgent: navigator.userAgent,
      url: window.location.href,
      severity: this.determineSeverity(error, type),
      resolved: false
    };

    // Add to collection
    this.errors.push(errorReport);
    if (this.errors.length > this.maxErrors) {
      this.errors.shift();
    }

    // Log the error
    logger.error(
      context || 'error-tracking',
      `Error captured: ${type}`,
      {
        errorId: errorReport.id,
        message: errorReport.message,
        severity: errorReport.severity
      }
    );

    // In production, would send to error tracking service (Sentry, etc.)
    // TODO: Implement remote error sending
    // if (import.meta.env.PROD) {
    //   await this.sendToSentry(errorReport);
    // }

    return errorReport;
  }

  /**
   * Capture error with React Error Boundary context
   */
  captureErrorBoundary(
    error: Error,
    errorInfo: { componentStack?: string },
    context?: string
  ): ErrorReport {
    const report = this.captureError(error, 'react-error-boundary', context);

    if (errorInfo.componentStack) {
      report.metadata = {
        componentStack: errorInfo.componentStack
      };
    }

    return report;
  }

  /**
   * Determine error severity
   */
  private determineSeverity(
    error: Error | any,
    type: string
  ): 'low' | 'medium' | 'high' | 'critical' {
    const message = error instanceof Error ? error.message : String(error);

    // Critical errors
    if (
      type === 'react-error-boundary' ||
      message.includes('Cannot read properties') ||
      message.includes('Cannot set properties')
    ) {
      return 'critical';
    }

    // High severity
    if (
      message.includes('Failed to fetch') ||
      message.includes('Network error') ||
      message.includes('CORS')
    ) {
      return 'high';
    }

    // Medium severity
    if (
      message.includes('Timeout') ||
      message.includes('Warning') ||
      message.includes('Deprecation')
    ) {
      return 'medium';
    }

    return 'low';
  }

  /**
   * Mark error as resolved
   */
  resolveError(errorId: string): void {
    const error = this.errors.find(e => e.id === errorId);
    if (error) {
      error.resolved = true;
      logger.info('error-tracking', `Error resolved: ${errorId}`);
    }
  }

  /**
   * Get all errors
   */
  getErrors(): ErrorReport[] {
    return [...this.errors];
  }

  /**
   * Get unresolved errors
   */
  getUnresolvedErrors(): ErrorReport[] {
    return this.errors.filter(e => !e.resolved);
  }

  /**
   * Get errors by severity
   */
  getErrorsBySeverity(
    severity: 'low' | 'medium' | 'high' | 'critical'
  ): ErrorReport[] {
    return this.errors.filter(e => e.severity === severity);
  }

  /**
   * Clear errors
   */
  clearErrors(): void {
    this.errors = [];
  }

  /**
   * Export error report
   */
  exportReport(): Record<string, any> {
    return {
      timestamp: new Date().toISOString(),
      totalErrors: this.errors.length,
      unresolved: this.errors.filter(e => !e.resolved).length,
      bySeverity: {
        critical: this.errors.filter(e => e.severity === 'critical').length,
        high: this.errors.filter(e => e.severity === 'high').length,
        medium: this.errors.filter(e => e.severity === 'medium').length,
        low: this.errors.filter(e => e.severity === 'low').length
      },
      errors: this.errors.map(e => ({
        id: e.id,
        timestamp: e.timestamp,
        type: e.type,
        message: e.message,
        severity: e.severity,
        resolved: e.resolved,
        context: e.context
      }))
    };
  }

  /**
   * Generate unique error ID
   */
  private generateId(): string {
    return `err_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

// Export singleton
export const errorTracking = new ErrorTrackingService();

/**
 * Helper function to capture errors
 */
export function captureError(
  error: Error | any,
  type?: string,
  context?: string
): ErrorReport {
  return errorTracking.captureError(error, type, context);
}
