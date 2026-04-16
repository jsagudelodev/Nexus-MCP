/**
 * Nexus-MCP Filesystem Tools - Basic Operations
 * 
 * Basic filesystem operations with validation, error handling, and security:
 * - Read files with encoding and pagination support
 * - Write files with directory creation
 * - Delete files with validation
 * - List directories with recursion
 * - Create directories recursively
 * - Delete directories with force option
 * 
 * @module filesystem
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import { z } from 'zod';
import type { MCPTool, ToolResult } from '../../types.js';
import { ToolCategory } from '../../types.js';
import { logger } from '../../logger.js';
import { handleError } from '../../utils/error-handler.js';
import { validatePath } from '../../utils/validation.js';
import { getConfig } from '../../config.js';

// ============================================================================
// Constants
// ============================================================================

const FILESYSTEM_CATEGORY: ToolCategory = ToolCategory.FILESYSTEM;

// ============================================================================
// Zod Schemas
// ============================================================================

const EncodingSchema = z.enum(['utf8', 'base64', 'ascii', 'utf16le', 'ucs2', 'latin1', 'binary']);

/**
 * Schema for nexus_read_file
 */
const ReadFileSchema = z.object({
  path: z.string().min(1, 'Path is required'),
  encoding: EncodingSchema.default('utf8'),
  offset: z.number().int().nonnegative().optional(),
  limit: z.number().int().positive().optional()
});

/**
 * Schema for nexus_write_file
 */
const WriteFileSchema = z.object({
  path: z.string().min(1, 'Path is required'),
  content: z.string().min(1, 'Content is required'),
  encoding: EncodingSchema.default('utf8'),
  createDirs: z.boolean().default(true),
  overwrite: z.boolean().default(true)
});

/**
 * Schema for nexus_delete_file
 */
const DeleteFileSchema = z.object({
  path: z.string().min(1, 'Path is required'),
  confirm: z.boolean().default(false)
});

/**
 * Schema for nexus_list_directory
 */
const ListDirectorySchema = z.object({
  path: z.string().min(1, 'Path is required'),
  recursive: z.boolean().default(false),
  includeHidden: z.boolean().default(false),
  includeFiles: z.boolean().default(true),
  includeDirectories: z.boolean().default(true)
});

/**
 * Schema for nexus_create_directory
 */
const CreateDirectorySchema = z.object({
  path: z.string().min(1, 'Path is required'),
  recursive: z.boolean().default(true)
});

/**
 * Schema for nexus_delete_directory
 */
const DeleteDirectorySchema = z.object({
  path: z.string().min(1, 'Path is required'),
  recursive: z.boolean().default(false),
  force: z.boolean().default(false)
});

// ============================================================================
// Tool Implementations
// ============================================================================

/**
 * Read file contents with encoding and pagination support
 */
async function readFile(args: unknown): Promise<ToolResult<unknown>> {
  const validated = ReadFileSchema.parse(args);
  const { path: filePath, encoding, offset, limit } = validated;
  
  logger.info('nexus_read_file started', { filePath, encoding, offset, limit });
  
  try {
    // Validate path
    const config = getConfig();
    const allowedPaths = config.tools.filesystem.allowed_paths;
    const deniedPaths = config.tools.filesystem.denied_paths;
    
    const pathValidation = validatePath(filePath, allowedPaths, deniedPaths);
    if (!pathValidation.valid) {
      logger.error('nexus_read_file failed', { error: pathValidation.error });
      return { success: false, error: new Error(pathValidation.error!) };
    }
    
    // Check if file exists
    const stats = await fs.stat(filePath);
    if (!stats.isFile()) {
      logger.error('nexus_read_file failed', { error: 'Path is not a file' });
      return { success: false, error: new Error('Path is not a file') };
    }
    
    // Read file
    let content: string;
    if (encoding === 'base64') {
      const buffer = await fs.readFile(filePath);
      content = buffer.toString('base64');
    } else {
      content = await fs.readFile(filePath, encoding as BufferEncoding);
    }
    
    // Apply offset/limit if specified
    if (offset !== undefined || limit !== undefined) {
      const start = offset || 0;
      const end = limit !== undefined ? start + limit : undefined;
      content = content.substring(start, end);
    }
    
    logger.info('nexus_read_file succeeded', {
      size: content.length,
      encoding
    });
    
    return {
      success: true,
      data: {
        content,
        size: content.length,
        encoding,
        stats: {
          size: stats.size,
          created: stats.birthtime,
          modified: stats.mtime,
          isFile: stats.isFile(),
          isDirectory: stats.isDirectory()
        }
      }
    };
  } catch (error) {
    const handlingResult = handleError(error as Error, { filePath });
    logger.error('nexus_read_file failed', { error: handlingResult.error });
    return { success: false, error: handlingResult.error };
  }
}

