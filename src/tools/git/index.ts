import { z } from 'zod';
import simpleGit, { SimpleGit } from 'simple-git';
import type { MCPTool, ToolResult } from '../../types.js';
import { ToolCategory } from '../../types.js';
import { logger } from '../../logger.js';
import { handleError } from '../../utils/error-handler.js';
import { validatePath } from '../../utils/validation.js';
import { getConfig } from '../../config.js';

// ============================================================================
// Git Category
// ============================================================================

const GIT_CATEGORY: ToolCategory = ToolCategory.GIT;

// ============================================================================
// Zod Schemas
// ============================================================================

/**
 * Schema for nexus_git_init
 */
const GitInitSchema = z.object({
  path: z.string().min(1, 'Path is required'),
  bare: z.boolean().default(false)
});

/**
 * Schema for nexus_git_clone
 */
const GitCloneSchema = z.object({
  url: z.string().url('Invalid Git URL format'),
  destination: z.string().min(1, 'Destination path is required'),
  branch: z.string().optional()
});

/**
 * Schema for nexus_git_status
 */
const GitStatusSchema = z.object({
  path: z.string().min(1, 'Path is required')
});

/**
 * Schema for nexus_git_add
 */
const GitAddSchema = z.object({
  path: z.string().min(1, 'Path is required'),
  files: z.array(z.string()).optional()
});

/**
 * Schema for nexus_git_commit
 */
const GitCommitSchema = z.object({
  path: z.string().min(1, 'Path is required'),
  message: z.string().min(1, 'Commit message is required'),
  author: z.object({
    name: z.string(),
    email: z.string()
  }).optional()
});

/**
 * Schema for nexus_git_log
 */
const GitLogSchema = z.object({
  path: z.string().min(1, 'Path is required'),
  maxCount: z.number().int().positive().max(100).default(10)
});

/**
 * Schema for nexus_git_branch_list
 */
const GitBranchListSchema = z.object({
  path: z.string().min(1, 'Path is required')
});

/**
 * Schema for nexus_git_branch_create
 */
const GitBranchCreateSchema = z.object({
  path: z.string().min(1, 'Path is required'),
  branchName: z.string().min(1, 'Branch name is required'),
  startPoint: z.string().optional()
});

/**
 * Schema for nexus_git_branch_delete
 */
const GitBranchDeleteSchema = z.object({
  path: z.string().min(1, 'Path is required'),
  branchName: z.string().min(1, 'Branch name is required'),
  force: z.boolean().default(false)
});

/**
 * Schema for nexus_git_branch_switch
 */
const GitBranchSwitchSchema = z.object({
  path: z.string().min(1, 'Path is required'),
  branchName: z.string().min(1, 'Branch name is required'),
  createNew: z.boolean().default(false)
});

/**
 * Schema for nexus_git_merge
 */
const GitMergeSchema = z.object({
  path: z.string().min(1, 'Path is required'),
  branchName: z.string().min(1, 'Branch name is required'),
  message: z.string().optional()
});

/**
 * Schema for nexus_git_rebase
 */
const GitRebaseSchema = z.object({
  path: z.string().min(1, 'Path is required'),
  branchName: z.string().min(1, 'Branch name is required'),
  onto: z.string().optional()
});

/**
 * Schema for nexus_git_diff
 */
const GitDiffSchema = z.object({
  path: z.string().min(1, 'Path is required'),
  file: z.string().optional(),
  options: z.object({
    cached: z.boolean().default(false),
    nameOnly: z.boolean().default(false),
    stat: z.boolean().default(false)
  }).optional()
});

/**
 * Schema for nexus_git_show
 */
const GitShowSchema = z.object({
  path: z.string().min(1, 'Path is required'),
  commit: z.string().optional(),
  file: z.string().optional()
});

/**
 * Schema for nexus_git_stash
 */
const GitStashSchema = z.object({
  path: z.string().min(1, 'Path is required'),
  message: z.string().optional(),
  action: z.enum(['save', 'list', 'pop', 'drop', 'clear']).default('save')
});

// ============================================================================
// Tool Implementations
// ============================================================================

