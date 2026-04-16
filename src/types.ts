/**
 * Nexus-MCP Type System
 * 
 * Central type definitions for the entire system.
 * All types are strictly typed with TypeScript and validated with Zod at runtime.
 * 
 * @module types
 */

import { z } from 'zod';

// ============================================================================
// MCP Tool Types
// ============================================================================

/**
 * Categories of MCP tools
 */
export enum ToolCategory {
  FILESYSTEM = 'filesystem',
  HTTP = 'http',
  GIT = 'git',
  DATABASE = 'database',
  SYSTEM = 'system',
  AI = 'ai',
  UTILITIES = 'utilities'
}

/**
 * Generic tool result with success/error handling
 */
export interface ToolResult<T = unknown> {
  success: boolean;
  data?: T;
  error?: Error;
  metadata?: Record<string, unknown>;
}

/**
 * MCP Tool definition
 */
export interface MCPTool<TArgs = unknown, TResult = unknown> {
  name: string;
  description: string;
  inputSchema: z.ZodSchema<TArgs>;
  handler: (args: TArgs) => Promise<ToolResult<TResult>>;
  category: ToolCategory;
  version: string;
  deprecated?: boolean;
  author?: string;
  tags?: string[];
}

/**
 * Tool registry for managing all tools
 */
export interface ToolRegistry {
  register(tool: MCPTool): void;
  unregister(name: string): void;
  get(name: string): MCPTool | undefined;
  list(category?: ToolCategory): MCPTool[];
  listAll(): MCPTool[];
}

// ============================================================================
// Configuration Types
// ============================================================================

/**
 * Server configuration
 */
export interface ServerConfig {
  name: string;
  version: string;
  log_level: 'error' | 'warn' | 'info' | 'debug';
  environment: 'development' | 'production' | 'test';
}

/**
 * Logging configuration
 */
export interface LoggingConfig {
  format: 'json' | 'text';
  output: 'stdout' | 'file' | 'both';
  file?: string;
  level: 'error' | 'warn' | 'info' | 'debug';
  include_timestamp: boolean;
  include_level: boolean;
}

/**
 * Filesystem tool configuration
 */
export interface FilesystemConfig {
  enabled: boolean;
  max_file_size: string;
  allowed_paths: string[];
  denied_paths: string[];
  watch_enabled: boolean;
  watch_debounce: number;
}

/**
 * HTTP tool configuration
 */
