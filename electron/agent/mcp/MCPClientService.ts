import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import path from 'path';
import fs from 'fs/promises';
import os from 'os';
// app import removed

// Import new type definitions
import type { MCPServerConfig, MCPConfigFile } from './types.js';

/** @deprecated Use MCPServerConfig from './types.ts' instead */
export interface LegacyMCPServerConfig {
    name: string;
    command?: string;
    args?: string[];
    url?: string;
    env?: Record<string, string>;
}

export class MCPClientService {
    private clients: Map<string, Client> = new Map();
    private configPath: string;
    private oldConfigPath: string;

    constructor() {
        this.configPath = path.join(os.homedir(), '.bingowork', 'mcp.json');
        this.oldConfigPath = path.join(os.homedir(), '.opencowork', 'mcp.json');
    }

    /**
     * Migrate MCP configuration from old opencowork directory to new bingowork directory
     * This preserves existing user configurations during brand migration
     */
    private async migrateConfig(): Promise<void> {
        try {
            // Check if new config already exists
            try {
                await fs.access(this.configPath);
                // New config exists, no migration needed
                return;
            } catch {
                // New config doesn't exist, proceed with migration
            }

            // Check if old config exists
            try {
                await fs.access(this.oldConfigPath);
            } catch {
                // Old config doesn't exist either, nothing to migrate
                return;
            }

            // Ensure the new directory exists
            const newDir = path.join(os.homedir(), '.bingowork');
            try {
                await fs.access(newDir);
            } catch {
                await fs.mkdir(newDir, { recursive: true });
            }

            // Copy old config to new location
            const oldContent = await fs.readFile(this.oldConfigPath, 'utf-8');
            await fs.writeFile(this.configPath, oldContent, 'utf-8');
            console.log('[MCP] Migrated configuration from ~/.opencowork/mcp.json to ~/.bingowork/mcp.json');
        } catch (error) {
            console.warn('[MCP] Configuration migration failed:', error);
            // Non-fatal: continue without migration
        }
    }

    async closeAll() {
        for (const [name, client] of this.clients) {
            try {
                const anyClient = client as unknown as { close?: () => unknown; disconnect?: () => unknown };
                if (typeof anyClient.close === 'function') await anyClient.close();
                else if (typeof anyClient.disconnect === 'function') await anyClient.disconnect();
            } catch (e) {
                console.error(`Failed to close MCP server ${name}:`, e);
            }
        }
        this.clients.clear();
    }

    async loadClients() {
        // Migrate configuration from old directory if needed
        await this.migrateConfig();

        try {
            const { configStore } = await import('../../config/ConfigStore');
            if (!configStore.getNetworkAccess()) {
                await this.closeAll();
                return;
            }
        } catch {
            void 0;
        }

        let config: { mcpServers: Record<string, MCPServerConfig> } = { mcpServers: {} };
        try {
            const content = await fs.readFile(this.configPath, 'utf-8');
            config = JSON.parse(content);
        } catch (e) {
            // No config, create default
            console.log('Creating default MCP config');
        }

        if (!config.mcpServers) {
            config.mcpServers = {};
        }

        // Default config logic for MiniMax removed

        for (const [key, serverConfig] of Object.entries(config.mcpServers || {})) {
            await this.connectToServer(key, serverConfig);
        }

        // Log summary of connected servers
        console.log(`[MCP] Successfully connected to ${this.clients.size} server(s):`, Array.from(this.clients.keys()));
    }

    private async resolveEnvVariables(env: Record<string, string>): Promise<Record<string, string>> {
        const resolved = { ...env };
        const { configStore } = await import('../../config/ConfigStore');
        
        for (const [key, value] of Object.entries(resolved)) {
            if (!value) continue;

            // Resolve {{App.ApiKey}} - Current provider's key
            if (value.includes('{{App.ApiKey}}')) {
                 const currentProvider = configStore.get('provider');
                 const apiKey = await configStore.getApiKey(currentProvider);
                 resolved[key] = value.replace('{{App.ApiKey}}', apiKey || '');
            } 
            
            // Resolve {{App.ApiKey:provider}} - Specific provider's key
            const providerMatch = value.match(/{{App\.ApiKey:(\w+)}}/);
            if (providerMatch) {
                 const provider = providerMatch[1];
                 // eslint-disable-next-line @typescript-eslint/no-explicit-any
                 const apiKey = await configStore.getApiKey(provider as any);
                 resolved[key] = value.replace(providerMatch[0], apiKey || '');
            }

            // Resolve {{App.ApiUrl}}
            if (value.includes('{{App.ApiUrl}}')) {
                 const apiUrl = configStore.getApiUrl();
                 resolved[key] = value.replace('{{App.ApiUrl}}', apiUrl || '');
            }
        }
        return resolved;
    }

