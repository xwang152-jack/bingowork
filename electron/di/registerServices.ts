/**
 * Service Registration
 *
 * Configures the DI container with all application services.
 * This replaces global singletons with properly managed dependencies.
 */

import { Container, Tokens, getGlobalContainer } from './Container';
import { configStore } from '../config/ConfigStore';
import { SessionStore } from '../config/SessionStore';
import { TaskDatabase } from '../config/TaskDatabase';
import { permissionManager } from '../agent/security/PermissionManager';
import { logs, performanceMonitor } from '../utils/logger';
import { cacheManager } from '../../src/services/CacheManager';
import { AgentRuntime } from '../agent/AgentRuntime';
import { FileSystemTools } from '../agent/tools/FileSystemTools';
import { BrowserTools } from '../agent/tools/BrowserTools';
import { SkillManager } from '../agent/skills/SkillManager';
import { MCPClientService } from '../agent/mcp/MCPClientService';
import { PromptService } from '../agent/services/PromptService';
import { ToolRegistry } from '../agent/services/ToolRegistry';
import type { BaseLLMProvider } from '../agent/providers/BaseLLMProvider';
import { AnthropicProvider } from '../agent/providers/AnthropicProvider';
import { OpenAIProvider } from '../agent/providers/OpenAIProvider';
import { MiniMaxProvider } from '../agent/providers/MiniMaxProvider';
import { LRUCache } from '../../src/utils/LRUCache';
import { ScheduleManager } from '../agent/schedule/ScheduleManager';

/**
 * Register all core services with the container
 */
export function registerCoreServices(container: Container = getGlobalContainer()): void {
  // === Config & State ===
  container.registerInstance(Tokens.ConfigStore, configStore);

  // SessionStore and TaskDatabase may fail in test environment
  // We register them conditionally
  try {
    container.registerSingleton(Tokens.SessionStore, () => new SessionStore());
  } catch (e) {
    // In test environment, SessionStore might fail to initialize
    // We'll skip it and let tests mock it if needed
  }

  try {
    container.registerSingleton(Tokens.TaskDatabase, () => new TaskDatabase());
  } catch (e) {
    // In test environment, TaskDatabase might fail to initialize
  }

  container.registerInstance(Tokens.PermissionManager, permissionManager);

  // === Logging & Monitoring ===
  container.registerInstance(Tokens.Logger, logs);
  container.registerInstance(Tokens.PerformanceMonitor, performanceMonitor);

  // === Caching ===
  container.registerSingleton(
    Tokens.CacheManager,
    () => cacheManager
  );

  // Register different cache types
  container.registerSingleton('cache:lru', () => new LRUCache({
    maxSize: 100,
    ttl: 5 * 60 * 1000, // 5 minutes
  }));

  // === Agent Tools ===
  container.registerTransient(Tokens.FileSystemTools, () => new FileSystemTools());
  container.registerTransient(Tokens.BrowserTools, () => new BrowserTools());

  // === Skills & MCP ===
  container.registerSingleton(Tokens.SkillManager, () => new SkillManager());
  container.registerSingleton(Tokens.MCPClientService, () => new MCPClientService());

  // === Services ===
  container.registerSingleton(Tokens.PromptService, () => new PromptService());

  // Tool Registry depends on multiple services
  container.registerSingleton(
    Tokens.ToolRegistry,
    (container) => {
      const fsTools = container.resolve<FileSystemTools>(Tokens.FileSystemTools);
      const browserTools = container.resolve<BrowserTools>(Tokens.BrowserTools);
      const skillManager = container.resolve<SkillManager>(Tokens.SkillManager);
      const mcpService = container.resolve<MCPClientService>(Tokens.MCPClientService);

      // Note: ToolRegistry requires callbacks that depend on AgentRuntime
      // This creates a circular dependency that we need to handle
      // For now, we'll register it with placeholder callbacks
      return new ToolRegistry(
        fsTools,
        browserTools,
        skillManager,
        mcpService,
        () => 'cowork', // Default work mode getter
        {
          requestConfirmation: async () => true,
          onArtifactCreated: () => {},
          askUser: async () => '',
          onToolStream: () => {},
        }
      );
    }
  );

  // === LLM Provider Factory ===
  container.registerSingleton(
    Tokens.LLMProvider,
    () => {
      // Get config from store
      const provider = configStore.get('provider') || 'anthropic';
      const apiKey = configStore.get('apiKey') || '';
      const apiUrl = configStore.get('apiUrl') || 'https://api.anthropic.com';

      return createLLMProvider(provider, apiKey, apiUrl);
    }
  );

  // === Schedule Manager ===
  container.registerSingleton(
    Tokens.ScheduleManager,
    (container) => {
      const taskDatabase = container.resolve<TaskDatabase>(Tokens.TaskDatabase);
      return new ScheduleManager(taskDatabase);
    }
  );

  // === Agent Runtime ===
  // Note: AgentRuntime is NOT registered as a singleton in the container
  // because it requires BrowserWindow instance which varies per window
  // Instead, we provide a factory function
  container.registerTransient(
    Tokens.AgentRuntime,
    (_container) => {
      const _apiKey = configStore.get('apiKey') || '';
      const _model = configStore.get('model') || 'claude-3-5-sonnet-20241022';
      const _apiUrl = configStore.get('apiUrl') || 'https://api.anthropic.com';
      const _provider = configStore.get('provider') || 'anthropic';

      // AgentRuntime requires BrowserWindow which is passed separately
      throw new Error(
        'AgentRuntime cannot be resolved directly. ' +
        'Use createAgentRuntime(window) factory function instead.'
      );
    }
  );
}

