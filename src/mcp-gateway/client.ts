/**
 * MCP Client - Basic client for connecting to external MCP servers
 * 
 * Supports stdio and SSE transport types
 */

import { spawn, ChildProcess } from 'child_process';
import { logger } from '../logger.js';
import type {
  MCPServerConfig,
  MCPTool,
  MCPCallToolResult,
  MCPClientOptions,
} from './types.js';

export class MCPClient {
  private config: MCPServerConfig;
  private options: MCPClientOptions;
  private process: ChildProcess | null = null;
  private requestId = 0;

  constructor(config: MCPServerConfig, options: MCPClientOptions = {}) {
    this.config = config;
    this.options = {
      timeout: options.timeout || 30000,
      retryAttempts: options.retryAttempts || 3,
      debug: options.debug || false,
    };
  }

  /**
   * Connect to the MCP server
   */
  async connect(): Promise<void> {
    if (this.config.transport === 'stdio') {
      await this.connectStdio();
    } else if (this.config.transport === 'sse') {
      await this.connectSSE();
    } else {
      throw new Error(`Unsupported transport type: ${this.config.transport}`);
    }
  }

  /**
   * Connect via stdio (spawn a process)
   */
  private async connectStdio(): Promise<void> {
    if (!this.config.command) {
      throw new Error('Command is required for stdio transport');
    }

    logger.info(`Connecting to MCP server via stdio: ${this.config.name}`, {
      command: this.config.command,
      args: this.config.args,
    });

    this.process = spawn(this.config.command, this.config.args || [], {
      env: { ...process.env, ...this.config.env },
    });

    this.process.on('error', (err) => {
      logger.error(`MCP server process error: ${this.config.name}`, { error: err.message });
    });

    this.process.on('exit', (code) => {
      logger.info(`MCP server process exited: ${this.config.name}`, { code });
      this.process = null;
    });

    // Wait a bit for the process to start
    await new Promise(resolve => setTimeout(resolve, 500));
  }

  /**
   * Connect via SSE (Server-Sent Events)
   * TODO: Implement SSE transport
   */
  private async connectSSE(): Promise<void> {
    if (!this.config.url) {
      throw new Error('URL is required for SSE transport');
    }

    logger.info(`Connecting to MCP server via SSE: ${this.config.name}`, {
      url: this.config.url,
    });

    // SSE implementation would go here
    throw new Error('SSE transport not yet implemented');
  }

  /**
   * Disconnect from the MCP server
   */
  async disconnect(): Promise<void> {
    if (this.process) {
      this.process.kill();
      this.process = null;
      logger.info(`Disconnected from MCP server: ${this.config.name}`);
    }
  }

  /**
   * Ensure process is not null
   */
  private ensureConnected(): void {
    if (!this.process) {
      throw new Error('Not connected to MCP server');
    }
  }

  /**
   * List available tools from the MCP server
   */
  async listTools(): Promise<MCPTool[]> {
    this.ensureConnected();

    logger.debug(`Listing tools from MCP server: ${this.config.name}`);

    // Send JSON-RPC request
    const request = {
      jsonrpc: '2.0',
      id: ++this.requestId,
      method: 'tools/list',
    };

    const response = await this.sendRequest(request);
    return response.tools || [];
  }

  /**
   * Call a tool on the MCP server
   */
  async callTool(name: string, args: any = {}): Promise<MCPCallToolResult> {
    this.ensureConnected();

    logger.debug(`Calling tool on MCP server: ${this.config.name}`, { tool: name, args });

    const request = {
      jsonrpc: '2.0',
      id: ++this.requestId,
      method: 'tools/call',
      params: {
        name,
        arguments: args,
      },
    };

    const response = await this.sendRequest(request);
    return response;
  }

  /**
   * Send a JSON-RPC request and wait for response
   */
  private async sendRequest(request: any): Promise<any> {
    this.ensureConnected();

    return new Promise((resolve, reject) => {
      const process = this.process!;
      const timeout = setTimeout(() => {
        reject(new Error(`Request timeout after ${this.options.timeout}ms`));
      }, this.options.timeout);

      // Send request
      const requestStr = JSON.stringify(request) + '\n';
      process.stdin!.write(requestStr);

      // Collect response
      let responseStr = '';
      const onData = (data: Buffer) => {
        responseStr += data.toString();

        // Try to parse complete JSON-RPC responses
        const lines = responseStr.split('\n').filter(l => l.trim());
        for (const line of lines) {
          try {
            const response = JSON.parse(line);
            if (response.id === request.id) {
              clearTimeout(timeout);
              process.stdout!.off('data', onData);

              if (response.error) {
                reject(new Error(response.error.message));
              } else {
                resolve(response.result);
              }
              return;
            }
          } catch {
            // Not a complete JSON yet, continue collecting
          }
        }
      };

      process.stdout!.on('data', onData);
    });
  }

  /**
   * Check if connected
   */
  isConnected(): boolean {
    return this.process !== null && !this.process.killed;
  }
}
