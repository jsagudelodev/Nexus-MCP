/**
 * Nexus-MCP Error Handler
 * 
 * Centralized error handling with support for:
 * - Error classification and categorization
 * - Error recovery strategies
 * - Error logging and tracking
 * - User-friendly error messages
 * - Error context preservation
 * 
 * @module error-handler
 */

import { NexusError, ErrorCode, ErrorType, ErrorHandlingResult, ToolResult } from '../types';
import { logger } from '../logger';

// ============================================================================
// Error Classification
// ============================================================================

/**
 * Classify error type based on error message and properties
 */
export function classifyError(error: Error): ErrorType {
  const message = error.message.toLowerCase();
  
  // Validation errors
  if (message.includes('invalid') || message.includes('validation') || message.includes('schema')) {
    return ErrorType.VALIDATION_ERROR;
  }
  
  // Permission errors
  if (message.includes('permission') || message.includes('denied') || message.includes('unauthorized')) {
    return ErrorType.PERMISSION_ERROR;
  }
  
  // Timeout errors
  if (message.includes('timeout') || message.includes('timed out')) {
    return ErrorType.TIMEOUT_ERROR;
  }
  
  // Network errors
  if (message.includes('network') || message.includes('connection') || message.includes('econnrefused')) {
    return ErrorType.NETWORK_ERROR;
  }
  
  // Filesystem errors
  if (message.includes('file') || message.includes('directory') || message.includes('enoent')) {
    return ErrorType.FILESYSTEM_ERROR;
  }
  
  // Database errors
  if (message.includes('database') || message.includes('sql') || message.includes('query')) {
    return ErrorType.DATABASE_ERROR;
  }
  
  // Git errors
  if (message.includes('git') || message.includes('repository') || message.includes('commit')) {
    return ErrorType.GIT_ERROR;
  }
  
  // AI errors
  if (message.includes('anthropic') || message.includes('openai') || message.includes('llm') || message.includes('api')) {
    return ErrorType.AI_ERROR;
  }
  
  // Default to system error
  return ErrorType.SYSTEM_ERROR;
}

/**
 * Map error message to specific error code
 */
export function mapErrorCode(message: string): ErrorCode {
  const lowerMessage = message.toLowerCase();
  
  // Validation errors
  if (lowerMessage.includes('invalid input')) return ErrorCode.INVALID_INPUT;
  if (lowerMessage.includes('required') || lowerMessage.includes('missing')) return ErrorCode.MISSING_REQUIRED_FIELD;
  if (lowerMessage.includes('type')) return ErrorCode.INVALID_TYPE;
  if (lowerMessage.includes('format')) return ErrorCode.INVALID_FORMAT;
  
  // Filesystem errors
  if (lowerMessage.includes('no such file') || lowerMessage.includes('enoent')) return ErrorCode.FILE_NOT_FOUND;
  if (lowerMessage.includes('file already exists')) return ErrorCode.FILE_ALREADY_EXISTS;
  if (lowerMessage.includes('permission')) return ErrorCode.PERMISSION_DENIED;
  if (lowerMessage.includes('too large')) return ErrorCode.FILE_TOO_LARGE;
  
  // HTTP errors
  if (lowerMessage.includes('invalid url')) return ErrorCode.INVALID_URL;
  if (lowerMessage.includes('timeout')) return ErrorCode.TIMEOUT;
  
  // Git errors
  if (lowerMessage.includes('not a git repository')) return ErrorCode.GIT_NOT_INITIALIZED;
  if (lowerMessage.includes('conflict')) return ErrorCode.GIT_CONFLICT;
  
  // Database errors
  if (lowerMessage.includes('connection')) return ErrorCode.DATABASE_CONNECTION_FAILED;
  if (lowerMessage.includes('query')) return ErrorCode.DATABASE_QUERY_FAILED;
  
  // System errors
  if (lowerMessage.includes('command not allowed')) return ErrorCode.COMMAND_NOT_ALLOWED;
  if (lowerMessage.includes('command failed')) return ErrorCode.COMMAND_FAILED;
  
  // AI errors
  if (lowerMessage.includes('rate limit')) return ErrorCode.AI_RATE_LIMIT;
  if (lowerMessage.includes('invalid model')) return ErrorCode.AI_INVALID_MODEL;
  
  return ErrorCode.UNKNOWN_ERROR;
}

/**
 * Determine if error is recoverable
 */
export function isRecoverable(error: Error): boolean {
  const errorType = classifyError(error);
  
  // Recoverable errors
  switch (errorType) {
    case ErrorType.TIMEOUT_ERROR:
    case ErrorType.NETWORK_ERROR:
    case ErrorType.DATABASE_ERROR:
      return true;
    
    case ErrorType.VALIDATION_ERROR:
      return true; // User can fix input
    
    case ErrorType.PERMISSION_ERROR:
      return false; // User needs to fix permissions
    
    case ErrorType.FILESYSTEM_ERROR:
      return true; // Might be temporary
    
    default:
      return false;
  }
}

/**
 * Calculate retry delay with exponential backoff
 */
