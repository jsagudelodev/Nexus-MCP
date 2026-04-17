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

/**
 * Schema for nexus_search_files
 */
const SearchFilesSchema = z.object({
  directory: z.string().min(1, 'Directory is required'),
  pattern: z.string().min(1, 'Pattern is required'),
  recursive: z.boolean().default(true),
  maxResults: z.number().int().positive().max(1000).default(100),
  includeHidden: z.boolean().default(false),
  caseSensitive: z.boolean().default(false)
});

/**
 * Schema for nexus_move_file
 */
const MoveFileSchema = z.object({
  source: z.string().min(1, 'Source path is required'),
  destination: z.string().min(1, 'Destination path is required'),
  overwrite: z.boolean().default(false)
});

/**
 * Schema for nexus_copy_file
 */
const CopyFileSchema = z.object({
  source: z.string().min(1, 'Source path is required'),
  destination: z.string().min(1, 'Destination path is required'),
  overwrite: z.boolean().default(false)
});

/**
 * Schema for nexus_get_file_info
 */
const GetFileInfoSchema = z.object({
  path: z.string().min(1, 'Path is required')
});

/**
 * Schema for nexus_get_disk_usage
 */
const GetDiskUsageSchema = z.object({
  path: z.string().min(1, 'Path is required')
});

/**
 * Schema for nexus_watch_directory
 */
const WatchDirectorySchema = z.object({
  path: z.string().min(1, 'Path is required'),
  recursive: z.boolean().default(true),
  events: z.array(z.enum(['create', 'modify', 'delete', 'rename'])).default(['create', 'modify', 'delete', 'rename'])
});

/**
 * Schema for nexus_read_json
 */
const ReadJsonSchema = z.object({
  path: z.string().min(1, 'Path is required')
});

/**
 * Schema for nexus_write_json
 */
const WriteJsonSchema = z.object({
  path: z.string().min(1, 'Path is required'),
  data: z.any(),
  pretty: z.boolean().default(true),
  createDirs: z.boolean().default(true)
});

/**
 * Schema for nexus_read_yaml
 */
const ReadYamlSchema = z.object({
  path: z.string().min(1, 'Path is required')
});

/**
 * Schema for nexus_write_yaml
 */
const WriteYamlSchema = z.object({
  path: z.string().min(1, 'Path is required'),
  data: z.any(),
  createDirs: z.boolean().default(true)
});

/**
 * Schema for nexus_read_csv
 */
const ReadCsvSchema = z.object({
  path: z.string().min(1, 'Path is required'),
  hasHeader: z.boolean().default(true),
  delimiter: z.string().default(',').optional()
});

/**
 * Schema for nexus_write_csv
 */
