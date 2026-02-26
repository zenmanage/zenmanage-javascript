/**
 * Common types used throughout the SDK
 */

import type { Cache } from './cache/cache.interface';

/**
 * Logger interface compatible with console and popular logging libraries
 */
export interface Logger {
  debug(message: string, meta?: Record<string, unknown>): void;
  info(message: string, meta?: Record<string, unknown>): void;
  warn(message: string, meta?: Record<string, unknown>): void;
  error(message: string, meta?: Record<string, unknown>): void;
}

/**
 * Configuration options for the Zenmanage SDK
 */
export interface Config {
  /** Environment token (required) */
  environmentToken: string;
  /** Cache time-to-live in seconds (default: 3600) */
  cacheTtl?: number;
  /** Cache backend type (default: 'memory') */
  cacheBackend?: 'memory' | 'filesystem' | 'null';
  /** Cache directory for filesystem cache (required if cacheBackend is 'filesystem') */
  cacheDirectory?: string;
  /** Enable usage reporting (default: true) */
  enableUsageReporting?: boolean;
  /** API endpoint (default: 'https://api.zenmanage.com') */
  apiEndpoint?: string;
  /** Optional logger instance */
  logger?: Logger;
  /** Custom cache instance (overrides cacheBackend when provided) */
  customCache?: Cache;
}

/**
 * Flag types
 */
export type FlagType = 'boolean' | 'string' | 'number';

/**
 * Flag value union type
 */
export type FlagValue = boolean | string | number;

/**
 * Context attribute value
 */
export interface ContextValue {
  value: string;
}

/**
 * Context attribute
 */
export interface ContextAttribute {
  key: string;
  values: ContextValue[];
}

/**
 * Evaluation context for flag rules
 */
export interface ContextData {
  type: string;
  name?: string;
  identifier?: string;
  attributes?: ContextAttribute[];
}

/**
 * Rule condition
 */
export interface RuleCondition {
  attribute: string;
  operator: string;
  value?: string | string[] | RuleContextTarget | RuleContextTarget[];
}

export interface RuleContextTarget {
  identifier: string;
  type?: string | null;
}

/**
 * Rule definition
 */
export interface Rule {
  version?: string;
  description?: string;
  criteria?: RuleCondition;
  clauses?: RuleCondition[];
  position?: number;
  value: {
    version?: string;
    value: {
      boolean?: boolean;
      string?: string;
      number?: number;
    };
  };
}

/**
 * Flag target value
 */
export interface FlagTarget {
  version?: string;
  expired_at?: string | null;
  published_at?: string | null;
  scheduled_at?: string | null;
  value: {
    version?: string;
    value: {
      boolean?: boolean;
      string?: string;
      number?: number;
    };
  };
}

/**
 * Rollout data structure from API
 *
 * Present on a flag only when a percentage rollout is active.
 * Contains a separate target/rules pair and the bucketing parameters.
 */
export interface RolloutData {
  /** The rollout target — same shape as the top-level target */
  target: FlagTarget;
  /** Targeting rules specific to the rollout target */
  rules: Rule[];
  /** The rollout percentage (0–100) */
  percentage: number;
  /** Random 32-character string unique to this rollout, used as the hash seed */
  salt: string;
  /** Always "active" when present (paused/completed rollouts are omitted) */
  status: string;
}

/**
 * Flag data structure from API
 */
export interface FlagData {
  version: string;
  type: FlagType;
  key: string;
  name: string;
  target: FlagTarget;
  rules?: Rule[];
  /** Present only when a percentage rollout is active */
  rollout?: RolloutData;
}

/**
 * API response for rules
 */
export interface RulesResponse {
  version: string;
  flags: FlagData[];
}
