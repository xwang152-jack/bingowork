/**
 * Agent Initializer
 * Handles AgentRuntime initialization and lifecycle
 */

import { AgentRuntime } from '../agent/AgentRuntime';
import { BrowserWindow } from 'electron';
import { configStore } from '../config/ConfigStore';
import { TaskDatabase } from '../config/TaskDatabase';

export class AgentInitializer {
  private agent: AgentRuntime | null = null;

  /**
   * Initialize the agent with current configuration
   */
  async initializeAgent(mainWindow: BrowserWindow | null, taskDb: TaskDatabase | null): Promise<AgentRuntime | null> {
    try {
      const config = configStore.getAll();
      const provider = configStore.getProvider();

      // Get API key from secure storage
      const apiKey = await configStore.getApiKey(provider);

      // Validate main window
      if (!mainWindow) {
        console.error('[Agent] Main window is required for agent initialization');
        return null;
      }

      // Create agent instance
      this.agent = new AgentRuntime(
        apiKey || '',
        mainWindow,
        config.model,
        config.apiUrl,
        config.provider,
        {
          logEvent: (eventName, data) => {
            // Note: taskDb.logEvent might not exist, checking if it's a function
            if (taskDb && typeof taskDb.logEvent === 'function') {
              taskDb.logEvent({
                type: eventName,
                payload: data,
                sessionId: null // Will be set by TaskDatabase if needed
              });
            }
          }
        }
      );

      // Initialize the agent (this loads skills, MCP clients, etc.)
      await this.agent.initialize();

      return this.agent;
    } catch (error) {
      console.error('[Agent] Initialization failed:', error);
      this.agent = null;
      return null;
    }
  }

  /**
   * Get the agent instance
   */
  getAgent(): AgentRuntime | null {
    return this.agent;
  }

  /**
   * Cleanup on app quit
   */
  cleanup(): void {
    if (this.agent) {
      this.agent = null;
    }
  }
}

/**
 * Singleton instance
 */
let agentInitializerInstance: AgentInitializer | null = null;

export function getAgentInitializer(): AgentInitializer {
  if (!agentInitializerInstance) {
    agentInitializerInstance = new AgentInitializer();
  }
  return agentInitializerInstance;
}
