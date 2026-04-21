# MCP Configuration Guide - Connecting AI Assistants to Nexus-MCP

This guide explains how to configure AI assistants (Claude Code, ChatGPT, etc.) to use Nexus-MCP tools via the Model Context Protocol (MCP).

## Overview

Nexus-MCP is an MCP server that exposes 72 tools across 7 categories:
- **Filesystem** (18 tools): Read, write, list, search files
- **HTTP** (16 tools): Make requests, scrape web, APIs
- **Git** (15 tools): Clone, commit, branches, PRs
- **System** (8 tools): Execute commands, manage processes
- **AI** (8 tools): Chat with Ollama, Gemini, OpenAI, Anthropic
- **Utilities** (8 tools): JSON, YAML, compression, encryption
- **External** (8+ tools): Tools from external MCP servers via MCP Gateway

## Architecture

```
AI Assistant (Claude/ChatGPT)
         ↓
    MCP Protocol
         ↓
Nexus-MCP Server
         ↓
    Tool Execution
```

## Step 1: Start the Nexus-MCP Server

```bash
cd D:\Proyectos\GitHub\Nexus-MCP
npm start
```

The server will start and listen for MCP connections via stdio.

## Step 2: Configure Claude Code

### Method 1: Claude Desktop App (Recommended)

1. **Open Claude Desktop Settings**
   - Click on your profile
   - Go to "MCP Servers"

2. **Add Nexus-MCP Configuration**

Add this to your MCP settings:

```json
{
  "mcpServers": {
    "nexus-mcp": {
      "command": "node",
      "args": [
        "D:\\Proyectos\\GitHub\\Nexus-MCP\\dist\\index.js"
      ],
      "env": {
        "OPENAI_API_KEY": "your-openai-key",
        "GEMINI_API_KEY": "your-gemini-key",
        "ANTHROPIC_API_KEY": "your-anthropic-key"
      }
    }
  }
}
```

3. **Restart Claude Desktop**

### Method 2: Claude Code (VS Code Extension)

1. **Install Claude Code Extension** in VS Code

2. **Configure MCP in VS Code Settings**

Add to `.vscode/settings.json`:

```json
{
  "claude.mcp.servers": {
    "nexus-mcp": {
      "command": "node",
      "args": [
        "D:\\Proyectos\\GitHub\\Nexus-MCP\\dist\\index.js"
      ],
      "env": {
        "OPENAI_API_KEY": "your-openai-key",
        "GEMINI_API_KEY": "your-gemini-key",
        "ANTHROPIC_API_KEY": "your-anthropic-key"
      }
    }
  }
}
```

3. **Reload VS Code**

## Step 3: Verify Connection

In Claude, ask:
```
What MCP tools are available?
```

Claude should list all Nexus-MCP tools.

## Step 4: Using the Tools

### Example 1: Filesystem Operations

**User**: "List the files in the current directory"

**Claude**: Automatically calls `nexus_list_directory` and shows results

### Example 2: HTTP Requests

**User**: "Fetch data from https://api.example.com/users"

**Claude**: Calls `nexus_http_get` and returns the response

### Example 3: Git Operations

**User**: "Clone the repository at https://github.com/user/repo"

**Claude**: Calls `nexus_git_clone` to perform the operation

### Example 4: AI Tools

**User**: "Ask OpenAI to explain quantum computing"

**Claude**: Calls `nexus_openai_chat` and returns the explanation

## Step 5: Advanced Configuration

### Custom Environment Variables

```json
{
  "mcpServers": {
    "nexus-mcp": {
      "command": "node",
      "args": [
        "D:\\Proyectos\\GitHub\\Nexus-MCP\\dist\\index.js"
      ],
      "env": {
        "OPENAI_API_KEY": "${env:OPENAI_API_KEY}",
        "GEMINI_API_KEY": "${env:GEMINI_API_KEY}",
        "ANTHROPIC_API_KEY": "${env:ANTHROPIC_API_KEY}",
        "OLLAMA_HOST": "http://localhost:11434"
      }
    }
  }
}
```

### Multiple MCP Servers

You can run multiple MCP servers simultaneously:

