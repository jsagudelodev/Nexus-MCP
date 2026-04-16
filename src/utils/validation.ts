/**
 * Nexus-MCP Validation Utilities
 * 
 * Validation functions for various inputs:
 * - Path validation (security)
 * - URL validation
 * - Command validation (security)
 * - Size validation
 * - File extension validation
 * 
 * @module validation
 */

import * as path from 'path';
import { z } from 'zod';

// ============================================================================
// Path Validation
// ============================================================================

/**
 * Validate file path is within allowed paths
 */
export function validatePath(
  filePath: string,
  allowedPaths: string[],
  deniedPaths: string[]
): { valid: boolean; error?: string } {
  const resolvedPath = path.resolve(filePath);
  
  // Check denied paths first
  for (const denied of deniedPaths) {
    const resolvedDenied = path.resolve(denied);
    if (resolvedPath.startsWith(resolvedDenied)) {
      return {
        valid: false,
        error: `Path is within denied path: ${denied}`
      };
    }
  }
  
  // Check allowed paths
  if (allowedPaths.length === 0) {
    return { valid: true }; // No restrictions
  }
  
  for (const allowed of allowedPaths) {
    const resolvedAllowed = path.resolve(allowed);
    if (resolvedPath.startsWith(resolvedAllowed)) {
      return { valid: true };
    }
  }
  
  return {
    valid: false,
    error: `Path is not within allowed paths: ${allowedPaths.join(', ')}`
  };
}

/**
 * Validate file extension
 */
export function validateFileExtension(
  filePath: string,
  allowedExtensions: string[]
): { valid: boolean; error?: string } {
  const ext = path.extname(filePath).toLowerCase();
  
  if (allowedExtensions.length === 0) {
    return { valid: true }; // No restrictions
  }
  
  const normalizedAllowed = allowedExtensions.map(e => e.toLowerCase().startsWith('.') ? e : `.${e}`);
  
  if (!normalizedAllowed.includes(ext)) {
    return {
      valid: false,
      error: `File extension not allowed: ${ext}. Allowed: ${allowedExtensions.join(', ')}`
    };
  }
  
  return { valid: true };
}

/**
 * Validate filename is safe
 */
export function validateFilename(filename: string): { valid: boolean; error?: string } {
  // Check for invalid characters
  const invalidChars = /[<>:"|?*]/;
  if (invalidChars.test(filename)) {
    return {
      valid: false,
      error: 'Filename contains invalid characters'
    };
  }
  
  // Check for reserved names (Windows)
  const reservedNames = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])$/i;
  if (reservedNames.test(path.basename(filename, path.extname(filename)))) {
    return {
      valid: false,
      error: 'Filename is a reserved name'
    };
  }
  
  // Check for path traversal
  if (filename.includes('..')) {
    return {
      valid: false,
      error: 'Filename contains path traversal sequence'
    };
  }
  
  return { valid: true };
}

// ============================================================================
// URL Validation
// ============================================================================

/**
 * Validate URL format
 */
export function validateURL(url: string): { valid: boolean; error?: string } {
  try {
    const parsed = new URL(url);
    
    // Check protocol
    const allowedProtocols = ['http:', 'https:', 'ftp:', 'file:'];
    if (!allowedProtocols.includes(parsed.protocol)) {
      return {
        valid: false,
        error: `Protocol not allowed: ${parsed.protocol}`
      };
    }
    
    // Check for localhost in production (security)
    if (parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1') {
      // Allow in development, warn in production
      if (process.env.NODE_ENV === 'production') {
        return {
          valid: false,
          error: 'Localhost URLs not allowed in production'
        };
      }
    }
    
    return { valid: true };
  } catch (error) {
    return {
      valid: false,
      error: `Invalid URL format: ${(error as Error).message}`
    };
  }
}

/**
 * Validate domain is not in blocklist
 */
export function validateDomain(
  url: string,
  blockedDomains: string[]
): { valid: boolean; error?: string } {
  try {
    const parsed = new URL(url);
    const hostname = parsed.hostname.toLowerCase();
    
    for (const blocked of blockedDomains) {
      if (hostname === blocked.toLowerCase() || hostname.endsWith(`.${blocked.toLowerCase()}`)) {
        return {
          valid: false,
          error: `Domain is blocked: ${blocked}`
        };
      }
    }
    
    return { valid: true };
  } catch (error) {
    return {
      valid: false,
      error: `Invalid URL format: ${(error as Error).message}`
    };
  }
}

// ============================================================================
// Command Validation
// ============================================================================

/**
 * Validate command is allowed
 */
export function validateCommand(
  command: string,
  allowedCommands: string[],
  deniedCommands: string[]
): { valid: boolean; error?: string } {
  const trimmedCommand = command.trim();
  const baseCommand = trimmedCommand.split(' ')[0];
  
  if (!baseCommand) {
    return {
      valid: false,
      error: 'Command is empty'
    };
  }
  
  // Check denied commands first
  for (const denied of deniedCommands) {
    if (baseCommand === denied || baseCommand.endsWith(`/${denied}`)) {
      return {
        valid: false,
        error: `Command is denied: ${denied}`
      };
    }
  }
  
  // If allowed commands list is empty, allow all except denied
  if (allowedCommands.length === 0) {
    return { valid: true };
  }
  
  // Check allowed commands
  for (const allowed of allowedCommands) {
    if (baseCommand === allowed || baseCommand.endsWith(`/${allowed}`)) {
      return { valid: true };
    }
  }
  
  return {
    valid: false,
    error: `Command is not allowed: ${baseCommand}. Allowed: ${allowedCommands.join(', ')}`
  };
}

