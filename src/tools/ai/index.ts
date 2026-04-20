/**
 * AI Tools - Ollama and Gemini Integration
 * 
 * This module provides AI tools for:
 * - Ollama: Local LLM inference
 * - Gemini: Google AI integration
 * - Text generation, completion, and analysis
 * 
 * @module ai
 */

import { z } from 'zod';
import { Ollama } from 'ollama';
import { GoogleGenerativeAI } from '@google/generative-ai';
import OpenAI from 'openai';
import Anthropic from '@anthropic-ai/sdk';
import { handleError } from '../../utils/error-handler.js';
import { logger } from '../../logger.js';
import type { MCPTool, ToolResult } from '../../types.js';
import { ToolCategory } from '../../types.js';

// ============================================================================
// Ollama Client
// ============================================================================

let ollamaClient: Ollama | null = null;

function getOllamaClient(): Ollama {
  if (!ollamaClient) {
    const ollamaHost = process.env.OLLAMA_HOST || 'http://localhost:11434';
    ollamaClient = new Ollama({ host: ollamaHost });
  }
  return ollamaClient;
}

// ============================================================================
// Gemini Client
// ============================================================================

let geminiClient: GoogleGenerativeAI | null = null;

function getGeminiClient(): GoogleGenerativeAI {
  if (!geminiClient) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error('GEMINI_API_KEY environment variable is required');
    }
    geminiClient = new GoogleGenerativeAI(apiKey);
  }
  return geminiClient;
}

// ============================================================================
// OpenAI Client
// ============================================================================

let openaiClient: OpenAI | null = null;

function getOpenAIClient(): OpenAI {
  if (!openaiClient) {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error('OPENAI_API_KEY environment variable is required');
    }
    openaiClient = new OpenAI({ apiKey });
  }
  return openaiClient;
}

// ============================================================================
// Anthropic Client
// ============================================================================

let anthropicClient: Anthropic | null = null;

function getAnthropicClient(): Anthropic {
  if (!anthropicClient) {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      throw new Error('ANTHROPIC_API_KEY environment variable is required');
    }
    anthropicClient = new Anthropic({ apiKey });
  }
  return anthropicClient;
}

// ============================================================================
// Schemas
// ============================================================================

const ChatMessageSchema = z.object({
  role: z.enum(['user', 'assistant', 'system']).describe('Message role'),
  content: z.string().describe('Message content')
});

const OllamaChatSchema = z.object({
  prompt: z.string().optional().describe('The prompt to send to the model (ignored when messages is provided)'),
  messages: z.array(ChatMessageSchema).optional().describe('Conversation history for multi-turn chat'),
  model: z.string().default('llama3.2').describe('Ollama model name (e.g., llama3.2, mistral, codellama)'),
  stream: z.boolean().default(false).describe('Whether to stream the response'),
  options: z.object({
    temperature: z.number().min(0).max(1).default(0.7).optional(),
    top_p: z.number().min(0).max(1).default(0.9).optional(),
    num_predict: z.number().int().positive().default(128).optional(),
  }).optional().describe('Generation options')
}).refine(data => data.prompt || (data.messages && data.messages.length > 0), {
  message: 'Either prompt or messages must be provided'
});

const OllamaListModelsSchema = z.object({
  detailed: z.boolean().default(false).describe('Whether to return detailed model information')
});

const GeminiChatSchema = z.object({
  prompt: z.string().optional().describe('The prompt to send to the model (ignored when messages is provided)'),
  messages: z.array(ChatMessageSchema).optional().describe('Conversation history for multi-turn chat'),
  model: z.string().default('gemini-1.5-flash').describe('Gemini model name (e.g., gemini-1.5-flash, gemini-1.5-pro, gemini-2.0-flash)'),
  temperature: z.number().min(0).max(2).default(0.7).describe('Temperature for generation'),
  topP: z.number().min(0).max(1).default(0.9).describe('Top P for generation'),
  maxOutputTokens: z.number().int().positive().default(1024).describe('Maximum output tokens')
}).refine(data => data.prompt || (data.messages && data.messages.length > 0), {
  message: 'Either prompt or messages must be provided'
});

