import type { Config, Logger } from './types';
import { ConfigurationError } from './errors';

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

    if (this.config.cacheBackend === 'filesystem' && !this.config.cacheDirectory) {
      throw new ConfigurationError('Cache directory is required for filesystem cache');
    }

    // Provide default logger if not set
    if (!this.config.logger) {
      this.config.logger = new NullLogger();
    }

    return this.config as Config;
  }
}
