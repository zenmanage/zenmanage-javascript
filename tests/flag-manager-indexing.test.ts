import { describe, it, expect, vi } from 'vitest';
import { FlagManager } from '../src/flag-manager';
import { RuleEngine } from '../src/rule-engine';
import {
  createMockLogger,
  createCacheWithFlags,
  createMockApiClient,
  buildFlag,
} from './test-utils';

/**
 * Regression guards for the flag-key index in FlagManager: `all()` must
 * keep returning flags in payload order, and `single()` must keep
 * first-match-wins semantics on duplicate keys, now that lookups go
 * through a Map instead of a linear scan.
 */

describe('FlagManager flag-key indexing', () => {
  it('returns flags from all() in payload order', async () => {
    const flags = ['c-flag', 'a-flag', 'b-flag'].map((key) => buildFlag({ key }));
    const cache = createCacheWithFlags(flags);
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
    const cache = createCacheWithFlags(flags);
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
    const cache = createCacheWithFlags(flags);
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
    const goodFlag = buildFlag({
      key: 'stale-flag',
      target: {
        version: 'tar_test',
        expired_at: null,
        published_at: '2026-02-20T00:00:00+00:00',
        scheduled_at: null,
        value: { version: 'val_test', value: { string: 'default' } },
      },
    });
    const cache = createCacheWithFlags([goodFlag]);
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
