/**
 * MCP (Model Context Protocol) Type Definitions
 */

/**
 * MCP Server Configuration
 */
export interface MCPServerConfig {
    /** Unique server identifier (lowercase letters, numbers, hyphens only) */
    id: string;
    /** Display name for the server */
    name: string;
    /** Optional description of the server */
    description?: string;
    /** Whether the server is enabled */
    enabled: boolean;
    /** Transport type: stdio (local process) or http (remote server) */
    transportType: 'stdio' | 'http';
    /** Command for stdio transport (required when transportType is 'stdio') */
    command?: string;
    /** Arguments for stdio transport command */
    args?: string[];
    /** URL for http transport (required when transportType is 'http') */
    url?: string;
    /** Environment variables for the server process */
    env?: Record<string, string>;
    /** Creation timestamp */
    createdAt?: number;
    /** Last update timestamp */
    updatedAt?: number;
}

/**
 * MCP Configuration File Format (Version 2)
 */
export interface MCPConfigFile {
    /** Configuration format version */
    version: number;
    /** List of MCP servers */
    servers: MCPServerConfig[];
}

/**
 * Legacy MCP Configuration Format (Version 1)
 * @deprecated Use MCPConfigFile instead
 */
export interface LegacyMCPConfig {
    mcpServers: Record<string, Omit<MCPServerConfig, 'id' | 'name' | 'enabled' | 'transportType'>>;
}
