/**
 * Simple Dependency Injection Container
 *
 * A lightweight DI container that supports:
 * - Constructor injection
 * - Singleton and transient lifetimes
 * - Type-safe registration and resolution
 * - Circular dependency detection
 *
 * This helps eliminate global singletons and makes testing easier by
 * allowing dependencies to be mocked at the container level.
 */

/**
 * Service lifetime
 */
export enum Lifetime {
  /** Single instance created once and reused */
  SINGLETON = 'singleton',
  /** New instance created on each request */
  TRANSIENT = 'transient',
  /** Single instance within a scope (not yet implemented) */
  SCOPED = 'scoped',
}

/**
 * Factory function for creating instances
 */
type Factory<T> = (container: Container) => T;

/**
 * Service descriptor
 */
interface ServiceDescriptor<T> {
  factory: Factory<T>;
  lifetime: Lifetime;
  instance?: T;
  isResolved: boolean;
  dependencies?: string[];
}

/**
 * Dependency injection container
 */
export class Container {
  private services = new Map<string, ServiceDescriptor<any>>();
  private resolving = new Set<string>();

  /**
   * Register a service with the container
   */
  register<T>(
    token: string | symbol,
    factory: Factory<T>,
    lifetime: Lifetime = Lifetime.SINGLETON
  ): void {
    const tokenKey = String(token);
    if (this.services.has(tokenKey)) {
      throw new Error(`Service "${tokenKey}" is already registered`);
    }

    this.services.set(tokenKey, {
      factory,
      lifetime,
      isResolved: false,
    });
  }

  /**
   * Register a singleton service (shortcut)
   */
  registerSingleton<T>(token: string | symbol, factory: Factory<T>): void {
    this.register(token, factory, Lifetime.SINGLETON);
  }

  /**
   * Register a transient service (shortcut)
   */
  registerTransient<T>(token: string | symbol, factory: Factory<T>): void {
    this.register(token, factory, Lifetime.TRANSIENT);
  }

  /**
   * Register an existing instance as a singleton
   */
  registerInstance<T>(token: string | symbol, instance: T): void {
    const tokenKey = String(token);
    this.services.set(tokenKey, {
      factory: () => instance,
      lifetime: Lifetime.SINGLETON,
      instance,
      isResolved: true,
    });
  }

  /**
   * Resolve a service from the container
   */
  resolve<T>(token: string | symbol): T {
    const tokenKey = String(token);
    const descriptor = this.services.get(tokenKey);

    if (!descriptor) {
      throw new Error(`Service "${tokenKey}" is not registered`);
    }

    // Check for circular dependencies
    if (this.resolving.has(tokenKey)) {
      throw new Error(`Circular dependency detected: "${tokenKey}"`);
    }

    // Return cached instance for singletons
    if (descriptor.lifetime === Lifetime.SINGLETON && descriptor.isResolved) {
      return descriptor.instance as T;
    }

    // Create new instance
    this.resolving.add(tokenKey);
    try {
      const instance = descriptor.factory(this);

      // Cache singleton instances
      if (descriptor.lifetime === Lifetime.SINGLETON) {
        descriptor.instance = instance;
        descriptor.isResolved = true;
      }

      return instance;
    } finally {
      this.resolving.delete(tokenKey);
    }
  }

  /**
   * Check if a service is registered
   */
  has(token: string | symbol): boolean {
    return this.services.has(String(token));
  }

  /**
   * Clear all singleton instances (useful for testing)
   */
  clear(): void {
    this.services.forEach(descriptor => {
      if (descriptor.lifetime === Lifetime.SINGLETON) {
        descriptor.instance = undefined;
        descriptor.isResolved = false;
      }
    });
  }

  /**
   * Remove a service from the container
   */
  unregister(token: string | symbol): boolean {
    return this.services.delete(String(token));
  }

  /**
   * Get all registered tokens
   */
  getTokens(): string[] {
    return Array.from(this.services.keys());
  }

  /**
   * Get service info for debugging
   */
  getServiceInfo(token: string | symbol): {
    lifetime: Lifetime;
    isResolved: boolean;
  } | null {
    const descriptor = this.services.get(String(token));
    if (!descriptor) return null;

    return {
      lifetime: descriptor.lifetime,
      isResolved: descriptor.isResolved,
    };
  }
}

/**
 * Global container instance
 */
let globalContainer: Container | null = null;

/**
 * Get or create the global container
 */
export function getGlobalContainer(): Container {
  if (!globalContainer) {
    globalContainer = new Container();
  }
  return globalContainer;
}

/**
 * Reset the global container (useful for testing)
 */
export function resetGlobalContainer(): void {
  globalContainer = null;
}

/**
 * Service token symbols (for type-safe registration)
 */
export const Tokens = {
  // Config
  ConfigStore: Symbol('ConfigStore'),
  SessionStore: Symbol('SessionStore'),
  TaskDatabase: Symbol('TaskDatabase'),
  PermissionManager: Symbol('PermissionManager'),
  Logger: Symbol('Logger'),
  PerformanceMonitor: Symbol('PerformanceMonitor'),
  CacheManager: Symbol('CacheManager'),

  // Agent
  AgentRuntime: Symbol('AgentRuntime'),
  FileSystemTools: Symbol('FileSystemTools'),
  BrowserTools: Symbol('BrowserTools'),
  SkillManager: Symbol('SkillManager'),
  MCPClientService: Symbol('MCPClientService'),
  PromptService: Symbol('PromptService'),
  ToolRegistry: Symbol('ToolRegistry'),
  LLMProvider: Symbol('LLMProvider'),

  // Utils
  LRUCache: Symbol('LRUCache'),
  EventPublisher: Symbol('EventPublisher'),
} as const;

export type ServiceToken = typeof Tokens[keyof typeof Tokens];