export interface HttpConfig {
  enabled: boolean;
  timeout: number;
  max_redirects: number;
  user_agent: string;
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

/**
 * Git tool configuration
 */
export interface GitConfig {
  enabled: boolean;
  default_branch: string;
  ssh_key_path: string;
  ssh_key_passphrase?: string;
  github: {
    token?: string;
    api_url: string;
  };
  gitlab: {
    token?: string;
    api_url: string;
  };
  bitbucket: {
    username?: string;
    app_password?: string;
    api_url: string;
  };
}

/**
 * Database tool configuration
 */
export interface DatabaseConfig {
  enabled: boolean;
  default_connection: 'postgresql' | 'mysql' | 'sqlite' | 'sqlserver' | 'mongodb';
  pool_size: number;
  pool_min: number;
  connection_timeout: number;
  postgresql: {
    host: string;
    port: number;
    database: string;
    user: string;
    password: string;
    ssl: boolean;
  };
  mysql: {
    host: string;
    port: number;
    database: string;
    user: string;
    password: string;
    ssl: boolean;
  };
  sqlite: {
    path: string;
    mode: string;
  };
  sqlserver: {
    host: string;
    port: number;
    database: string;
    user: string;
    password: string;
    encrypt: boolean;
  };
  mongodb: {
    uri: string;
    user?: string;
    password?: string;
    auth_source: string;
    ssl: boolean;
  };
}

/**
 * System tool configuration
 */
export interface SystemConfig {
  enabled: boolean;
  allow_shell_commands: boolean;
  max_execution_time: number;
  allowed_commands: string[];
  denied_commands: string[];
  process_monitoring: boolean;
  service_management: boolean;
}

/**
 * AI tool configuration
 */
export interface AIConfig {
  enabled: boolean;
  default_provider: 'anthropic' | 'openai';
  max_tokens: number;
  temperature: number;
  top_p: number;
  stream: boolean;
  anthropic: {
    api_key?: string;
    model: string;
    max_tokens: number;
    temperature: number;
    api_url: string;
  };
  openai: {
    api_key?: string;
    model: string;
    max_tokens: number;
    temperature: number;
    api_url: string;
  };
  embeddings: {
    provider: 'openai' | 'anthropic';
    model: string;
    dimensions: number;
    api_url: string;
  };
  vector_store: {
    type: 'local' | 'pinecone' | 'weaviate';
    path: string;
    pinecone_api_key?: string;
    pinecone_environment?: string;
    weaviate_url?: string;
    weaviate_api_key?: string;
  };
}

/**
 * Security configuration
 */
export interface SecurityConfig {
  enable_rate_limiting: boolean;
  rate_limit_requests: number;
  rate_limit_window: number;
  enable_audit_log: boolean;
  audit_log_path: string;
  encrypt_secrets: boolean;
  secret_key?: string;
}

/**
 * Performance configuration
 */
export interface PerformanceConfig {
  cache_enabled: boolean;
  cache_ttl: number;
  cache_max_size: number;
  concurrent_requests: number;
  enable_compression: boolean;
  enable_minification: boolean;
}

/**
 * Monitoring configuration
 */
export interface MonitoringConfig {
  enabled: boolean;
  metrics_enabled: boolean;
  metrics_port: number;
  tracing_enabled: boolean;
  tracing_exporter: 'jaeger' | 'zipkin' | 'otlp';
  tracing_endpoint?: string;
}

/**
 * Development configuration
 */
export interface DevelopmentConfig {
  hot_reload: boolean;
  debug_mode: boolean;
  test_mode: boolean;
  mock_external_services: boolean;
}

/**
 * Tools configuration (all tool configs)
 */
export interface ToolsConfig {
  filesystem: FilesystemConfig;
  http: HttpConfig;
  git: GitConfig;
  database: DatabaseConfig;
  system: SystemConfig;
  ai: AIConfig;
}

/**
 * Complete Nexus configuration
 */
export interface NexusConfig {
  server: ServerConfig;
  logging: LoggingConfig;
  tools: ToolsConfig;
  security: SecurityConfig;
  performance: PerformanceConfig;
  monitoring: MonitoringConfig;
  development: DevelopmentConfig;
}

// ============================================================================
// Error Types
// ============================================================================

/**
 * Error types for categorization
 */
export enum ErrorType {
  VALIDATION_ERROR = 'validation_error',
  TOOL_ERROR = 'tool_error',
  SYSTEM_ERROR = 'system_error',
  TIMEOUT_ERROR = 'timeout_error',
  PERMISSION_ERROR = 'permission_error',
  NETWORK_ERROR = 'network_error',
  DATABASE_ERROR = 'database_error',
  FILESYSTEM_ERROR = 'filesystem_error',
  GIT_ERROR = 'git_error',
  AI_ERROR = 'ai_error'
}

/**
 * Error codes for specific error scenarios
 */
export enum ErrorCode {
  // Validation errors
  INVALID_INPUT = 'INVALID_INPUT',
  MISSING_REQUIRED_FIELD = 'MISSING_REQUIRED_FIELD',
  INVALID_TYPE = 'INVALID_TYPE',
  INVALID_FORMAT = 'INVALID_FORMAT',
  
  // Filesystem errors
  FILE_NOT_FOUND = 'FILE_NOT_FOUND',
  FILE_ALREADY_EXISTS = 'FILE_ALREADY_EXISTS',
  PERMISSION_DENIED = 'PERMISSION_DENIED',
  PATH_NOT_ALLOWED = 'PATH_NOT_ALLOWED',
  FILE_TOO_LARGE = 'FILE_TOO_LARGE',
  DIRECTORY_NOT_EMPTY = 'DIRECTORY_NOT_EMPTY',
  
  // HTTP errors
  INVALID_URL = 'INVALID_URL',
  HTTP_REQUEST_FAILED = 'HTTP_REQUEST_FAILED',
  TIMEOUT = 'TIMEOUT',
  TOO_MANY_REDIRECTS = 'TOO_MANY_REDIRECTS',
  
  // Git errors
  GIT_NOT_INITIALIZED = 'GIT_NOT_INITIALIZED',
  GIT_COMMAND_FAILED = 'GIT_COMMAND_FAILED',
  GIT_REMOTE_ERROR = 'GIT_REMOTE_ERROR',
  GIT_CONFLICT = 'GIT_CONFLICT',
  
  // Database errors
  DATABASE_CONNECTION_FAILED = 'DATABASE_CONNECTION_FAILED',
  DATABASE_QUERY_FAILED = 'DATABASE_QUERY_FAILED',
  DATABASE_TRANSACTION_FAILED = 'DATABASE_TRANSACTION_FAILED',
  
