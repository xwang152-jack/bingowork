/**
 * Unit tests for LRUCache
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { LRUCache, AsyncLRUCache, createLRUCache, createAsyncLRUCache } from '../LRUCache';

describe('LRUCache', () => {
  let cache: LRUCache<string, number>;

  beforeEach(() => {
    cache = new LRUCache<string, number>({ maxSize: 3 });
  });

  describe('Basic Operations', () => {
    it('should set and get values', () => {
      cache.set('a', 1);
      expect(cache.get('a')).toBe(1);
    });

    it('should return undefined for non-existent keys', () => {
      expect(cache.get('nonexistent')).toBeUndefined();
    });

    it('should update existing keys', () => {
      cache.set('a', 1);
      cache.set('a', 2);
      expect(cache.get('a')).toBe(2);
    });

    it('should report correct size', () => {
      expect(cache.size).toBe(0);
      cache.set('a', 1);
      expect(cache.size).toBe(1);
      cache.set('b', 2);
      expect(cache.size).toBe(2);
    });

    it('should clear all items', () => {
      cache.set('a', 1);
      cache.set('b', 2);
      expect(cache.size).toBe(2);
      cache.clear();
      expect(cache.size).toBe(0);
      expect(cache.get('a')).toBeUndefined();
      expect(cache.get('b')).toBeUndefined();
    });
  });

  describe('LRU Eviction', () => {
    it('should evict least recently used item when capacity is exceeded', () => {
      cache.set('a', 1);
      cache.set('b', 2);
      cache.set('c', 3);
      cache.set('d', 4); // Should evict 'a'

      expect(cache.size).toBe(3);
      expect(cache.get('a')).toBeUndefined();
      expect(cache.get('b')).toBe(2);
      expect(cache.get('c')).toBe(3);
      expect(cache.get('d')).toBe(4);
    });

    it('should move accessed items to front (most recently used)', () => {
      cache.set('a', 1);
      cache.set('b', 2);
      cache.set('c', 3);
      cache.get('a'); // Access 'a' to make it recently used
      cache.set('d', 4); // Should evict 'b' (least recently used)

      expect(cache.get('a')).toBe(1);
      expect(cache.get('b')).toBeUndefined();
      expect(cache.get('c')).toBe(3);
      expect(cache.get('d')).toBe(4);
    });

    it('should call onEvict callback when evicting', () => {
      const onEvict = vi.fn();
      cache = new LRUCache<string, number>({ maxSize: 2, onEvict });

      cache.set('a', 1);
      cache.set('b', 2);
      cache.set('c', 3); // Should evict 'a'

      expect(onEvict).toHaveBeenCalledTimes(1);
      expect(onEvict).toHaveBeenCalledWith('a', 1);
    });

    it('should not evict when updating existing key', () => {
      cache.set('a', 1);
      cache.set('b', 2);
      cache.set('c', 3);
      cache.set('a', 10); // Update existing key

      expect(cache.size).toBe(3);
      expect(cache.get('a')).toBe(10);
    });
  });

  describe('TTL (Time To Live)', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('should expire entries after TTL', () => {
      cache = new LRUCache<string, number>({ maxSize: 3, ttl: 1000 });

      cache.set('a', 1);
      expect(cache.get('a')).toBe(1);

      vi.advanceTimersByTime(1500);
      expect(cache.get('a')).toBeUndefined();
    });

    it('should not expire entries before TTL', () => {
      cache = new LRUCache<string, number>({ maxSize: 3, ttl: 1000 });

      cache.set('a', 1);
      vi.advanceTimersByTime(500);
      expect(cache.get('a')).toBe(1);
    });

    it('should reset TTL on update', () => {
      cache = new LRUCache<string, number>({ maxSize: 3, ttl: 1000 });

      cache.set('a', 1);
      vi.advanceTimersByTime(800);
      cache.set('a', 2); // Update should reset TTL
      vi.advanceTimersByTime(500);
      expect(cache.get('a')).toBe(2);
    });

    it('should return false for has() when expired', () => {
      cache = new LRUCache<string, number>({ maxSize: 3, ttl: 1000 });

      cache.set('a', 1);
      expect(cache.has('a')).toBe(true);

      vi.advanceTimersByTime(1500);
      expect(cache.has('a')).toBe(false);
    });

    it('should cleanup expired entries', () => {
      cache = new LRUCache<string, number>({ maxSize: 3, ttl: 1000 });

      cache.set('a', 1);
      cache.set('b', 2);
      vi.advanceTimersByTime(1500);

      const cleaned = cache.cleanupExpired();
      expect(cleaned).toBe(2);
      expect(cache.size).toBe(0);
    });
  });

  describe('has() method', () => {
    it('should return true for existing keys', () => {
      cache.set('a', 1);
      expect(cache.has('a')).toBe(true);
    });

    it('should return false for non-existing keys', () => {
      expect(cache.has('nonexistent')).toBe(false);
    });
  });

  describe('delete() method', () => {
    it('should delete existing keys', () => {
      cache.set('a', 1);
      expect(cache.delete('a')).toBe(true);
      expect(cache.get('a')).toBeUndefined();
      expect(cache.size).toBe(0);
    });

    it('should return false when deleting non-existing keys', () => {
      expect(cache.delete('nonexistent')).toBe(false);
    });
  });

  describe('Iteration Methods', () => {
    beforeEach(() => {
      cache.set('a', 1);
      cache.set('b', 2);
      cache.set('c', 3);
    });

    it('should return keys in most recently used order', () => {
      const keys = cache.keys();
      expect(keys).toEqual(['c', 'b', 'a']);
    });

    it('should return values in most recently used order', () => {
      const values = cache.values();
      expect(values).toEqual([3, 2, 1]);
    });

    it('should return entries in most recently used order', () => {
      const entries = cache.entries();
      expect(entries).toEqual([
        ['c', 3],
        ['b', 2],
        ['a', 1],
      ]);
    });

    it('should update order after access', () => {
      cache.get('a');
      const entries = cache.entries();
      expect(entries).toEqual([
        ['a', 1],
        ['c', 3],
        ['b', 2],
      ]);
    });
  });

  describe('getStats()', () => {
    it('should return cache statistics', () => {
      cache.set('a', 1);
      cache.set('b', 2);

      const stats = cache.getStats();
      expect(stats.size).toBe(2);
      expect(stats.maxSize).toBe(3);
      expect(stats.expired).toBe(0);
    });
  });
});

describe('AsyncLRUCache', () => {
  let asyncCache: AsyncLRUCache<string, number>;

  beforeEach(() => {
    asyncCache = new AsyncLRUCache<string, number>({ maxSize: 3 });
  });

  describe('getOrCompute()', () => {
    it('should compute and cache values', async () => {
      const compute = vi.fn().mockResolvedValue(42);

      const result = await asyncCache.getOrCompute('key', compute);
      expect(result).toBe(42);
      expect(compute).toHaveBeenCalledTimes(1);
    });

    it('should return cached value on second call', async () => {
      const compute = vi.fn().mockResolvedValue(42);

      await asyncCache.getOrCompute('key', compute);
      await asyncCache.getOrCompute('key', compute);

      expect(compute).toHaveBeenCalledTimes(1);
    });

    it('should remove failed computation from cache', async () => {
      const compute = vi.fn().mockRejectedValue(new Error('Failed'));

      await expect(asyncCache.getOrCompute('key', compute)).rejects.toThrow('Failed');
      expect(asyncCache.size).toBe(0);
    });
  });

  describe('prefetch()', () => {
    it('should prefetch values without waiting', async () => {
      const compute = vi.fn().mockResolvedValue(42);

      asyncCache.prefetch('key', compute);
      expect(compute).toHaveBeenCalledTimes(1);

      // Wait for the promise to resolve
      await new Promise(resolve => setTimeout(resolve, 0));

      const result = await asyncCache.getOrCompute('key', compute);
      expect(result).toBe(42);
      expect(compute).toHaveBeenCalledTimes(1); // Should not recompute
    });

    it('should not prefetch if already cached', async () => {
      const compute = vi.fn().mockResolvedValue(42);

      await asyncCache.getOrCompute('key', compute);
      asyncCache.prefetch('key', compute);

      expect(compute).toHaveBeenCalledTimes(1);
    });
  });

  describe('Basic Operations', () => {
    it('should delete keys', async () => {
      await asyncCache.getOrCompute('key', () => Promise.resolve(42));
      expect(asyncCache.delete('key')).toBe(true);
      expect(asyncCache.size).toBe(0);
    });

    it('should clear all items', async () => {
      await asyncCache.getOrCompute('key1', () => Promise.resolve(1));
      await asyncCache.getOrCompute('key2', () => Promise.resolve(2));
      expect(asyncCache.size).toBe(2);

      asyncCache.clear();
      expect(asyncCache.size).toBe(0);
    });

    it('should report correct size', async () => {
      expect(asyncCache.size).toBe(0);
      await asyncCache.getOrCompute('key', () => Promise.resolve(42));
      expect(asyncCache.size).toBe(1);
    });
  });
});

describe('Factory Functions', () => {
  it('should create LRU cache with defaults', () => {
    const cache = createLRUCache<string, number>();
    expect(cache).toBeInstanceOf(LRUCache);
    cache.set('a', 1);
    expect(cache.get('a')).toBe(1);
  });

  it('should create LRU cache with custom size', () => {
    const cache = createLRUCache<string, number>(10);
    cache.set('a', 1);
    expect(cache.get('a')).toBe(1);
  });

  it('should create LRU cache with TTL', () => {
    const cache = createLRUCache<string, number>(10, 1000);
    cache.set('a', 1);
    expect(cache.get('a')).toBe(1);
  });

  it('should create async LRU cache with defaults', () => {
    const cache = createAsyncLRUCache<string, number>();
    expect(cache).toBeInstanceOf(AsyncLRUCache);
  });

  it('should create async LRU cache with custom size', () => {
    const cache = createAsyncLRUCache<string, number>(10);
    expect(cache).toBeInstanceOf(AsyncLRUCache);
  });

  it('should create async LRU cache with TTL', () => {
    const cache = createAsyncLRUCache<string, number>(10, 1000);
    expect(cache).toBeInstanceOf(AsyncLRUCache);
  });
});