/**
 * Initialize a Git repository
 */
async function gitInit(args: unknown): Promise<ToolResult<unknown>> {
  const validated = GitInitSchema.parse(args);
  const { path: repoPath, bare } = validated;
  
  logger.info('nexus_git_init started', { path: repoPath, bare });
  
  try {
    // Validate path
    const config = getConfig();
    const pathValidation = validatePath(repoPath, config.tools.filesystem.allowed_paths, config.tools.filesystem.denied_paths);
    if (!pathValidation.valid) {
      logger.error('nexus_git_init failed', { error: pathValidation.error });
      return { success: false, error: new Error(pathValidation.error!) };
    }
    
    const git: SimpleGit = simpleGit(repoPath);
    await git.init(bare);
    
    logger.info('nexus_git_init succeeded', { path: repoPath });
    
    return {
      success: true,
      data: {
        path: repoPath,
        bare,
        initialized: true
      }
    };
  } catch (error) {
    const handlingResult = handleError(error as Error, { path: repoPath });
    logger.error('nexus_git_init failed', { error: handlingResult.error });
    return { success: false, error: handlingResult.error };
  }
}

/**
 * Clone a Git repository
 */
async function gitClone(args: unknown): Promise<ToolResult<unknown>> {
  const validated = GitCloneSchema.parse(args);
  const { url, destination, branch } = validated;
  
  logger.info('nexus_git_clone started', { url, destination, branch });
  
  try {
    // Validate destination path
    const config = getConfig();
    const pathValidation = validatePath(destination, config.tools.filesystem.allowed_paths, config.tools.filesystem.denied_paths);
    if (!pathValidation.valid) {
      logger.error('nexus_git_clone failed', { error: pathValidation.error });
      return { success: false, error: new Error(pathValidation.error!) };
    }
    
    const git: SimpleGit = simpleGit();
    const cloneOptions: any = {};
    if (branch) {
      cloneOptions['--branch'] = branch;
    }
    
    await git.clone(url, destination, cloneOptions);
    
    logger.info('nexus_git_clone succeeded', { url, destination });
    
    return {
      success: true,
      data: {
        url,
        destination,
        branch,
        cloned: true
      }
    };
  } catch (error) {
    const handlingResult = handleError(error as Error, { url, destination });
    logger.error('nexus_git_clone failed', { error: handlingResult.error });
    return { success: false, error: handlingResult.error };
  }
}

/**
 * Get Git repository status
 */
async function gitStatus(args: unknown): Promise<ToolResult<unknown>> {
  const validated = GitStatusSchema.parse(args);
  const { path: repoPath } = validated;
  
  logger.info('nexus_git_status started', { path: repoPath });
  
  try {
    // Validate path
    const config = getConfig();
    const pathValidation = validatePath(repoPath, config.tools.filesystem.allowed_paths, config.tools.filesystem.denied_paths);
    if (!pathValidation.valid) {
      logger.error('nexus_git_status failed', { error: pathValidation.error });
      return { success: false, error: new Error(pathValidation.error!) };
    }
    
    const git: SimpleGit = simpleGit(repoPath);
    const status = await git.status();
    
    logger.info('nexus_git_status succeeded', { path: repoPath });
    
    return {
      success: true,
      data: {
        path: repoPath,
        current: status.current,
        tracking: status.tracking,
        files: status.files,
        created: status.created,
        modified: status.modified,
        deleted: status.deleted,
        renamed: status.renamed,
        conflicted: status.conflicted,
        staged: status.staged
      }
    };
  } catch (error) {
    const handlingResult = handleError(error as Error, { path: repoPath });
    logger.error('nexus_git_status failed', { error: handlingResult.error });
    return { success: false, error: handlingResult.error };
  }
}

/**
 * Add files to Git staging area
 */
