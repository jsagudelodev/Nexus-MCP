/**
 * MCP Gateway Types
 * 
 * Types for connecting to external MCP servers
 */

export type TransportType = 'stdio' | 'sse';

export interface MCPServerConfig {
  name: string;
  transport: TransportType;
  command?: string;
  args?: string[];
  url?: string;
  env?: Record<string, string>;
}

export interface MCPTool {
  name: string;
  description?: string;
  inputSchema?: any;
}

export interface MCPCallToolResult {
  content: any[];
  isError?: boolean;
}

export interface MCPServerConnection {
  config: MCPServerConfig;
  tools: Map<string, MCPTool>;
  connected: boolean;
  lastConnected?: Date;
}

export interface MCPClientOptions {
  timeout?: number;
  retryAttempts?: number;
  debug?: boolean;
}
