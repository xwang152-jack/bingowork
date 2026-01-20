/**
 * Enhanced Type-Safe IPC Wrapper
 * Provides compile-time type safety for IPC communication
 * Eliminates the need for type assertions and reduces runtime errors
 */

import type { IPCInvokeChannels, IPCEvents } from '../../electron/types/ipc';

// Type for the exposed ipcRenderer from preload
type IpcRendererExposed = {
  invoke(channel: string, ...args: any[]): Promise<any>;
  on(channel: string, listener: (...args: any[]) => void): () => void;
  off(channel: string, listener: (...args: any[]) => void): void;
  send(channel: string, ...args: any[]): void;
};

/**
 * Extract the parameter type from an IPC invoke channel
 */
type InvokeParams<K extends keyof IPCInvokeChannels> = IPCInvokeChannels[K] extends (...args: infer P) => any ? P : never;

/**
 * Extract the return type from an IPC invoke channel
 */
type InvokeReturn<K extends keyof IPCInvokeChannels> = IPCInvokeChannels[K] extends (...args: any[]) => infer R ? R : any;

/**
 * Extract the payload type from an IPC event
 */
type EventPayload<K extends keyof IPCEvents> = IPCEvents[K];

/**
 * Type-safe IPC wrapper for renderer process
 */
export class TypedIPC {
  /**
   * Invoke an IPC channel with type safety
   * @param channel - The IPC channel to invoke
   * @param args - Arguments to pass to the channel handler
   * @returns Promise that resolves with the result
   */
  static async invoke<K extends keyof IPCInvokeChannels>(
    channel: K,
    ...args: InvokeParams<K>
  ): Promise<InvokeReturn<K>> {
    const ipc = (window as any).ipcRenderer as IpcRendererExposed;
    return await ipc.invoke(channel, ...args) as Promise<InvokeReturn<K>>;
  }

  /**
   * Invoke an IPC channel with timeout
   * @param channel - The IPC channel to invoke
   * @param timeout - Timeout in milliseconds
   * @param args - Arguments to pass to the channel handler
   * @returns Promise that resolves with the result or rejects on timeout
   */
  static async invokeWithTimeout<K extends keyof IPCInvokeChannels>(
    channel: K,
    timeout: number,
    ...args: InvokeParams<K>
  ): Promise<InvokeReturn<K>> {
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error(`IPC timeout: ${String(channel)}`)), timeout);
    });

    const ipc = (window as any).ipcRenderer as IpcRendererExposed;
    return await Promise.race([
      ipc.invoke(channel, ...args),
      timeoutPromise,
    ]) as Promise<InvokeReturn<K>>;
  }

  /**
   * Listen to an IPC event with type safety
   * @param channel - The IPC event channel to listen to
   * @param callback - Callback function that receives the event payload
   * @returns Cleanup function to remove the listener
   */
  static on<K extends keyof IPCEvents>(
    channel: K,
    callback: (payload: EventPayload<K>) => void
  ): () => void {
    const listener = (_event: any, ...args: any[]) => {
      // For events with a single payload parameter
      if (args.length === 1) {
        callback(args[0] as EventPayload<K>);
      } else {
        // For events with multiple parameters, pass as-is
        callback(args as any);
      }
    };

    const ipc = (window as any).ipcRenderer as IpcRendererExposed;
    ipc.on(channel, listener);

    return () => {
      ipc.off(channel, listener);
    };
  }

  /**
   * Listen to an IPC event once with type safety
   * @param channel - The IPC event channel to listen to
   * @param callback - Callback function that receives the event payload
   */
  static once<K extends keyof IPCEvents>(
    channel: K,
    callback: (payload: EventPayload<K>) => void
  ): void {
    const wrappedListener: any = (_event: any, ...args: any[]) => {
      if (args.length === 1) {
        callback(args[0] as EventPayload<K>);
      } else {
        callback(args as any);
      }
      const ipc = (window as any).ipcRenderer as IpcRendererExposed;
      ipc.off(channel, wrappedListener);
    };

    const ipc = (window as any).ipcRenderer as IpcRendererExposed;
    ipc.on(channel, wrappedListener);
  }

  /**
   * Send a one-way message (no response expected)
   * @param channel - The IPC channel to send to
   * @param args - Arguments to send
   */
  static send<K extends keyof IPCInvokeChannels>(
    channel: K,
    ...args: InvokeParams<K>
  ): void {
    const ipc = (window as any).ipcRenderer as IpcRendererExposed;
    ipc.send(channel, ...args);
  }
}

