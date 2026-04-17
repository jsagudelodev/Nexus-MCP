import { z } from 'zod';
import * as fs from 'fs/promises';
import * as path from 'path';
import type { MCPTool, ToolResult } from '../../types.js';
import { ToolCategory } from '../../types.js';
import { logger } from '../../logger.js';
import { handleError } from '../../utils/error-handler.js';
import { validatePath } from '../../utils/validation.js';
import { getConfig } from '../../config.js';

// ============================================================================
// Constants
// ============================================================================

const HTTP_CATEGORY: ToolCategory = ToolCategory.HTTP;

// ============================================================================
// Schemas
// ============================================================================

/**
 * Schema for nexus_http_get
 */
const HttpGetSchema = z.object({
  url: z.string().url('Invalid URL format'),
  headers: z.record(z.string()).optional(),
  timeout: z.number().int().positive().max(30000).default(5000),
  followRedirects: z.boolean().default(true),
  maxRedirects: z.number().int().positive().max(10).default(5)
});

/**
 * Schema for nexus_http_post
 */
const HttpPostSchema = z.object({
  url: z.string().url('Invalid URL format'),
  headers: z.record(z.string()).optional(),
  body: z.any().optional(),
  timeout: z.number().int().positive().max(30000).default(5000),
  followRedirects: z.boolean().default(true),
  maxRedirects: z.number().int().positive().max(10).default(5)
});

/**
 * Schema for nexus_http_put
 */
const HttpPutSchema = z.object({
  url: z.string().url('Invalid URL format'),
  headers: z.record(z.string()).optional(),
  body: z.any().optional(),
  timeout: z.number().int().positive().max(30000).default(5000),
  followRedirects: z.boolean().default(true),
  maxRedirects: z.number().int().positive().max(10).default(5)
});

/**
 * Schema for nexus_http_delete
 */
const HttpDeleteSchema = z.object({
  url: z.string().url('Invalid URL format'),
  headers: z.record(z.string()).optional(),
  body: z.any().optional(),
  timeout: z.number().int().positive().max(30000).default(5000),
  followRedirects: z.boolean().default(true),
  maxRedirects: z.number().int().positive().max(10).default(5)
});

/**
 * Schema for nexus_http_patch
 */
const HttpPatchSchema = z.object({
  url: z.string().url('Invalid URL format'),
  headers: z.record(z.string()).optional(),
  body: z.any().optional(),
  timeout: z.number().int().positive().max(30000).default(5000),
  followRedirects: z.boolean().default(true),
  maxRedirects: z.number().int().positive().max(10).default(5)
});

/**
 * Schema for nexus_http_head
 */
const HttpHeadSchema = z.object({
  url: z.string().url('Invalid URL format'),
  headers: z.record(z.string()).optional(),
  timeout: z.number().int().positive().max(30000).default(5000),
  followRedirects: z.boolean().default(true)
});

/**
 * Schema for nexus_http_options
 */
const HttpOptionsSchema = z.object({
  url: z.string().url('Invalid URL format'),
  headers: z.record(z.string()).optional(),
  timeout: z.number().int().positive().max(30000).default(5000),
  followRedirects: z.boolean().default(true)
});

/**
 * Schema for nexus_http_download
 */
const HttpDownloadSchema = z.object({
  url: z.string().url('Invalid URL format'),
  destination: z.string().min(1, 'Destination path is required'),
  headers: z.record(z.string()).optional(),
  timeout: z.number().int().positive().max(120000).default(30000),
  followRedirects: z.boolean().default(true)
});

/**
 * Schema for nexus_http_upload
 */
const HttpUploadSchema = z.object({
  url: z.string().url('Invalid URL format'),
  filePath: z.string().min(1, 'File path is required'),
  fieldName: z.string().default('file'),
  headers: z.record(z.string()).optional(),
  timeout: z.number().int().positive().max(120000).default(30000),
  followRedirects: z.boolean().default(true)
});

/**
 * Schema for nexus_extract_links
 */
const ExtractLinksSchema = z.object({
  html: z.string().min(1, 'HTML content is required'),
  baseUrl: z.string().url('Invalid URL format').optional()
});

/**
 * Schema for nexus_extract_images
 */
const ExtractImagesSchema = z.object({
  html: z.string().min(1, 'HTML content is required'),
  baseUrl: z.string().url('Invalid URL format').optional()
});

/**
 * Schema for nexus_parse_html
 */
const ParseHtmlSchema = z.object({
  html: z.string().min(1, 'HTML content is required'),
  extractTitle: z.boolean().default(true),
  extractMeta: z.boolean().default(true),
  extractLinks: z.boolean().default(false),
  extractImages: z.boolean().default(false)
});

/**
 * Schema for nexus_api_call
 */
const ApiCallSchema = z.object({
  baseUrl: z.string().url('Invalid base URL format'),
  endpoint: z.string().min(1, 'Endpoint is required'),
  method: z.enum(['GET', 'POST', 'PUT', 'DELETE', 'PATCH']).default('GET'),
  headers: z.record(z.string()).optional(),
  body: z.any().optional(),
  timeout: z.number().int().positive().max(30000).default(5000)
});

/**
 * Schema for nexus_api_auth
 */
const ApiAuthSchema = z.object({
  type: z.enum(['bearer', 'basic', 'api_key']),
  token: z.string().optional(),
  username: z.string().optional(),
  password: z.string().optional(),
  apiKey: z.string().optional(),
  keyName: z.string().default('X-API-Key')
});

