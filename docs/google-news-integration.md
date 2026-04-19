# Google News MCP Server Integration with Nexus-MCP Gateway

This guide shows how to integrate the Google News MCP Server with the Nexus-MCP Gateway to enable AI agents to search for news articles.

## Prerequisites

1. **SerpApi Key**: Get a free API key from [SerpApi](https://serpapi.com/) (250 free searches/month)
2. **Node.js 18+**: Required to run the MCP server
3. **Nexus-MCP Gateway**: Already included in Nexus-MCP

## Installation

### 1. Install the Google News MCP Server

```bash
npm install @chanmeng666/google-news-server
```

### 2. Build the Server

The package needs to be built before use:

```bash
cd node_modules/@chanmeng666/google-news-server
npm run build
```

### 3. Configure SerpApi Key

Add your SerpApi key to your `.env` file:

```env
SERP_API_KEY=your-actual-api-key-here
```

Or set it as an environment variable:

```bash
export SERP_API_KEY=your-actual-api-key-here
```

## Configuration

### Option 1: Using the CLI

Add the Google News server using the CLI command:

```bash
node examples/ai-interactive-cli.js
```

Then in the CLI:

```
/mcp-add google-news stdio node node_modules/@chanmeng666/google-news-server/dist/index.js
```

### Option 2: Using Configuration File

Add the following to your `mcp-gateway.config.json`:

```json
{
  "servers": [
    {
      "name": "google-news",
      "transport": "stdio",
      "command": "node",
      "args": ["node_modules/@chanmeng666/google-news-server/dist/index.js"],
      "env": {
        "SERP_API_KEY": "your-serp-api-key-here"
      }
    }
  ],
  "defaultTimeout": 30000,
  "enableDiscovery": true
}
```

## Usage

### Testing the Integration

Run the test script:

```bash
node examples/test-google-news-gateway.js
```

This will:
- Register the Google News server
- List available tools
- Test a news search query
- Display routing statistics

### Using in the CLI

1. Start the interactive CLI:

```bash
node examples/ai-interactive-cli.js
```

2. List available servers:

```
/mcp-servers
```

3. List available tools:

```
/mcp-tools
```

4. Search for news (manual mode):

```
/manual google-news:search {"query": "artificial intelligence", "num": 5}
```

### Available Tools

The Google News MCP Server provides the following tools:

- **`google-news:search`**: Search for news articles
  - Parameters:
    - `query` (string): Search query
    - `num` (number): Number of results (default: 10)
    - `hl` (string): Language (default: "en")
    - `gl` (string): Country (default: "us")

## Example Output

```
🔍 Testing Google News search...
📰 Search Results:
{
  "success": true,
  "serverName": "google-news",
  "toolName": "search",
  "result": {
    "news_results": [
      {
        "title": "AI Breakthrough in Healthcare",
        "link": "https://example.com/article1",
        "snippet": "New AI technology revolutionizes medical diagnosis...",
        "date": "2024-01-15",
        "source": "Tech News"
      }
    ]
  },
  "duration": 1234
}
```

## Integration with Agent Mode

When using the agent mode in the CLI, you can ask the AI to search for news:

```
/agent
Search for the latest news about artificial intelligence
```

The AI will automatically use the Google News tools if available.

## Troubleshooting

### "SERP_API_KEY not set"

Make sure you've added your SerpApi key to the `.env` file or set it as an environment variable.

### "Server not found"

Ensure the Google News server is installed and built:

```bash
npm install @chanmeng666/google-news-server
cd node_modules/@chanmeng666/google-news-server
npm run build
```

### "Connection failed"

Check that:
- The SerpApi key is valid and active
- You have available API quota (250 free calls/month)
- The server path is correct

## Limitations

- **Free Tier**: 250 searches per month
- **Rate Limit**: 2 requests per second
- **Cache**: Results are cached for 1 hour by SerpApi

## Resources

- [Google News MCP Server Repository](https://github.com/ChanMeng666/server-google-news)
- [SerpApi Documentation](https://serpapi.com/google-news-api)
- [Nexus-MCP Gateway Documentation](./mcp-configuration-guide.md)

## License

The Google News MCP Server is licensed under the MIT License. See the [repository](https://github.com/ChanMeng666/server-google-news) for details.
