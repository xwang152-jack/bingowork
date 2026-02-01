/**
 * Enhanced Performance Monitoring System
 *
 * Provides comprehensive performance monitoring and metrics collection.
 * Features:
 * - Function execution timing
 * - Memory usage tracking
 * - Custom metrics
 * - Performance alerts
 * - Historical data analysis
 */

/**
 * Performance metric types
 */
export enum MetricType {
  COUNTER = 'counter',       // Incrementing value
  GAUGE = 'gauge',           // Current value
  HISTOGRAM = 'histogram',   // Distribution of values
  TIMER = 'timer',           // Duration measurement
}

/**
 * Metric data
 */
export interface Metric {
  name: string;
  type: MetricType;
  value: number;
  timestamp: number;
  labels?: Record<string, string>;
}

/**
 * Performance measurement
 */
export interface Measurement {
  name: string;
  startTime: number;
  endTime?: number;
  duration?: number;
  metadata?: Record<string, unknown>;
}

/**
 * Performance alert configuration
 */
export interface AlertConfig {
  metricName: string;
  threshold: number;
  comparison: 'gt' | 'lt' | 'eq'; // greater than, less than, equal
  callback: (metric: Metric) => void;
}

/**
 * Enhanced performance monitor
 */
export class EnhancedPerformanceMonitor {
  private metrics: Map<string, Metric[]> = new Map();
  private measurements: Map<string, Measurement> = new Map();
  private alerts: AlertConfig[] = [];
  private enabled: boolean = true;
  private maxHistorySize: number = 1000;

  constructor(enabled: boolean = true) {
    this.enabled = enabled;
  }

