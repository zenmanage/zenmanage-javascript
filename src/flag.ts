import type { FlagData, FlagType, FlagValue, Rule, FlagTarget } from './types';

/**
 * Represents a feature flag with its metadata, rules, and target value
 */
export class Flag {
  constructor(
    private readonly version: string,
    private readonly type: FlagType,
    private readonly key: string,
    private readonly name: string,
    private readonly target: FlagTarget,
    private readonly rules: Rule[] = []
  ) {}

  getVersion(): string {
    return this.version;
  }

  getType(): FlagType {
    return this.type;
  }

  getKey(): string {
    return this.key;
  }

  getName(): string {
    return this.name;
  }

  getTarget(): FlagTarget {
    return this.target;
  }

  getRules(): Rule[] {
    return this.rules;
  }

  /**
   * Check if this flag is of type boolean and is enabled (true)
   */
  isEnabled(): boolean {
    if (this.type !== 'boolean') {
      return false;
    }

    const value = this.target.value.value;
    if ('boolean' in value) {
      return Boolean(value.boolean);
    }

    return Boolean(value);
  }

  /**
   * Get the flag value as a boolean
   */
  asBool(): boolean {
    const value = this.target.value.value;
    if ('boolean' in value) {
      return Boolean(value.boolean);
    }
    if ('number' in value) {
      return Boolean(value.number);
    }
    if ('string' in value) {
      return Boolean(value.string);
    }
    return Boolean(Object.values(value)[0]);
  }

  /**
   * Get the flag value as a string
   */
  asString(): string {
    const value = this.target.value.value;
    if ('string' in value) {
      return String(value.string);
    }
    if ('boolean' in value) {
      return String(value.boolean);
    }
    if ('number' in value) {
      return String(value.number);
    }
    // Fallback to first value found
    const firstValue = Object.values(value)[0];
    return firstValue !== undefined ? String(firstValue) : '';
  }

  /**
   * Get the flag value as a number
   */
  asNumber(): number {
    const value = this.target.value.value;
    if ('number' in value) {
      return Number(value.number);
    }
    if ('string' in value) {
      const parsed = parseFloat(String(value.string));
      return isNaN(parsed) ? 0 : parsed;
    }
    if ('boolean' in value) {
      return value.boolean ? 1 : 0;
    }
    // Fallback: try to parse first value found
    const firstValue = Object.values(value)[0];
    if (firstValue === undefined) return 0;
    const parsed = parseFloat(String(firstValue));
    return isNaN(parsed) ? 0 : parsed;
  }

  /**
   * Get the raw flag value
   */
  getValue(): FlagValue {
    const value = this.target.value.value;
    if ('boolean' in value) return value.boolean as boolean;
    if ('string' in value) return value.string as string;
    if ('number' in value) return value.number as number;
    // Fallback: return the first value found or empty string
    const firstValue = Object.values(value)[0];
    return firstValue !== undefined ? firstValue : '';
  }

  /**
   * Create a Flag from API data
   */
  static fromObject(data: FlagData): Flag {
    return new Flag(data.version, data.type, data.key, data.name, data.target, data.rules || []);
  }

  toJSON(): FlagData {
    return {
      version: this.version,
      type: this.type,
      key: this.key,
      name: this.name,
      target: this.target,
      rules: this.rules,
    };
  }
}
