import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { FlagManager } from '../src/flag-manager';
import { RuleEngine } from '../src/rule-engine';
import { InMemoryCache } from '../src/cache';
import { Context } from '../src/context';
import { DefaultsCollection } from '../src/defaults-collection';
import type { ApiClient } from '../src/api-client';
import type { Cache } from '../src/cache';
import type { FlagData } from '../src/types';
import { createMockLogger, createEmptyCache, buildFlag } from './test-utils';

/**
 * A manager that stays alive must re-read its rules once `cacheTtl` has
 * passed, instead of serving the first rules it loaded until it restarts.
 * Only `Date` is faked: the cache and the manager both read the clock from it.
 */

const TTL_SECONDS = 60;
const RETRY_SECONDS = 30;
const CACHE_KEY = 'zenmanage_rules';

function stringFlag(value: string): FlagData {
  return buildFlag({
    key: 'a',
    type: 'string',
    target: {
      version: 'tar_test',
      expired_at: null,
      published_at: '2026-02-20T00:00:00+00:00',
      scheduled_at: null,
      value: { version: 'val_test', value: { string: value } },
    },
  });
}

/** What the fake API serves; change `served.value` to change the rules. */
function createApi(initial: string) {
  const served = { value: initial, failing: false };
  const apiClient = {
    getRules: vi.fn(async () => {
      if (served.failing) {
        throw new Error('network error');
      }

      return { version: '2026-02-24', flags: [stringFlag(served.value)] };
    }),
    reportUsage: vi.fn(async () => {}),
  } as unknown as ApiClient;

  return { served, apiClient };
}

function createManager(
  apiClient: ApiClient,
  cache: Cache = new InMemoryCache(),
  ttl = TTL_SECONDS
) {
  return new FlagManager(apiClient, cache, new RuleEngine(), ttl, createMockLogger());
}