/**
 * Create LLM provider based on configuration
 */
function createLLMProvider(
  provider: string,
  apiKey: string,
  apiUrl: string
): BaseLLMProvider {
  switch (provider) {
    case 'openai':
      return new OpenAIProvider(apiKey, apiUrl);
    case 'minimax':
      return new MiniMaxProvider(apiKey, apiUrl);
    case 'anthropic':
    default:
      return new AnthropicProvider(apiKey, apiUrl);
  }
}

/**
 * Create AgentRuntime with proper dependencies
 * This is the preferred way to create AgentRuntime instances
 */
export function createAgentRuntime(
  window: Electron.BrowserWindow,
  container: Container = getGlobalContainer()
): AgentRuntime {
  const apiKey = configStore.get('apiKey') || '';
  const model = configStore.get('model') || 'claude-3-5-sonnet-20241022';
  const apiUrl = configStore.get('apiUrl') || 'https://api.anthropic.com';
  const provider = configStore.get('provider') || 'anthropic';

  // Get the logger for event sink
  const logs = container.resolve<typeof import('../utils/logger').logs>(Tokens.Logger);

  return new AgentRuntime(
    apiKey,
    window,
    model,
    apiUrl,
    provider,
    {
      logEvent: (type, payload) => {
        logs.agent.info(`[Event] ${type}`, payload);
      }
    }
  );
}

/**
 * Initialize the container with all services
 * Call this during application startup
 */
export function initializeContainer(): Container {
  const container = getGlobalContainer();
  registerCoreServices(container);
  return container;
}

/**
 * Type-safe service resolver helpers
 */
export class ServiceResolver {
  constructor(private container: Container = getGlobalContainer()) {}

  getConfig() {
    return this.container.resolve<typeof configStore>(Tokens.ConfigStore);
  }

  getSessionStore() {
    return this.container.resolve<SessionStore>(Tokens.SessionStore);
  }

  getTaskDatabase() {
    return this.container.resolve<TaskDatabase>(Tokens.TaskDatabase);
  }

  getPermissionManager() {
    return this.container.resolve<typeof permissionManager>(Tokens.PermissionManager);
  }

  getLogger() {
    return this.container.resolve<typeof logs>(Tokens.Logger);
  }

  getPerformanceMonitor() {
    return this.container.resolve<typeof performanceMonitor>(Tokens.PerformanceMonitor);
  }

  getCacheManager() {
    return this.container.resolve<typeof cacheManager>(Tokens.CacheManager);
  }

  getSkillManager() {
    return this.container.resolve<SkillManager>(Tokens.SkillManager);
  }

  getMCPService() {
    return this.container.resolve<MCPClientService>(Tokens.MCPClientService);
  }

  getPromptService() {
    return this.container.resolve<PromptService>(Tokens.PromptService);
  }

  getToolRegistry() {
    return this.container.resolve<ToolRegistry>(Tokens.ToolRegistry);
  }

  getScheduleManager() {
    return this.container.resolve<ScheduleManager>(Tokens.ScheduleManager);
  }
}

// Export a default resolver instance
export const services = new ServiceResolver();