    private async connectToServer(name: string, config: MCPServerConfig) {
        if (this.clients.has(name)) return;

        try {
            let finalEnv = { ...(process.env as Record<string, string>), ...config.env };

            // Compatibility: Auto-inject MiniMax key if missing/placeholder
            // This replaces the previous hardcoded check with a dynamic injection
            if (name.toLowerCase() === 'minimax') {
                const configKey = config.env?.MINIMAX_API_KEY;
                if (!configKey || configKey === "YOUR_API_KEY_HERE" || configKey.includes("API密钥")) {
                    console.log('[MCP] Auto-injecting MiniMax API Key via placeholder');
                    finalEnv['MINIMAX_API_KEY'] = '{{App.ApiKey:minimax}}';
                }
            }

            // Resolve all environment variables including placeholders
            finalEnv = await this.resolveEnvVariables(finalEnv);

            // Choose transport based on config type
            let transport;
            if (config.url) {
                // Use Streamable HTTP transport for URL-based connections
                console.log(`Connecting to MCP server ${name} via Streamable HTTP: ${config.url}`);
                transport = new StreamableHTTPClientTransport(
                    new URL(config.url)
                );
            } else if (config.command) {
                // Use stdio transport for command-based connections
                console.log(`Connecting to MCP server ${name} via stdio: ${config.command}`);
                transport = new StdioClientTransport({
                    command: config.command,
                    args: config.args || [],
                    env: finalEnv
                });
            } else {
                throw new Error(`Invalid MCP server config for ${name}: must provide either 'url' or 'command'`);
            }

            const client = new Client({
                name: "bingowork-client",
                version: "1.0.0",
            }, {
                capabilities: {
                    // Start with empty capabilities
                },
            });

            await client.connect(transport);
            this.clients.set(name, client);
            console.log(`[MCP] ✓ Connected to server: ${name}`);
        } catch (e) {
            const errorMessage = e instanceof Error ? e.message : String(e);
            console.error(`[MCP] ✗ Failed to connect to server "${name}": ${errorMessage}`);
            // Continue with other servers even if this one fails
        }
    }

    async getTools(): Promise<{ name: string; description?: string; input_schema: Record<string, unknown> }[]> {
        const allTools: { name: string; description?: string; input_schema: Record<string, unknown> }[] = [];
        for (const [name, client] of this.clients) {
            try {
                const toolsList = await client.listTools();
                const tools = toolsList.tools.map(t => ({
                    name: `${name}__${t.name}`, // Namespacing tools
                    description: t.description,
                    input_schema: t.inputSchema as Record<string, unknown>
                }));
                allTools.push(...tools);
            } catch (e) {
                console.error(`Error listing tools for ${name}:`, e);
            }
        }
        return allTools;
    }

    async callTool(name: string, args: Record<string, unknown>) {
        // Parse namespaced tool name "server__tool"
        const [serverName, toolName] = name.split('__');
        const client = this.clients.get(serverName);
        if (!client) throw new Error(`MCP Server ${serverName} not found`);

        const result = await client.callTool({
            name: toolName,
            arguments: args
        });

        // Convert MCP result to Anthropic ToolResult
        return JSON.stringify(result);
    }

    // =====================================================
    // New CRUD Methods for v2 Configuration Format
    // =====================================================

    /**
     * List all MCP server configurations
     */
    async listServers(): Promise<MCPServerConfig[]> {
        const config = await this.loadConfigFileV2();
        return config.servers || [];
    }

    /**
     * Get a single server configuration by ID
     */
    async getServer(id: string): Promise<MCPServerConfig | null> {
        const config = await this.loadConfigFileV2();
        return config.servers.find(s => s.id === id) || null;
    }

