/**
 * LRU (Least Recently Used) Cache Implementation
 * Provides an efficient caching mechanism with automatic eviction of least recently used items
 */

/**
 * LRU Cache node
 */
interface LRUNode<K, V> {
  key: K;
  value: V;
  prev: LRUNode<K, V> | null;
  next: LRUNode<K, V> | null;
}

/**
 * LRU Cache options
 */
export interface LRUCacheOptions {
  maxSize: number;          // Maximum number of items to store
  ttl?: number;             // Time-to-live in milliseconds (optional)
  onEvict?: (key: any, value: any) => void;  // Callback when item is evicted
}

/**
 * LRU Cache implementation
 * @template K - Key type
 * @template V - Value type
 */
export class LRUCache<K, V> {
  private maxSize: number;
  private ttl?: number;
  private onEvict?: (key: K, value: V) => void;
  private cache: Map<K, LRUNode<K, V>>;
  private head: LRUNode<K, V> | null;
  private tail: LRUNode<K, V> | null;
  private expirations: Map<K, number>;

  constructor(options: LRUCacheOptions) {
    this.maxSize = options.maxSize;
    this.ttl = options.ttl;
    this.onEvict = options.onEvict;
    this.cache = new Map();
    this.head = null;
    this.tail = null;
    this.expirations = new Map();
  }

  /**
   * Get a value from the cache
   * Returns undefined if the key doesn't exist or has expired
   */
  get(key: K): V | undefined {
    const node = this.cache.get(key);

    if (!node) {
      return undefined;
    }

    // Check expiration
    if (this.isExpired(key)) {
      this.delete(key);
      return undefined;
    }

    // Move to front (most recently used)
    this.moveToFront(node);
    return node.value;
  }

  /**
   * Set a value in the cache
   * If the key already exists, it will be updated and moved to the front
   */
  set(key: K, value: V): void {
    const existingNode = this.cache.get(key);

    if (existingNode) {
      // Update existing node
      existingNode.value = value;
      this.setExpiration(key);
      this.moveToFront(existingNode);
      return;
    }

    // Create new node
    const newNode: LRUNode<K, V> = {
      key,
      value,
      prev: null,
      next: null,
    };

    // Add to cache
    this.cache.set(key, newNode);
    this.setExpiration(key);

    // Add to front of list
    this.addToFront(newNode);

    // Check if we need to evict
    if (this.cache.size > this.maxSize) {
      this.evictLeastRecentlyUsed();
    }
  }

  /**
   * Check if a key exists in the cache (and hasn't expired)
   */
  has(key: K): boolean {
    const node = this.cache.get(key);
    if (!node) {
      return false;
    }
    if (this.isExpired(key)) {
      this.delete(key);
      return false;
    }
    return true;
  }

  /**
   * Delete a key from the cache
   */
  delete(key: K): boolean {
    const node = this.cache.get(key);
    if (!node) {
      return false;
    }

    // Remove from linked list
    this.removeNode(node);
    this.cache.delete(key);
    this.expirations.delete(key);
    return true;
  }

  /**
   * Clear all items from the cache
   */
  clear(): void {
    this.cache.clear();
    this.expirations.clear();
    this.head = null;
    this.tail = null;
  }

  /**
   * Get the current size of the cache
   */
  get size(): number {
    return this.cache.size;
  }

  /**
   * Get all keys in the cache (ordered by most recently used)
   */
  keys(): K[] {
    const keys: K[] = [];
    let current = this.head;
    while (current) {
      keys.push(current.key);
      current = current.next;
    }
    return keys;
  }

  /**
   * Get all values in the cache (ordered by most recently used)
   */
  values(): V[] {
    const values: V[] = [];
    let current = this.head;
    while (current) {
      values.push(current.value);
      current = current.next;
    }
    return values;
  }

  /**
   * Get all entries in the cache (ordered by most recently used)
   */
  entries(): [K, V][] {
    const entries: [K, V][] = [];
    let current = this.head;
    while (current) {
      entries.push([current.key, current.value]);
      current = current.next;
    }
    return entries;
  }

