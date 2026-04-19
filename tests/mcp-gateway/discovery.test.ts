/**
 * Tests for MCP Gateway Discovery
 */

import { MCPGatewayDiscovery } from '../../dist/mcp-gateway/discovery.js';
import { logger } from '../../dist/logger.js';
import winston from 'winston';

describe('MCPGatewayDiscovery', () => {
  let discovery: MCPGatewayDiscovery;

  beforeAll(() => {
    // Silence winston logs during tests
    logger.add(new winston.transports.Console({ silent: true }));
  });

  beforeEach(() => {
    discovery = new MCPGatewayDiscovery({
      cacheTimeout: 5000,
      autoRefresh: false,
    });
  });

  afterEach(() => {
    discovery.destroy();
  });

  test('should initialize with default options', () => {
    const defaultDiscovery = new MCPGatewayDiscovery();
    expect(defaultDiscovery).toBeDefined();
    defaultDiscovery.destroy();
  });

  test('should get empty tools initially', () => {
    const tools = discovery.getServerTools('test-server');
    expect(tools).toEqual([]);
  });

  test('should get empty all tools cache initially', () => {
    const allTools = discovery.getAllTools();
    expect(allTools.size).toBe(0);
  });

  test('should get cache stats for empty cache', () => {
    const stats = discovery.getCacheStats();
    expect(stats.totalEntries).toBe(0);
    expect(stats.validEntries).toBe(0);
    expect(stats.expiredEntries).toBe(0);
    expect(stats.servers).toEqual([]);
  });

  test('should clear server cache', () => {
    discovery.clearServerCache('test-server');
    const tools = discovery.getServerTools('test-server');
    expect(tools).toEqual([]);
  });

  test('should clear all cache', () => {
    discovery.clearAllCache();
    const allTools = discovery.getAllTools();
    expect(allTools.size).toBe(0);
  });

  test('should stop auto-refresh if enabled', () => {
    const autoRefreshDiscovery = new MCPGatewayDiscovery({
      autoRefresh: true,
      refreshInterval: 1000,
    });
    
    // Should not throw
    autoRefreshDiscovery.stopAutoRefresh();
    autoRefreshDiscovery.destroy();
  });

  test('should handle destroy gracefully', () => {
    expect(() => {
      discovery.destroy();
    }).not.toThrow();
  });
});
