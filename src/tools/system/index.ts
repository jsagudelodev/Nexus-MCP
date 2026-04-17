import { z } from 'zod';
import * as os from 'os';
import * as fs from 'fs/promises';
import type { MCPTool, ToolResult } from '../../types.js';
import { ToolCategory } from '../../types.js';
import { logger } from '../../logger.js';
import { handleError } from '../../utils/error-handler.js';
import { validatePath } from '../../utils/validation.js';
import { getConfig } from '../../config.js';

// ============================================================================
// System Category
// ============================================================================

const SYSTEM_CATEGORY: ToolCategory = ToolCategory.SYSTEM;

// ============================================================================
// Zod Schemas
// ============================================================================

/**
 * Schema for nexus_system_info
 */
const SystemInfoSchema = z.object({});

/**
 * Schema for nexus_system_os_info
 */
const SystemOsInfoSchema = z.object({});

/**
 * Schema for nexus_system_cpu_info
 */
const SystemCpuInfoSchema = z.object({});

/**
 * Schema for nexus_system_memory_info
 */
const SystemMemoryInfoSchema = z.object({});

/**
 * Schema for nexus_system_disk_info
 */
const SystemDiskInfoSchema = z.object({
  path: z.string().min(1, 'Path is required').optional()
});

/**
 * Schema for nexus_system_network_info
 */
const SystemNetworkInfoSchema = z.object({});

/**
 * Schema for nexus_execute_command
 */
const ExecuteCommandSchema = z.object({
  command: z.string().min(1, 'Command is required'),
  args: z.array(z.string()).optional(),
  cwd: z.string().optional(),
  timeout: z.number().int().positive().max(30000).default(5000)
});

/**
 * Schema for nexus_list_processes
 */
const ListProcessesSchema = z.object({});

// ============================================================================
// Tool Implementations
// ============================================================================

/**
 * Get general system information
 */
async function systemInfo(_args: unknown): Promise<ToolResult<unknown>> {
  logger.info('nexus_system_info started');
  
  try {
    const platform = os.platform();
    const arch = os.arch();
    const release = os.release();
    const hostname = os.hostname();
    const uptime = os.uptime();
    const homedir = os.homedir();
    const tmpdir = os.tmpdir();
    const totalmem = os.totalmem();
    const freemem = os.freemem();
    const cpus = os.cpus();
    const networkInterfaces = os.networkInterfaces();
    
    const uptimeHours = Math.floor(uptime / 3600);
    const uptimeMinutes = Math.floor((uptime % 3600) / 60);
    
    logger.info('nexus_system_info succeeded');
    
    return {
      success: true,
      data: {
        platform,
        arch,
        release,
        hostname,
        uptime: {
          seconds: uptime,
          hours: uptimeHours,
          minutes: uptimeMinutes
        },
        directories: {
          homedir,
          tmpdir
        },
        memory: {
          total: totalmem,
          free: freemem,
          used: totalmem - freemem,
          totalGB: (totalmem / 1073741824).toFixed(2),
          freeGB: (freemem / 1073741824).toFixed(2),
          usedGB: ((totalmem - freemem) / 1073741824).toFixed(2)
        },
        cpu: {
          count: cpus.length,
          model: cpus[0]?.model,
          speed: cpus[0]?.speed
        },
        networkInterfaces: Object.keys(networkInterfaces)
      }
    };
  } catch (error) {
    const handlingResult = handleError(error as Error);
    logger.error('nexus_system_info failed', { error: handlingResult.error });
    return { success: false, error: handlingResult.error };
  }
}

/**
 * Get OS-specific information
 */
async function systemOsInfo(_args: unknown): Promise<ToolResult<unknown>> {
  logger.info('nexus_system_os_info started');
  
  try {
    const platform = os.platform();
    const arch = os.arch();
    const release = os.release();
    const version = os.version();
    const type = os.type();
    const machine = os.machine();
    const endianness = os.endianness();
    
    logger.info('nexus_system_os_info succeeded');
    
    return {
      success: true,
      data: {
        platform,
        arch,
        release,
        version,
        type,
        machine,
        endianness,
        platformName: (platform as any).toLowerCase()
      }
    };
  } catch (error) {
    const handlingResult = handleError(error as Error);
    logger.error('nexus_system_os_info failed', { error: handlingResult.error });
    return { success: false, error: handlingResult.error };
  }
}

/**
 * Get CPU information
 */
async function systemCpuInfo(_args: unknown): Promise<ToolResult<unknown>> {
  logger.info('nexus_system_cpu_info started');
  
  try {
    const cpus = os.cpus();
    const cpuInfo = cpus[0];
    
    logger.info('nexus_system_cpu_info succeeded');
    
    return {
      success: true,
      data: {
        count: cpus.length,
        model: cpuInfo?.model,
        speed: cpuInfo?.speed,
        cores: cpus.map(cpu => ({
          model: cpu.model,
          speed: cpu.speed,
          times: cpu.times
        }))
      }
    };
  } catch (error) {
    const handlingResult = handleError(error as Error);
    logger.error('nexus_system_cpu_info failed', { error: handlingResult.error });
    return { success: false, error: handlingResult.error };
  }
}

