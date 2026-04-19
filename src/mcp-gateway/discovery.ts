/**
 * MCP Gateway Discovery
 * 
 * Automatic discovery and caching of tool definitions from external MCP servers
 */

import { logger } from '../logger.js';
import { MCPClient } from './client.js';
import type { MCPServerConfig, MCPTool } from './types.js';

export interface ToolCacheEntry {
  tool: MCPTool;
  serverName: string;
  discoveredAt: Date;
  lastRefreshed: Date;
}

export interface DiscoveryOptions {
  cacheTimeout?: number; // milliseconds
  autoRefresh?: boolean;
  refreshInterval?: number; // milliseconds
}

export class MCPGatewayDiscovery {
  private toolCache: Map<string, ToolCacheEntry> = new Map();
  private options: Required<DiscoveryOptions>;
  private refreshTimer: NodeJS.Timeout | null = null;

  constructor(options: DiscoveryOptions = {}) {
    this.options = {
      cacheTimeout: options.cacheTimeout || 300000, // 5 minutes default
      autoRefresh: options.autoRefresh || false,
      refreshInterval: options.refreshInterval || 600000, // 10 minutes default
    };

    if (this.options.autoRefresh) {
      this.startAutoRefresh();
    }
  }

  /**
   * Discover tools from a server and cache them
   */
  async discoverTools(config: MCPServerConfig): Promise<MCPTool[]> {
    const cacheKey = `${config.name}:tools`;
    const cached = this.toolCache.get(cacheKey);

    // Check if cache is still valid
    if (cached && this.isCacheValid(cached)) {
      logger.debug(`Using cached tools for server: ${config.name}`);
      return this.getServerTools(config.name);
    }

    logger.info(`Discovering tools from server: ${config.name}`);

    const client = new MCPClient(config);
    try {
      await client.connect();
      const tools = await client.listTools();
      await client.disconnect();

      // Cache the tools
      const now = new Date();
      for (const tool of tools) {
        const entry: ToolCacheEntry = {
          tool,
          serverName: config.name,
          discoveredAt: now,
          lastRefreshed: now,
        };
        this.toolCache.set(`${config.name}:${tool.name}`, entry);
      }

      logger.info(`Discovered and cached ${tools.length} tools from server: ${config.name}`);
      return tools;
    } catch (error) {
      logger.error(`Failed to discover tools from server: ${config.name}`, { error });
      throw error;
    }
  }

  /**
   * Get cached tools for a specific server
   */
  getServerTools(serverName: string): MCPTool[] {
    const tools: MCPTool[] = [];

    for (const entry of this.toolCache.values()) {
      if (entry.serverName === serverName && this.isCacheValid(entry)) {
        tools.push(entry.tool);
      }
    }

    return tools;
  }

  /**
   * Get all cached tools
   */
  getAllTools(): Map<string, ToolCacheEntry> {
    const validCache = new Map<string, ToolCacheEntry>();

    for (const [key, entry] of this.toolCache.entries()) {
      if (this.isCacheValid(entry)) {
        validCache.set(key, entry);
      }
    }

    return validCache;
  }

  /**
   * Refresh tools for a specific server
   */
  async refreshTools(config: MCPServerConfig): Promise<MCPTool[]> {
    logger.info(`Refreshing tools for server: ${config.name}`);

    // Clear old cache entries for this server
    this.clearServerCache(config.name);

    // Re-discover tools
    return this.discoverTools(config);
  }

  /**
   * Refresh all cached tools
   */
  async refreshAll(servers: MCPServerConfig[]): Promise<void> {
    logger.info('Refreshing all tool caches');

    const refreshPromises = servers.map(async (config) => {
      try {
        await this.refreshTools(config);
      } catch (error) {
        logger.error(`Failed to refresh tools for server: ${config.name}`, { error });
      }
    });

    await Promise.all(refreshPromises);
    logger.info('All tool caches refreshed');
  }

  /**
   * Clear cache for a specific server
   */
  clearServerCache(serverName: string): void {
    const keysToDelete: string[] = [];

    for (const key of this.toolCache.keys()) {
      if (key.startsWith(`${serverName}:`)) {
        keysToDelete.push(key);
      }
    }

    for (const key of keysToDelete) {
      this.toolCache.delete(key);
    }

    logger.debug(`Cleared cache for server: ${serverName}`, { deletedCount: keysToDelete.length });
  }

  /**
   * Clear all cached tools
   */
  clearAllCache(): void {
    const count = this.toolCache.size;
    this.toolCache.clear();
    logger.info('Cleared all tool caches', { deletedCount: count });
  }

  /**
   * Check if a cache entry is still valid
   */
  private isCacheValid(entry: ToolCacheEntry): boolean {
    const age = Date.now() - entry.lastRefreshed.getTime();
    return age < this.options.cacheTimeout;
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): {
    totalEntries: number;
    validEntries: number;
    expiredEntries: number;
    servers: string[];
  } {
    let validEntries = 0;
    let expiredEntries = 0;
    const servers = new Set<string>();

    for (const entry of this.toolCache.values()) {
      servers.add(entry.serverName);
      if (this.isCacheValid(entry)) {
        validEntries++;
      } else {
        expiredEntries++;
      }
    }

    return {
      totalEntries: this.toolCache.size,
      validEntries,
      expiredEntries,
      servers: Array.from(servers),
    };
  }

  /**
   * Start automatic refresh
   */
  private startAutoRefresh(): void {
    if (this.refreshTimer) {
      clearInterval(this.refreshTimer);
    }

    this.refreshTimer = setInterval(() => {
      logger.debug('Auto-refresh triggered (needs server list)');
      // Note: This needs the server list to be passed in
      // Implementation would be done in the integration layer
    }, this.options.refreshInterval);

    logger.info('Auto-refresh started', { interval: this.options.refreshInterval });
  }

  /**
   * Stop automatic refresh
   */
  stopAutoRefresh(): void {
    if (this.refreshTimer) {
      clearInterval(this.refreshTimer);
      this.refreshTimer = null;
      logger.info('Auto-refresh stopped');
    }
  }

  /**
   * Cleanup resources
   */
  destroy(): void {
    this.stopAutoRefresh();
    this.clearAllCache();
  }
}
