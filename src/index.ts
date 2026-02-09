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

// Cache exports
export { InMemoryCache, NullCache, FileSystemCache } from './cache';
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
  Rule,
  RuleCondition,
  RulesResponse,
} from './types';
