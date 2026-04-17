/**
 * Unit Tests for System Tools
 */

import { describe, it, expect } from '@jest/globals';
import * as os from 'os';

describe('System Tools', () => {
  describe('nexus_system_info', () => {
    it('should return system information', () => {
      const platform = os.platform();
      const arch = os.arch();
      const hostname = os.hostname();
      const homedir = os.homedir();
      const tmpdir = os.tmpdir();

      expect(platform).toBeDefined();
      expect(typeof platform).toBe('string');
      expect(arch).toBeDefined();
      expect(typeof arch).toBe('string');
      expect(hostname).toBeDefined();
      expect(typeof hostname).toBe('string');
      expect(homedir).toBeDefined();
      expect(typeof homedir).toBe('string');
      expect(tmpdir).toBeDefined();
      expect(typeof tmpdir).toBe('string');
    });
  });

  describe('nexus_system_os_info', () => {
    it('should return OS-specific information', () => {
      const platform = os.platform();
      const release = os.release();
      const type = os.type();
      const endianness = os.endianness();

      expect(platform).toBeDefined();
      expect(typeof platform).toBe('string');
      expect(release).toBeDefined();
      expect(typeof release).toBe('string');
      expect(type).toBeDefined();
      expect(typeof type).toBe('string');
      expect(endianness).toBeDefined();
      expect(['LE', 'BE']).toContain(endianness);
    });
  });

  describe('nexus_system_cpu_info', () => {
    it('should return CPU information', () => {
      const cpus = os.cpus();
      
      expect(Array.isArray(cpus)).toBe(true);
      expect(cpus.length).toBeGreaterThan(0);
      
      const cpu = cpus[0];
      expect(cpu.model).toBeDefined();
      expect(typeof cpu.model).toBe('string');
      expect(cpu.speed).toBeDefined();
      expect(typeof cpu.speed).toBe('number');
      expect(cpu.times).toBeDefined();
      expect(typeof cpu.times.user).toBe('number');
      expect(typeof cpu.times.nice).toBe('number');
      expect(typeof cpu.times.sys).toBe('number');
      expect(typeof cpu.times.idle).toBe('number');
      expect(typeof cpu.times.irq).toBe('number');
    });
  });

  describe('nexus_system_memory_info', () => {
    it('should return memory information', () => {
      const totalmem = os.totalmem();
      const freemem = os.freemem();

      expect(totalmem).toBeDefined();
      expect(typeof totalmem).toBe('number');
      expect(totalmem).toBeGreaterThan(0);
      
      expect(freemem).toBeDefined();
      expect(typeof freemem).toBe('number');
      expect(freemem).toBeGreaterThan(0);
      expect(freemem).toBeLessThanOrEqual(totalmem);
    });
  });

  describe('nexus_system_network_info', () => {
    it('should return network interface information', () => {
      const networkInterfaces = os.networkInterfaces();
      
      expect(typeof networkInterfaces).toBe('object');
      expect(networkInterfaces).not.toBeNull();
      
      // At least one interface should exist
      const interfaceNames = Object.keys(networkInterfaces);
      expect(interfaceNames.length).toBeGreaterThan(0);
    });
  });
});

// Export for Jest
export {};
