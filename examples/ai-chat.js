// Interactive Chat CLI - Conversational AI interface with advanced features
import 'dotenv/config';
import { aiHandlers } from '../dist/tools/ai/index.js';
import readline from 'readline';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

const providers = {
  openai: { chat: aiHandlers.nexusOpenAIChat, default: 'gpt-3.5-turbo', icon: '🤖' },
  gemini: { chat: aiHandlers.nexusGeminiChat, default: 'gemini-pro', icon: '🔮' },
  anthropic: { chat: aiHandlers.nexusAnthropicChat, default: 'claude-3-haiku-20240307', icon: '🧠' },
  ollama: { chat: aiHandlers.nexusOllamaChat, default: 'llama2', icon: '🦙' }
};

let currentProvider = 'openai';
let conversationHistory = [];
let temperature = 0.7;
let totalTokens = 0;
let messageCount = 0;
let sessionStart = Date.now();

const historyFile = path.join(__dirname, '.chat-history.json');

// Load history from file
function loadHistory() {
  try {
    if (fs.existsSync(historyFile)) {
      const data = fs.readFileSync(historyFile, 'utf8');
      const saved = JSON.parse(data);
      conversationHistory = saved.history || [];
      totalTokens = saved.totalTokens || 0;
      messageCount = saved.messageCount || 0;
      console.log(`${colors.green}✓${colors.reset} Loaded ${conversationHistory.length} messages from history\n`);
    }
  } catch (error) {
    console.log(`${colors.dim}No previous history found${colors.reset}\n`);
  }
}

// Save history to file
function saveHistory() {
  try {
    const data = {
      history: conversationHistory,
      totalTokens,
      messageCount,
      lastUpdated: new Date().toISOString()
    };
    fs.writeFileSync(historyFile, JSON.stringify(data, null, 2));
  } catch (error) {
    console.log(`${colors.red}✗${colors.reset} Failed to save history\n`);
  }
}

function clear() {
  console.clear();
}

function showHeader() {
  console.log();
  console.log(`${colors.bright}${colors.cyan}╔════════════════════════════════════════════════════════════╗${colors.reset}`);
  console.log(`${colors.bright}${colors.cyan}║${colors.reset}  ${colors.bright}${colors.white}💬 Nexus-MCP Chat${colors.reset}  ${colors.bright}${colors.cyan}║${colors.reset}`);
  console.log(`${colors.bright}${colors.cyan}╚════════════════════════════════════════════════════════════╝${colors.reset}`);
  console.log();
  console.log(`${colors.dim}Provider: ${providers[currentProvider].icon} ${currentProvider.toUpperCase()}${colors.reset}`);
  console.log(`${colors.dim}Temp: ${temperature} | Messages: ${messageCount} | Tokens: ${totalTokens}${colors.reset}`);
  console.log(`${colors.dim}Type 'help' for commands, 'exit' to quit${colors.reset}`);
  console.log(`${colors.dim}${'─'.repeat(60)}${colors.reset}\n`);
}

async function sendMessage(message) {
  if (!message.trim()) return;
  
  console.log(`${colors.cyan}💭 You:${colors.reset} ${message}\n`);
  
  console.log(`${colors.yellow}⏳${providers[currentProvider].icon} Thinking...${colors.reset}`);
  
  // Add context from recent messages (last 5 exchanges)
  const contextMessages = conversationHistory.slice(-10);
  let promptWithContext = message;
  
  if (contextMessages.length > 0) {
    promptWithContext = 'Previous conversation:\n' + 
      contextMessages.map(m => `${m.role}: ${m.content}`).join('\n') +
      '\n\nCurrent question: ' + message;
  }
  
  const startTime = Date.now();
  const response = await providers[currentProvider].chat({
    prompt: promptWithContext,
    model: providers[currentProvider].default,
    temperature: temperature,
    maxTokens: 500,
    stream: false
  });
  const duration = Date.now() - startTime;
  
  if (response.success) {
    console.log(`${colors.green}✓${colors.reset} ${colors.white}${providers[currentProvider].icon} AI:${colors.reset}`);
    console.log(`${colors.white}${response.data.response}${colors.reset}\n`);
    
    const tokensUsed = response.data.usage?.total_tokens || 0;
    totalTokens += tokensUsed;
    messageCount++;
    
    console.log(`${colors.dim}⏱️  ${duration}ms | 📊 ${tokensUsed} tokens (total: ${totalTokens})${colors.reset}\n`);
    
    conversationHistory.push({
      role: 'user',
      content: message,
      timestamp: new Date().toISOString()
    });
    conversationHistory.push({
      role: 'assistant',
      content: response.data.response,
      timestamp: new Date().toISOString(),
      provider: currentProvider,
      tokens: tokensUsed
    });
    
    // Auto-save history
    saveHistory();
  } else {
    console.log(`${colors.red}✗${colors.reset} Error: ${response.error?.message}\n`);
  }
  
  console.log(`${colors.dim}${'─'.repeat(60)}${colors.reset}\n`);
}

