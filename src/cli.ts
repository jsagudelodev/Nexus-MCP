#!/usr/bin/env node
/**
 * Nexus-MCP CLI
 * 
 * Command-line interface with:
 * - Commander.js for CLI argument parsing
 * - Server start/stop commands
 * - Configuration management
 * - Tool listing and management
 * - Signal handling for graceful shutdown
 * 
 * @module cli
 */

import { Command } from 'commander';
import { startServer, stopServer, getServer, listTools } from './index.js';
import { loadConfig, getConfig, reloadConfig } from './config.js';
import { initializeLogger, logger, setLogLevel, getLogLevel } from './logger.js';
import { handleError } from './utils/error-handler.js';

// ============================================================================
// CLI Program
// ============================================================================

const program = new Command();

program
  .name('nexus-mcp')
  .description('Nexus-MCP: A production-grade MCP server with 50+ tools')
  .version(getConfig().server.version);

// ============================================================================
// Start Command
// ============================================================================

program
  .command('start')
  .description('Start the Nexus-MCP server')
  .option('-c, --config <path>', 'Path to config file')
  .option('-l, --log-level <level>', 'Log level (error, warn, info, debug)')
  .option('-d, --daemon', 'Run as daemon (background)')
  .action(async (options) => {
    try {
      // Load config if path provided
      if (options.config) {
        loadConfig(options.config);
      }

      // Set log level if provided
      if (options.logLevel) {
        setLogLevel(options.logLevel as any);
      }

      // Initialize logger
      initializeLogger();

      logger.info('Starting Nexus-MCP server', {
        config: options.config,
        logLevel: options.logLevel,
        daemon: options.daemon
      });

      // Start server
      await startServer();

      if (options.daemon) {
        logger.info('Server running in daemon mode');
      } else {
        logger.info('Server running (press Ctrl+C to stop)');
      }
    } catch (error) {
      const handlingResult = handleError(error as Error);
      console.error('Failed to start server:', handlingResult.error?.message);
      process.exit(1);
    }
  });

// ============================================================================
// Stop Command
// ============================================================================

program
  .command('stop')
  .description('Stop the Nexus-MCP server')
  .action(async () => {
    try {
      initializeLogger();
      logger.info('Stopping Nexus-MCP server');
      await stopServer();
      console.log('Server stopped successfully');
    } catch (error) {
      const handlingResult = handleError(error as Error);
      console.error('Failed to stop server:', handlingResult.error?.message);
      process.exit(1);
    }
  });

// ============================================================================
// Status Command
// ============================================================================

program
  .command('status')
  .description('Show server status')
  .action(() => {
    try {
      initializeLogger();
      const server = getServer();
      const config = getConfig();

      console.log('Nexus-MCP Server Status:');
      console.log(`  Name: ${config.server.name}`);
      console.log(`  Version: ${config.server.version}`);
      console.log(`  Environment: ${config.server.environment}`);
      console.log(`  Log Level: ${getLogLevel()}`);
      console.log(`  Tools: ${server.getToolCount()}`);
      console.log(`  Categories:`);
      
      const categoryCounts = server.getCategoryCounts();
      for (const [category, count] of Object.entries(categoryCounts)) {
        console.log(`    ${category}: ${count}`);
      }
    } catch (error) {
      const handlingResult = handleError(error as Error);
      console.error('Failed to get status:', handlingResult.error?.message);
      process.exit(1);
    }
  });

// ============================================================================
// Config Commands
// ============================================================================

program
  .command('config')
  .description('Manage configuration')
  .argument('[action]', 'Action: show, reload', 'show')
  .option('-c, --config <path>', 'Path to config file')
  .action(async (action, options) => {
    try {
      initializeLogger();

      if (action === 'show') {
        const config = options.config ? loadConfig(options.config) : getConfig();
        console.log(JSON.stringify(config, null, 2));
      } else if (action === 'reload') {
        const config = reloadConfig(options.config);
        console.log('Configuration reloaded successfully');
        console.log(JSON.stringify(config, null, 2));
      } else {
        console.error(`Unknown action: ${action}`);
        process.exit(1);
      }
    } catch (error) {
      const handlingResult = handleError(error as Error);
      console.error('Config command failed:', handlingResult.error?.message);
      process.exit(1);
    }
  });

// ============================================================================
// Tool Commands
// ============================================================================

program
  .command('tools')
  .description('List and manage tools')
  .argument('[action]', 'Action: list, categories', 'list')
  .option('-c, --category <category>', 'Filter by category')
  .action(async (action, options) => {
    try {
      initializeLogger();

      if (action === 'list') {
        const tools = options.category 
          ? listTools(options.category as any)
          : listTools();
        
        console.log(`Tools (${tools.length}):`);
        for (const tool of tools) {
          console.log(`  ${tool.name}: ${tool.description}`);
          if (tool.deprecated) {
            console.log(`    ⚠️  Deprecated`);
          }
          if (tool.tags && tool.tags.length > 0) {
            console.log(`    Tags: ${tool.tags.join(', ')}`);
          }
        }
      } else if (action === 'categories') {
        const server = getServer();
        const categoryCounts = server.getCategoryCounts();
        
        console.log('Tool Categories:');
        for (const [category, count] of Object.entries(categoryCounts)) {
          console.log(`  ${category}: ${count}`);
        }
      } else {
        console.error(`Unknown action: ${action}`);
        process.exit(1);
      }
    } catch (error) {
      const handlingResult = handleError(error as Error);
      console.error('Tools command failed:', handlingResult.error?.message);
      process.exit(1);
    }
  });

// ============================================================================
// Log Commands
// ============================================================================

program
  .command('log')
  .description('Manage logging')
  .argument('[action]', 'Action: level', 'level')
  .option('-l, --level <level>', 'Set log level (error, warn, info, debug)')
  .action(async (action, options) => {
    try {
      initializeLogger();

      if (action === 'level') {
        if (options.level) {
          setLogLevel(options.level as any);
          console.log(`Log level set to: ${options.level}`);
        } else {
          console.log(`Current log level: ${getLogLevel()}`);
        }
      } else {
        console.error(`Unknown action: ${action}`);
        process.exit(1);
      }
    } catch (error) {
      const handlingResult = handleError(error as Error);
      console.error('Log command failed:', handlingResult.error?.message);
      process.exit(1);
    }
  });

// ============================================================================
// Version Command
// ============================================================================

program
  .command('version')
  .description('Show version information')
  .action(() => {
    const config = getConfig();
    console.log(`Nexus-MCP v${config.server.version}`);
    console.log(`Environment: ${config.server.environment}`);
    console.log(`Node: ${process.version}`);
  });

// ============================================================================
// Parse Arguments
// ============================================================================

program.parse(process.argv);

// ============================================================================
// Signal Handling
// ============================================================================

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

// ============================================================================
// Export
// ============================================================================

export { program };
