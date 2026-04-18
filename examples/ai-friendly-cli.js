// Friendly AI CLI - More intuitive console experience
import 'dotenv/config';
import { aiHandlers } from '../dist/tools/ai/index.js';

const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  yellow: '\x1b[33m',
  white: '\x1b[37m',
  magenta: '\x1b[35m',
  dim: '\x1b[2m'
};

function clear() {
  console.clear();
}

function showHeader() {
  console.log();
  console.log(`${colors.bright}${colors.cyan}╔════════════════════════════════════════════════════════════╗${colors.reset}`);
  console.log(`${colors.bright}${colors.cyan}║${colors.reset}  ${colors.bright}${colors.white}🤖 Nexus-MCP AI Assistant${colors.reset}  ${colors.bright}${colors.cyan}║${colors.reset}`);
  console.log(`${colors.bright}${colors.cyan}╚════════════════════════════════════════════════════════════╝${colors.reset}`);
  console.log();
}

function showMenu() {
  console.log(`${colors.bright}${colors.yellow}Choose an AI provider:${colors.reset}\n`);
  console.log(`  ${colors.green}1.${colors.reset} 🤖 OpenAI (GPT)`);
  console.log(`  ${colors.green}2.${colors.reset} 🔮 Gemini (Google)`);
  console.log(`  ${colors.green}3.${colors.reset} 🧠 Anthropic (Claude)`);
  console.log(`  ${colors.green}4.${colors.reset} 🦙 Ollama (Local)`);
  console.log(`  ${colors.green}0.${colors.reset} ❌ Exit\n`);
}

function showPrompt(provider) {
  const icons = {
    openai: '🤖',
    gemini: '🔮',
    anthropic: '🧠',
    ollama: '🦙'
  };
  console.log(`${colors.dim}${icons[provider]} ${provider.toUpperCase()}${colors.reset}`);
  console.log(`${colors.dim}${'─'.repeat(40)}${colors.reset}`);
}

async function chat(provider, prompt) {
  const providers = {
    openai: { chat: aiHandlers.nexusOpenAIChat, default: 'gpt-3.5-turbo' },
    gemini: { chat: aiHandlers.nexusGeminiChat, default: 'gemini-pro' },
    anthropic: { chat: aiHandlers.nexusAnthropicChat, default: 'claude-3-haiku-20240307' },
    ollama: { chat: aiHandlers.nexusOllamaChat, default: 'llama2' }
  };

  const selectedProvider = providers[provider];
  
  showPrompt(provider);
  console.log(`${colors.cyan}💭 Your message:${colors.reset} ${prompt}\n`);
  
  console.log(`${colors.yellow}⏳ Thinking...${colors.reset}`);
  
  const startTime = Date.now();
  const response = await selectedProvider.chat({
    prompt,
    model: selectedProvider.default,
    temperature: 0.7,
    maxTokens: 500,
    stream: false
  });
  const duration = Date.now() - startTime;
  
  if (response.success) {
    console.log(`${colors.green}✓${colors.reset} ${colors.cyan}Response:${colors.reset}\n`);
    console.log(`${colors.white}${response.data.response}${colors.reset}\n`);
    console.log(`${colors.dim}⏱️  ${duration}ms | 📊 ${response.data.usage?.total_tokens || 'N/A'} tokens${colors.reset}\n`);
  } else {
    console.log(`${colors.red}✗${colors.reset} Error: ${response.error?.message}\n`);
  }
}

async function main() {
  const args = process.argv.slice(2);
  
  if (args.length === 0) {
    clear();
    showHeader();
    showMenu();
    console.log(`${colors.dim}Usage: node examples/ai-friendly-cli.js <provider> <prompt>${colors.reset}\n`);
    console.log(`${colors.dim}Example: node examples/ai-friendly-cli.js openai "Explain TypeScript"${colors.reset}\n`);
    return;
  }
  
  const provider = args[0].toLowerCase();
  const prompt = args.slice(1).join(' ');
  
  const validProviders = ['openai', 'gemini', 'anthropic', 'ollama'];
  
  if (!validProviders.includes(provider)) {
    console.log(`${colors.red}✗${colors.reset} Invalid provider. Use: openai, gemini, anthropic, or ollama\n`);
    return;
  }
  
  if (!prompt) {
    console.log(`${colors.red}✗${colors.reset} Please provide a prompt\n`);
    console.log(`${colors.dim}Example: node examples/ai-friendly-cli.js openai "Your question here"${colors.reset}\n`);
    return;
  }
  
  clear();
  showHeader();
  
  await chat(provider, prompt);
  
  console.log(`${colors.dim}${'─'.repeat(50)}${colors.reset}`);
  console.log(`${colors.green}✓${colors.reset} Done! Ask another question anytime.\n`);
}

main().catch(console.error);
