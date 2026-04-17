import { z } from 'zod';
import * as crypto from 'crypto';
import type { MCPTool, ToolResult } from '../../types.js';
import { ToolCategory } from '../../types.js';
import { logger } from '../../logger.js';
import { handleError } from '../../utils/error-handler.js';

// ============================================================================
// Utilities Category
// ============================================================================

const UTILITIES_CATEGORY: ToolCategory = ToolCategory.UTILITIES;

// ============================================================================
// Zod Schemas
// ============================================================================

/**
 * Schema for nexus_json_parse
 */
const JsonParseSchema = z.object({
  json: z.string().min(1, 'JSON string is required')
});

/**
 * Schema for nexus_json_stringify
 */
const JsonStringifySchema = z.object({
  data: z.any(),
  pretty: z.boolean().default(false)
});

/**
 * Schema for nexus_base64_encode
 */
const Base64EncodeSchema = z.object({
  text: z.string().min(1, 'Text is required')
});

/**
 * Schema for nexus_base64_decode
 */
const Base64DecodeSchema = z.object({
  encoded: z.string().min(1, 'Base64 encoded string is required')
});

/**
 * Schema for nexus_hash_generate
 */
const HashGenerateSchema = z.object({
  text: z.string().min(1, 'Text is required'),
  algorithm: z.enum(['md5', 'sha1', 'sha256', 'sha512']).default('sha256')
});

/**
 * Schema for nexus_uuid_generate
 */
const UuidGenerateSchema = z.object({});

/**
 * Schema for nexus_timestamp
 */
const TimestampSchema = z.object({
  format: z.enum(['iso', 'unix', 'unix-ms', 'date', 'time', 'datetime']).default('iso')
});

/**
 * Schema for nexus_url_parse
 */
const UrlParseSchema = z.object({
  url: z.string().url('Invalid URL format')
});

// ============================================================================
// Tool Implementations
// ============================================================================

/**
 * Parse JSON string
 */
async function jsonParse(args: unknown): Promise<ToolResult<unknown>> {
  const validated = JsonParseSchema.parse(args);
  const { json } = validated;
  
  logger.info('nexus_json_parse started');
  
  try {
    const parsed = JSON.parse(json);
    
    logger.info('nexus_json_parse succeeded');
    
    return {
      success: true,
      data: {
        parsed,
        type: typeof parsed,
        isArray: Array.isArray(parsed),
        isObject: typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)
      }
    };
  } catch (error) {
    const handlingResult = handleError(error as Error, { json });
    logger.error('nexus_json_parse failed', { error: handlingResult.error });
    return { success: false, error: handlingResult.error };
  }
}

/**
 * Stringify data to JSON
 */
async function jsonStringify(args: unknown): Promise<ToolResult<unknown>> {
  const validated = JsonStringifySchema.parse(args);
  const { data, pretty } = validated;
  
  logger.info('nexus_json_stringify started', { pretty });
  
  try {
    const jsonString = pretty ? JSON.stringify(data, null, 2) : JSON.stringify(data);
    
    logger.info('nexus_json_stringify succeeded');
    
    return {
      success: true,
      data: {
        json: jsonString,
        pretty,
        length: jsonString.length
      }
    };
  } catch (error) {
    const handlingResult = handleError(error as Error);
    logger.error('nexus_json_stringify failed', { error: handlingResult.error });
    return { success: false, error: handlingResult.error };
  }
}

/**
 * Encode text to Base64
 */
async function base64Encode(args: unknown): Promise<ToolResult<unknown>> {
  const validated = Base64EncodeSchema.parse(args);
  const { text } = validated;
  
  logger.info('nexus_base64_encode started');
  
  try {
    const encoded = Buffer.from(text, 'utf-8').toString('base64');
    
    logger.info('nexus_base64_encode succeeded');
    
    return {
      success: true,
      data: {
        original: text,
        encoded,
        length: encoded.length
      }
    };
  } catch (error) {
    const handlingResult = handleError(error as Error, { text });
    logger.error('nexus_base64_encode failed', { error: handlingResult.error });
    return { success: false, error: handlingResult.error };
  }
}

/**
 * Decode Base64 to text
 */
async function base64Decode(args: unknown): Promise<ToolResult<unknown>> {
  const validated = Base64DecodeSchema.parse(args);
  const { encoded } = validated;
  
  logger.info('nexus_base64_decode started');
  
  try {
    const decoded = Buffer.from(encoded, 'base64').toString('utf-8');
    
    logger.info('nexus_base64_decode succeeded');
    
    return {
      success: true,
      data: {
        encoded,
        decoded,
        length: decoded.length
      }
    };
  } catch (error) {
    const handlingResult = handleError(error as Error, { encoded });
    logger.error('nexus_base64_decode failed', { error: handlingResult.error });
    return { success: false, error: handlingResult.error };
  }
}

/**
 * Generate hash of text
 */
async function hashGenerate(args: unknown): Promise<ToolResult<unknown>> {
  const validated = HashGenerateSchema.parse(args);
  const { text, algorithm } = validated;
  
  logger.info('nexus_hash_generate started', { algorithm });
  
  try {
    const hash = crypto.createHash(algorithm).update(text).digest('hex');
    
    logger.info('nexus_hash_generate succeeded');
    
    return {
      success: true,
      data: {
        algorithm,
        text,
        hash,
        length: hash.length
      }
    };
  } catch (error) {
    const handlingResult = handleError(error as Error, { algorithm });
    logger.error('nexus_hash_generate failed', { error: handlingResult.error });
    return { success: false, error: handlingResult.error };
  }
}

/**
 * Generate UUID v4
 */
