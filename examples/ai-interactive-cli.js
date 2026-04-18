// Interactive CLI for AI Tools with enhanced console experience
import readline from 'readline';
import { aiHandlers } from '../dist/tools/ai/index.js';

// ANSI color codes for better console experience
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
  bgBlue: '\x1b[44m',
  bgGreen: '\x1b[42m',
  bgRed: '\x1b[41m'
};

// Helper functions for colored output
const log = {
  success: (msg) => console.log(`${colors.green}✓${colors.reset} ${msg}`),
  error: (msg) => console.log(`${colors.red}✗${colors.reset} ${msg}`),
  info: (msg) => console.log(`${colors.blue}ℹ${colors.reset} ${msg}`),
  warn: (msg) => console.log(`${colors.yellow}⚠${colors.reset} ${msg}`),
  header: (msg) => console.log(`\n${colors.bright}${colors.cyan}${msg}${colors.reset}\n`),
  section: (msg) => console.log(`\n${colors.bright}${colors.yellow}${msg}${colors.reset}\n`),
  prompt: (msg) => process.stdout.write(`${colors.green}?${colors.reset} ${msg}: `),
  provider: (name, emoji) => console.log(`${colors.bright}${emoji} ${name}${colors.reset}`),
  response: (msg) => console.log(`${colors.dim}→${colors.reset} ${msg}`),
  loading: (msg) => process.stdout.write(`${colors.cyan}⏳${colors.reset} ${msg}... `),
  done: () => console.log(`${colors.green}✓${colors.reset} Done`),
  divider: () => console.log(`${colors.dim}${'─'.repeat(60)}${colors.reset}`)
};

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

// Provider configurations
const providers = {
  ollama: {
    name: 'Ollama (Local LLMs)',
    emoji: '🦙',
    chat: aiHandlers.nexusOllamaChat,
    list: aiHandlers.nexusOllamaListModels,
    defaultModel: 'llama2',
    color: colors.magenta
  },
  gemini: {
    name: 'Gemini (Google AI)',
    emoji: '🔮',
    chat: aiHandlers.nexusGeminiChat,
    list: aiHandlers.nexusGeminiListModels,
    defaultModel: 'gemini-pro',
    color: colors.blue
  },
  openai: {
    name: 'OpenAI (GPT)',
    emoji: '🤖',
    chat: aiHandlers.nexusOpenAIChat,
    list: aiHandlers.nexusOpenAIListModels,
    defaultModel: 'gpt-3.5-turbo',
    color: colors.green
  },
  anthropic: {
    name: 'Anthropic (Claude)',
    emoji: '🧠',
    chat: aiHandlers.nexusAnthropicChat,
    list: aiHandlers.nexusAnthropicListModels,
    defaultModel: 'claude-3-haiku-20240307',
    color: colors.yellow
  }
};

// Display welcome banner
function showBanner() {
  console.clear();
  log.header('╔════════════════════════════════════════════════════════════╗');
  console.log('║' + ' '.repeat(58) + '║');
  console.log('║' + colors.bright + colors.cyan + '  Nexus-MCP AI Tools - Interactive CLI'.padEnd(58) + colors.reset + '║');
  console.log('║' + ' '.repeat(58) + '║');
  console.log('╚════════════════════════════════════════════════════════════╝');
  console.log();
}

// Display provider menu
function showProviders() {
  log.section('Available AI Providers');
  
  Object.entries(providers).forEach(([key, provider], index) => {
    console.log(`  ${colors.bright}${index + 1}.${colors.reset} ${provider.emoji} ${provider.color}${provider.name}${colors.reset}`);
  });
  console.log(`  ${colors.bright}0.${colors.reset} Exit`);
  console.log();
}

// Display model menu for a provider
async function showModels(providerKey) {
  const provider = providers[providerKey];
  log.section(`${provider.emoji} ${provider.name} - Available Models`);
  
  log.loading('Fetching models');
  const result = await provider.list({});
  log.done();
  
  if (result.success) {
    console.log();
    // Only show first 10 models to avoid overwhelming the user
    const modelsToShow = result.data.models.slice(0, 10);
    modelsToShow.forEach((model, index) => {
      const modelName = model.name || model.id || model.displayName;
      console.log(`  ${colors.bright}${index + 1}.${colors.reset} ${modelName}`);
      if (model.description) {
        console.log(`     ${colors.dim}${model.description}${colors.reset}`);
      }
    });
    
    if (result.data.models.length > 10) {
      console.log(`  ${colors.dim}... and ${result.data.models.length - 10} more models${colors.reset}`);
    }
    console.log();
    return result.data.models;
  } else {
    log.error('Failed to fetch models');
    log.error(result.error?.message);
    return [];
  }
}