const GeminiListModelsSchema = z.object({});

const OpenAIChatSchema = z.object({
  prompt: z.string().optional().describe('The prompt to send to the model (ignored when messages is provided)'),
  messages: z.array(ChatMessageSchema).optional().describe('Conversation history for multi-turn chat'),
  model: z.string().default('gpt-4o-mini').describe('OpenAI model name (e.g., gpt-4o-mini, gpt-4o, gpt-4-turbo)'),
  temperature: z.number().min(0).max(2).default(0.7).describe('Temperature for generation'),
  maxTokens: z.number().int().positive().default(1024).describe('Maximum tokens to generate'),
  stream: z.boolean().default(false).describe('Whether to stream the response')
}).refine(data => data.prompt || (data.messages && data.messages.length > 0), {
  message: 'Either prompt or messages must be provided'
});

const OpenAIListModelsSchema = z.object({});

const AnthropicChatSchema = z.object({
  prompt: z.string().optional().describe('The prompt to send to the model (ignored when messages is provided)'),
  messages: z.array(ChatMessageSchema).optional().describe('Conversation history for multi-turn chat'),
  model: z.string().default('claude-3-5-haiku-20241022').describe('Anthropic model name (e.g., claude-3-5-haiku-20241022, claude-3-5-sonnet-20241022, claude-3-7-sonnet-20250219)'),
  temperature: z.number().min(0).max(1).default(0.7).describe('Temperature for generation'),
  maxTokens: z.number().int().positive().default(1024).describe('Maximum tokens to generate'),
  stream: z.boolean().default(false).describe('Whether to stream the response')
}).refine(data => data.prompt || (data.messages && data.messages.length > 0), {
  message: 'Either prompt or messages must be provided'
});

const AnthropicListModelsSchema = z.object({});

// ============================================================================
// Handlers
// ============================================================================

/**
 * Chat with Ollama model
 */
async function nexusOllamaChat(args: unknown): Promise<ToolResult> {
  try {
    const parsed = OllamaChatSchema.parse(args);
    logger.info('Ollama chat request', { model: parsed.model });

    const ollama = getOllamaClient();
    const messages = parsed.messages
      ? parsed.messages.map(m => ({ role: m.role as 'user' | 'assistant' | 'system', content: m.content }))
      : [{ role: 'user' as const, content: parsed.prompt! }];

    if (parsed.stream) {
      const response = await ollama.chat({
        model: parsed.model,
        messages,
        stream: true,
        options: parsed.options
      });

      let fullResponse = '';
      for await (const part of response) {
        fullResponse += part.message.content;
      }

      return {
        success: true,
        data: { response: fullResponse, model: parsed.model, provider: 'ollama', streamed: true }
      };
    } else {
      const response = await ollama.chat({
        model: parsed.model,
        messages,
        stream: false,
        options: parsed.options
      });

      return {
        success: true,
        data: {
          response: response.message.content,
          model: parsed.model,
          provider: 'ollama',
          streamed: false,
          done: response.done
        }
      };
    }
  } catch (error) {
    const handlingResult = handleError(error as Error);
    logger.error('Ollama chat error', { error: handlingResult.error?.message });
    return { success: false, error: handlingResult.error };
  }
}

/**
 * List available Ollama models
 */
async function nexusOllamaListModels(args: unknown): Promise<ToolResult> {
  try {
    const parsed = OllamaListModelsSchema.parse(args);
    logger.info('Ollama list models request');

    const ollama = getOllamaClient();
    const models = await ollama.list();

    if (parsed.detailed) {
      return {
        success: true,
        data: {
          models: models.models,
          provider: 'ollama',
          detailed: true
        }
      };
    } else {
      return {
        success: true,
        data: {
          models: models.models.map((m: any) => ({
            name: m.name,
            modified: m.modified,
            size: m.size
          })),
          provider: 'ollama',
          detailed: false
        }
      };
    }
  } catch (error) {
    const handlingResult = handleError(error as Error);
    logger.error('Ollama list models error', { error: handlingResult.error?.message });
    return {
      success: false,
      error: handlingResult.error
    };
  }
}