  /**
   * Start measuring execution time
   */
  startMeasure(name: string, metadata?: Record<string, unknown>): string {
    if (!this.enabled) return name;

    const id = `${name}_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    const measurement: Measurement = {
      name,
      startTime: performance.now(),
      metadata,
    };

    this.measurements.set(id, measurement);

    return id;
  }

  /**
   * End measuring execution time
   */
  endMeasure(id: string): number | null {
    if (!this.enabled) return null;

    const measurement = this.measurements.get(id);
    if (!measurement) {
      console.warn(`[Performance] Measurement not found: ${id}`);
      return null;
    }

    measurement.endTime = performance.now();
    measurement.duration = measurement.endTime - measurement.startTime;

    // Record as histogram metric
    this.recordHistogram(measurement.name, measurement.duration, measurement.metadata as Record<string, string>);

    // Clean up
    this.measurements.delete(id);

    return measurement.duration;
  }

  /**
   * Record a counter metric (incrementing value)
   */
  recordCounter(name: string, value: number = 1, labels?: Record<string, string>): void {
    this.recordMetric(name, MetricType.COUNTER, value, labels);
  }

  /**
   * Record a gauge metric (current value)
   */
  recordGauge(name: string, value: number, labels?: Record<string, string>): void {
    this.recordMetric(name, MetricType.GAUGE, value, labels);
  }

  /**
   * Record a histogram metric (distribution)
   */
  recordHistogram(name: string, value: number, labels?: Record<string, string>): void {
    this.recordMetric(name, MetricType.HISTOGRAM, value, labels);
  }

  /**
   * Record a timer metric
   */
  recordTimer(name: string, duration: number, labels?: Record<string, string>): void {
    this.recordMetric(name, MetricType.TIMER, duration, labels);
  }

  /**
   * Record a metric
   */
  private recordMetric(
    name: string,
    type: MetricType,
    value: number,
    labels?: Record<string, string>
  ): void {
    if (!this.enabled) return;

    const metric: Metric = {
      name,
      type,
      value,
      timestamp: Date.now(),
      labels,
    };

    // Store metric
    if (!this.metrics.has(name)) {
      this.metrics.set(name, []);
    }

    const history = this.metrics.get(name)!;
    history.push(metric);

    // Trim history if needed
    if (history.length > this.maxHistorySize) {
      history.shift();
    }

    // Check alerts
    this.checkAlerts(metric);
  }

  /**
   * Register a performance alert
   */
  registerAlert(config: AlertConfig): void {
    this.alerts.push(config);
  }

  /**
   * Check if any alerts should be triggered
   */
  private checkAlerts(metric: Metric): void {
    for (const alert of this.alerts) {
      if (alert.metricName !== metric.name) continue;

      let shouldAlert = false;

      switch (alert.comparison) {
        case 'gt':
          shouldAlert = metric.value > alert.threshold;
          break;
        case 'lt':
          shouldAlert = metric.value < alert.threshold;
          break;
        case 'eq':
          shouldAlert = metric.value === alert.threshold;
          break;
      }

      if (shouldAlert) {
        alert.callback(metric);
      }
    }
  }

  /**
   * Get metric history
   */
  getMetricHistory(name: string, limit?: number): Metric[] {
    const history = this.metrics.get(name) || [];
    return limit ? history.slice(-limit) : history;
  }

  /**
   * Get metric statistics
   */
  getMetricStats(name: string): {
    count: number;
    min: number;
    max: number;
    avg: number;
    sum: number;
  } | null {
    const history = this.metrics.get(name);
    if (!history || history.length === 0) return null;

    const values = history.map(m => m.value);

    return {
      count: values.length,
      min: Math.min(...values),
      max: Math.max(...values),
      avg: values.reduce((a, b) => a + b, 0) / values.length,
      sum: values.reduce((a, b) => a + b, 0),
    };
  }

  /**
   * Get all metric names
   */
  getMetricNames(): string[] {
    return Array.from(this.metrics.keys());
  }

  /**
   * Clear all metrics
   */
  clearMetrics(): void {
    this.metrics.clear();
    this.measurements.clear();
  }

  /**
   * Clear specific metric
   */
  clearMetric(name: string): void {
    this.metrics.delete(name);
  }

  /**
   * Enable/disable monitoring
   */
  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
  }

  /**
   * Check if monitoring is enabled
   */
  isEnabled(): boolean {
    return this.enabled;
  }

  /**
   * Get current memory usage
   */
  getMemoryUsage(): {
    used: number;
    total: number;
    percentage: number;
  } {
    const usage = process.memoryUsage();
    const used = usage.heapUsed;
    const total = usage.heapTotal;
    const percentage = (used / total) * 100;

    return { used, total, percentage };
  }

  /**
   * Get CPU usage (approximation)
   */
  getCpuUsage(): {
    user: number;
    system: number;
  } {
    const usage = process.cpuUsage();
    return {
      user: usage.user,
      system: usage.system,
    };
  }

  /**
   * Get app uptime in seconds
   */
  getUptime(): number {
    return process.uptime();
  }

  /**
   * Export metrics for analysis
   */
  exportMetrics(): Record<string, Metric[]> {
    const exported: Record<string, Metric[]> = {};

    for (const [name, history] of this.metrics.entries()) {
      exported[name] = [...history];
    }

    return exported;
  }

  /**
   * Import metrics (for testing or migration)
   */
  importMetrics(metrics: Record<string, Metric[]>): void {
    for (const [name, history] of Object.entries(metrics)) {
      this.metrics.set(name, [...history]);
    }
  }

  /**
   * Get system performance summary
   */
  getSystemSummary(): {
    memory: ReturnType<EnhancedPerformanceMonitor['getMemoryUsage']>;
    cpu: ReturnType<EnhancedPerformanceMonitor['getCpuUsage']>;
    uptime: number;
    metricCount: number;
    activeMeasurements: number;
  } {
    return {
      memory: this.getMemoryUsage(),
      cpu: this.getCpuUsage(),
      uptime: this.getUptime(),
      metricCount: this.getMetricNames().length,
      activeMeasurements: this.measurements.size,
    };
  }

  /**
   * Decorator for automatic function timing
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  time<T extends (...args: any[]) => any>(
    name: string,
    fn: T
  ): T {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return ((...args: any[]) => {
      const id = this.startMeasure(name);
      try {
        const result = fn(...args);
        if (result instanceof Promise) {
          return result.finally(() => this.endMeasure(id));
        }
        this.endMeasure(id);
        return result;
      } catch (error) {
        this.endMeasure(id);
        throw error;
      }
    }) as T;
  }
}

/**
 * Global performance monitor instance
 */
let globalMonitor: EnhancedPerformanceMonitor | null = null;

/**
 * Get or create global performance monitor
 */
export function getPerformanceMonitor(enabled?: boolean): EnhancedPerformanceMonitor {
  if (!globalMonitor) {
    globalMonitor = new EnhancedPerformanceMonitor(enabled);
  }
  return globalMonitor;
}

/**
 * Initialize performance monitoring with default alerts
 */
export function initializePerformanceMonitoring(monitor: EnhancedPerformanceMonitor): void {
  // Alert on high memory usage (> 90%)
  monitor.registerAlert({
    metricName: 'memory_usage_percentage',
    threshold: 90,
    comparison: 'gt',
    callback: (metric) => {
      console.warn(`[Performance Alert] High memory usage: ${metric.value.toFixed(2)}%`);
    },
  });

  // Alert on slow operations (> 5 seconds)
  monitor.registerAlert({
    metricName: 'slow_operation',
    threshold: 5000,
    comparison: 'gt',
    callback: (metric) => {
      console.warn(`[Performance Alert] Slow operation: ${metric.labels?.operation || 'unknown'} took ${metric.value}ms`);
    },
  });

  // Start periodic monitoring
  setInterval(() => {
    if (!monitor.isEnabled()) return;

    const memory = monitor.getMemoryUsage();
    monitor.recordGauge('memory_used_bytes', memory.used);
    monitor.recordGauge('memory_total_bytes', memory.total);
    monitor.recordGauge('memory_usage_percentage', memory.percentage);

    const uptime = monitor.getUptime();
    monitor.recordGauge('uptime_seconds', uptime);
  }, 30000); // Every 30 seconds
}
