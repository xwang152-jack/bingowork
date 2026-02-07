/**
 * MCP (Model Context Protocol) Configuration Handlers
 *
 * Supports both v1 (legacy) and v2 (new) configuration formats.
 * V2 format provides structured CRUD operations for MCP server management.
 */

import { ipcMain } from 'electron';
import path from 'path';
import os from 'os';
import fs from 'fs/promises';
import fsSync from 'fs';
import { IPC_CHANNELS } from '../../constants/IpcChannels';
import { logs } from '../../utils/logger';

import { AgentRuntime } from '../../agent/AgentRuntime';
import type { MCPServerConfig, MCPConfigFile } from '../../agent/mcp/types.js';

const mcpConfigPath = path.join(os.homedir(), '.bingowork', 'mcp.json');

let agent: AgentRuntime | null = null;

export function setAgentInstance(agentInstance: AgentRuntime): void {
  agent = agentInstance;
}

/**
 * Reload MCP services after configuration changes
 */
async function reloadMCPServices(): Promise<void> {
  if (agent) {
    logs.mcp.info('[MCP] Reloading MCP services...');
    const mcpService = agent.getMCPService();
    if (mcpService) {
      await mcpService.loadClients();

      // Also need to reload dynamic tools in tool registry
      const toolRegistry = agent.getToolRegistry();
      if (toolRegistry) {
        await toolRegistry.loadDynamicTools();
      }
      logs.mcp.info('[MCP] MCP services reloaded successfully');
    }
  }
}

/**
 * Load and parse MCP configuration file with auto-migration
 */
async function loadMCPConfig(): Promise<MCPConfigFile> {
  try {
    const content = await fs.readFile(mcpConfigPath, 'utf-8');
    const config = JSON.parse(content);

    // Auto-migrate from v1 to v2 if needed
    if (!config.version || config.version < 2) {
      return await migrateToV2(config);
    }

    return config as MCPConfigFile;
  } catch {
    return { version: 2, servers: [] };
  }
}

/**
 * Save MCP configuration file
 */
async function saveMCPConfig(config: MCPConfigFile): Promise<void> {
  const dir = path.dirname(mcpConfigPath);
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(mcpConfigPath, JSON.stringify(config, null, 2), 'utf-8');
}

/**
 * Migrate v1 configuration to v2 format
 */
async function migrateToV2(oldConfig: unknown): Promise<MCPConfigFile> {
  const config = oldConfig as { mcpServers?: Record<string, { command?: string; args?: string[]; url?: string; env?: Record<string, string> }> };
  if (config.mcpServers) {
    const servers: MCPServerConfig[] = Object.entries(config.mcpServers).map(
      ([id, legacyConfig]) => ({
        id,
        name: id.charAt(0).toUpperCase() + id.slice(1),
        description: `${id} MCP server`,
        enabled: true,
        transportType: legacyConfig.url ? 'http' : 'stdio',
        command: legacyConfig.command,
        args: legacyConfig.args,
        url: legacyConfig.url,
        env: legacyConfig.env,
        createdAt: Date.now(),
        updatedAt: Date.now()
      })
    );

    const newConfig: MCPConfigFile = { version: 2, servers };
    await saveMCPConfig(newConfig);
    logs.mcp.info('[MCP] Migrated config from v1 to v2 format');
    return newConfig;
  }

  return { version: 2, servers: [] };
}

/**
 * Validate server configuration
 */
function validateServerConfig(server: MCPServerConfig): { ok: boolean; error?: string } {
  if (!server.id || !server.id.trim()) {
    return { ok: false, error: 'Server ID is required' };
  }

  if (!/^[a-z0-9-]+$/.test(server.id)) {
    return { ok: false, error: 'Server ID must contain only lowercase letters, numbers, and hyphens' };
  }

  if (!server.name || !server.name.trim()) {
    return { ok: false, error: 'Server name is required' };
  }

  if (server.transportType === 'stdio' && !server.command) {
    return { ok: false, error: 'Command is required for stdio transport' };
  }

  if (server.transportType === 'http') {
    if (!server.url) {
      return { ok: false, error: 'URL is required for HTTP transport' };
    }
    try {
      new URL(server.url);
    } catch {
      return { ok: false, error: 'Invalid URL format' };
    }
  }

  return { ok: true };
}

/**
 * Disconnect a specific MCP server by ID
 */
async function disconnectServerById(id: string): Promise<void> {
  if (agent) {
    const mcpService = agent.getMCPService();
    if (mcpService) {
      // Access the internal clients map to disconnect
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const clients = (mcpService as unknown as any).clients;
      if (clients && clients.has(id)) {
        const client = clients.get(id);
        try {
          const anyClient = client as unknown as { close?: () => unknown; disconnect?: () => unknown };
          if (typeof anyClient.close === 'function') await anyClient.close();
          else if (typeof anyClient.disconnect === 'function') await anyClient.disconnect();
        } catch (e) {
          logs.mcp.error(`Failed to disconnect MCP server ${id}:`, e);
        }
        clients.delete(id);
      }
    }
  }
}

