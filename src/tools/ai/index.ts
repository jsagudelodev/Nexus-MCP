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
import ollama from 'ollama';
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

let ollamaClient: any = null;

function getOllamaClient(): any {
  if (!ollamaClient) {
    const ollamaHost = process.env.OLLAMA_HOST || 'http://localhost:11434';
    // @ts-ignore - ollama library may not have perfect TypeScript types
    ollamaClient = new ollama({ host: ollamaHost });
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

const OllamaChatSchema = z.object({
  prompt: z.string().describe('The prompt to send to the model'),
  model: z.string().default('llama2').describe('Ollama model name (e.g., llama2, mistral, codellama)'),
  stream: z.boolean().default(false).describe('Whether to stream the response'),
  options: z.object({
    temperature: z.number().min(0).max(1).default(0.7).optional(),
    top_p: z.number().min(0).max(1).default(0.9).optional(),
    num_predict: z.number().int().positive().default(128).optional(),
  }).optional().describe('Generation options')
});

const OllamaListModelsSchema = z.object({
  detailed: z.boolean().default(false).describe('Whether to return detailed model information')
});

const GeminiChatSchema = z.object({
  prompt: z.string().describe('The prompt to send to the model'),
  model: z.string().default('gemini-pro').describe('Gemini model name (e.g., gemini-pro, gemini-pro-vision)'),
  temperature: z.number().min(0).max(2).default(0.7).describe('Temperature for generation'),
  topP: z.number().min(0).max(1).default(0.9).describe('Top P for generation'),
  maxOutputTokens: z.number().int().positive().default(1024).describe('Maximum output tokens')
});

const GeminiListModelsSchema = z.object({});

const OpenAIChatSchema = z.object({
  prompt: z.string().describe('The prompt to send to the model'),
  model: z.string().default('gpt-3.5-turbo').describe('OpenAI model name (e.g., gpt-3.5-turbo, gpt-4)'),
  temperature: z.number().min(0).max(2).default(0.7).describe('Temperature for generation'),
  maxTokens: z.number().int().positive().default(1024).describe('Maximum tokens to generate'),
  stream: z.boolean().default(false).describe('Whether to stream the response')
});

const OpenAIListModelsSchema = z.object({});

const AnthropicChatSchema = z.object({
  prompt: z.string().describe('The prompt to send to the model'),
  model: z.string().default('claude-3-haiku-20240307').describe('Anthropic model name (e.g., claude-3-haiku, claude-3-sonnet, claude-3-opus)'),
  temperature: z.number().min(0).max(1).default(0.7).describe('Temperature for generation'),
  maxTokens: z.number().int().positive().default(1024).describe('Maximum tokens to generate'),
  stream: z.boolean().default(false).describe('Whether to stream the response')
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
    logger.info('Ollama chat request', { model: parsed.model, prompt: parsed.prompt.substring(0, 50) });

    const ollama = getOllamaClient();
    
    if (parsed.stream) {
      // Streaming response
      const response = await ollama.chat({
        model: parsed.model,
        messages: [{ role: 'user', content: parsed.prompt }],
        stream: true,
        options: parsed.options
      });

      let fullResponse = '';
      for await (const part of response) {
        fullResponse += part.message.content;
      }

      return {
        success: true,
        data: {
          response: fullResponse,
          model: parsed.model,
          provider: 'ollama',
          streamed: true
        }
      };
    } else {
      // Non-streaming response
      const response = await ollama.chat({
        model: parsed.model,
        messages: [{ role: 'user', content: parsed.prompt }],
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
          done: response.done,
          context: response.context
        }
      };
    }
  } catch (error) {
    const handlingResult = handleError(error as Error);
    logger.error('Ollama chat error', { error: handlingResult.error?.message });
    return {
      success: false,
      error: handlingResult.error
    };
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
    logger.info('Gemini chat request', { model: parsed.model, prompt: parsed.prompt.substring(0, 50) });

    const genAI = getGeminiClient();
    const model = genAI.getGenerativeModel({ 
      model: parsed.model,
      generationConfig: {
        temperature: parsed.temperature,
        topP: parsed.topP,
        maxOutputTokens: parsed.maxOutputTokens
      }
    });

    const result = await model.generateContent(parsed.prompt);
    const response = await result.response;
    const text = response.text();

    return {
      success: true,
      data: {
        response: text,
        model: parsed.model,
        provider: 'gemini',
        finishReason: result.response.candidates?.[0]?.finishReason,
        safetyRatings: result.response.candidates?.[0]?.safetyRatings
      }
    };
  } catch (error) {
    const handlingResult = handleError(error as Error);
    logger.error('Gemini chat error', { error: handlingResult.error?.message });
    return {
      success: false,
      error: handlingResult.error
    };
  }
}

/**
 * List available Gemini models
 */
async function nexusGeminiListModels(_args: unknown): Promise<ToolResult> {
  try {
    logger.info('Gemini list models request');

    // Gemini doesn't have a listModels method, return static list
    const models = [
      { name: 'gemini-pro', displayName: 'Gemini Pro', description: 'General purpose model' },
      { name: 'gemini-pro-vision', displayName: 'Gemini Pro Vision', description: 'Multimodal model' },
      { name: 'gemini-1.5-pro', displayName: 'Gemini 1.5 Pro', description: 'Latest Gemini model' }
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
    logger.info('OpenAI chat request', { model: parsed.model, prompt: parsed.prompt.substring(0, 50) });

    const openai = getOpenAIClient();
    
    if (parsed.stream) {
      // Streaming response
      const response = await openai.chat.completions.create({
        model: parsed.model,
        messages: [{ role: 'user', content: parsed.prompt }],
        temperature: parsed.temperature,
        max_tokens: parsed.maxTokens,
        stream: true
      });

      let fullResponse = '';
      for await (const chunk of response) {
        const content = chunk.choices[0]?.delta?.content || '';
        fullResponse += content;
      }

      return {
        success: true,
        data: {
          response: fullResponse,
          model: parsed.model,
          provider: 'openai',
          streamed: true
        }
      };
    } else {
      // Non-streaming response
      const response = await openai.chat.completions.create({
        model: parsed.model,
        messages: [{ role: 'user', content: parsed.prompt }],
        temperature: parsed.temperature,
        max_tokens: parsed.maxTokens,
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
    return {
      success: false,
      error: handlingResult.error
    };
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
    logger.info('Anthropic chat request', { model: parsed.model, prompt: parsed.prompt.substring(0, 50) });

    const anthropic = getAnthropicClient();
    
    if (parsed.stream) {
      // Streaming response
      const response = await anthropic.messages.create({
        model: parsed.model,
        messages: [{ role: 'user', content: parsed.prompt }],
        temperature: parsed.temperature,
        max_tokens: parsed.maxTokens,
        stream: true
      });

      let fullResponse = '';
      for await (const chunk of response) {
        if (chunk.type === 'content_block_delta') {
          fullResponse += chunk.delta.text;
        }
      }

      return {
        success: true,
        data: {
          response: fullResponse,
          model: parsed.model,
          provider: 'anthropic',
          streamed: true
        }
      };
    } else {
      // Non-streaming response
      const response = await anthropic.messages.create({
        model: parsed.model,
        messages: [{ role: 'user', content: parsed.prompt }],
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
    return {
      success: false,
      error: handlingResult.error
    };
  }
}

/**
 * List available Anthropic models
 */
async function nexusAnthropicListModels(_args: unknown): Promise<ToolResult> {
  try {
    logger.info('Anthropic list models request');

    // Anthropic doesn't have a listModels method, return static list
    const models = [
      { name: 'claude-3-haiku-20240307', displayName: 'Claude 3 Haiku', description: 'Fast and efficient model' },
      { name: 'claude-3-sonnet-20240229', displayName: 'Claude 3 Sonnet', description: 'Balanced performance model' },
      { name: 'claude-3-opus-20240229', displayName: 'Claude 3 Opus', description: 'Most capable model' }
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
