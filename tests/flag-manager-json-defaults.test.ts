import { describe, it, expect } from 'vitest';
import { FlagManager } from '../src/flag-manager';
import { RuleEngine } from '../src/rule-engine';
import { createMockLogger, createEmptyCache, createMockApiClient } from './test-utils';

/**
 * ZEN-1384: object/array default values passed to single() must be typed as
 * a json flag (so asJson() returns them unchanged), not coerced through the
 * generic 'string' fallback used for anything that isn't a boolean or number.
 */
describe('FlagManager json default values', () => {
  function setupManager() {
    const apiClient = createMockApiClient([]);
    const manager = new FlagManager(
      apiClient,
      createEmptyCache(),
      new RuleEngine(),
      3600,
      createMockLogger()
    );
    return manager;
  }

  it('types an object default as json and returns it unchanged from asJson()', async () => {
    const manager = setupManager();
    const flag = await manager.single('theme-config', { mode: 'light', accent: '#4f46e5' });

    expect(flag.getType()).toBe('json');
    expect(flag.asJson()).toEqual({ mode: 'light', accent: '#4f46e5' });
  });

  it('types an array default as json and returns it unchanged from asJson()', async () => {
    const manager = setupManager();
    const flag = await manager.single('rollout-plan', [1, 2, 3]);

    expect(flag.getType()).toBe('json');
    expect(flag.asJson()).toEqual([1, 2, 3]);
  });

  it('does not stringify an object/array default (previous "string" fallback behavior)', async () => {
    const manager = setupManager();
    const flag = await manager.single('theme-config', { mode: 'light' });

    expect(flag.asString()).toBe('');
    expect(flag.getValue()).toEqual({ mode: 'light' });
  });

  it('still types a null default through the string fallback, not json', async () => {
    const manager = setupManager();
    // null is `typeof 'object'` in JS, but isn't a valid json flag value here —
    // it must not be routed through the json branch (which requires `!== null`).
    const flag = await manager.single('nullable-flag', null as unknown as string);

    expect(flag.getType()).toBe('string');
  });
});