/**
 * Schema for nexus_build_url
 */
const BuildUrlSchema = z.object({
  baseUrl: z.string().url('Invalid base URL format'),
  path: z.string().optional(),
  queryParams: z.record(z.string()).optional()
});

// ============================================================================
// Tool Implementations
// ============================================================================

/**
 * Perform HTTP GET request
 */
async function httpGet(args: unknown): Promise<ToolResult<unknown>> {
  const validated = HttpGetSchema.parse(args);
  const { url, headers, timeout, followRedirects } = validated;
  
  logger.info('nexus_http_get started', { url, timeout });
  
  try {
    // Validate URL against allowed domains
    const config = getConfig();
    const allowedDomains = config.tools.http.allowed_domains || [];
    const deniedDomains = config.tools.http.denied_domains || [];
    
    const domainValidation = validateUrlDomain(url, allowedDomains, deniedDomains);
    if (!domainValidation.valid) {
      logger.error('nexus_http_get failed', { error: domainValidation.error });
      return { success: false, error: new Error(domainValidation.error!) };
    }
    
    // Perform HTTP request using fetch
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);
    
    const response = await fetch(url, {
      method: 'GET',
      headers: headers || {},
      signal: controller.signal,
      redirect: followRedirects ? 'follow' : 'manual'
    });
    
    clearTimeout(timeoutId);
    
    // Get response data
    const status = response.status;
    const statusText = response.statusText;
    const responseHeaders: Record<string, string> = {};
    response.headers.forEach((value, key) => {
      responseHeaders[key] = value;
    });
    
    // Get response body
    const contentType = response.headers.get('content-type') || '';
    let body: any;
    
    if (contentType.includes('application/json')) {
      body = await response.json();
    } else if (contentType.includes('text/')) {
      body = await response.text();
    } else {
      body = await response.text();
    }
    
    logger.info('nexus_http_get succeeded', { status });
    
    return {
      success: true,
      data: {
        url,
        method: 'GET',
        status,
        statusText,
        headers: responseHeaders,
        body,
        contentType
      }
    };
  } catch (error) {
    const handlingResult = handleError(error as Error, { url });
    logger.error('nexus_http_get failed', { error: handlingResult.error });
    return { success: false, error: handlingResult.error };
  }
}

/**
 * Perform HTTP POST request
 */
async function httpPost(args: unknown): Promise<ToolResult<unknown>> {
  const validated = HttpPostSchema.parse(args);
  const { url, headers, body, timeout, followRedirects } = validated;
  
  logger.info('nexus_http_post started', { url, timeout });
  
  try {
    // Validate URL against allowed domains
    const config = getConfig();
    const allowedDomains = config.tools.http.allowed_domains || [];
    const deniedDomains = config.tools.http.denied_domains || [];
    
    const domainValidation = validateUrlDomain(url, allowedDomains, deniedDomains);
    if (!domainValidation.valid) {
      logger.error('nexus_http_post failed', { error: domainValidation.error });
      return { success: false, error: new Error(domainValidation.error!) };
    }
    
    // Prepare request headers
    const requestHeaders: Record<string, string> = headers || {};
    let requestBody: string | undefined;
    
    if (body !== undefined) {
      if (typeof body === 'object') {
        requestHeaders['Content-Type'] = 'application/json';
        requestBody = JSON.stringify(body);
      } else if (typeof body === 'string') {
        requestBody = body;
      }
    }
    
    // Perform HTTP request using fetch
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);
    
    const response = await fetch(url, {
      method: 'POST',
      headers: requestHeaders,
      body: requestBody,
      signal: controller.signal,
      redirect: followRedirects ? 'follow' : 'manual'
    });
    
    clearTimeout(timeoutId);
    
    // Get response data
    const status = response.status;
    const statusText = response.statusText;
    const responseHeaders: Record<string, string> = {};
    response.headers.forEach((value, key) => {
      responseHeaders[key] = value;
    });
    
    // Get response body
    const contentType = response.headers.get('content-type') || '';
    let responseBody: any;
    
    if (contentType.includes('application/json')) {
      responseBody = await response.json();
    } else if (contentType.includes('text/')) {
      responseBody = await response.text();
    } else {
      responseBody = await response.text();
    }
    
    logger.info('nexus_http_post succeeded', { status });
    
    return {
      success: true,
      data: {
        url,
        method: 'POST',
        status,
        statusText,
        headers: responseHeaders,
        body: responseBody,
        contentType
      }
    };
  } catch (error) {
    const handlingResult = handleError(error as Error, { url });
    logger.error('nexus_http_post failed', { error: handlingResult.error });
    return { success: false, error: handlingResult.error };
  }
}

/**
 * Perform HTTP PUT request
 */