/**
 * Chat with Gemini model
 */
async function nexusGeminiChat(args: unknown): Promise<ToolResult> {
  try {
    const parsed = GeminiChatSchema.parse(args);
    logger.info('Gemini chat request', { model: parsed.model });

    const genAI = getGeminiClient();
    const genModel = genAI.getGenerativeModel({
      model: parsed.model,
      generationConfig: {
        temperature: parsed.temperature,
        topP: parsed.topP,
        maxOutputTokens: parsed.maxOutputTokens
      }
    });

    let text: string;
    let finishReason: any;
    let safetyRatings: any;

    if (parsed.messages && parsed.messages.length > 1) {
      // Multi-turn: use chat session
      const history = parsed.messages.slice(0, -1).map(m => ({
        role: m.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: m.content }]
      }));
      const lastMessage = parsed.messages[parsed.messages.length - 1]!;
      const chat = genModel.startChat({ history });
      const result = await chat.sendMessage(lastMessage.content);
      const response = await result.response;
      text = response.text();
      finishReason = response.candidates?.[0]?.finishReason;
      safetyRatings = response.candidates?.[0]?.safetyRatings;
    } else {
      const prompt = parsed.messages?.[0]?.content ?? parsed.prompt!;
      const result = await genModel.generateContent(prompt);
      const response = await result.response;
      text = response.text();
      finishReason = response.candidates?.[0]?.finishReason;
      safetyRatings = response.candidates?.[0]?.safetyRatings;
    }

    return {
      success: true,
      data: { response: text, model: parsed.model, provider: 'gemini', finishReason, safetyRatings }
    };
  } catch (error) {
    const handlingResult = handleError(error as Error);
    logger.error('Gemini chat error', { error: handlingResult.error?.message });
    return { success: false, error: handlingResult.error };
  }
}

/**
 * List available Gemini models
 */
async function nexusGeminiListModels(_args: unknown): Promise<ToolResult> {
  try {
    logger.info('Gemini list models request');

    // Gemini doesn't have a public listModels method, return current model list
    const models = [
      { name: 'gemini-2.0-flash',     displayName: 'Gemini 2.0 Flash',    description: 'Latest fast multimodal model' },
      { name: 'gemini-1.5-flash',     displayName: 'Gemini 1.5 Flash',    description: 'Fast and versatile model' },
      { name: 'gemini-1.5-pro',       displayName: 'Gemini 1.5 Pro',      description: 'Complex reasoning model' },
      { name: 'gemini-1.5-flash-8b',  displayName: 'Gemini 1.5 Flash 8B', description: 'Lightweight model for high-volume tasks' }
    ];

    return {
      success: true,
      data: {
        models: models,
        provider: 'gemini'
      }
    };
  } catch (error) {
    const handlingResult = handleError(error as Error);
    logger.error('Gemini list models error', { error: handlingResult.error?.message });
    return {
      success: false,
      error: handlingResult.error
    };
  }
}

/**
 * Chat with OpenAI model
 */
