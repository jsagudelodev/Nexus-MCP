/**
 * Nexus-MCP Server
 * 
 * Main MCP server implementation with:
 * - Tool registry and management
 * - Request routing and handling
 * - Lifecycle management (startup, shutdown)
 * - Integration with all utilities (logger, config, error handling, validation)
 * - Support for tool categories and metadata
 * 
 * @module index
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  Tool,
  ListToolsResult
} from '@modelcontextprotocol/sdk/types.js';
import type { MCPTool, ToolCategory } from './types.js';
import { loadConfig, getConfig } from './config.js';
import { initializeLogger, logger } from './logger.js';
import { handleError, withErrorHandling } from './utils/error-handler.js';
import { validateSchema } from './utils/validation.js';
import { filesystemTools } from './tools/filesystem/index.js';
import { httpTools } from './tools/http/index.js';
import { gitTools } from './tools/git/index.js';
import { systemTools } from './tools/system/index.js';
import { aiTools } from './tools/ai/index.js';

// ============================================================================
// Tool Registry
// ============================================================================

class ToolRegistry {
  private tools: Map<string, MCPTool> = new Map();
  private categories: Map<ToolCategory, Set<string>> = new Map();

  /**
   * Register a tool
   */
  register(tool: MCPTool): void {
    this.tools.set(tool.name, tool);
    
    // Add to category
    if (!this.categories.has(tool.category)) {
      this.categories.set(tool.category, new Set());
    }
    this.categories.get(tool.category)!.add(tool.name);
    
    logger.info(`Tool registered: ${tool.name}`, {
      category: tool.category,
      version: tool.version,
      deprecated: tool.deprecated
    });
  }

  /**
   * Unregister a tool
   */
  unregister(name: string): boolean {
    const tool = this.tools.get(name);
    if (!tool) return false;
    
    this.tools.delete(name);
    this.categories.get(tool.category)?.delete(name);
    
    logger.info(`Tool unregistered: ${name}`);
    return true;
  }

  /**
   * Get a tool by name
   */
  get(name: string): MCPTool | undefined {
    return this.tools.get(name);
  }

  /**
   * List all tools
   */
  listAll(): MCPTool[] {
    return Array.from(this.tools.values());
  }

  /**
   * List tools by category
   */
  listByCategory(category: ToolCategory): MCPTool[] {
    const toolNames = this.categories.get(category);
    if (!toolNames) return [];
    
    return Array.from(toolNames)
      .map(name => this.tools.get(name))
      .filter((tool): tool is MCPTool => tool !== undefined);
  }

  /**
   * Get tool count
   */
  count(): number {
    return this.tools.size;
  }

  /**
   * Get category counts
   */
  getCategoryCounts(): Record<ToolCategory, number> {
    const counts: Partial<Record<ToolCategory, number>> = {};
    
    for (const [category, toolNames] of this.categories.entries()) {
      counts[category] = toolNames.size;
    }
    
    return counts as Record<ToolCategory, number>;
  }
}

// ============================================================================
// Nexus MCP Server
// ============================================================================

class NexusMCPServer {
  private server: Server;
  private toolRegistry: ToolRegistry;
  private initialized: boolean = false;

  constructor() {
    this.toolRegistry = new ToolRegistry();
    this.server = new Server(
      {
        name: 'nexus-mcp',
        version: getConfig().server.version
      },
      {
        capabilities: {
          tools: {}
        }
      }
    );
    
    this.setupHandlers();
  }

