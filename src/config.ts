import type { Config, Logger } from './types';
import type { Cache } from './cache/cache.interface';
import { ConfigurationError } from './errors';

type Runtime = 'node' | 'browser';
type KeyType = 'server' | 'client' | 'mobile' | 'unknown';

const SERVER_KEY_PREFIX = 'srv_';
const CLIENT_KEY_PREFIX = 'cli_';
const MOBILE_KEY_PREFIX = 'mob_';

/**
 * Default logger that does nothing (null logger pattern)
 */
class NullLogger implements Logger {
  debug(): void {}
  info(): void {}
  warn(): void {}
  error(): void {}
}

/**
 * Fluent builder for creating Config objects
 */
export class ConfigBuilder {
  private config: Partial<Config> = {
    cacheTtl: 3600,
    cacheBackend: 'memory',
    enableUsageReporting: true,
    apiEndpoint: 'https://api.zenmanage.com',
  };

  private constructor() {}

  /**
   * Create a new ConfigBuilder instance
   */
  static create(): ConfigBuilder {
    return new ConfigBuilder();
  }

  /**
   * Create a ConfigBuilder with values from environment variables
   */
  static fromEnvironment(): ConfigBuilder {
    const builder = new ConfigBuilder();

    if (typeof process === 'undefined' || !process.env) {
      return builder;
    }

    const token = process.env.ZENMANAGE_ENVIRONMENT_TOKEN;
    if (token) {
      builder.withEnvironmentToken(token);
    }

    const cacheTtl = process.env.ZENMANAGE_CACHE_TTL;
    if (cacheTtl && !isNaN(Number(cacheTtl))) {
      builder.withCacheTtl(Number(cacheTtl));
    }

    const cacheBackend = process.env.ZENMANAGE_CACHE_BACKEND;
    if (cacheBackend && ['memory', 'filesystem', 'null'].includes(cacheBackend)) {
      builder.withCacheBackend(cacheBackend as 'memory' | 'filesystem' | 'null');
    }

    const cacheDir = process.env.ZENMANAGE_CACHE_DIR;
    if (cacheDir) {
      builder.withCacheDirectory(cacheDir);
    }

    const enableReporting = process.env.ZENMANAGE_ENABLE_USAGE_REPORTING;
    if (enableReporting === 'true' || enableReporting === '1') {
      builder.withUsageReporting(true);
    } else if (enableReporting === 'false' || enableReporting === '0') {
      builder.withUsageReporting(false);
    }

    const apiEndpoint = process.env.ZENMANAGE_API_ENDPOINT;
    if (apiEndpoint) {
      builder.withApiEndpoint(apiEndpoint);
    }

    return builder;
  }

  /**
   * Set the environment token
   */
  withEnvironmentToken(token: string): this {
    this.config.environmentToken = token;
    return this;
  }

  /**
   * Set the cache TTL in seconds
   */
  withCacheTtl(ttl: number): this {
    this.config.cacheTtl = ttl;
    return this;
  }

  /**
   * Set the cache backend type
   */
  withCacheBackend(backend: 'memory' | 'filesystem' | 'null'): this {
    this.config.cacheBackend = backend;
    return this;
  }

  /**
   * Set the cache directory for filesystem cache
   */
  withCacheDirectory(directory: string): this {
    this.config.cacheDirectory = directory;
    return this;
  }

  /**
   * Set whether usage reporting is enabled
   */
  withUsageReporting(enabled: boolean): this {
    this.config.enableUsageReporting = enabled;
    return this;
  }

  /**
   * Set the API endpoint
   */
  withApiEndpoint(endpoint: string): this {
    this.config.apiEndpoint = endpoint;
    return this;
  }

  /**
   * Set a custom cache instance (overrides cacheBackend)
   * Use this to provide a FileSystemCache from '@zenmanage/sdk/node' or any custom Cache implementation
   */
  withCache(cache: Cache): this {
    this.config.customCache = cache;
    return this;
  }

  /**
   * Set a custom logger
   */
  withLogger(logger: Logger): this {
    this.config.logger = logger;
    return this;
  }

  /**
   * Build and validate the configuration
   */
  build(): Config {
    if (!this.config.environmentToken) {
      throw new ConfigurationError('Environment token is required');
    }

    this.validateEnvironmentTokenForRuntime(this.config.environmentToken);

    if (
      this.config.cacheBackend === 'filesystem' &&
      !this.config.cacheDirectory &&
      !this.config.customCache
    ) {
      throw new ConfigurationError('Cache directory is required for filesystem cache');
    }

    // Provide default logger if not set
    if (!this.config.logger) {
      this.config.logger = new NullLogger();
    }

    return this.config as Config;
  }

  /**
   * Validate that the token type matches the current runtime.
   */
  private validateEnvironmentTokenForRuntime(token: string): void {
    const runtime = this.detectRuntime();
    const keyType = this.detectKeyType(token);

    if (keyType === 'unknown') {
      throw new ConfigurationError(
        `Invalid environment token format. Expected one of: ${SERVER_KEY_PREFIX}, ${CLIENT_KEY_PREFIX}, or ${MOBILE_KEY_PREFIX}.`
      );
    }

    if (runtime === 'node' && keyType !== 'server') {
      throw new ConfigurationError(
        `Invalid environment token for Node.js runtime: ${this.describeKeyType(keyType)} provided. Use a server key (${SERVER_KEY_PREFIX}...).`
      );
    }

    if (runtime === 'browser' && keyType !== 'client') {
      throw new ConfigurationError(
        `Invalid environment token for browser runtime: ${this.describeKeyType(keyType)} provided. Use a client key (${CLIENT_KEY_PREFIX}...).`
      );
    }
  }

  /**
   * Detect runtime in a way that works for both browser and Node.js tests.
   */
  private detectRuntime(): Runtime {
    if (typeof window !== 'undefined' || typeof document !== 'undefined') {
      return 'browser';
    }

    if (typeof process !== 'undefined' && !!process.versions?.node) {
      return 'node';
    }

    return 'node';
  }

  private detectKeyType(token: string): KeyType {
    if (token.startsWith(SERVER_KEY_PREFIX)) {
      return 'server';
    }

    if (token.startsWith(CLIENT_KEY_PREFIX)) {
      return 'client';
    }

    if (token.startsWith(MOBILE_KEY_PREFIX)) {
      return 'mobile';
    }

    return 'unknown';
  }

  private describeKeyType(keyType: Exclude<KeyType, 'unknown'>): string {
    switch (keyType) {
      case 'server':
        return 'server key';
      case 'client':
        return 'client key';
      case 'mobile':
        return 'mobile key';
    }
  }
}