async function gitAdd(args: unknown): Promise<ToolResult<unknown>> {
  const validated = GitAddSchema.parse(args);
  const { path: repoPath, files } = validated;
  
  logger.info('nexus_git_add started', { path: repoPath, files });
  
  try {
    // Validate path
    const config = getConfig();
    const pathValidation = validatePath(repoPath, config.tools.filesystem.allowed_paths, config.tools.filesystem.denied_paths);
    if (!pathValidation.valid) {
      logger.error('nexus_git_add failed', { error: pathValidation.error });
      return { success: false, error: new Error(pathValidation.error!) };
    }
    
    const git: SimpleGit = simpleGit(repoPath);
    
    if (files && files.length > 0) {
      await git.add(files);
    } else {
      await git.add('.');
    }
    
    logger.info('nexus_git_add succeeded', { path: repoPath });
    
    return {
      success: true,
      data: {
        path: repoPath,
        files: files || ['.'],
        staged: true
      }
    };
  } catch (error) {
    const handlingResult = handleError(error as Error, { path: repoPath });
    logger.error('nexus_git_add failed', { error: handlingResult.error });
    return { success: false, error: handlingResult.error };
  }
}

/**
 * Create a Git commit
 */
async function gitCommit(args: unknown): Promise<ToolResult<unknown>> {
  const validated = GitCommitSchema.parse(args);
  const { path: repoPath, message, author } = validated;
  
  logger.info('nexus_git_commit started', { path: repoPath });
  
  try {
    // Validate path
    const config = getConfig();
    const pathValidation = validatePath(repoPath, config.tools.filesystem.allowed_paths, config.tools.filesystem.denied_paths);
    if (!pathValidation.valid) {
      logger.error('nexus_git_commit failed', { error: pathValidation.error });
      return { success: false, error: new Error(pathValidation.error!) };
    }
    
    const git: SimpleGit = simpleGit(repoPath);
    
    const commitOptions: any = [];
    if (author) {
      commitOptions.push('--author', `${author.name} <${author.email}>`);
    }
    
    await git.commit(message, commitOptions);
    
    logger.info('nexus_git_commit succeeded', { path: repoPath });
    
    return {
      success: true,
      data: {
        path: repoPath,
        message,
        author,
        committed: true
      }
    };
  } catch (error) {
    const handlingResult = handleError(error as Error, { path: repoPath });
    logger.error('nexus_git_commit failed', { error: handlingResult.error });
    return { success: false, error: handlingResult.error };
  }
}

/**
 * Get Git commit log
 */
async function gitLog(args: unknown): Promise<ToolResult<unknown>> {
  const validated = GitLogSchema.parse(args);
  const { path: repoPath, maxCount } = validated;
  
  logger.info('nexus_git_log started', { path: repoPath, maxCount });
  
  try {
    // Validate path
    const config = getConfig();
    const pathValidation = validatePath(repoPath, config.tools.filesystem.allowed_paths, config.tools.filesystem.denied_paths);
    if (!pathValidation.valid) {
      logger.error('nexus_git_log failed', { error: pathValidation.error });
      return { success: false, error: new Error(pathValidation.error!) };
    }
    
    const git: SimpleGit = simpleGit(repoPath);
    const log = await git.log({ maxCount });
    
    logger.info('nexus_git_log succeeded', { path: repoPath, count: log.total });
    
    return {
      success: true,
      data: {
        path: repoPath,
        total: log.total,
        latest: log.latest,
        all: log.all
      }
    };
  } catch (error) {
    const handlingResult = handleError(error as Error, { path: repoPath });
    logger.error('nexus_git_log failed', { error: handlingResult.error });
    return { success: false, error: handlingResult.error };
  }
}

/**
 * List all Git branches
 */
async function gitBranchList(args: unknown): Promise<ToolResult<unknown>> {
  const validated = GitBranchListSchema.parse(args);
  const { path: repoPath } = validated;
  
  logger.info('nexus_git_branch_list started', { path: repoPath });
  
  try {
    // Validate path
    const config = getConfig();
    const pathValidation = validatePath(repoPath, config.tools.filesystem.allowed_paths, config.tools.filesystem.denied_paths);
    if (!pathValidation.valid) {
      logger.error('nexus_git_branch_list failed', { error: pathValidation.error });
      return { success: false, error: new Error(pathValidation.error!) };
    }
    
    const git: SimpleGit = simpleGit(repoPath);
    const branches = await git.branch();
    
    logger.info('nexus_git_branch_list succeeded', { path: repoPath });
    
    return {
      success: true,
      data: {
        path: repoPath,
        all: branches.all,
        branches: branches.branches,
        current: branches.current,
        detached: branches.detached
      }
    };
  } catch (error) {
    const handlingResult = handleError(error as Error, { path: repoPath });
    logger.error('nexus_git_branch_list failed', { error: handlingResult.error });
    return { success: false, error: handlingResult.error };
  }
}

