import type { FlagValue } from './types';

/**
 * Collection for managing default flag values
 */
export class DefaultsCollection {
  private defaults: Map<string, FlagValue> = new Map();

  /**
   * Create a DefaultsCollection from an object
   */
  static fromObject(obj: Record<string, FlagValue>): DefaultsCollection {
    const collection = new DefaultsCollection();
    Object.entries(obj).forEach(([key, value]) => {
      collection.set(key, value);
    });
    return collection;
  }

  /**
   * Set a default value for a flag
   */
  set(key: string, value: FlagValue): this {
    this.defaults.set(key, value);
    return this;
  }

  /**
   * Get a default value for a flag
   */
  get(key: string): FlagValue | undefined {
    return this.defaults.get(key);
  }

  /**
   * Check if a default exists for a flag
   */
  has(key: string): boolean {
    return this.defaults.has(key);
  }

  /**
   * Delete a default value
   */
  delete(key: string): boolean {
    return this.defaults.delete(key);
  }

  /**
   * Clear all defaults
   */
  clear(): void {
    this.defaults.clear();
  }

  /**
   * Get all default keys
   */
  keys(): string[] {
    return Array.from(this.defaults.keys());
  }

  /**
   * Get the number of defaults
   */
  size(): number {
    return this.defaults.size;
  }
}