// Chat with a provider
async function chatWithProvider(providerKey, model, prompt) {
  const provider = providers[providerKey];
  
  console.log();
  log.divider();
  log.provider(provider.name, provider.emoji);
  console.log(`${colors.dim}Model:${colors.reset} ${model}`);
  console.log(`${colors.dim}Prompt:${colors.reset} ${prompt}`);
  log.divider();
  
  log.loading('Generating response');
  const startTime = Date.now();
  
  const result = await provider.chat({
    prompt,
    model,
    temperature: 0.7,
    maxTokens: 500,
    stream: false
  });
  
  const duration = Date.now() - startTime;
  log.done();
  
  if (result.success) {
    console.log();
    log.section('Response');
    console.log(`${colors.white}${result.data.response}${colors.reset}`);
    console.log();
    
    // Show metadata
    console.log(`${colors.dim}Duration:${colors.reset} ${duration}ms`);
    if (result.data.usage) {
      console.log(`${colors.dim}Tokens:${colors.reset} ${result.data.usage.total_tokens}`);
      console.log(`${colors.dim}  - Input:${colors.reset} ${result.data.usage.prompt_tokens}`);
      console.log(`${colors.dim}  - Output:${colors.reset} ${result.data.usage.completion_tokens}`);
    }
    if (result.data.provider) {
      console.log(`${colors.dim}Provider:${colors.reset} ${result.data.provider}`);
    }
    console.log();
  } else {
    console.log();
    log.error('Failed to generate response');
    log.error(result.error?.message);
    console.log();
  }
}

// Main menu
async function mainMenu() {
  showBanner();
  
  while (true) {
    showProviders();
    log.prompt('Select a provider');
    
    const choice = await new Promise(resolve => {
      rl.question('', (answer) => resolve(answer.trim()));
    });
    
    if (choice === '0') {
      console.log();
      log.success('Goodbye!');
      rl.close();
      process.exit(0);
    }
    
    const providerKey = Object.keys(providers)[choice - 1];
    if (!providerKey) {
      log.error('Invalid choice');
      continue;
    }
    
    // Show models
    const models = await showModels(providerKey);
    if (models.length === 0) {
      log.warn('Press Enter to continue...');
      await new Promise(resolve => rl.question('', () => resolve()));
      continue;
    }
    
    log.prompt('Select a model (1-10, or press Enter for default)');
    process.stdout.write(''); // Force flush
    const modelChoice = await new Promise(resolve => {
      rl.question('', (answer) => resolve(answer.trim()));
    });
    
    const selectedModel = modelChoice 
      ? models[parseInt(modelChoice) - 1]?.name || models[parseInt(modelChoice) - 1]?.id || models[parseInt(modelChoice) - 1]?.displayName
      : providers[providerKey].defaultModel;
    
    if (!selectedModel) {
      log.error('Invalid model choice');
      continue;
    }
    
    // Get prompt
    log.prompt('Enter your prompt');
    process.stdout.write(''); // Force flush
    const prompt = await new Promise(resolve => {
      rl.question('', (answer) => resolve(answer.trim()));
    });
    
    if (!prompt) {
      log.warn('Prompt cannot be empty');
      continue;
    }
    
    // Chat
    await chatWithProvider(providerKey, selectedModel, prompt);
    
    log.prompt('Press Enter to continue or 0 to exit');
    const continueChoice = await new Promise(resolve => {
      rl.question('', (answer) => resolve(answer.trim()));
    });
    
    if (continueChoice === '0') {
      console.log();
      log.success('Goodbye!');
      rl.close();
      process.exit(0);
    }
  }
}

// Start the CLI
console.clear();
mainMenu().catch(error => {
  console.error();
  log.error('An error occurred:');
  console.error(error.message);
  rl.close();
  process.exit(1);
});
