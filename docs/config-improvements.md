# Configuration and Logging Improvements

This document describes the improvements made to Nexus-MCP based on patterns from App Migración SOUL.

## 🎯 Overview

Two major improvements have been implemented:

1. **Environment Variable Substitution in YAML** - Flexible configuration with `${VAR_NAME}` syntax
2. **Contextual Logger** - Workflow-specific logging with separate log files

## 📝 Environment Variable Substitution

### What It Does

The configuration loader now supports `${VAR_NAME}` syntax in YAML files to substitute environment variables. This allows you to:

- Keep sensitive data (API keys, passwords) in environment variables
- Use different configurations for different environments (dev, staging, prod)
- Override specific values without editing the YAML file

### How to Use

**In your `config.yaml`:**

```yaml
server:
  log_level: "${NEXUS_LOG_LEVEL:-info}"  # Uses NEXUS_LOG_LEVEL env var, defaults to "info"
  environment: "${NODE_ENV:-development}"

database:
  postgresql:
    host: "${DB_HOST:-localhost}"
    port: "${DB_PORT:-5432}"
    user: "${DB_USER:-nexus}"
    password: "${DB_PASSWORD}"  # Required - will warn if not set

ai:
  anthropic:
    api_key: "${ANTHROPIC_API_KEY}"  # Required - will warn if not set
```

**In your `.env` file:**

```env
NEXUS_LOG_LEVEL=debug
NODE_ENV=production
DB_HOST=postgres.example.com
DB_PORT=5432
DB_USER=nexus
DB_PASSWORD=secret123
ANTHROPIC_API_KEY=sk-ant-...
```

**Default Values Syntax:**

You can provide default values using `:-` syntax:

```yaml
log_level: "${NEXUS_LOG_LEVEL:-info}"  # If NEXUS_LOG_LEVEL is not set, use "info"
```

### Validation

The system now includes a `validateEnvironment()` function to check required variables before starting:

```typescript
import { validateEnvironment, loadConfig } from './config.js';

// Validate required environment variables
validateEnvironment(['ANTHROPIC_API_KEY', 'DB_PASSWORD']);

// Load configuration (with variable substitution)
const config = loadConfig();
```

### Benefits

- **Security**: Sensitive data never stored in YAML files
- **Flexibility**: Same YAML works across environments
- **Override**: Environment variables override YAML values
- **Validation**: Early detection of missing required variables

## 📋 Contextual Logger

### What It Does

The `ContextualLogger` class provides workflow-specific logging with separate log files per context. This is useful for:

- Tracing end-to-end workflows (migrations, tasks, batch jobs)
- Debugging complex multi-step operations
- Keeping logs organized by workflow/correlation ID
- Historical analysis of specific workflows

### How to Use

**Basic Example:**

```typescript
import { ContextualLogger } from './logger.js';
import path from 'path';

const workDir = path.join(process.cwd(), 'logs');
const contextId = 'migration-123';

// Create a contextual logger for this workflow
const logger = ContextualLogger.create(workDir, contextId);

logger.info('workflow.started', { step: 1 });
logger.info('processing.data', { items: 100 });
logger.warn('slow.operation', { duration: 5000 });
logger.info('workflow.completed', { success: true });

// Close the logger when workflow ends
logger.close();

console.log(`Log file: ${logger.logPath}`);
console.log(`Context ID: ${logger.contextId}`);
```

**Multi-Step Workflow:**

```typescript
const logger = ContextualLogger.create(workDir, 'task-456');

try {
  logger.info('extract.started', { repoPaths: ['file1.aspx'] });
  logger.info('extract.completed', { schemaPath: '/path/to/schema.json' });

  logger.info('generate.started', { target: 'backend' });
  logger.info('generate.completed', { files: 5 });

  logger.info('test.started', { testSuite: 'unit' });
  logger.info('test.completed', { passed: 10, failed: 0 });

  logger.info('workflow.completed', { success: true });
} catch (error) {
  logger.error('workflow.failed', { error: error.message });
} finally {
  logger.close();
}
```

**Integration with Clients:**

