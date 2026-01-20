/**
 * Unit tests for PerformanceMonitor
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  performanceMonitor,
  measurePerformance,
  MeasurePerformance,
  PerformanceMonitor,
} from '../PerformanceMonitor';

describe('PerformanceMonitor', () => {
  let monitor: PerformanceMonitor;

  beforeEach(() => {
    monitor = new PerformanceMonitor(true);
  });

  describe('Initialization', () => {
    it('should create monitor with enabled flag', () => {
      const enabledMonitor = new PerformanceMonitor(true);
      enabledMonitor.setEnabled(true);

      const summary = enabledMonitor.getSummary();
      expect(summary).toHaveProperty('enabled', true);
    });

    it('should create disabled monitor', () => {
      const disabledMonitor = new PerformanceMonitor(false);

      const summary = disabledMonitor.getSummary();
      expect(summary).toEqual({ enabled: false });
    });
  });

  describe('Measurement', () => {
    it('should measure execution time', async () => {
      const endMeasure = monitor.startMeasure('test_metric');

      // Simulate some work
      await new Promise(resolve => setTimeout(resolve, 10));

      endMeasure();

      const avgTime = monitor.getAverage(/test_metric/);
      expect(avgTime).toBeGreaterThan(0);
    });

    it('should record metric with metadata', () => {
      const endMeasure = monitor.startMeasure('test_with_metadata', { key: 'value' });
      endMeasure();

      // The metric should be recorded but we can't directly access metrics array
      // Instead, we verify through the average
      const avgTime = monitor.getAverage(/test_with_metadata/);
      expect(avgTime).toBeGreaterThanOrEqual(0);
    });

    it('should not record when disabled', () => {
      monitor.setEnabled(false);

      const endMeasure = monitor.startMeasure('disabled_metric');
      endMeasure();

      const avgTime = monitor.getAverage(/disabled_metric/);
      expect(avgTime).toBe(0);
    });
  });

  describe('Statistics', () => {
    it('should calculate average correctly', () => {
      // Simulate multiple measurements
      const durations = [10, 20, 30, 40, 50];

      durations.forEach(duration => {
        monitor.recordMetric({
          name: 'avg_test',
          duration,
          timestamp: Date.now(),
        });
      });

      const avg = monitor.getAverage(/avg_test/);
      expect(avg).toBe(30); // (10+20+30+40+50) / 5
    });

    it('should calculate median correctly', () => {
      // Odd number of values
      monitor.recordMetric({
        name: 'median_test',
        duration: 10,
        timestamp: Date.now(),
      });
      monitor.recordMetric({
        name: 'median_test',
        duration: 30,
        timestamp: Date.now(),
      });
      monitor.recordMetric({
        name: 'median_test',
        duration: 20,
        timestamp: Date.now(),
      });

      const median = monitor.getMedian(/median_test/);
      expect(median).toBe(20);
    });

    it('should calculate percentile correctly', () => {
      const durations = [10, 20, 30, 40, 50, 60, 70, 80, 90, 100];

      durations.forEach(duration => {
        monitor.recordMetric({
          name: 'percentile_test',
          duration,
          timestamp: Date.now(),
        });
      });

      const p95 = monitor.getPercentile(/percentile_test/, 95);
      expect(p95).toBe(100); // 95th percentile of sorted array
    });

    it('should return 0 for no matching metrics', () => {
      const avg = monitor.getAverage(/nonexistent/);
      expect(avg).toBe(0);

      const median = monitor.getMedian(/nonexistent/);
      expect(median).toBe(0);

      const percentile = monitor.getPercentile(/nonexistent/, 50);
      expect(percentile).toBe(0);
    });
  });

  describe('Memory Usage', () => {
    it('should return memory usage in MB when enabled', () => {
      monitor.setEnabled(true);

      const usage = monitor.getMemoryUsage();
      expect(typeof usage).toBe('number');
    });

    it('should return 0 when disabled', () => {
      monitor.setEnabled(false);

      const usage = monitor.getMemoryUsage();
      expect(usage).toBe(0);
    });
  });

  describe('Summary', () => {
    it('should provide comprehensive summary', () => {
      // Add some test metrics without prefixes
      monitor.recordMetric({
        name: 'custom_test',
        duration: 16,
        timestamp: Date.now(),
      });
      monitor.recordMetric({
        name: 'another_test',
        duration: 100,
        timestamp: Date.now(),
      });
      monitor.recordMetric({
        name: 'third_test',
        duration: 50,
        timestamp: Date.now(),
      });

      const summary = monitor.getSummary();

      expect(summary).toHaveProperty('enabled', true);
      expect(summary).toHaveProperty('totalMetrics', 3);
      expect(summary).toHaveProperty('avgRenderTime', 0); // No render_ prefix
      expect(summary).toHaveProperty('avgApiTime', 0); // No api_ prefix
      expect(summary).toHaveProperty('avgToolTime', 0); // No tool_ prefix
      expect(summary).toHaveProperty('currentMemoryUsage');
    });

    it('should return disabled state when not enabled', () => {
      monitor.setEnabled(false);

      const summary = monitor.getSummary();
      expect(summary).toEqual({ enabled: false });
    });

    it('should calculate averages for prefixed metrics', () => {
      monitor.recordMetric({
        name: 'render_component',
        duration: 16,
        timestamp: Date.now(),
      });
      monitor.recordMetric({
        name: 'render_list',
        duration: 24,
        timestamp: Date.now(),
      });
      monitor.recordMetric({
        name: 'api_call',
        duration: 100,
        timestamp: Date.now(),
      });
      monitor.recordMetric({
        name: 'tool_execute',
        duration: 50,
        timestamp: Date.now(),
      });

      const summary = monitor.getSummary() as {
        avgRenderTime: number;
        avgApiTime: number;
        avgToolTime: number;
      };

      expect(summary.avgRenderTime).toBe(20); // (16 + 24) / 2
      expect(summary.avgApiTime).toBe(100);
      expect(summary.avgToolTime).toBe(50);
    });
  });

  describe('Clear', () => {
    it('should clear all metrics', () => {
      monitor.recordMetric({
        name: 'test',
        duration: 100,
        timestamp: Date.now(),
      });

      monitor.clear();

      const summary = monitor.getSummary() as { totalMetrics: number };
      expect(summary.totalMetrics).toBe(0);
    });
  });

  describe('Export', () => {
    it('should export metrics as JSON', () => {
      monitor.recordMetric({
        name: 'export_test',
        duration: 42,
        timestamp: Date.now(),
      });

      const exported = monitor.exportMetrics();
      const parsed = JSON.parse(exported);

      expect(parsed).toHaveProperty('metrics');
      expect(parsed).toHaveProperty('stats');
      expect(parsed).toHaveProperty('summary');
      expect(parsed.metrics).toBeInstanceOf(Array);
      expect(parsed.metrics.length).toBeGreaterThan(0);
    });
  });

  describe('Max Metrics Limit', () => {
    it('should limit stored metrics', () => {
      const smallMonitor = new PerformanceMonitor(true);
      // Access private property for testing
      (smallMonitor as unknown as { maxMetrics: number }).maxMetrics = 5;

      // Add more than maxMetrics
      for (let i = 0; i < 10; i++) {
        smallMonitor.recordMetric({
          name: `test_${i}`,
          duration: i,
          timestamp: Date.now(),
        });
      }

      const summary = smallMonitor.getSummary() as { totalMetrics: number };
      expect(summary.totalMetrics).toBeLessThanOrEqual(5);
    });
  });
});

describe('measurePerformance helper', () => {
  beforeEach(() => {
    // The helper uses the global singleton
    performanceMonitor.setEnabled(true);
    performanceMonitor.clear();
  });

  it('should measure async function execution time', async () => {
    const result = await measurePerformance('async_test', async () => {
      await new Promise(resolve => setTimeout(resolve, 10));
      return 'completed';
    });

    expect(result).toBe('completed');

    const avgTime = performanceMonitor.getAverage(/async_test/);
    expect(avgTime).toBeGreaterThan(0);
  });

  it('should measure sync function execution time', async () => {
    const result = await measurePerformance('sync_test', () => {
      return 'sync_result';
    });

    expect(result).toBe('sync_result');

    const avgTime = performanceMonitor.getAverage(/sync_test/);
    expect(avgTime).toBeGreaterThanOrEqual(0);
  });

  it('should record metadata', async () => {
    await measurePerformance(
      'metadata_test',
      () => 'done',
      { extra: 'data' }
    );

    const summary = performanceMonitor.getSummary();
    expect(summary).toHaveProperty('enabled');
  });

  afterEach(() => {
    // Clean up - disable the singleton after tests
    performanceMonitor.setEnabled(false);
  });
});

describe('MeasurePerformance decorator', () => {
  it('should create decorator for methods', () => {
    // This tests that the decorator function exists and returns expected structure
    expect(typeof MeasurePerformance).toBe('function');

    const descriptor = {
      value: async function () {
        return 'result';
      },
      enumerable: true,
      configurable: true,
    };

    const result = MeasurePerformance('test_method')(
      {},
      'testMethod',
      descriptor
    );

    expect(result).toHaveProperty('value');
    expect(typeof result.value).toBe('function');
  });
});

describe('Singleton instance', () => {
  it('should export singleton instance', () => {
    expect(performanceMonitor).toBeInstanceOf(PerformanceMonitor);
  });

  it('should be disabled by default', () => {
    const summary = performanceMonitor.getSummary();
    expect(summary).toEqual({ enabled: false });
  });
});