async function nexusOpenAIChat(args: unknown): Promise<ToolResult> {
  try {
    const parsed = OpenAIChatSchema.parse(args);
    logger.info('OpenAI chat request', { model: parsed.model });

    const openai = getOpenAIClient();
    const messages = parsed.messages
      ? parsed.messages.map(m => ({ role: m.role as 'user' | 'assistant' | 'system', content: m.content }))
      : [{ role: 'user' as const, content: parsed.prompt! }];

    if (parsed.stream) {
      const response = await openai.chat.completions.create({
        model: parsed.model,
        messages,
        temperature: parsed.temperature,
        max_completion_tokens: parsed.maxTokens,
        stream: true
      });

      let fullResponse = '';
      for await (const chunk of response) {
        fullResponse += chunk.choices[0]?.delta?.content || '';
      }

      return {
        success: true,
        data: { response: fullResponse, model: parsed.model, provider: 'openai', streamed: true }
      };
    } else {
      const response = await openai.chat.completions.create({
        model: parsed.model,
        messages,
        temperature: parsed.temperature,
        max_completion_tokens: parsed.maxTokens,
        stream: false
      });

      return {
        success: true,
        data: {
          response: response.choices[0]?.message?.content || '',
          model: parsed.model,
          provider: 'openai',
          streamed: false,
          finishReason: response.choices[0]?.finish_reason,
          usage: response.usage
        }
      };
    }
  } catch (error) {
    const handlingResult = handleError(error as Error);
    logger.error('OpenAI chat error', { error: handlingResult.error?.message });
    return { success: false, error: handlingResult.error };
  }
}

/**
 * List available OpenAI models
 */
async function nexusOpenAIListModels(_args: unknown): Promise<ToolResult> {
  try {
    logger.info('OpenAI list models request');

    const openai = getOpenAIClient();
    const models = await openai.models.list();

    return {
      success: true,
      data: {
        models: models.data.map((m: any) => ({
          id: m.id,
          created: m.created,
          owned_by: m.owned_by
        })),
        provider: 'openai'
      }
    };
  } catch (error) {
    const handlingResult = handleError(error as Error);
    logger.error('OpenAI list models error', { error: handlingResult.error?.message });
    return {
      success: false,
      error: handlingResult.error
    };
  }
}

/**
 * Chat with Anthropic model
 */
async function nexusAnthropicChat(args: unknown): Promise<ToolResult> {
  try {
    const parsed = AnthropicChatSchema.parse(args);
    logger.info('Anthropic chat request', { model: parsed.model });

    const anthropic = getAnthropicClient();
    const messages = parsed.messages
      ? parsed.messages
          .filter(m => m.role !== 'system')
          .map(m => ({ role: m.role as 'user' | 'assistant', content: m.content }))
      : [{ role: 'user' as const, content: parsed.prompt! }];
    const systemMessage = parsed.messages?.find(m => m.role === 'system')?.content;

    if (parsed.stream) {
      const response = await anthropic.messages.create({
        model: parsed.model,
        messages,
        ...(systemMessage && { system: systemMessage }),
        temperature: parsed.temperature,
        max_tokens: parsed.maxTokens,
        stream: true
      });

      let fullResponse = '';
      for await (const chunk of response) {
        if (chunk.type === 'content_block_delta' && chunk.delta.type === 'text_delta') {
          fullResponse += chunk.delta.text;
        }
      }

      return {
        success: true,
        data: { response: fullResponse, model: parsed.model, provider: 'anthropic', streamed: true }
      };
    } else {
      const response = await anthropic.messages.create({
        model: parsed.model,
        messages,
        ...(systemMessage && { system: systemMessage }),
        temperature: parsed.temperature,
        max_tokens: parsed.maxTokens,
        stream: false
      });

      return {
        success: true,
        data: {
          response: response.content[0]?.type === 'text' ? response.content[0].text : '',
          model: parsed.model,
          provider: 'anthropic',
          streamed: false,
          usage: response.usage
        }
      };
    }
  } catch (error) {
    const handlingResult = handleError(error as Error);
    logger.error('Anthropic chat error', { error: handlingResult.error?.message });
    return { success: false, error: handlingResult.error };
  }
}

/**
 * List available Anthropic models
 */
