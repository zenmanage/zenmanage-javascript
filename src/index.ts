/**
 * Zenmanage JavaScript SDK
 * Feature flags for JavaScript and TypeScript - works in Node.js and browsers
 */

export { Zenmanage } from './zenmanage';
export { ConfigBuilder } from './config';
export { Context, Attribute, Value } from './context';
export { Flag } from './flag';
export { DefaultsCollection } from './defaults-collection';
export { FlagManager } from './flag-manager';
export { isInBucket, crc32b } from './rollout';

// Cache exports
export { InMemoryCache, NullCache } from './cache';
export type { Cache } from './cache';

// Error exports
export {
  ZenmanageError,
  ConfigurationError,
  EvaluationError,
  FetchRulesError,
  InvalidRulesError,
} from './errors';

// Type exports
export type {
  Config,
  Logger,
  FlagType,
  FlagValue,
  ContextData,
  ContextAttribute,
  ContextValue,
  FlagData,
  RolloutData,
  Rule,
  RuleCondition,
  RulesResponse,
} from './types';
