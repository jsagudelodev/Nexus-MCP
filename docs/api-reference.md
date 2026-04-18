# API Reference

This document provides the complete API reference for Nexus-MCP.

## Table of Contents

- [Server API](#server-api)
- [Tool API](#tool-api)
- [Configuration API](#configuration-api)
- [Error Handling](#error-handling)

## Server API

### NexusMCPServer

Main class for the Nexus-MCP server.

#### Constructor

```typescript
constructor(config?: Partial<NexusConfig>)
```

**Parameters**:
- `config` (optional): Partial configuration object

**Example**:
```typescript
const server = new NexusMCPServer({
  server: {
    name: 'my-nexus',
    environment: 'production'
  }
});
```

#### Methods

##### initialize()

```typescript
async initialize(): Promise<void>
```

Initialize the server and register all tools.

**Example**:
```typescript
await server.initialize();
```

##### start()

```typescript
async start(): Promise<void>
```

Start the MCP server and begin listening for requests.

**Example**:
```typescript
await server.start();
```

##### callTool()

```typescript
async callTool(name: string, args: any): Promise<ToolResult>
```

Call a specific tool by name with arguments.

**Parameters**:
- `name`: Tool name
- `args`: Tool arguments

**Returns**: `ToolResult` object

**Example**:
```typescript
const result = await server.callTool('nexus_read_file', {
  path: '/path/to/file.txt'
});
```

##### listTools()

```typescript
listTools(category?: ToolCategory): MCPTool[]
```

List all available tools, optionally filtered by category.

**Parameters**:
- `category` (optional): Tool category to filter by

**Returns**: Array of `MCPTool` objects

**Example**:
```typescript
const allTools = server.listTools();
const filesystemTools = server.listTools('filesystem');
```

##### getCategoryCounts()

```typescript
getCategoryCounts(): Record<string, number>
```

Get the count of tools per category.

**Returns**: Object with category names as keys and counts as values

**Example**:
```typescript
const counts = server.getCategoryCounts();
console.log(counts); // { filesystem: 18, http: 16, git: 15, system: 8 }
```

## Tool API

### Tool Schema

All tools follow the same schema structure:

```typescript
interface MCPTool {
  name: string;
  description: string;
  category: ToolCategory;
  inputSchema: z.ZodSchema;
  deprecated?: boolean;
  tags?: string[];
}
```

### Tool Categories

- `filesystem`: File system operations
- `http`: HTTP/web requests
- `git`: Git version control
- `database`: Database operations
- `system`: System commands and information
- `ai`: AI/LLM integration
- `utilities`: Utility functions

### Tool Result Schema

All tools return results following this schema:

```typescript
interface ToolResult {
  success: boolean;
  data?: any;
  error?: {
    code: string;
    message: string;
    details?: any;
  };
  metadata?: {
    duration?: number;
    timestamp?: string;
  };
}
```

## Configuration API

### NexusConfig

Main configuration object.

```typescript
interface NexusConfig {
  server: ServerConfig;
  tools: ToolsConfig;
  logging: LoggingConfig;
  performance: PerformanceConfig;
  monitoring: MonitoringConfig;
}
```

### ServerConfig

```typescript
interface ServerConfig {
  name: string;
  version: string;
  environment: 'development' | 'production';
  logLevel: 'error' | 'warn' | 'info' | 'debug';
}
```

### ToolsConfig

```typescript
interface ToolsConfig {
  filesystem: FilesystemConfig;
  http: HttpConfig;
  git: GitConfig;
  database: DatabaseConfig;
  system: SystemConfig;
  ai: AIConfig;
}
```

### FilesystemConfig

```typescript
interface FilesystemConfig {
  enabled: boolean;
  allowedPaths: string[];
  maxFileSize: number;
  maxDirectoryDepth: number;
  allowSymbolicLinks: boolean;
}
```

### HttpConfig

```typescript
interface HttpConfig {
  enabled: boolean;
  timeout: number;
  maxRedirects: number;
  user_agent: string;
  allowed_domains: string[];
  denied_domains: string[];
  proxy: {
    host: string;
    port: number;
    username?: string;
    password?: string;
  };
  cache: {
    enabled: boolean;
    ttl: number;
  };
}
```

### GitConfig

```typescript
interface GitConfig {
  enabled: boolean;
  defaultBranch: string;
  autoCommit: boolean;
  authorName: string;
  authorEmail: string;
  sshKeyPath: string;
}
```

### SystemConfig

```typescript
interface SystemConfig {
  enabled: boolean;
  allowShellCommands: boolean;
  maxExecutionTime: number;
  allowedCommands: string[];
  deniedCommands: string[];
  processMonitoring: boolean;
  serviceManagement: boolean;
}
```

### LoggingConfig

```typescript
interface LoggingConfig {
  level: 'error' | 'warn' | 'info' | 'debug';
  format: 'json' | 'text';
  output: 'stdout' | 'stderr' | 'file';
  file?: string;
  maxSize: number;
  maxFiles: number;
}
```

### PerformanceConfig

```typescript
interface PerformanceConfig {
  cacheEnabled: boolean;
  cacheTtl: number;
  maxConcurrentRequests: number;
}
```

### MonitoringConfig

```typescript
interface MonitoringConfig {
  enabled: boolean;
  metricsPort: number;
  healthCheckInterval: number;
}
```

## Error Handling

### Error Types

All errors follow this structure:

```typescript
interface NexusError {
  code: string;
  message: string;
  details?: any;
  stack?: string;
}
```

### Common Error Codes

- `ENOENT`: File or directory not found
- `EACCES`: Permission denied
- `EINVAL`: Invalid argument
- `ETIMEOUT`: Operation timeout
- `ENETUNREACH`: Network unreachable
- `ECONNREFUSED`: Connection refused
- `VALIDATION_ERROR`: Input validation failed
- `TOOL_NOT_FOUND`: Tool does not exist
- `CONFIG_ERROR`: Configuration error

### Error Handling Example

```typescript
try {
  const result = await server.callTool('nexus_read_file', {
    path: '/nonexistent/file.txt'
  });
} catch (error) {
  if (error.code === 'ENOENT') {
    console.log('File not found');
  } else {
    console.error('Unexpected error:', error);
  }
}
```

## Utility Functions

### loadConfig()

```typescript
function loadConfig(configPath?: string): NexusConfig
```

Load configuration from file or environment.

**Parameters**:
- `configPath` (optional): Path to configuration file

**Returns**: Configuration object

### getConfig()

```typescript
function getConfig(): NexusConfig
```

Get the current configuration.

**Returns**: Configuration object

### handleError()

```typescript
function handleError(error: Error): NexusError
```

Handle and format errors consistently.

**Parameters**:
- `error`: Error object

**Returns**: Formatted error object

## Type Exports

```typescript
// Main types
export { NexusMCPServer } from './server';
export type { NexusConfig, ServerConfig, ToolsConfig } from './types';

// Tool types
export type { MCPTool, ToolCategory, ToolResult } from './types';

// Error types
export type { NexusError } from './types';
```

## Next Steps

- [Tools Reference](./tools-reference.md)
- [Examples](./examples.md)
- [Configuration Guide](./configuration.md)
