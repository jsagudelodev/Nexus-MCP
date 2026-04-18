// Simple AI CLI using command line arguments instead of interactive input
import 'dotenv/config';
import { aiHandlers } from '../dist/tools/ai/index.js';

const args = process.argv.slice(2);

if (args.length < 2) {
  console.log('Usage: node examples/ai-cli.js <provider> <prompt> [model]');
  console.log('');
  console.log('Providers: ollama, gemini, openai, anthropic');
  console.log('Examples:');
  console.log('  node examples/ai-cli.js openai "What is TypeScript?"');
  console.log('  node examples/ai-cli.js openai "What is TypeScript?" gpt-3.5-turbo');
  console.log('  node examples/ai-cli.js gemini "Hello world"');
  console.log('  node examples/ai-cli.js anthropic "Explain AI" claude-3-haiku-20240307');
  process.exit(1);
}

const provider = args[0].toLowerCase();
const prompt = args[1];
const model = args[2];

const providerMap = {
  ollama: { chat: aiHandlers.nexusOllamaChat, list: aiHandlers.nexusOllamaListModels, default: 'llama2' },
  gemini: { chat: aiHandlers.nexusGeminiChat, list: aiHandlers.nexusGeminiListModels, default: 'gemini-pro' },
  openai: { chat: aiHandlers.nexusOpenAIChat, list: aiHandlers.nexusOpenAIListModels, default: 'gpt-3.5-turbo' },
  anthropic: { chat: aiHandlers.nexusAnthropicChat, list: aiHandlers.nexusAnthropicListModels, default: 'claude-3-haiku-20240307' }
};

if (!providerMap[provider]) {
  console.error(`Unknown provider: ${provider}`);
  console.error('Available providers: ollama, gemini, openai, anthropic');
  process.exit(1);
}

const selectedProvider = providerMap[provider];
const selectedModel = model || selectedProvider.default;

console.log(`Provider: ${provider}`);
console.log(`Model: ${selectedModel}`);
console.log(`Prompt: ${prompt}`);
console.log('---');

async function run() {
  const startTime = Date.now();
  
  const response = await selectedProvider.chat({
    prompt,
    model: selectedModel,
    temperature: 0.7,
    maxTokens: 500,
    stream: false
  });
  
  const duration = Date.now() - startTime;
  
  if (response.success) {
    console.log('Response:');
    console.log(response.data.response);
    console.log('---');
    console.log(`Duration: ${duration}ms`);
    if (response.data.usage) {
      console.log(`Tokens: ${response.data.usage.total_tokens}`);
    }
  } else {
    console.error('Error:', response.error?.message);
  }
}

run().catch(console.error);
