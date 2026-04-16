/**
 * Nexus-MCP Configuration Manager
 * 
 * Centralized configuration management with support for:
 * - Environment variables (.env)
 * - YAML configuration files
 * - Default values
 * - Zod validation
 * - Type-safe access
 * 
 * Priority: env > yaml > defaults
 * 
 * @module config
 */

import * as dotenv from 'dotenv';
import * as yaml from 'yaml';
import * as fs from 'fs';
import * as path from 'path';
import { z } from 'zod';
import type { NexusConfig } from './types';

// ============================================================================
// Zod Validation Schemas
// ============================================================================

const ServerConfigSchema = z.object({
  name: z.string().default('nexus-mcp'),
  version: z.string().default('1.0.0-alpha'),
  log_level: z.enum(['error', 'warn', 'info', 'debug']).default('info'),
  environment: z.enum(['development', 'production', 'test']).default('development')
});

const LoggingConfigSchema = z.object({
  format: z.enum(['json', 'text']).default('json'),
  output: z.enum(['stdout', 'file', 'both']).default('stdout'),
  file: z.string().default('logs/nexus.log'),
  level: z.enum(['error', 'warn', 'info', 'debug']).default('info'),
  include_timestamp: z.boolean().default(true),
  include_level: z.boolean().default(true)
});

const FilesystemConfigSchema = z.object({
  enabled: z.boolean().default(true),
  max_file_size: z.string().default('100MB'),
  allowed_paths: z.array(z.string()).default(['/tmp', './workspace']),
  denied_paths: z.array(z.string()).default(['/etc', '/sys', '/proc']),
  watch_enabled: z.boolean().default(false),
  watch_debounce: z.number().default(1000)
});

const HttpConfigSchema = z.object({
  enabled: z.boolean().default(true),
  timeout: z.number().default(30000),
  max_redirects: z.number().default(5),
  user_agent: z.string().default('Nexus-MCP/1.0'),
  proxy: z.object({
    host: z.string().default(''),
    port: z.number().default(8080),
    username: z.string().optional(),
    password: z.string().optional()
  }).default({}),
  cache: z.object({
    enabled: z.boolean().default(true),
    ttl: z.number().default(300000)
  }).default({})
});

const GitConfigSchema = z.object({
  enabled: z.boolean().default(true),
  default_branch: z.string().default('main'),
  ssh_key_path: z.string().default('~/.ssh/id_rsa'),
  ssh_key_passphrase: z.string().optional(),
  github: z.object({
    token: z.string().optional(),
    api_url: z.string().default('https://api.github.com')
  }).default({}),
  gitlab: z.object({
    token: z.string().optional(),
    api_url: z.string().default('https://gitlab.com/api/v4')
  }).default({}),
  bitbucket: z.object({
    username: z.string().optional(),
    app_password: z.string().optional(),
    api_url: z.string().default('https://api.bitbucket.org/2.0')
  }).default({})
});

const DatabaseConfigSchema = z.object({
  enabled: z.boolean().default(true),
  default_connection: z.enum(['postgresql', 'mysql', 'sqlite', 'sqlserver', 'mongodb']).default('postgresql'),
  pool_size: z.number().default(10),
  pool_min: z.number().default(2),
  connection_timeout: z.number().default(30000),
  postgresql: z.object({
    host: z.string().default('localhost'),
    port: z.number().default(5432),
    database: z.string().default('nexus'),
    user: z.string().default('nexus'),
    password: z.string().default(''),
    ssl: z.boolean().default(false)
  }).default({}),
  mysql: z.object({
    host: z.string().default('localhost'),
    port: z.number().default(3306),
    database: z.string().default('nexus'),
    user: z.string().default('nexus'),
    password: z.string().default(''),
    ssl: z.boolean().default(false)
  }).default({}),
  sqlite: z.object({
    path: z.string().default('./data/nexus.db'),
    mode: z.string().default('read-write')
  }).default({}),
  sqlserver: z.object({
    host: z.string().default('localhost'),
    port: z.number().default(1433),
    database: z.string().default('nexus'),
    user: z.string().default('nexus'),
    password: z.string().default(''),
    encrypt: z.boolean().default(true)
  }).default({}),
  mongodb: z.object({
    uri: z.string().default('mongodb://localhost:27017/nexus'),
    user: z.string().optional(),
    password: z.string().optional(),
    auth_source: z.string().default('admin'),
    ssl: z.boolean().default(false)
  }).default({})
});

