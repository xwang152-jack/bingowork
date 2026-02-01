/**
 * Agent Initializer
 * Handles AgentRuntime initialization and lifecycle
 */

import { AgentRuntime } from '../agent/AgentRuntime';
import { BrowserWindow } from 'electron';
import { configStore } from '../config/ConfigStore';
import { TaskDatabase } from '../config/TaskDatabase';
import { ModelRegistryService } from '../models/ModelRegistryService';
import { SecureCredentials } from '../config/SecureCredentials';

export class AgentInitializer {
  private agent: AgentRuntime | null = null;

  /**
   * Initialize the agent with current configuration
   */
  async initializeAgent(mainWindow: BrowserWindow | null, taskDb: TaskDatabase | null): Promise<AgentRuntime | null> {
    try {
      const config = configStore.getAll();
      const transportProvider = configStore.getProvider();

      // Try to get the providerId from ModelRegistryService for API key lookup
      let providerIdForApiKey: string = transportProvider;
      let model = config.model;
      let apiUrl = config.apiUrl;

      if (taskDb) {
        try {
          const modelRegistry = new ModelRegistryService(taskDb);
          const state = await modelRegistry.getState();
          const activeModel = state.models.find(m => m.id === state.activeModelId);

          if (activeModel) {
            providerIdForApiKey = activeModel.providerId;
            model = activeModel.modelId;
            apiUrl = activeModel.effectiveBaseUrl;

            console.log('[AgentInitializer] Using ModelRegistry config:', {
              activeModelId: state.activeModelId,
              providerId: providerIdForApiKey,
              model,
              apiUrl,
              protocol: activeModel.protocol
            });
          }
        } catch (error) {
          console.warn('[AgentInitializer] Failed to load ModelRegistry, using ConfigStore:', error);
        }
      }

      console.log('[AgentInitializer] Final config:', {
        transportProvider,
        providerIdForApiKey,
        model,
        apiUrl,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        secureCredentialsReady: (configStore as any).secureCredentialsReady
      });

      // Get API key from secure storage using the correct providerId
      const apiKey = await SecureCredentials.getApiKey(providerIdForApiKey);

      console.log('[AgentInitializer] API Key retrieved:', {
        providerId: providerIdForApiKey,
        apiKeyLength: apiKey?.length || 0,
        apiKeyPrefix: apiKey ? `${apiKey.substring(0, 8)}...` : 'empty',
        hasApiKey: !!apiKey
      });

      // Validate main window
      if (!mainWindow) {
        console.error('[Agent] Main window is required for agent initialization');
        return null;
      }

      // Create agent instance
      this.agent = new AgentRuntime(
        apiKey || '',
        mainWindow,
        model,
        apiUrl,
        transportProvider,
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
