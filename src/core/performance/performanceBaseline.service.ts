/**
 * Performance Baseline Service - PHASE 31
 * Captures and tracks performance metrics
 * Establishes baseline for monitoring
 *
 * @module performanceBaseline
 */

export interface PerformanceMetrics {
  loginMs: number;
  fullAnalysisMs: number;
  doctrineActivationMs: number;
  fraudDetectionMs: number;
  adaptiveAdjustmentMs: number;
  cockpitLoadMs: number;
  timestamp: string;
}

export interface PerformanceBaseline extends PerformanceMetrics {
  version: string;
  environment: 'development' | 'production';
  measurements: number; // How many times measured
}

/**
 * Performance Baseline Service
 * Captures and establishes performance baselines
 */
export class PerformanceBaselineService {
  private measurements: PerformanceMetrics[] = [];
  private baseline: PerformanceBaseline | null = null;

  /**
   * Record login performance
   */
  recordLoginTime(ms: number): void {
    this.recordMetric({ loginMs: ms });
  }

  /**
   * Record full analysis execution time
   */
  recordAnalysisTime(ms: number): void {
    this.recordMetric({ fullAnalysisMs: ms });
  }

  /**
   * Record doctrine activation time
   */
  recordDoctrinTime(ms: number): void {
    this.recordMetric({ doctrineActivationMs: ms });
  }

  /**
   * Record fraud detection time
   */
  recordFraudDetectionTime(ms: number): void {
    this.recordMetric({ fraudDetectionMs: ms });
  }

  /**
   * Record adaptive adjustment time
   */
  recordAdaptiveAdjustmentTime(ms: number): void {
    this.recordMetric({ adaptiveAdjustmentMs: ms });
  }

  /**
   * Record cockpit load time
   */
  recordCockpitLoadTime(ms: number): void {
    this.recordMetric({ cockpitLoadMs: ms });
  }

  /**
   * Record generic metric
   */
  private recordMetric(partial: Partial<PerformanceMetrics>): void {
    const measurement: PerformanceMetrics = {
      loginMs: 0,
      fullAnalysisMs: 0,
      doctrineActivationMs: 0,
      fraudDetectionMs: 0,
      adaptiveAdjustmentMs: 0,
      cockpitLoadMs: 0,
      timestamp: new Date().toISOString(),
      ...partial
    };

    this.measurements.push(measurement);
  }

  /**
   * Calculate baseline from measurements
   */
  calculateBaseline(): PerformanceBaseline {
    if (this.measurements.length === 0) {
      throw new Error('No measurements recorded');
    }

    const baseline: PerformanceBaseline = {
      loginMs: this.calculateAverage('loginMs'),
      fullAnalysisMs: this.calculateAverage('fullAnalysisMs'),
      doctrineActivationMs: this.calculateAverage('doctrineActivationMs'),
      fraudDetectionMs: this.calculateAverage('fraudDetectionMs'),
      adaptiveAdjustmentMs: this.calculateAverage('adaptiveAdjustmentMs'),
      cockpitLoadMs: this.calculateAverage('cockpitLoadMs'),
      timestamp: new Date().toISOString(),
      version: '1.0.0',
      environment: import.meta.env.PROD ? 'production' : 'development',
      measurements: this.measurements.length
    };

    this.baseline = baseline;
    return baseline;
  }

  /**
   * Calculate average for metric
   */
  private calculateAverage(key: keyof PerformanceMetrics): number {
    const values = this.measurements
      .map(m => m[key])
      .filter(v => typeof v === 'number' && v > 0);

    if (values.length === 0) return 0;

    const sum = values.reduce((a, b) => a + b, 0);
    return Math.round(sum / values.length);
  }

  /**
   * Check if performance is within baseline
   */
  checkPerformance(metric: keyof PerformanceMetrics, value: number): boolean {
    if (!this.baseline) {
      return true; // No baseline to compare
    }

    const baselineValue = this.baseline[metric];
    const threshold = baselineValue * 1.2; // Allow 20% deviation

    return value <= threshold;
  }

  /**
   * Get performance warnings
   */
  getPerformanceWarnings(): string[] {
    const warnings: string[] = [];

    if (!this.baseline) {
      return warnings;
    }

    if (this.baseline.loginMs > 3000) {
      warnings.push(`Login time is slow: ${this.baseline.loginMs}ms (target: <3000ms)`);
    }

    if (this.baseline.fullAnalysisMs > 30000) {
      warnings.push(`Full analysis takes too long: ${this.baseline.fullAnalysisMs}ms (target: <30000ms)`);
    }

    if (this.baseline.cockpitLoadMs > 2000) {
      warnings.push(`Cockpit load is slow: ${this.baseline.cockpitLoadMs}ms (target: <2000ms)`);
    }

    return warnings;
  }

  /**
   * Export baseline as JSON
   */
  exportAsJSON(): string {
    if (!this.baseline) {
      throw new Error('No baseline calculated');
    }

    return JSON.stringify(this.baseline, null, 2);
  }

  /**
   * Export baseline as markdown
   */
  exportAsMarkdown(): string {
    if (!this.baseline) {
      throw new Error('No baseline calculated');
    }

    let markdown = `# Performance Baseline Report\n\n`;
    markdown += `**Generated**: ${this.baseline.timestamp}\n`;
    markdown += `**Environment**: ${this.baseline.environment}\n`;
    markdown += `**Measurements**: ${this.baseline.measurements}\n\n`;

    markdown += `## Metrics\n\n`;
    markdown += `| Metric | Time | Target | Status |\n`;
    markdown += `|--------|------|--------|--------|\n`;
    markdown += `| Login | ${this.baseline.loginMs}ms | <3000ms | ${this.baseline.loginMs <= 3000 ? '✅' : '⚠️'} |\n`;
    markdown += `| Full Analysis | ${this.baseline.fullAnalysisMs}ms | <30000ms | ${this.baseline.fullAnalysisMs <= 30000 ? '✅' : '⚠️'} |\n`;
    markdown += `| Doctrine Activation | ${this.baseline.doctrineActivationMs}ms | <5000ms | ${this.baseline.doctrineActivationMs <= 5000 ? '✅' : '⚠️'} |\n`;
    markdown += `| Fraud Detection | ${this.baseline.fraudDetectionMs}ms | <3000ms | ${this.baseline.fraudDetectionMs <= 3000 ? '✅' : '⚠️'} |\n`;
    markdown += `| Adaptive Adjustment | ${this.baseline.adaptiveAdjustmentMs}ms | <2000ms | ${this.baseline.adaptiveAdjustmentMs <= 2000 ? '✅' : '⚠️'} |\n`;
    markdown += `| Cockpit Load | ${this.baseline.cockpitLoadMs}ms | <2000ms | ${this.baseline.cockpitLoadMs <= 2000 ? '✅' : '⚠️'} |\n\n`;

    const warnings = this.getPerformanceWarnings();
    if (warnings.length > 0) {
      markdown += `## Warnings\n\n`;
      warnings.forEach(w => {
        markdown += `- ⚠️ ${w}\n`;
      });
    }

    return markdown;
  }

  /**
   * Get all measurements
   */
  getMeasurements(): PerformanceMetrics[] {
    return [...this.measurements];
  }

  /**
   * Clear measurements
   */
  clearMeasurements(): void {
    this.measurements = [];
    this.baseline = null;
  }

  /**
   * Get current baseline
   */
  getBaseline(): PerformanceBaseline | null {
    return this.baseline;
  }
}

// Export singleton
export const performanceBaseline = new PerformanceBaselineService();
