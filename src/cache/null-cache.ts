import type { Cache } from './cache.interface';

/**
 * Null cache implementation (no caching)
 */
export class NullCache implements Cache {
  async get(_key: string): Promise<string | null> {
    return null;
  }

  async set(_key: string, _value: string, _ttl?: number): Promise<void> {
    // Do nothing
  }

  async has(_key: string): Promise<boolean> {
    return false;
  }

  async delete(_key: string): Promise<void> {
    // Do nothing
  }

  async clear(): Promise<void> {
    // Do nothing
  }
}
