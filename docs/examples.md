# Examples and Tutorials

This guide provides practical examples and tutorials for using Nexus-MCP.

## Example 1: Basic File Operations

### Reading a File

```typescript
import { NexusMCPServer } from '@nexus-mcp/server';

const server = new NexusMCPServer();
await server.initialize();

// Read a file
const result = await server.callTool('nexus_read_file', {
  path: '/path/to/file.txt',
  encoding: 'utf-8'
});

console.log(result.content);
```

### Writing a File

```typescript
// Write a file
await server.callTool('nexus_write_file', {
  path: '/path/to/file.txt',
  content: 'Hello, World!',
  encoding: 'utf-8',
  createDirs: true
});
```

### Listing a Directory

```typescript
// List directory contents
const result = await server.callTool('nexus_list_directory', {
  path: '/path/to/directory',
  recursive: false,
  includeHidden: false
});

console.log(result.files);
```

## Example 2: HTTP Requests

### GET Request

```typescript
// Make a GET request
const result = await server.callTool('nexus_http_get', {
  url: 'https://api.example.com/data',
  headers: {
    'Authorization': 'Bearer token'
  }
});

console.log(result.data);
```

### POST Request

```typescript
// Make a POST request
const result = await server.callTool('nexus_http_post', {
  url: 'https://api.example.com/create',
  headers: {
    'Content-Type': 'application/json'
  },
  body: {
    name: 'Example',
    value: 123
  }
});

console.log(result.data);
```

### Web Scraping

```typescript
// Scrape a website
const result = await server.callTool('nexus_parse_html', {
  url: 'https://example.com',
  selectors: {
    title: 'h1',
    links: 'a'
  }
});

console.log(result.parsed);
```

## Example 3: Git Operations

### Cloning a Repository

```typescript
// Clone a repository
const result = await server.callTool('nexus_git_clone', {
  url: 'https://github.com/user/repo.git',
  path: '/path/to/clone',
  branch: 'main'
});

console.log(result.success);
```

### Creating a Commit

```typescript
// Create a commit
const result = await server.callTool('nexus_git_commit', {
  path: '/path/to/repo',
  message: 'Add new feature',
  files: ['file1.txt', 'file2.txt']
});

console.log(result.commitHash);
```

### Creating a Branch

```typescript
// Create a new branch
const result = await server.callTool('nexus_git_branch', {
  path: '/path/to/repo',
  name: 'feature/new-feature',
  base: 'main'
});

console.log(result.success);
```

## Example 4: System Information

### Get System Info

```typescript
// Get system information
const result = await server.callTool('nexus_system_info', {
  include: ['platform', 'arch', 'hostname', 'memory']
});

console.log(result);
```

### Execute a Command

```typescript
// Execute a shell command
const result = await server.callTool('nexus_execute_command', {
  command: 'ls -la',
  cwd: '/path/to/directory',
  timeout: 30000
});

console.log(result.stdout);
```

### List Processes

```typescript
// List running processes
const result = await server.callTool('nexus_list_processes', {
  filter: 'node'
});

console.log(result.processes);
```

## Example 5: Utilities

### Parse JSON

```typescript
// Parse JSON string
const result = await server.callTool('nexus_json_parse', {
  json: '{"name": "test", "value": 123}'
});

console.log(result.parsed);
```

### Generate UUID

```typescript
// Generate a UUID
const result = await server.callTool('nexus_uuid_generate', {});

console.log(result.uuid);
```

### Hash Generation

```typescript
// Generate SHA256 hash
const result = await server.callTool('nexus_hash_generate', {
  algorithm: 'sha256',
  data: 'test data'
});

console.log(result.hash);
```

## Example 6: Complete Workflow

### File Processing Pipeline

```typescript
import { NexusMCPServer } from '@nexus-mcp/server';

const server = new NexusMCPServer();
await server.initialize();

async function processFiles(inputDir: string, outputDir: string) {
  // 1. List files in input directory
  const listResult = await server.callTool('nexus_list_directory', {
    path: inputDir,
    recursive: true
  });

  // 2. Process each file
  for (const file of listResult.files) {
    // Read file
    const readResult = await server.callTool('nexus_read_file', {
      path: file.path
    });

    // Process content (example: convert to uppercase)
    const processedContent = readResult.content.toUpperCase();

    // Write to output directory
    const outputPath = file.path.replace(inputDir, outputDir);
    await server.callTool('nexus_write_file', {
      path: outputPath,
      content: processedContent,
      createDirs: true
    });
  }

  console.log('Processing complete!');
}

processFiles('/input', '/output');
```

### Git Workflow