describe('FlagManager cacheTtl', () => {
  let now: number;

  /** Move the clock forward, as time passing in a long-lived process. */
  function advance(seconds: number): void {
    now += seconds * 1000;
    vi.setSystemTime(now);
  }

  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    now = new Date('2026-10-10T12:00:00Z').getTime();
    vi.setSystemTime(now);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('within the TTL', () => {
    it('serves the rules in memory without another cache or API read', async () => {
      const { apiClient } = createApi('v1');
      const cache = createEmptyCache();
      const manager = createManager(apiClient, cache);

      await manager.single('a');
      advance(TTL_SECONDS - 1);
      for (let i = 0; i < 5; i++) {
        expect((await manager.single('a')).asString()).toBe('v1');
      }

      expect(cache.get).toHaveBeenCalledTimes(1);
      expect(apiClient.getRules).toHaveBeenCalledTimes(1);
    });

    it('keeps serving the old rules even though the API has changed', async () => {
      const { served, apiClient } = createApi('v1');
      const manager = createManager(apiClient);

      await manager.single('a');
      served.value = 'v2';
      advance(TTL_SECONDS - 1);

      expect((await manager.single('a')).asString()).toBe('v1');
    });
  });

  describe('after the TTL', () => {
    it('reloads from the API and serves the new rules', async () => {
      const { served, apiClient } = createApi('v1');
      const manager = createManager(apiClient);

      expect((await manager.single('a')).asString()).toBe('v1');
      served.value = 'v2';
      advance(TTL_SECONDS + 1);

      expect((await manager.single('a')).asString()).toBe('v2');
      expect(apiClient.getRules).toHaveBeenCalledTimes(2);
    });

    it('starts a fresh TTL from the reload', async () => {
      const { served, apiClient } = createApi('v1');
      const manager = createManager(apiClient);

      await manager.single('a');
      advance(TTL_SECONDS + 1);
      served.value = 'v2';
      await manager.single('a');
      served.value = 'v3';
      advance(TTL_SECONDS - 1);

      expect((await manager.single('a')).asString()).toBe('v2');
      advance(2);
      expect((await manager.single('a')).asString()).toBe('v3');
    });

    it('re-reads the cache before the API, in case another process refreshed it', async () => {
      const { apiClient } = createApi('from-api');
      const cache = new InMemoryCache();
      const manager = createManager(apiClient, cache);

      await manager.single('a');
      advance(TTL_SECONDS + 1);
      await cache.set(
        CACHE_KEY,
        JSON.stringify({ version: '2026-02-24', flags: [stringFlag('from-cache')] }),
        TTL_SECONDS
      );

      expect((await manager.single('a')).asString()).toBe('from-cache');
      expect(apiClient.getRules).toHaveBeenCalledTimes(1);
    });

    it('does not take its own cache entry for fresher rules when the cache write is slow', async () => {
      const { served, apiClient } = createApi('v1');
      const inner = new InMemoryCache();
      const slowCache: Cache = {
        get: (key) => inner.get(key),
        has: (key) => inner.has(key),
        delete: (key) => inner.delete(key),
        clear: () => inner.clear(),
        set: async (key, value, ttl) => {
          // The entry's expiry is worked out some time after the fetch finished
          vi.setSystemTime((now += 5));
          await inner.set(key, value, ttl);
        },
      };
      const manager = createManager(apiClient, slowCache);
      const start = now;
      await manager.single('a');
      served.value = 'v2';

      // Just past the TTL counted from the fetch, while the cache entry is still alive
      now = start + TTL_SECONDS * 1000 + 2;
      vi.setSystemTime(now);
      expect((await manager.single('a')).asString()).toBe('v1');

      // Once the entry has expired too, the reload must reach the API
      now = start + TTL_SECONDS * 1000 + 20;
      vi.setSystemTime(now);
      expect((await manager.single('a')).asString()).toBe('v2');
    });

    it('applies to all() as well as single()', async () => {
      const { served, apiClient } = createApi('v1');
      const manager = createManager(apiClient);

      await manager.all();
      served.value = 'v2';
      advance(TTL_SECONDS + 1);

      const flags = await manager.all();

      expect(flags.map((flag) => flag.asString())).toEqual(['v2']);
    });

    it('reloads for a clone made while the rules were still fresh', async () => {
      const { served, apiClient } = createApi('v1');
      const manager = createManager(apiClient);
      await manager.single('a');
      const clone = manager.withContext(new Context('user', 'Ann', 'ann-1'));

      expect((await clone.single('a')).asString()).toBe('v1');
      served.value = 'v2';
      advance(TTL_SECONDS + 1);

      expect((await clone.single('a')).asString()).toBe('v2');
    });

    it('does not hand a clone a snapshot that is already past its TTL', async () => {
      const { served, apiClient } = createApi('v1');
      const manager = createManager(apiClient);
      await manager.single('a');
      served.value = 'v2';
      advance(TTL_SECONDS + 1);

      const clone = manager.withDefaults(new DefaultsCollection());

      expect((await clone.single('a')).asString()).toBe('v2');
    });

    it('shares one reload between callers that arrive together', async () => {
      const { served, apiClient } = createApi('v1');
      const manager = createManager(apiClient);
      await manager.single('a');
      served.value = 'v2';
      advance(TTL_SECONDS + 1);

      const results = await Promise.all(Array.from({ length: 10 }, () => manager.single('a')));

      expect(results.map((flag) => flag.asString())).toEqual(Array(10).fill('v2'));
      expect(apiClient.getRules).toHaveBeenCalledTimes(2);
    });

    it('lets a clone made mid-reload load for itself', async () => {
      const { served, apiClient } = createApi('v1');
      const manager = createManager(apiClient);
      await manager.single('a');
      served.value = 'v2';
      advance(TTL_SECONDS + 1);

      const reloading = manager.single('a');
      const clone = manager.withContext(new Context('user', 'Ann', 'ann-1'));

      expect((await clone.single('a')).asString()).toBe('v2');
      expect((await reloading).asString()).toBe('v2');
    });
  });

  describe('when a reload fails', () => {
    it('keeps serving the rules it already has', async () => {
      const { served, apiClient } = createApi('v1');
      const manager = createManager(apiClient);
      await manager.single('a');
      served.failing = true;
      advance(TTL_SECONDS + 1);

      expect((await manager.single('a', 'fallback')).asString()).toBe('v1');
    });

    it('waits before trying again, then picks up the new rules', async () => {
      const { served, apiClient } = createApi('v1');
      const manager = createManager(apiClient);
      await manager.single('a');
      served.failing = true;
      advance(TTL_SECONDS + 1);
      await manager.single('a');
      expect(apiClient.getRules).toHaveBeenCalledTimes(2);

      // Still inside the pause: no further API read per evaluation
      advance(RETRY_SECONDS - 1);
      await manager.single('a');
      expect(apiClient.getRules).toHaveBeenCalledTimes(2);

      served.failing = false;
      served.value = 'v2';
      advance(2);

      expect((await manager.single('a')).asString()).toBe('v2');
      expect(apiClient.getRules).toHaveBeenCalledTimes(3);
    });

    it('pauses for no longer than the TTL when the TTL is short', async () => {
      const { served, apiClient } = createApi('v1');
      const manager = createManager(apiClient, new InMemoryCache(), 10);
      await manager.single('a');
      served.failing = true;
      advance(11);
      await manager.single('a');

      served.failing = false;
      served.value = 'v2';
      advance(11);

      expect((await manager.single('a')).asString()).toBe('v2');
    });

    it('serves the caller default when the first load fails, then recovers', async () => {
      const { served, apiClient } = createApi('v1');
      served.failing = true;
      const manager = createManager(apiClient);

      expect((await manager.single('a', 'fallback')).asString()).toBe('fallback');

      // Previously a manager that failed its first load stayed empty until restart
      served.failing = false;
      advance(RETRY_SECONDS + 1);

      expect((await manager.single('a', 'fallback')).asString()).toBe('v1');
    });

    it('does not retry on every evaluation while the API is down', async () => {
      const { served, apiClient } = createApi('v1');
      served.failing = true;
      const manager = createManager(apiClient);

      for (let i = 0; i < 5; i++) {
        await manager.single('a', 'fallback');
      }

      expect(apiClient.getRules).toHaveBeenCalledTimes(1);
    });
  });

  describe('when the cache cannot be written', () => {
    function createUnwritableCache(): Cache {
      return {
        ...createEmptyCache(),
        set: vi.fn(async () => {
          throw new Error('disk full');
        }),
      };
    }

    it('still serves the rules it fetched', async () => {
      const { apiClient } = createApi('v1');
      const manager = createManager(apiClient, createUnwritableCache());

      expect((await manager.single('a')).asString()).toBe('v1');
      expect((await manager.single('a')).asString()).toBe('v1');
      expect(apiClient.getRules).toHaveBeenCalledTimes(1);
    });

    it('replaces the rules it has on a reload, and goes back to the API next time', async () => {
      const { served, apiClient } = createApi('v1');
      const manager = createManager(apiClient, createUnwritableCache());
      await manager.single('a');
      served.value = 'v2';
      advance(TTL_SECONDS + 1);

      expect((await manager.single('a')).asString()).toBe('v2');

      served.value = 'v3';
      advance(TTL_SECONDS + 1);

      expect((await manager.single('a')).asString()).toBe('v3');
    });

    it('lets refreshRules() succeed', async () => {
      const { served, apiClient } = createApi('v1');
      const manager = createManager(apiClient, createUnwritableCache());
      await manager.single('a');
      served.value = 'v2';

      await expect(manager.refreshRules()).resolves.toBeUndefined();

      expect((await manager.single('a')).asString()).toBe('v2');
    });
  });

  describe('refreshRules()', () => {
    it('still reloads straight away, before the TTL', async () => {
      const { served, apiClient } = createApi('v1');
      const manager = createManager(apiClient);
      await manager.single('a');
      served.value = 'v2';

      await manager.refreshRules();

      expect((await manager.single('a')).asString()).toBe('v2');
    });

    it('restarts the TTL', async () => {
      const { served, apiClient } = createApi('v1');
      const manager = createManager(apiClient);
      await manager.single('a');
      advance(TTL_SECONDS - 1);
      served.value = 'v2';
      await manager.refreshRules();
      served.value = 'v3';
      advance(TTL_SECONDS - 1);

      expect((await manager.single('a')).asString()).toBe('v2');
    });
  });
});
