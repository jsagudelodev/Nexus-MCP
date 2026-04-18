// Console Demo - How to interact with AI tools programmatically
import { aiHandlers } from '../dist/tools/ai/index.js';

// ANSI colors
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  yellow: '\x1b[33m',
  white: '\x1b[37m',
  dim: '\x1b[2m'
};

console.log(`${colors.bright}${colors.cyan}
╔════════════════════════════════════════════════════════════╗
║                                                          ║
║  Nexus-MCP AI Tools - Console Usage Demo                 ║
║                                                          ║
╚════════════════════════════════════════════════════════════╝
${colors.reset}`);

async function demo() {
  // Example 1: List models
  console.log(`\n${colors.bright}${colors.yellow}Step 1: List Available Models${colors.reset}\n`);
  
  console.log(`${colors.blue}OpenAI Models:${colors.reset}`);
  const openaiModels = await aiHandlers.nexusOpenAIListModels({});
  if (openaiModels.success) {
    console.log(`  Found ${openaiModels.data.models.length} models`);
    console.log(`  First 5: ${openaiModels.data.models.slice(0, 5).map(m => m.id).join(', ')}\n`);
  }

  console.log(`${colors.blue}Gemini Models:${colors.reset}`);
  const geminiModels = await aiHandlers.nexusGeminiListModels({});
  if (geminiModels.success) {
    console.log(`  Available: ${geminiModels.data.models.map(m => m.name).join(', ')}\n`);
  }

  // Example 2: Simple chat
  console.log(`${colors.bright}${colors.yellow}Step 2: Chat with OpenAI${colors.reset}\n`);
  
  const prompt = "Explain TypeScript in simple terms";
  console.log(`${colors.dim}Prompt:${colors.reset} "${prompt}"`);
  console.log(`${colors.dim}Model:${colors.reset} gpt-3.5-turbo\n`);
  
  console.log(`${colors.cyan}Generating response...${colors.reset}`);
  const response = await aiHandlers.nexusOpenAIChat({
    prompt,
    model: 'gpt-3.5-turbo',
    temperature: 0.7,
    maxTokens: 200,
    stream: false
  });
  
  if (response.success) {
    console.log(`\n${colors.green}Response:${colors.reset}`);
    console.log(`${colors.white}${response.data.response}${colors.reset}\n`);
    console.log(`${colors.dim}Tokens used:${colors.reset} ${response.data.usage.total_tokens}`);
    console.log(`${colors.dim}Duration:${colors.reset} ~1-2 seconds\n`);
  }

  // Example 3: Code generation
  console.log(`${colors.bright}${colors.yellow}Step 3: Code Generation${colors.reset}\n`);
  
  const codePrompt = "Write a TypeScript function that reverses a string";
  console.log(`${colors.dim}Prompt:${colors.reset} "${codePrompt}"`);
  console.log(`${colors.dim}Model:${colors.reset} gpt-3.5-turbo\n`);
  
  console.log(`${colors.cyan}Generating code...${colors.reset}`);
  const codeResponse = await aiHandlers.nexusOpenAIChat({
    prompt: codePrompt,
    model: 'gpt-3.5-turbo',
    temperature: 0.2,
    maxTokens: 300,
    stream: false
  });
  
  if (codeResponse.success) {
    console.log(`\n${colors.green}Generated Code:${colors.reset}`);
    console.log(`${colors.cyan}${codeResponse.data.response}${colors.reset}\n`);
  }

  // Example 4: Translation
  console.log(`${colors.bright}${colors.yellow}Step 4: Translation${colors.reset}\n`);
  
  const translatePrompt = "Translate 'Hello, world!' to Spanish";
  console.log(`${colors.dim}Prompt:${colors.reset} "${translatePrompt}"`);
  console.log(`${colors.dim}Model:${colors.reset} gpt-3.5-turbo\n`);
  
  console.log(`${colors.cyan}Translating...${colors.reset}`);
  const translateResponse = await aiHandlers.nexusOpenAIChat({
    prompt: translatePrompt,
    model: 'gpt-3.5-turbo',
    temperature: 0.3,
    maxTokens: 50,
    stream: false
  });
  
  if (translateResponse.success) {
    console.log(`\n${colors.green}Translation:${colors.reset}`);
    console.log(`${colors.white}${translateResponse.data.response}${colors.reset}\n`);
  }

  // Summary
  console.log(`${colors.bright}${colors.cyan}════════════════════════════════════════════════════════════${colors.reset}`);
  console.log(`${colors.bright}${colors.green}✓ Demo Complete!${colors.reset}\n`);
  
  console.log(`${colors.dim}To use AI tools in your code:${colors.reset}`);
  console.log(`${colors.dim}  1. Import: import { aiHandlers } from '@nexus-mcp/server'${colors.reset}`);
  console.log(`${colors.dim}  2. Configure API keys in environment variables${colors.reset}`);
  console.log(`${colors.dim}  3. Call handlers: await aiHandlers.nexusOpenAIChat({...})${colors.reset}\n`);
  
  console.log(`${colors.dim}Available providers:${colors.reset}`);
  console.log(`${colors.dim}  - nexusOllamaChat / nexusOllamaListModels${colors.reset}`);
  console.log(`${colors.dim}  - nexusGeminiChat / nexusGeminiListModels${colors.reset}`);
  console.log(`${colors.dim}  - nexusOpenAIChat / nexusOpenAIListModels${colors.reset}`);
  console.log(`${colors.dim}  - nexusAnthropicChat / nexusAnthropicListModels${colors.reset}\n`);
}

demo().catch(console.error);