async function nexusAnthropicListModels(_args: unknown): Promise<ToolResult> {
  try {
    logger.info('Anthropic list models request');

    // Anthropic doesn't have a public listModels method, return current model list
    const models = [
      { name: 'claude-3-7-sonnet-20250219', displayName: 'Claude 3.7 Sonnet',   description: 'Most intelligent model with extended thinking' },
      { name: 'claude-3-5-sonnet-20241022', displayName: 'Claude 3.5 Sonnet',   description: 'High intelligence, fast response' },
      { name: 'claude-3-5-haiku-20241022',  displayName: 'Claude 3.5 Haiku',    description: 'Fastest and most compact model' },
      { name: 'claude-3-opus-20240229',     displayName: 'Claude 3 Opus',        description: 'Powerful model for complex tasks (legacy)' }
    ];

    return {
      success: true,
      data: {
        models: models,
        provider: 'anthropic'
      }
    };
  } catch (error) {
    const handlingResult = handleError(error as Error);
    logger.error('Anthropic list models error', { error: handlingResult.error?.message });
    return {
      success: false,
      error: handlingResult.error
    };
  }
}

// ============================================================================
// Tool Definitions
// ============================================================================

export const aiTools: MCPTool[] = [
  {
    name: 'nexus_ollama_chat',
    description: 'Chat with Ollama local LLM models',
    category: ToolCategory.AI,
    version: '1.0.0',
    inputSchema: OllamaChatSchema,
    handler: nexusOllamaChat,
    tags: ['ollama', 'llm', 'chat', 'local']
  },
  {
    name: 'nexus_ollama_list_models',
    description: 'List available Ollama models',
    category: ToolCategory.AI,
    version: '1.0.0',
    inputSchema: OllamaListModelsSchema,
    handler: nexusOllamaListModels,
    tags: ['ollama', 'models', 'list']
  },
  {
    name: 'nexus_gemini_chat',
    description: 'Chat with Google Gemini AI models',
    category: ToolCategory.AI,
    version: '1.0.0',
    inputSchema: GeminiChatSchema,
    handler: nexusGeminiChat,
    tags: ['gemini', 'llm', 'chat', 'google']
  },
  {
    name: 'nexus_gemini_list_models',
    description: 'List available Gemini models',
    category: ToolCategory.AI,
    version: '1.0.0',
    inputSchema: GeminiListModelsSchema,
    handler: nexusGeminiListModels,
    tags: ['gemini', 'models', 'list', 'google']
  },
  {
    name: 'nexus_openai_chat',
    description: 'Chat with OpenAI GPT models',
    category: ToolCategory.AI,
    version: '1.0.0',
    inputSchema: OpenAIChatSchema,
    handler: nexusOpenAIChat,
    tags: ['openai', 'llm', 'chat', 'gpt']
  },
  {
    name: 'nexus_openai_list_models',
    description: 'List available OpenAI models',
    category: ToolCategory.AI,
    version: '1.0.0',
    inputSchema: OpenAIListModelsSchema,
    handler: nexusOpenAIListModels,
    tags: ['openai', 'models', 'list', 'gpt']
  },
  {
    name: 'nexus_anthropic_chat',
    description: 'Chat with Anthropic Claude models',
    category: ToolCategory.AI,
    version: '1.0.0',
    inputSchema: AnthropicChatSchema,
    handler: nexusAnthropicChat,
    tags: ['anthropic', 'llm', 'chat', 'claude']
  },
  {
    name: 'nexus_anthropic_list_models',
    description: 'List available Anthropic models',
    category: ToolCategory.AI,
    version: '1.0.0',
    inputSchema: AnthropicListModelsSchema,
    handler: nexusAnthropicListModels,
    tags: ['anthropic', 'models', 'list', 'claude']
  }
];

// ============================================================================
// Export handlers for testing
// ============================================================================

export const aiHandlers = {
  nexusOllamaChat,
  nexusOllamaListModels,
  nexusGeminiChat,
  nexusGeminiListModels,
  nexusOpenAIChat,
  nexusOpenAIListModels,
  nexusAnthropicChat,
  nexusAnthropicListModels
};
