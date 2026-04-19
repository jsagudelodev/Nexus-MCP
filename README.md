# Nexus AI Tools

<div align="center">

**A Comprehensive Model Context Protocol Toolkit for AI Assistants**

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node Version](https://img.shields.io/node/v/node.svg)](https://nodejs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.4-blue.svg)](https://www.typescriptlang.org/)
[![MCP](https://img.shields.io/badge/MCP-1.0-green.svg)](https://modelcontextprotocol.io/)

Transform any AI assistant into an autonomous agent capable of executing real-world tasks.

[Documentation](./docs/) • [Getting Started](./docs/getting-started.md) • [Roadmap](./ROADMAP.md) • [Architecture](./docs/architecture.md)

</div>

---

## 🎯 **Overview**

Nexus-MCP is a powerful **Model Context Protocol (MCP) server** built with TypeScript/Node.js that provides AI models with universal tools for:

- 📁 **File System Operations** (18 tools) - Read, write, search, and monitor files
- 🌐 **HTTP/Web Requests** (16 tools) - Fetch data, scrape websites, call APIs
- 🔄 **Git Workflows** (15 tools) - Clone, commit, branch, and manage repositories
-  **System Commands** (8 tools) - Execute shell commands and manage processes
- 🔧 **Utilities** (8 tools, code ready) - JSON/YAML parsing, compression, encryption, and more

**Current Status**: 49 tools production-ready, 8 utilities tools code-implemented (pending config integration)

## 🚀 **Quick Start**

### Installation

```bash
npm install -g nexus-ai-tools
```

### Configuration

```bash
# Copy example environment file
cp .env.example .env

# Edit with your settings
nano .env
```

### Run

```bash
# Build the project
npm run build

# Run the MCP server (production)
npm start
# or
npm run start:mcp

# Run with CLI
npm run mcp

# Run in development mode
npm run dev
```

### Integration with Claude Code

Add to your Claude Desktop config:

```json
{
  "mcpServers": {
    "nexus-mcp": {
      "command": "node",
      "args": ["/path/to/nexus-mcp/dist/index.js"]
    }
  }
}
```

## 📦 **Features**

### Filesystem Tools
- `nexus_read_file` - Read files with encoding support
- `nexus_write_file` - Write/create files
- `nexus_list_directory` - List directory contents
- `nexus_search_files` - Search files by pattern
- `nexus_search_content` - Search content within files
- `nexus_watch_directory` - Monitor directory changes

### HTTP Tools
- `nexus_http_get` - HTTP GET requests
- `nexus_http_post` - HTTP POST requests
- `nexus_fetch_url` - Fetch and parse web content
- `nexus_parse_html` - Parse HTML with Cheerio
- `nexus_call_api` - Generic API calls

### Git Tools
- `nexus_git_clone` - Clone repositories
- `nexus_git_commit` - Create commits
- `nexus_git_push` - Push to remote
- `nexus_git_pr_create` - Create pull requests
- Integration with GitHub, GitLab, Bitbucket

### Database Tools
- `nexus_db_query` - Execute SQL queries
- `nexus_db_list_tables` - List database tables
- `nexus_db_describe_table` - Describe table schema
- Support for PostgreSQL, MySQL, SQLite, SQL Server, MongoDB

### System Tools
- `nexus_exec_command` - Execute shell commands
- `nexus_system_info` - Get system information
- `nexus_process_list` - List running processes
- `nexus_service_start/stop` - Manage services

### AI Tools
- `nexus_llm_chat` - Chat with LLMs (Anthropic, OpenAI)
- `nexus_embedding_create` - Create text embeddings
- `nexus_text_summarize` - Summarize text
- `nexus_code_generate` - Generate code

### Utilities Tools
- `nexus_json_parse/stringify` - JSON manipulation
- `nexus_yaml_parse/stringify` - YAML manipulation
- `nexus_zip_create/extract` - ZIP compression
- `nexus_encrypt/decrypt` - Encryption/decryption

## 🏗️ **Architecture**

```
┌─────────────────────────────────────────┐
│         Claude / LLM Client              │
└──────────────┬──────────────────────────┘
               │ MCP Protocol (stdio)
               ▼
┌─────────────────────────────────────────┐
│           Nexus-MCP Server               │
│  ┌───────────────────────────────────┐  │
│  │      MCP Server Core             │  │
│  └───────────────────────────────────┘  │
│         ┌───────┴───────┐                │
│         │               │                │
│    ┌────▼────┐    ┌────▼────┐           │
│    │ Filesys │    │   HTTP  │           │
│    └─────────┘    └─────────┘           │
│    ┌─────────┐    ┌─────────┐           │
│    │   Git   │    │ Database│           │
│    └─────────┘    └─────────┘           │
│    ┌─────────┐    ┌─────────┐           │
│    │  System │    │    AI   │           │
│    └─────────┘    └─────────┘           │
└─────────────────────────────────────────┘
```

For detailed architecture, see [docs/architecture.md](./docs/architecture.md)

## 🏛️ **Production-Grade Quality**

Nexus-MCP is built with **architectural excellence** in mind, designed for production use and community adoption. We follow strict principles:

- ✅ **Type Safety**: TypeScript strict mode + Zod validation
- ✅ **Error Handling**: Structured, actionable error messages
- ✅ **Performance**: Async operations, caching, streaming
- ✅ **Security**: Input validation, sanitization, audit logs
- ✅ **Observability**: Structured logging, metrics, tracing
- ✅ **Testability**: 80%+ coverage, dependency injection
- ✅ **Documentation**: JSDoc, examples, comprehensive guides
- ✅ **Developer Experience**: Clear errors, IDE support, quick feedback

See [Architectural Principles](./docs/architectural-principles.md) for complete details.

## 📚 **Documentation**

- [Getting Started Guide](./docs/getting-started.md) - Quick start and basic usage
- [Architecture Documentation](./docs/architecture.md) - System architecture and design
- [Architectural Principles](./docs/architectural-principles.md) - Design principles and best practices
- [API Reference](./docs/api-reference.md) - Complete API documentation
- [Tools Reference](./docs/tools-reference.md) - Detailed tool documentation
- [Roadmap](./ROADMAP.md) - Development roadmap and progress

## 🛠️ **Development**

```bash
# Clone repository
git clone https://github.com/your-org/Nexus-MCP.git
cd Nexus-MCP

# Install dependencies
npm install

# Run in development mode
npm run dev

# Run tests
npm test

# Build for production
npm run build

# Lint code
npm run lint
```

## 📊 **Project Status**

- **Current Version**: 1.0.0-alpha
- **Development Status**: Active Development
- **Core Progress**: 36% (9/12 phases completed)
- **Implemented Tools**: 57 production-ready, 8 code-implemented (pending config)
- **Target Tools**: 50+ ✅ (exceeded)
- **AI Integration**: Ollama + Gemini + OpenAI + Anthropic Claude ✅ (8 tools)
- **Enhanced CLI**: Interactive AI tools CLI with colors and metrics ✅
- **Test Coverage**: 49 tests implemented (35 unit + 1 integration + 13 E2E)
- **Test Status**: ✅ All passing (49/49)
- **Documentation**: 85% complete (Installation, Configuration, API, Examples, AI Guide)
- **Build Status**: ✅ Passing
- **Executable**: ✅ Ready for deployment
- **CLI**: ✅ Functional

See [ROADMAP.md](./ROADMAP.md) for detailed progress.

## � **AI Tools Integration**

Nexus-MCP includes integration with 4 major AI providers:

- **Ollama** (2 tools): Local LLMs - Chat + List Models
- **Gemini** (2 tools): Google AI - Chat + List Models  
- **OpenAI** (2 tools): GPT Models - Chat + List Models
- **Anthropic** (2 tools): Claude Models - Chat + List Models

### Quick Start with AI Tools

```bash
# Configure API keys
export OPENAI_API_KEY="your-key"
export GEMINI_API_KEY="your-key"
export ANTHROPIC_API_KEY="your-key"
export OLLAMA_HOST="http://localhost:11434"

# Run the interactive AI CLI
node examples/ai-interactive-cli.js

# Or run the enhanced demo
node examples/ai-enhanced-demo.js
```

See [AI Tools Guide](./docs/ai-tools-guide.md) for detailed documentation.

## 🔌 **MCP Integration**

Nexus-MCP is an MCP (Model Context Protocol) server that allows AI assistants like Claude Code to use its 57 tools.

### Quick Start with MCP

1. **Start the server**:
```bash
npm start
```

2. **Configure Claude Desktop** to connect to Nexus-MCP

See [MCP Configuration Guide](./docs/mcp-configuration-guide.md) for detailed setup instructions.

### Available Tool Categories

- **Filesystem** (18 tools): Read, write, list, search files
- **HTTP** (16 tools): Requests, scraping, APIs
- **Git** (15 tools): Clone, commit, branches, PRs
- **System** (8 tools): Commands, processes, system info
- **AI** (8 tools): Chat with Ollama, Gemini, OpenAI, Anthropic
- **Utilities** (8 tools): JSON, YAML, compression, encryption





## �🤝 **Contributing**

Contributions are welcome! Please read our contributing guidelines before submitting PRs.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 **License**

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 **Acknowledgments**

- [Model Context Protocol](https://modelcontextprotocol.io/)
- [Anthropic Claude](https://www.anthropic.com/)
- [MCP SDK TypeScript](https://github.com/modelcontextprotocol/typescript-sdk)

## 📞 **Support**

- 📖 [Documentation](./docs/)
- 🐛 [Issue Tracker](https://github.com/your-org/Nexus-MCP/issues)
- 💬 [Discord Community](https://discord.gg/your-server)
- ✉️ Email: support@nexus-mcp.dev

---

<div align="center">

**Built with ❤️ by the Nexus Team**

</div>