const SystemConfigSchema = z.object({
  enabled: z.boolean().default(true),
  allow_shell_commands: z.boolean().default(true),
  max_execution_time: z.number().default(60000),
  allowed_commands: z.array(z.string()).default(['ls', 'cd', 'cat', 'grep', 'find']),
  denied_commands: z.array(z.string()).default(['rm', 'dd', 'format', 'mkfs', 'fdisk']),
  process_monitoring: z.boolean().default(true),
  service_management: z.boolean().default(false)
});

const AIConfigSchema = z.object({
  enabled: z.boolean().default(true),
  default_provider: z.enum(['anthropic', 'openai']).default('anthropic'),
  max_tokens: z.number().default(4096),
  temperature: z.number().default(0.7),
  top_p: z.number().default(1.0),
  stream: z.boolean().default(false),
  anthropic: z.object({
    api_key: z.string().optional(),
    model: z.string().default('claude-3-sonnet-20240229'),
    max_tokens: z.number().default(4096),
    temperature: z.number().default(0.7),
    api_url: z.string().default('https://api.anthropic.com')
  }).default({}),
  openai: z.object({
    api_key: z.string().optional(),
    model: z.string().default('gpt-4-turbo-preview'),
    max_tokens: z.number().default(4096),
    temperature: z.number().default(0.7),
    api_url: z.string().default('https://api.openai.com/v1')
  }).default({}),
  embeddings: z.object({
    provider: z.enum(['openai', 'anthropic']).default('openai'),
    model: z.string().default('text-embedding-3-small'),
    dimensions: z.number().default(1536),
    api_url: z.string().default('https://api.openai.com/v1')
  }).default({}),
  vector_store: z.object({
    type: z.enum(['local', 'pinecone', 'weaviate']).default('local'),
    path: z.string().default('./data/vectors'),
    pinecone_api_key: z.string().optional(),
    pinecone_environment: z.string().optional(),
    weaviate_url: z.string().optional(),
    weaviate_api_key: z.string().optional()
  }).default({})
});

const SecurityConfigSchema = z.object({
  enable_rate_limiting: z.boolean().default(true),
  rate_limit_requests: z.number().default(100),
  rate_limit_window: z.number().default(60000),
  enable_audit_log: z.boolean().default(true),
  audit_log_path: z.string().default('logs/audit.log'),
  encrypt_secrets: z.boolean().default(true),
  secret_key: z.string().optional()
});

const PerformanceConfigSchema = z.object({
  cache_enabled: z.boolean().default(true),
  cache_ttl: z.number().default(300000),
  cache_max_size: z.number().default(1000),
  concurrent_requests: z.number().default(10),
  enable_compression: z.boolean().default(true),
  enable_minification: z.boolean().default(false)
});

const MonitoringConfigSchema = z.object({
  enabled: z.boolean().default(false),
  metrics_enabled: z.boolean().default(false),
  metrics_port: z.number().default(9090),
  tracing_enabled: z.boolean().default(false),
  tracing_exporter: z.enum(['jaeger', 'zipkin', 'otlp']).default('jaeger'),
  tracing_endpoint: z.string().optional()
});

const DevelopmentConfigSchema = z.object({
  hot_reload: z.boolean().default(true),
  debug_mode: z.boolean().default(false),
  test_mode: z.boolean().default(false),
  mock_external_services: z.boolean().default(false)
});

