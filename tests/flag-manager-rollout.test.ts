import { describe, it, expect, vi, beforeEach } from 'vitest';
import { FlagManager } from '../src/flag-manager';
import { Flag } from '../src/flag';
import { Context, Attribute } from '../src/context';
import { RuleEngine } from '../src/rule-engine';
import { DefaultsCollection } from '../src/defaults-collection';
import type { FlagData, RolloutData, Logger } from '../src/types';
import type { Cache } from '../src/cache';

/**
 * Helper to create a mock logger that suppresses output
 */
function createMockLogger(): Logger {
  return {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  };
}

/**
 * Helper to create a mock cache pre-loaded with flags
 */
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

/**
 * Helper to create a mock API client
 */
function createMockApiClient() {
  return {
    getRules: vi.fn(async () => ({ version: '2026-02-24', flags: [] })),
    reportUsage: vi.fn(async () => {}),
  } as any;
}

/**
 * Helper to build a standard flag without rollout
 */
function buildFlag(overrides: Partial<FlagData> = {}): FlagData {
  return {
    version: 'fla_test',
    type: 'boolean',
    key: 'test-flag',
    name: 'Test Flag',
    target: {
      version: 'tar_fallback',
      expired_at: null,
      published_at: '2026-02-20T00:00:00+00:00',
      scheduled_at: null,
      value: {
        version: 'val_fallback',
        value: { boolean: false },
      },
    },
    rules: [],
    ...overrides,
  };
}

/**
 * Helper to build a rollout object
 */
function buildRollout(overrides: Partial<RolloutData> = {}): RolloutData {
  return {
    target: {
      version: 'tar_rollout',
      expired_at: null,
      published_at: '2026-02-24T00:00:00+00:00',
      scheduled_at: null,
      value: {
        version: 'val_rollout',
        value: { boolean: true },
      },
    },
    rules: [],
    percentage: 50,
    salt: 'test-salt',
    status: 'active',
    ...overrides,
  };
}

