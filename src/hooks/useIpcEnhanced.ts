/**
 * Enhanced IPC React Hooks
 * Provides additional hooks with timeout, retry, and caching support
 * Builds upon the existing IPC infrastructure
 */

import { useState, useCallback, useEffect, useRef } from 'react';
import { IPCService, IPCRequestOptions } from '../services/IPCService';
import { cacheManager, CacheKey } from '../services/CacheManager';

/**
 * Hook for invoking IPC channels with loading and error states
 * Supports caching, timeout, and retries
 */
export function useIpcInvoke<T = any>(
  channel: string,
  options?: IPCRequestOptions & {
    cacheKey?: CacheKey;
    cacheKeyFn?: (...args: any[]) => string;
  }
) {
  const [data, setData] = useState<T | undefined>(undefined);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const invoke = useCallback(
    async (...args: any[]): Promise<T> => {
      setIsLoading(true);
      setError(null);

      try {
        // Check cache first
        if (options?.cacheKey) {
          const cacheKeyValue = options.cacheKeyFn
            ? options.cacheKeyFn(...args)
            : `${channel}:${JSON.stringify(args)}`;

          const cached = cacheManager.get(options.cacheKey, cacheKeyValue);
          if (cached !== undefined) {
            setData(cached);
            setIsLoading(false);
            return cached;
          }
        }

        // Invoke IPC
        const result = await IPCService.invokeWithOptions<T>(
          channel,
          options || {},
          ...args
        );

        // Cache result
        if (options?.cacheKey) {
          const cacheKeyValue = options.cacheKeyFn
            ? options.cacheKeyFn(...args)
            : `${channel}:${JSON.stringify(args)}`;
          cacheManager.set(options.cacheKey, cacheKeyValue, result);
        }

        setData(result);
        return result;
      } catch (err) {
        const error = err as Error;
        setError(error);
        throw error;
      } finally {
        setIsLoading(false);
      }
    },
    [channel, options]
  );

  return { invoke, data, isLoading, error };
}

/**
 * Hook for listening to IPC events
 */
export function useIpcOn<T = any>(
  channel: string,
  callback: (data: T) => void,
  deps: React.DependencyList = []
) {
  useEffect(() => {
    const cleanup = IPCService.on(channel, callback);
    return cleanup;
  }, [channel, callback, ...deps]);
}

/**
 * Hook for IPC invoke with automatic retry and polling
 */