```json
{
  "mcpServers": {
    "nexus-mcp": {
      "command": "node",
      "args": ["D:\\Proyectos\\GitHub\\Nexus-MCP\\dist\\index.js"]
    },
    "filesystem": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-filesystem", "D:\\Proyectos"]
    },
    "brave-search": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-brave-search"]
    }
  }
}
```

## MCP Gateway - External MCP Servers

Nexus-MCP includes an MCP Gateway that allows you to connect external MCP servers and use their tools alongside the built-in tools.

### Architecture with MCP Gateway

```
AI Assistant (Claude/ChatGPT)
         ↓
    MCP Protocol
         ↓
Nexus-MCP Server
         ↓
   MCP Gateway Router
         ↓
┌────────┴────────┐
│   External     │   Built-in Tools
│  MCP Servers   │
└────────────────┘
```

### Configuring External MCP Servers

1. **Create or edit `mcp-gateway.config.json`** in the Nexus-MCP root directory:

```json
{
  "servers": [
    {
      "name": "google-news",
      "transport": "stdio",
      "command": "node",
      "args": ["node_modules/@chanmeng666/google-news-server/dist/index.js"],
      "env": {
        "SERP_API_KEY": "your-serp-api-key"
      }
    },
    {
      "name": "filesystem",
      "transport": "stdio",
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-filesystem", "D:\\Proyectos"],
      "env": {}
    }
  ],
  "defaultTimeout": 30000,
  "enableDiscovery": true
}
```

2. **Server Configuration Options:**

- `name`: Unique identifier for the server
- `transport`: Connection type (`stdio` or `sse`)
- `command`: Command to start the server
- `args`: Arguments for the command
- `env`: Environment variables for the server

3. **Using External Tools**

External tools are automatically available when you start Nexus-MCP. They appear in the tool list with qualified names like `google-news:search`.

### Example: Google News Integration

**Install the server:**
```bash
npm install @chanmeng666/google-news-server
```

**Add to `mcp-gateway.config.json`:**
```json
{
  "servers": [
    {
      "name": "google-news",
      "transport": "stdio",
      "command": "node",
      "args": ["node_modules/@chanmeng666/google-news-server/dist/index.js"],
      "env": {
        "SERP_API_KEY": "${env:SERP_API_KEY}"
      }
    }
  ]
}
```

**Use in Claude:**
```
User: "Search for news about AI"
Claude: Calls `google-news:search` and returns results
```

### Benefits of MCP Gateway

- **Unified Interface**: Access all tools (built-in + external) through one MCP server
- **Automatic Discovery**: External servers are loaded automatically on startup
- **Routing**: Tool calls are routed to the correct server automatically
- **Error Handling**: Robust error handling for external server connections
- **Multiple Servers**: Support for multiple external MCP servers simultaneously

### Troubleshooting MCP Gateway

**Server not loading:**
- Check that the server package is installed
- Verify the command and args are correct
- Check environment variables are set

**Tool not available:**
- Verify the server is registered successfully
- Check the server logs for errors
- Ensure the tool name is correct (use `server:tool` format)

## Tool Categories Reference

### Filesystem Tools (18)
- `nexus_read_file` - Read file contents
- `nexus_write_file` - Write to file
- `nexus_list_directory` - List directory contents
- `nexus_create_directory` - Create directory
- `nexus_delete_file` - Delete file
- `nexus_copy_file` - Copy file
- `nexus_move_file` - Move/rename file
- `nexus_search_files` - Search for files
- `nexus_file_info` - Get file metadata
- `nexus_file_exists` - Check if file exists
- `nexus_read_file_chunk` - Read file chunk
- `nexus_watch_directory` - Watch directory changes
- `nexus_get_file_hash` - Get file hash
- `nexus_compress_file` - Compress file
- `nexus_decompress_file` - Decompress file
- `nexus_archive_directory` - Archive directory
- `nexus_extract_archive` - Extract archive
- `nexus_get_disk_usage` - Get disk usage

### HTTP Tools (16)
- `nexus_http_get` - GET request
- `nexus_http_post` - POST request
- `nexus_http_put` - PUT request
- `nexus_http_delete` - DELETE request
- `nexus_http_patch` - PATCH request
- `nexus_http_request` - Custom HTTP request
- `nexus_scrape_web` - Scrape web page
- `nexus_extract_links` - Extract links from HTML
- `nexus_extract_images` - Extract images from HTML
- `nexus_parse_html` - Parse HTML
- `nexus_parse_json` - Parse JSON
- `nexus_parse_xml` - Parse XML
- `nexus_webhook_send` - Send webhook
- `nexus_webhook_receive` - Receive webhook
- `nexus_api_test` - Test API endpoint
- `nexus_http_download` - Download file

