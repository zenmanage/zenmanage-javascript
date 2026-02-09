/**
 * Common types used throughout the SDK
 */

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
  value?: string | string[];
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
 * Flag data structure from API
 */
export interface FlagData {
  version: string;
  type: FlagType;
  key: string;
  name: string;
  target: FlagTarget;
  rules?: Rule[];
}

/**
 * API response for rules
 */
export interface RulesResponse {
  version: string;
  flags: FlagData[];
}
