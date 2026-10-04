import { describe, it, expect, vi, afterEach } from 'vitest';
import { Zenmanage } from '../src/zenmanage';
import type { Config } from '../src/types';
import { createMockLogger } from './test-utils';
import { ConfigBuilder } from '../src/config';
import { ConfigurationError } from '../src/errors';
import { InMemoryCache } from '../src/cache';

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

/**
 * Stubs global fetch to serve the metadata + CDN rules pair loading rules expects, and to
 * accept any other request (such as a usage report) with an empty 200.
 */
function stubFetch() {
  const fetchMock = vi.fn().mockImplementation((url: string) => {
    const body = url.includes('/v1/flag-json')
      ? { data: { cdn: 'https://cdn.example.com', path: '/rules.json' } }
      : { version: '1', flags: [] };

    return Promise.resolve(
      new Response(JSON.stringify(body), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    );
  });
  vi.stubGlobal('fetch', fetchMock);

  return fetchMock;
}

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
    it('sends the configured client agent and version when loading rules', async () => {
      const fetchMock = stubFetch();

      const config = ConfigBuilder.create()
        .withEnvironmentToken('srv_test_123')
        .withClientAgent('zenmanage-react')
        .withSdkVersion('1.0.0')
        .build();
      await new Zenmanage(config).flags().all();

      const [, options] = fetchMock.mock.calls[0];
      expect((options.headers as Record<string, string>)['X-ZEN-CLIENT-AGENT']).toBe(
        'zenmanage-react/1.0.0'
      );
    });
  });

  describe('usage reporting default', () => {
    function usageRequests(fetchMock: ReturnType<typeof stubFetch>): string[] {
      return fetchMock.mock.calls
        .map(([url]) => url as string)
        .filter((url) => url.includes('/usage'));
    }

    it('reports usage for a hand-built Config that omits enableUsageReporting', async () => {
      // Config documents enableUsageReporting as "default: true", and ConfigBuilder sets it,
      // but a plain object skips the builder. It must still report. (cacheBackend and logger
      // have to be given too: without the builder's defaults, Zenmanage rejects a missing
      // cacheBackend and FlagManager calls the missing logger.)
      const fetchMock = stubFetch();
      const config: Config = {
        environmentToken: 'srv_test_123',
        cacheBackend: 'memory',
        logger: createMockLogger(),
      };

      await new Zenmanage(config).flags().single('some-flag', false);

      expect(usageRequests(fetchMock)).toEqual([
        'https://api.zenmanage.com/v1/flags/some-flag/usage',
      ]);
    });

    it('does not report usage when enableUsageReporting is false', async () => {
      const fetchMock = stubFetch();
      const config: Config = {
        environmentToken: 'srv_test_123',
        cacheBackend: 'memory',
        logger: createMockLogger(),
        enableUsageReporting: false,
      };

      await new Zenmanage(config).flags().single('some-flag', false);

      expect(usageRequests(fetchMock)).toEqual([]);
    });
  });
});