export function useIpcInvokePoll<T = any>(
  channel: string,
  args: any[] = [],
  options: {
    interval?: number;        // Polling interval in ms
    enabled?: boolean;        // Whether polling is enabled
    immediate?: boolean;      // Invoke immediately on mount
  } = {}
) {
  const { data, invoke, isLoading, error } = useIpcInvoke<T>(channel);

  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const { interval = 5000, enabled = true, immediate = true } = options;

  const poll = useCallback(async () => {
    if (enabled) {
      try {
        await invoke(...args);
      } catch (err) {
        // Error is already handled by useIpcInvoke
      }
    }
  }, [enabled, invoke, ...args]);

  useEffect(() => {
    if (immediate) {
      poll();
    }

    if (enabled && interval > 0) {
      intervalRef.current = setInterval(poll, interval);
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [enabled, interval, immediate, poll]);

  return { data, isLoading, error, refetch: poll };
}

/**
 * Hook for IPC invoke with manual trigger (lazy)
 */
export function useIpcInvokeLazy<T = any>(
  channel: string,
  options?: IPCRequestOptions
) {
  const [data, setData] = useState<T | undefined>(undefined);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const invoke = useCallback(
    async (...args: any[]): Promise<T> => {
      setIsLoading(true);
      setError(null);

      try {
        const result = await IPCService.invokeWithOptions<T>(
          channel,
          options || {},
          ...args
        );
        setData(result);
        return result;
      } catch (err) {
        const error = err as Error;
        setError(error);
        throw error;
      } finally {
        setIsLoading(false);
      }
    },
    [channel, options]
  );

  const reset = useCallback(() => {
    setData(undefined);
    setError(null);
    setIsLoading(false);
  }, []);

  return { invoke, data, isLoading, error, reset };
}

/**
 * Hook for multiple concurrent IPC invokes
 */
export function useIpcInvokeAll<T extends Record<string, any>>(
  invokes: Record<keyof T, string>
) {
  const [results, setResults] = useState<Partial<T>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState<Partial<Record<keyof T, Error>>>({});

  const invokeAll = useCallback(async () => {
    setIsLoading(true);
    setErrors({});

    try {
      const promises = Object.entries(invokes).map(async ([key, channel]) => {
        try {
          const result = await IPCService.invoke(channel);
          return [key, result];
        } catch (error) {
          return [key, { error }];
        }
      });

      const settled = await Promise.allSettled(promises);

      const newResults: Partial<T> = {};
      const newErrors: Partial<Record<keyof T, Error>> = {};

      settled.forEach((result, index) => {
        const keys = Object.keys(invokes) as Array<keyof T>;
        const key = keys[index];

        if (result.status === 'fulfilled') {
          const [, value] = result.value as [string, any];
          if (value && typeof value === 'object' && 'error' in value) {
            (newErrors as any)[key] = value.error as Error;
          } else {
            (newResults as any)[key] = value;
          }
        } else {
          (newErrors as any)[key] = result.reason;
        }
      });

      setResults(newResults);
      setErrors(newErrors);
    } finally {
      setIsLoading(false);
    }
  }, [invokes]);

  useEffect(() => {
    invokeAll();
  }, [invokeAll]);

  return {
    results,
    isLoading,
    errors,
    hasErrors: Object.keys(errors).length > 0,
    refetch: invokeAll,
  };
}

/**
 * Hook for IPC state synchronization
 * Automatically syncs state with IPC events
 */
export function useIpcState<T = any>(
  channel: {
    get: string;    // Channel to get current state
    onUpdate: string;  // Channel that sends updates
  },
  initialValue?: T
) {
  const [state, setState] = useState<T | undefined>(initialValue);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  // Fetch initial state
  useEffect(() => {
    let cancelled = false;

    const fetchState = async () => {
      setIsLoading(true);
      try {
        const result = await IPCService.invoke<T>(channel.get);
        if (!cancelled) {
          setState(result);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err as Error);
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    };

    fetchState();

    return () => {
      cancelled = true;
    };
  }, [channel.get]);

  // Listen for updates
  useIpcOn<T>(channel.onUpdate, (newState) => {
    setState(newState);
  });

  return { state, setState, isLoading, error };
}

/**
 * Hook for debounced IPC invoke
 */
export function useIpcInvokeDebounced<T = any>(
  channel: string,
  delay: number = 500,
  options?: IPCRequestOptions
) {
  const [data, setData] = useState<T | undefined>(undefined);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  const invoke = useCallback(
    (...args: any[]) => {
      setIsLoading(true);

      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }

      timeoutRef.current = setTimeout(async () => {
        try {
          const result = await IPCService.invokeWithOptions<T>(
            channel,
            options || {},
            ...args
          );
          setData(result);
          setError(null);
        } catch (err) {
          setError(err as Error);
        } finally {
          setIsLoading(false);
        }
      }, delay);
    },
    [channel, delay, options]
  );

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  return { invoke, data, isLoading, error };
}

/**
 * Hook for IPC invoke with mutation (for updates/creates/deletes)
 */
export function useIpcMutation<T = any, TVariables = any>(
  channel: string,
  options?: IPCRequestOptions & {
    onSuccess?: (data: T) => void;
    onError?: (error: Error) => void;
  }
) {
  const [data, setData] = useState<T | undefined>(undefined);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const mutate = useCallback(
    async (variables: TVariables): Promise<T> => {
      setIsLoading(true);
      setError(null);

      try {
        const result = await IPCService.invokeWithOptions<T>(
          channel,
          options || {},
          variables
        );

        setData(result);

        if (options?.onSuccess) {
          options.onSuccess(result);
        }

        return result;
      } catch (err) {
        const error = err as Error;
        setError(error);

        if (options?.onError) {
          options.onError(error);
        }

        throw error;
      } finally {
        setIsLoading(false);
      }
    },
    [channel, options]
  );

  const reset = useCallback(() => {
    setData(undefined);
    setError(null);
    setIsLoading(false);
  }, []);

  return { mutate, data, isLoading, error, reset };
}

/**
 * Hook for infinite scroll with IPC
 */
export function useIpcInfinite<T = any>(
  channel: string,
  options: {
    pageSize?: number;
    enabled?: boolean;
  } = {}
) {
  const { pageSize = 20, enabled = true } = options;

  const [data, setData] = useState<T[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const pageRef = useRef(0);

  const loadMore = useCallback(async () => {
    if (!enabled || isLoading || !hasMore) {
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const result = await IPCService.invoke<{ items: T[]; hasMore: boolean }>(
        channel,
        { page: pageRef.current, pageSize }
      );

      if (result?.items) {
        setData((prev) => [...prev, ...result.items]);
        setHasMore(result.hasMore ?? true);
        pageRef.current += 1;
      }
    } catch (err) {
      setError(err as Error);
    } finally {
      setIsLoading(false);
    }
  }, [channel, enabled, isLoading, hasMore, pageSize]);

  const reset = useCallback(() => {
    setData([]);
    pageRef.current = 0;
    setHasMore(true);
    setError(null);
  }, []);

  return {
    data,
    isLoading,
    error,
    hasMore,
    loadMore,
    reset,
  };
}
