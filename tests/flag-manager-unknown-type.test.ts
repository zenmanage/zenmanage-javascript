import { describe, it, expect, vi, beforeEach } from 'vitest';
import { FlagManager } from '../src/flag-manager';
import { ApiClient } from '../src/api-client';
import { RuleEngine } from '../src/rule-engine';
import type { FlagData, Logger } from '../src/types';
import type { Cache } from '../src/cache';

/**
 * ZEN-1667: the API is about to start serving a fourth flag type, `json`, in
 * addition to boolean/string/number. An old SDK release parsing a rules
 * payload that contains a json-typed flag must not throw or mis-parse — it
 * must degrade the unknown flag to the caller's default while leaving every
 * other flag in the payload unaffected.
 */

function createMockLogger(): Logger {
  return {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  };
}

function createEmptyCache(): Cache {
  const data: Record<string, string> = {};
  return {
    get: vi.fn(async (key: string) => data[key] ?? null),
    set: vi.fn(async () => {}),
    has: vi.fn(async (key: string) => key in data),
    delete: vi.fn(async () => {}),
    clear: vi.fn(async () => {}),
  };
}

function createCacheWithFlags(flags: FlagData[]): Cache {
  const data: Record<string, string> = {
    zenmanage_rules: JSON.stringify({ version: '2026-09-23', flags }),
  };

  return {
    get: vi.fn(async (key: string) => data[key] ?? null),
    set: vi.fn(async () => {}),
    has: vi.fn(async (key: string) => key in data),
    delete: vi.fn(async () => {}),
    clear: vi.fn(async () => {}),
  };
}

function buildFlag(overrides: Partial<FlagData> = {}): FlagData {
  return {
    version: 'fla_test',
    type: 'boolean',
    key: 'bool-flag',
    name: 'Bool Flag',
    target: {
      version: 'tar_test',
      expired_at: null,
      published_at: '2026-09-01T00:00:00+00:00',
      scheduled_at: null,
      value: {
        version: 'val_test',
        value: { boolean: true },
      },
    },
    rules: [],
    ...overrides,
  };
}

/**
 * A json-typed flag as the API is expected to start sending it. `type` and
 * the value wrapper key are both outside today's closed `'boolean' |
 * 'string' | 'number'` union, so this is deliberately cast through
 * `unknown` to simulate a payload an old SDK release wasn't written for.
 */
function buildJsonFlag(overrides: Record<string, unknown> = {}): FlagData {
  return {
    version: 'fla_json',
    type: 'json',
    key: 'json-flag',
    name: 'JSON Flag',
    target: {
      version: 'tar_json',
      expired_at: null,
      published_at: '2026-09-01T00:00:00+00:00',
      scheduled_at: null,
      value: {
        version: 'val_json',
        value: { json: { nested: { enabled: true }, list: [1, 2, 3] } },
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
  buildJsonFlag({ key: 'json-flag' }),
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

function createMockApiClient(flags: FlagData[]): ApiClient {
  return {
    getRules: vi.fn(async () => ({ version: '2026-09-23', flags })),
    reportUsage: vi.fn(async () => {}),
  } as unknown as ApiClient;
}

describe('FlagManager tolerance of unknown flag types (json, ZEN-1667)', () => {
  let apiClient: ApiClient;
  let logger: Logger;
  let manager: FlagManager;

  beforeEach(() => {
    apiClient = createMockApiClient(mixedPayloadFlags);
    logger = createMockLogger();
    manager = new FlagManager(apiClient, createEmptyCache(), new RuleEngine(), 3600, logger);
  });

  it('loads a payload containing a json-typed flag from the API without throwing, and leaves other flags unaffected', async () => {
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

  it('resolves a json-typed flag looked up via single() to the caller-supplied default, not a thrown error or garbage value', async () => {
    const flag = await manager.single('json-flag', 'fallback-default');

    expect(flag.asString()).toBe('fallback-default');
  });

  it('resolves a json-typed flag to a boolean caller default correctly', async () => {
    const flag = await manager.single('json-flag', true);

    expect(flag.asBool()).toBe(true);
  });

  it('throws the standard "not found" error for a json-typed flag looked up with no default at all', async () => {
    await expect(manager.single('json-flag')).rejects.toThrow('Flag not found: json-flag');
  });

  it('still evaluates other flags correctly when a json-typed flag is looked up individually', async () => {
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

  it('also tolerates a json-typed flag when the payload comes from cache rather than a fresh API load', async () => {
    const cache = createCacheWithFlags(mixedPayloadFlags);
    const apiClient = createMockApiClient([]);
    const manager = new FlagManager(apiClient, cache, new RuleEngine(), 3600, createMockLogger());

    const allFlags = await manager.all();
    expect(allFlags.map((f) => f.getKey())).toEqual(
      expect.arrayContaining(['bool-flag', 'string-flag', 'number-flag'])
    );
    expect(allFlags.find((f) => f.getKey() === 'json-flag')).toBeUndefined();

    const jsonFlag = await manager.single('json-flag', 'default-from-cache-path');
    expect(jsonFlag.asString()).toBe('default-from-cache-path');

    // Loading from cache should mean the API was never hit
    expect(apiClient.getRules).not.toHaveBeenCalled();
  });
});
