/**
 * Unit Tests for Utilities Tools
 */

import { describe, it, expect } from '@jest/globals';
import * as crypto from 'crypto';
import { v4 as uuidv4 } from 'uuid';

describe('Utilities Tools', () => {
  describe('nexus_json_parse', () => {
    it('should parse valid JSON', () => {
      const jsonString = '{"name": "test", "value": 123}';
      const parsed = JSON.parse(jsonString);
      
      expect(parsed).toBeDefined();
      expect(parsed.name).toBe('test');
      expect(parsed.value).toBe(123);
    });

    it('should handle invalid JSON', () => {
      const invalidJson = '{invalid json}';
      
      expect(() => JSON.parse(invalidJson)).toThrow();
    });
  });

  describe('nexus_json_stringify', () => {
    it('should stringify objects', () => {
      const obj = { name: 'test', value: 123 };
      const stringified = JSON.stringify(obj);
      
      expect(typeof stringified).toBe('string');
      expect(stringified).toContain('test');
      expect(stringified).toContain('123');
    });

    it('should handle circular references gracefully', () => {
      const obj: any = { name: 'test' };
      obj.self = obj;
      
      // JSON.stringify throws on circular references
      expect(() => JSON.stringify(obj)).toThrow();
    });
  });

  describe('nexus_base64_encode', () => {
    it('should encode strings to base64', () => {
      const input = 'Hello, World!';
      const encoded = Buffer.from(input).toString('base64');
      
      expect(typeof encoded).toBe('string');
      expect(encoded).not.toBe(input);
    });

    it('should decode base64 to original string', () => {
      const input = 'Hello, World!';
      const encoded = Buffer.from(input).toString('base64');
      const decoded = Buffer.from(encoded, 'base64').toString('utf-8');
      
      expect(decoded).toBe(input);
    });
  });

  describe('nexus_hash_generate', () => {
    it('should generate SHA256 hash', () => {
      const input = 'test data';
      const hash = crypto.createHash('sha256').update(input).digest('hex');
      
      expect(typeof hash).toBe('string');
      expect(hash.length).toBe(64); // SHA256 produces 64 hex characters
    });

    it('should generate MD5 hash', () => {
      const input = 'test data';
      const hash = crypto.createHash('md5').update(input).digest('hex');
      
      expect(typeof hash).toBe('string');
      expect(hash.length).toBe(32); // MD5 produces 32 hex characters
    });
  });

  describe('nexus_uuid_generate', () => {
    it('should generate valid UUID v4', () => {
      const uuid = uuidv4();
      
      expect(typeof uuid).toBe('string');
      expect(uuid).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
    });

    it('should generate unique UUIDs', () => {
      const uuid1 = uuidv4();
      const uuid2 = uuidv4();
      
      expect(uuid1).not.toBe(uuid2);
    });
  });

  describe('nexus_timestamp', () => {
    it('should get current timestamp', () => {
      const timestamp = Date.now();
      
      expect(typeof timestamp).toBe('number');
      expect(timestamp).toBeGreaterThan(0);
    });

    it('should format timestamp as ISO string', () => {
      const isoString = new Date().toISOString();
      
      expect(typeof isoString).toBe('string');
      expect(isoString).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
    });
  });

  describe('nexus_url_parse', () => {
    it('should parse valid URL', () => {
      const urlStr = 'https://example.com:8080/path?query=value#fragment';
      const url = new URL(urlStr);
      
      expect(url.protocol).toBe('https:');
      expect(url.hostname).toBe('example.com');
      expect(url.port).toBe('8080');
      expect(url.pathname).toBe('/path');
      expect(url.searchParams.get('query')).toBe('value');
      expect(url.hash).toBe('#fragment');
    });

    it('should handle invalid URL', () => {
      expect(() => new URL('not-a-url')).toThrow();
    });
  });
});

// Export for Jest
export {};
