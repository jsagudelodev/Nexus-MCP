/**
 * Test script for integrating Google News MCP Server with Nexus-MCP Gateway
 * 
 * Prerequisites:
 * 1. Install the Google News MCP server: npm install @chanmeng666/google-news-server
 * 2. Build the server: cd node_modules/@chanmeng666/google-news-server && npm run build
 * 3. Get a SerpApi key from https://serpapi.com/ (free tier: 250 searches/month)
 * 4. Add SERP_API_KEY to your .env file or pass it directly
 */

const { MCPGatewayConfigManager } = require('../dist/mcp-gateway/config.js');
const { MCPGatewayRegistry } = require('../dist/mcp-gateway/registry.js');
const { MCPGatewayDiscovery } = require('../dist/mcp-gateway/discovery.js');
const { MCPGatewayRouter } = require('../dist/mcp-gateway/router.js');
const path = require('path');
const { logger } = require('../dist/logger.js');

async function testGoogleNewsGateway() {
  console.log('🚀 Testing Google News MCP Server Integration with Nexus-MCP Gateway\n');

  // Initialize gateway components
  const configManager = new MCPGatewayConfigManager();
  const registry = new MCPGatewayRegistry({ debug: true });
  const discovery = new MCPGatewayDiscovery({ autoRefresh: false });
  const router = new MCPGatewayRouter(registry);

  try {
    // Configure Google News server
    const googleNewsConfig = {
      name: 'google-news',
      transport: 'stdio',
      command: 'node',
      args: [path.join(__dirname, '../node_modules/@chanmeng666/google-news-server/dist/index.js')],
      env: {
        SERP_API_KEY: process.env.SERP_API_KEY || 'your-serp-api-key-here'
      }
    };

    console.log('📝 Configuration:');
    console.log(JSON.stringify(googleNewsConfig, null, 2));
    console.log();

    // Check if API key is set
    if (!process.env.SERP_API_KEY || process.env.SERP_API_KEY === 'your-serp-api-key-here') {
      console.log('⚠️  WARNING: SERP_API_KEY not set in environment variables');
      console.log('   Please add your SerpApi key to .env file:');
      console.log('   SERP_API_KEY=your-actual-api-key');
      console.log('   Get a free key at: https://serpapi.com/');
      console.log();
      console.log('   For testing purposes, we will skip the actual connection test.');
      console.log();
      return;
    }

    console.log('🔌 Registering Google News server...');
    await registry.registerServer(googleNewsConfig);
    console.log('✅ Server registered successfully\n');

    // Get server info
    const connection = registry.getConnection('google-news');
    console.log('📊 Server Status:');
    console.log(`   Connected: ${connection.connected ? '✅ Yes' : '❌ No'}`);
    console.log(`   Tools available: ${connection.tools.size}`);
    console.log();

    // List available tools
    console.log('🛠️  Available Tools:');
    for (const [toolName, toolDef] of connection.tools.entries()) {
      console.log(`   - ${toolName}`);
      console.log(`     Description: ${toolDef.description}`);
      console.log();
    }

    // Test a tool call (search for news)
    console.log('🔍 Testing Google News search...');
    const searchResult = await router.routeToolCall('google-news:search', {
      query: 'artificial intelligence',
      num: 5
    });

    console.log('📰 Search Results:');
    console.log(JSON.stringify(searchResult, null, 2));
    console.log();

    // Get routing stats
    const stats = router.getRoutingStats();
    console.log('📈 Routing Statistics:');
    console.log(`   Total Servers: ${stats.totalServers}`);
    console.log(`   Connected Servers: ${stats.connectedServers}`);
    console.log(`   Total Tools: ${stats.totalTools}`);
    console.log();

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error.stack);
  } finally {
    // Cleanup
    console.log('🧹 Cleaning up...');
    await registry.disconnectAll();
    discovery.destroy();
    console.log('✅ Cleanup complete');
  }
}

// Run the test
testGoogleNewsGateway().catch(console.error);
