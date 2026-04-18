# Configuration Guide

This guide explains how to configure Nexus-MCP for different use cases.

## Configuration Overview

Nexus-MCP can be configured through:

1. **Environment Variables** (`.env` file)
2. **YAML Configuration File** (`config/config.yaml`)
3. **Command-line Arguments** (CLI)
4. **Programmatic Configuration** (TypeScript API)

## Environment Variables

### Server Configuration

```env
# Server Configuration
NODE_ENV=development|production
LOG_LEVEL=error|warn|info|debug
SERVER_PORT=3000
```

### Filesystem Configuration

```env
# Filesystem Tools
ALLOWED_PATHS=/tmp,/home/user,/workspace
MAX_FILE_SIZE=104857600
MAX_DIRECTORY_DEPTH=10
```

### HTTP Configuration

```env
# HTTP Tools
HTTP_TIMEOUT=30000
HTTP_MAX_REDIRECTS=5
HTTP_USER_AGENT=Nexus-MCP/1.0
HTTP_PROXY_HOST=
HTTP_PROXY_PORT=8080
```

### Git Configuration

```env
# Git Tools
GIT_DEFAULT_BRANCH=main
GIT_COMMIT_MESSAGE_TEMPLATE=
GIT_AUTHOR_NAME=
GIT_AUTHOR_EMAIL=
```

### System Configuration

```env
# System Tools
SYSTEM_ALLOW_SHELL_COMMANDS=true
SYSTEM_MAX_EXECUTION_TIME=60000
SYSTEM_ALLOWED_COMMANDS=ls,cd,cat,grep,find
SYSTEM_DENIED_COMMANDS=rm,dd,format,mkfs,fdisk
```

## YAML Configuration

Create `config/config.yaml`:

```yaml
server:
  name: nexus-mcp
  version: 1.0.0-alpha
  environment: development
  log_level: info

tools:
  filesystem:
    enabled: true
    allowed_paths:
      - /tmp
      - /home/user
      - /workspace
    max_file_size: 104857600
    max_directory_depth: 10
    allow_symbolic_links: false
  
  http:
    enabled: true
    timeout: 30000
    max_redirects: 5
    user_agent: Nexus-MCP/1.0
    allowed_domains: []
    denied_domains: []
    proxy:
      host: ""
      port: 8080
      username: ""
      password: ""
    cache:
      enabled: true
      ttl: 300000
  
  git:
    enabled: true
    default_branch: main
    auto_commit: false
    author_name: ""
    author_email: ""
    ssh_key_path: ""
  
  system:
    enabled: true
    allow_shell_commands: true
    max_execution_time: 60000
    allowed_commands:
      - ls
      - cd
      - cat
      - grep
      - find
    denied_commands:
      - rm
      - dd
      - format
      - mkfs
      - fdisk
    process_monitoring: true
    service_management: false

logging:
  level: info
  format: json
  output: stdout
  file: logs/nexus.log
  max_size: 10485760
  max_files: 5

performance:
  cache_enabled: true
  cache_ttl: 300000
  max_concurrent_requests: 10

monitoring:
  enabled: false
  metrics_port: 9090
  health_check_interval: 30000
```

## Command-line Arguments

### CLI Commands

```bash
# Start server with custom config
nexus-mcp start --config /path/to/config.yaml

# Start with custom log level
nexus-mcp start --log-level debug

# Run as daemon
nexus-mcp start --daemon
```

### Environment Override

```bash
# Override environment variables
NODE_ENV=production LOG_LEVEL=error npm start
```

## Programmatic Configuration

You can configure Nexus-MCP programmatically in TypeScript:

```typescript
import { NexusMCPServer } from '@nexus-mcp/server';

const server = new NexusMCPServer({
  server: {
    name: 'my-nexus',
    environment: 'production',
    logLevel: 'info'
  },
  tools: {
    filesystem: {
      enabled: true,
      allowedPaths: ['/tmp', '/workspace']
    },
    http: {
      enabled: true,
      timeout: 30000
    }
  }
});

await server.initialize();
await server.start();
```

## Security Configuration

### Path Restrictions

Restrict filesystem access to specific directories:

```yaml
tools:
  filesystem:
    allowed_paths:
      - /tmp
      - /workspace
    denied_paths:
      - /etc
      - /root
      - /system
```

### Command Restrictions

Restrict which shell commands can be executed:

```yaml
tools:
  system:
    allowed_commands:
      - ls
      - cd
      - cat
      - grep
    denied_commands:
      - rm
      - dd
      - format
      - mkfs
```

### Domain Restrictions

Restrict HTTP requests to specific domains:

```yaml
tools:
  http:
    allowed_domains:
      - api.example.com
      - cdn.example.com
    denied_domains:
      - malicious.com
      - phishing.com
```

## Performance Configuration

### Caching

Enable caching for improved performance:

```yaml
performance:
  cache_enabled: true
  cache_ttl: 300000  # 5 minutes
```

### Concurrency

Limit concurrent requests:

```yaml
performance:
  max_concurrent_requests: 10
```

## Monitoring Configuration

Enable metrics and health checks:

```yaml
monitoring:
  enabled: true
  metrics_port: 9090
  health_check_interval: 30000
```

Access metrics at `http://localhost:9090/metrics`

## Development Configuration

For development, enable debug mode:

```yaml
server:
  environment: development
  log_level: debug

performance:
  cache_enabled: false  # Disable cache in development
```

## Production Configuration

For production, enable security and monitoring:

```yaml
server:
  environment: production
  log_level: warn

monitoring:
  enabled: true

tools:
  filesystem:
    allowed_paths:
      - /var/www
      - /tmp
```

## Configuration Validation

Nexus-MCP validates configuration on startup using Zod schemas. Invalid configuration will prevent the server from starting.

### Common Validation Errors

**Error**: `allowed_paths must be an array of strings`
**Solution**: Check your YAML syntax and ensure paths are quoted strings.

**Error**: `timeout must be a positive number`
**Solution**: Ensure timeout values are numbers, not strings.

## Troubleshooting

### Configuration Not Loading

```bash
# Check if config file exists
ls -la config/config.yaml

# Validate YAML syntax
npm run validate-config
```

### Environment Variables Not Working

```bash
# Check if .env file exists
ls -la .env

# Verify environment variables
printenv | grep NEXUS
```

## Best Practices

1. **Use environment variables for secrets** (API keys, passwords)
2. **Use YAML for structural configuration** (paths, timeouts, flags)
3. **Separate development and production configs**
4. **Validate configuration before deployment**
5. **Document custom configurations**
6. **Use version control for config files** (excluding secrets)

## Next Steps

- [Installation Guide](./installation.md)
- [API Reference](./api-reference.md)
- [Tools Reference](./tools-reference.md)
