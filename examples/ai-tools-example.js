// Example: How to interact with AI tools in Nexus-MCP
// This demonstrates how to use all 4 AI providers: Ollama, Gemini, OpenAI, and Anthropic

import { aiHandlers } from '../dist/tools/ai/index.js';

async function demonstrateAITools() {
  console.log('=== Nexus-MCP AI Tools Demo ===\n');

  // ============================================================================
  // 1. OLLAMA (Local LLMs)
  // ============================================================================
  console.log('🦙 1. OLLAMA (Local LLMs)');
  console.log('----------------------------------------');
  
  try {
    // List available Ollama models
    console.log('Listing Ollama models...');
    const ollamaModels = await aiHandlers.nexusOllamaListModels({ detailed: false });
    if (ollamaModels.success) {
      console.log(`✅ Found ${ollamaModels.data.models.length} models`);
      console.log('Models:', ollamaModels.data.models.map(m => m.name).join(', '));
    } else {
      console.log('⚠️  Ollama not available (requires local installation)');
    }
  } catch (error) {
    console.log('⚠️  Ollama not configured or not running');
  }
  console.log();

  // ============================================================================
  // 2. GEMINI (Google AI)
  // ============================================================================
  console.log('🔮 2. GEMINI (Google AI)');
  console.log('----------------------------------------');
  
  try {
    // List available Gemini models
    console.log('Listing Gemini models...');
    const geminiModels = await aiHandlers.nexusGeminiListModels({});
    if (geminiModels.success) {
      console.log(`✅ Available models:`, geminiModels.data.models.map(m => m.name).join(', '));
    }

    // Chat with Gemini
    console.log('\nChatting with Gemini...');
    const geminiChat = await aiHandlers.nexusGeminiChat({
      prompt: 'What is Nexus-MCP in one sentence?',
      model: 'gemini-pro',
      temperature: 0.7,
      topP: 0.9,
      maxOutputTokens: 100
    });
    
    if (geminiChat.success) {
      console.log('✅ Response:', geminiChat.data.response);
    } else {
      console.log('⚠️  Gemini API key not configured');
    }
  } catch (error) {
    console.log('⚠️  Gemini not configured');
  }
  console.log();

  // ============================================================================
  // 3. OPENAI (GPT Models)
  // ============================================================================
  console.log('🤖 3. OPENAI (GPT Models)');
  console.log('----------------------------------------');
  
  try {
    // List available OpenAI models
    console.log('Listing OpenAI models...');
    const openaiModels = await aiHandlers.nexusOpenAIListModels({});
    if (openaiModels.success) {
      console.log(`✅ Found ${openaiModels.data.models.length} models`);
      console.log('First 5:', openaiModels.data.models.slice(0, 5).map(m => m.id).join(', '));
    }

    // Chat with OpenAI
    console.log('\nChatting with GPT-3.5-turbo...');
    const openaiChat = await aiHandlers.nexusOpenAIChat({
      prompt: 'What is Nexus-MCP in one sentence?',
      model: 'gpt-3.5-turbo',
      temperature: 0.7,
      maxTokens: 100,
      stream: false
    });
    
    if (openaiChat.success) {
      console.log('✅ Response:', openaiChat.data.response);
      console.log('Tokens used:', openaiChat.data.usage);
    } else {
      console.log('⚠️  OpenAI API key not configured');
    }
  } catch (error) {
    console.log('⚠️  OpenAI not configured');
  }
  console.log();

  // ============================================================================
  // 4. ANTHROPIC (Claude Models)
  // ============================================================================
  console.log('🧠 4. ANTHROPIC (Claude Models)');
  console.log('----------------------------------------');
  
  try {
    // List available Anthropic models
    console.log('Listing Anthropic models...');
    const anthropicModels = await aiHandlers.nexusAnthropicListModels({});
    if (anthropicModels.success) {
      console.log(`✅ Available models:`, anthropicModels.data.models.map(m => m.name).join(', '));
    }

    // Chat with Anthropic
    console.log('\nChatting with Claude...');
    const anthropicChat = await aiHandlers.nexusAnthropicChat({
      prompt: 'What is Nexus-MCP in one sentence?',
      model: 'claude-3-haiku-20240307',
      temperature: 0.7,
      maxTokens: 100,
      stream: false
    });
    
    if (anthropicChat.success) {
      console.log('✅ Response:', anthropicChat.data.response);
      console.log('Tokens used:', anthropicChat.data.usage);
    } else {
      console.log('⚠️  Anthropic API key not configured');
    }
  } catch (error) {
    console.log('⚠️  Anthropic not configured');
  }
  console.log();

  // ============================================================================
  // SUMMARY
  // ============================================================================
  console.log('=== Summary ===');
  console.log('To use AI tools, configure the following environment variables:');
  console.log('  - OLLAMA_HOST (for local LLMs)');
  console.log('  - GEMINI_API_KEY (for Google Gemini)');
  console.log('  - OPENAI_API_KEY (for OpenAI GPT)');
  console.log('  - ANTHROPIC_API_KEY (for Anthropic Claude)');
  console.log('\nThen run: npm start');
}

// Run the demo
demonstrateAITools().catch(console.error);
