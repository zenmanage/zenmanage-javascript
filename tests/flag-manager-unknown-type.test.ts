import { describe, it, expect, vi, beforeEach } from 'vitest';
import { FlagManager } from '../src/flag-manager';
import { ApiClient } from '../src/api-client';
import { RuleEngine } from '../src/rule-engine';
import type { FlagData, Logger } from '../src/types';
import {
  createMockLogger,
  createEmptyCache,
  createCacheWithFlags,
  createMockApiClient,
  buildFlag,
} from './test-utils';

/**
 * ZEN-1667: the API may start serving flag types this SDK release predates
 * (json was one such type, and is now fully supported — see flag.test.ts and
 * flag-manager-json-defaults.test.ts). An old SDK release parsing a rules
 * payload that contains a flag of a type it doesn't recognize must not throw
 * or mis-parse — it must degrade the unknown flag to the caller's default
 * while leaving every other flag in the payload unaffected. This file
 * exercises that general tolerance mechanism against a hypothetical future
 * type, `duration`, that no SDK release knows about yet.
 */

/**
 * A `duration`-typed flag, standing in for a hypothetical future flag type
 * this SDK release doesn't know about. `type` and the value wrapper key are
 * both outside today's closed `FlagType`/value-wrapper union, so this is
 * deliberately cast through `unknown` to simulate a payload an old SDK
 * release wasn't written for.
 */
function buildDurationFlag(overrides: Record<string, unknown> = {}): FlagData {
  return {
    version: 'fla_duration',
    type: 'duration',
    key: 'duration-flag',
    name: 'Duration Flag',
    target: {
      version: 'tar_duration',
      expired_at: null,
      published_at: '2026-09-01T00:00:00+00:00',
      scheduled_at: null,
      value: {
        version: 'val_duration',
        value: { duration: 5000 },
      },
    },
    rules: [],
    ...overrides,
  } as unknown as FlagData;
}

const mixedPayloadFlags: FlagData[] = [
  buildFlag({ key: 'bool-flag', type: 'boolean', target: flagTarget({ boolean: true }) }),
  buildFlag({ key: 'string-flag', type: 'string', target: flagTarget({ string: 'hello' }) }),
  buildFlag({ key: 'number-flag', type: 'number', target: flagTarget({ number: 42 }) }),
  buildDurationFlag({ key: 'duration-flag' }),
];

function flagTarget(value: { boolean?: boolean; string?: string; number?: number }) {
  return {
    version: 'tar_test',
    expired_at: null,
    published_at: '2026-09-01T00:00:00+00:00',
    scheduled_at: null,
    value: {
      version: 'val_test',
      value,
    },
  };
}

describe('FlagManager tolerance of unknown flag types (duration, ZEN-1667)', () => {
  let apiClient: ApiClient;
  let logger: Logger;
  let manager: FlagManager;

  beforeEach(() => {
    apiClient = createMockApiClient(mixedPayloadFlags);
    logger = createMockLogger();
    manager = new FlagManager(apiClient, createEmptyCache(), new RuleEngine(), 3600, logger);
  });

  it('loads a payload containing a duration-typed flag from the API without throwing, and leaves other flags unaffected', async () => {
    const allFlags = await manager.all();
    const keys = allFlags.map((f) => f.getKey());

    expect(keys).toContain('bool-flag');
    expect(keys).toContain('string-flag');
    expect(keys).toContain('number-flag');

    const boolFlag = allFlags.find((f) => f.getKey() === 'bool-flag')!;
    const stringFlag = allFlags.find((f) => f.getKey() === 'string-flag')!;
    const numberFlag = allFlags.find((f) => f.getKey() === 'number-flag')!;

    expect(boolFlag.isEnabled()).toBe(true);
    expect(stringFlag.asString()).toBe('hello');
    expect(numberFlag.asNumber()).toBe(42);
  });

  it('resolves a duration-typed flag looked up via single() to the caller-supplied default, not a thrown error or garbage value', async () => {
    const flag = await manager.single('duration-flag', 'fallback-default');

    expect(flag.asString()).toBe('fallback-default');
  });

  it('resolves a duration-typed flag to a boolean caller default correctly', async () => {
    const flag = await manager.single('duration-flag', true);

    expect(flag.asBool()).toBe(true);
  });

  it('throws the standard "not found" error for a duration-typed flag looked up with no default at all', async () => {
    await expect(manager.single('duration-flag')).rejects.toThrow('Flag not found: duration-flag');
  });

  it('still evaluates other flags correctly when a duration-typed flag is looked up individually', async () => {
    const boolFlag = await manager.single('bool-flag', false);
    const stringFlag = await manager.single('string-flag', 'nope');
    const numberFlag = await manager.single('number-flag', 0);

    expect(boolFlag.isEnabled()).toBe(true);
    expect(stringFlag.asString()).toBe('hello');
    expect(numberFlag.asNumber()).toBe(42);
  });

  it('logs a warning (not a throw) when it encounters the unknown flag type', async () => {
    await manager.all();

    expect(logger.warn).toHaveBeenCalled();
    const warned = (logger.warn as ReturnType<typeof vi.fn>).mock.calls.some((call) =>
      String(call[0]).toLowerCase().includes('unrecognized')
    );
    expect(warned).toBe(true);
  });

  it('also tolerates a duration-typed flag when the payload comes from cache rather than a fresh API load', async () => {
    const cache = createCacheWithFlags(mixedPayloadFlags);
    const apiClient = createMockApiClient([]);
    const manager = new FlagManager(apiClient, cache, new RuleEngine(), 3600, createMockLogger());

    const allFlags = await manager.all();
    expect(allFlags.map((f) => f.getKey())).toEqual(
      expect.arrayContaining(['bool-flag', 'string-flag', 'number-flag'])
    );
    expect(allFlags.find((f) => f.getKey() === 'duration-flag')).toBeUndefined();

    const durationFlag = await manager.single('duration-flag', 'default-from-cache-path');
    expect(durationFlag.asString()).toBe('default-from-cache-path');

    // Loading from cache should mean the API was never hit
    expect(apiClient.getRules).not.toHaveBeenCalled();
  });
});