function showHelp() {
  console.log(`${colors.bright}${colors.yellow}Available Commands:${colors.reset}\n`);
  console.log(`  ${colors.green}/provider${colors.reset} <name> - Switch AI provider (openai, gemini, anthropic, ollama)`);
  console.log(`  ${colors.green}/temp${colors.reset} <0-2> - Set temperature (0=precise, 1=balanced, 2=creative)`);
  console.log(`  ${colors.green}/clear${colors.reset} - Clear conversation history`);
  console.log(`  ${colors.green}/history${colors.reset} - Show conversation history`);
  console.log(`  ${colors.green}/export${colors.reset} - Export conversation to file`);
  console.log(`  ${colors.green}/stats${colors.reset} - Show session statistics`);
  console.log(`  ${colors.green}/reset${colors.reset} - Reset all history and stats`);
  console.log(`  ${colors.green}/exit${colors.reset} or ${colors.green}/quit${colors.reset} - Exit chat\n`);
  console.log(`${colors.dim}${'─'.repeat(60)}${colors.reset}\n`);
}

function showHistory() {
  if (conversationHistory.length === 0) {
    console.log(`${colors.dim}No conversation history yet.${colors.reset}\n`);
  } else {
    console.log(`${colors.bright}${colors.yellow}Conversation History (${conversationHistory.length} messages):${colors.reset}\n`);
    conversationHistory.slice(-10).forEach((msg, index) => {
      const role = msg.role === 'user' ? `${colors.cyan}💭 You:${colors.reset}` : `${colors.white}🤖 AI:${colors.reset}`;
      const time = msg.timestamp ? new Date(msg.timestamp).toLocaleTimeString() : '';
      console.log(`${role} ${msg.content} ${colors.dim}[${time}]${colors.reset}\n`);
    });
    if (conversationHistory.length > 10) {
      console.log(`${colors.dim}... and ${conversationHistory.length - 10} more messages${colors.reset}\n`);
    }
  }
  console.log(`${colors.dim}${'─'.repeat(60)}${colors.reset}\n`);
}

function exportConversation() {
  if (conversationHistory.length === 0) {
    console.log(`${colors.dim}No conversation to export.${colors.reset}\n`);
    return;
  }
  
  const exportFile = path.join(__dirname, `chat-export-${Date.now()}.md`);
  const content = `# Nexus-MCP Chat Export\n\n` +
    `Date: ${new Date().toLocaleString()}\n` +
    `Provider: ${currentProvider}\n` +
    `Messages: ${messageCount}\n` +
    `Total Tokens: ${totalTokens}\n\n` +
    `---\n\n` +
    conversationHistory.map(msg => {
      const role = msg.role === 'user' ? 'You' : 'AI';
      return `## ${role}\n\n${msg.content}\n\n`;
    }).join('---\n\n');
  
  try {
    fs.writeFileSync(exportFile, content);
    console.log(`${colors.green}✓${colors.reset} Exported to ${exportFile}\n`);
  } catch (error) {
    console.log(`${colors.red}✗${colors.reset} Failed to export\n`);
  }
  
  console.log(`${colors.dim}${'─'.repeat(60)}${colors.reset}\n`);
}