async function httpPut(args: unknown): Promise<ToolResult<unknown>> {
  const validated = HttpPutSchema.parse(args);
  const { url, headers, body, timeout, followRedirects } = validated;
  
  logger.info('nexus_http_put started', { url, timeout });
  
  try {
    // Validate URL against allowed domains
    const config = getConfig();
    const allowedDomains = config.tools.http.allowed_domains || [];
    const deniedDomains = config.tools.http.denied_domains || [];
    
    const domainValidation = validateUrlDomain(url, allowedDomains, deniedDomains);
    if (!domainValidation.valid) {
      logger.error('nexus_http_put failed', { error: domainValidation.error });
      return { success: false, error: new Error(domainValidation.error!) };
    }
    
    // Prepare request headers
    const requestHeaders: Record<string, string> = headers || {};
    let requestBody: string | undefined;
    
    if (body !== undefined) {
      if (typeof body === 'object') {
        requestHeaders['Content-Type'] = 'application/json';
        requestBody = JSON.stringify(body);
      } else if (typeof body === 'string') {
        requestBody = body;
      }
    }
    
    // Perform HTTP request using fetch
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);
    
    const response = await fetch(url, {
      method: 'PUT',
      headers: requestHeaders,
      body: requestBody,
      signal: controller.signal,
      redirect: followRedirects ? 'follow' : 'manual'
    });
    
    clearTimeout(timeoutId);
    
    // Get response data
    const status = response.status;
    const statusText = response.statusText;
    const responseHeaders: Record<string, string> = {};
    response.headers.forEach((value, key) => {
      responseHeaders[key] = value;
    });
    
    // Get response body
    const contentType = response.headers.get('content-type') || '';
    let responseBody: any;
    
    if (contentType.includes('application/json')) {
      responseBody = await response.json();
    } else if (contentType.includes('text/')) {
      responseBody = await response.text();
    } else {
      responseBody = await response.text();
    }
    
    logger.info('nexus_http_put succeeded', { status });
    
    return {
      success: true,
      data: {
        url,
        method: 'PUT',
        status,
        statusText,
        headers: responseHeaders,
        body: responseBody,
        contentType
      }
    };
  } catch (error) {
    const handlingResult = handleError(error as Error, { url });
    logger.error('nexus_http_put failed', { error: handlingResult.error });
    return { success: false, error: handlingResult.error };
  }
}

/**
 * Perform HTTP DELETE request
 */
async function httpDelete(args: unknown): Promise<ToolResult<unknown>> {
  const validated = HttpDeleteSchema.parse(args);
  const { url, headers, body, timeout, followRedirects } = validated;
  
  logger.info('nexus_http_delete started', { url, timeout });
  
  try {
    // Validate URL against allowed domains
    const config = getConfig();
    const allowedDomains = config.tools.http.allowed_domains || [];
    const deniedDomains = config.tools.http.denied_domains || [];
    
    const domainValidation = validateUrlDomain(url, allowedDomains, deniedDomains);
    if (!domainValidation.valid) {
      logger.error('nexus_http_delete failed', { error: domainValidation.error });
      return { success: false, error: new Error(domainValidation.error!) };
    }
    
    // Prepare request headers
    const requestHeaders: Record<string, string> = headers || {};
    let requestBody: string | undefined;
    
    if (body !== undefined) {
      if (typeof body === 'object') {
        requestHeaders['Content-Type'] = 'application/json';
        requestBody = JSON.stringify(body);
      } else if (typeof body === 'string') {
        requestBody = body;
      }
    }
    
    // Perform HTTP request using fetch
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);
    
    const response = await fetch(url, {
      method: 'DELETE',
      headers: requestHeaders,
      body: requestBody,
      signal: controller.signal,
      redirect: followRedirects ? 'follow' : 'manual'
    });
    
    clearTimeout(timeoutId);
    
    // Get response data
    const status = response.status;
    const statusText = response.statusText;
    const responseHeaders: Record<string, string> = {};
    response.headers.forEach((value, key) => {
      responseHeaders[key] = value;
    });
    
    // Get response body
    const contentType = response.headers.get('content-type') || '';
    let responseBody: any;
    
    if (contentType.includes('application/json')) {
      responseBody = await response.json();
    } else if (contentType.includes('text/')) {
      responseBody = await response.text();
    } else {
      responseBody = await response.text();
    }
    
    logger.info('nexus_http_delete succeeded', { status });
    
    return {
      success: true,
      data: {
        url,
        method: 'DELETE',
        status,
        statusText,
        headers: responseHeaders,
        body: responseBody,
        contentType
      }
    };
  } catch (error) {
    const handlingResult = handleError(error as Error, { url });
    logger.error('nexus_http_delete failed', { error: handlingResult.error });
    return { success: false, error: handlingResult.error };
  }
}

/**
 * Perform HTTP PATCH request
 */
async function httpPatch(args: unknown): Promise<ToolResult<unknown>> {
  const validated = HttpPatchSchema.parse(args);
  const { url, headers, body, timeout, followRedirects } = validated;
  
  logger.info('nexus_http_patch started', { url, timeout });
  
  try {
    // Validate URL against allowed domains
    const config = getConfig();
    const allowedDomains = config.tools.http.allowed_domains || [];
    const deniedDomains = config.tools.http.denied_domains || [];
    
    const domainValidation = validateUrlDomain(url, allowedDomains, deniedDomains);
    if (!domainValidation.valid) {
      logger.error('nexus_http_patch failed', { error: domainValidation.error });
      return { success: false, error: new Error(domainValidation.error!) };
    }
    
    // Prepare request headers
    const requestHeaders: Record<string, string> = headers || {};
    let requestBody: string | undefined;
    
    if (body !== undefined) {
      if (typeof body === 'object') {
        requestHeaders['Content-Type'] = 'application/json';
        requestBody = JSON.stringify(body);
      } else if (typeof body === 'string') {
        requestBody = body;
      }
    }
    
    // Perform HTTP request using fetch
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);
    
    const response = await fetch(url, {
      method: 'PATCH',
      headers: requestHeaders,
      body: requestBody,
      signal: controller.signal,
      redirect: followRedirects ? 'follow' : 'manual'
    });
    
    clearTimeout(timeoutId);
    
    // Get response data
    const status = response.status;
    const statusText = response.statusText;
    const responseHeaders: Record<string, string> = {};
    response.headers.forEach((value, key) => {
      responseHeaders[key] = value;
    });
    
    // Get response body
    const contentType = response.headers.get('content-type') || '';
    let responseBody: any;
    
    if (contentType.includes('application/json')) {
      responseBody = await response.json();
    } else if (contentType.includes('text/')) {
      responseBody = await response.text();
    } else {
      responseBody = await response.text();
    }
    
    logger.info('nexus_http_patch succeeded', { status });
    
    return {
      success: true,
      data: {
        url,
        method: 'PATCH',
        status,
        statusText,
        headers: responseHeaders,
        body: responseBody,
        contentType
      }
    };
  } catch (error) {
    const handlingResult = handleError(error as Error, { url });
    logger.error('nexus_http_patch failed', { error: handlingResult.error });
    return { success: false, error: handlingResult.error };
  }
}