  /**
   * Setup request handlers
   */
  private setupHandlers(): void {
    // List tools handler
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      const tools = this.toolRegistry.listAll();
      return {
        tools: tools.map(tool => ({
          name: tool.name,
          description: tool.description,
          inputSchema: tool.inputSchema as unknown as Tool['inputSchema']
        }))
      } satisfies ListToolsResult;
    });

    // Call tool handler
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const toolName = request.params.name;
      const args = request.params.arguments;

      logger.info('Tool execution requested', {
        tool: toolName,
        args: JSON.stringify(args)
      });

      const tool = this.toolRegistry.get(toolName);
      if (!tool) {
        return {
          content: [{
            type: 'text',
            text: `Tool not found: ${toolName}`
          }],
          isError: true
        };
      }

      // Validate arguments
      const validationResult = validateSchema(tool.inputSchema, args);
      if (!validationResult.valid) {
        return {
          content: [{
            type: 'text',
            text: `Validation error: ${validationResult.error}`
          }],
          isError: true
        };
      }

      // Execute tool
      const result = await withErrorHandling(
        () => tool.handler(args as never),
        { tool: toolName }
      );

      if (result.success) {
        return {
          content: [{
            type: 'text',
            text: JSON.stringify(result.data, null, 2)
          }]
        };
      } else {
        return {
          content: [{
            type: 'text',
            text: `Error: ${result.error?.message}`
          }],
          isError: true
        };
      }
    });
  }

  /**
   * Register a tool
   */
  registerTool(tool: MCPTool): void {
    this.toolRegistry.register(tool);
  }

  /**
   * Unregister a tool
   */
  unregisterTool(name: string): boolean {
    return this.toolRegistry.unregister(name);
  }

  /**
   * Get tool
   */
  getTool(name: string): MCPTool | undefined {
    return this.toolRegistry.get(name);
  }

  /**
   * List tools
   */
  listTools(category?: ToolCategory): MCPTool[] {
    if (category) {
      return this.toolRegistry.listByCategory(category);
    }
    return this.toolRegistry.listAll();
  }

  /**
   * Get tool count
   */
  getToolCount(): number {
    return this.toolRegistry.count();
  }

  /**
   * Get category counts
   */
  getCategoryCounts(): Record<ToolCategory, number> {
    return this.toolRegistry.getCategoryCounts();
  }

  /**
   * Initialize server
   */
  async initialize(): Promise<void> {
    if (this.initialized) {
      logger.warn('Server already initialized');
      return;
    }

    try {
      // Load configuration
      const config = loadConfig();
      
      // Initialize logger
      initializeLogger();
      
      logger.info('Nexus-MCP Server initializing', {
        name: config.server.name,
        version: config.server.version,
        environment: config.server.environment
      });

      // Log enabled tools
      const enabledTools: string[] = [];
      if (config.tools.filesystem.enabled) enabledTools.push('filesystem');
      if (config.tools.http.enabled) enabledTools.push('http');
      if (config.tools.git.enabled) enabledTools.push('git');
      if (config.tools.database.enabled) enabledTools.push('database');
      if (config.tools.system.enabled) enabledTools.push('system');
      if (config.tools.ai.enabled) enabledTools.push('ai');
      
      logger.info('Enabled tool categories', { categories: enabledTools });

      // Register filesystem tools if enabled
      if (config.tools.filesystem.enabled) {
        for (const tool of filesystemTools) {
          this.toolRegistry.register(tool);
        }
        logger.info('Filesystem tools registered', { count: filesystemTools.length });
      }

      // Register HTTP tools if enabled
      if (config.tools.http.enabled) {
        for (const tool of httpTools) {
          this.toolRegistry.register(tool);
        }
        logger.info('HTTP tools registered', { count: httpTools.length });
      }

      // Register Git tools if enabled
      if (config.tools.git.enabled) {
        for (const tool of gitTools) {
          this.toolRegistry.register(tool);
        }
        logger.info('Git tools registered', { count: gitTools.length });
      }

      // Register System tools if enabled
      if (config.tools.system.enabled) {
        for (const tool of systemTools) {
          this.toolRegistry.register(tool);
        }
        logger.info('System tools registered', { count: systemTools.length });
      }

      // Register AI tools if enabled
      if (config.tools.ai.enabled) {
        for (const tool of aiTools) {
          this.toolRegistry.register(tool);
        }
        logger.info('AI tools registered', { count: aiTools.length });
      }

      this.initialized = true;
      logger.info('Nexus-MCP Server initialized successfully');
    } catch (error) {
      const handlingResult = handleError(error as Error);
      logger.error('Failed to initialize server', {
        error: handlingResult.error?.message
      });
      throw handlingResult.error;
    }
  }

  /**
   * Start server
   */
  async start(): Promise<void> {
    if (!this.initialized) {
      await this.initialize();
    }

    try {
      const transport = new StdioServerTransport();
      await this.server.connect(transport);
      
      logger.info('Nexus-MCP Server started', {
        toolCount: this.getToolCount(),
        categoryCounts: this.getCategoryCounts()
      });
    } catch (error) {
      const handlingResult = handleError(error as Error);
      logger.error('Failed to start server', {
        error: handlingResult.error?.message
      });
      throw handlingResult.error;
    }
  }

  /**
   * Stop server
   */
  async stop(): Promise<void> {
    try {
      await this.server.close();
      logger.info('Nexus-MCP Server stopped');
    } catch (error) {
      const handlingResult = handleError(error as Error);
      logger.error('Error stopping server', {
        error: handlingResult.error?.message
      });
      throw handlingResult.error;
    }
  }

  /**
   * Get server instance
   */
  getServer(): Server {
    return this.server;
  }
}