### Git Tools (15)
- `nexus_git_clone` - Clone repository
- `nexus_git_init` - Initialize repository
- `nexus_git_add` - Stage files
- `nexus_git_commit` - Commit changes
- `nexus_git_push` - Push changes
- `nexus_git_pull` - Pull changes
- `nexus_git_branch` - Create/switch branch
- `nexus_git_merge` - Merge branch
- `nexus_git_status` - Get status
- `nexus_git_log` - Get commit history
- `nexus_git_diff` - Get diff
- `nexus_git_checkout` - Checkout files/branches
- `nexus_git_stash` - Stash changes
- `nexus_git_tag` - Create tag
- `nexus_git_remote` - Manage remotes

### System Tools (8)
- `nexus_execute_command` - Execute shell command
- `nexus_execute_script` - Execute script
- `nexus_process_list` - List processes
- `nexus_process_kill` - Kill process
- `nexus_system_info` - Get system information
- `nexus_environment_vars` - Get environment variables
- `nexus_disk_space` - Get disk space
- `nexus_memory_usage` - Get memory usage

### AI Tools (8)
- `nexus_ollama_chat` - Chat with Ollama
- `nexus_ollama_list_models` - List Ollama models
- `nexus_gemini_chat` - Chat with Gemini
- `nexus_gemini_list_models` - List Gemini models
- `nexus_openai_chat` - Chat with OpenAI
- `nexus_openai_list_models` - List OpenAI models
- `nexus_anthropic_chat` - Chat with Anthropic
- `nexus_anthropic_list_models` - List Anthropic models

### Utilities Tools (8)
- `nexus_json_parse` - Parse JSON
- `nexus_json_stringify` - Stringify to JSON
- `nexus_yaml_parse` - Parse YAML
- `nexus_yaml_stringify` - Stringify to YAML
- `nexus_base64_encode` - Base64 encode
- `nexus_base64_decode` - Base64 decode
- `nexus_hash_generate` - Generate hash
- `nexus_uuid_generate` - Generate UUID

### External Tools (8+)
External tools are loaded from MCP servers configured in `mcp-gateway.config.json`. Tools appear with qualified names like `server:tool`.

**Example External Tools:**
- `google-news:search` - Search Google News
- `filesystem:read_file` - Read file (from external filesystem server)
- `brave-search:search` - Search using Brave Search

The exact tools available depend on which external MCP servers you configure.

## Troubleshooting

### Server Not Starting
```bash
# Check if port is in use
netstat -ano | findstr :3000

# Kill process if needed
taskkill /PID <pid> /F
```

### Tools Not Available in Claude
1. Verify server is running: `npm start`
2. Check MCP configuration in Claude settings
3. Restart Claude Desktop/VS Code
4. Check Claude logs for errors

### Permission Errors
- Ensure the server has appropriate file system permissions
- Check that API keys are correctly configured
- Verify environment variables are set

## Best Practices

1. **Security**: Never commit API keys to version control
2. **Performance**: Use streaming for large responses
3. **Error Handling**: Always check tool responses for errors
4. **Resource Management**: Monitor memory and disk usage
5. **Logging**: Enable logging for debugging

## Example Workflows

### Workflow 1: Automated Code Review
```
1. Clone repository (nexus_git_clone)
2. Read files (nexus_read_file)
3. Analyze code (AI tool)
4. Create PR (Git tool)
```

### Workflow 2: Web Scraping
```
1. Fetch webpage (nexus_http_get)
2. Parse HTML (nexus_parse_html)
3. Extract data (nexus_scrape_web)
4. Save to file (nexus_write_file)
```

### Workflow 3: System Administration
```
1. Check system info (nexus_system_info)
2. List processes (nexus_process_list)
3. Execute commands (nexus_execute_command)
4. Monitor resources (nexus_memory_usage)
```

## Support

For issues or questions:
- Check the main documentation
- Review the API reference
- Open an issue on GitHub