    /**
     * Add a new MCP server
     */
    async addServer(server: MCPServerConfig): Promise<{ success: boolean; error?: string }> {
        const config = await this.loadConfigFileV2();

        if (config.servers.some(s => s.id === server.id)) {
            return { success: false, error: `Server ID "${server.id}" already exists` };
        }

        const validation = this.validateServerConfig(server);
        if (!validation.ok) {
            return { success: false, error: validation.error };
        }

        server.createdAt = Date.now();
        server.updatedAt = Date.now();
        config.servers.push(server);
        await this.saveConfigFileV2(config);

        return { success: true };
    }

    /**
     * Update an existing MCP server
     */
    async updateServer(id: string, updates: Partial<MCPServerConfig>): Promise<{ success: boolean; error?: string }> {
        const config = await this.loadConfigFileV2();
        const index = config.servers.findIndex(s => s.id === id);

        if (index === -1) {
            return { success: false, error: `Server "${id}" not found` };
        }

        if (updates.id && updates.id !== id) {
            if (config.servers.some(s => s.id === updates.id && s.id !== id)) {
                return { success: false, error: `Server ID "${updates.id}" already exists` };
            }
        }

        const mergedServer: MCPServerConfig = {
            ...config.servers[index],
            ...updates,
            id: config.servers[index].id,
            updatedAt: Date.now()
        };

        if (updates.transportType || updates.command || updates.url || updates.id) {
            const validation = this.validateServerConfig(mergedServer);
            if (!validation.ok) {
                return { success: false, error: validation.error };
            }
        }

        config.servers[index] = mergedServer;
        await this.saveConfigFileV2(config);

        return { success: true };
    }

    /**
     * Delete an MCP server
     */
    async deleteServer(id: string): Promise<{ success: boolean; error?: string }> {
        const config = await this.loadConfigFileV2();
        const index = config.servers.findIndex(s => s.id === id);

        if (index === -1) {
            return { success: false, error: `Server "${id}" not found` };
        }

        await this.disconnectServerById(id);
        config.servers.splice(index, 1);
        await this.saveConfigFileV2(config);

        return { success: true };
    }

    /**
     * Toggle server enabled state
     */
    async toggleServer(id: string, enabled: boolean): Promise<{ success: boolean; error?: string }> {
        return await this.updateServer(id, { enabled });
    }

    /**
     * Validate server configuration
     */
    private validateServerConfig(server: MCPServerConfig): { ok: boolean; error?: string } {
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
     * Load v2 configuration file with auto-migration
     */
    private async loadConfigFileV2(): Promise<MCPConfigFile> {
        try {
            const content = await fs.readFile(this.configPath, 'utf-8');
            const config = JSON.parse(content);

            if (config.version === 2) {
                return config as MCPConfigFile;
            }

            // Migrate from v1
            return await this.migrateToV2(config);
        } catch {
            return { version: 2, servers: [] };
        }
    }

    /**
     * Save v2 configuration file
     */
    private async saveConfigFileV2(config: MCPConfigFile): Promise<void> {
        const dir = path.dirname(this.configPath);
        await fs.mkdir(dir, { recursive: true });
        await fs.writeFile(this.configPath, JSON.stringify(config, null, 2), 'utf-8');
    }

    /**
     * Migrate from v1 to v2 format
     */
    private async migrateToV2(oldConfig: unknown): Promise<MCPConfigFile> {
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
            await this.saveConfigFileV2(newConfig);
            console.log('[MCP] Migrated config from v1 to v2 format');
            return newConfig;
        }

        return { version: 2, servers: [] };
    }

    /**
     * Disconnect a specific server by ID
     */
    private async disconnectServerById(id: string): Promise<void> {
        const client = this.clients.get(id);
        if (client) {
            try {
                const anyClient = client as unknown as { close?: () => unknown; disconnect?: () => unknown };
                if (typeof anyClient.close === 'function') await anyClient.close();
                else if (typeof anyClient.disconnect === 'function') await anyClient.disconnect();
            } catch (e) {
                console.error(`Failed to disconnect MCP server ${id}:`, e);
            }
            this.clients.delete(id);
        }
    }
}