/**
 * Write content to file with directory creation
 */
async function writeFile(args: unknown): Promise<ToolResult<unknown>> {
  const validated = WriteFileSchema.parse(args);
  const { path: filePath, content, encoding, createDirs, overwrite } = validated;
  
  logger.info('nexus_write_file started', { filePath, encoding, createDirs, overwrite, contentLength: content.length });
  
  try {
    // Validate path
    const config = getConfig();
    const allowedPaths = config.tools.filesystem.allowed_paths;
    const deniedPaths = config.tools.filesystem.denied_paths;
    
    const pathValidation = validatePath(filePath, allowedPaths, deniedPaths);
    if (!pathValidation.valid) {
      logger.error('nexus_write_file failed', { error: pathValidation.error });
      return { success: false, error: new Error(pathValidation.error!) };
    }
    
    // Check if file exists
    let fileExists = false;
    try {
      await fs.access(filePath);
      fileExists = true;
    } catch {
      fileExists = false;
    }
    
    if (fileExists && !overwrite) {
      logger.error('nexus_write_file failed', { error: 'File already exists and overwrite is false' });
      return { success: false, error: new Error('File already exists and overwrite is false') };
    }
    
    // Create parent directories if needed
    if (createDirs) {
      const dir = path.dirname(filePath);
      await fs.mkdir(dir, { recursive: true });
    }
    
    // Write file
    if (encoding === 'base64') {
      const buffer = Buffer.from(content, 'base64');
      await fs.writeFile(filePath, buffer);
    } else {
      await fs.writeFile(filePath, content, encoding as BufferEncoding);
    }
    
    const stats = await fs.stat(filePath);
    
    logger.info('nexus_write_file succeeded', {
      size: stats.size,
      created: !fileExists
    });
    
    return {
      success: true,
      data: {
        path: filePath,
        size: stats.size,
        created: !fileExists
      }
    };
  } catch (error) {
    const handlingResult = handleError(error as Error, { filePath });
    logger.error('nexus_write_file failed', { error: handlingResult.error });
    return { success: false, error: handlingResult.error };
  }
}

/**
 * Delete a file
 */
async function deleteFile(args: unknown): Promise<ToolResult<unknown>> {
  const validated = DeleteFileSchema.parse(args);
  const { path: filePath, confirm } = validated;
  
  logger.info('nexus_delete_file started', { filePath, confirm });
  
  try {
    // Validate path
    const config = getConfig();
    const allowedPaths = config.tools.filesystem.allowed_paths;
    const deniedPaths = config.tools.filesystem.denied_paths;
    
    const pathValidation = validatePath(filePath, allowedPaths, deniedPaths);
    if (!pathValidation.valid) {
      logger.error('nexus_delete_file failed', { error: pathValidation.error });
      return { success: false, error: new Error(pathValidation.error!) };
    }
    
    // Check if file exists
    try {
      const stats = await fs.stat(filePath);
      if (!stats.isFile()) {
        logger.error('nexus_delete_file failed', { error: 'Path is not a file' });
        return { success: false, error: new Error('Path is not a file') };
      }
    } catch {
      logger.error('nexus_delete_file failed', { error: 'File not found' });
      return { success: false, error: new Error('File not found') };
    }
    
    // Require confirmation for safety
    if (!confirm) {
      logger.error('nexus_delete_file failed', { error: 'Confirmation required' });
      return { success: false, error: new Error('Confirmation required. Set confirm=true to delete the file.') };
    }
    
    // Delete file
    await fs.unlink(filePath);
    
    logger.info('nexus_delete_file succeeded');
    
    return {
      success: true,
      data: {
        path: filePath,
        deleted: true
      }
    };
  } catch (error) {
    const handlingResult = handleError(error as Error, { filePath });
    logger.error('nexus_delete_file failed', { error: handlingResult.error });
    return { success: false, error: handlingResult.error };
  }
}

/**
 * List directory contents
 */
