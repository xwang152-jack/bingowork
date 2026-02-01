/**
 * MCP (Model Context Protocol) Configuration Handlers
 */

import { ipcMain } from 'electron';
import path from 'path';
import os from 'os';
import fs from 'fs/promises';
import fsSync from 'fs';
import { IPC_CHANNELS } from '../../constants/IpcChannels';

import { AgentRuntime } from '../../agent/AgentRuntime';

const mcpConfigPath = path.join(os.homedir(), '.bingowork', 'mcp.json');

let agent: AgentRuntime | null = null;

export function setAgentInstance(agentInstance: AgentRuntime): void {
  agent = agentInstance;
}

export function registerMCPHandlers(): void {
  // Get MCP configuration
  ipcMain.handle(IPC_CHANNELS.MCP.GET_CONFIG, async () => {
    try {
      if (!fsSync.existsSync(mcpConfigPath)) return '{}';
      return await fs.readFile(mcpConfigPath, 'utf-8');
    } catch (error) {
      console.error('[MCP] Failed to read config:', error);
      return '{}';
    }
  });

  // Save MCP configuration
  ipcMain.handle(IPC_CHANNELS.MCP.SAVE_CONFIG, async (_event, content: string) => {
    try {
      const dir = path.dirname(mcpConfigPath);
      if (!fsSync.existsSync(dir)) {
        fsSync.mkdirSync(dir, { recursive: true });
      }
      await fs.writeFile(mcpConfigPath, content, 'utf-8');

      console.log('[MCP] Configuration saved to:', mcpConfigPath);

      // Reload MCP service if agent is available
      if (agent) {
        console.log('[MCP] Reloading MCP services...');
        const mcpService = agent.getMCPService();
        if (mcpService) {
          await mcpService.loadClients();
          
          // Also need to reload dynamic tools in tool registry
          const toolRegistry = agent.getToolRegistry();
          if (toolRegistry) {
            await toolRegistry.loadDynamicTools();
          }
          console.log('[MCP] MCP services reloaded successfully');
        }
      }

      return { success: true };
    } catch (error) {
      console.error('[MCP] Failed to save config:', error);
      return { success: false, error: (error as Error).message };
    }
  });
}