export function calculateRetryDelay(attempt: number, baseDelay: number = 1000): number {
  return Math.min(baseDelay * Math.pow(2, attempt), 30000); // Max 30 seconds
}

// ============================================================================
// Error Creation
// ============================================================================

/**
 * Create a NexusError from a generic Error
 */
export function createNexusError(
  error: Error | string,
  code?: ErrorCode,
  context?: Record<string, unknown>
): NexusError {
  const errorMessage = typeof error === 'string' ? error : error.message;
  const errorCode = code || mapErrorCode(errorMessage);
  const errorType = typeof error === 'string' ? ErrorType.SYSTEM_ERROR : classifyError(error);
  const recoverable = typeof error === 'string' ? false : isRecoverable(error);
  
  const nexusError = new NexusError(
    errorMessage,
    errorCode,
    errorType,
    recoverable,
    context
  );
  
  // Preserve stack trace if available
  if (typeof error !== 'string' && error.stack) {
    nexusError.stack = error.stack;
  }
  
  return nexusError;
}

/**
 * Create a validation error
 */
export function createValidationError(message: string, context?: Record<string, unknown>): NexusError {
  return new NexusError(
    message,
    ErrorCode.INVALID_INPUT,
    ErrorType.VALIDATION_ERROR,
    true,
    context
  );
}

/**
 * Create a permission error
 */
export function createPermissionError(message: string, context?: Record<string, unknown>): NexusError {
  return new NexusError(
    message,
    ErrorCode.PERMISSION_DENIED,
    ErrorType.PERMISSION_ERROR,
    false,
    context
  );
}

/**
 * Create a timeout error
 */
export function createTimeoutError(message: string, context?: Record<string, unknown>): NexusError {
  return new NexusError(
    message,
    ErrorCode.TIMEOUT,
    ErrorType.TIMEOUT_ERROR,
    true,
    context
  );
}

/**
 * Create a not found error
 */
export function createNotFoundError(resource: string, identifier: string): NexusError {
  return new NexusError(
    `${resource} not found: ${identifier}`,
    ErrorCode.FILE_NOT_FOUND,
    ErrorType.FILESYSTEM_ERROR,
    false,
    { resource, identifier }
  );
}

// ============================================================================
// Error Handling
// ============================================================================

/**
 * Handle error with logging and recovery strategy
 */
export function handleError(
  error: Error | NexusError | string,
  context?: Record<string, unknown>
): ErrorHandlingResult {
  const nexusError = error instanceof NexusError 
    ? error 
    : createNexusError(error, undefined, context);
  
  // Log error
  logger.error('Error occurred', {
    code: nexusError.code,
    type: nexusError.type,
    message: nexusError.message,
    recoverable: nexusError.recoverable,
    context: nexusError.context
  });
  
  // Determine retry strategy
  const shouldRetry = nexusError.recoverable;
  const retryDelay = shouldRetry ? calculateRetryDelay(0) : undefined;
  
  return {
    handled: true,
    error: nexusError,
    shouldRetry,
    retryDelay
  };
}

/**
 * Wrap async function with error handling
 */
export async function withErrorHandling<T>(
  fn: () => Promise<T>,
  context?: Record<string, unknown>
): Promise<ToolResult<T>> {
  try {
    const result = await fn();
    return {
      success: true,
      data: result
    };
  } catch (error) {
    const handlingResult = handleError(error as Error, context);
    return {
      success: false,
      error: handlingResult.error,
      metadata: {
        shouldRetry: handlingResult.shouldRetry,
        retryDelay: handlingResult.retryDelay
      }
    };
  }
}

/**
 * Retry async function with exponential backoff
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  context?: Record<string, unknown>
): Promise<T> {
  let lastError: Error;
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;
      const handlingResult = handleError(error as Error, context);
      
      if (attempt === maxRetries || !handlingResult.shouldRetry) {
        throw lastError;
      }
      
      const delay = calculateRetryDelay(attempt);
      logger.warn(`Retrying after ${delay}ms (attempt ${attempt + 1}/${maxRetries})`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  
  throw lastError!;
}

// ============================================================================
// Error Middleware
// ============================================================================

/**
 * Express/HTTP error middleware
 */
export function errorMiddleware(
  error: Error,
  _req: unknown,
  _res: unknown,
  next: (error?: Error) => void
): void {
  const handlingResult = handleError(error);
  
  // Pass to next middleware if not handled
  if (!handlingResult.handled) {
    next(error);
  }
}

/**
 * Async error wrapper for Express routes
 */
export function asyncHandler<T extends unknown[]>(
  fn: (...args: T) => Promise<unknown>
): (...args: T) => Promise<void> {
  return async (...args: T): Promise<void> => {
    try {
      await fn(...args);
    } catch (error) {
      const lastArg = args[args.length - 1];
      if (typeof lastArg === 'function') {
        lastArg(error);
      } else {
        throw error;
      }
    }
  };
}

// ============================================================================
// Export
// ============================================================================
// All exports are already declared with export keyword above
