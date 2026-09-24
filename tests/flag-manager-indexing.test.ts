import { describe, it, expect, vi } from 'vitest';
import { FlagManager } from '../src/flag-manager';
import { RuleEngine } from '../src/rule-engine';
import { ApiClient } from '../src/api-client';
import type { FlagData, Logger } from '../src/types';
import type { Cache } from '../src/cache';

/**
 * Regression guards for the flag-key index in FlagManager: `all()` must
 * keep returning flags in payload order, and `single()` must keep
 * first-match-wins semantics on duplicate keys, now that lookups go
 * through a Map instead of a linear scan.
 */

function createMockLogger(): Logger {
  return {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  };
}

function createMockCache(flags: FlagData[]): Cache {
  const data: Record<string, string> = {
    zenmanage_rules: JSON.stringify({ version: '2026-02-24', flags }),
  };

  return {
    get: vi.fn(async (key: string) => data[key] ?? null),
    set: vi.fn(async () => {}),
    has: vi.fn(async (key: string) => key in data),
    delete: vi.fn(async () => {}),
    clear: vi.fn(async () => {}),
  };
}

function createMockApiClient(): ApiClient {
  return {
    getRules: vi.fn(async () => ({ version: '2026-02-24', flags: [] })),
    reportUsage: vi.fn(async () => {}),
  } as unknown as ApiClient;
}

function buildFlag(overrides: Partial<FlagData> = {}): FlagData {
  return {
    version: 'fla_test',
    type: 'string',
    key: 'test-flag',
    name: 'Test Flag',
    target: {
      version: 'tar_test',
      expired_at: null,
      published_at: '2026-02-20T00:00:00+00:00',
      scheduled_at: null,
      value: { version: 'val_test', value: { string: 'default' } },
    },
    rules: [],
    ...overrides,
  };
}

describe('FlagManager flag-key indexing', () => {
  it('returns flags from all() in payload order', async () => {
    const flags = ['c-flag', 'a-flag', 'b-flag'].map((key) => buildFlag({ key }));
    const cache = createMockCache(flags);
    const manager = new FlagManager(
      createMockApiClient(),
      cache,
      new RuleEngine(),
      3600,
      createMockLogger()
    );

    const allFlags = await manager.all();

    expect(allFlags.map((f) => f.getKey())).toEqual(['c-flag', 'a-flag', 'b-flag']);
  });

  it('keeps first-match-wins semantics for single() on duplicate keys', async () => {
    const flags = [
      buildFlag({
        key: 'dup-flag',
        target: {
          version: 'tar_first',
          expired_at: null,
          published_at: '2026-02-20T00:00:00+00:00',
          scheduled_at: null,
          value: { version: 'val_first', value: { string: 'first' } },
        },
      }),
      buildFlag({
        key: 'dup-flag',
        target: {
          version: 'tar_second',
          expired_at: null,
          published_at: '2026-02-20T00:00:00+00:00',
          scheduled_at: null,
          value: { version: 'val_second', value: { string: 'second' } },
        },
      }),
    ];
    const cache = createMockCache(flags);
    const manager = new FlagManager(
      createMockApiClient(),
      cache,
      new RuleEngine(),
      3600,
      createMockLogger()
    );

    const flag = await manager.single('dup-flag');

    expect(flag.asString()).toBe('first');
  });

  it('includes every duplicate-keyed flag in all(), unlike single()', async () => {
    const flags = [
      buildFlag({ key: 'dup-flag' }),
      buildFlag({ key: 'dup-flag' }),
      buildFlag({ key: 'unique-flag' }),
    ];
    const cache = createMockCache(flags);
    const manager = new FlagManager(
      createMockApiClient(),
      cache,
      new RuleEngine(),
      3600,
      createMockLogger()
    );

    const allFlags = await manager.all();

    expect(allFlags.map((f) => f.getKey())).toEqual(['dup-flag', 'dup-flag', 'unique-flag']);
  });

  it('clears the stale index on a failed refresh so single() cannot see old flags', async () => {
    const goodFlag = buildFlag({ key: 'stale-flag' });
    const cache = createMockCache([goodFlag]);
    const apiClient = createMockApiClient();
    apiClient.getRules = vi.fn(async () => {
      throw new Error('network error');
    });
    const manager = new FlagManager(apiClient, cache, new RuleEngine(), 3600, createMockLogger());

    // Load succeeds from cache first, indexing 'stale-flag'.
    const flag = await manager.single('stale-flag');
    expect(flag.asString()).toBe('default');

    // A forced refresh that fails must not leave the old index queryable.
    await expect(manager.refreshRules()).rejects.toThrow('network error');
    await expect(manager.single('stale-flag')).rejects.toThrow('Flag not found: stale-flag');
  });
});
