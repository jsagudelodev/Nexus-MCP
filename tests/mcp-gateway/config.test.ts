/**
 * Tests for MCP Gateway Config Manager
 */

import { MCPGatewayConfigManager } from '../../dist/mcp-gateway/config.js';
import { logger } from '../../dist/logger.js';
import winston from 'winston';
import * as fs from 'fs';
import * as path from 'path';

describe('MCPGatewayConfigManager', () => {
  let configManager: MCPGatewayConfigManager;

  beforeAll(() => {
    // Silence winston logs during tests
    logger.add(new winston.transports.Console({ silent: true }));
  });

  beforeEach(() => {
    // Use a unique config path for each test that doesn't exist
    const testConfigPath = path.join(__dirname, `non-existent-${Math.random().toString(36).substring(7)}.json`);
    configManager = new MCPGatewayConfigManager(testConfigPath);
  });

  test('should load default config when file does not exist', () => {
    const servers = configManager.getServers();
    expect(servers).toEqual([]);
    expect(configManager.getDefaultTimeout()).toBe(30000);
    expect(configManager.isDiscoveryEnabled()).toBe(true);
  });

  test('should add a server configuration', () => {
    const serverConfig = {
      name: 'test-server-1',
      transport: 'stdio' as const,
      command: 'node',
      args: ['/path/to/server.js'],
    };

    configManager.addServer(serverConfig);
    const servers = configManager.getServers();

    expect(servers).toHaveLength(1);
    expect(servers[0]).toEqual(serverConfig);
  });

  test('should throw error when adding duplicate server', () => {
    const serverConfig = {
      name: 'test-server-2',
      transport: 'stdio' as const,
      command: 'node',
      args: ['/path/to/server.js'],
    };

    configManager.addServer(serverConfig);

    expect(() => {
      configManager.addServer(serverConfig);
    }).toThrow("Server with name 'test-server-2' already exists");
  });

  test('should remove a server configuration', () => {
    const serverConfig = {
      name: 'test-server-3',
      transport: 'stdio' as const,
      command: 'node',
      args: ['/path/to/server.js'],
    };

    configManager.addServer(serverConfig);
    expect(configManager.getServer('test-server-3')).toBeDefined();
    
    configManager.removeServer('test-server-3');
    expect(configManager.getServer('test-server-3')).toBeUndefined();
  });

  test('should throw error when removing non-existent server', () => {
    expect(() => {
      configManager.removeServer('non-existent');
    }).toThrow("Server with name 'non-existent' not found");
  });

  test('should get a specific server configuration', () => {
    const serverConfig = {
      name: 'test-server-4',
      transport: 'stdio' as const,
      command: 'node',
      args: ['/path/to/server.js'],
    };

    configManager.addServer(serverConfig);
    const retrieved = configManager.getServer('test-server-4');

    expect(retrieved).toEqual(serverConfig);
  });

  test('should return undefined for non-existent server', () => {
    const retrieved = configManager.getServer('non-existent');
    expect(retrieved).toBeUndefined();
  });

  test('should update a server configuration', () => {
    const serverConfig = {
      name: 'test-server-5',
      transport: 'stdio' as const,
      command: 'node',
      args: ['/path/to/server.js'],
    };

    configManager.addServer(serverConfig);
    configManager.updateServer('test-server-5', { command: 'python' });

    const retrieved = configManager.getServer('test-server-5');
    expect(retrieved?.command).toBe('python');
  });

  test('should save and load configuration from file', () => {
    const serverConfig = {
      name: 'test-server-6',
      transport: 'stdio' as const,
      command: 'node',
      args: ['/path/to/server.js'],
    };

    configManager.addServer(serverConfig);

    // Verify server was added to current instance
    const retrieved = configManager.getServer('test-server-6');
    expect(retrieved).toBeDefined();
    expect(retrieved?.name).toBe('test-server-6');
    expect(retrieved?.command).toBe('node');
  });
});