/**
 * Create a typed hook for a specific IPC invoke channel
 * @param channel - The IPC channel to create a hook for
 * @returns A custom hook for that channel
 */
export function createInvokeHook<K extends keyof IPCInvokeChannels>(
  channel: K
) {
  return function useTypedInvoke(...args: InvokeParams<K>) {
    const [data, setData] = React.useState<InvokeReturn<K> | undefined>(undefined);
    const [isLoading, setIsLoading] = React.useState(false);
    const [error, setError] = React.useState<Error | null>(null);

    const invoke = React.useCallback(
      async (...overrideArgs: InvokeParams<K>) => {
        setIsLoading(true);
        setError(null);

        try {
          const result = await TypedIPC.invoke(channel, ...(overrideArgs.length > 0 ? overrideArgs : args));
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
      [channel, ...args]
    );

    return { invoke, data, isLoading, error };
  };
}

/**
 * Create a typed hook for a specific IPC event
 * @param channel - The IPC event channel to create a hook for
 * @returns A custom hook for that event
 */
export function createEventHook<K extends keyof IPCEvents>(
  channel: K
) {
  return function useTypedEvent(
    callback: (payload: EventPayload<K>) => void,
    deps: React.DependencyList = []
  ) {
    React.useEffect(() => {
      const cleanup = TypedIPC.on(channel, callback);
      return cleanup;
    }, [channel, callback, ...deps]);
  };
}

/**
 * Typed IPC service with method chaining
 * Provides a fluent API for common IPC operations
 */
export class TypedIPCService {
  /**
   * Get a builder for agent operations
   */
  static agent() {
    return new AgentIPCBuilder();
  }

  /**
   * Get a builder for session operations
   */
  static session() {
    return new SessionIPCBuilder();
  }

  /**
   * Get a builder for config operations
   */
  static config() {
    return new ConfigIPCBuilder();
  }
}

/**
 * Agent IPC operations builder
 */
class AgentIPCBuilder {
  async sendMessage(args: { content: string; images?: string[] }) {
    return await TypedIPC.invoke('agent:sendMessage', args);
  }

  async abort() {
    return await TypedIPC.invoke('agent:abort');
  }

  async loadHistory(messages: any[]) {
    return await TypedIPC.invoke('agent:loadHistory', messages);
  }

  async clearHistory() {
    return await TypedIPC.invoke('agent:clearHistory');
  }

  onHistoryUpdate(callback: (messages: any[]) => void) {
    return TypedIPC.on('agent:history-update', callback);
  }

  onError(callback: (error: string) => void) {
    return TypedIPC.on('agent:error', callback);
  }

  onStageChange(callback: (stage: { stage: string; detail?: unknown }) => void) {
    return TypedIPC.on('agent:stage', callback);
  }

  onStreamToken(callback: (token: string) => void) {
    return TypedIPC.on('agent:stream-token', callback);
  }
}

/**
 * Session IPC operations builder
 */
class SessionIPCBuilder {
  async list() {
    return await TypedIPC.invoke('session:list');
  }

  async load(id: string) {
    return await TypedIPC.invoke('session:load', id);
  }

  async create() {
    return await TypedIPC.invoke('session:create');
  }

  async delete(id: string) {
    return await TypedIPC.invoke('session:delete', id);
  }

  async rename(id: string, title: string) {
    return await TypedIPC.invoke('session:rename', id, title);
  }

  onLoaded(callback: (session: any) => void) {
    return TypedIPC.on('session:loaded', callback);
  }

  onCreated(callback: (session: any) => void) {
    return TypedIPC.on('session:created', callback);
  }

  onDeleted(callback: (id: string) => void) {
    return TypedIPC.on('session:deleted', callback);
  }
}

/**
 * Config IPC operations builder
 */
class ConfigIPCBuilder {
  async get() {
    return await TypedIPC.invoke('config:get');
  }

  async update(config: any) {
    return await TypedIPC.invoke('config:update', config);
  }

  onUpdated(callback: (config: any) => void) {
    return TypedIPC.on('config:updated', callback);
  }
}

/**
 * Export singleton instances
 */
export const typedIpc = TypedIPC;
export const ipcService = {
  agent: () => TypedIPCService.agent(),
  session: () => TypedIPCService.session(),
  config: () => TypedIPCService.config(),
};

// Import React for hooks
import React from 'react';
