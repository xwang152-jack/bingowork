/**
 * Cache Manager
 * Centralized cache management for various application scenarios
 */

import { LRUCache, createLRUCache, createAsyncLRUCache } from '../utils/LRUCache';

/**
 * Cache keys for different scenarios
 */
export enum CacheKey {
  LLM_RESPONSE = 'llm_response',
  FILE_READ = 'file_read',
  SKILL_LIST = 'skill_list',
  MCP_TOOLS = 'mcp_tools',
  SESSION_HISTORY = 'session_history',
}

/**
 * Cache configuration
 */
interface CacheConfig {
  maxSize: number;
  ttl?: number;
}

/**
 * Default cache configurations
 */
const DEFAULT_CONFIGS: Record<CacheKey, CacheConfig> = {
  [CacheKey.LLM_RESPONSE]: {
    maxSize: 100,      // Cache up to 100 LLM responses
    ttl: 30 * 60 * 1000, // 30 minutes TTL
  },
  [CacheKey.FILE_READ]: {
    maxSize: 500,      // Cache up to 500 file reads
    ttl: 5 * 60 * 1000,  // 5 minutes TTL
  },
  [CacheKey.SKILL_LIST]: {
    maxSize: 10,       // Cache skill lists
    ttl: 60 * 60 * 1000, // 1 hour TTL
  },
  [CacheKey.MCP_TOOLS]: {
    maxSize: 20,       // Cache MCP tool lists
    ttl: 10 * 60 * 1000, // 10 minutes TTL
  },
  [CacheKey.SESSION_HISTORY]: {
    maxSize: 50,       // Cache session histories
    ttl: 15 * 60 * 1000, // 15 minutes TTL
  },
};

/**
 * Global cache manager
 */
class CacheManager {
  private caches: Map<CacheKey, LRUCache<string, any>>;
  private asyncCaches: Map<CacheKey, any>;

  constructor() {
    this.caches = new Map();
    this.asyncCaches = new Map();
    this.initializeCaches();
  }

  /**
   * Initialize all caches
   */
  private initializeCaches(): void {
    for (const [key, config] of Object.entries(DEFAULT_CONFIGS)) {
      const cacheKey = key as CacheKey;

      // Create sync cache
      this.caches.set(
        cacheKey,
        createLRUCache<string, any>(config.maxSize, config.ttl)
      );

      // Create async cache
      this.asyncCaches.set(
        cacheKey,
        createAsyncLRUCache<string, any>(config.maxSize, config.ttl)
      );
    }

    // Set up periodic cleanup
    this.startCleanupInterval();
  }

  /**
   * Get a cached value
   */
  get(cacheKey: CacheKey, key: string): any | undefined {
    const cache = this.caches.get(cacheKey);
    return cache?.get(key);
  }

  /**
   * Set a cached value
   */
  set(cacheKey: CacheKey, key: string, value: any): void {
    const cache = this.caches.get(cacheKey);
    cache?.set(key, value);
  }

  /**
   * Check if a key is cached
   */
  has(cacheKey: CacheKey, key: string): boolean {
    const cache = this.caches.get(cacheKey);
    return cache ? cache.has(key) : false;
  }

  /**
   * Delete a cached value
   */
  delete(cacheKey: CacheKey, key: string): boolean {
    const cache = this.caches.get(cacheKey);
    return cache ? cache.delete(key) : false;
  }

  /**
   * Clear all caches or a specific cache
   */
  clear(cacheKey?: CacheKey): void {
    if (cacheKey) {
      this.caches.get(cacheKey)?.clear();
      this.asyncCaches.get(cacheKey)?.clear();
    } else {
      for (const cache of this.caches.values()) {
        cache.clear();
      }
      for (const asyncCache of this.asyncCaches.values()) {
        asyncCache.clear();
      }
    }
  }

  /**
   * Get or compute a cached value (async)
   */
  async getOrCompute<T>(
    cacheKey: CacheKey,
    key: string,
    compute: () => Promise<T>
  ): Promise<T> {
    const asyncCache = this.asyncCaches.get(cacheKey);
    if (!asyncCache) {
      return compute();
    }
    return asyncCache.getOrCompute(key, compute);
  }

