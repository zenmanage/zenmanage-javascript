import { describe, it, expect, vi, afterEach } from 'vitest';
import { Zenmanage } from '../src/zenmanage';
import { ConfigBuilder } from '../src/config';
import { ConfigurationError } from '../src/errors';
import { InMemoryCache } from '../src/cache';

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('Zenmanage', () => {
  describe('constructor', () => {
    it('should create instance with valid config', () => {
      const config = ConfigBuilder.create().withEnvironmentToken('srv_test_123').build();

      const zenmanage = new Zenmanage(config);
      expect(zenmanage).toBeInstanceOf(Zenmanage);
    });

    it('should create instance with memory cache', () => {
      const config = ConfigBuilder.create()
        .withEnvironmentToken('srv_test_123')
        .withCacheBackend('memory')
        .build();

      const zenmanage = new Zenmanage(config);
      expect(zenmanage.flags()).toBeDefined();
    });

    it('should create instance with null cache', () => {
      const config = ConfigBuilder.create()
        .withEnvironmentToken('srv_test_123')
        .withCacheBackend('null')
        .build();

      const zenmanage = new Zenmanage(config);
      expect(zenmanage.flags()).toBeDefined();
    });

    it('should create instance with custom cache', () => {
      const config = ConfigBuilder.create()
        .withEnvironmentToken('srv_test_123')
        .withCache(new InMemoryCache())
        .build();

      const zenmanage = new Zenmanage(config);
      expect(zenmanage).toBeInstanceOf(Zenmanage);
      expect(zenmanage.flags()).toBeDefined();
    });

    it('should throw error for filesystem cache without custom cache instance', () => {
      const config = ConfigBuilder.create()
        .withEnvironmentToken('srv_test_123')
        .withCacheBackend('filesystem')
        .withCacheDirectory('/tmp/zenmanage-test')
        .build();

      expect(() => new Zenmanage(config)).toThrow(ConfigurationError);
      expect(() => new Zenmanage(config)).toThrow(
        'Filesystem cache requires a custom cache instance'
      );
    });

    it('should throw error for invalid cache backend', () => {
      const config = {
        environmentToken: 'srv_test_123',
        cacheBackend: 'invalid' as any,
        logger: {
          debug: () => {},
          info: () => {},
          warn: () => {},
          error: () => {},
        },
      };

      expect(() => new Zenmanage(config)).toThrow(ConfigurationError);
      expect(() => new Zenmanage(config)).toThrow('Invalid cache backend');
    });
  });

  describe('flags', () => {
    it('should return FlagManager instance', () => {
      const config = ConfigBuilder.create().withEnvironmentToken('srv_test_123').build();

      const zenmanage = new Zenmanage(config);
      const flagManager = zenmanage.flags();

      expect(flagManager).toBeDefined();
      expect(typeof flagManager.single).toBe('function');
      expect(typeof flagManager.all).toBe('function');
      expect(typeof flagManager.withContext).toBe('function');
    });

    it('should return the same FlagManager instance', () => {
      const config = ConfigBuilder.create().withEnvironmentToken('srv_test_123').build();

      const zenmanage = new Zenmanage(config);
      const flags1 = zenmanage.flags();
      const flags2 = zenmanage.flags();

      expect(flags1).toBe(flags2);
    });
  });

  describe('client agent override', () => {
    function stubFetch(capturedHeaders: Record<string, string>[]): void {
      vi.stubGlobal(
        'fetch',
        vi.fn().mockImplementation((url: string, options: RequestInit) => {
          capturedHeaders.push(options.headers as Record<string, string>);
          const body = url.includes('/v1/flag-json')
            ? { data: { cdn: 'https://cdn.example.com', path: '/rules.json' } }
            : { version: '1', flags: [] };
          return Promise.resolve(
            new Response(JSON.stringify(body), {
              status: 200,
              headers: { 'Content-Type': 'application/json' },
            })
          );
        })
      );
    }

    it('sends the configured client agent and version when loading rules', async () => {
      const capturedHeaders: Record<string, string>[] = [];
      stubFetch(capturedHeaders);

      const config = ConfigBuilder.create()
        .withEnvironmentToken('srv_test_123')
        .withClientAgent('zenmanage-react')
        .withSdkVersion('1.0.0')
        .build();
      await new Zenmanage(config).flags().all();

      expect(capturedHeaders[0]['X-ZEN-CLIENT-AGENT']).toBe('zenmanage-react/1.0.0');
    });
  });
});
