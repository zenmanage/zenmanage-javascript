import { describe, it, expect, beforeEach } from 'vitest';
import { InMemoryCache } from '../src/cache/memory-cache';

describe('InMemoryCache', () => {
  let cache: InMemoryCache;

  beforeEach(() => {
    cache = new InMemoryCache();
  });

  describe('get/set', () => {
    it('should store and retrieve values', async () => {
      await cache.set('key1', 'value1');
      const value = await cache.get('key1');
      expect(value).toBe('value1');
    });

    it('should return null for non-existent keys', async () => {
      const value = await cache.get('nonexistent');
      expect(value).toBeNull();
    });

    it('should overwrite existing values', async () => {
      await cache.set('key1', 'value1');
      await cache.set('key1', 'value2');
      const value = await cache.get('key1');
      expect(value).toBe('value2');
    });
  });

  describe('TTL', () => {
    it('should expire values after TTL', async () => {
      await cache.set('key1', 'value1', 0.1); // 100ms TTL
      let value = await cache.get('key1');
      expect(value).toBe('value1');

      // Wait for expiration
      await new Promise((resolve) => setTimeout(resolve, 150));

      value = await cache.get('key1');
      expect(value).toBeNull();
    });

    it('should not expire values without TTL', async () => {
      await cache.set('key1', 'value1');
      
      // Wait a bit
      await new Promise((resolve) => setTimeout(resolve, 100));

      const value = await cache.get('key1');
      expect(value).toBe('value1');
    });
  });

  describe('has', () => {
    it('should return true for existing keys', async () => {
      await cache.set('key1', 'value1');
      const exists = await cache.has('key1');
      expect(exists).toBe(true);
    });

    it('should return false for non-existent keys', async () => {
      const exists = await cache.has('nonexistent');
      expect(exists).toBe(false);
    });

    it('should return false for expired keys', async () => {
      await cache.set('key1', 'value1', 0.1);
      await new Promise((resolve) => setTimeout(resolve, 150));
      const exists = await cache.has('key1');
      expect(exists).toBe(false);
    });
  });

  describe('delete', () => {
    it('should delete existing keys', async () => {
      await cache.set('key1', 'value1');
      await cache.delete('key1');
      const value = await cache.get('key1');
      expect(value).toBeNull();
    });

    it('should not throw for non-existent keys', async () => {
      await expect(cache.delete('nonexistent')).resolves.toBeUndefined();
    });
  });

  describe('clear', () => {
    it('should clear all cached values', async () => {
      await cache.set('key1', 'value1');
      await cache.set('key2', 'value2');
      await cache.set('key3', 'value3');

      await cache.clear();

      expect(await cache.get('key1')).toBeNull();
      expect(await cache.get('key2')).toBeNull();
      expect(await cache.get('key3')).toBeNull();
    });
  });
});