```typescript
async function gitWorkflow(repoPath: string, featureName: string) {
  // 1. Create feature branch
  await server.callTool('nexus_git_branch', {
    path: repoPath,
    name: featureName,
    base: 'main'
  });

  // 2. Make changes to files
  await server.callTool('nexus_write_file', {
    path: `${repoPath}/new-feature.txt`,
    content: 'New feature content',
    createDirs: true
  });

  // 3. Commit changes
  await server.callTool('nexus_git_commit', {
    path: repoPath,
    message: `Add ${featureName}`,
    files: ['new-feature.txt']
  });

  // 4. Push to remote
  await server.callTool('nexus_git_push', {
    path: repoPath,
    remote: 'origin',
    branch: featureName
  });

  console.log('Git workflow complete!');
}

gitWorkflow('/path/to/repo', 'feature/new-feature');
```

### API Integration

```typescript
async function apiIntegration() {
  // 1. Fetch data from API
  const fetchResult = await server.callTool('nexus_http_get', {
    url: 'https://api.example.com/users',
    headers: {
      'Authorization': 'Bearer token'
    }
  });

  // 2. Process data
  const users = fetchResult.data;
  const processedUsers = users.map(user => ({
    id: user.id,
    name: user.name.toUpperCase()
  }));

  // 3. Save to file
  await server.callTool('nexus_write_file', {
    path: '/output/users.json',
    content: JSON.stringify(processedUsers, null, 2),
    createDirs: true
  });

  console.log('API integration complete!');
}

apiIntegration();
```

## Example 7: Error Handling

### Handling File Not Found

```typescript
try {
  const result = await server.callTool('nexus_read_file', {
    path: '/nonexistent/file.txt'
  });
} catch (error) {
  if (error.code === 'ENOENT') {
    console.log('File not found, creating new file...');
    await server.callTool('nexus_write_file', {
      path: '/nonexistent/file.txt',
      content: 'Default content',
      createDirs: true
    });
  } else {
    console.error('Unexpected error:', error);
  }
}
```

### Handling HTTP Errors

```typescript
try {
  const result = await server.callTool('nexus_http_get', {
    url: 'https://api.example.com/data'
  });
} catch (error) {
  if (error.status === 404) {
    console.log('Resource not found');
  } else if (error.status === 500) {
    console.log('Server error');
  } else {
    console.error('HTTP error:', error);
  }
}
```

## Example 8: Configuration

### Custom Configuration

```typescript
const server = new NexusMCPServer({
  server: {
    name: 'my-nexus',
    environment: 'production',
    logLevel: 'info'
  },
  tools: {
    filesystem: {
      enabled: true,
      allowedPaths: ['/workspace', '/tmp']
    },
    http: {
      enabled: true,
      timeout: 30000,
      maxRedirects: 5
    }
  }
});

await server.initialize();
```

### Environment-Specific Configuration

```typescript
const config = {
  server: {
    name: 'nexus-mcp',
    environment: process.env.NODE_ENV || 'development',
    logLevel: process.env.LOG_LEVEL || 'info'
  },
  tools: {
    filesystem: {
      allowedPaths: process.env.ALLOWED_PATHS?.split(',') || ['/tmp']
    }
  }
};

const server = new NexusMCPServer(config);
await server.initialize();
```

## Example 9: Integration with Claude Desktop

### Configuration

Add to `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "nexus-mcp": {
      "command": "node",
      "args": ["/path/to/Nexus-MCP/dist/index.js"],
      "env": {
        "NODE_ENV": "production",
        "ALLOWED_PATHS": "/workspace,/tmp"
      }
    }
  }
}
```

### Usage in Claude

Once configured, you can use Nexus-MCP tools directly in Claude:

```
User: Read the file /workspace/config.json and update the timeout value
Claude: I'll read the file and update it for you.
[Uses nexus_read_file and nexus_write_file]
```

## Example 10: Advanced Patterns

### Batch Processing

```typescript
async function batchProcessing(files: string[], processor: (content: string) => string) {
  const results = await Promise.all(
    files.map(async (file) => {
      const readResult = await server.callTool('nexus_read_file', { path: file });
      const processed = processor(readResult.content);
      await server.callTool('nexus_write_file', {
        path: file,
        content: processed
      });
      return { file, success: true };
    })
  );

  return results;
}

const files = ['/file1.txt', '/file2.txt', '/file3.txt'];
const results = await batchProcessing(files, content => content.toUpperCase());
```

### Retry Pattern

```typescript
async function retryWithBackoff(fn, maxRetries = 3) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error) {
      if (i === maxRetries - 1) throw error;
      const delay = Math.pow(2, i) * 1000; // Exponential backoff
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
}

const result = await retryWithBackoff(() => 
  server.callTool('nexus_http_get', { url: 'https://api.example.com/data' })
);
```

## Next Steps

- [API Reference](./api-reference.md)
- [Tools Reference](./tools-reference.md)
- [Configuration Guide](./configuration.md)