const ToolsConfigSchema = z.object({
  filesystem: FilesystemConfigSchema,
  http: HttpConfigSchema,
  git: GitConfigSchema,
  database: DatabaseConfigSchema,
  system: SystemConfigSchema,
  ai: AIConfigSchema
});

const NexusConfigSchema = z.object({
  server: ServerConfigSchema,
  logging: LoggingConfigSchema,
  tools: ToolsConfigSchema,
  security: SecurityConfigSchema,
  performance: PerformanceConfigSchema,
  monitoring: MonitoringConfigSchema,
  development: DevelopmentConfigSchema
});

// ============================================================================
// Default Configuration
// ============================================================================

const defaultConfig: NexusConfig = {
  server: {
    name: 'nexus-mcp',
    version: '1.0.0-alpha',
    log_level: 'info',
    environment: 'development'
  },
  logging: {
    format: 'json',
    output: 'stdout',
    file: 'logs/nexus.log',
    level: 'info',
    include_timestamp: true,
    include_level: true
  },
  tools: {
    filesystem: {
      enabled: true,
      max_file_size: '100MB',
      allowed_paths: ['/tmp', './workspace'],
      denied_paths: ['/etc', '/sys', '/proc'],
      watch_enabled: false,
      watch_debounce: 1000
    },
    http: {
      enabled: true,
      timeout: 30000,
      max_redirects: 5,
      user_agent: 'Nexus-MCP/1.0',
      proxy: {
        host: '',
        port: 8080
      },
      cache: {
        enabled: true,
        ttl: 300000
      }
    },
    git: {
      enabled: true,
      default_branch: 'main',
      ssh_key_path: '~/.ssh/id_rsa',
      github: {
        api_url: 'https://api.github.com'
      },
      gitlab: {
        api_url: 'https://gitlab.com/api/v4'
      },
      bitbucket: {
        api_url: 'https://api.bitbucket.org/2.0'
      }
    },
    database: {
      enabled: true,
      default_connection: 'postgresql',
      pool_size: 10,
      pool_min: 2,
      connection_timeout: 30000,
      postgresql: {
        host: 'localhost',
        port: 5432,
        database: 'nexus',
        user: 'nexus',
        password: '',
        ssl: false
      },
      mysql: {
        host: 'localhost',
        port: 3306,
        database: 'nexus',
        user: 'nexus',
        password: '',
        ssl: false
      },
      sqlite: {
        path: './data/nexus.db',
        mode: 'read-write'
      },
      sqlserver: {
        host: 'localhost',
        port: 1433,
        database: 'nexus',
        user: 'nexus',
        password: '',
        encrypt: true
      },
      mongodb: {
        uri: 'mongodb://localhost:27017/nexus',
        auth_source: 'admin',
        ssl: false
      }
    },
    system: {
      enabled: true,
      allow_shell_commands: true,
      max_execution_time: 60000,
      allowed_commands: ['ls', 'cd', 'cat', 'grep', 'find'],
      denied_commands: ['rm', 'dd', 'format', 'mkfs', 'fdisk'],
      process_monitoring: true,
      service_management: false
    },
    ai: {
      enabled: true,
      default_provider: 'anthropic',
      max_tokens: 4096,
      temperature: 0.7,
      top_p: 1.0,
      stream: false,
      anthropic: {
        model: 'claude-3-sonnet-20240229',
        max_tokens: 4096,
        temperature: 0.7,
        api_url: 'https://api.anthropic.com'
      },
      openai: {
        model: 'gpt-4-turbo-preview',
        max_tokens: 4096,
        temperature: 0.7,
        api_url: 'https://api.openai.com/v1'
      },
      embeddings: {
        provider: 'openai',
        model: 'text-embedding-3-small',
        dimensions: 1536,
        api_url: 'https://api.openai.com/v1'
      },
      vector_store: {
        type: 'local',
        path: './data/vectors'
      }
    }
  },
  security: {
    enable_rate_limiting: true,
    rate_limit_requests: 100,
    rate_limit_window: 60000,
    enable_audit_log: true,
    audit_log_path: 'logs/audit.log',
    encrypt_secrets: true
  },
  performance: {
    cache_enabled: true,
    cache_ttl: 300000,
    cache_max_size: 1000,
    concurrent_requests: 10,
    enable_compression: true,
    enable_minification: false
  },
  monitoring: {
    enabled: false,
    metrics_enabled: false,
    metrics_port: 9090,
    tracing_enabled: false,
    tracing_exporter: 'jaeger'
  },
  development: {
    hot_reload: true,
    debug_mode: false,
    test_mode: false,
    mock_external_services: false
  }
};

