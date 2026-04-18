// Enhanced AI Tools Demo with improved console experience
import { aiHandlers } from '../dist/tools/ai/index.js';

// ANSI color codes
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m',
};

const log = {
  success: (msg) => console.log(`${colors.green}✓${colors.reset} ${msg}`),
  error: (msg) => console.log(`${colors.red}✗${colors.reset} ${msg}`),
  info: (msg) => console.log(`${colors.blue}ℹ${colors.reset} ${msg}`),
  warn: (msg) => console.log(`${colors.yellow}⚠${colors.reset} ${msg}`),
  header: (msg) => console.log(`\n${colors.bright}${colors.cyan}${msg}${colors.reset}\n`),
  section: (msg) => console.log(`\n${colors.bright}${colors.yellow}${msg}${colors.reset}\n`),
  provider: (name, emoji) => console.log(`${colors.bright}${emoji} ${name}${colors.reset}`),
  response: (msg) => console.log(`${colors.dim}→${colors.reset} ${msg}`),
  loading: (msg) => process.stdout.write(`${colors.cyan}⏳${colors.reset} ${msg}... `),
  done: () => console.log(`${colors.green}✓${colors.reset} Done`),
  divider: () => console.log(`${colors.dim}${'─'.repeat(60)}${colors.reset}`)
};

async function demo() {
  console.clear();
  
  // Banner
  console.log();
  console.log(`${colors.bright}${colors.cyan}╔════════════════════════════════════════════════════════════╗${colors.reset}`);
  console.log(`${colors.bright}${colors.cyan}║${colors.reset}${' '.repeat(58)}${colors.bright}${colors.cyan}║${colors.reset}`);
  console.log(`${colors.bright}${colors.cyan}║${colors.reset}  ${colors.bright}${colors.white}Nexus-MCP AI Tools - Enhanced Demo${colors.reset}  ${colors.bright}${colors.cyan}║${colors.reset}`);
  console.log(`${colors.bright}${colors.cyan}║${colors.reset}${' '.repeat(58)}${colors.bright}${colors.cyan}║${colors.reset}`);
  console.log(`${colors.bright}${colors.cyan}╚════════════════════════════════════════════════════════════╝${colors.reset}`);
  console.log();

  // Test OpenAI
  log.section('🤖 OpenAI (GPT Models)');
  log.divider();
  
  try {
    log.loading('Fetching available models');
    const models = await aiHandlers.nexusOpenAIListModels({});
    log.done();
    
    log.success(`Found ${models.data.models.length} models`);
    console.log(`${colors.dim}First 5:${colors.reset} ${models.data.models.slice(0, 5).map(m => m.id).join(', ')}`);
    console.log();
    
    log.divider();
    log.info('Sending prompt to GPT-3.5-turbo...');
    console.log(`${colors.dim}Prompt:${colors.reset} "What is Nexus-MCP in one sentence?"`);
    log.divider();
    
    log.loading('Generating response');
    const startTime = Date.now();
    const response = await aiHandlers.nexusOpenAIChat({
      prompt: "What is Nexus-MCP in one sentence?",
      model: "gpt-3.5-turbo",
      temperature: 0.7,
      maxTokens: 100,
      stream: false
    });
    const duration = Date.now() - startTime;
    log.done();
    
    console.log();
    log.section('Response');
    console.log(`${colors.white}${response.data.response}${colors.reset}`);
    console.log();
    
    console.log(`${colors.dim}Duration:${colors.reset} ${duration}ms`);
    console.log(`${colors.dim}Tokens:${colors.reset} ${response.data.usage.total_tokens}`);
    console.log(`${colors.dim}  - Input:${colors.reset} ${response.data.usage.prompt_tokens}`);
    console.log(`${colors.dim}  - Output:${colors.reset} ${response.data.usage.completion_tokens}`);
    console.log();
    
  } catch (error) {
    log.error('OpenAI test failed');
    console.error(error.message);
  }

  // Test Anthropic
  log.section('🧠 Anthropic (Claude Models)');
  log.divider();
  
  try {
    log.loading('Fetching available models');
    const models = await aiHandlers.nexusAnthropicListModels({});
    log.done();
    
    log.success('Available models:', models.data.models.map(m => m.name).join(', '));
    console.log();
    
    log.divider();
    log.info('Sending prompt to Claude Haiku...');
    console.log(`${colors.dim}Prompt:${colors.reset} "What is Nexus-MCP in one sentence?"`);
    log.divider();
    
    log.loading('Generating response');
    const startTime = Date.now();
    const response = await aiHandlers.nexusAnthropicChat({
      prompt: "What is Nexus-MCP in one sentence?",
      model: "claude-3-haiku-20240307",
      temperature: 0.7,
      maxTokens: 100,
      stream: false
    });
    const duration = Date.now() - startTime;
    log.done();
    
    console.log();
    log.section('Response');
    console.log(`${colors.white}${response.data.response}${colors.reset}`);
    console.log();
    
    console.log(`${colors.dim}Duration:${colors.reset} ${duration}ms`);
    if (response.data.usage) {
      console.log(`${colors.dim}Tokens:${colors.reset} ${response.data.usage.input_tokens + response.data.usage.output_tokens}`);
      console.log(`${colors.dim}  - Input:${colors.reset} ${response.data.usage.input_tokens}`);
      console.log(`${colors.dim}  - Output:${colors.reset} ${response.data.usage.output_tokens}`);
    }
    console.log();
    
  } catch (error) {
    log.error('Anthropic test failed');
    console.error(error.message);
  }

  // Summary
  log.divider();
  log.header('Summary');
  console.log(`${colors.green}✓${colors.reset} Enhanced console experience with colors`);
  console.log(`${colors.green}✓${colors.reset} Better formatted responses`);
  console.log(`${colors.green}✓${colors.reset} Performance metrics (duration, tokens)`);
  console.log(`${colors.green}✓${colors.reset} Clear visual hierarchy`);
  console.log();
  
  console.log(`${colors.dim}To use the interactive CLI:${colors.reset}`);
  console.log(`${colors.dim}  node examples/ai-interactive-cli.js${colors.reset}`);
  console.log();
}

demo().catch(console.error);