/**
 * Sanitize command arguments
 */
export function sanitizeCommandArgs(args: string[]): string[] {
  return args.map(arg => {
    // Remove dangerous shell characters
    return arg.replace(/[;&|`$()]/g, '');
  });
}

/**
 * Check for shell injection patterns
 */
export function checkShellInjection(input: string): boolean {
  const injectionPatterns = [
    /[;&|`$()]/,
    /\$\([^)]*\)/,
    /`[^`]*`/,
    /\${[^}]*}/,
    /\|.*\|/,
    /&&/,
    /\|\|/,
    /;/
  ];
  
  return injectionPatterns.some(pattern => pattern.test(input));
}

// ============================================================================
// Size Validation
// ============================================================================

/**
 * Parse size string to bytes
 */
export function parseSize(size: string): number {
  const units: Record<string, number> = {
    b: 1,
    kb: 1024,
    mb: 1024 * 1024,
    gb: 1024 * 1024 * 1024,
    tb: 1024 * 1024 * 1024 * 1024
  };
  
  const match = size.toLowerCase().match(/^(\d+(?:\.\d+)?)\s*(b|kb|mb|gb|tb)?$/);
  if (!match || !match[1]) {
    throw new Error(`Invalid size format: ${size}`);
  }
  
  const value = parseFloat(match[1]);
  const unit = match[2] || 'b';
  
  return value * (units[unit] || 1);
}

/**
 * Validate size is within limits
 */
export function validateSize(
  size: number,
  maxSize: string
): { valid: boolean; error?: string } {
  const maxBytes = parseSize(maxSize);
  
  if (size > maxBytes) {
    return {
      valid: false,
      error: `Size exceeds maximum allowed: ${size} bytes > ${maxSize} bytes (${maxSize})`
    };
  }
  
  return { valid: true };
}

/**
 * Validate file size
 */
export function validateFileSize(
  filePath: string,
  maxSize: string,
  getFileSize: (path: string) => Promise<number>
): Promise<{ valid: boolean; error?: string }> {
  return getFileSize(filePath).then(size => validateSize(size, maxSize));
}

// ============================================================================
// Zod Validators
// ============================================================================

/**
 * Zod schema for file path validation
 */
export const filePathSchema = z.string().refine(
  (value) => !value.includes('..'),
  { message: 'Path cannot contain ".."' }
).refine(
  (value) => !/[<>:"|?*]/.test(value),
  { message: 'Path contains invalid characters' }
);

/**
 * Zod schema for URL validation
 */
export const urlSchema = z.string().url().refine(
  (value) => {
    try {
      const url = new URL(value);
      return ['http:', 'https:', 'ftp:', 'file:'].includes(url.protocol);
    } catch {
      return false;
    }
  },
  { message: 'URL protocol not allowed' }
);

/**
 * Zod schema for positive integer
 */
export const positiveIntSchema = z.number().int().positive();

/**
 * Zod schema for non-negative integer
 */
export const nonNegativeIntSchema = z.number().int().nonnegative();

/**
 * Zod schema for port number
 */
export const portSchema = z.number().int().min(1).max(65535);

// ============================================================================
// Generic Validation
// ============================================================================

/**
 * Validate object against schema
 */
export function validateSchema<T>(schema: z.ZodSchema<T>, data: unknown): {
  valid: boolean;
  data?: T;
  error?: string;
} {
  try {
    const validated = schema.parse(data);
    return {
      valid: true,
      data: validated
    };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return {
        valid: false,
        error: error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join('; ')
      };
    }
    return {
      valid: false,
      error: `Validation error: ${(error as Error).message}`
    };
  }
}

/**
 * Validate required fields
 */
export function validateRequiredFields(
  obj: Record<string, unknown>,
  requiredFields: string[]
): { valid: boolean; error?: string } {
  const missing = requiredFields.filter(field => obj[field] === undefined || obj[field] === null);
  
  if (missing.length > 0) {
    return {
      valid: false,
      error: `Missing required fields: ${missing.join(', ')}`
    };
  }
  
  return { valid: true };
}

/**
 * Validate field types
 */
export function validateFieldTypes(
  obj: Record<string, unknown>,
  typeMap: Record<string, 'string' | 'number' | 'boolean' | 'object' | 'array'>
): { valid: boolean; error?: string } {
  const invalid: string[] = [];
  
  for (const [field, expectedType] of Object.entries(typeMap)) {
    const value = obj[field];
    
    if (value === undefined || value === null) {
      continue; // Skip null/undefined
    }
    
    let actualType: string;
    if (Array.isArray(value)) {
      actualType = 'array';
    } else if (typeof value === 'object') {
      actualType = 'object';
    } else {
      actualType = typeof value;
    }
    
    if (actualType !== expectedType) {
      invalid.push(`${field} (expected ${expectedType}, got ${actualType})`);
    }
  }
  
  if (invalid.length > 0) {
    return {
      valid: false,
      error: `Invalid field types: ${invalid.join(', ')}`
    };
  }
  
  return { valid: true };
}

// ============================================================================
// Export
// ============================================================================
// All exports are already declared with export keyword above
