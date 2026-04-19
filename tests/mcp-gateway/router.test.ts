/**
 * Tests for MCP Gateway Router
 */

import { MCPGatewayRouter } from '../../dist/mcp-gateway/router.js';
import { MCPGatewayRegistry } from '../../dist/mcp-gateway/registry.js';
import { logger } from '../../dist/logger.js';
import winston from 'winston';

describe('MCPGatewayRouter', () => {
  let registry: MCPGatewayRegistry;
  let router: MCPGatewayRouter;

  beforeAll(() => {
    // Silence winston logs during tests
    logger.add(new winston.transports.Console({ silent: true }));
  });

  beforeEach(() => {
    registry = new MCPGatewayRegistry({ debug: false });
    router = new MCPGatewayRouter(registry);
  });

  afterEach(async () => {
    await registry.disconnectAll();
  });

  test('should initialize router with registry', () => {
    expect(router).toBeDefined();
  });

  test('should return error for non-existent tool', async () => {
    const result = await router.routeToolCall('non-existent-tool');
    
    expect(result.success).toBe(false);
    expect(result.serverName).toBe('none');
    expect(result.error).toContain('not found');
  });

  test('should return error for non-existent qualified tool', async () => {
    const result = await router.routeToolCall('non-existent-server:tool');
    
    expect(result.success).toBe(false);
    expect(result.serverName).toBe('non-existent-server');
    expect(result.error).toContain('not registered');
  });

  test('should handle empty tool calls array', async () => {
    const results = await router.routeToolCalls([]);
    expect(results).toEqual([]);
  });

  test('should get routing stats for empty registry', () => {
    const stats = router.getRoutingStats();
    
    expect(stats.totalServers).toBe(0);
    expect(stats.connectedServers).toBe(0);
    expect(stats.totalTools).toBe(0);
    expect(stats.qualifiedTools).toBe(0);
  });

  test('should list empty tool routes', () => {
    const routes = router.listToolRoutes();
    expect(routes).toEqual([]);
  });

  test('should return false for non-existent tool validation', () => {
    const canRoute = router.canRouteTool('non-existent-tool');
    expect(canRoute).toBe(false);
  });

  test('should return false for non-existent qualified tool validation', () => {
    const canRoute = router.canRouteTool('non-existent-server:tool');
    expect(canRoute).toBe(false);
  });

  test('should return null for non-existent tool server', () => {
    const server = router.getToolServer('non-existent-tool');
    expect(server).toBeNull();
  });

  test('should return server name for qualified tool even if server does not exist', () => {
    const server = router.getToolServer('non-existent-server:tool');
    expect(server).toBe('non-existent-server');
  });
});
