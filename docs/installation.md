# Installation Guide

This guide will help you install and set up Nexus-MCP on your system.

## Prerequisites

- **Node.js**: 18.0.0 or higher
- **npm**: 9.0.0 or higher
- **TypeScript**: 5.4.0 or higher (for development)

## Installation Methods

### Method 1: Install from npm (Recommended)

```bash
npm install -g @nexus-mcp/server
```

This will install Nexus-MCP globally on your system, making the `nexus-mcp` command available everywhere.

### Method 2: Install from Source

```bash
# Clone the repository
git clone https://github.com/your-org/Nexus-MCP.git
cd Nexus-MCP

# Install dependencies
npm install

# Build the project
npm run build
```

## Verification

After installation, verify that Nexus-MCP is working correctly:

```bash
nexus-mcp --version
```

You should see output like:
```
Nexus-MCP v1.0.0-alpha
Environment: development
Node: v18.x.x
```

## Configuration

### Environment Variables

Create a `.env` file in the project root:

```bash
# Copy example environment file
cp .env.example .env

# Edit with your settings
nano .env
```

Required environment variables:

```env
# Server Configuration
NODE_ENV=development
LOG_LEVEL=info

# Tool Configuration
ALLOWED_PATHS=/tmp,/home/user
MAX_FILE_SIZE=104857600
```

### Configuration File

You can also use a YAML configuration file:

```yaml
server:
  name: nexus-mcp
  version: 1.0.0-alpha
  environment: development

tools:
  filesystem:
    enabled: true
    allowed_paths:
      - /tmp
      - /home/user
    max_file_size: 104857600
  
  http:
    enabled: true
    timeout: 30000
    max_redirects: 5
```

## Running the Server

### Development Mode

```bash
npm run dev
```

### Production Mode

```bash
npm start
```

### CLI Mode

```bash
# Show server status
nexus-mcp status

# List available tools
nexus-mcp tools

# Start server
nexus-mcp start
```

## Integration with Claude Desktop

Add Nexus-MCP to your Claude Desktop configuration:

**macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`
**Windows**: `%APPDATA%\Claude\claude_desktop_config.json`

```json
{
  "mcpServers": {
    "nexus-mcp": {
      "command": "node",
      "args": ["/path/to/Nexus-MCP/dist/index.js"],
      "env": {
        "NODE_ENV": "production"
      }
    }
  }
}
```

## Troubleshooting

### Port Already in Use

If you get a "port already in use" error:

```bash
# Find the process using the port
lsof -i :3000  # macOS/Linux
netstat -ano | findstr :3000  # Windows

# Kill the process
kill -9 <PID>
```

### Permission Denied

If you get permission errors:

```bash
# On Linux/macOS
sudo npm install -g @nexus-mcp/server

# Or use a user directory
npm config set prefix ~/.npm-global
export PATH=~/.npm-global/bin:$PATH
```

### Module Not Found

If you get "module not found" errors:

```bash
# Reinstall dependencies
rm -rf node_modules package-lock.json
npm install

# Rebuild
npm run build
```

## Uninstallation

### Global Installation

```bash
npm uninstall -g @nexus-mcp/server
```

### Source Installation

```bash
# Remove the project directory
rm -rf Nexus-MCP
```

## Next Steps

- [Getting Started Guide](./getting-started.md)
- [Configuration Guide](./configuration.md)
- [API Reference](./api-reference.md)
