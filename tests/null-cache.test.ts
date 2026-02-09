import { describe, it, expect, beforeEach } from 'vitest';
import { NullCache } from '../src/cache/null-cache';

describe('NullCache', () => {
  let cache: NullCache;

  beforeEach(() => {
    cache = new NullCache();
  });

  it('should always return null for get', async () => {
    await cache.set('key1', 'value1');
    const value = await cache.get('key1');
    expect(value).toBeNull();
  });

  it('should always return false for has', async () => {
    await cache.set('key1', 'value1');
    const exists = await cache.has('key1');
    expect(exists).toBe(false);
  });

  it('should not throw on set', async () => {
    await expect(cache.set('key1', 'value1')).resolves.toBeUndefined();
  });

  it('should not throw on delete', async () => {
    await expect(cache.delete('key1')).resolves.toBeUndefined();
  });

  it('should not throw on clear', async () => {
    await expect(cache.clear()).resolves.toBeUndefined();
  });
});
