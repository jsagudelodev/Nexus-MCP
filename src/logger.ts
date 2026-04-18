/**
 * Nexus-MCP Logger
 * 
 * Structured logging system based on Winston with support for:
 * - Multiple transports (console, file with daily rotation)
 * - Structured JSON logging
 * - Correlation IDs for request tracing
 * - Child loggers for context isolation
 * - Configurable log levels
 * 
 * @module logger
 */

import winston from 'winston';
import DailyRotateFile from 'winston-daily-rotate-file';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';

// ============================================================================
// Types
// ============================================================================

/**
 * Log levels
 */
export enum LogLevel {
  ERROR = 'error',
  WARN = 'warn',
  INFO = 'info',
  DEBUG = 'debug'
}

/**
 * Log metadata
 */
export interface LogMetadata {
  timestamp?: string;
  level?: string;
  message?: string;
  [key: string]: unknown;
}

/**
 * Child logger options
 */
export interface ChildLoggerOptions {
  correlationId?: string;
  tool?: string;
  userId?: string;
  sessionId?: string;
  [key: string]: unknown;
}

// ============================================================================
// Logger Configuration
// ============================================================================

/**
 * Get log format based on configuration
 */
function getLogFormat(format: 'json' | 'text'): winston.Logform.Format {
  if (format === 'json') {
    return winston.format.combine(
      winston.format.timestamp(),
      winston.format.errors({ stack: true }),
      winston.format.json()
    );
  }

  return winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    winston.format.colorize(),
    winston.format.printf(({ timestamp, level, message, ...metadata }) => {
      const metaStr = Object.keys(metadata).length > 0 
        ? ` ${JSON.stringify(metadata)}` 
        : '';
      return `${timestamp} [${level}]: ${message}${metaStr}`;
    })
  );
}

/**
 * Create console transport
 */
function createConsoleTransport(format: 'json' | 'text'): winston.transports.ConsoleTransportInstance {
  return new winston.transports.Console({
    format: getLogFormat(format),
    level: process.env.NEXUS_LOG_LEVEL || LogLevel.INFO
  });
}

/**
 * Create file transport with daily rotation
 */
function createFileTransport(
  filePath: string,
  format: 'json' | 'text'
): winston.transports.FileTransportInstance | DailyRotateFile {
  const dirname = path.dirname(filePath);
  const filename = path.basename(filePath);
  
  return new DailyRotateFile({
    dirname,
    filename: `${filename}-%DATE%.log`,
    datePattern: 'YYYY-MM-DD',
    maxSize: '20m',
    maxFiles: '14d',
    format: getLogFormat(format),
    level: process.env.NEXUS_LOG_LEVEL || LogLevel.INFO
  });
}

// ============================================================================
// Main Logger
// ============================================================================

/**
 * Main Nexus logger instance
 */
const logger = winston.createLogger({
  level: process.env.NEXUS_LOG_LEVEL || LogLevel.INFO,
  format: getLogFormat(process.env.NEXUS_LOG_FORMAT as 'json' | 'text' || 'json'),
  defaultMeta: {
    service: 'nexus-mcp',
    version: process.env.npm_package_version || '1.0.0-alpha',
    environment: process.env.NODE_ENV || 'development'
  },
  transports: []
});

/**
 * Initialize logger with transports
 */
export function initializeLogger(): void {
  const logFormat = (process.env.NEXUS_LOG_FORMAT as 'json' | 'text') || 'text';
  const logOutput = process.env.NEXUS_LOG_OUTPUT || 'stdout';
  const logFile = process.env.NEXUS_LOG_FILE || 'logs/nexus.log';

  // Add console transport (default to stdout if not specified)
  if (logOutput === 'stdout' || logOutput === 'both' || !logOutput) {
    logger.add(createConsoleTransport(logFormat));
  }

  // Add file transport
  if (logOutput === 'file' || logOutput === 'both') {
    logger.add(createFileTransport(logFile, logFormat));
  }

  logger.info('Logger initialized', {
    format: logFormat,
    output: logOutput,
    file: logFile,
    level: process.env.NEXUS_LOG_LEVEL || LogLevel.INFO
  });
}

/**
 * Create a child logger with additional context
 */
export function createChildLogger(options: ChildLoggerOptions): winston.Logger {
  const correlationId = options.correlationId || uuidv4();
  
  return logger.child({
    correlationId,
    ...options
  });
}

// ============================================================================
// Logging Functions
// ============================================================================

/**
 * Log error message
 */
export function logError(message: string, metadata?: LogMetadata): void {
  logger.error(message, metadata);
}

/**
 * Log warning message
 */
export function logWarn(message: string, metadata?: LogMetadata): void {
  logger.warn(message, metadata);
}

/**
 * Log info message
 */
export function logInfo(message: string, metadata?: LogMetadata): void {
  logger.info(message, metadata);
}

/**
 * Log debug message
 */
export function logDebug(message: string, metadata?: LogMetadata): void {
  logger.debug(message, metadata);
}

// ============================================================================
// Tool-Specific Logging Functions
// ============================================================================

/**
 * Log tool execution start
 */
export function logToolStart(toolName: string, args: unknown): void {
  logger.info('Tool execution started', {
    tool: toolName,
    args: JSON.stringify(args),
    correlationId: uuidv4()
  });
}

/**
 * Log tool execution success
 */
export function logToolSuccess(toolName: string, duration: number, result?: unknown): void {
  logger.info('Tool execution completed', {
    tool: toolName,
    duration,
    success: true,
    result: result ? JSON.stringify(result) : undefined
  });
}

/**
 * Log tool execution error
 */
export function logToolError(toolName: string, error: Error, duration?: number): void {
  logger.error('Tool execution failed', {
    tool: toolName,
    duration,
    error: error.message,
    stack: error.stack,
    success: false
  });
}

/**
 * Log HTTP request
 */
export function logHttpRequest(method: string, url: string, duration: number, status?: number): void {
  logger.info('HTTP request', {
    method,
    url,
    duration,
    status,
    success: status !== undefined && status < 400
  });
}

/**
 * Log database query
 */
export function logDbQuery(query: string, duration: number, rowCount?: number): void {
  logger.debug('Database query executed', {
    query: query.substring(0, 200), // Truncate long queries
    duration,
    rowCount,
    success: true
  });
}

/**
 * Log database error
 */
export function logDbError(query: string, error: Error): void {
  logger.error('Database query failed', {
    query: query.substring(0, 200),
    error: error.message,
    stack: error.stack,
    success: false
  });
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Set log level dynamically
 */
export function setLogLevel(level: LogLevel): void {
  logger.level = level;
  logger.info(`Log level changed to ${level}`);
}

/**
 * Get current log level
 */
export function getLogLevel(): string {
  return logger.level;
}

/**
 * Flush logger (useful before shutdown)
 */
export async function flushLogger(): Promise<void> {
  return new Promise((resolve) => {
    logger.on('finish', () => resolve());
    logger.end();
  });
}

/**
 * Create a request-specific logger with correlation ID
 */
export function createRequestLogger(correlationId?: string): winston.Logger {
  return createChildLogger({
    correlationId: correlationId || uuidv4(),
    type: 'request'
  });
}

/**
 * Create a tool-specific logger
 */
export function createToolLogger(toolName: string): winston.Logger {
  return createChildLogger({
    tool: toolName,
    type: 'tool'
  });
}

// ============================================================================
// Export main logger instance
// ============================================================================

export default logger;
export { logger };
// All other exports are already declared with export keyword above