  /**
   * Prefetch a value (async)
   */
  prefetch(cacheKey: CacheKey, key: string, compute: () => Promise<any>): void {
    const asyncCache = this.asyncCaches.get(cacheKey);
    asyncCache?.prefetch(key, compute);
  }

  /**
   * Get cache statistics
   */
  getStats(cacheKey: CacheKey): { size: number; maxSize: number } | null {
    const cache = this.caches.get(cacheKey);
    return cache
      ? {
          size: cache.size,
          maxSize: (DEFAULT_CONFIGS[cacheKey] as CacheConfig).maxSize,
        }
      : null;
  }

  /**
   * Get all cache statistics
   */
  getAllStats(): Record<string, { size: number; maxSize: number }> {
    const stats: Record<string, { size: number; maxSize: number }> = {};

    for (const [key, config] of Object.entries(DEFAULT_CONFIGS)) {
      const cache = this.caches.get(key as CacheKey);
      if (cache) {
        stats[key] = {
          size: cache.size,
          maxSize: config.maxSize,
        };
      }
    }

    return stats;
  }

  /**
   * Start periodic cleanup of expired entries
   */
  private startCleanupInterval(): void {
    // Clean up expired entries every 5 minutes
    setInterval(() => {
      for (const cache of this.caches.values()) {
        cache.cleanupExpired();
      }
    }, 5 * 60 * 1000);
  }

  /**
   * Create a cache key from parameters
   */
  static createKey(...parts: (string | number | object)[]): string {
    return parts
      .map(part => {
        if (typeof part === 'object') {
          return JSON.stringify(part);
        }
        return String(part);
      })
      .join(':');
  }

  /**
   * Create a hash-based cache key
   * Useful for long keys or complex objects
   */
  static async createHashKey(...parts: (string | object)[]): Promise<string> {
    const str = parts
      .map(part => {
        if (typeof part === 'object') {
          return JSON.stringify(part);
        }
        return String(part);
      })
      .join(':');

    // Simple hash function
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash; // Convert to 32-bit integer
    }

    return `hash:${Math.abs(hash)}`;
  }
}

// Export singleton instance
export const cacheManager = new CacheManager();

/**
 * Cache decorator for methods
 * Automatically caches method results based on arguments
 */
export function Cached(cacheKey: CacheKey, keyFn?: (...args: any[]) => string) {
  return function (
    _target: any,
    propertyKey: string,
    descriptor: PropertyDescriptor
  ) {
    const originalMethod = descriptor.value;

    descriptor.value = async function (this: any, ...args: any[]) {
      const cacheKeyValue = keyFn
        ? keyFn(...args)
        : CacheManager.createKey(propertyKey, ...args);

      // Check cache first
      if (cacheManager.has(cacheKey, cacheKeyValue)) {
        return cacheManager.get(cacheKey, cacheKeyValue);
      }

      // Compute and cache
      const result = await originalMethod.apply(this, args);
      cacheManager.set(cacheKey, cacheKeyValue, result);

      return result;
    };

    return descriptor;
  };
}

/**
 * React Hook for using cache
 */
export function useCache<T>(
  cacheKey: CacheKey,
  key: string,
  fetcher: () => Promise<T>,
  options?: {
    enabled?: boolean;
    staleTime?: number;
  }
): {
  data: T | undefined;
  isLoading: boolean;
  error: Error | null;
  refetch: () => void;
} {
  const [data, setData] = React.useState<T | undefined>(() =>
    cacheManager.get(cacheKey, key)
  );
  const [isLoading, setIsLoading] = React.useState(false);
  const [error, setError] = React.useState<Error | null>(null);

  const fetchData = React.useCallback(async () => {
    if (options?.enabled === false) return;

    setIsLoading(true);
    setError(null);

    try {
      const result = await cacheManager.getOrCompute(cacheKey, key, fetcher);
      setData(result);
    } catch (err) {
      setError(err as Error);
    } finally {
      setIsLoading(false);
    }
  }, [cacheKey, key, fetcher, options?.enabled]);

  React.useEffect(() => {
    fetchData();
  }, [fetchData]);

  return { data, isLoading, error, refetch: fetchData };
}

// Import React for the hook
import React from 'react';
