import { describe, it, expect } from 'vitest';
import { ConfigBuilder } from '../src/config';
import { ConfigurationError } from '../src/errors';

describe('ConfigBuilder', () => {
  describe('create', () => {
    it('should create a new ConfigBuilder instance', () => {
      const builder = ConfigBuilder.create();
      expect(builder).toBeInstanceOf(ConfigBuilder);
    });
  });

  describe('build', () => {
    it('should throw error if environment token is not set', () => {
      const builder = ConfigBuilder.create();
      expect(() => builder.build()).toThrow(ConfigurationError);
      expect(() => builder.build()).toThrow('Environment token is required');
    });

    it('should build config with required token', () => {
      const config = ConfigBuilder.create().withEnvironmentToken('tok_test_123').build();

      expect(config.environmentToken).toBe('tok_test_123');
      expect(config.cacheTtl).toBe(3600);
      expect(config.cacheBackend).toBe('memory');
      expect(config.enableUsageReporting).toBe(true);
      expect(config.apiEndpoint).toBe('https://api.zenmanage.com');
      expect(config.logger).toBeDefined();
    });

    it('should allow custom cache TTL', () => {
      const config = ConfigBuilder.create()
        .withEnvironmentToken('tok_test_123')
        .withCacheTtl(7200)
        .build();

      expect(config.cacheTtl).toBe(7200);
    });

    it('should allow custom cache backend', () => {
      const config = ConfigBuilder.create()
        .withEnvironmentToken('tok_test_123')
        .withCacheBackend('null')
        .build();

      expect(config.cacheBackend).toBe('null');
    });

    it('should require cache directory for filesystem cache', () => {
      const builder = ConfigBuilder.create()
        .withEnvironmentToken('tok_test_123')
        .withCacheBackend('filesystem');

      expect(() => builder.build()).toThrow(ConfigurationError);
      expect(() => builder.build()).toThrow('Cache directory is required for filesystem cache');
    });

    it('should allow filesystem cache with directory', () => {
      const config = ConfigBuilder.create()
        .withEnvironmentToken('tok_test_123')
        .withCacheBackend('filesystem')
        .withCacheDirectory('/tmp/cache')
        .build();

      expect(config.cacheBackend).toBe('filesystem');
      expect(config.cacheDirectory).toBe('/tmp/cache');
    });

    it('should allow setting usage reporting', () => {
      const config = ConfigBuilder.create()
        .withEnvironmentToken('tok_test_123')
        .withUsageReporting(true)
        .build();

      expect(config.enableUsageReporting).toBe(true);
    });

    it('should allow disabling usage reporting', () => {
      const config = ConfigBuilder.create()
        .withEnvironmentToken('tok_test_123')
        .withUsageReporting(false)
        .build();

      expect(config.enableUsageReporting).toBe(false);
    });

    it('should allow custom API endpoint', () => {
      const config = ConfigBuilder.create()
        .withEnvironmentToken('tok_test_123')
        .withApiEndpoint('https://custom.api.com')
        .build();

      expect(config.apiEndpoint).toBe('https://custom.api.com');
    });

    it('should allow custom logger', () => {
      const customLogger = {
        debug: () => {},
        info: () => {},
        warn: () => {},
        error: () => {},
      };

      const config = ConfigBuilder.create()
        .withEnvironmentToken('tok_test_123')
        .withLogger(customLogger)
        .build();

      expect(config.logger).toBe(customLogger);
    });
  });

  describe('fromEnvironment', () => {
    it('should create builder from environment variables', () => {
      // Save original env vars
      const originalEnv = { ...process.env };

      // Set test env vars
      process.env.ZENMANAGE_ENVIRONMENT_TOKEN = 'tok_env_test';
      process.env.ZENMANAGE_CACHE_TTL = '1800';
      process.env.ZENMANAGE_CACHE_BACKEND = 'null';
      process.env.ZENMANAGE_ENABLE_USAGE_REPORTING = 'true';
      process.env.ZENMANAGE_API_ENDPOINT = 'https://env.api.com';

      const config = ConfigBuilder.fromEnvironment().build();

      expect(config.environmentToken).toBe('tok_env_test');
      expect(config.cacheTtl).toBe(1800);
      expect(config.cacheBackend).toBe('null');
      expect(config.enableUsageReporting).toBe(true);
      expect(config.apiEndpoint).toBe('https://env.api.com');

      // Restore env vars
      process.env = originalEnv;
    });
  });
});