/**
 * Create a new Git branch
 */
async function gitBranchCreate(args: unknown): Promise<ToolResult<unknown>> {
  const validated = GitBranchCreateSchema.parse(args);
  const { path: repoPath, branchName, startPoint } = validated;
  
  logger.info('nexus_git_branch_create started', { path: repoPath, branchName });
  
  try {
    // Validate path
    const config = getConfig();
    const pathValidation = validatePath(repoPath, config.tools.filesystem.allowed_paths, config.tools.filesystem.denied_paths);
    if (!pathValidation.valid) {
      logger.error('nexus_git_branch_create failed', { error: pathValidation.error });
      return { success: false, error: new Error(pathValidation.error!) };
    }
    
    const git: SimpleGit = simpleGit(repoPath);
    
    const branchOptions: any = [];
    if (startPoint) {
      branchOptions.push(startPoint);
    }
    
    await git.branch([branchName, ...branchOptions]);
    
    logger.info('nexus_git_branch_create succeeded', { path: repoPath, branchName });
    
    return {
      success: true,
      data: {
        path: repoPath,
        branchName,
        startPoint,
        created: true
      }
    };
  } catch (error) {
    const handlingResult = handleError(error as Error, { path: repoPath });
    logger.error('nexus_git_branch_create failed', { error: handlingResult.error });
    return { success: false, error: handlingResult.error };
  }
}

/**
 * Delete a Git branch
 */
async function gitBranchDelete(args: unknown): Promise<ToolResult<unknown>> {
  const validated = GitBranchDeleteSchema.parse(args);
  const { path: repoPath, branchName, force } = validated;
  
  logger.info('nexus_git_branch_delete started', { path: repoPath, branchName, force });
  
  try {
    // Validate path
    const config = getConfig();
    const pathValidation = validatePath(repoPath, config.tools.filesystem.allowed_paths, config.tools.filesystem.denied_paths);
    if (!pathValidation.valid) {
      logger.error('nexus_git_branch_delete failed', { error: pathValidation.error });
      return { success: false, error: new Error(pathValidation.error!) };
    }
    
    const git: SimpleGit = simpleGit(repoPath);
    
    const deleteOptions: string[] = ['-d'];
    if (force) {
      deleteOptions.push('-f');
    }
    deleteOptions.push(branchName);
    
    await git.branch(deleteOptions);
    
    logger.info('nexus_git_branch_delete succeeded', { path: repoPath, branchName });
    
    return {
      success: true,
      data: {
        path: repoPath,
        branchName,
        force,
        deleted: true
      }
    };
  } catch (error) {
    const handlingResult = handleError(error as Error, { path: repoPath });
    logger.error('nexus_git_branch_delete failed', { error: handlingResult.error });
    return { success: false, error: handlingResult.error };
  }
}

/**
 * Switch to a Git branch
 */
async function gitBranchSwitch(args: unknown): Promise<ToolResult<unknown>> {
  const validated = GitBranchSwitchSchema.parse(args);
  const { path: repoPath, branchName, createNew } = validated;
  
  logger.info('nexus_git_branch_switch started', { path: repoPath, branchName, createNew });
  
  try {
    // Validate path
    const config = getConfig();
    const pathValidation = validatePath(repoPath, config.tools.filesystem.allowed_paths, config.tools.filesystem.denied_paths);
    if (!pathValidation.valid) {
      logger.error('nexus_git_branch_switch failed', { error: pathValidation.error });
      return { success: false, error: new Error(pathValidation.error!) };
    }
    
    const git: SimpleGit = simpleGit(repoPath);
    
    if (createNew) {
      await git.checkout(['-b', branchName]);
    } else {
      await git.checkout(branchName);
    }
    
    logger.info('nexus_git_branch_switch succeeded', { path: repoPath, branchName });
    
    return {
      success: true,
      data: {
        path: repoPath,
        branchName,
        createNew,
        switched: true
      }
    };
  } catch (error) {
    const handlingResult = handleError(error as Error, { path: repoPath });
    logger.error('nexus_git_branch_switch failed', { error: handlingResult.error });
    return { success: false, error: handlingResult.error };
  }
}