async function listDirectory(args: unknown): Promise<ToolResult<unknown>> {
  const validated = ListDirectorySchema.parse(args);
  const { path: dirPath, recursive, includeHidden, includeFiles, includeDirectories } = validated;
  
  logger.info('nexus_list_directory started', { dirPath, recursive, includeHidden });
  
  try {
    // Validate path
    const config = getConfig();
    const allowedPaths = config.tools.filesystem.allowed_paths;
    const deniedPaths = config.tools.filesystem.denied_paths;
    
    const pathValidation = validatePath(dirPath, allowedPaths, deniedPaths);
    if (!pathValidation.valid) {
      logger.error('nexus_list_directory failed', { error: pathValidation.error });
      return { success: false, error: new Error(pathValidation.error!) };
    }
    
    // Check if directory exists
    const stats = await fs.stat(dirPath);
    if (!stats.isDirectory()) {
      logger.error('nexus_list_directory failed', { error: 'Path is not a directory' });
      return { success: false, error: new Error('Path is not a directory') };
    }
    
    // List entries
    const entries: Array<{
      name: string;
      path: string;
      type: 'file' | 'directory';
      size?: number;
      created?: Date;
      modified?: Date;
    }> = [];
    
    if (recursive) {
      await listDirectoryRecursive(dirPath, entries, includeHidden, includeFiles, includeDirectories);
    } else {
      const items = await fs.readdir(dirPath, { withFileTypes: true });
      
      for (const item of items) {
        // Skip hidden files if not included
        if (!includeHidden && item.name.startsWith('.')) {
          continue;
        }
        
        const fullPath = path.join(dirPath, item.name);
        const itemStats = await fs.stat(fullPath);
        
        if (item.isFile() && includeFiles) {
          entries.push({
            name: item.name,
            path: fullPath,
            type: 'file',
            size: itemStats.size,
            created: itemStats.birthtime,
            modified: itemStats.mtime
          });
        } else if (item.isDirectory() && includeDirectories) {
          entries.push({
            name: item.name,
            path: fullPath,
            type: 'directory',
            created: itemStats.birthtime,
            modified: itemStats.mtime
          });
        }
      }
    }
    
    logger.info('nexus_list_directory succeeded', {
      count: entries.length,
      files: entries.filter(e => e.type === 'file').length,
      directories: entries.filter(e => e.type === 'directory').length
    });
    
    return {
      success: true,
      data: {
        path: dirPath,
        entries,
        count: entries.length
      }
    };
  } catch (error) {
    const handlingResult = handleError(error as Error, { dirPath });
    logger.error('nexus_list_directory failed', { error: handlingResult.error });
    return { success: false, error: handlingResult.error };
  }
}

/**
 * Helper for recursive directory listing
 */
async function listDirectoryRecursive(
  dirPath: string,
  entries: Array<any>,
  includeHidden: boolean,
  includeFiles: boolean,
  includeDirectories: boolean
): Promise<void> {
  const items = await fs.readdir(dirPath, { withFileTypes: true });
  
  for (const item of items) {
    // Skip hidden files if not included
    if (!includeHidden && item.name.startsWith('.')) {
      continue;
    }
    
    const fullPath = path.join(dirPath, item.name);
    const itemStats = await fs.stat(fullPath);
    
    if (item.isFile() && includeFiles) {
      entries.push({
        name: item.name,
        path: fullPath,
        type: 'file',
        size: itemStats.size,
        created: itemStats.birthtime,
        modified: itemStats.mtime
      });
    } else if (item.isDirectory()) {
      if (includeDirectories) {
        entries.push({
          name: item.name,
          path: fullPath,
          type: 'directory',
          created: itemStats.birthtime,
          modified: itemStats.mtime
        });
      }
      // Recurse into subdirectory
      await listDirectoryRecursive(fullPath, entries, includeHidden, includeFiles, includeDirectories);
    }
  }
}

/**
 * Create a directory
 */
async function createDirectory(args: unknown): Promise<ToolResult<unknown>> {
  const validated = CreateDirectorySchema.parse(args);
  const { path: dirPath, recursive } = validated;
  
  logger.info('nexus_create_directory started', { dirPath, recursive });
  
  try {
    // Validate path
    const config = getConfig();
    const allowedPaths = config.tools.filesystem.allowed_paths;
    const deniedPaths = config.tools.filesystem.denied_paths;
    
    const pathValidation = validatePath(dirPath, allowedPaths, deniedPaths);
    if (!pathValidation.valid) {
      logger.error('nexus_create_directory failed', { error: pathValidation.error });
      return { success: false, error: new Error(pathValidation.error!) };
    }
    
    // Check if directory already exists
    try {
      const stats = await fs.stat(dirPath);
      if (stats.isDirectory()) {
        logger.info('nexus_create_directory succeeded', { alreadyExists: true });
        return {
          success: true,
          data: {
            path: dirPath,
            created: false,
            alreadyExists: true
          }
        };
      }
    } catch {
      // Directory doesn't exist, proceed with creation
    }
    
    // Create directory
    await fs.mkdir(dirPath, { recursive });
    
    const stats = await fs.stat(dirPath);
    
    logger.info('nexus_create_directory succeeded', { created: true });
    
    return {
      success: true,
      data: {
        path: dirPath,
        created: true,
        createdTime: stats.birthtime
      }
    };
  } catch (error) {
    const handlingResult = handleError(error as Error, { dirPath });
    logger.error('nexus_create_directory failed', { error: handlingResult.error });
    return { success: false, error: handlingResult.error };
  }
}

