import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import path from 'path';
import fs from 'fs/promises';
import os from 'os';
// app import removed

export interface MCPServerConfig {
    name: string;
    command?: string;       // Optional for stdio transport
    args?: string[];        // Optional for stdio transport
    url?: string;           // Optional for SSE/HTTP transport
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

    private async connectToServer(name: string, config: MCPServerConfig) {
        if (this.clients.has(name)) return;

        try {
            const finalEnv = { ...(process.env as Record<string, string>), ...config.env };

            // [Restored] Sync API Key from ConfigStore if Base URL matches MiniMax
            // This allows users to use the app's configured key without duplicating it in mcp.json
            const { configStore } = await import('../../config/ConfigStore'); // Dynamic import to avoid cycles if any
            const appApiKey = await configStore.getApiKey('minimax');
            const appApiUrl = configStore.getApiUrl() || '';

            // Check if we should inject the app's key
            if (name === 'MiniMax' && appApiUrl.includes('minimax') && appApiKey) {
                // Only override if the config env key is placeholder or missing
                const configKey = config.env?.MINIMAX_API_KEY;
                if (!configKey || configKey === "YOUR_API_KEY_HERE" || configKey.includes("API密钥")) {
                    console.log('Injecting App API Key for MiniMax MCP Server');
                    finalEnv['MINIMAX_API_KEY'] = appApiKey;
                }
            }

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
}