export function registerMCPHandlers(): void {
  // =====================================================
  // Legacy v1 handlers (保留向后兼容)
  // =====================================================

  // Get MCP configuration (raw JSON content)
  ipcMain.handle(IPC_CHANNELS.MCP.GET_CONFIG, async () => {
    try {
      if (!fsSync.existsSync(mcpConfigPath)) return '{}';
      return await fs.readFile(mcpConfigPath, 'utf-8');
    } catch (error) {
      console.error('[MCP] Failed to read config:', error);
      return '{}';
    }
  });

  // Save MCP configuration (raw JSON content)
  ipcMain.handle(IPC_CHANNELS.MCP.SAVE_CONFIG, async (_event, content: string) => {
    try {
      const dir = path.dirname(mcpConfigPath);
      if (!fsSync.existsSync(dir)) {
        fsSync.mkdirSync(dir, { recursive: true });
      }
      await fs.writeFile(mcpConfigPath, content, 'utf-8');

      logs.mcp.info('[MCP] Configuration saved to:', mcpConfigPath);

      await reloadMCPServices();

      return { success: true };
    } catch (error) {
      console.error('[MCP] Failed to save config:', error);
      return { success: false, error: (error as Error).message };
    }
  });

  // =====================================================
  // New v2 handlers - CRUD operations
  // =====================================================

  // List all MCP servers
  ipcMain.handle(IPC_CHANNELS.MCP.LIST_SERVERS, async () => {
    try {
      const config = await loadMCPConfig();
      return { success: true, data: config.servers };
    } catch (error) {
      console.error('[MCP] Failed to list servers:', error);
      return { success: false, error: (error as Error).message, data: [] };
    }
  });

  // Get a single MCP server by ID
  ipcMain.handle(IPC_CHANNELS.MCP.GET_SERVER, async (_event, id: string) => {
    try {
      const config = await loadMCPConfig();
      const server = config.servers.find(s => s.id === id);
      if (!server) {
        return { success: false, error: `Server "${id}" not found`, data: null };
      }
      return { success: true, data: server };
    } catch (error) {
      console.error('[MCP] Failed to get server:', error);
      return { success: false, error: (error as Error).message, data: null };
    }
  });

  // Add a new MCP server
  ipcMain.handle(IPC_CHANNELS.MCP.ADD_SERVER, async (_event, server: MCPServerConfig) => {
    try {
      const config = await loadMCPConfig();

      // Check for duplicate ID
      if (config.servers.some(s => s.id === server.id)) {
        return { success: false, error: `Server ID "${server.id}" already exists` };
      }

      // Validate configuration
      const validation = validateServerConfig(server);
      if (!validation.ok) {
        return { success: false, error: validation.error };
      }

      // Add timestamps
      server.createdAt = Date.now();
      server.updatedAt = Date.now();

      config.servers.push(server);
      await saveMCPConfig(config);

      logs.mcp.info('[MCP] Server added:', server.id);
      await reloadMCPServices();

      return { success: true, data: server };
    } catch (error) {
      console.error('[MCP] Failed to add server:', error);
      return { success: false, error: (error as Error).message };
    }
  });

  // Update an existing MCP server
  ipcMain.handle(IPC_CHANNELS.MCP.UPDATE_SERVER, async (_event, id: string, updates: Partial<MCPServerConfig>) => {
    try {
      const config = await loadMCPConfig();
      const index = config.servers.findIndex(s => s.id === id);

      if (index === -1) {
        return { success: false, error: `Server "${id}" not found` };
      }

      // Check for ID conflict if ID is being changed
      if (updates.id && updates.id !== id) {
        if (config.servers.some(s => s.id === updates.id && s.id !== id)) {
          return { success: false, error: `Server ID "${updates.id}" already exists` };
        }
      }

      // Disconnect the server if it's currently connected
      await disconnectServerById(id);

      // Merge updates
      const mergedServer: MCPServerConfig = {
        ...config.servers[index],
        ...updates,
        id: config.servers[index].id, // Preserve original ID unless explicitly changed
        updatedAt: Date.now()
      };

      // Validate if critical fields changed
      if (updates.transportType || updates.command || updates.url || updates.id) {
        const validation = validateServerConfig(mergedServer);
        if (!validation.ok) {
          return { success: false, error: validation.error };
        }
      }

      config.servers[index] = mergedServer;
      await saveMCPConfig(config);

      logs.mcp.info('[MCP] Server updated:', id);
      await reloadMCPServices();

      return { success: true, data: mergedServer };
    } catch (error) {
      console.error('[MCP] Failed to update server:', error);
      return { success: false, error: (error as Error).message };
    }
  });

  // Delete an MCP server
  ipcMain.handle(IPC_CHANNELS.MCP.DELETE_SERVER, async (_event, id: string) => {
    try {
      const config = await loadMCPConfig();
      const index = config.servers.findIndex(s => s.id === id);

      if (index === -1) {
        return { success: false, error: `Server "${id}" not found` };
      }

      // Disconnect the server if it's currently connected
      await disconnectServerById(id);

      config.servers.splice(index, 1);
      await saveMCPConfig(config);

      logs.mcp.info('[MCP] Server deleted:', id);
      await reloadMCPServices();

      return { success: true };
    } catch (error) {
      console.error('[MCP] Failed to delete server:', error);
      return { success: false, error: (error as Error).message };
    }
  });

  // Toggle server enabled state
  ipcMain.handle(IPC_CHANNELS.MCP.TOGGLE_SERVER, async (_event, id: string, enabled: boolean) => {
    try {
      const config = await loadMCPConfig();
      const index = config.servers.findIndex(s => s.id === id);

      if (index === -1) {
        return { success: false, error: `Server "${id}" not found` };
      }

      config.servers[index].enabled = enabled;
      config.servers[index].updatedAt = Date.now();
      await saveMCPConfig(config);

      logs.mcp.info(`[MCP] Server toggled: ${id}, enabled: ${enabled}`);
      await reloadMCPServices();

      return { success: true, data: config.servers[index] };
    } catch (error) {
      console.error('[MCP] Failed to toggle server:', error);
      return { success: false, error: (error as Error).message };
    }
  });
}