const WriteCsvSchema = z.object({
  path: z.string().min(1, 'Path is required'),
  data: z.array(z.record(z.string())),
  hasHeader: z.boolean().default(true),
  delimiter: z.string().default(',').optional(),
  createDirs: z.boolean().default(true)
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

/**
 * Search files using glob patterns
 */
async function searchFiles(args: unknown): Promise<ToolResult<unknown>> {
  const validated = SearchFilesSchema.parse(args);
  const { directory, pattern, recursive, maxResults, includeHidden, caseSensitive } = validated;
  
  logger.info('nexus_search_files started', { directory, pattern, recursive, maxResults });
  
  try {
    // Validate path
    const config = getConfig();
    const allowedPaths = config.tools.filesystem.allowed_paths;
    const deniedPaths = config.tools.filesystem.denied_paths;
    
    const pathValidation = validatePath(directory, allowedPaths, deniedPaths);
    if (!pathValidation.valid) {
      logger.error('nexus_search_files failed', { error: pathValidation.error });
      return { success: false, error: new Error(pathValidation.error!) };
    }
    
    // Check if directory exists
    const stats = await fs.stat(directory);
    if (!stats.isDirectory()) {
      logger.error('nexus_search_files failed', { error: 'Path is not a directory' });
      return { success: false, error: new Error('Path is not a directory') };
    }
    
    // Convert glob pattern to regex
    const regexPattern = caseSensitive 
      ? pattern 
      : pattern.toLowerCase();
    
    const regex = new RegExp(regexPattern.replace(/\*/g, '.*').replace(/\?/g, '.'), caseSensitive ? '' : 'i');
    
    // Search files
    const results: Array<{
      path: string;
      name: string;
      size: number;
      modified: Date;
    }> = [];
    
    await searchDirectoryRecursive(directory, results, regex, recursive, includeHidden, maxResults);
    
    logger.info('nexus_search_files succeeded', { count: results.length });
    
    return {
      success: true,
      data: {
        directory,
        pattern,
        results,
        count: results.length,
        truncated: results.length >= maxResults
      }
    };
  } catch (error) {
    const handlingResult = handleError(error as Error, { directory });
    logger.error('nexus_search_files failed', { error: handlingResult.error });
    return { success: false, error: handlingResult.error };
  }
}

/**
 * Helper for recursive file search
 */
async function searchDirectoryRecursive(
  dirPath: string,
  results: Array<any>,
  regex: RegExp,
  recursive: boolean,
  includeHidden: boolean,
  maxResults: number
): Promise<void> {
  if (results.length >= maxResults) return;
  
  const items = await fs.readdir(dirPath, { withFileTypes: true });
  
  for (const item of items) {
    if (results.length >= maxResults) break;
    
    // Skip hidden files if not included
    if (!includeHidden && item.name.startsWith('.')) {
      continue;
    }
    
    const fullPath = path.join(dirPath, item.name);
    
    // Check if name matches pattern
    if (regex.test(item.name)) {
      const itemStats = await fs.stat(fullPath);
      results.push({
        path: fullPath,
        name: item.name,
        size: itemStats.size,
        modified: itemStats.mtime
      });
    }
    
    // Recurse into subdirectory
    if (item.isDirectory() && recursive) {
      await searchDirectoryRecursive(fullPath, results, regex, recursive, includeHidden, maxResults);
    }
  }
}

/**
 * Move or rename a file
 */
async function moveFile(args: unknown): Promise<ToolResult<unknown>> {
  const validated = MoveFileSchema.parse(args);
  const { source, destination, overwrite } = validated;
  
  logger.info('nexus_move_file started', { source, destination, overwrite });
  
  try {
    // Validate paths
    const config = getConfig();
    const allowedPaths = config.tools.filesystem.allowed_paths;
    const deniedPaths = config.tools.filesystem.denied_paths;
    
    const sourceValidation = validatePath(source, allowedPaths, deniedPaths);
    if (!sourceValidation.valid) {
      logger.error('nexus_move_file failed', { error: sourceValidation.error });
      return { success: false, error: new Error(sourceValidation.error!) };
    }
    
    const destValidation = validatePath(destination, allowedPaths, deniedPaths);
    if (!destValidation.valid) {
      logger.error('nexus_move_file failed', { error: destValidation.error });
      return { success: false, error: new Error(destValidation.error!) };
    }
    
    // Check if source exists
    const sourceStats = await fs.stat(source);
    if (!sourceStats.isFile()) {
      logger.error('nexus_move_file failed', { error: 'Source is not a file' });
      return { success: false, error: new Error('Source is not a file') };
    }
    
    // Check if destination exists
    try {
      await fs.access(destination);
      if (!overwrite) {
        logger.error('nexus_move_file failed', { error: 'Destination already exists' });
        return { success: false, error: new Error('Destination already exists and overwrite is false') };
      }
    } catch {
      // Destination doesn't exist, proceed
    }
    
    // Create parent directories if needed
    const destDir = path.dirname(destination);
    await fs.mkdir(destDir, { recursive: true });
    
    // Move file
    await fs.rename(source, destination);
    
    logger.info('nexus_move_file succeeded');
    
    return {
      success: true,
      data: {
        source,
        destination,
        moved: true
      }
    };
  } catch (error) {
    const handlingResult = handleError(error as Error, { source, destination });
    logger.error('nexus_move_file failed', { error: handlingResult.error });
    return { success: false, error: handlingResult.error };
  }
}

/**
 * Copy a file
 */
async function copyFile(args: unknown): Promise<ToolResult<unknown>> {
  const validated = CopyFileSchema.parse(args);
  const { source, destination, overwrite } = validated;
  
  logger.info('nexus_copy_file started', { source, destination, overwrite });
  
  try {
    // Validate paths
    const config = getConfig();
    const allowedPaths = config.tools.filesystem.allowed_paths;
    const deniedPaths = config.tools.filesystem.denied_paths;
    
    const sourceValidation = validatePath(source, allowedPaths, deniedPaths);
    if (!sourceValidation.valid) {
      logger.error('nexus_copy_file failed', { error: sourceValidation.error });
      return { success: false, error: new Error(sourceValidation.error!) };
    }
    
    const destValidation = validatePath(destination, allowedPaths, deniedPaths);
    if (!destValidation.valid) {
      logger.error('nexus_copy_file failed', { error: destValidation.error });
      return { success: false, error: new Error(destValidation.error!) };
    }
    
    // Check if source exists
    const sourceStats = await fs.stat(source);
    if (!sourceStats.isFile()) {
      logger.error('nexus_copy_file failed', { error: 'Source is not a file' });
      return { success: false, error: new Error('Source is not a file') };
    }
    
    // Check if destination exists
    try {
      await fs.access(destination);
      if (!overwrite) {
        logger.error('nexus_copy_file failed', { error: 'Destination already exists' });
        return { success: false, error: new Error('Destination already exists and overwrite is false') };
      }
    } catch {
      // Destination doesn't exist, proceed
    }
    
    // Create parent directories if needed
    const destDir = path.dirname(destination);
    await fs.mkdir(destDir, { recursive: true });
    
    // Copy file
    await fs.copyFile(source, destination);
    
    const destStats = await fs.stat(destination);
    
    logger.info('nexus_copy_file succeeded');
    
    return {
      success: true,
      data: {
        source,
        destination,
        copied: true,
        size: destStats.size
      }
    };
  } catch (error) {
    const handlingResult = handleError(error as Error, { source, destination });
    logger.error('nexus_copy_file failed', { error: handlingResult.error });
    return { success: false, error: handlingResult.error };
  }
}

/**
 * Get detailed file information
 */
async function getFileInfo(args: unknown): Promise<ToolResult<unknown>> {
  const validated = GetFileInfoSchema.parse(args);
  const { path: filePath } = validated;
  
  logger.info('nexus_get_file_info started', { filePath });
  
  try {
    // Validate path
    const config = getConfig();
    const allowedPaths = config.tools.filesystem.allowed_paths;
    const deniedPaths = config.tools.filesystem.denied_paths;
    
    const pathValidation = validatePath(filePath, allowedPaths, deniedPaths);
    if (!pathValidation.valid) {
      logger.error('nexus_get_file_info failed', { error: pathValidation.error });
      return { success: false, error: new Error(pathValidation.error!) };
    }
    
    // Get file stats
    const stats = await fs.stat(filePath);
    
    logger.info('nexus_get_file_info succeeded');
    
    return {
      success: true,
      data: {
        path: filePath,
        name: path.basename(filePath),
        extension: path.extname(filePath),
        size: stats.size,
        created: stats.birthtime,
        modified: stats.mtime,
        accessed: stats.atime,
        isFile: stats.isFile(),
        isDirectory: stats.isDirectory(),
        isSymbolicLink: stats.isSymbolicLink(),
        permissions: stats.mode.toString(8)
      }
    };
  } catch (error) {
    const handlingResult = handleError(error as Error, { filePath });
    logger.error('nexus_get_file_info failed', { error: handlingResult.error });
    return { success: false, error: handlingResult.error };
  }
}

/**
 * Get disk usage information
 */
async function getDiskUsage(args: unknown): Promise<ToolResult<unknown>> {
  const validated = GetDiskUsageSchema.parse(args);
  const { path: dirPath } = validated;
  
  logger.info('nexus_get_disk_usage started', { dirPath });
  
  try {
    // Validate path
    const config = getConfig();
    const allowedPaths = config.tools.filesystem.allowed_paths;
    const deniedPaths = config.tools.filesystem.denied_paths;
    
    const pathValidation = validatePath(dirPath, allowedPaths, deniedPaths);
    if (!pathValidation.valid) {
      logger.error('nexus_get_disk_usage failed', { error: pathValidation.error });
      return { success: false, error: new Error(pathValidation.error!) };
    }
    
    // Check if path exists
    const stats = await fs.stat(dirPath);
    if (!stats.isDirectory()) {
      logger.error('nexus_get_disk_usage failed', { error: 'Path is not a directory' });
      return { success: false, error: new Error('Path is not a directory') };
    }
    
    // Calculate directory size recursively
    let totalSize = 0;
    let fileCount = 0;
    let dirCount = 0;
    
    await calculateDiskUsage(dirPath, (size, files, dirs) => {
      totalSize = size;
      fileCount = files;
      dirCount = dirs;
    });
    
    logger.info('nexus_get_disk_usage succeeded');
    
    return {
      success: true,
      data: {
        path: dirPath,
        totalSize,
        fileCount,
        dirCount,
        humanSize: formatBytes(totalSize)
      }
    };
  } catch (error) {
    const handlingResult = handleError(error as Error, { dirPath });
    logger.error('nexus_get_disk_usage failed', { error: handlingResult.error });
    return { success: false, error: handlingResult.error };
  }
}

/**
 * Helper for calculating disk usage
 */
async function calculateDiskUsage(
  dirPath: string,
  callback: (size: number, files: number, dirs: number) => void
): Promise<void> {
  let totalSize = 0;
  let fileCount = 0;
  let dirCount = 0;
  
  const items = await fs.readdir(dirPath, { withFileTypes: true });
  
  for (const item of items) {
    const fullPath = path.join(dirPath, item.name);
    
    if (item.isDirectory()) {
      dirCount++;
      const subdirStats = await fs.stat(fullPath);
      totalSize += subdirStats.size;
      
      // Recurse into subdirectory
      await calculateDiskUsageRecursive(fullPath, (size, files, dirs) => {
        totalSize += size;
        fileCount += files;
        dirCount += dirs;
      });
    } else if (item.isFile()) {
      fileCount++;
      const fileStats = await fs.stat(fullPath);
      totalSize += fileStats.size;
    }
  }
  
  callback(totalSize, fileCount, dirCount);
}

/**
 * Recursive helper for disk usage
 */
async function calculateDiskUsageRecursive(
  dirPath: string,
  callback: (size: number, files: number, dirs: number) => void
): Promise<void> {
  let totalSize = 0;
  let fileCount = 0;
  let dirCount = 0;
  
  const items = await fs.readdir(dirPath, { withFileTypes: true });
  
  for (const item of items) {
    const fullPath = path.join(dirPath, item.name);
    
    if (item.isDirectory()) {
      dirCount++;
      const subdirStats = await fs.stat(fullPath);
      totalSize += subdirStats.size;
      
      await calculateDiskUsageRecursive(fullPath, (size, files, dirs) => {
        totalSize += size;
        fileCount += files;
        dirCount += dirs;
      });
    } else if (item.isFile()) {
      fileCount++;
      const fileStats = await fs.stat(fullPath);
      totalSize += fileStats.size;
    }
  }
  
  callback(totalSize, fileCount, dirCount);
}

/**
 * Format bytes to human readable format
 */
function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
}

/**
 * Watch directory for changes (returns initial scan only)
 */
async function watchDirectory(args: unknown): Promise<ToolResult<unknown>> {
  const validated = WatchDirectorySchema.parse(args);
  const { path: dirPath, recursive, events } = validated;
  
  logger.info('nexus_watch_directory started', { dirPath, recursive, events });
  
  try {
    // Validate path
    const config = getConfig();
    const allowedPaths = config.tools.filesystem.allowed_paths;
    const deniedPaths = config.tools.filesystem.denied_paths;
    
    const pathValidation = validatePath(dirPath, allowedPaths, deniedPaths);
    if (!pathValidation.valid) {
      logger.error('nexus_watch_directory failed', { error: pathValidation.error });
      return { success: false, error: new Error(pathValidation.error!) };
    }
    
    // Check if directory exists
    const stats = await fs.stat(dirPath);
    if (!stats.isDirectory()) {
      logger.error('nexus_watch_directory failed', { error: 'Path is not a directory' });
      return { success: false, error: new Error('Path is not a directory') };
    }
    
    // Note: Full file watching requires fs.watch() which is not suitable for MCP tools
    // This implementation returns the current state and explains the limitation
    const currentFiles: Array<{
      path: string;
      name: string;
      modified: Date;
    }> = [];
    
    await listDirectoryRecursive(dirPath, currentFiles, true, true, true);
    
    logger.info('nexus_watch_directory succeeded');
    
    return {
      success: true,
      data: {
        path: dirPath,
        watching: false,
        message: 'File watching requires persistent connections. This tool returns the current state.',
        events: events,
        recursive: recursive,
        currentFiles: currentFiles.slice(0, 50), // Limit to 50 files
        totalFiles: currentFiles.length
      }
    };
  } catch (error) {
    const handlingResult = handleError(error as Error, { dirPath });
    logger.error('nexus_watch_directory failed', { error: handlingResult.error });
    return { success: false, error: handlingResult.error };
  }
}

/**
 * Read and parse JSON file
 */
async function readJson(args: unknown): Promise<ToolResult<unknown>> {
  const validated = ReadJsonSchema.parse(args);
  const { path: filePath } = validated;
  
  logger.info('nexus_read_json started', { filePath });
  
  try {
    // Validate path
    const config = getConfig();
    const allowedPaths = config.tools.filesystem.allowed_paths;
    const deniedPaths = config.tools.filesystem.denied_paths;
    
    const pathValidation = validatePath(filePath, allowedPaths, deniedPaths);
    if (!pathValidation.valid) {
      logger.error('nexus_read_json failed', { error: pathValidation.error });
      return { success: false, error: new Error(pathValidation.error!) };
    }
    
    // Read file
    const content = await fs.readFile(filePath, 'utf8');
    
    // Parse JSON
    const data = JSON.parse(content);
    
    logger.info('nexus_read_json succeeded');
    
    return {
      success: true,
      data: {
        path: filePath,
        data,
        size: content.length
      }
    };
  } catch (error) {
    const handlingResult = handleError(error as Error, { filePath });
    logger.error('nexus_read_json failed', { error: handlingResult.error });
    return { success: false, error: handlingResult.error };
  }
}

/**
 * Write data to JSON file
 */
async function writeJson(args: unknown): Promise<ToolResult<unknown>> {
  const validated = WriteJsonSchema.parse(args);
  const { path: filePath, data, pretty, createDirs } = validated;
  
  logger.info('nexus_write_json started', { filePath, pretty });
  
  try {
    // Validate path
    const config = getConfig();
    const allowedPaths = config.tools.filesystem.allowed_paths;
    const deniedPaths = config.tools.filesystem.denied_paths;
    
    const pathValidation = validatePath(filePath, allowedPaths, deniedPaths);
    if (!pathValidation.valid) {
      logger.error('nexus_write_json failed', { error: pathValidation.error });
      return { success: false, error: new Error(pathValidation.error!) };
    }
    
    // Create parent directories if needed
    if (createDirs) {
      const dir = path.dirname(filePath);
      await fs.mkdir(dir, { recursive: true });
    }
    
    // Convert to JSON
    const content = pretty 
      ? JSON.stringify(data, null, 2)
      : JSON.stringify(data);
    
    // Write file
    await fs.writeFile(filePath, content, 'utf8');
    
    const stats = await fs.stat(filePath);
    
    logger.info('nexus_write_json succeeded');
    
    return {
      success: true,
      data: {
        path: filePath,
        size: stats.size,
        written: true
      }
    };
  } catch (error) {
    const handlingResult = handleError(error as Error, { filePath });
    logger.error('nexus_write_json failed', { error: handlingResult.error });
    return { success: false, error: handlingResult.error };
  }
}

/**
 * Read and parse YAML file
 */
async function readYaml(args: unknown): Promise<ToolResult<unknown>> {
  const validated = ReadYamlSchema.parse(args);
  const { path: filePath } = validated;
  
  logger.info('nexus_read_yaml started', { filePath });
  
  try {
    // Validate path
    const config = getConfig();
    const allowedPaths = config.tools.filesystem.allowed_paths;
    const deniedPaths = config.tools.filesystem.denied_paths;
    
    const pathValidation = validatePath(filePath, allowedPaths, deniedPaths);
    if (!pathValidation.valid) {
      logger.error('nexus_read_yaml failed', { error: pathValidation.error });
      return { success: false, error: new Error(pathValidation.error!) };
    }
    
    // Read file
    const content = await fs.readFile(filePath, 'utf8');
    
    // Parse YAML (simple implementation for basic YAML)
    // Note: For full YAML support, use a library like js-yaml
    const data = parseSimpleYaml(content);
    
    logger.info('nexus_read_yaml succeeded');
    
    return {
      success: true,
      data: {
        path: filePath,
        data,
        size: content.length
      }
    };
  } catch (error) {
    const handlingResult = handleError(error as Error, { filePath });
    logger.error('nexus_read_yaml failed', { error: handlingResult.error });
    return { success: false, error: handlingResult.error };
  }
}

/**
 * Simple YAML parser for basic YAML files
 */
function parseSimpleYaml(content: string): any {
  const lines = content.split('\n');
  const result: any = {};
  const stack: Array<{ obj: any; indent: number }> = [{ obj: result, indent: 0 }];
  
  for (const line of lines) {
    if (line.trim() === '' || line.trim().startsWith('#')) continue;
    
    const indent = line.search(/\S/);
    const trimmed = line.trim();
    
    // Find current level
    const lastStack = stack[stack.length - 1];
    while (stack.length > 1 && lastStack && lastStack.indent >= indent) {
      stack.pop();
    }
    
    const current = stack[stack.length - 1]?.obj;
    
    // Handle key-value pairs
    if (trimmed.includes(':')) {
      const [key, ...valueParts] = trimmed.split(':');
      const value = valueParts.join(':').trim();
      
      if (!key) continue;
      
      if (value === '' || value === 'null') {
        current[key.trim()] = null;
      } else if (value === 'true') {
        current[key.trim()] = true;
      } else if (value === 'false') {
        current[key.trim()] = false;
      } else if (!isNaN(Number(value))) {
        current[key.trim()] = Number(value);
      } else if (value.startsWith('"') || value.startsWith("'")) {
        current[key.trim()] = value.slice(1, -1);
      } else {
        current[key.trim()] = value;
      }
    }
  }
  
  return result;
}

/**
 * Write data to YAML file
 */
async function writeYaml(args: unknown): Promise<ToolResult<unknown>> {
  const validated = WriteYamlSchema.parse(args);
  const { path: filePath, data, createDirs } = validated;
  
  logger.info('nexus_write_yaml started', { filePath });
  
  try {
    // Validate path
    const config = getConfig();
    const allowedPaths = config.tools.filesystem.allowed_paths;
    const deniedPaths = config.tools.filesystem.denied_paths;
    
    const pathValidation = validatePath(filePath, allowedPaths, deniedPaths);
    if (!pathValidation.valid) {
      logger.error('nexus_write_yaml failed', { error: pathValidation.error });
      return { success: false, error: new Error(pathValidation.error!) };
    }
    
    // Create parent directories if needed
    if (createDirs) {
      const dir = path.dirname(filePath);
      await fs.mkdir(dir, { recursive: true });
    }
    
    // Convert to YAML (simple implementation)
    const content = toSimpleYaml(data);
    
    // Write file
    await fs.writeFile(filePath, content, 'utf8');
    
    const stats = await fs.stat(filePath);
    
    logger.info('nexus_write_yaml succeeded');
    
    return {
      success: true,
      data: {
        path: filePath,
        size: stats.size,
        written: true
      }
    };
  } catch (error) {
    const handlingResult = handleError(error as Error, { filePath });
    logger.error('nexus_write_yaml failed', { error: handlingResult.error });
    return { success: false, error: handlingResult.error };
  }
}

/**
 * Simple YAML converter
 */
function toSimpleYaml(data: any, indent = 0): string {
  const spaces = '  '.repeat(indent);
  let result = '';
  
  if (typeof data === 'object' && data !== null && !Array.isArray(data)) {
    for (const [key, value] of Object.entries(data)) {
      if (value === null) {
        result += `${spaces}${key}: null\n`;
      } else if (typeof value === 'boolean') {
        result += `${spaces}${key}: ${value}\n`;
      } else if (typeof value === 'number') {
        result += `${spaces}${key}: ${value}\n`;
      } else if (typeof value === 'string') {
        result += `${spaces}${key}: "${value}"\n`;
      } else if (Array.isArray(value)) {
        result += `${spaces}${key}:\n`;
        for (const item of value) {
          result += `${spaces}  - ${JSON.stringify(item)}\n`;
        }
      } else {
        result += `${spaces}${key}:\n${toSimpleYaml(value, indent + 1)}`;
      }
    }
  } else if (Array.isArray(data)) {
    for (const item of data) {
      result += `${spaces}- ${JSON.stringify(item)}\n`;
    }
  } else {
    result += `${spaces}${JSON.stringify(data)}\n`;
  }
  
  return result;
}

/**
 * Read and parse CSV file
 */
async function readCsv(args: unknown): Promise<ToolResult<unknown>> {
  const validated = ReadCsvSchema.parse(args);
  const { path: filePath, hasHeader, delimiter } = validated;
  
  logger.info('nexus_read_csv started', { filePath, hasHeader, delimiter });
  
  try {
    // Validate path
    const config = getConfig();
    const allowedPaths = config.tools.filesystem.allowed_paths;
    const deniedPaths = config.tools.filesystem.denied_paths;
    
    const pathValidation = validatePath(filePath, allowedPaths, deniedPaths);
    if (!pathValidation.valid) {
      logger.error('nexus_read_csv failed', { error: pathValidation.error });
      return { success: false, error: new Error(pathValidation.error!) };
    }
    
    // Read file
    const content = await fs.readFile(filePath, 'utf8');
    const lines = content.split('\n').filter(line => line.trim() !== '');
    
    const delim = delimiter || ',';
    const result: Array<Record<string, string>> = [];
    
    // Parse CSV
    if (hasHeader && lines.length > 0) {
      const firstLine = lines[0];
      if (!firstLine) {
        logger.error('nexus_read_csv failed', { error: 'Empty file' });
        return { success: false, error: new Error('Empty file') };
      }
      const headers = firstLine.split(delim).map(h => h.trim());
      
      for (let i = 1; i < lines.length; i++) {
        const line = lines[i];
        if (!line) continue;
        const values = line.split(delim).map(v => v.trim());
        const row: Record<string, string> = {};
        
        headers.forEach((header, index) => {
          row[header] = values[index] || '';
        });
        
        result.push(row);
      }
    } else {
      for (const line of lines) {
        const values = line.split(delim).map(v => v.trim());
        result.push({ values: values.join(delim) });
      }
    }
    
    logger.info('nexus_read_csv succeeded');
    
    return {
      success: true,
      data: {
        path: filePath,
        rows: result,
        count: result.length,
        hasHeader
      }
    };
  } catch (error) {
    const handlingResult = handleError(error as Error, { filePath });
    logger.error('nexus_read_csv failed', { error: handlingResult.error });
    return { success: false, error: handlingResult.error };
  }
}

/**
 * Write data to CSV file
 */
async function writeCsv(args: unknown): Promise<ToolResult<unknown>> {
  const validated = WriteCsvSchema.parse(args);
  const { path: filePath, data, hasHeader, delimiter, createDirs } = validated;
  
  logger.info('nexus_write_csv started', { filePath, hasHeader, delimiter });
  
  try {
    // Validate path
    const config = getConfig();
    const allowedPaths = config.tools.filesystem.allowed_paths;
    const deniedPaths = config.tools.filesystem.denied_paths;
    
    const pathValidation = validatePath(filePath, allowedPaths, deniedPaths);
    if (!pathValidation.valid) {
      logger.error('nexus_write_csv failed', { error: pathValidation.error });
      return { success: false, error: new Error(pathValidation.error!) };
    }
    
    // Create parent directories if needed
    if (createDirs) {
      const dir = path.dirname(filePath);
      await fs.mkdir(dir, { recursive: true });
    }
    
    const delim = delimiter || ',';
    let content = '';
    
    if (data.length === 0) {
      content = '';
    } else if (hasHeader) {
      const headers = Object.keys(data[0] || {});
      content += headers.join(delim) + '\n';
      
      for (const row of data) {
        const values = headers.map(header => (row && row[header]) || '');
        content += values.join(delim) + '\n';
      }
    } else {
      for (const row of data) {
        const values = Object.values(row || {});
        content += values.join(delim) + '\n';
      }
    }
    
    // Write file
    await fs.writeFile(filePath, content, 'utf8');
    
    const stats = await fs.stat(filePath);
    
    logger.info('nexus_write_csv succeeded');
    
    return {
      success: true,
      data: {
        path: filePath,
        size: stats.size,
        rowsWritten: data.length,
        written: true
      }
    };
  } catch (error) {
    const handlingResult = handleError(error as Error, { filePath });
    logger.error('nexus_write_csv failed', { error: handlingResult.error });
    return { success: false, error: handlingResult.error };
  }
}

// ============================================================================
// Tool Definitions
// ============================================================================

export const filesystemTools: MCPTool[] = [
  // Basic Operations (Fase 2.1)
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
  },
  // Advanced Operations (Fase 2.2)
  {
    name: 'nexus_search_files',
    description: 'Search files using glob patterns with recursive support',
    category: FILESYSTEM_CATEGORY,
    inputSchema: SearchFilesSchema,
    handler: searchFiles,
    version: '1.0.0',
    tags: ['filesystem', 'search', 'glob']
  },
  {
    name: 'nexus_move_file',
    description: 'Move or rename a file with overwrite control',
    category: FILESYSTEM_CATEGORY,
    inputSchema: MoveFileSchema,
    handler: moveFile,
    version: '1.0.0',
    tags: ['filesystem', 'move', 'rename']
  },
  {
    name: 'nexus_copy_file',
    description: 'Copy a file with overwrite control',
    category: FILESYSTEM_CATEGORY,
    inputSchema: CopyFileSchema,
    handler: copyFile,
    version: '1.0.0',
    tags: ['filesystem', 'copy']
  },
  {
    name: 'nexus_get_file_info',
    description: 'Get detailed file information including metadata',
    category: FILESYSTEM_CATEGORY,
    inputSchema: GetFileInfoSchema,
    handler: getFileInfo,
    version: '1.0.0',
    tags: ['filesystem', 'info', 'metadata']
  },
  {
    name: 'nexus_get_disk_usage',
    description: 'Get disk usage information for a directory',
    category: FILESYSTEM_CATEGORY,
    inputSchema: GetDiskUsageSchema,
    handler: getDiskUsage,
    version: '1.0.0',
    tags: ['filesystem', 'disk', 'usage']
  },
  {
    name: 'nexus_watch_directory',
    description: 'Watch directory for changes (returns current state)',
    category: FILESYSTEM_CATEGORY,
    inputSchema: WatchDirectorySchema,
    handler: watchDirectory,
    version: '1.0.0',
    tags: ['filesystem', 'watch', 'monitor']
  },
  // Special Formats (Fase 2.3)
  {
    name: 'nexus_read_json',
    description: 'Read and parse JSON file',
    category: FILESYSTEM_CATEGORY,
    inputSchema: ReadJsonSchema,
    handler: readJson,
    version: '1.0.0',
    tags: ['filesystem', 'json', 'read']
  },
  {
    name: 'nexus_write_json',
    description: 'Write data to JSON file with pretty print option',
    category: FILESYSTEM_CATEGORY,
    inputSchema: WriteJsonSchema,
    handler: writeJson,
    version: '1.0.0',
    tags: ['filesystem', 'json', 'write']
  },
  {
    name: 'nexus_read_yaml',
    description: 'Read and parse YAML file (basic YAML support)',
    category: FILESYSTEM_CATEGORY,
    inputSchema: ReadYamlSchema,
    handler: readYaml,
    version: '1.0.0',
    tags: ['filesystem', 'yaml', 'read']
  },
  {
    name: 'nexus_write_yaml',
    description: 'Write data to YAML file (basic YAML support)',
    category: FILESYSTEM_CATEGORY,
    inputSchema: WriteYamlSchema,
    handler: writeYaml,
    version: '1.0.0',
    tags: ['filesystem', 'yaml', 'write']
  },
  {
    name: 'nexus_read_csv',
    description: 'Read and parse CSV file with header support',
    category: FILESYSTEM_CATEGORY,
    inputSchema: ReadCsvSchema,
    handler: readCsv,
    version: '1.0.0',
    tags: ['filesystem', 'csv', 'read']
  },
  {
    name: 'nexus_write_csv',
    description: 'Write data to CSV file with header support',
    category: FILESYSTEM_CATEGORY,
    inputSchema: WriteCsvSchema,
    handler: writeCsv,
    version: '1.0.0',
    tags: ['filesystem', 'csv', 'write']
  }
];

// ============================================================================
// Export
// ============================================================================

export default filesystemTools;
