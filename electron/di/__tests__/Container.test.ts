/**
 * Dependency Injection Container Tests
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { Container, Lifetime, getGlobalContainer, resetGlobalContainer, Tokens } from '../Container';
import { registerCoreServices, createAgentRuntime, services, ServiceResolver } from '../registerServices';
import { FileSystemTools } from '../../agent/tools/FileSystemTools';
import { SkillManager } from '../../agent/skills/SkillManager';
import { PromptService } from '../../agent/services/PromptService';

// Mock electron
vi.mock('electron', () => ({
  BrowserWindow: vi.fn(),
  app: {
    getPath: vi.fn(() => '/tmp/test-userdata'),
    isPackaged: false,
  },
}));

// Mock LLM Providers to avoid browser environment issues
// Define classes inside the mock factory to avoid hoisting issues
vi.mock('../../agent/providers/AnthropicProvider', () => {
  class MockAnthropicProvider {
    async streamChat() {
      return [];
    }
  }
  return { AnthropicProvider: MockAnthropicProvider };
});

vi.mock('../../agent/providers/OpenAIProvider', () => {
  class MockOpenAIProvider {
    async streamChat() {
      return [];
    }
  }
  return { OpenAIProvider: MockOpenAIProvider };
});

vi.mock('../../agent/providers/MiniMaxProvider', () => {
  class MockMiniMaxProvider {
    async streamChat() {
      return [];
    }
  }
  return { MiniMaxProvider: MockMiniMaxProvider };
});

// Mock ConfigStore and related
vi.mock('../../config/ConfigStore', () => ({
  configStore: {
    get: vi.fn(() => 'test-value'),
    set: vi.fn(),
    getAll: vi.fn(() => ({})),
    getNetworkAccess: vi.fn(() => false),
    hasPermission: vi.fn(() => false),
  },
  WorkMode: {
    CHAT: 'chat' as const,
    CODE: 'code' as const,
    COWORK: 'cowork' as const,
  },
  ApiProvider: {
    ANTHROPIC: 'anthropic' as const,
    OPENAI: 'openai' as const,
    MINIMAX: 'minimax' as const,
  },
}));

// Mock SessionStore and TaskDatabase
vi.mock('../../config/SessionStore', () => ({
  SessionStore: vi.fn().mockImplementation(() => ({
    getAll: vi.fn(() => []),
    get: vi.fn(() => null),
    set: vi.fn(),
    delete: vi.fn(),
    clear: vi.fn(),
  })),
}));

vi.mock('../../config/TaskDatabase', () => ({
  TaskDatabase: vi.fn().mockImplementation(() => ({
    getAllTasks: vi.fn(() => []),
    createTask: vi.fn(() => ({})),
    updateTask: vi.fn(),
    deleteTask: vi.fn(),
  })),
}));

// Mock logger
vi.mock('../../utils/logger', () => ({
  logs: {
    agent: {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    },
  },
  performanceMonitor: {
    startMeasure: vi.fn(),
    endMeasure: vi.fn(),
    logMetric: vi.fn(),
  },
}));

// Mock CacheManager
vi.mock('../../services/CacheManager', () => ({
  cacheManager: {
    get: vi.fn(),
    set: vi.fn(),
    clear: vi.fn(),
  },
}));

// Create mock window
function createMockWindow(): any {
  return {
    webContents: {
      send: vi.fn(),
    },
    isDestroyed: vi.fn(() => false),
  };
}

describe('Container', () => {
  let container: Container;

  beforeEach(() => {
    container = new Container();
    resetGlobalContainer();
  });

  afterEach(() => {
    resetGlobalContainer();
  });

  describe('Basic Registration', () => {
    it('should register a singleton service', () => {
      container.registerSingleton('test', () => ({ value: 42 }));
      const instance1 = container.resolve('test');
      const instance2 = container.resolve('test');

      expect(instance1).toBe(instance2);
      expect(instance1.value).toBe(42);
    });

    it('should register a transient service', () => {
      let counter = 0;
      container.registerTransient('test', () => ({ value: counter++ }));
      const instance1 = container.resolve('test');
      const instance2 = container.resolve('test');

      expect(instance1).not.toBe(instance2);
      expect(instance1.value).toBe(0);
      expect(instance2.value).toBe(1);
    });

    it('should register an instance', () => {
      const instance = { value: 42 };
      container.registerInstance('test', instance);
      const resolved = container.resolve('test');

      expect(resolved).toBe(instance);
      expect(resolved.value).toBe(42);
    });
  });

  describe('Dependency Resolution', () => {
    it('should resolve dependencies', () => {
      container.registerSingleton('dep', () => ({ value: 10 }));
      container.registerSingleton(
        'service',
        (c) => {
          const dep = c.resolve('dep');
          return { sum: dep.value + 5 };
        }
      );

      const service = container.resolve('service');
      expect(service.sum).toBe(15);
    });

    it('should handle multiple levels of dependencies', () => {
      container.registerSingleton('level1', () => ({ value: 1 }));
      container.registerSingleton(
        'level2',
        (c) => {
          const l1 = c.resolve('level1');
          return { value: l1.value + 1 };
        }
      );
      container.registerSingleton(
        'level3',
        (c) => {
          const l2 = c.resolve('level2');
          return { value: l2.value + 1 };
        }
      );

      const result = container.resolve('level3');
      expect(result.value).toBe(3);
    });
  });

  describe('Circular Dependency Detection', () => {
    it('should detect circular dependencies', () => {
      container.registerSingleton(
        'a',
        (c) => {
          // This will try to resolve 'b' which tries to resolve 'a'
          const b = c.resolve('b');
          return { b };
        }
      );
      container.registerSingleton(
        'b',
        (c) => {
          const a = c.resolve('a');
          return { a };
        }
      );

      expect(() => container.resolve('a')).toThrow('Circular dependency');
    });
  });

  describe('Error Handling', () => {
    it('should throw when resolving unregistered service', () => {
      expect(() => container.resolve('nonexistent')).toThrow('is not registered');
    });

    it('should throw when registering duplicate service', () => {
      container.registerSingleton('test', () => ({}));
      expect(() => container.registerSingleton('test', () => ({}))).toThrow('already registered');
    });
  });

  describe('Container Management', () => {
    it('should check if service is registered', () => {
      container.registerSingleton('test', () => ({}));

      expect(container.has('test')).toBe(true);
      expect(container.has('nonexistent')).toBe(false);
    });

    it('should unregister a service', () => {
      container.registerSingleton('test', () => ({}));
      expect(container.has('test')).toBe(true);

      container.unregister('test');
      expect(container.has('test')).toBe(false);
    });

    it('should get all registered tokens', () => {
      container.registerSingleton('a', () => ({}));
      container.registerSingleton('b', () => ({}));

      const tokens = container.getTokens();
      expect(tokens).toContain('a');
      expect(tokens).toContain('b');
    });

    it('should get service info', () => {
      container.registerSingleton('singleton', () => ({}));
      container.registerTransient('transient', () => ({}));

      // Singleton not resolved yet
      let info = container.getServiceInfo('singleton');
      expect(info?.lifetime).toBe(Lifetime.SINGLETON);
      expect(info?.isResolved).toBe(false);

      // Resolve the singleton
      container.resolve('singleton');
      info = container.getServiceInfo('singleton');
      expect(info?.isResolved).toBe(true);

      // Transient always shows as not resolved
      info = container.getServiceInfo('transient');
      expect(info?.lifetime).toBe(Lifetime.TRANSIENT);
      expect(info?.isResolved).toBe(false);
    });

    it('should clear singleton instances', () => {
      let counter = 0;
      container.registerSingleton('test', () => ({ id: counter++ }));

      const instance1 = container.resolve('test');
      expect(instance1.id).toBe(0);

      container.clear();

      const instance2 = container.resolve('test');
      expect(instance2.id).toBe(1); // New instance created
    });
  });

  describe('Global Container', () => {
    it('should return the same global container instance', () => {
      const container1 = getGlobalContainer();
      const container2 = getGlobalContainer();

      expect(container1).toBe(container2);
    });

    it('should reset the global container', () => {
      const container1 = getGlobalContainer();
      container1.registerSingleton('test', () => ({}));

      resetGlobalContainer();

      const container2 = getGlobalContainer();
      expect(container2).not.toBe(container1);
      expect(container2.has('test')).toBe(false);
    });
  });
});

describe('Service Registration', () => {
  beforeEach(() => {
    resetGlobalContainer();
  });

  afterEach(() => {
    resetGlobalContainer();
  });

  it('should register all core services', () => {
    const container = getGlobalContainer();
    registerCoreServices(container);

    // Check that key services are registered
    expect(container.has(Tokens.FileSystemTools)).toBe(true);
    expect(container.has(Tokens.BrowserTools)).toBe(true);
    expect(container.has(Tokens.SkillManager)).toBe(true);
    expect(container.has(Tokens.MCPClientService)).toBe(true);
    expect(container.has(Tokens.PromptService)).toBe(true);
    expect(container.has(Tokens.ToolRegistry)).toBe(true);
    expect(container.has(Tokens.LLMProvider)).toBe(true);
  });

  it('should create AgentRuntime with dependencies', () => {
    const container = getGlobalContainer();
    registerCoreServices(container);

    const mockWindow = createMockWindow();
    const runtime = createAgentRuntime(mockWindow, container);

    expect(runtime).toBeDefined();
  });

  it('should resolve singleton services correctly', () => {
    const container = getGlobalContainer();
    registerCoreServices(container);

    const skillManager1 = container.resolve<SkillManager>(Tokens.SkillManager);
    const skillManager2 = container.resolve<SkillManager>(Tokens.SkillManager);

    // SkillManager should be a singleton
    expect(skillManager1).toBe(skillManager2);
  });

  it('should resolve transient services correctly', () => {
    const container = getGlobalContainer();
    registerCoreServices(container);

    const fsTools1 = container.resolve<FileSystemTools>(Tokens.FileSystemTools);
    const fsTools2 = container.resolve<FileSystemTools>(Tokens.FileSystemTools);

    // FileSystemTools should be transient
    expect(fsTools1).not.toBe(fsTools2);
  });
});

describe('ServiceResolver', () => {
  let resolver: ServiceResolver;

  beforeEach(() => {
    resetGlobalContainer();
    registerCoreServices();
    // Create a new resolver after services are registered
    resolver = new ServiceResolver();
  });

  afterEach(() => {
    resetGlobalContainer();
  });

  it('should provide typed access to services', () => {
    const skillManager = resolver.getSkillManager();
    const promptService = resolver.getPromptService();

    expect(skillManager).toBeInstanceOf(SkillManager);
    expect(promptService).toBeInstanceOf(PromptService);
  });

  it('should return the same singleton through resolver', () => {
    const skillManager1 = resolver.getSkillManager();
    const skillManager2 = resolver.getSkillManager();

    expect(skillManager1).toBe(skillManager2);
  });
});
