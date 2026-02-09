import type { Cache } from './cache.interface';

/**
 * In-memory cache implementation (data persists only for current runtime)
 */
export class InMemoryCache implements Cache {
  private storage: Map<string, { value: string; expires: number | null }> = new Map();

  async get(key: string): Promise<string | null> {
    const item = this.storage.get(key);

    if (!item) {
      return null;
    }

    // Check if expired
    if (item.expires !== null && item.expires < Date.now()) {
      this.storage.delete(key);
      return null;
    }

    return item.value;
  }

  async set(key: string, value: string, ttl?: number): Promise<void> {
    const expires = ttl !== undefined ? Date.now() + ttl * 1000 : null;

    this.storage.set(key, {
      value,
      expires,
    });
  }

  async has(key: string): Promise<boolean> {
    const value = await this.get(key);
    return value !== null;
  }

  async delete(key: string): Promise<void> {
    this.storage.delete(key);
  }

  async clear(): Promise<void> {
    this.storage.clear();
  }
}