/**
 * Merge a Git branch
 */
async function gitMerge(args: unknown): Promise<ToolResult<unknown>> {
  const validated = GitMergeSchema.parse(args);
  const { path: repoPath, branchName, message } = validated;
  
  logger.info('nexus_git_merge started', { path: repoPath, branchName });
  
  try {
    // Validate path
    const config = getConfig();
    const pathValidation = validatePath(repoPath, config.tools.filesystem.allowed_paths, config.tools.filesystem.denied_paths);
    if (!pathValidation.valid) {
      logger.error('nexus_git_merge failed', { error: pathValidation.error });
      return { success: false, error: new Error(pathValidation.error!) };
    }
    
    const git: SimpleGit = simpleGit(repoPath);
    
    await git.merge([branchName]);
    
    logger.info('nexus_git_merge succeeded', { path: repoPath, branchName });
    
    return {
      success: true,
      data: {
        path: repoPath,
        branchName,
        message,
        merged: true
      }
    };
  } catch (error) {
    const handlingResult = handleError(error as Error, { path: repoPath });
    logger.error('nexus_git_merge failed', { error: handlingResult.error });
    return { success: false, error: handlingResult.error };
  }
}

/**
 * Rebase current branch onto another
 */
async function gitRebase(args: unknown): Promise<ToolResult<unknown>> {
  const validated = GitRebaseSchema.parse(args);
  const { path: repoPath, branchName, onto } = validated;
  
  logger.info('nexus_git_rebase started', { path: repoPath, branchName, onto });
  
  try {
    // Validate path
    const config = getConfig();
    const pathValidation = validatePath(repoPath, config.tools.filesystem.allowed_paths, config.tools.filesystem.denied_paths);
    if (!pathValidation.valid) {
      logger.error('nexus_git_rebase failed', { error: pathValidation.error });
      return { success: false, error: new Error(pathValidation.error!) };
    }
    
    const git: SimpleGit = simpleGit(repoPath);
    
    if (onto) {
      await git.rebase([onto, branchName]);
    } else {
      await git.rebase([branchName]);
    }
    
    logger.info('nexus_git_rebase succeeded', { path: repoPath, branchName });
    
    return {
      success: true,
      data: {
        path: repoPath,
        branchName,
        onto,
        rebased: true
      }
    };
  } catch (error) {
    const handlingResult = handleError(error as Error, { path: repoPath });
    logger.error('nexus_git_rebase failed', { error: handlingResult.error });
    return { success: false, error: handlingResult.error };
  }
}

/**
 * Get Git diff
 */
async function gitDiff(args: unknown): Promise<ToolResult<unknown>> {
  const validated = GitDiffSchema.parse(args);
  const { path: repoPath, file, options } = validated;
  
  logger.info('nexus_git_diff started', { path: repoPath, file });
  
  try {
    // Validate path
    const config = getConfig();
    const pathValidation = validatePath(repoPath, config.tools.filesystem.allowed_paths, config.tools.filesystem.denied_paths);
    if (!pathValidation.valid) {
      logger.error('nexus_git_diff failed', { error: pathValidation.error });
      return { success: false, error: new Error(pathValidation.error!) };
    }
    
    const git: SimpleGit = simpleGit(repoPath);
    
    const diffOptions: any = [];
    if (options?.cached) {
      diffOptions.push('--cached');
    }
    if (options?.nameOnly) {
      diffOptions.push('--name-only');
    }
    if (options?.stat) {
      diffOptions.push('--stat');
    }
    if (file) {
      diffOptions.push('--', file);
    }
    
    const diff = await git.diff(diffOptions);
    
    logger.info('nexus_git_diff succeeded', { path: repoPath });
    
    return {
      success: true,
      data: {
        path: repoPath,
        file,
        options,
        diff
      }
    };
  } catch (error) {
    const handlingResult = handleError(error as Error, { path: repoPath });
    logger.error('nexus_git_diff failed', { error: handlingResult.error });
    return { success: false, error: handlingResult.error };
  }
}

