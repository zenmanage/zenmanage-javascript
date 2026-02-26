import type { Config } from './types';
import { ConfigurationError } from './errors';
import { FlagManager } from './flag-manager';
import { ApiClient } from './api-client';
import { RuleEngine } from './rule-engine';
import { InMemoryCache, NullCache, type Cache } from './cache';

/**
 * Main entry point for the Zenmanage SDK
 */
export class Zenmanage {
  private readonly flagManager: FlagManager;

  constructor(config: Config) {
    const logger = config.logger!; // Logger is always set by ConfigBuilder

    // Create cache instance
    const cache = this.createCache(config);

    // Create API client
    const apiClient = new ApiClient(
      config.environmentToken,
      config.apiEndpoint,
      logger,
      config.enableUsageReporting
    );

    // Create rule engine
    const ruleEngine = new RuleEngine();

    // Create flag manager
    this.flagManager = new FlagManager(
      apiClient,
      cache,
      ruleEngine,
      config.cacheTtl || 3600,
      logger
    );
  }

  /**
   * Get the flag manager instance for flag evaluation
   * Use withContext() on the returned FlagManager to send context to the API
   */
  flags(): FlagManager {
    return this.flagManager;
  }

  /**
   * Create a cache instance based on configuration
   */
  private createCache(config: Config): Cache {
    // If a custom cache instance is provided, use it directly
    if (config.customCache) {
      return config.customCache;
    }

    switch (config.cacheBackend) {
      case 'filesystem':
        throw new ConfigurationError(
          'Filesystem cache requires a custom cache instance. ' +
            'Import FileSystemCache from "@zenmanage/sdk/node" and pass it via .withCache(new FileSystemCache(dir))'
        );

      case 'memory':
        return new InMemoryCache();

      case 'null':
        return new NullCache();

      default:
        throw new ConfigurationError(`Invalid cache backend: ${config.cacheBackend}`);
    }
  }
}
