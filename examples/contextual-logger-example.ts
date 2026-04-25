/**
 * Contextual Logger Example
 * 
 * This example demonstrates how to use the ContextualLogger
 * for tracing end-to-end workflows with separate log files.
 * 
 * Based on App Migración SOUL pattern.
 */

import { ContextualLogger } from '../src/logger.js';
import path from 'path';

// Example 1: Simple workflow logging
function exampleSimpleWorkflow() {
  console.log('=== Example 1: Simple Workflow ===\n');

  const workDir = path.join(process.cwd(), 'logs');
  const contextId = 'workflow-001';

  // Create a contextual logger for this workflow
  const logger = ContextualLogger.create(workDir, contextId);

  logger.info('workflow.started', { step: 1 });
  logger.info('processing.data', { items: 100 });
  logger.warn('slow.operation', { duration: 5000 });
  logger.info('workflow.completed', { success: true });

  // Close the logger when workflow ends
  logger.close();

  console.log(`Log file created at: ${logger.logPath}`);
  console.log(`Context ID: ${logger.contextId}\n`);
}

// Example 2: Multi-step workflow with error handling
function exampleMultiStepWorkflow() {
  console.log('=== Example 2: Multi-Step Workflow ===\n');

  const workDir = path.join(process.cwd(), 'logs');
  const contextId = 'migration-123';

  const logger = ContextualLogger.create(workDir, contextId);

  try {
    // Step 1: Extract
    logger.info('extract.started', { repoPaths: ['file1.aspx', 'file2.aspx'] });
    logger.info('extract.completed', { schemaPath: '/path/to/schema.json' });

    // Step 2: Generate
    logger.info('generate.started', { target: 'backend' });
    logger.info('generate.completed', { files: 5 });

    // Step 3: Test
    logger.info('test.started', { testSuite: 'unit' });
    logger.info('test.completed', { passed: 10, failed: 0 });

    logger.info('workflow.completed', { success: true });
  } catch (error) {
    logger.error('workflow.failed', { error: (error as Error).message });
  } finally {
    logger.close();
  }

  console.log(`Log file created at: ${logger.logPath}\n`);
}

// Example 3: Integration with multiple clients
function exampleClientIntegration() {
  console.log('=== Example 3: Client Integration ===\n');

  const workDir = path.join(process.cwd(), 'logs');
  const contextId = 'task-456';

  const logger = ContextualLogger.create(workDir, contextId);

  // Simulate client operations with contextual logging
  logger.info('jira.fetch', { key: 'TASK-456' });
  logger.info('git.clone', { repo: 'backend.git' });
  logger.info('db.query', { table: 'users' });
  logger.info('ai.generate', { model: 'claude-3-sonnet' });

  logger.close();

  console.log(`Log file created at: ${logger.logPath}\n`);
}

// Run examples
if (import.meta.url === `file://${process.argv[1]}`) {
  exampleSimpleWorkflow();
  exampleMultiStepWorkflow();
  exampleClientIntegration();
}

export { exampleSimpleWorkflow, exampleMultiStepWorkflow, exampleClientIntegration };
