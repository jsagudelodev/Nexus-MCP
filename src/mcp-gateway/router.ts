/**
 * MCP Gateway Router
 * 
 * Routes tool calls to the appropriate MCP server
 */

import { logger } from '../logger.js';
import { MCPClient } from './client.js';
import { MCPGatewayRegistry } from './registry.js';
import type {
  MCPCallToolResult,
} from './types.js';

export interface RouteResult {
  serverName: string;
  result: MCPCallToolResult;
  success: boolean;
  error?: string;
  duration: number;
}

export interface RouterOptions {
  timeout?: number;
  retryAttempts?: number;
  fallbackToLocal?: boolean;
}

export class MCPGatewayRouter {
  private registry: MCPGatewayRegistry;
  private options: Required<RouterOptions>;

  constructor(
    registry: MCPGatewayRegistry,
    options: RouterOptions = {}
  ) {
    this.registry = registry;
    this.options = {
      timeout: options.timeout || 30000,
      retryAttempts: options.retryAttempts || 3,
      fallbackToLocal: options.fallbackToLocal || false,
    };
  }

  /**
   * Route a tool call to the appropriate server
   */
  async routeToolCall(
    toolName: string,
    args: any = {}
  ): Promise<RouteResult> {
    const start = Date.now();

    // Check if tool name is qualified (server:tool_name)
    const qualifiedMatch = toolName.match(/^([^:]+):(.+)$/);
    
    if (qualifiedMatch) {
      const [, serverName, actualToolName] = qualifiedMatch;
      if (serverName && actualToolName) {
        return this.callServerTool(serverName, actualToolName, args, start);
      }
    }

    // Not qualified, try to find which server has this tool
    const serverInfo = this.registry.findToolServer(toolName);
    
    if (serverInfo) {
      return this.callServerTool(serverInfo.server, toolName, args, start);
    }

    // Tool not found in any external server
    const error = `Tool '${toolName}' not found in any registered MCP server`;
    logger.error(error);
    return {
      serverName: 'none',
      result: { content: [{ type: 'text', text: error }], isError: true },
      success: false,
      error,
      duration: Date.now() - start,
    };
  }

  /**
   * Call a tool on a specific server
   */
  private async callServerTool(
    serverName: string,
    toolName: string,
    args: any,
    start: number
  ): Promise<RouteResult> {
    const connection = this.registry.getConnection(serverName);
    
    if (!connection) {
      const error = `Server '${serverName}' is not registered`;
      logger.error(error);
      return {
        serverName,
        result: { content: [{ type: 'text', text: error }], isError: true },
        success: false,
        error,
        duration: Date.now() - start,
      };
    }

    if (!connection.connected) {
      const error = `Server '${serverName}' is not connected`;
      logger.error(error);
      return {
        serverName,
        result: { content: [{ type: 'text', text: error }], isError: true },
        success: false,
        error,
        duration: Date.now() - start,
      };
    }

    logger.debug(`Routing tool call to server: ${serverName}`, { tool: toolName });

    const client = new MCPClient(connection.config, {
      timeout: this.options.timeout,
      retryAttempts: this.options.retryAttempts,
    });

    try {
      await client.connect();
      const result = await client.callTool(toolName, args);
      await client.disconnect();

      const duration = Date.now() - start;
      logger.debug(`Tool call completed`, { server: serverName, tool: toolName, duration });

      // Extract error message from result if isError is true
      const errorMessage = result.isError
        ? result.content?.find((c: any) => c.type === 'text')?.text || 'Tool execution failed'
        : undefined;

      return {
        serverName,
        result,
        success: !result.isError,
        error: errorMessage,
        duration,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error(`Tool call failed on server: ${serverName}`, { error: errorMessage });

      await client.disconnect();

      return {
        serverName,
        result: { content: [{ type: 'text', text: errorMessage }], isError: true },
        success: false,
        error: errorMessage,
        duration: Date.now() - start,
      };
    }
  }

  /**
   * Route multiple tool calls in parallel
   */
  async routeToolCalls(calls: Array<{ toolName: string; args: any }>): Promise<RouteResult[]> {
    logger.info(`Routing ${calls.length} tool calls in parallel`);

    const results = await Promise.all(
      calls.map(({ toolName, args }) => this.routeToolCall(toolName, args))
    );

    const successCount = results.filter(r => r.success).length;
    logger.info(`Tool calls completed`, { total: results.length, success: successCount });

    return results;
  }

  /**
   * Get routing statistics
   */
  getRoutingStats(): {
    totalServers: number;
    connectedServers: number;
    totalTools: number;
    qualifiedTools: number;
  } {
    const stats = this.registry.getStats();
    const allTools = this.registry.getAllTools();

    return {
      totalServers: stats.totalServers,
      connectedServers: stats.connectedServers,
      totalTools: stats.totalTools,
      qualifiedTools: allTools.size,
    };
  }

  /**
   * List all available tools with their server routes
   */
  listToolRoutes(): Array<{ qualifiedName: string; server: string; tool: string }> {
    const routes: Array<{ qualifiedName: string; server: string; tool: string }> = [];

    this.registry.getAllConnections().forEach((connection) => {
      const serverName = connection.config.name;
      for (const toolName of connection.tools.keys()) {
        routes.push({
          qualifiedName: `${serverName}:${toolName}`,
          server: serverName,
          tool: toolName,
        });
      }
    });

    return routes;
  }

  /**
   * Validate that a tool can be routed
   */
  canRouteTool(toolName: string): boolean {
    // Check if qualified
    if (toolName.includes(':')) {
      const [serverName] = toolName.split(':');
      if (serverName) {
        const connection = this.registry.getConnection(serverName);
        return connection !== undefined && connection.connected;
      }
      return false;
    }

    // Check if unqualified tool exists
    return this.registry.findToolServer(toolName) !== undefined;
  }

  /**
   * Get the server that would handle a tool call
   */
  getToolServer(toolName: string): string | null {
    // Check if qualified
    if (toolName.includes(':')) {
      const [serverName] = toolName.split(':');
      return serverName || null;
    }

    // Find server for unqualified tool
    const serverInfo = this.registry.findToolServer(toolName);
    return serverInfo ? serverInfo.server : null;
  }
}
