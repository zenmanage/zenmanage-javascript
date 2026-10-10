import { describe, it, expect, vi, afterEach } from 'vitest';
import { Zenmanage } from '../src/zenmanage';
import { Context } from '../src/context';
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

  describe('hand-built Config defaults', () => {
    function usageRequests(fetchMock: ReturnType<typeof stubFetch>): string[] {
      return fetchMock.mock.calls
        .map(([url]) => url as string)
        .filter((url) => url.includes('/usage'));
    }

    // Config documents these fields as optional with defaults, and ConfigBuilder fills them in.
    // A plain object skips the builder, so Zenmanage has to apply the same defaults itself.
    const minimalConfig: Config = { environmentToken: 'srv_test_123' };

    it('constructs from a Config with only an environment token', () => {
      expect(() => new Zenmanage(minimalConfig)).not.toThrow();
    });

    it('defaults cacheBackend to memory, so managers share rules that were already fetched', async () => {
      // With a null cache the second manager would fetch the rules again.
      const fetchMock = stubFetch();
      const flags = new Zenmanage({ ...minimalConfig, enableUsageReporting: false }).flags();
      const first = flags.withContext(Context.single('user', 'alice'));
      const second = flags.withContext(Context.single('user', 'bob'));

      await first.single('some-flag', false);
      await second.single('some-flag', false);

      const rulesRequests = fetchMock.mock.calls.filter(([url]) =>
        (url as string).includes('/v1/flag-json')
      );
      expect(rulesRequests).toHaveLength(1);
    });

    it('still rejects a cacheBackend that is set to something invalid', () => {
      const config = { ...minimalConfig, cacheBackend: 'invalid' as never };

      expect(() => new Zenmanage(config)).toThrow('Invalid cache backend: invalid');
    });

    it('falls back to the default without crashing when there is no logger and rules fail to load', async () => {
      vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('ECONNREFUSED')));

      const flag = await new Zenmanage(minimalConfig).flags().single('some-flag', true);

      expect(flag.asBool()).toBe(true);
    });

    it('uses the logger it is given instead of the silent default', async () => {
      vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('ECONNREFUSED')));
      const logger = createMockLogger();

      await new Zenmanage({ ...minimalConfig, logger }).flags().single('some-flag', true);

      expect(logger.warn).toHaveBeenCalled();
    });

    it('serves the new rules once cacheTtl has passed on a client that stays alive', async () => {
      vi.useFakeTimers({ toFake: ['Date'] });
      vi.setSystemTime(new Date('2026-10-10T12:00:00Z'));
      let served = 'v1';
      vi.stubGlobal(
        'fetch',
        vi.fn().mockImplementation((url: string) => {
          const body = url.includes('/v1/flag-json')
            ? { data: { cdn: 'https://cdn.example.com', path: '/rules.json' } }
            : {
                version: '1',
                flags: [
                  {
                    version: 'fla_a',
                    type: 'string',
                    key: 'a',
                    name: 'A',
                    target: {
                      version: 'tar_a',
                      value: { version: 'val_a', value: { string: served } },
                    },
                    rules: [],
                  },
                ],
              };

          return Promise.resolve(new Response(JSON.stringify(body), { status: 200 }));
        })
      );
      const client = new Zenmanage(
        ConfigBuilder.create()
          .withEnvironmentToken('srv_test_123')
          .withCacheTtl(60)
          .withUsageReporting(false)
          .build()
      );

      try {
        expect((await client.flags().single('a')).asString()).toBe('v1');

        served = 'v2';
        vi.setSystemTime(Date.now() + 10 * 60 * 1000);

        expect((await client.flags().single('a')).asString()).toBe('v2');
        expect(
          (await client.flags().withContext(Context.single('user', 'alice')).single('a')).asString()
        ).toBe('v2');
      } finally {
        vi.useRealTimers();
      }
    });

    it('reports usage when enableUsageReporting is omitted', async () => {
      const fetchMock = stubFetch();

      await new Zenmanage(minimalConfig).flags().single('some-flag', false);

      expect(usageRequests(fetchMock)).toEqual([
        'https://api.zenmanage.com/v1/flags/some-flag/usage',
      ]);
    });

    it('does not report usage when enableUsageReporting is false', async () => {
      const fetchMock = stubFetch();

      await new Zenmanage({ ...minimalConfig, enableUsageReporting: false })
        .flags()
        .single('some-flag', false);

      expect(usageRequests(fetchMock)).toEqual([]);
    });
  });
});