```typescript
class JiraClient {
  private logger?: ContextualLogger;

  setLogger(logger: ContextualLogger) {
    this.logger = logger;
  }

  async getTask(key: string) {
    this.logger?.info('jira.fetch', { key });
    // ... implementation
    this.logger?.info('jira.completed', { key });
  }
}

// Usage
const logger = ContextualLogger.create(workDir, 'TASK-456');
const jiraClient = new JiraClient();
jiraClient.setLogger(logger);

await jiraClient.getTask('TASK-456');
logger.close();
```

### Log File Structure

Logs are organized by context ID:

```
logs/
├── migration-123/
│   └── 2024-04-24T21-30-00Z.log
├── task-456/
│   └── 2024-04-24T21-35-00Z.log
└── workflow-001/
    └── 2024-04-24T21-40-00Z.log
```

### Log Format

Each log entry includes:

- **Timestamp**: ISO 8601 format
- **Level**: INFO, WARN, ERROR
- **Context ID**: Workflow identifier (padded to 12 chars)
- **Event**: Event name (padded to 24 chars)
- **Data**: Optional JSON metadata

Example:
```
2024-04-24T21:30:00.123Z  INFO  [migration-123]  workflow.started     | {"step":1}
2024-04-24T21:30:05.456Z  INFO  [migration-123]  extract.completed    | {"schemaPath":"/path/to/schema.json"}
2024-04-24T21:30:10.789Z  WARN  [migration-123]  slow.operation       | {"duration":5000}
2024-04-24T21:30:15.012Z  INFO  [migration-123]  workflow.completed   | {"success":true}
2024-04-24T21:30:15.012Z  INFO  [migration-123]  run.close
```

### Benefits

- **Tracing**: Complete trace of workflow execution
- **Debugging**: Easy to find logs for specific workflows
- **Organization**: Logs separated by context, not mixed
- **Historical**: Keep history of workflow executions
- **Integration**: Easy to inject into multiple clients

## 🚀 Combined Usage Example

Here's how to use both improvements together:

```typescript
import { validateEnvironment, loadConfig } from './config.js';
import { ContextualLogger } from './logger.js';
import path from 'path';

// 1. Validate required environment variables
validateEnvironment(['ANTHROPIC_API_KEY', 'DB_PASSWORD']);

// 2. Load configuration (with variable substitution)
const config = loadConfig();

// 3. Create contextual logger for workflow
const workDir = config.tools.filesystem.allowed_paths[0] || './logs';
const logger = ContextualLogger.create(workDir, 'workflow-001');

// 4. Use configuration values in workflow
logger.info('config.loaded', {
  dbHost: config.tools.database.postgresql.host,
  aiProvider: config.tools.ai.default_provider
});

// 5. Execute workflow
logger.info('workflow.started');
// ... workflow logic
logger.info('workflow.completed');

// 6. Close logger
logger.close();
```

## 📚 Examples

See `examples/contextual-logger-example.ts` for complete working examples:

- Simple workflow logging
- Multi-step workflow with error handling
- Integration with multiple clients

Run the example:

```bash
npm run example:contextual-logger
```

## 🔧 Migration Guide

### Existing Config Files

Your existing `config.yaml` files will continue to work without changes. The substitution is optional.

To adopt the new pattern:

1. Identify sensitive values (API keys, passwords)
2. Move them to environment variables
3. Update YAML to use `${VAR_NAME}` syntax
4. Add validation for required variables

### Existing Logger Usage

The existing Winston-based logger remains unchanged. The `ContextualLogger` is an additional option for workflow-specific logging.

To adopt the new pattern:

1. Identify workflows that need end-to-end tracing
2. Create `ContextualLogger` instances at workflow start
3. Inject logger into clients that participate in the workflow
4. Call `logger.close()` when workflow completes

## 🎯 Best Practices

### Configuration

- Use environment variables for all sensitive data
- Provide sensible defaults using `:-` syntax
- Validate required variables at startup
- Document required variables in `.env.example`

### Logging

- Use context IDs that are meaningful (e.g., Jira keys, task IDs)
- Close loggers in `finally` blocks to ensure cleanup
- Inject loggers into all clients that participate in a workflow
- Use structured data in log entries for better analysis

## 📖 References

- **App Migración SOUL**: Original implementation of these patterns
- **config.ts**: Configuration loader with substitution
- **logger.ts**: ContextualLogger implementation
- **config.example.yaml**: Example configuration with substitution