  // System errors
  COMMAND_NOT_ALLOWED = 'COMMAND_NOT_ALLOWED',
  COMMAND_FAILED = 'COMMAND_FAILED',
  PROCESS_TIMEOUT = 'PROCESS_TIMEOUT',
  
  // AI errors
  AI_API_ERROR = 'AI_API_ERROR',
  AI_RATE_LIMIT = 'AI_RATE_LIMIT',
  AI_INVALID_MODEL = 'AI_INVALID_MODEL',
  
  // Generic errors
  UNKNOWN_ERROR = 'UNKNOWN_ERROR',
  NOT_IMPLEMENTED = 'NOT_IMPLEMENTED'
}

/**
 * Custom Nexus error with structured information
 */
export class NexusError extends Error {
  constructor(
    message: string,
    public code: ErrorCode,
    public type: ErrorType,
    public recoverable: boolean = true,
    public context?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'NexusError';
  }

  /**
   * Convert error to JSON for logging/serialization
   */
  toJSON(): Record<string, unknown> {
    return {
      name: this.name,
      message: this.message,
      code: this.code,
      type: this.type,
      recoverable: this.recoverable,
      context: this.context,
      stack: this.stack
    };
  }
}

/**
 * Error handler result
 */
export interface ErrorHandlingResult {
  handled: boolean;
  error?: NexusError;
  shouldRetry: boolean;
  retryDelay?: number;
}

// ============================================================================
// Filesystem Tool Types
// ============================================================================

/**
 * Read file arguments
 */
export interface ReadFileArgs {
  path: string;
  encoding?: 'utf8' | 'base64' | 'ascii';
  offset?: number;
  limit?: number;
}

/**
 * Write file arguments
 */
export interface WriteFileArgs {
  path: string;
  content: string;
  encoding?: 'utf8' | 'base64' | 'ascii';
  createDirs?: boolean;
  overwrite?: boolean;
}

/**
 * List directory arguments
 */
export interface ListDirectoryArgs {
  path: string;
  recursive?: boolean;
  includeHidden?: boolean;
  maxDepth?: number;
}

/**
 * Search files arguments
 */
export interface SearchFilesArgs {
  directory: string;
  pattern: string;
  recursive?: boolean;
  maxResults?: number;
}

/**
 * File information
 */
export interface FileInfo {
  path: string;
  size: number;
  created: Date;
  modified: Date;
  accessed: Date;
  isDirectory: boolean;
  isFile: boolean;
  permissions?: string;
  owner?: string;
}

// ============================================================================
// HTTP Tool Types
// ============================================================================

/**
 * HTTP request arguments
 */
export interface HttpRequestArgs {
  url: string;
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  headers?: Record<string, string>;
  body?: unknown;
  params?: Record<string, string>;
  timeout?: number;
  followRedirects?: boolean;
  maxRedirects?: number;
}

/**
 * HTTP response
 */
export interface HttpResponse {
  status: number;
  statusText: string;
  headers: Record<string, string>;
  data: unknown;
  duration: number;
}

/**
 * Webhook arguments
 */
export interface WebhookSendArgs {
  url: string;
  payload: unknown;
  headers?: Record<string, string>;
  signature?: string;
  retries?: number;
}

// ============================================================================
// Git Tool Types
// ============================================================================

/**
 * Git repository arguments
 */
export interface GitRepoArgs {
  path: string;
}

/**
 * Git clone arguments
 */
export interface GitCloneArgs {
  url: string;
  path: string;
  branch?: string;
  depth?: number;
}

/**
 * Git commit arguments
 */
export interface GitCommitArgs {
  path: string;
  message: string;
  files?: string[];
  amend?: boolean;
}

/**
 * Git branch arguments
 */
export interface GitBranchArgs {
  path: string;
  name: string;
  startPoint?: string;
}

/**
 * Pull request arguments
 */
export interface PullRequestArgs {
  path: string;
  title: string;
  description?: string;
  head: string;
  base: string;
  provider: 'github' | 'gitlab' | 'bitbucket';
}

// ============================================================================
// Database Tool Types
// ============================================================================

/**
 * Database query arguments
 */
export interface DbQueryArgs {
  connection?: string;
  query: string;
  params?: unknown[];
  timeout?: number;
}

/**
 * Database table information
 */
export interface TableInfo {
  name: string;
  columns: ColumnInfo[];
  indexes: IndexInfo[];
  rowCount?: number;
}

/**
 * Column information
 */
export interface ColumnInfo {
  name: string;
  type: string;
  nullable: boolean;
  defaultValue?: unknown;
  primaryKey: boolean;
  foreignKey?: {
    table: string;
    column: string;
  };
}

/**
 * Index information
 */
export interface IndexInfo {
  name: string;
  columns: string[];
  unique: boolean;
}

/**
 * MongoDB query arguments
 */
export interface MongoQueryArgs {
  connection?: string;
  collection: string;
  query: Record<string, unknown>;
  projection?: Record<string, unknown>;
  sort?: Record<string, unknown>;
  limit?: number;
  skip?: number;
}

// ============================================================================
// System Tool Types
// ============================================================================

/**
 * Execute command arguments
 */
export interface ExecCommandArgs {
  command: string;
  cwd?: string;
  env?: Record<string, string>;
  timeout?: number;
  background?: boolean;
}

/**
 * System information
 */
export interface SystemInfo {
  os: {
    platform: string;
    arch: string;
    version: string;
  };
  cpu: {
    model: string;
    cores: number;
    speed: number;
  };
  memory: {
    total: number;
    free: number;
    used: number;
  };
  uptime: number;
}

/**
 * Process information
 */
export interface ProcessInfo {
  pid: number;
  name: string;
  cpu: number;
  memory: number;
  uptime: number;
}

// ============================================================================
// AI Tool Types
// ============================================================================

/**
 * LLM chat message
 */
export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

/**
 * LLM chat arguments
 */
export interface LlmChatArgs {
  provider: 'anthropic' | 'openai';
  model?: string;
  messages: ChatMessage[];
  maxTokens?: number;
  temperature?: number;
  topP?: number;
  stream?: boolean;
}

/**
 * LLM response
 */
export interface LlmResponse {
  content: string;
  model: string;
  tokensUsed: {
    prompt: number;
    completion: number;
    total: number;
  };
  finishReason: string;
}

/**
 * Embedding arguments
 */
export interface EmbeddingArgs {
  provider: 'openai' | 'anthropic';
  model?: string;
  text: string;
}

/**
 * Embedding response
 */
export interface EmbeddingResponse {
  embedding: number[];
  dimensions: number;
  model: string;
}

/**
 * Vector search arguments
 */
export interface VectorSearchArgs {
  query: string;
  topK?: number;
  filter?: Record<string, unknown>;
}

/**
 * Vector search result
 */
export interface VectorSearchResult {
  id: string;
  score: number;
  metadata?: Record<string, unknown>;
}

// ============================================================================
// Utility Tool Types
// ============================================================================

/**
 * JSON parse arguments
 */
export interface JsonParseArgs {
  json: string;
  reviver?: (key: string, value: unknown) => unknown;
}

/**
 * JSON stringify arguments
 */
export interface JsonStringifyArgs {
  value: unknown;
  space?: string | number;
  replacer?: (key: string, value: unknown) => unknown;
}

/**
 * Date format arguments
 */
export interface DateFormatArgs {
  date: string | Date;
  format: string;
  timezone?: string;
}

/**
 * Hash create arguments
 */
export interface HashArgs {
  algorithm: 'md5' | 'sha1' | 'sha256' | 'sha512';
  data: string;
  encoding?: 'utf8' | 'base64' | 'hex';
}

/**
 * Encrypt arguments
 */
export interface EncryptArgs {
  algorithm: 'aes-256-cbc' | 'aes-256-gcm';
  data: string;
  key: string;
  iv?: string;
}

/**
 * Decrypt arguments
 */
export interface DecryptArgs {
  algorithm: 'aes-256-cbc' | 'aes-256-gcm';
  data: string;
  key: string;
  iv?: string;
}

// ============================================================================
// MCP Protocol Types
// ============================================================================

/**
 * MCP request
 */
export interface MCPRequest {
  jsonrpc: '2.0';
  id: string | number;
  method: string;
  params?: unknown;
}

/**
 * MCP response
 */
export interface MCPResponse {
  jsonrpc: '2.0';
  id: string | number;
  result?: unknown;
  error?: {
    code: number;
    message: string;
    data?: unknown;
  };
}

/**
 * MCP tool definition for protocol
 */
export interface MCPToolDefinition {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
}

// ============================================================================
// Export all types
// ============================================================================
// All types are already exported with export interface/export enum/export class declarations above
// No additional export type statements needed