/**
 * Perform HTTP HEAD request
 */
async function httpHead(args: unknown): Promise<ToolResult<unknown>> {
  const validated = HttpHeadSchema.parse(args);
  const { url, headers, timeout, followRedirects } = validated;
  
  logger.info('nexus_http_head started', { url, timeout });
  
  try {
    // Validate URL against allowed domains
    const config = getConfig();
    const allowedDomains = config.tools.http.allowed_domains || [];
    const deniedDomains = config.tools.http.denied_domains || [];
    
    const domainValidation = validateUrlDomain(url, allowedDomains, deniedDomains);
    if (!domainValidation.valid) {
      logger.error('nexus_http_head failed', { error: domainValidation.error });
      return { success: false, error: new Error(domainValidation.error!) };
    }
    
    // Perform HTTP request using fetch
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);
    
    const response = await fetch(url, {
      method: 'HEAD',
      headers: headers || {},
      signal: controller.signal,
      redirect: followRedirects ? 'follow' : 'manual'
    });
    
    clearTimeout(timeoutId);
    
    // Get response data
    const status = response.status;
    const statusText = response.statusText;
    const responseHeaders: Record<string, string> = {};
    response.headers.forEach((value, key) => {
      responseHeaders[key] = value;
    });
    
    logger.info('nexus_http_head succeeded', { status });
    
    return {
      success: true,
      data: {
        url,
        method: 'HEAD',
        status,
        statusText,
        headers: responseHeaders
      }
    };
  } catch (error) {
    const handlingResult = handleError(error as Error, { url });
    logger.error('nexus_http_head failed', { error: handlingResult.error });
    return { success: false, error: handlingResult.error };
  }
}

/**
 * Perform HTTP OPTIONS request
 */
async function httpOptions(args: unknown): Promise<ToolResult<unknown>> {
  const validated = HttpOptionsSchema.parse(args);
  const { url, headers, timeout, followRedirects } = validated;
  
  logger.info('nexus_http_options started', { url, timeout });
  
  try {
    // Validate URL against allowed domains
    const config = getConfig();
    const allowedDomains = config.tools.http.allowed_domains || [];
    const deniedDomains = config.tools.http.denied_domains || [];
    
    const domainValidation = validateUrlDomain(url, allowedDomains, deniedDomains);
    if (!domainValidation.valid) {
      logger.error('nexus_http_options failed', { error: domainValidation.error });
      return { success: false, error: new Error(domainValidation.error!) };
    }
    
    // Perform HTTP request using fetch
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);
    
    const response = await fetch(url, {
      method: 'OPTIONS',
      headers: headers || {},
      signal: controller.signal,
      redirect: followRedirects ? 'follow' : 'manual'
    });
    
    clearTimeout(timeoutId);
    
    // Get response data
    const status = response.status;
    const statusText = response.statusText;
    const responseHeaders: Record<string, string> = {};
    response.headers.forEach((value, key) => {
      responseHeaders[key] = value;
    });
    
    // Extract allowed methods
    const allowHeader = responseHeaders['allow'] || '';
    const allowedMethods = allowHeader.split(',').map(m => m.trim()).filter(m => m);
    
    logger.info('nexus_http_options succeeded', { status });
    
    return {
      success: true,
      data: {
        url,
        method: 'OPTIONS',
        status,
        statusText,
        headers: responseHeaders,
        allowedMethods
      }
    };
  } catch (error) {
    const handlingResult = handleError(error as Error, { url });
    logger.error('nexus_http_options failed', { error: handlingResult.error });
    return { success: false, error: handlingResult.error };
  }
}

/**
 * Download file from URL
 */