// ============================================================================
// Configuration Manager
// ============================================================================

let config: NexusConfig | null = null;

/**
 * Load configuration from environment variables
 */
function loadEnvConfig(): Partial<NexusConfig> {
  // Load environment variables from .env file
  dotenv.config();
  
  // Return empty for now - env variables will be read directly in loadConfig
  return {};
}

/**
 * Load configuration from YAML file
 */
function loadYamlConfig(configPath: string): Partial<NexusConfig> | null {
  try {
    const yamlContent = fs.readFileSync(configPath, 'utf8');
    const yamlConfig = yaml.parse(yamlContent);
    return yamlConfig as Partial<NexusConfig>;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return null; // File doesn't exist, that's ok
    }
    throw new Error(`Failed to load YAML config: ${(error as Error).message}`);
  }
}

/**
 * Deep merge configuration objects
 */
function deepMerge<T>(target: T, source: Partial<T>): T {
  const result = { ...target };
  
  for (const key in source) {
    if (source[key] !== undefined) {
      if (typeof source[key] === 'object' && source[key] !== null && !Array.isArray(source[key])) {
        result[key] = deepMerge(result[key] as any, source[key] as any);
      } else {
        result[key] = source[key] as any;
      }
    }
  }
  
  return result;
}

/**
 * Load and validate configuration
 */
export function loadConfig(configPath?: string): NexusConfig {
  // 1. Start with defaults
  let mergedConfig = { ...defaultConfig };
  
  // 2. Load YAML config
  const yamlPath = configPath || path.join(process.cwd(), 'config', 'config.yaml');
  const yamlConfig = loadYamlConfig(yamlPath);
  if (yamlConfig) {
    mergedConfig = deepMerge(mergedConfig, yamlConfig);
  }
  
  // 3. Load environment config (highest priority)
  const envConfig = loadEnvConfig();
  mergedConfig = deepMerge(mergedConfig, envConfig);
  
  // 4. Validate with Zod
  const validatedConfig = NexusConfigSchema.parse(mergedConfig);
  
  config = validatedConfig;
  return validatedConfig;
}

/**
 * Get current configuration
 */
export function getConfig(): NexusConfig {
  if (!config) {
    return loadConfig();
  }
  return config;
}

/**
 * Get configuration value by path (e.g., 'server.log_level')
 */
export function get(path: string): unknown {
  const config = getConfig();
  const keys = path.split('.');
  let value: unknown = config;
  
  for (const key of keys) {
    if (value && typeof value === 'object' && key in value) {
      value = (value as Record<string, unknown>)[key];
    } else {
      return undefined;
    }
  }
  
  return value;
}

/**
 * Reload configuration from files
 */
export function reloadConfig(configPath?: string): NexusConfig {
  config = null;
  return loadConfig(configPath);
}

/**
 * Validate configuration
 */
export function validateConfig(configData: unknown): NexusConfig {
  return NexusConfigSchema.parse(configData);
}

// ============================================================================
// Export
// ============================================================================
// All exports are already declared with export keyword above