/**
 * Show Git commit or file
 */
async function gitShow(args: unknown): Promise<ToolResult<unknown>> {
  const validated = GitShowSchema.parse(args);
  const { path: repoPath, commit, file } = validated;
  
  logger.info('nexus_git_show started', { path: repoPath, commit, file });
  
  try {
    // Validate path
    const config = getConfig();
    const pathValidation = validatePath(repoPath, config.tools.filesystem.allowed_paths, config.tools.filesystem.denied_paths);
    if (!pathValidation.valid) {
      logger.error('nexus_git_show failed', { error: pathValidation.error });
      return { success: false, error: new Error(pathValidation.error!) };
    }
    
    const git: SimpleGit = simpleGit(repoPath);
    
    const showOptions: any = [];
    if (commit) {
      showOptions.push(commit);
    }
    if (file) {
      showOptions.push('--', file);
    }
    
    const show = await git.show(showOptions);
    
    logger.info('nexus_git_show succeeded', { path: repoPath });
    
    return {
      success: true,
      data: {
        path: repoPath,
        commit,
        file,
        show
      }
    };
  } catch (error) {
    const handlingResult = handleError(error as Error, { path: repoPath });
    logger.error('nexus_git_show failed', { error: handlingResult.error });
    return { success: false, error: handlingResult.error };
  }
}

/**
 * Git stash operations
 */
async function gitStash(args: unknown): Promise<ToolResult<unknown>> {
  const validated = GitStashSchema.parse(args);
  const { path: repoPath, message, action } = validated;
  
  logger.info('nexus_git_stash started', { path: repoPath, action });
  
  try {
    // Validate path
    const config = getConfig();
    const pathValidation = validatePath(repoPath, config.tools.filesystem.allowed_paths, config.tools.filesystem.denied_paths);
    if (!pathValidation.valid) {
      logger.error('nexus_git_stash failed', { error: pathValidation.error });
      return { success: false, error: new Error(pathValidation.error!) };
    }
    
    const git: SimpleGit = simpleGit(repoPath);
    
    let result: any;
    
    switch (action) {
      case 'save':
        const stashOptions: any = [];
        if (message) {
          stashOptions.push('-m', message);
        }
        await git.stash(stashOptions);
        result = { action: 'saved', message };
        break;
      
      case 'list':
        const stashList = await git.raw(['stash', 'list']);
        result = { action: 'listed', stashes: stashList };
        break;
      
      case 'pop':
        await git.raw(['stash', 'pop']);
        result = { action: 'popped' };
        break;
      
      case 'drop':
        await git.raw(['stash', 'drop']);
        result = { action: 'dropped' };
        break;
      
      case 'clear':
        await git.raw(['stash', 'clear']);
        result = { action: 'cleared' };
        break;
    }
    
    logger.info('nexus_git_stash succeeded', { path: repoPath, action });
    
    return {
      success: true,
      data: {
        path: repoPath,
        action,
        result
      }
    };
  } catch (error) {
    const handlingResult = handleError(error as Error, { path: repoPath });
    logger.error('nexus_git_stash failed', { error: handlingResult.error });
    return { success: false, error: handlingResult.error };
  }
}

// ============================================================================
// Git Tools Array
// ============================================================================