// ============================================================================
// Server Instance
// ============================================================================

let nexusServer: NexusMCPServer | null = null;

/**
 * Get or create server instance
 */
export function getServer(): NexusMCPServer {
  if (!nexusServer) {
    nexusServer = new NexusMCPServer();
  }
  return nexusServer;
}

/**
 * Initialize and start server
 */
export async function startServer(): Promise<void> {
  const server = getServer();
  await server.start();
}

/**
 * Stop server
 */
export async function stopServer(): Promise<void> {
  if (nexusServer) {
    await nexusServer.stop();
    nexusServer = null;
  }
}

/**
 * Register tool
 */
export function registerTool(tool: MCPTool): void {
  const server = getServer();
  server.registerTool(tool);
}

/**
 * Unregister tool
 */
export function unregisterTool(name: string): boolean {
  if (nexusServer) {
    return nexusServer.unregisterTool(name);
  }
  return false;
}

/**
 * Get tool
 */
export function getTool(name: string): MCPTool | undefined {
  if (nexusServer) {
    return nexusServer.getTool(name);
  }
  return undefined;
}

/**
 * List tools
 */
export function listTools(category?: ToolCategory): MCPTool[] {
  if (nexusServer) {
    return nexusServer.listTools(category);
  }
  return [];
}

// ============================================================================
// Main Entry Point
// ============================================================================

/**
 * Main entry point for the MCP server
 */
async function main(): Promise<void> {
  try {
    await startServer();
    
    // Handle graceful shutdown
    process.on('SIGINT', async () => {
      logger.info('Received SIGINT, shutting down...');
      await stopServer();
      process.exit(0);
    });
    
    process.on('SIGTERM', async () => {
      logger.info('Received SIGTERM, shutting down...');
      await stopServer();
      process.exit(0);
    });
    
    // Handle uncaught errors
    process.on('uncaughtException', (error) => {
      const handlingResult = handleError(error);
      logger.error('Uncaught exception', {
        error: handlingResult.error?.message,
        stack: handlingResult.error?.stack
      });
      process.exit(1);
    });
    
    process.on('unhandledRejection', (reason, promise) => {
      logger.error('Unhandled rejection', {
        reason: String(reason),
        promise: String(promise)
      });
      process.exit(1);
    });
    
  } catch (error) {
    const handlingResult = handleError(error as Error);
    console.error('Failed to start Nexus-MCP server:', handlingResult.error?.message);
    process.exit(1);
  }
}

// Start server if this file is run directly
if (require.main === module) {
  main().catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}

// Export for testing
export { NexusMCPServer, ToolRegistry };
