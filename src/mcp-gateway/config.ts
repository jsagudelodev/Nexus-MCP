/**
 * MCP Gateway Configuration
 * 
 * Manages configuration for external MCP servers
 */

import * as fs from 'fs';
import * as path from 'path';
import { logger } from '../logger.js';
import type { MCPServerConfig } from './types.js';

export interface MCPGatewayConfig {
  servers: MCPServerConfig[];
  defaultTimeout?: number;
  enableDiscovery?: boolean;
}

const DEFAULT_CONFIG: MCPGatewayConfig = {
  servers: [],
  defaultTimeout: 30000,
  enableDiscovery: true,
};

export class MCPGatewayConfigManager {
  private configPath: string;
  private config: MCPGatewayConfig;

  constructor(configPath?: string) {
    this.configPath = configPath || path.join(process.cwd(), 'mcp-gateway.config.json');
    this.config = this.loadConfig();
  }

  /**
   * Load configuration from file
   */
  private loadConfig(): MCPGatewayConfig {
    try {
      if (fs.existsSync(this.configPath)) {
        const data = fs.readFileSync(this.configPath, 'utf-8');
        const config = JSON.parse(data);
        logger.info(`Loaded MCP gateway config from ${this.configPath}`);
        return { ...DEFAULT_CONFIG, ...config };
      }
    } catch (error) {
      logger.error(`Failed to load MCP gateway config: ${this.configPath}`, { error });
    }
    
    logger.info('Using default MCP gateway configuration');
    return { ...DEFAULT_CONFIG };
  }

  /**
   * Save configuration to file
   */
  saveConfig(): void {
    try {
      const data = JSON.stringify(this.config, null, 2);
      fs.writeFileSync(this.configPath, data, 'utf-8');
      logger.info(`Saved MCP gateway config to ${this.configPath}`);
    } catch (error) {
      logger.error(`Failed to save MCP gateway config: ${this.configPath}`, { error });
      throw error;
    }
  }

  /**
   * Get all server configurations
   */
  getServers(): MCPServerConfig[] {
    return this.config.servers;
  }

  /**
   * Get a specific server configuration by name
   */
  getServer(name: string): MCPServerConfig | undefined {
    return this.config.servers.find(s => s.name === name);
  }

  /**
   * Add a server configuration
   */
  addServer(server: MCPServerConfig): void {
    if (this.getServer(server.name)) {
      throw new Error(`Server with name '${server.name}' already exists`);
    }
    this.config.servers.push(server);
    this.saveConfig();
    logger.info(`Added MCP server: ${server.name}`);
  }

  /**
   * Remove a server configuration
   */
  removeServer(name: string): void {
    const index = this.config.servers.findIndex(s => s.name === name);
    if (index === -1) {
      throw new Error(`Server with name '${name}' not found`);
    }
    this.config.servers.splice(index, 1);
    this.saveConfig();
    logger.info(`Removed MCP server: ${name}`);
  }

  /**
   * Update a server configuration
   */
  updateServer(name: string, updates: Partial<MCPServerConfig>): void {
    const server = this.getServer(name);
    if (!server) {
      throw new Error(`Server with name '${name}' not found`);
    }
    Object.assign(server, updates);
    this.saveConfig();
    logger.info(`Updated MCP server: ${name}`);
  }

  /**
   * Get default timeout
   */
  getDefaultTimeout(): number {
    return (this.config.defaultTimeout ?? DEFAULT_CONFIG.defaultTimeout) as number;
  }

  /**
   * Check if discovery is enabled
   */
  isDiscoveryEnabled(): boolean {
    return this.config.enableDiscovery !== false;
  }
}