export const gitTools: MCPTool[] = [
  // Basic Git Operations (Fase 4.1)
  {
    name: 'nexus_git_init',
    description: 'Initialize a new Git repository',
    category: GIT_CATEGORY,
    inputSchema: GitInitSchema,
    handler: gitInit,
    version: '1.0.0',
    tags: ['git', 'init', 'repository']
  },
  {
    name: 'nexus_git_clone',
    description: 'Clone a Git repository from URL',
    category: GIT_CATEGORY,
    inputSchema: GitCloneSchema,
    handler: gitClone,
    version: '1.0.0',
    tags: ['git', 'clone', 'repository']
  },
  {
    name: 'nexus_git_status',
    description: 'Get Git repository status',
    category: GIT_CATEGORY,
    inputSchema: GitStatusSchema,
    handler: gitStatus,
    version: '1.0.0',
    tags: ['git', 'status', 'repository']
  },
  {
    name: 'nexus_git_add',
    description: 'Add files to Git staging area',
    category: GIT_CATEGORY,
    inputSchema: GitAddSchema,
    handler: gitAdd,
    version: '1.0.0',
    tags: ['git', 'add', 'stage']
  },
  {
    name: 'nexus_git_commit',
    description: 'Create a Git commit',
    category: GIT_CATEGORY,
    inputSchema: GitCommitSchema,
    handler: gitCommit,
    version: '1.0.0',
    tags: ['git', 'commit', 'repository']
  },
  {
    name: 'nexus_git_log',
    description: 'Get Git commit history',
    category: GIT_CATEGORY,
    inputSchema: GitLogSchema,
    handler: gitLog,
    version: '1.0.0',
    tags: ['git', 'log', 'history']
  },
  {
    name: 'nexus_git_branch_list',
    description: 'List all Git branches',
    category: GIT_CATEGORY,
    inputSchema: GitBranchListSchema,
    handler: gitBranchList,
    version: '1.0.0',
    tags: ['git', 'branch', 'list']
  },
  // Branch Management (Fase 4.2)
  {
    name: 'nexus_git_branch_create',
    description: 'Create a new Git branch',
    category: GIT_CATEGORY,
    inputSchema: GitBranchCreateSchema,
    handler: gitBranchCreate,
    version: '1.0.0',
    tags: ['git', 'branch', 'create']
  },
  {
    name: 'nexus_git_branch_delete',
    description: 'Delete a Git branch',
    category: GIT_CATEGORY,
    inputSchema: GitBranchDeleteSchema,
    handler: gitBranchDelete,
    version: '1.0.0',
    tags: ['git', 'branch', 'delete']
  },
  {
    name: 'nexus_git_branch_switch',
    description: 'Switch to a Git branch (or create and switch)',
    category: GIT_CATEGORY,
    inputSchema: GitBranchSwitchSchema,
    handler: gitBranchSwitch,
    version: '1.0.0',
    tags: ['git', 'branch', 'switch', 'checkout']
  },
  {
    name: 'nexus_git_merge',
    description: 'Merge a Git branch into current branch',
    category: GIT_CATEGORY,
    inputSchema: GitMergeSchema,
    handler: gitMerge,
    version: '1.0.0',
    tags: ['git', 'merge', 'branch']
  },
  {
    name: 'nexus_git_rebase',
    description: 'Rebase current branch onto another branch',
    category: GIT_CATEGORY,
    inputSchema: GitRebaseSchema,
    handler: gitRebase,
    version: '1.0.0',
    tags: ['git', 'rebase', 'branch']
  },
  // History and Diff (Fase 4.4)
  {
    name: 'nexus_git_diff',
    description: 'Get Git diff with options (cached, name-only, stat)',
    category: GIT_CATEGORY,
    inputSchema: GitDiffSchema,
    handler: gitDiff,
    version: '1.0.0',
    tags: ['git', 'diff', 'history']
  },
  {
    name: 'nexus_git_show',
    description: 'Show Git commit or file content',
    category: GIT_CATEGORY,
    inputSchema: GitShowSchema,
    handler: gitShow,
    version: '1.0.0',
    tags: ['git', 'show', 'history']
  },
  {
    name: 'nexus_git_stash',
    description: 'Git stash operations (save, list, pop, drop, clear)',
    category: GIT_CATEGORY,
    inputSchema: GitStashSchema,
    handler: gitStash,
    version: '1.0.0',
    tags: ['git', 'stash', 'history']
  }
];

export default gitTools;