describe('FlagManager with rollouts', () => {
  let ruleEngine: RuleEngine;
  let logger: Logger;

  beforeEach(() => {
    ruleEngine = new RuleEngine();
    logger = createMockLogger();
  });

  describe('flag without rollout', () => {
    it('should evaluate normally when no rollout is present', async () => {
      const flagData = buildFlag({ key: 'no-rollout' });
      const cache = createMockCache([flagData]);
      const apiClient = createMockApiClient();
      const manager = new FlagManager(apiClient, cache, ruleEngine, 3600, logger);

      const flag = await manager.single('no-rollout');
      expect(flag.asBool()).toBe(false);
    });

    it('should evaluate rules normally when no rollout is present', async () => {
      const flagData = buildFlag({
        key: 'rules-no-rollout',
        rules: [
          {
            clauses: [{ attribute: 'country', operator: 'equals', value: 'US' }],
            value: { value: { boolean: true } },
          },
        ],
      });
      const cache = createMockCache([flagData]);
      const apiClient = createMockApiClient();
      const manager = new FlagManager(apiClient, cache, ruleEngine, 3600, logger);

      const context = new Context('user', undefined, 'user-1');
      context.addAttribute(new Attribute('country', ['US']));

      const flag = await manager.withContext(context).single('rules-no-rollout');
      expect(flag.asBool()).toBe(true);
    });
  });

  describe('flag with active rollout', () => {
    it('should serve rollout value when context is in bucket', async () => {
      // test-salt + user-0 => bucket 34 => 34 < 50, so IN bucket
      const flagData = buildFlag({
        key: 'rollout-flag',
        rollout: buildRollout({ salt: 'test-salt', percentage: 50 }),
      });
      const cache = createMockCache([flagData]);
      const apiClient = createMockApiClient();
      const manager = new FlagManager(apiClient, cache, ruleEngine, 3600, logger);

      const context = Context.single('user', 'user-0');
      const flag = await manager.withContext(context).single('rollout-flag');

      // Should get the rollout value (true), not the fallback (false)
      expect(flag.asBool()).toBe(true);
    });

    it('should serve fallback value when context is outside bucket', async () => {
      // test-salt + user-2 => bucket 98 => 98 < 50 is false, so NOT in bucket
      const flagData = buildFlag({
        key: 'rollout-flag',
        rollout: buildRollout({ salt: 'test-salt', percentage: 50 }),
      });
      const cache = createMockCache([flagData]);
      const apiClient = createMockApiClient();
      const manager = new FlagManager(apiClient, cache, ruleEngine, 3600, logger);

      const context = Context.single('user', 'user-2');
      const flag = await manager.withContext(context).single('rollout-flag');

      // Should get the fallback value (false)
      expect(flag.asBool()).toBe(false);
    });

    it('should serve fallback when no context identifier is provided', async () => {
      // No identifier => isInBucket returns false => fallback
      const flagData = buildFlag({
        key: 'rollout-flag',
        rollout: buildRollout({ percentage: 100 }),
      });
      const cache = createMockCache([flagData]);
      const apiClient = createMockApiClient();
      const manager = new FlagManager(apiClient, cache, ruleEngine, 3600, logger);

      // Anonymous context without identifier
      const context = new Context('anonymous');
      const flag = await manager.withContext(context).single('rollout-flag');

      // Even at 100%, null identifier => fallback
      expect(flag.asBool()).toBe(false);
    });

    it('should serve rollout value to all contexts at 100%', async () => {
      const flagData = buildFlag({
        key: 'full-rollout',
        rollout: buildRollout({ salt: 'any-salt', percentage: 100 }),
      });
      const cache = createMockCache([flagData]);
      const apiClient = createMockApiClient();
      const manager = new FlagManager(apiClient, cache, ruleEngine, 3600, logger);

      // Any user with an identifier should be in bucket at 100%
      for (const id of ['user-1', 'user-2', 'user-3', 'something-else']) {
        const context = Context.single('user', id);
        const flag = await manager.withContext(context).single('full-rollout');
        expect(flag.asBool()).toBe(true);
      }
    });

    it('should serve fallback value to all contexts at 0%', async () => {
      const flagData = buildFlag({
        key: 'zero-rollout',
        rollout: buildRollout({ salt: 'any-salt', percentage: 0 }),
      });
      const cache = createMockCache([flagData]);
      const apiClient = createMockApiClient();
      const manager = new FlagManager(apiClient, cache, ruleEngine, 3600, logger);

      for (const id of ['user-1', 'user-2', 'user-3']) {
        const context = Context.single('user', id);
        const flag = await manager.withContext(context).single('zero-rollout');
        expect(flag.asBool()).toBe(false);
      }
    });
  });

  describe('rollout with rules', () => {
    it('should evaluate rollout rules when context is in bucket', async () => {
      // test-salt + user-0 => bucket 34, in bucket at 50%
      const flagData = buildFlag({
        key: 'rollout-rules',
        target: {
          version: 'tar_fallback',
          value: { value: { string: 'fallback-value' } },
        },
        type: 'string',
        rules: [
          // Fallback rules — should NOT be used when in rollout bucket
          {
            clauses: [{ attribute: 'country', operator: 'equals', value: 'US' }],
            value: { value: { string: 'fallback-rule-match' } },
          },
        ],
        rollout: {
          target: {
            version: 'tar_rollout',
            value: { value: { string: 'rollout-value' } },
          },
          rules: [
            {
              clauses: [{ attribute: 'country', operator: 'equals', value: 'US' }],
              value: { value: { string: 'rollout-rule-match' } },
            },
          ],
          percentage: 50,
          salt: 'test-salt',
          status: 'active',
        },
      });
      const cache = createMockCache([flagData]);
      const apiClient = createMockApiClient();
      const manager = new FlagManager(apiClient, cache, ruleEngine, 3600, logger);

      const context = Context.single('user', 'user-0'); // in bucket (34 < 50)
      context.addAttribute(new Attribute('country', ['US']));

      const flag = await manager.withContext(context).single('rollout-rules');
      // Should match rollout rule, not fallback rule
      expect(flag.asString()).toBe('rollout-rule-match');
    });

    it('should evaluate fallback rules when context is outside bucket', async () => {
      // test-salt + user-2 => bucket 98, NOT in bucket at 50%
      const flagData = buildFlag({
        key: 'rollout-rules',
        target: {
          version: 'tar_fallback',
          value: { value: { string: 'fallback-value' } },
        },
        type: 'string',
        rules: [
          {
            clauses: [{ attribute: 'country', operator: 'equals', value: 'US' }],
            value: { value: { string: 'fallback-rule-match' } },
          },
        ],
        rollout: {
          target: {
            version: 'tar_rollout',
            value: { value: { string: 'rollout-value' } },
          },
          rules: [
            {
              clauses: [{ attribute: 'country', operator: 'equals', value: 'US' }],
              value: { value: { string: 'rollout-rule-match' } },
            },
          ],
          percentage: 50,
          salt: 'test-salt',
          status: 'active',
        },
      });
      const cache = createMockCache([flagData]);
      const apiClient = createMockApiClient();
      const manager = new FlagManager(apiClient, cache, ruleEngine, 3600, logger);

      const context = Context.single('user', 'user-2'); // outside bucket (98 >= 50)
      context.addAttribute(new Attribute('country', ['US']));

      const flag = await manager.withContext(context).single('rollout-rules');
      // Should match fallback rule, not rollout rule
      expect(flag.asString()).toBe('fallback-rule-match');
    });

    it('should use rollout target when in bucket but no rollout rules match', async () => {
      // test-salt + user-0 => bucket 34, in bucket at 50%
      const flagData = buildFlag({
        key: 'rollout-no-rule-match',
        target: {
          version: 'tar_fallback',
          value: { value: { string: 'fallback-value' } },
        },
        type: 'string',
        rollout: {
          target: {
            version: 'tar_rollout',
            value: { value: { string: 'rollout-value' } },
          },
          rules: [
            {
              clauses: [{ attribute: 'country', operator: 'equals', value: 'JP' }],
              value: { value: { string: 'rollout-rule-match' } },
            },
          ],
          percentage: 50,
          salt: 'test-salt',
          status: 'active',
        },
      });
      const cache = createMockCache([flagData]);
      const apiClient = createMockApiClient();
      const manager = new FlagManager(apiClient, cache, ruleEngine, 3600, logger);

      const context = Context.single('user', 'user-0');
      context.addAttribute(new Attribute('country', ['US'])); // Won't match JP rule

      const flag = await manager.withContext(context).single('rollout-no-rule-match');
      // No rollout rule matched, so use rollout target value
      expect(flag.asString()).toBe('rollout-value');
    });

    it('should use fallback target when outside bucket and no fallback rules match', async () => {
      // test-salt + user-2 => bucket 98, NOT in bucket at 50%
      const flagData = buildFlag({
        key: 'fallback-no-rule-match',
        target: {
          version: 'tar_fallback',
          value: { value: { string: 'fallback-value' } },
        },
        type: 'string',
        rules: [
          {
            clauses: [{ attribute: 'country', operator: 'equals', value: 'JP' }],
            value: { value: { string: 'fallback-rule-match' } },
          },
        ],
        rollout: {
          target: {
            version: 'tar_rollout',
            value: { value: { string: 'rollout-value' } },
          },
          rules: [],
          percentage: 50,
          salt: 'test-salt',
          status: 'active',
        },
      });
      const cache = createMockCache([flagData]);
      const apiClient = createMockApiClient();
      const manager = new FlagManager(apiClient, cache, ruleEngine, 3600, logger);

      const context = Context.single('user', 'user-2');
      context.addAttribute(new Attribute('country', ['US'])); // Won't match JP rule

      const flag = await manager.withContext(context).single('fallback-no-rule-match');
      // No fallback rule matched, so use fallback target value
      expect(flag.asString()).toBe('fallback-value');
    });
  });

  describe('rollout with different flag types', () => {
    it('should handle string flag rollouts', async () => {
      const flagData = buildFlag({
        key: 'string-rollout',
        type: 'string',
        target: {
          version: 'tar_fallback',
          value: { value: { string: 'old-variant' } },
        },
        rollout: {
          target: {
            version: 'tar_rollout',
            value: { value: { string: 'new-variant' } },
          },
          rules: [],
          percentage: 50,
          salt: 'test-salt',
          status: 'active',
        },
      });
      const cache = createMockCache([flagData]);
      const apiClient = createMockApiClient();
      const manager = new FlagManager(apiClient, cache, ruleEngine, 3600, logger);

      // user-0 => bucket 34 => in bucket
      const inCtx = Context.single('user', 'user-0');
      const inFlag = await manager.withContext(inCtx).single('string-rollout');
      expect(inFlag.asString()).toBe('new-variant');

      // user-2 => bucket 98 => out of bucket
      const outCtx = Context.single('user', 'user-2');
      const outFlag = await manager.withContext(outCtx).single('string-rollout');
      expect(outFlag.asString()).toBe('old-variant');
    });

    it('should handle number flag rollouts', async () => {
      const flagData = buildFlag({
        key: 'number-rollout',
        type: 'number',
        target: {
          version: 'tar_fallback',
          value: { value: { number: 1 } },
        },
        rollout: {
          target: {
            version: 'tar_rollout',
            value: { value: { number: 2 } },
          },
          rules: [],
          percentage: 50,
          salt: 'test-salt',
          status: 'active',
        },
      });
      const cache = createMockCache([flagData]);
      const apiClient = createMockApiClient();
      const manager = new FlagManager(apiClient, cache, ruleEngine, 3600, logger);

      // user-0 => bucket 34 => in bucket
      const inCtx = Context.single('user', 'user-0');
      const inFlag = await manager.withContext(inCtx).single('number-rollout');
      expect(inFlag.asNumber()).toBe(2);

      // user-2 => bucket 98 => out of bucket
      const outCtx = Context.single('user', 'user-2');
      const outFlag = await manager.withContext(outCtx).single('number-rollout');
      expect(outFlag.asNumber()).toBe(1);
    });
  });

  describe('all() with rollouts', () => {
    it('should evaluate rollouts for all flags', async () => {
      const flags = [
        buildFlag({
          key: 'flag-with-rollout',
          rollout: buildRollout({ salt: 'test-salt', percentage: 50 }),
        }),
        buildFlag({
          key: 'flag-without-rollout',
          target: {
            version: 'tar_normal',
            value: { value: { boolean: true } },
          },
        }),
      ];
      const cache = createMockCache(flags);
      const apiClient = createMockApiClient();
      const manager = new FlagManager(apiClient, cache, ruleEngine, 3600, logger);

      // user-0 => bucket 34 => in bucket at 50%
      const context = Context.single('user', 'user-0');
      const allFlags = await manager.withContext(context).all();

      expect(allFlags).toHaveLength(2);

      const rolloutFlag = allFlags.find((f) => f.getKey() === 'flag-with-rollout');
      const normalFlag = allFlags.find((f) => f.getKey() === 'flag-without-rollout');

      expect(rolloutFlag?.asBool()).toBe(true); // rollout value
      expect(normalFlag?.asBool()).toBe(true); // normal target
    });
  });

  describe('rollout data preserved through serialization', () => {
    it('should preserve rollout in Flag.fromObject and toJSON', () => {
      const flagData = buildFlag({
        key: 'serialized-rollout',
        rollout: buildRollout(),
      });

      const flag = Flag.fromObject(flagData);
      expect(flag.getRollout()).toBeDefined();
      expect(flag.getRollout()?.percentage).toBe(50);
      expect(flag.getRollout()?.salt).toBe('test-salt');
      expect(flag.getRollout()?.status).toBe('active');

      const json = flag.toJSON();
      expect(json.rollout).toBeDefined();
      expect(json.rollout?.percentage).toBe(50);
      expect(json.rollout?.salt).toBe('test-salt');
    });

    it('should not include rollout in toJSON when not present', () => {
      const flagData = buildFlag({ key: 'no-rollout' });
      const flag = Flag.fromObject(flagData);
      const json = flag.toJSON();
      expect(json.rollout).toBeUndefined();
    });

    it('should correctly load flags with rollouts from cache', async () => {
      const flagData = buildFlag({
        key: 'cached-rollout',
        rollout: buildRollout({ salt: 'test-salt', percentage: 50 }),
      });
      const cache = createMockCache([flagData]);
      const apiClient = createMockApiClient();
      const manager = new FlagManager(apiClient, cache, ruleEngine, 3600, logger);

      // Ensure flags are loaded from cache
      const context = Context.single('user', 'user-0'); // bucket 34, in bucket
      const flag = await manager.withContext(context).single('cached-rollout');
      expect(flag.asBool()).toBe(true); // rollout value
    });
  });

  describe('edge cases', () => {
    it('should handle rollout with empty rules array', async () => {
      const flagData = buildFlag({
        key: 'empty-rules-rollout',
        rules: [],
        rollout: buildRollout({ salt: 'test-salt', percentage: 50, rules: [] }),
      });
      const cache = createMockCache([flagData]);
      const apiClient = createMockApiClient();
      const manager = new FlagManager(apiClient, cache, ruleEngine, 3600, logger);

      const context = Context.single('user', 'user-0'); // in bucket
      const flag = await manager.withContext(context).single('empty-rules-rollout');
      expect(flag.asBool()).toBe(true); // rollout target
    });

    it('should handle context with identifier but no type', async () => {
      const flagData = buildFlag({
        key: 'ctx-no-type',
        rollout: buildRollout({ salt: 'test-salt', percentage: 50 }),
      });
      const cache = createMockCache([flagData]);
      const apiClient = createMockApiClient();
      const manager = new FlagManager(apiClient, cache, ruleEngine, 3600, logger);

      // Context has an identifier but we test the bucketing still works
      const context = new Context('user', undefined, 'user-0');
      const flag = await manager.withContext(context).single('ctx-no-type');
      expect(flag.asBool()).toBe(true); // user-0 bucket 34 < 50
    });

    it('should handle multiple flags with different rollout configs', async () => {
      const flags = [
        buildFlag({
          key: 'flag-a',
          rollout: buildRollout({ salt: 'salt-a', percentage: 10 }),
        }),
        buildFlag({
          key: 'flag-b',
          rollout: buildRollout({ salt: 'salt-b', percentage: 90 }),
        }),
      ];
      const cache = createMockCache(flags);
      const apiClient = createMockApiClient();
      const manager = new FlagManager(apiClient, cache, ruleEngine, 3600, logger);

      const context = Context.single('user', 'test-user');
      const allFlags = await manager.withContext(context).all();

      // Each flag should be evaluated independently with its own salt
      expect(allFlags).toHaveLength(2);
    });

    it('should use the default anonymous context (no identifier) when no context is set', async () => {
      const flagData = buildFlag({
        key: 'default-context',
        rollout: buildRollout({ salt: 'test-salt', percentage: 100 }),
      });
      const cache = createMockCache([flagData]);
      const apiClient = createMockApiClient();
      const manager = new FlagManager(apiClient, cache, ruleEngine, 3600, logger);

      // Default context is anonymous with no identifier
      const flag = await manager.single('default-context');
      // Even at 100%, null identifier => fallback
      expect(flag.asBool()).toBe(false);
    });
  });
});
