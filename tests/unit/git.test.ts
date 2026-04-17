/**
 * Unit Tests for Git Tools
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import * as fs from 'fs/promises';
import * as path from 'path';
import { tmpdir } from 'os';
import { simpleGit, SimpleGit } from 'simple-git';

describe('Git Tools', () => {
  let testRepo: string;
  let git: SimpleGit;

  beforeEach(async () => {
    // Create a temporary directory for test repository
    testRepo = path.join(tmpdir(), `nexus-git-test-${Date.now()}`);
    await fs.mkdir(testRepo, { recursive: true });
    
    // Initialize git repository
    git = simpleGit(testRepo);
    await git.init();
  });

  afterEach(async () => {
    // Clean up test directory
    try {
      await fs.rm(testRepo, { recursive: true, force: true });
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  describe('nexus_git_status', () => {
    it('should get repository status', async () => {
      const status = await git.status();
      
      expect(status).toBeDefined();
      expect(typeof status.files).toBeDefined();
      expect(Array.isArray(status.files)).toBe(true);
    });

    it('should detect new files', async () => {
      // Create a new file
      const testFile = path.join(testRepo, 'test.txt');
      await fs.writeFile(testFile, 'test content');
      
      const status = await git.status();
      
      expect(status.files.length).toBeGreaterThan(0);
      expect(status.files[0].path).toBe('test.txt');
    });
  });

  describe('nexus_git_init', () => {
    it('should initialize a git repository', async () => {
      const gitDir = path.join(testRepo, '.git');
      
      const exists = await fs.access(gitDir).then(() => true).catch(() => false);
      
      expect(exists).toBe(true);
    });
  });

  describe('nexus_git_commit', () => {
    it('should create a commit', async () => {
      // Configure git
      await git.addConfig('user.name', 'Test User');
      await git.addConfig('user.email', 'test@example.com');
      
      // Create a file
      const testFile = path.join(testRepo, 'test.txt');
      await fs.writeFile(testFile, 'test content');
      
      // Add and commit
      await git.add('.');
      await git.commit('Initial commit');
      
      const log = await git.log();
      
      expect(log.total).toBe(1);
      expect(log.latest?.message).toBe('Initial commit');
    });
  });

  describe('nexus_git_branch', () => {
    it('should create and list branches', async () => {
      // Configure git
      await git.addConfig('user.name', 'Test User');
      await git.addConfig('user.email', 'test@example.com');
      
      // Create initial commit
      const testFile = path.join(testRepo, 'test.txt');
      await fs.writeFile(testFile, 'test content');
      await git.add('.');
      await git.commit('Initial commit');
      
      // Create a new branch
      await git.branch(['feature-test']);
      
      const branches = await git.branch();
      
      expect(branches.all).toContain('feature-test');
    });
  });
});

// Export for Jest
export {};