/**
 * Get memory information
 */
async function systemMemoryInfo(_args: unknown): Promise<ToolResult<unknown>> {
  logger.info('nexus_system_memory_info started');
  
  try {
    const totalmem = os.totalmem();
    const freemem = os.freemem();
    const usedmem = totalmem - freemem;
    
    logger.info('nexus_system_memory_info succeeded');
    
    return {
      success: true,
      data: {
        total: totalmem,
        free: freemem,
        used: usedmem,
        totalGB: (totalmem / 1073741824).toFixed(2),
        freeGB: (freemem / 1073741824).toFixed(2),
        usedGB: (usedmem / 1073741824).toFixed(2),
        usagePercent: ((usedmem / totalmem) * 100).toFixed(2)
      }
    };
  } catch (error) {
    const handlingResult = handleError(error as Error);
    logger.error('nexus_system_memory_info failed', { error: handlingResult.error });
    return { success: false, error: handlingResult.error };
  }
}

/**
 * Get disk information
 */
async function systemDiskInfo(args: unknown): Promise<ToolResult<unknown>> {
  const validated = SystemDiskInfoSchema.parse(args);
  const { path: checkPath } = validated;
  
  logger.info('nexus_system_disk_info started', { path: checkPath });
  
  try {
    // Use provided path or default to current directory
    const targetPath = checkPath || process.cwd();
    
    // Validate path
    const config = getConfig();
    const pathValidation = validatePath(targetPath, config.tools.filesystem.allowed_paths, config.tools.filesystem.denied_paths);
    if (!pathValidation.valid) {
      logger.error('nexus_system_disk_info failed', { error: pathValidation.error });
      return { success: false, error: new Error(pathValidation.error!) };
    }
    
    // Get disk space information
    const stats = await fs.stat(targetPath);
    
    logger.info('nexus_system_disk_info succeeded');
    
    return {
      success: true,
      data: {
        path: targetPath,
        isDirectory: stats.isDirectory(),
        isFile: stats.isFile(),
        size: stats.size,
        sizeKB: (stats.size / 1024).toFixed(2),
        sizeMB: (stats.size / 1048576).toFixed(2),
        modified: stats.mtime,
        created: stats.birthtime,
        accessed: stats.atime
      }
    };
  } catch (error) {
    const handlingResult = handleError(error as Error, { path: checkPath });
    logger.error('nexus_system_disk_info failed', { error: handlingResult.error });
    return { success: false, error: handlingResult.error };
  }
}

/**
 * Get network information
 */
async function systemNetworkInfo(_args: unknown): Promise<ToolResult<unknown>> {
  logger.info('nexus_system_network_info started');
  
  try {
    const networkInterfaces = os.networkInterfaces();
    const interfaces: any = {};
    
    for (const [name, addresses] of Object.entries(networkInterfaces)) {
      if (addresses) {
        interfaces[name] = addresses.map(addr => ({
          address: addr.address,
          netmask: addr.netmask,
          family: addr.family,
          mac: addr.mac,
          internal: addr.internal,
          cidr: addr.cidr
        }));
      }
    }
    
    logger.info('nexus_system_network_info succeeded');
    
    return {
      success: true,
      data: {
        interfaces,
        interfaceNames: Object.keys(interfaces)
      }
    };
  } catch (error) {
    const handlingResult = handleError(error as Error);
    logger.error('nexus_system_network_info failed', { error: handlingResult.error });
    return { success: false, error: handlingResult.error };
  }
}

/**
 * Execute a system command (using exec for simplicity)
 */
async function executeCommand(args: unknown): Promise<ToolResult<unknown>> {
  const validated = ExecuteCommandSchema.parse(args);
  const { command, args: cmdArgs, cwd, timeout } = validated;
  
  logger.info('nexus_execute_command started', { command, args: cmdArgs });
  
  try {
    // Validate cwd if provided
    if (cwd) {
      const config = getConfig();
      const pathValidation = validatePath(cwd, config.tools.filesystem.allowed_paths, config.tools.filesystem.denied_paths);
      if (!pathValidation.valid) {
        logger.error('nexus_execute_command failed', { error: pathValidation.error });
        return { success: false, error: new Error(pathValidation.error!) };
      }
    }
    
    // Build full command string
    const fullCommand = cmdArgs && cmdArgs.length > 0 
      ? `${command} ${cmdArgs.join(' ')}` 
      : command;
    
    // Execute command using Node.js child_process
    const { exec } = await import('child_process');
    
    return new Promise((resolve) => {
      const timer = setTimeout(() => {
        resolve({
          success: false,
          error: new Error(`Command timed out after ${timeout}ms`)
        });
      }, timeout);
      
      exec(fullCommand, { cwd }, (error, stdout, stderr) => {
        clearTimeout(timer);
        
        if (error) {
          const handlingResult = handleError(error, { command });
          logger.error('nexus_execute_command failed', { error: handlingResult.error });
          resolve({ 
            success: false, 
            error: handlingResult.error,
            data: {
              stdout,
              stderr
            }
          });
          return;
        }
        
        logger.info('nexus_execute_command succeeded');
        resolve({
          success: true,
          data: {
            command: fullCommand,
            stdout,
            stderr,
            exitCode: 0
          }
        });
      });
    }) as Promise<ToolResult<unknown>>;
  } catch (error) {
    const handlingResult = handleError(error as Error, { command });
    logger.error('nexus_execute_command failed', { error: handlingResult.error });
    return { success: false, error: handlingResult.error };
  }
}