/**
 * Delete a directory
 */
async function deleteDirectory(args: unknown): Promise<ToolResult<unknown>> {
  const validated = DeleteDirectorySchema.parse(args);
  const { path: dirPath, recursive, force } = validated;
  
  logger.info('nexus_delete_directory started', { dirPath, recursive, force });
  
  try {
    // Validate path
    const config = getConfig();
    const allowedPaths = config.tools.filesystem.allowed_paths;
    const deniedPaths = config.tools.filesystem.denied_paths;
    
    const pathValidation = validatePath(dirPath, allowedPaths, deniedPaths);
    if (!pathValidation.valid) {
      logger.error('nexus_delete_directory failed', { error: pathValidation.error });
      return { success: false, error: new Error(pathValidation.error!) };
    }
    
    // Check if directory exists
    try {
      const stats = await fs.stat(dirPath);
      if (!stats.isDirectory()) {
        logger.error('nexus_delete_directory failed', { error: 'Path is not a directory' });
        return { success: false, error: new Error('Path is not a directory') };
      }
    } catch {
      logger.error('nexus_delete_directory failed', { error: 'Directory not found' });
      return { success: false, error: new Error('Directory not found') };
    }
    
    // Check if directory is not empty
    if (!recursive && !force) {
      const items = await fs.readdir(dirPath);
      if (items.length > 0) {
        logger.error('nexus_delete_directory failed', { error: 'Directory not empty' });
        return { success: false, error: new Error('Directory is not empty. Use recursive=true to delete non-empty directories.') };
      }
    }
    
    // Delete directory
    await fs.rm(dirPath, { recursive, force });
    
    logger.info('nexus_delete_directory succeeded');
    
    return {
      success: true,
      data: {
        path: dirPath,
        deleted: true
      }
    };
  } catch (error) {
    const handlingResult = handleError(error as Error, { dirPath });
    logger.error('nexus_delete_directory failed', { error: handlingResult.error });
    return { success: false, error: handlingResult.error };
  }
}

// ============================================================================
// Tool Definitions
// ============================================================================

export const filesystemBasicTools: MCPTool[] = [
  {
    name: 'nexus_read_file',
    description: 'Read file contents with encoding and pagination support',
    category: FILESYSTEM_CATEGORY,
    inputSchema: ReadFileSchema,
    handler: readFile,
    version: '1.0.0',
    tags: ['filesystem', 'read', 'file']
  },
  {
    name: 'nexus_write_file',
    description: 'Write content to file with automatic directory creation',
    category: FILESYSTEM_CATEGORY,
    inputSchema: WriteFileSchema,
    handler: writeFile,
    version: '1.0.0',
    tags: ['filesystem', 'write', 'file']
  },
  {
    name: 'nexus_delete_file',
    description: 'Delete a file (requires confirmation)',
    category: FILESYSTEM_CATEGORY,
    inputSchema: DeleteFileSchema,
    handler: deleteFile,
    version: '1.0.0',
    tags: ['filesystem', 'delete', 'file']
  },
  {
    name: 'nexus_list_directory',
    description: 'List directory contents with recursion support',
    category: FILESYSTEM_CATEGORY,
    inputSchema: ListDirectorySchema,
    handler: listDirectory,
    version: '1.0.0',
    tags: ['filesystem', 'list', 'directory']
  },
  {
    name: 'nexus_create_directory',
    description: 'Create a directory with recursive support',
    category: FILESYSTEM_CATEGORY,
    inputSchema: CreateDirectorySchema,
    handler: createDirectory,
    version: '1.0.0',
    tags: ['filesystem', 'create', 'directory']
  },
  {
    name: 'nexus_delete_directory',
    description: 'Delete a directory with recursive and force options',
    category: FILESYSTEM_CATEGORY,
    inputSchema: DeleteDirectorySchema,
    handler: deleteDirectory,
    version: '1.0.0',
    tags: ['filesystem', 'delete', 'directory']
  }
];

// ============================================================================
// Export
// ============================================================================

export default filesystemBasicTools;