function showStats() {
  const sessionDuration = Math.floor((Date.now() - sessionStart) / 1000);
  const minutes = Math.floor(sessionDuration / 60);
  const seconds = sessionDuration % 60;
  
  console.log(`${colors.bright}${colors.yellow}Session Statistics:${colors.reset}\n`);
  console.log(`  ${colors.cyan}⏱️  Duration:${colors.reset} ${minutes}m ${seconds}s`);
  console.log(`  ${colors.cyan}💬 Messages:${colors.reset} ${messageCount}`);
  console.log(`  ${colors.cyan}📊 Total Tokens:${colors.reset} ${totalTokens}`);
  console.log(`  ${colors.cyan}🤖 Provider:${colors.reset} ${providers[currentProvider].icon} ${currentProvider.toUpperCase()}`);
  console.log(`  ${colors.cyan}🌡️  Temperature:${colors.reset} ${temperature}`);
  console.log(`  ${colors.cyan}📜 History Size:${colors.reset} ${conversationHistory.length} messages\n`);
  console.log(`${colors.dim}${'─'.repeat(60)}${colors.reset}\n`);
}

function resetAll() {
  conversationHistory = [];
  totalTokens = 0;
  messageCount = 0;
  sessionStart = Date.now();
  temperature = 0.7;
  
  try {
    if (fs.existsSync(historyFile)) {
      fs.unlinkSync(historyFile);
    }
  } catch (error) {
    // Ignore error
  }
  
  console.log(`${colors.green}✓${colors.reset} All history and stats reset\n`);
  console.log(`${colors.dim}${'─'.repeat(60)}${colors.reset}\n`);
}

async function handleInput(input) {
  const trimmed = input.trim();
  
  if (!trimmed) return;
  
  // Handle commands (with or without slash)
  const isCommand = trimmed.startsWith('/') || trimmed.toLowerCase() === 'help' || trimmed.toLowerCase() === 'exit' || trimmed.toLowerCase() === 'quit';
  
  if (isCommand) {
    const commandStr = trimmed.startsWith('/') ? trimmed.slice(1) : trimmed;
    const [command, ...args] = commandStr.split(' ');
    
    switch (command.toLowerCase()) {
      case 'provider':
        if (args[0] && providers[args[0]]) {
          currentProvider = args[0];
          console.log(`${colors.green}✓${colors.reset} Switched to ${providers[args[0]].icon} ${args[0].toUpperCase()}\n`);
          console.log(`${colors.dim}${'─'.repeat(60)}${colors.reset}\n`);
        } else {
          console.log(`${colors.red}✗${colors.reset} Invalid provider. Available: openai, gemini, anthropic, ollama\n`);
          console.log(`${colors.dim}${'─'.repeat(60)}${colors.reset}\n`);
        }
        break;
      
      case 'temp':
        const newTemp = parseFloat(args[0]);
        if (!isNaN(newTemp) && newTemp >= 0 && newTemp <= 2) {
          temperature = newTemp;
          console.log(`${colors.green}✓${colors.reset} Temperature set to ${temperature}\n`);
          console.log(`${colors.dim}${'─'.repeat(60)}${colors.reset}\n`);
        } else {
          console.log(`${colors.red}✗${colors.reset} Invalid temperature. Use 0-2\n`);
          console.log(`${colors.dim}${'─'.repeat(60)}${colors.reset}\n`);
        }
        break;
      
      case 'clear':
        conversationHistory = [];
        console.log(`${colors.green}✓${colors.reset} Conversation history cleared\n`);
        console.log(`${colors.dim}${'─'.repeat(60)}${colors.reset}\n`);
        break;
      
      case 'history':
        showHistory();
        break;
      
      case 'export':
        exportConversation();
        break;
      
      case 'stats':
        showStats();
        break;
      
      case 'reset':
        resetAll();
        break;
      
      case 'exit':
      case 'quit':
        console.log(`${colors.green}👋 Goodbye!${colors.reset}\n`);
        rl.close();
        process.exit(0);
        break;
      
      case 'help':
        showHelp();
        break;
      
      default:
        console.log(`${colors.red}✗${colors.reset} Unknown command. Type 'help' for available commands\n`);
        console.log(`${colors.dim}${'─'.repeat(60)}${colors.reset}\n`);
    }
  } else {
    // Regular message
    await sendMessage(trimmed);
  }
  
  // Show prompt again
  rl.prompt();
}

async function startChat() {
  clear();
  loadHistory();
  showHeader();
  
  rl.setPrompt(`${colors.green}You:${colors.reset} `);
  rl.prompt();
  
  rl.on('line', async (input) => {
    await handleInput(input);
  });
  
  rl.on('close', () => {
    console.log(`${colors.green}👋 Goodbye!${colors.reset}\n`);
    process.exit(0);
  });
}

startChat().catch(console.error);
