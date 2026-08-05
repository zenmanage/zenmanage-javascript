import { describe, it, expect, vi } from 'vitest';
import { FlagManager } from '../src/flag-manager';
import { ApiClient } from '../src/api-client';
import { RuleEngine } from '../src/rule-engine';
import { DefaultsCollection } from '../src/defaults-collection';
import type { FlagData, Logger } from '../src/types';
import type { Cache } from '../src/cache';

function createMockLogger(): Logger {
  return {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  };
}

function createEmptyCache(): Cache {
  const data: Record<string, string> = {
    zenmanage_rules: JSON.stringify({ version: '2026-02-24', flags: [] }),
  };

  return {
    get: vi.fn(async (key: string) => data[key] ?? null),
    set: vi.fn(async () => {}),
    has: vi.fn(async (key: string) => key in data),
    delete: vi.fn(async () => {}),
    clear: vi.fn(async () => {}),
  };
}

function createCacheWithFlag(flag: FlagData): Cache {
  const data: Record<string, string> = {
    zenmanage_rules: JSON.stringify({ version: '2026-02-24', flags: [flag] }),
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
    type: 'boolean',
    key: 'found-flag',
    name: 'Found Flag',
    target: {
      version: 'tar_test',
      expired_at: null,
      published_at: '2026-02-20T00:00:00+00:00',
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

describe('FlagManager default value usage reporting', () => {
  it('threads the inline default parameter through to ApiClient.reportUsage', async () => {
    const apiClient = createMockApiClient();
    const manager = new FlagManager(
      apiClient,
      createEmptyCache(),
      new RuleEngine(),
      3600,
      createMockLogger()
    );

    const flag = await manager.single('missing-flag', true);

    expect(flag.asBool()).toBe(true);
    expect(apiClient.reportUsage).toHaveBeenCalledWith('missing-flag', undefined, true);
  });

  it('threads a DefaultsCollection value through to ApiClient.reportUsage', async () => {
    const apiClient = createMockApiClient();
    const defaults = DefaultsCollection.fromObject({ 'collection-flag': 'fallback-value' });
    const manager = new FlagManager(
      apiClient,
      createEmptyCache(),
      new RuleEngine(),
      3600,
      createMockLogger()
    ).withDefaults(defaults);

    const flag = await manager.single('collection-flag');

    expect(flag.asString()).toBe('fallback-value');
    expect(apiClient.reportUsage).toHaveBeenCalledWith(
      'collection-flag',
      undefined,
      'fallback-value'
    );
  });

  it('prioritizes the inline default over a DefaultsCollection entry when reporting usage', async () => {
    const apiClient = createMockApiClient();
    const defaults = DefaultsCollection.fromObject({ 'both-flag': 'collection-value' });
    const manager = new FlagManager(
      apiClient,
      createEmptyCache(),
      new RuleEngine(),
      3600,
      createMockLogger()
    ).withDefaults(defaults);

    await manager.single('both-flag', 'inline-value');

    expect(apiClient.reportUsage).toHaveBeenCalledWith('both-flag', undefined, 'inline-value');
  });

  it('supports falsy default values (false, 0) when reporting usage', async () => {
    const apiClient = createMockApiClient();
    const manager = new FlagManager(
      apiClient,
      createEmptyCache(),
      new RuleEngine(),
      3600,
      createMockLogger()
    );

    await manager.single('bool-flag', false);
    await manager.single('num-flag', 0);

    expect(apiClient.reportUsage).toHaveBeenCalledWith('bool-flag', undefined, false);
    expect(apiClient.reportUsage).toHaveBeenCalledWith('num-flag', undefined, 0);
  });

  it('threads the caller-supplied default through to ApiClient.reportUsage when the flag is found', async () => {
    const apiClient = createMockApiClient();
    const manager = new FlagManager(
      apiClient,
      createCacheWithFlag(buildFlag()),
      new RuleEngine(),
      3600,
      createMockLogger()
    );

    const flag = await manager.single('found-flag', false);

    expect(flag.asBool()).toBe(true);
    expect(apiClient.reportUsage).toHaveBeenCalledWith('found-flag', undefined, false);
  });

  it('reports usage with no default when the flag is found and the caller passed none', async () => {
    const apiClient = createMockApiClient();
    const manager = new FlagManager(
      apiClient,
      createCacheWithFlag(buildFlag()),
      new RuleEngine(),
      3600,
      createMockLogger()
    );

    await manager.single('found-flag');

    expect(apiClient.reportUsage).toHaveBeenCalledWith('found-flag', undefined, undefined);
  });

  it('throws without reporting usage when no default is available', async () => {
    const apiClient = createMockApiClient();
    const manager = new FlagManager(
      apiClient,
      createEmptyCache(),
      new RuleEngine(),
      3600,
      createMockLogger()
    );

    await expect(manager.single('nonexistent-flag')).rejects.toThrow(
      'Flag not found: nonexistent-flag'
    );
    expect(apiClient.reportUsage).not.toHaveBeenCalled();
  });
});
