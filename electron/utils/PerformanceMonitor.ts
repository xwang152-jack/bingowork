/**
 * Performance monitoring utilities
 * Helps track and optimize application performance
 */

export interface PerformanceMetric {
    name: string;
    duration: number;
    timestamp: number;
    metadata?: Record<string, unknown>;
}

export interface PerformanceStats {
    renderTime: number[];
    apiCallTime: number[];
    toolExecutionTime: number[];
    memoryUsage: number[];
}

export class PerformanceMonitor {
    private metrics: PerformanceMetric[] = [];
    private stats: PerformanceStats = {
        renderTime: [],
        apiCallTime: [],
        toolExecutionTime: [],
        memoryUsage: [],
    };
    private enabled: boolean;
    private maxMetrics = 1000;

    constructor(enabled = false) {
        this.enabled = enabled;
    }

    /**
     * Enable or disable performance monitoring
     */
    setEnabled(enabled: boolean): void {
        this.enabled = enabled;
    }

    /**
     * Start measuring a performance metric
     */
    startMeasure(name: string, metadata?: Record<string, unknown>): () => void {
        if (!this.enabled) {
            return () => {};
        }

        const startTime = performance.now();

        return () => {
            const duration = performance.now() - startTime;
            this.recordMetric({
                name,
                duration,
                timestamp: Date.now(),
                metadata,
            });
        };
    }

    /**
     * Record a performance metric
     */
    recordMetric(metric: PerformanceMetric): void {
        if (!this.enabled) return;

        this.metrics.push(metric);

        // Keep only recent metrics
        if (this.metrics.length > this.maxMetrics) {
            this.metrics.shift();
        }

        // Categorize metrics
        if (metric.name.startsWith('render_')) {
            this.stats.renderTime.push(metric.duration);
        } else if (metric.name.startsWith('api_')) {
            this.stats.apiCallTime.push(metric.duration);
        } else if (metric.name.startsWith('tool_')) {
            this.stats.toolExecutionTime.push(metric.duration);
        }

        // Keep only recent stats (last 100)
        Object.keys(this.stats).forEach(key => {
            const stats = this.stats[key as keyof PerformanceStats];
            if (stats.length > 100) {
                stats.shift();
            }
        });
    }

    /**
     * Get average duration for a metric name pattern
     */
    getAverage(metricPattern: RegExp): number {
        const matching = this.metrics.filter(m => metricPattern.test(m.name));
        if (matching.length === 0) return 0;

        const sum = matching.reduce((acc, m) => acc + m.duration, 0);
        return sum / matching.length;
    }

    /**
     * Get median duration for a metric name pattern
     */
    getMedian(metricPattern: RegExp): number {
        const matching = this.metrics.filter(m => metricPattern.test(m.name));
        if (matching.length === 0) return 0;

        const sorted = matching.map(m => m.duration).sort((a, b) => a - b);
        const mid = Math.floor(sorted.length / 2);
        return sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
    }

    /**
     * Get percentile duration (p95, p99, etc.)
     */
    getPercentile(metricPattern: RegExp, percentile: number): number {
        const matching = this.metrics.filter(m => metricPattern.test(m.name));
        if (matching.length === 0) return 0;

        const sorted = matching.map(m => m.duration).sort((a, b) => a - b);
        const index = Math.ceil((percentile / 100) * sorted.length) - 1;
        return sorted[index];
    }

    /**
     * Get current memory usage
     */
    getMemoryUsage(): number {
        if (!this.enabled) return 0;

        // In Node.js/Electron main process
        if (process.memoryUsage) {
            const usage = process.memoryUsage();
            return usage.heapUsed / (1024 * 1024); // MB
        }

        // In browser
        const perf = performance as Performance & { memory?: { usedJSHeapSize: number } };
        if (perf.memory) {
            return perf.memory.usedJSHeapSize / (1024 * 1024); // MB
        }

        return 0;
    }

    /**
     * Get performance summary
     */
    getSummary(): Record<string, unknown> {
        if (!this.enabled) {
            return { enabled: false };
        }

        return {
            enabled: true,
            totalMetrics: this.metrics.length,
            avgRenderTime: this.getAverage(/^render_/),
            avgApiTime: this.getAverage(/^api_/),
            avgToolTime: this.getAverage(/^tool_/),
            p95RenderTime: this.getPercentile(/^render_/, 95),
            p95ApiTime: this.getPercentile(/^api_/, 95),
            currentMemoryUsage: this.getMemoryUsage(),
        };
    }

    /**
     * Clear all metrics
     */
    clear(): void {
        this.metrics = [];
        this.stats = {
            renderTime: [],
            apiCallTime: [],
            toolExecutionTime: [],
            memoryUsage: [],
        };
    }

    /**
     * Export metrics as JSON
     */
    exportMetrics(): string {
        return JSON.stringify({
            metrics: this.metrics,
            stats: this.stats,
            summary: this.getSummary(),
        }, null, 2);
    }
}

// Singleton instance
export const performanceMonitor = new PerformanceMonitor(false);

/**
 * Convenience function to measure a function's execution time
 */
export async function measurePerformance<T>(
    name: string,
    fn: () => Promise<T> | T,
    metadata?: Record<string, unknown>
): Promise<T> {
    const endMeasure = performanceMonitor.startMeasure(name, metadata);
    try {
        return await fn();
    } finally {
        endMeasure();
    }
}

/**
 * Decorator for class methods to measure performance
 */
export function MeasurePerformance(metricName?: string) {
    return function (
        _target: unknown,
        propertyKey: string,
        descriptor: PropertyDescriptor
    ) {
        const originalMethod = descriptor.value;
        const name = metricName || `${String(propertyKey)}`;

        descriptor.value = async function (...args: unknown[]) {
            const endMeasure = performanceMonitor.startMeasure(name);
            try {
                return await originalMethod.apply(this, args);
            } finally {
                endMeasure();
            }
        };

        return descriptor;
    };
}
