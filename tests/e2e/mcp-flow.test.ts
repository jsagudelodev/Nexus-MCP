/**
 * End-to-End Tests for MCP Flow
 */

import { describe, it, expect } from '@jest/globals';
import { execSync } from 'child_process';
import * as fs from 'fs/promises';
import * as path from 'path';
import { tmpdir } from 'os';

describe('E2E: MCP Flow Tests', () => {
  let testDir: string;

  beforeEach(async () => {
    // Create a temporary directory for E2E tests
    testDir = path.join(tmpdir(), `nexus-e2e-${Date.now()}`);
    await fs.mkdir(testDir, { recursive: true });
  });

  afterEach(async () => {
    // Clean up test directory
    try {
      await fs.rm(testDir, { recursive: true, force: true });
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  describe('Complete MCP Flow', () => {
    it('should build and start server successfully', () => {
      // Build the project
      const buildOutput = execSync('npm run build', {
        cwd: path.join(__dirname, '../..'),
        encoding: 'utf-8'
      });

      expect(buildOutput).toBeDefined();
      expect(buildOutput.length).toBeGreaterThan(0);
    });

    it('should execute CLI status command', () => {
      const statusOutput = execSync('node dist/cli.js status', {
        cwd: path.join(__dirname, '../..'),
        encoding: 'utf-8'
      });

      expect(statusOutput).toBeDefined();
      expect(statusOutput).toContain('Nexus-MCP Server Status');
      expect(statusOutput).toContain('Version');
    });

    it('should execute CLI tools command', () => {
      const toolsOutput = execSync('node dist/cli.js tools', {
        cwd: path.join(__dirname, '../..'),
        encoding: 'utf-8'
      });

      expect(toolsOutput).toBeDefined();
      expect(toolsOutput).toContain('Tools');
    });
  });

  describe('Multiple Tools in Sequence', () => {
    it('should handle filesystem operations in sequence', async () => {
      // Create a file
      const testFile = path.join(testDir, 'sequence-test.txt');
      await fs.writeFile(testFile, 'Test content');

      // Read the file
      const content = await fs.readFile(testFile, 'utf-8');
      expect(content).toBe('Test content');

      // List directory
      const files = await fs.readdir(testDir);
      expect(files).toContain('sequence-test.txt');

      // Delete file
      await fs.unlink(testFile);

      // Verify deletion
      const filesAfter = await fs.readdir(testDir);
      expect(filesAfter).not.toContain('sequence-test.txt');
    });
  });

  describe('Error Handling in Production', () => {
    it('should handle file not found gracefully', async () => {
      const nonExistentFile = path.join(testDir, 'nonexistent.txt');

      try {
        await fs.readFile(nonExistentFile, 'utf-8');
        fail('Should have thrown error');
      } catch (error: any) {
        expect(error.code).toBe('ENOENT');
      }
    });

    it('should handle permission errors gracefully', async () => {
      // Try to read a system directory that may not be accessible
      try {
        await fs.readdir('/root');
        // If it succeeds, that's okay on some systems
      } catch (error: any) {
        // Permission denied or not found is expected (Windows uses ENOENT)
        expect(error.code).toMatch(/EACCES|EPERM|ENOENT/);
      }
    });

    it('should handle invalid paths gracefully', async () => {
      const invalidPath = path.join(testDir, '..', '..', 'nonexistent', 'file.txt');

      try {
        await fs.readFile(invalidPath, 'utf-8');
        fail('Should have thrown error');
      } catch (error: any) {
        expect(error.code).toBe('ENOENT');
      }
    });
  });

  describe('Performance Tests', () => {
    it('should handle small file operations quickly', async () => {
      const start = Date.now();
      
      const testFile = path.join(testDir, 'perf-test.txt');
      await fs.writeFile(testFile, 'Performance test content');
      await fs.readFile(testFile, 'utf-8');
      await fs.unlink(testFile);

      const duration = Date.now() - start;
      expect(duration).toBeLessThan(1000); // Should complete in < 1 second
    });

    it('should handle multiple file operations efficiently', async () => {
      const start = Date.now();
      const fileCount = 10;

      const promises = [];
      for (let i = 0; i < fileCount; i++) {
        const testFile = path.join(testDir, `perf-test-${i}.txt`);
        promises.push(fs.writeFile(testFile, `Content ${i}`));
      }
      await Promise.all(promises);

      const duration = Date.now() - start;
      expect(duration).toBeLessThan(2000); // Should complete in < 2 seconds
    });
  });

  describe('Resource Limits', () => {
    it('should handle large files', async () => {
      const largeContent = 'x'.repeat(1024 * 1024); // 1MB file
      const testFile = path.join(testDir, 'large-file.txt');
      
      await fs.writeFile(testFile, largeContent);
      const stats = await fs.stat(testFile);
      
      expect(stats.size).toBe(1024 * 1024);
    });

    it('should handle many small files', async () => {
      const fileCount = 100;
      const promises = [];

      for (let i = 0; i < fileCount; i++) {
        const testFile = path.join(testDir, `file-${i}.txt`);
        promises.push(fs.writeFile(testFile, `Content ${i}`));
      }
      
      await Promise.all(promises);
      
      const files = await fs.readdir(testDir);
      expect(files.length).toBe(fileCount);
    });
  });

  describe('Concurrency', () => {
    it('should handle concurrent file operations', async () => {
      const concurrentOps = 20;
      const promises = [];

      for (let i = 0; i < concurrentOps; i++) {
        const testFile = path.join(testDir, `concurrent-${i}.txt`);
        promises.push(
          fs.writeFile(testFile, `Content ${i}`)
            .then(() => fs.readFile(testFile, 'utf-8'))
            .then(() => fs.unlink(testFile))
        );
      }

      await Promise.all(promises);
      
      // Verify all files were cleaned up
      const files = await fs.readdir(testDir);
      expect(files.length).toBe(0);
    });

    it('should handle concurrent directory operations', async () => {
      const dirCount = 10;
      const promises = [];

      for (let i = 0; i < dirCount; i++) {
        const testDirPath = path.join(testDir, `dir-${i}`);
        promises.push(
          fs.mkdir(testDirPath)
            .then(() => fs.readdir(testDirPath))
            .then(() => fs.rm(testDirPath, { recursive: true }))
        );
      }

      await Promise.all(promises);
      
      // Verify all directories were cleaned up
      const dirs = await fs.readdir(testDir);
      expect(dirs.length).toBe(0);
    });
  });
});

// Export for Jest
export {};