async function uuidGenerate(_args: unknown): Promise<ToolResult<unknown>> {
  logger.info('nexus_uuid_generate started');
  
  try {
    const uuid = crypto.randomUUID();
    
    logger.info('nexus_uuid_generate succeeded');
    
    return {
      success: true,
      data: {
        uuid,
        version: 4
      }
    };
  } catch (error) {
    const handlingResult = handleError(error as Error);
    logger.error('nexus_uuid_generate failed', { error: handlingResult.error });
    return { success: false, error: handlingResult.error };
  }
}

/**
 * Get current timestamp
 */
async function timestamp(args: unknown): Promise<ToolResult<unknown>> {
  const validated = TimestampSchema.parse(args);
  const { format } = validated;
  
  logger.info('nexus_timestamp started', { format });
  
  try {
    const now = new Date();
    let result: string;
    
    switch (format) {
      case 'iso':
        result = now.toISOString();
        break;
      case 'unix':
        result = Math.floor(now.getTime() / 1000).toString();
        break;
      case 'unix-ms':
        result = now.getTime().toString();
        break;
      case 'date':
        result = now.toISOString().split('T')[0] || now.toISOString();
        break;
      case 'time':
        const timePart = now.toISOString().split('T')[1];
        result = timePart ? (timePart.split('.')[0] || timePart) : now.toISOString();
        break;
      case 'datetime':
        result = now.toLocaleString();
        break;
      default:
        result = now.toISOString();
    }
    
    logger.info('nexus_timestamp succeeded');
    
    return {
      success: true,
      data: {
        format,
        timestamp: result,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone
      }
    };
  } catch (error) {
    const handlingResult = handleError(error as Error, { format });
    logger.error('nexus_timestamp failed', { error: handlingResult.error });
    return { success: false, error: handlingResult.error };
  }
}

/**
 * Parse URL
 */
async function urlParse(args: unknown): Promise<ToolResult<unknown>> {
  const validated = UrlParseSchema.parse(args);
  const { url } = validated;
  
  logger.info('nexus_url_parse started', { url });
  
  try {
    const parsedUrl = new URL(url);
    
    logger.info('nexus_url_parse succeeded');
    
    return {
      success: true,
      data: {
        href: parsedUrl.href,
        protocol: parsedUrl.protocol,
        host: parsedUrl.host,
        hostname: parsedUrl.hostname,
        port: parsedUrl.port,
        pathname: parsedUrl.pathname,
        search: parsedUrl.search,
        searchParams: Object.fromEntries(parsedUrl.searchParams),
        hash: parsedUrl.hash
      }
    };
  } catch (error) {
    const handlingResult = handleError(error as Error, { url });
    logger.error('nexus_url_parse failed', { error: handlingResult.error });
    return { success: false, error: handlingResult.error };
  }
}

// ============================================================================
// Utilities Tools Array
// ============================================================================

export const utilitiesTools: MCPTool[] = [
  // JSON Utilities (Fase 8.1)
  {
    name: 'nexus_json_parse',
    description: 'Parse JSON string to object',
    category: UTILITIES_CATEGORY,
    inputSchema: JsonParseSchema,
    handler: jsonParse,
    version: '1.0.0',
    tags: ['utilities', 'json', 'parse']
  },
  {
    name: 'nexus_json_stringify',
    description: 'Stringify data to JSON (with optional pretty print)',
    category: UTILITIES_CATEGORY,
    inputSchema: JsonStringifySchema,
    handler: jsonStringify,
    version: '1.0.0',
    tags: ['utilities', 'json', 'stringify']
  },
  // Encoding Utilities (Fase 8.2)
  {
    name: 'nexus_base64_encode',
    description: 'Encode text to Base64',
    category: UTILITIES_CATEGORY,
    inputSchema: Base64EncodeSchema,
    handler: base64Encode,
    version: '1.0.0',
    tags: ['utilities', 'encoding', 'base64']
  },
  {
    name: 'nexus_base64_decode',
    description: 'Decode Base64 to text',
    category: UTILITIES_CATEGORY,
    inputSchema: Base64DecodeSchema,
    handler: base64Decode,
    version: '1.0.0',
    tags: ['utilities', 'encoding', 'base64']
  },
  // Hash Utilities (Fase 8.3)
  {
    name: 'nexus_hash_generate',
    description: 'Generate hash of text (MD5, SHA1, SHA256, SHA512)',
    category: UTILITIES_CATEGORY,
    inputSchema: HashGenerateSchema,
    handler: hashGenerate,
    version: '1.0.0',
    tags: ['utilities', 'hash', 'crypto']
  },
  {
    name: 'nexus_uuid_generate',
    description: 'Generate UUID v4',
    category: UTILITIES_CATEGORY,
    inputSchema: UuidGenerateSchema,
    handler: uuidGenerate,
    version: '1.0.0',
    tags: ['utilities', 'uuid', 'crypto']
  },
  // Date/Time Utilities (Fase 8.4)
  {
    name: 'nexus_timestamp',
    description: 'Get current timestamp in various formats',
    category: UTILITIES_CATEGORY,
    inputSchema: TimestampSchema,
    handler: timestamp,
    version: '1.0.0',
    tags: ['utilities', 'timestamp', 'date']
  },
  // URL Utilities (Fase 8.5)
  {
    name: 'nexus_url_parse',
    description: 'Parse URL into components',
    category: UTILITIES_CATEGORY,
    inputSchema: UrlParseSchema,
    handler: urlParse,
    version: '1.0.0',
    tags: ['utilities', 'url', 'parse']
  }
];

export default utilitiesTools;