async function httpDownload(args: unknown): Promise<ToolResult<unknown>> {
  const validated = HttpDownloadSchema.parse(args);
  const { url, destination, headers, timeout, followRedirects } = validated;
  
  logger.info('nexus_http_download started', { url, destination });
  
  try {
    // Validate URL against allowed domains
    const config = getConfig();
    const allowedDomains = config.tools.http.allowed_domains || [];
    const deniedDomains = config.tools.http.denied_domains || [];
    
    const domainValidation = validateUrlDomain(url, allowedDomains, deniedDomains);
    if (!domainValidation.valid) {
      logger.error('nexus_http_download failed', { error: domainValidation.error });
      return { success: false, error: new Error(domainValidation.error!) };
    }
    
    // Validate destination path
    const allowedPaths = config.tools.filesystem.allowed_paths;
    const deniedPaths = config.tools.filesystem.denied_paths;
    
    const pathValidation = validatePath(destination, allowedPaths, deniedPaths);
    if (!pathValidation.valid) {
      logger.error('nexus_http_download failed', { error: pathValidation.error });
      return { success: false, error: new Error(pathValidation.error!) };
    }
    
    // Create parent directories if needed
    const destDir = path.dirname(destination);
    await fs.mkdir(destDir, { recursive: true });
    
    // Perform HTTP request using fetch
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);
    
    const response = await fetch(url, {
      method: 'GET',
      headers: headers || {},
      signal: controller.signal,
      redirect: followRedirects ? 'follow' : 'manual'
    });
    
    clearTimeout(timeoutId);
    
    if (!response.ok) {
      logger.error('nexus_http_download failed', { error: `HTTP ${response.status}` });
      return { success: false, error: new Error(`HTTP ${response.status}: ${response.statusText}`) };
    }
    
    // Get file size from headers
    const contentLength = response.headers.get('content-length');
    const fileSize = contentLength ? parseInt(contentLength, 10) : 0;
    
    // Download file
    const buffer = await response.arrayBuffer();
    await fs.writeFile(destination, Buffer.from(buffer));
    
    const stats = await fs.stat(destination);
    
    logger.info('nexus_http_download succeeded', { size: stats.size });
    
    return {
      success: true,
      data: {
        url,
        destination,
        downloaded: true,
        size: stats.size,
        expectedSize: fileSize
      }
    };
  } catch (error) {
    const handlingResult = handleError(error as Error, { url, destination });
    logger.error('nexus_http_download failed', { error: handlingResult.error });
    return { success: false, error: handlingResult.error };
  }
}

/**
 * Upload file to URL
 */
async function httpUpload(args: unknown): Promise<ToolResult<unknown>> {
  const validated = HttpUploadSchema.parse(args);
  const { url, filePath, fieldName, headers, timeout, followRedirects } = validated;
  
  logger.info('nexus_http_upload started', { url, filePath });
  
  try {
    // Validate URL against allowed domains
    const config = getConfig();
    const allowedDomains = config.tools.http.allowed_domains || [];
    const deniedDomains = config.tools.http.denied_domains || [];
    
    const domainValidation = validateUrlDomain(url, allowedDomains, deniedDomains);
    if (!domainValidation.valid) {
      logger.error('nexus_http_upload failed', { error: domainValidation.error });
      return { success: false, error: new Error(domainValidation.error!) };
    }
    
    // Validate file path
    const allowedPaths = config.tools.filesystem.allowed_paths;
    const deniedPaths = config.tools.filesystem.denied_paths;
    
    const pathValidation = validatePath(filePath, allowedPaths, deniedPaths);
    if (!pathValidation.valid) {
      logger.error('nexus_http_upload failed', { error: pathValidation.error });
      return { success: false, error: new Error(pathValidation.error!) };
    }
    
    // Check if file exists
    const fileStats = await fs.stat(filePath);
    if (!fileStats.isFile()) {
      logger.error('nexus_http_upload failed', { error: 'Not a file' });
      return { success: false, error: new Error('Path is not a file') };
    }
    
    // Read file
    const fileBuffer = await fs.readFile(filePath);
    
    // Create FormData
    const formData = new FormData();
    formData.append(fieldName, new Blob([fileBuffer]), path.basename(filePath));
    
    // Perform HTTP request using fetch
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);
    
    const response = await fetch(url, {
      method: 'POST',
      headers: headers || {},
      body: formData,
      signal: controller.signal,
      redirect: followRedirects ? 'follow' : 'manual'
    });
    
    clearTimeout(timeoutId);
    
    // Get response data
    const status = response.status;
    const statusText = response.statusText;
    const responseHeaders: Record<string, string> = {};
    response.headers.forEach((value, key) => {
      responseHeaders[key] = value;
    });
    
    // Get response body
    const contentType = response.headers.get('content-type') || '';
    let responseBody: any;
    
    if (contentType.includes('application/json')) {
      responseBody = await response.json();
    } else if (contentType.includes('text/')) {
      responseBody = await response.text();
    } else {
      responseBody = await response.text();
    }
    
    logger.info('nexus_http_upload succeeded', { status, uploadedSize: fileStats.size });
    
    return {
      success: true,
      data: {
        url,
        filePath,
        uploaded: true,
        uploadedSize: fileStats.size,
        status,
        statusText,
        headers: responseHeaders,
        body: responseBody
      }
    };
  } catch (error) {
    const handlingResult = handleError(error as Error, { url, filePath });
    logger.error('nexus_http_upload failed', { error: handlingResult.error });
    return { success: false, error: handlingResult.error };
  }
}

/**
 * Extract links from HTML content
 */
