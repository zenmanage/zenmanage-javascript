import type { Logger, FlagValue, FlagType, FlagData, FlagTarget } from './types';
import type { Cache } from './cache';
import { Flag } from './flag';
import { Context } from './context';
import { ApiClient } from './api-client';
import { RuleEngine } from './rule-engine';
import { DefaultsCollection } from './defaults-collection';
import { EvaluationError } from './errors';

const CACHE_KEY = 'zenmanage_rules';

/**
 * Main flag manager that orchestrates fetching, caching, and evaluating flags
 */
export class FlagManager {
  private flags: Flag[] | null = null;
  private context: Context;
  private defaults: DefaultsCollection;

  constructor(
    private readonly apiClient: ApiClient,
    private readonly cache: Cache,
    private readonly ruleEngine: RuleEngine,
    private readonly cacheTtl: number,
    private readonly logger: Logger
  ) {
    this.context = new Context('anonymous');
    this.defaults = new DefaultsCollection();
  }

  /**
   * Get all flags evaluated against the current context
   */
  async all(): Promise<Flag[]> {
    await this.ensureRulesLoaded();

    const flags = this.flags || [];
    return flags.map((flag) => this.evaluateFlag(flag));
  }

  /**
   * Get a single flag by key
   */
  async single(key: string, defaultValue?: FlagValue): Promise<Flag> {
    await this.ensureRulesLoaded();

    for (const flag of this.flags || []) {
      if (flag.getKey() === key) {
        // Report usage for this flag
        await this.reportUsage(key, this.context);

        return this.evaluateFlag(flag);
      }
    }

    // Priority 1: Use inline default parameter if provided
    if (defaultValue !== undefined) {
      const flagFromDefault = this.createFlagFromDefault(key, defaultValue);
      // Report usage even for default values
      await this.reportUsage(key, this.context);

      return flagFromDefault;
    }

    // Priority 2: Check DefaultsCollection
    if (this.defaults.has(key)) {
      const defaultVal = this.defaults.get(key);
      if (defaultVal !== undefined) {
        const flagFromDefault = this.createFlagFromDefault(key, defaultVal);
        // Report usage even for default values
        await this.reportUsage(key, this.context);

        return flagFromDefault;
      }
    }

    throw new EvaluationError(`Flag not found: ${key}`);
  }

  /**
   * Create a new FlagManager instance with a different context
   */
  withContext(context: Context): FlagManager {
    const clone = Object.create(Object.getPrototypeOf(this));
    Object.assign(clone, this);
    clone.context = context;
    return clone;
  }

  /**
   * Create a new FlagManager instance with default values
   */
  withDefaults(defaults: DefaultsCollection): FlagManager {
    const clone = Object.create(Object.getPrototypeOf(this));
    Object.assign(clone, this);
    clone.defaults = defaults;
    return clone;
  }

  /**
   * Report flag usage to the API
   */
  async reportUsage(key: string, context?: Context): Promise<void> {
    await this.apiClient.reportUsage(key, context);
  }

  /**
   * Force refresh rules from the API
   */
  async refreshRules(): Promise<void> {
    this.logger.info('Refreshing rules from API');
    await this.loadRulesFromApi();
  }

  /**
   * Ensure rules are loaded (from cache or API)
   */
  private async ensureRulesLoaded(): Promise<void> {
    if (this.flags !== null) {
      return;
    }

    // Try to load from cache first
    const cached = await this.cache.get(CACHE_KEY);

    if (cached !== null) {
      this.logger.debug('Loading rules from cache');

      try {
        const data = JSON.parse(cached);

        if (data && Array.isArray(data.flags)) {
          this.flags = data.flags.map((flagData: unknown) => Flag.fromObject(flagData as FlagData));
          return;
        }
      } catch (error) {
        this.logger.warn('Failed to parse cached rules', {
          error: (error as Error).message,
        });
      }
    }

    // Load from API
    await this.loadRulesFromApi();
  }

  /**
   * Load rules from the API and cache them
   */
  private async loadRulesFromApi(): Promise<void> {
    this.logger.info('Fetching rules from API');

    try {
      const response = await this.apiClient.getRules();

      this.flags = response.flags.map((flagData) => Flag.fromObject(flagData));

      // Cache the response
      await this.cache.set(CACHE_KEY, JSON.stringify(response), this.cacheTtl);

      this.logger.info('Rules loaded and cached', {
        count: this.flags.length,
      });
    } catch (error) {
      this.logger.error('Failed to load rules from API', {
        error: (error as Error).message,
      });

      // If we fail to load rules, use empty array
      this.flags = [];
      throw error;
    }
  }

  /**
   * Evaluate a flag against the current context
   */
  private evaluateFlag(flag: Flag): Flag {
    const rules = flag.getRules();

    if (rules.length === 0) {
      // No rules, return the flag as-is
      return flag;
    }

    // Evaluate rules against context
    const matchedRule = this.ruleEngine.evaluate(rules, this.context);

    if (matchedRule) {
      // Create a new flag with the matched rule's value as target
      const newTarget: FlagTarget = {
        version: flag.getTarget().version,
        expired_at: flag.getTarget().expired_at,
        published_at: flag.getTarget().published_at,
        scheduled_at: flag.getTarget().scheduled_at,
        value: matchedRule.value,
      };

      return new Flag(
        flag.getVersion(),
        flag.getType(),
        flag.getKey(),
        flag.getName(),
        newTarget,
        rules
      );
    }

    // No rule matched, return original flag
    return flag;
  }

  /**
   * Create a flag from a default value
   */
  private createFlagFromDefault(key: string, defaultValue: FlagValue): Flag {
    let type: FlagType;
    let target: FlagTarget;

    if (typeof defaultValue === 'boolean') {
      type = 'boolean';
      target = { value: { value: { boolean: defaultValue } } };
    } else if (typeof defaultValue === 'number') {
      type = 'number';
      target = { value: { value: { number: defaultValue } } };
    } else {
      type = 'string';
      target = { value: { value: { string: String(defaultValue) } } };
    }

    return new Flag('1', type, key, key, target, []);
  }
}
