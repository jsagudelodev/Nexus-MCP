/**
 * MCP Gateway Registry
 * 
 * Manages registration and tracking of external MCP servers
 */

import { logger } from '../logger.js';
import { MCPClient } from './client.js';
import type {
  MCPServerConfig,
  MCPServerConnection,
  MCPTool,
  MCPClientOptions,
  IDisconnectable,
} from './types.js';

export class MCPGatewayRegistry {
  private connections: Map<string, MCPServerConnection> = new Map();
  private clientOptions: MCPClientOptions;

  constructor(clientOptions: MCPClientOptions = {}) {
    this.clientOptions = clientOptions;
  }

  /**
   * Register a new MCP server
   */
  async registerServer(config: MCPServerConfig): Promise<MCPServerConnection> {
    if (this.connections.has(config.name)) {
      throw new Error(`Server '${config.name}' is already registered`);
    }

    logger.info(`Registering MCP server: ${config.name}`, { transport: config.transport });

    const client = new MCPClient(config, this.clientOptions);
    
    try {
      await client.connect();
      const tools = await this.discoverTools(client);
      
      const connection: MCPServerConnection = {
        config,
        tools: new Map(tools.map(t => [t.name, t])),
        connected: true,
        lastConnected: new Date(),
        client: client as IDisconnectable,
      };

      this.connections.set(config.name, connection);
      logger.info(`Successfully registered MCP server: ${config.name}`, { toolCount: tools.length });
      
      return connection;
    } catch (error) {
      logger.error(`Failed to register MCP server: ${config.name}`, { error });
      await client.disconnect();
      throw error;
    }
  }

  /**
   * Unregister an MCP server
   */
  async unregisterServer(name: string): Promise<void> {
    const connection = this.connections.get(name);
    if (!connection) {
      throw new Error(`Server '${name}' is not registered`);
    }

    logger.info(`Unregistering MCP server: ${name}`);

    if (connection.connected && connection.client) {
      await connection.client.disconnect();
    }

    this.connections.delete(name);
    logger.info(`Successfully unregistered MCP server: ${name}`);
  }

  /**
   * Get a server connection by name
   */
  getConnection(name: string): MCPServerConnection | undefined {
    return this.connections.get(name);
  }

  /**
   * Get all registered server connections
   */
  getAllConnections(): MCPServerConnection[] {
    return Array.from(this.connections.values());
  }

  /**
   * Check if a server is registered
   */
  isRegistered(name: string): boolean {
    return this.connections.has(name);
  }

  /**
   * Discover tools from an MCP server
   */
  private async discoverTools(client: MCPClient): Promise<MCPTool[]> {
    try {
      const tools = await client.listTools();
      logger.debug(`Discovered ${tools.length} tools from MCP server`);
      return tools;
    } catch (error) {
      logger.error(`Failed to discover tools from MCP server`, { error });
      throw error;
    }
  }

  /**
   * Refresh tool definitions for a server
   */
  async refreshTools(name: string): Promise<void> {
    const connection = this.connections.get(name);
    if (!connection) {
      throw new Error(`Server '${name}' is not registered`);
    }

    logger.info(`Refreshing tools for MCP server: ${name}`);

    let client = connection.client as MCPClient | undefined;
    const needsNewClient = !client || !client.isConnected();

    if (needsNewClient) {
      client = new MCPClient(connection.config, this.clientOptions);
      await client.connect();
    }

    try {
      const tools = await this.discoverTools(client!);

      connection.tools.clear();
      tools.forEach(t => connection.tools.set(t.name, t));
      connection.lastConnected = new Date();
      connection.connected = true;
      connection.client = client as IDisconnectable;

      logger.info(`Successfully refreshed tools for MCP server: ${name}`, { toolCount: tools.length });
    } catch (error) {
      logger.error(`Failed to refresh tools for MCP server: ${name}`, { error });
      connection.connected = false;
      throw error;
    }
  }

  /**
   * Get all tools from all registered servers
   */
  getAllTools(): Map<string, { tool: MCPTool; server: string }> {
    const allTools = new Map<string, { tool: MCPTool; server: string }>();

    for (const [serverName, connection] of this.connections.entries()) {
      for (const [toolName, tool] of connection.tools.entries()) {
        // Prefix tool name with server name to avoid collisions
        const qualifiedName = `${serverName}:${toolName}`;
        allTools.set(qualifiedName, { tool, server: serverName });
      }
    }

    return allTools;
  }

  /**
   * Get tools from a specific server
   */
  getServerTools(serverName: string): MCPTool[] {
    const connection = this.connections.get(serverName);
    if (!connection) {
      throw new Error(`Server '${serverName}' is not registered`);
    }
    return Array.from(connection.tools.values());
  }

  /**
   * Find which server has a specific tool
   */
  findToolServer(toolName: string): { server: string; tool: MCPTool } | undefined {
    for (const [serverName, connection] of this.connections.entries()) {
      const tool = connection.tools.get(toolName);
      if (tool) {
        return { server: serverName, tool };
      }
    }
    return undefined;
  }

  /**
   * Check for tool name collisions across servers
   */
  detectCollisions(): Map<string, string[]> {
    const collisions = new Map<string, string[]>();
    const toolToServers = new Map<string, string[]>();

    for (const [serverName, connection] of this.connections.entries()) {
      for (const toolName of connection.tools.keys()) {
        if (!toolToServers.has(toolName)) {
          toolToServers.set(toolName, []);
        }
        toolToServers.get(toolName)!.push(serverName);
      }
    }

    for (const [toolName, servers] of toolToServers.entries()) {
      if (servers.length > 1) {
        collisions.set(toolName, servers);
      }
    }

    return collisions;
  }

  /**
   * Get registry statistics
   */
  getStats(): {
    totalServers: number;
    connectedServers: number;
    totalTools: number;
    collisions: number;
  } {
    const collisions = this.detectCollisions();
    let totalTools = 0;
    let connectedServers = 0;

    for (const connection of this.connections.values()) {
      totalTools += connection.tools.size;
      if (connection.connected) {
        connectedServers++;
      }
    }

    return {
      totalServers: this.connections.size,
      connectedServers,
      totalTools,
      collisions: collisions.size,
    };
  }

  /**
   * Disconnect all servers
   */
  async disconnectAll(): Promise<void> {
    logger.info('Disconnecting all MCP servers');

    const disconnectPromises = Array.from(this.connections.keys()).map(async (name) => {
      try {
        await this.unregisterServer(name);
      } catch (error) {
        logger.error(`Failed to disconnect server: ${name}`, { error });
      }
    });

    await Promise.all(disconnectPromises);
    this.connections.clear();
    logger.info('All MCP servers disconnected');
  }
}