/**
 * List running processes
 */
async function listProcesses(_args: unknown): Promise<ToolResult<unknown>> {
  logger.info('nexus_list_processes started');
  
  try {
    const platform = os.platform();
    let command: string;
    let args: string[];
    
    if (platform === 'win32') {
      command = 'tasklist';
      args = ['/FO', 'CSV'];
    } else if (platform === 'darwin') {
      command = 'ps';
      args = ['-aux'];
    } else {
      command = 'ps';
      args = ['-aux'];
    }
    
    const { exec } = await import('child_process');
    
    return new Promise((resolve) => {
      exec(`${command} ${args.join(' ')}`, (error, stdout, _stderr) => {
        if (error) {
          const handlingResult = handleError(error);
          logger.error('nexus_list_processes failed', { error: handlingResult.error });
          resolve({ success: false, error: handlingResult.error });
          return;
        }
        
        logger.info('nexus_list_processes succeeded');
        
        // Parse output (simplified)
        const lines = stdout.split('\n').filter(line => line.trim());
        const processes = lines.slice(0, 50); // Limit to first 50
        
        resolve({
          success: true,
          data: {
            platform,
            command,
            totalLines: lines.length,
            processes: processes,
            truncated: lines.length > 50
          }
        });
      });
    }) as Promise<ToolResult<unknown>>;
  } catch (error) {
    const handlingResult = handleError(error as Error);
    logger.error('nexus_list_processes failed', { error: handlingResult.error });
    return { success: false, error: handlingResult.error };
  }
}

// ============================================================================
// System Tools Array
// ============================================================================

export const systemTools: MCPTool[] = [
  // System Information (Fase 6.3)
  {
    name: 'nexus_system_info',
    description: 'Get general system information (platform, memory, CPU, network)',
    category: SYSTEM_CATEGORY,
    inputSchema: SystemInfoSchema,
    handler: systemInfo,
    version: '1.0.0',
    tags: ['system', 'info', 'monitoring']
  },
  {
    name: 'nexus_system_os_info',
    description: 'Get OS-specific information (platform, arch, release, version)',
    category: SYSTEM_CATEGORY,
    inputSchema: SystemOsInfoSchema,
    handler: systemOsInfo,
    version: '1.0.0',
    tags: ['system', 'os', 'info']
  },
  {
    name: 'nexus_system_cpu_info',
    description: 'Get CPU information (cores, model, speed)',
    category: SYSTEM_CATEGORY,
    inputSchema: SystemCpuInfoSchema,
    handler: systemCpuInfo,
    version: '1.0.0',
    tags: ['system', 'cpu', 'info']
  },
  {
    name: 'nexus_system_memory_info',
    description: 'Get memory information (total, free, used)',
    category: SYSTEM_CATEGORY,
    inputSchema: SystemMemoryInfoSchema,
    handler: systemMemoryInfo,
    version: '1.0.0',
    tags: ['system', 'memory', 'info']
  },
  {
    name: 'nexus_system_disk_info',
    description: 'Get disk information for a specific path',
    category: SYSTEM_CATEGORY,
    inputSchema: SystemDiskInfoSchema,
    handler: systemDiskInfo,
    version: '1.0.0',
    tags: ['system', 'disk', 'info']
  },
  {
    name: 'nexus_system_network_info',
    description: 'Get network interface information',
    category: SYSTEM_CATEGORY,
    inputSchema: SystemNetworkInfoSchema,
    handler: systemNetworkInfo,
    version: '1.0.0',
    tags: ['system', 'network', 'info']
  },
  // Command Execution (Fase 6.1)
  {
    name: 'nexus_execute_command',
    description: 'Execute a system command with timeout',
    category: SYSTEM_CATEGORY,
    inputSchema: ExecuteCommandSchema,
    handler: executeCommand,
    version: '1.0.0',
    tags: ['system', 'command', 'exec']
  },
  // Process Management (Fase 6.2)
  {
    name: 'nexus_list_processes',
    description: 'List running processes',
    category: SYSTEM_CATEGORY,
    inputSchema: ListProcessesSchema,
    handler: listProcesses,
    version: '1.0.0',
    tags: ['system', 'process', 'list']
  }
];

export default systemTools;