  /**
   * Clean up expired entries
   */
  cleanupExpired(): number {
    let cleaned = 0;
    const now = Date.now();

    for (const [key, expiration] of this.expirations.entries()) {
      if (expiration < now) {
        this.delete(key);
        cleaned++;
      }
    }

    return cleaned;
  }

  /**
   * Get cache statistics
   */
  getStats(): {
    size: number;
    maxSize: number;
    hitRate: number;
    expired: number;
  } {
    return {
      size: this.cache.size,
      maxSize: this.maxSize,
      hitRate: 0, // Would need to track hits/misses
      expired: this.expirations.size,
    };
  }

  /**
   * Check if a key has expired
   */
  private isExpired(key: K): boolean {
    if (!this.ttl) {
      return false;
    }
    const expiration = this.expirations.get(key);
    if (!expiration) {
      return false;
    }
    return expiration < Date.now();
  }

  /**
   * Set expiration time for a key
   */
  private setExpiration(key: K): void {
    if (this.ttl) {
      this.expirations.set(key, Date.now() + this.ttl);
    }
  }

  /**
   * Add a node to the front of the list
   */
  private addToFront(node: LRUNode<K, V>): void {
    node.prev = null;
    node.next = this.head;

    if (this.head) {
      this.head.prev = node;
    }

    this.head = node;

    if (!this.tail) {
      this.tail = node;
    }
  }

  /**
   * Move a node to the front of the list
   */
  private moveToFront(node: LRUNode<K, V>): void {
    if (node === this.head) {
      return; // Already at front
    }

    // Remove from current position
    this.removeNode(node);

    // Add to front
    this.addToFront(node);
  }

  /**
   * Remove a node from the list
   */
  private removeNode(node: LRUNode<K, V>): void {
    if (node.prev) {
      node.prev.next = node.next;
    } else {
      this.head = node.next;
    }

    if (node.next) {
      node.next.prev = node.prev;
    } else {
      this.tail = node.prev;
    }
  }

  /**
   * Evict the least recently used item
   */
  private evictLeastRecentlyUsed(): void {
    if (!this.tail) {
      return;
    }

    const key = this.tail.key;
    const value = this.tail.value;

    // Call eviction callback
    if (this.onEvict) {
      this.onEvict(key, value);
    }

    // Remove from cache
    this.delete(key);
  }
}

/**
 * Simple LRU Cache factory
 * Creates an LRU cache with sensible defaults
 */
export function createLRUCache<K, V>(
  maxSize: number = 100,
  ttl?: number
): LRUCache<K, V> {
  return new LRUCache<K, V>({
    maxSize,
    ttl,
  });
}

/**
 * Async LRU Cache - for caching promises
 * Useful for caching async operations like API calls
 */
export class AsyncLRUCache<K, V> {
  private cache: LRUCache<K, Promise<V>>;

  constructor(options: LRUCacheOptions) {
    this.cache = new LRUCache<K, Promise<V>>(options);
  }

  /**
   * Get a value or compute it if not cached
   */
  async getOrCompute(key: K, compute: () => Promise<V>): Promise<V> {
    const cachedPromise = this.cache.get(key);

    if (cachedPromise) {
      return cachedPromise;
    }

    // Compute and cache
    const promise = compute();
    this.cache.set(key, promise);

    try {
      return await promise;
    } catch (error) {
      // Remove failed computation from cache
      this.cache.delete(key);
      throw error;
    }
  }

  /**
   * Prefetch a value without waiting
   */
  prefetch(key: K, compute: () => Promise<V>): void {
    if (!this.cache.has(key)) {
      const promise = compute().catch(() => {
        this.cache.delete(key);
        return undefined as V;
      }) as Promise<V>;
      this.cache.set(key, promise);
    }
  }

  /**
   * Delete a key from the cache
   */
  delete(key: K): boolean {
    return this.cache.delete(key);
  }

  /**
   * Clear all items
   */
  clear(): void {
    this.cache.clear();
  }

  /**
   * Get cache size
   */
  get size(): number {
    return this.cache.size;
  }
}

/**
 * Create an async LRU cache
 */
export function createAsyncLRUCache<K, V>(
  maxSize: number = 100,
  ttl?: number
): AsyncLRUCache<K, V> {
  return new AsyncLRUCache<K, V>({
    maxSize,
    ttl,
  });
}
