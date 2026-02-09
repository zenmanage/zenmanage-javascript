import type { Cache } from './cache.interface';
import * as fs from 'fs';
import * as path from 'path';
import { promisify } from 'util';

const writeFile = promisify(fs.writeFile);
const readFile = promisify(fs.readFile);
const unlink = promisify(fs.unlink);
const readdir = promisify(fs.readdir);

interface CacheItem {
  value: string;
  expires: number | null;
}

/**
 * Filesystem cache implementation (Node.js only)
 * Falls back to no-op in browser environments
 */
export class FileSystemCache implements Cache {
  private cacheDir: string;
  private isNode: boolean;

  constructor(cacheDirectory: string) {
    this.cacheDir = cacheDirectory;
    this.isNode = typeof process !== 'undefined' && process.versions?.node !== undefined;

    if (this.isNode) {
      this.ensureDirectory();
    }
  }

  private ensureDirectory(): void {
    if (!this.isNode) return;

    try {
      if (!fs.existsSync(this.cacheDir)) {
        fs.mkdirSync(this.cacheDir, { recursive: true });
      }
    } catch (error) {
      console.error('Failed to create cache directory:', error);
    }
  }

  private getFilePath(key: string): string {
    // Simple hash for filename
    const hash = Buffer.from(key).toString('base64').replace(/[/+=]/g, '_');
    return path.join(this.cacheDir, `${hash}.json`);
  }

  async get(key: string): Promise<string | null> {
    if (!this.isNode) return null;

    const filePath = this.getFilePath(key);

    try {
      const data = await readFile(filePath, 'utf-8');
      const item: CacheItem = JSON.parse(data);

      // Check if expired
      if (item.expires !== null && item.expires < Date.now()) {
        await this.delete(key);
        return null;
      }

      return item.value;
    } catch (error) {
      // File doesn't exist or is invalid
      return null;
    }
  }

  async set(key: string, value: string, ttl?: number): Promise<void> {
    if (!this.isNode) return;

    const filePath = this.getFilePath(key);
    const expires = ttl !== undefined ? Date.now() + ttl * 1000 : null;

    const item: CacheItem = {
      value,
      expires,
    };

    try {
      await writeFile(filePath, JSON.stringify(item), 'utf-8');
    } catch (error) {
      console.error('Failed to write cache file:', error);
    }
  }

  async has(key: string): Promise<boolean> {
    const value = await this.get(key);
    return value !== null;
  }

  async delete(key: string): Promise<void> {
    if (!this.isNode) return;

    const filePath = this.getFilePath(key);

    try {
      await unlink(filePath);
    } catch (error) {
      // File doesn't exist, ignore
    }
  }

  async clear(): Promise<void> {
    if (!this.isNode) return;

    try {
      const files = await readdir(this.cacheDir);

      for (const file of files) {
        if (file.endsWith('.json')) {
          await unlink(path.join(this.cacheDir, file));
        }
      }
    } catch (error) {
      console.error('Failed to clear cache:', error);
    }
  }
}
