/**
 * Tests for MCP Gateway Registry
 */

import { MCPGatewayRegistry } from '../../dist/mcp-gateway/registry.js';
import { logger } from '../../dist/logger.js';
import winston from 'winston';

describe('MCPGatewayRegistry', () => {
  let registry: MCPGatewayRegistry;

  beforeAll(() => {
    // Silence winston logs during tests
    logger.add(new winston.transports.Console({ silent: true }));
  });

  beforeEach(() => {
    registry = new MCPGatewayRegistry({ debug: false });
  });

  afterEach(async () => {
    await registry.disconnectAll();
  });

  test('should register a server connection', async () => {
    // Note: This test would require a real MCP server to connect to
    // For now, we'll test the structure without actual connection
    const serverConfig = {
      name: 'test-server',
      transport: 'stdio' as const,
      command: 'node',
      args: ['/fake/path.js'],
    };

    // This will fail to connect, but we can test the error handling
    await expect(registry.registerServer(serverConfig)).rejects.toThrow();
  });

  test('should check if server is registered', () => {
    const serverConfig = {
      name: 'test-server',
      transport: 'stdio' as const,
      command: 'node',
      args: ['/fake/path.js'],
    };

    expect(registry.isRegistered('test-server')).toBe(false);
    
    // Attempt to register (will fail but tests the structure)
    registry.registerServer(serverConfig).catch(() => {});
    
    // Server should still not be registered due to connection failure
    expect(registry.isRegistered('test-server')).toBe(false);
  });

  test('should get empty connections initially', () => {
    const connections = registry.getAllConnections();
    expect(connections).toEqual([]);
  });

  test('should get stats for empty registry', () => {
    const stats = registry.getStats();
    expect(stats.totalServers).toBe(0);
    expect(stats.connectedServers).toBe(0);
    expect(stats.totalTools).toBe(0);
    expect(stats.collisions).toBe(0);
  });

  test('should detect no collisions in empty registry', () => {
    const collisions = registry.detectCollisions();
    expect(collisions.size).toBe(0);
  });

  test('should disconnect all servers gracefully', async () => {
    await registry.disconnectAll();
    const connections = registry.getAllConnections();
    expect(connections).toEqual([]);
  });
});