async function extractLinksHandler(args: unknown): Promise<ToolResult<unknown>> {
  const validated = ExtractLinksSchema.parse(args);
  const { html, baseUrl } = validated;
  
  logger.info('nexus_extract_links started');
  
  try {
    const links: Array<{ href: string; text: string; isExternal: boolean }> = [];
    
    // Regex to match anchor tags
    const linkRegex = /<a\s+(?:[^>]*?\s+)?href=(["'])(.*?)\1[^>]*>(.*?)<\/a>/gi;
    let match;
    
    while ((match = linkRegex.exec(html)) !== null) {
      const href = match[2];
      if (!href) continue;
      
      const hrefStr: string = href;
      const text = match[3] ? match[3].replace(/<[^>]*>/g, '').trim() : '';
      
      // Resolve relative URLs if baseUrl is provided
      let resolvedHref: string = hrefStr;
      let isExternal = false;
      
      if (baseUrl) {
        try {
          if (hrefStr.startsWith('/')) {
            const urlObj = new URL(baseUrl);
            resolvedHref = `${urlObj.protocol}//${urlObj.host}${hrefStr}`;
          } else if (!hrefStr.startsWith('http://') && !hrefStr.startsWith('https://')) {
            const urlObj = new URL(baseUrl);
            const basePath = urlObj.pathname.substring(0, urlObj.pathname.lastIndexOf('/'));
            resolvedHref = `${urlObj.protocol}//${urlObj.host}${basePath}/${hrefStr}`;
          } else {
            resolvedHref = hrefStr;
          }
          
          // Check if external
          const baseHost = new URL(baseUrl).hostname;
          const linkHost = new URL(resolvedHref).hostname;
          isExternal = baseHost !== linkHost;
        } catch {
          // Invalid URL, keep original
          resolvedHref = hrefStr;
        }
      }
      
      if (hrefStr !== '#') {
        links.push({
          href: resolvedHref,
          text,
          isExternal
        });
      }
    }
    
    logger.info('nexus_extract_links succeeded', { count: links.length });
    
    return {
      success: true,
      data: {
        links,
        count: links.length
      }
    };
  } catch (error) {
    const handlingResult = handleError(error as Error);
    logger.error('nexus_extract_links failed', { error: handlingResult.error });
    return { success: false, error: handlingResult.error };
  }
}

/**
 * Extract images from HTML content
 */
async function extractImagesHandler(args: unknown): Promise<ToolResult<unknown>> {
  const validated = ExtractImagesSchema.parse(args);
  const { html, baseUrl } = validated;
  
  logger.info('nexus_extract_images started');
  
  try {
    const images: Array<{ src: string; alt: string; isExternal: boolean }> = [];
    
    // Regex to match img tags
    const imgRegex = /<img\s+(?:[^>]*?\s+)?src=(["'])(.*?)\1[^>]*(?:alt=(["'])(.*?)\3)?[^>]*>/gi;
    let match;
    
    while ((match = imgRegex.exec(html)) !== null) {
      const src = match[2];
      if (!src) continue;
      
      const srcStr: string = src;
      const alt = match[4] || '';
      
      // Resolve relative URLs if baseUrl is provided
      let resolvedSrc: string = srcStr;
      let isExternal = false;
      
      if (baseUrl) {
        try {
          if (srcStr.startsWith('/')) {
            const urlObj = new URL(baseUrl);
            resolvedSrc = `${urlObj.protocol}//${urlObj.host}${srcStr}`;
          } else if (!srcStr.startsWith('http://') && !srcStr.startsWith('https://')) {
            const urlObj = new URL(baseUrl);
            const basePath = urlObj.pathname.substring(0, urlObj.pathname.lastIndexOf('/'));
            resolvedSrc = `${urlObj.protocol}//${urlObj.host}${basePath}/${srcStr}`;
          } else {
            resolvedSrc = srcStr;
          }
          
          // Check if external
          const baseHost = new URL(baseUrl).hostname;
          const imgHost = new URL(resolvedSrc).hostname;
          isExternal = baseHost !== imgHost;
        } catch {
          // Invalid URL, keep original
          resolvedSrc = srcStr;
        }
      }
      
      images.push({
        src: resolvedSrc,
        alt,
        isExternal
      });
    }
    
    logger.info('nexus_extract_images succeeded', { count: images.length });
    
    return {
      success: true,
      data: {
        images,
        count: images.length
      }
    };
  } catch (error) {
    const handlingResult = handleError(error as Error);
    logger.error('nexus_extract_images failed', { error: handlingResult.error });
    return { success: false, error: handlingResult.error };
  }
}

/**
 * Parse HTML content and extract structured data
 */
async function parseHtml(args: unknown): Promise<ToolResult<unknown>> {
  const validated = ParseHtmlSchema.parse(args);
  const { html, extractTitle, extractMeta, extractLinks, extractImages } = validated;
  
  logger.info('nexus_parse_html started');
  
  try {
    const result: any = {};
    
    // Extract title
    if (extractTitle) {
      const titleMatch = html.match(/<title>(.*?)<\/title>/i);
      result.title = titleMatch && titleMatch[1] ? titleMatch[1].trim() : null;
    }
    
    // Extract meta tags
    if (extractMeta) {
      const metaTags: Record<string, string> = {};
      const metaRegex = /<meta\s+(?:name|property)=(["'])(.*?)\1\s+content=(["'])(.*?)\3[^>]*>/gi;
      let match;
      
      while ((match = metaRegex.exec(html)) !== null) {
        const name = match[2];
        const content = match[4];
        if (name) {
          metaTags[name as string] = content || '';
        }
      }
      
      result.meta = metaTags;
    }
    
    // Extract links
    if (extractLinks) {
      const linksResult = await extractLinksHandler({ html });
      if (linksResult.success) {
        result.links = linksResult.data;
      }
    }
    
    // Extract images
    if (extractImages) {
      const imagesResult = await extractImagesHandler({ html });
      if (imagesResult.success) {
        result.images = imagesResult.data;
      }
    }
    
    logger.info('nexus_parse_html succeeded');
    
    return {
      success: true,
      data: result
    };
  } catch (error) {
    const handlingResult = handleError(error as Error);
    logger.error('nexus_parse_html failed', { error: handlingResult.error });
    return { success: false, error: handlingResult.error };
  }
}

/**
 * Build URL with query parameters
 */
async function buildUrl(args: unknown): Promise<ToolResult<unknown>> {
  const validated = BuildUrlSchema.parse(args);
  const { baseUrl, path, queryParams } = validated;
  
  logger.info('nexus_build_url started', { baseUrl, path });
  
  try {
    let url = baseUrl;
    
    // Add path if provided
    if (path) {
      // Remove trailing slash from baseUrl and leading slash from path
      const cleanBaseUrl = url.endsWith('/') ? url.slice(0, -1) : url;
      const cleanPath = path.startsWith('/') ? path.slice(1) : path;
      url = `${cleanBaseUrl}/${cleanPath}`;
    }
    
    // Add query parameters if provided
    if (queryParams && Object.keys(queryParams).length > 0) {
      const urlObj = new URL(url);
      Object.entries(queryParams).forEach(([key, value]) => {
        urlObj.searchParams.append(key, value);
      });
      url = urlObj.toString();
    }
    
    logger.info('nexus_build_url succeeded', { url });
    
    return {
      success: true,
      data: {
        url
      }
    };
  } catch (error) {
    const handlingResult = handleError(error as Error, { baseUrl });
    logger.error('nexus_build_url failed', { error: handlingResult.error });
    return { success: false, error: handlingResult.error };
  }
}

/**
 * Generate authentication headers
 */
async function apiAuth(args: unknown): Promise<ToolResult<unknown>> {
  const validated = ApiAuthSchema.parse(args);
  const { type, token, username, password, apiKey, keyName } = validated;
  
  logger.info('nexus_api_auth started', { type });
  
  try {
    const headers: Record<string, string> = {};
    
    switch (type) {
      case 'bearer':
        if (!token) {
          return { success: false, error: new Error('Token is required for bearer auth') };
        }
        headers['Authorization'] = `Bearer ${token}`;
        break;
      
      case 'basic':
        if (!username || !password) {
          return { success: false, error: new Error('Username and password are required for basic auth') };
        }
        const credentials = Buffer.from(`${username}:${password}`).toString('base64');
        headers['Authorization'] = `Basic ${credentials}`;
        break;
      
      case 'api_key':
        if (!apiKey) {
          return { success: false, error: new Error('API key is required for api_key auth') };
        }
        headers[keyName] = apiKey;
        break;
    }
    
    logger.info('nexus_api_auth succeeded', { type });
    
    return {
      success: true,
      data: {
        type,
        headers
      }
    };
  } catch (error) {
    const handlingResult = handleError(error as Error, { type });
    logger.error('nexus_api_auth failed', { error: handlingResult.error });
    return { success: false, error: handlingResult.error };
  }
}

/**
 * Make API call with automatic URL building
 */
async function apiCall(args: unknown): Promise<ToolResult<unknown>> {
  const validated = ApiCallSchema.parse(args);
  const { baseUrl, endpoint, method, headers, body, timeout } = validated;
  
  logger.info('nexus_api_call started', { baseUrl, endpoint, method });
  
  try {
    // Validate URL against allowed domains
    const config = getConfig();
    const allowedDomains = config.tools.http.allowed_domains || [];
    const deniedDomains = config.tools.http.denied_domains || [];
    
    const domainValidation = validateUrlDomain(baseUrl, allowedDomains, deniedDomains);
    if (!domainValidation.valid) {
      logger.error('nexus_api_call failed', { error: domainValidation.error });
      return { success: false, error: new Error(domainValidation.error!) };
    }
    
    // Build full URL
    const cleanBaseUrl = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;
    const cleanEndpoint = endpoint.startsWith('/') ? endpoint.slice(1) : endpoint;
    const url = `${cleanBaseUrl}/${cleanEndpoint}`;
    
    // Prepare request headers
    const requestHeaders: Record<string, string> = headers || {};
    let requestBody: string | undefined;
    
    if (body !== undefined) {
      if (typeof body === 'object') {
        requestHeaders['Content-Type'] = 'application/json';
        requestBody = JSON.stringify(body);
      } else if (typeof body === 'string') {
        requestBody = body;
      }
    }
    
    // Perform HTTP request using fetch
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);
    
    const response = await fetch(url, {
      method,
      headers: requestHeaders,
      body: requestBody,
      signal: controller.signal
    });
    
    clearTimeout(timeoutId);
    
    // Get response data
    const status = response.status;
    const statusText = response.statusText;
    const responseHeaders: Record<string, string> = {};
    response.headers.forEach((value, key) => {
      responseHeaders[key] = value;
    });
    
    // Get response body
    const contentType = response.headers.get('content-type') || '';
    let responseBody: any;
    
    if (contentType.includes('application/json')) {
      responseBody = await response.json();
    } else if (contentType.includes('text/')) {
      responseBody = await response.text();
    } else {
      responseBody = await response.text();
    }
    
    logger.info('nexus_api_call succeeded', { status });
    
    return {
      success: true,
      data: {
        url,
        method,
        status,
        statusText,
        headers: responseHeaders,
        body: responseBody,
        contentType
      }
    };
  } catch (error) {
    const handlingResult = handleError(error as Error, { baseUrl, endpoint });
    logger.error('nexus_api_call failed', { error: handlingResult.error });
    return { success: false, error: handlingResult.error };
  }
}

/**
 * Validate URL domain against allowed and denied lists
 */
function validateUrlDomain(
  url: string,
  allowedDomains: string[],
  deniedDomains: string[]
): { valid: boolean; error?: string } {
  try {
    const urlObj = new URL(url);
    const domain = urlObj.hostname;
    
    // Check denied domains first
    for (const denied of deniedDomains) {
      if (domain === denied || domain.endsWith(`.${denied}`)) {
        return { valid: false, error: `Domain ${domain} is denied` };
      }
    }
    
    // If allowed domains are specified, check against them
    if (allowedDomains.length > 0) {
      let isAllowed = false;
      for (const allowedDomain of allowedDomains) {
        if (domain === allowedDomain || domain.endsWith(`.${allowedDomain}`)) {
          isAllowed = true;
          break;
        }
      }
      
      if (!isAllowed) {
        return { valid: false, error: `Domain ${domain} is not in allowed list` };
      }
    }
    
    return { valid: true };
  } catch (error) {
    return { valid: false, error: 'Invalid URL' };
  }
}

// ============================================================================
// Tool Definitions
// ============================================================================

export const httpTools: MCPTool[] = [
  // Basic HTTP Methods (Fase 3.1)
  {
    name: 'nexus_http_get',
    description: 'Perform HTTP GET request',
    category: HTTP_CATEGORY,
    inputSchema: HttpGetSchema,
    handler: httpGet,
    version: '1.0.0',
    tags: ['http', 'get', 'request']
  },
  {
    name: 'nexus_http_post',
    description: 'Perform HTTP POST request',
    category: HTTP_CATEGORY,
    inputSchema: HttpPostSchema,
    handler: httpPost,
    version: '1.0.0',
    tags: ['http', 'post', 'request']
  },
  {
    name: 'nexus_http_put',
    description: 'Perform HTTP PUT request',
    category: HTTP_CATEGORY,
    inputSchema: HttpPutSchema,
    handler: httpPut,
    version: '1.0.0',
    tags: ['http', 'put', 'request']
  },
  {
    name: 'nexus_http_delete',
    description: 'Perform HTTP DELETE request',
    category: HTTP_CATEGORY,
    inputSchema: HttpDeleteSchema,
    handler: httpDelete,
    version: '1.0.0',
    tags: ['http', 'delete', 'request']
  },
  {
    name: 'nexus_http_patch',
    description: 'Perform HTTP PATCH request',
    category: HTTP_CATEGORY,
    inputSchema: HttpPatchSchema,
    handler: httpPatch,
    version: '1.0.0',
    tags: ['http', 'patch', 'request']
  },
  // Advanced HTTP Methods (Fase 3.2)
  {
    name: 'nexus_http_head',
    description: 'Perform HTTP HEAD request (headers only)',
    category: HTTP_CATEGORY,
    inputSchema: HttpHeadSchema,
    handler: httpHead,
    version: '1.0.0',
    tags: ['http', 'head', 'request']
  },
  {
    name: 'nexus_http_options',
    description: 'Perform HTTP OPTIONS request (CORS preflight)',
    category: HTTP_CATEGORY,
    inputSchema: HttpOptionsSchema,
    handler: httpOptions,
    version: '1.0.0',
    tags: ['http', 'options', 'cors']
  },
  {
    name: 'nexus_http_download',
    description: 'Download file from URL to local filesystem',
    category: HTTP_CATEGORY,
    inputSchema: HttpDownloadSchema,
    handler: httpDownload,
    version: '1.0.0',
    tags: ['http', 'download', 'file']
  },
  {
    name: 'nexus_http_upload',
    description: 'Upload file from local filesystem to URL',
    category: HTTP_CATEGORY,
    inputSchema: HttpUploadSchema,
    handler: httpUpload,
    version: '1.0.0',
    tags: ['http', 'upload', 'file']
  },
  // Web Scraping and Parsing (Fase 3.3)
  {
    name: 'nexus_extract_links',
    description: 'Extract all links from HTML content with URL resolution',
    category: HTTP_CATEGORY,
    inputSchema: ExtractLinksSchema,
    handler: extractLinksHandler,
    version: '1.0.0',
    tags: ['http', 'scraping', 'html', 'links']
  },
  {
    name: 'nexus_extract_images',
    description: 'Extract all images from HTML content with URL resolution',
    category: HTTP_CATEGORY,
    inputSchema: ExtractImagesSchema,
    handler: extractImagesHandler,
    version: '1.0.0',
    tags: ['http', 'scraping', 'html', 'images']
  },
  {
    name: 'nexus_parse_html',
    description: 'Parse HTML and extract title, meta tags, links, and images',
    category: HTTP_CATEGORY,
    inputSchema: ParseHtmlSchema,
    handler: parseHtml,
    version: '1.0.0',
    tags: ['http', 'scraping', 'html', 'parser']
  },
  // APIs and Webhooks (Fase 3.4)
  {
    name: 'nexus_build_url',
    description: 'Build URL with path and query parameters',
    category: HTTP_CATEGORY,
    inputSchema: BuildUrlSchema,
    handler: buildUrl,
    version: '1.0.0',
    tags: ['http', 'api', 'url']
  },
  {
    name: 'nexus_api_auth',
    description: 'Generate authentication headers for APIs (bearer, basic, api_key)',
    category: HTTP_CATEGORY,
    inputSchema: ApiAuthSchema,
    handler: apiAuth,
    version: '1.0.0',
    tags: ['http', 'api', 'auth']
  },
  {
    name: 'nexus_api_call',
    description: 'Make API call with automatic URL building',
    category: HTTP_CATEGORY,
    inputSchema: ApiCallSchema,
    handler: apiCall,
    version: '1.0.0',
    tags: ['http', 'api', 'rest']
  }
];

// ============================================================================
// Export
// ============================================================================

export default httpTools;
