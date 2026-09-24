import { vi } from 'vitest';
import type { ApiClient } from '../src/api-client';
import type { Cache } from '../src/cache';
import type { FlagData, Logger } from '../src/types';

/**
 * Mock logger that suppresses output while recording calls for assertions.
 */
export function createMockLogger(): Logger {
  return {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  };
}

/**
 * Cache with no stored entries. Reads miss, so FlagManager falls through to the API.
 */
export function createEmptyCache(): Cache {
  const data: Record<string, string> = {};
  return {
    get: vi.fn(async (key: string) => data[key] ?? null),
    set: vi.fn(async () => {}),
    has: vi.fn(async (key: string) => key in data),
    delete: vi.fn(async () => {}),
    clear: vi.fn(async () => {}),
  };
}

/**
 * Cache pre-loaded with the given flags under the rules cache key, as FlagManager reads it.
 */
export function createCacheWithFlags(flags: FlagData[]): Cache {
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

export function createCacheWithFlag(flag: FlagData): Cache {
  return createCacheWithFlags([flag]);
}

/**
 * Mock ApiClient whose getRules() resolves to the given flags (empty by default).
 */
export function createMockApiClient(flags: FlagData[] = []): ApiClient {
  return {
    getRules: vi.fn(async () => ({ version: '2026-02-24', flags })),
    reportUsage: vi.fn(async () => {}),
  } as unknown as ApiClient;
}

export function buildFlag(overrides: Partial<FlagData> = {}): FlagData {
  return {
    version: 'fla_test',
    type: 'boolean',
    key: 'test-flag',
    name: 'Test Flag',
    target: {
      version: 'tar_test',
      expired_at: null,
      published_at: '2026-02-20T00:00:00+00:00',
      scheduled_at: null,
      value: {
        version: 'val_test',
        value: { boolean: false },
      },
    },
    rules: [],
    ...overrides,
  };
}
