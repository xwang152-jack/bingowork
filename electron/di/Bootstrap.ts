/**
 * Application Bootstrap with DI Container
 *
 * Initializes the application using dependency injection.
 * Replaces direct singleton usage with container-managed services.
 */

import { app, BrowserWindow } from 'electron';
import { initializeContainer, getGlobalContainer, Tokens, type ServiceResolver } from './registerServices';
import type { TaskDatabase } from '../config/TaskDatabase';
import type { AgentRuntime } from '../agent/AgentRuntime';
import type { Logger } from '../utils/logger';

/**
 * Application bootstrap state
 */
export interface BootstrapState {
  container: ReturnType<typeof getGlobalContainer>;
  services: ServiceResolver;
  taskDatabase: TaskDatabase;
  agentRuntime: AgentRuntime | null;
  mainWindow: BrowserWindow | null;
  floatingBallWindow: BrowserWindow | null;
  isInitialized: boolean;
}

/**
 * Global bootstrap state
 */
let bootstrapState: BootstrapState | null = null;

/**
 * Initialize the application with DI container
 */
export async function bootstrapApplication(
  createWindows: (state: BootstrapState) => {
    mainWindow: BrowserWindow;
    floatingBallWindow?: BrowserWindow;
  }
): Promise<BootstrapState> {
  if (bootstrapState) {
    console.warn('[Bootstrap] Application already initialized');
    return bootstrapState;
  }

  console.log('[Bootstrap] Initializing application with DI container...');

  // 1. Initialize DI container
  const container = initializeContainer();
  const services = container.registerInstance(
    'bootstrap:services',
    new ServiceResolverWrapper(container)
  );

  // 2. Initialize core services
  const taskDatabase = container.resolve<TaskDatabase>(Tokens.TaskDatabase);
  const logger = container.resolve<any>(Tokens.Logger);

  logger.agent.info('[Bootstrap] DI container initialized');

  // 3. Create windows
  const windowState = createWindows({
    container,
    services: new ServiceResolverWrapper(container),
    taskDatabase,
    agentRuntime: null,
    mainWindow: null,
    floatingBallWindow: null,
    isInitialized: false,
  });

  // 4. Initialize AgentRuntime with main window
  let agentRuntime: AgentRuntime | null = null;
  try {
    const { createAgentRuntime } = await import('../agent/AgentRuntime');
    agentRuntime = createAgentRuntime(windowState.mainWindow, container);

    // Initialize the agent
    await agentRuntime.initialize();
    logger.agent.info('[Bootstrap] AgentRuntime initialized');

    // Register AgentRuntime in container for dependency access
    container.registerInstance(Tokens.AgentRuntime, agentRuntime);
  } catch (error) {
    logger.agent.error('[Bootstrap] Failed to initialize AgentRuntime:', error);
  }

  // 5. Store bootstrap state
  bootstrapState = {
    container,
    services: new ServiceResolverWrapper(container),
    taskDatabase,
    agentRuntime,
    mainWindow: windowState.mainWindow,
    floatingBallWindow: windowState.floatingBallWindow || null,
    isInitialized: true,
  };

  logger.agent.info('[Bootstrap] Application initialized successfully');
  return bootstrapState;
}

/**
 * Get bootstrap state
 */
export function getBootstrapState(): BootstrapState | null {
  return bootstrapState;
}

/**
 * Cleanup application resources
 */
export async function cleanupBootstrap(): Promise<void> {
  if (!bootstrapState) return;

  const { agentRuntime, taskDatabase, container } = bootstrapState;

  try {
    // Shutdown agent
    if (agentRuntime) {
      await agentRuntime.shutdown();
    }

    // Close database
    if (taskDatabase) {
      taskDatabase.close();
    }

    // Clear container
    container.clear();
  } catch (error) {
    console.error('[Bootstrap] Cleanup error:', error);
  }

  bootstrapState = null;
}

/**
 * Wrapper for ServiceResolver to avoid circular dependency
 */
class ServiceResolverWrapper {
  constructor(private container: ReturnType<typeof getGlobalContainer>) {}

  getConfig() {
    return this.container.resolve<any>(Tokens.ConfigStore);
  }

  getSessionStore() {
    return this.container.resolve<any>(Tokens.SessionStore);
  }

  getTaskDatabase() {
    return this.container.resolve<any>(Tokens.TaskDatabase);
  }

  getPermissionManager() {
    return this.container.resolve<any>(Tokens.PermissionManager);
  }

  getLogger() {
    return this.container.resolve<any>(Tokens.Logger);
  }

  getPerformanceMonitor() {
    return this.container.resolve<any>(Tokens.PerformanceMonitor);
  }

  getCacheManager() {
    return this.container.resolve<any>(Tokens.CacheManager);
  }

  getSkillManager() {
    return this.container.resolve<any>(Tokens.SkillManager);
  }

  getMCPService() {
    return this.container.resolve<any>(Tokens.MCPClientService);
  }

  getPromptService() {
    return this.container.resolve<any>(Tokens.PromptService);
  }

  getToolRegistry() {
    return this.container.resolve<any>(Tokens.ToolRegistry);
  }

  getAgentRuntime() {
    return this.container.resolve<any>(Tokens.AgentRuntime);
  }
}
