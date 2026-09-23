import type { Logger, FlagValue, FlagType, FlagData, FlagTarget } from './types';
import type { Cache } from './cache';
import { Flag } from './flag';
import { Context } from './context';
import { ApiClient } from './api-client';
import { RuleEngine } from './rule-engine';
import { DefaultsCollection } from './defaults-collection';
import { EvaluationError } from './errors';
import { isInBucket } from './rollout';

const CACHE_KEY = 'zenmanage_rules';

/**
 * Flag types this SDK release knows how to evaluate. The API may serve
 * additional types (e.g. `json`) that a given SDK release predates — see
 * `isKnownFlagType`.
 */
const KNOWN_FLAG_TYPES: ReadonlySet<FlagType> = new Set(['boolean', 'string', 'number']);

/**
 * Narrows a flag's wire `type` to one this SDK release knows how to
 * evaluate. The API is expected to add new flag types over time (e.g.
 * `json`); an SDK release older than a given type must not throw or
 * mis-parse when it encounters one, so unrecognized types are filtered out
 * at load time rather than assumed to be one of the known variants.
 */
function isKnownFlagType(type: unknown): type is FlagType {
  return KNOWN_FLAG_TYPES.has(type as FlagType);
}

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
        // Report usage for this flag, including the effective default (inline
        // parameter, falling back to a DefaultsCollection entry) so it's recorded
        // even when the flag was found and evaluated normally
        await this.reportUsage(
          key,
          this.getUsageContext(),
          this.resolveEffectiveDefault(key, defaultValue)
        );

        return this.evaluateFlag(flag);
      }
    }

    // Priority 1: Use inline default parameter if provided
    if (defaultValue !== undefined) {
      const flagFromDefault = this.createFlagFromDefault(key, defaultValue);
      // Report usage even for default values
      await this.reportUsage(key, this.getUsageContext(), defaultValue);

      return flagFromDefault;
    }

    // Priority 2: Check DefaultsCollection
    if (this.defaults.has(key)) {
      const defaultVal = this.defaults.get(key);
      if (defaultVal !== undefined) {
        const flagFromDefault = this.createFlagFromDefault(key, defaultVal);
        // Report usage even for default values
        await this.reportUsage(key, this.getUsageContext(), defaultVal);

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
  async reportUsage(key: string, context?: Context, defaultValue?: FlagValue): Promise<void> {
    await this.apiClient.reportUsage(key, context, defaultValue);
  }

  /**
   * Resolve the default value that would be used if this flag fell back,
   * prioritizing the inline parameter over a DefaultsCollection entry.
   */
  private resolveEffectiveDefault(key: string, defaultValue?: FlagValue): FlagValue | undefined {
    if (defaultValue !== undefined) {
      return defaultValue;
    }

    return this.defaults.has(key) ? this.defaults.get(key) : undefined;
  }

  private getUsageContext(): Context | undefined {
    if (
      this.context.getType() === 'anonymous' &&
      this.context.getName() === undefined &&
      this.context.getIdentifier() === undefined &&
      this.context.getAttributes().length === 0
    ) {
      return undefined;
    }

    return this.context;
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
          this.flags = this.parseFlags(data.flags as FlagData[]);
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
   * Convert raw flag data from a rules payload into `Flag` instances,
   * skipping any flag whose `type` this SDK release doesn't recognize
   * (e.g. a `json` flag served to an older SDK). A skipped flag behaves
   * exactly like a flag that isn't in the payload at all: `all()` omits
   * it, and `single()` falls back to the caller-supplied default (or
   * throws "Flag not found" if none was given) rather than returning a
   * mis-parsed value. This keeps every other flag in the payload
   * unaffected.
   */
  private parseFlags(flagsData: FlagData[]): Flag[] {
    const flags: Flag[] = [];

    for (const flagData of flagsData) {
      // Optional chaining guards against a malformed payload entry (e.g. `null`)
      // as well as an unrecognized `type` — either way this flag is skipped
      // rather than throwing and taking the rest of the payload down with it.
      if (!isKnownFlagType(flagData?.type)) {
        this.logger.warn('Skipping flag with unrecognized type; caller default will be used', {
          key: flagData?.key,
          type: flagData?.type,
        });
        continue;
      }

      flags.push(Flag.fromObject(flagData));
    }

    return flags;
  }

  /**
   * Load rules from the API and cache them
   */
  private async loadRulesFromApi(): Promise<void> {
    this.logger.info('Fetching rules from API');

    try {
      const response = await this.apiClient.getRules();

      this.flags = this.parseFlags(response.flags);

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
   * Evaluate a flag against the current context.
   *
   * When a rollout is active, the SDK determines which target/rules pair to use
   * by bucketing the context identifier against the rollout percentage.
   */
  private evaluateFlag(flag: Flag): Flag {
    const rollout = flag.getRollout();
    let target: FlagTarget;
    let rules: import('./types').Rule[];

    if (rollout) {
      // Rollout is active — determine which target to use via bucketing
      const contextIdentifier = this.context.getIdentifier() ?? null;
      const inBucket = isInBucket(rollout.salt, contextIdentifier, rollout.percentage);

      if (inBucket) {
        // Context is in the rollout bucket — use rollout target & rules
        target = rollout.target;
        rules = rollout.rules || [];
      } else {
        // Context is outside the rollout bucket — use fallback target & rules
        target = flag.getTarget();
        rules = flag.getRules();
      }
    } else {
      // No rollout — evaluate normally
      target = flag.getTarget();
      rules = flag.getRules();
    }

    if (rules.length === 0) {
      // No rules, return a flag with the selected target
      if (target === flag.getTarget() && !rollout) {
        return flag;
      }
      return new Flag(
        flag.getVersion(),
        flag.getType(),
        flag.getKey(),
        flag.getName(),
        target,
        rules
      );
    }

    // Evaluate rules against context
    const matchedRule = this.ruleEngine.evaluate(rules, this.context);

    if (matchedRule) {
      // Create a new flag with the matched rule's value as target
      const newTarget: FlagTarget = {
        version: target.version,
        expired_at: target.expired_at,
        published_at: target.published_at,
        scheduled_at: target.scheduled_at,
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

    // No rule matched, return flag with selected target
    if (target === flag.getTarget() && !rollout) {
      return flag;
    }
    return new Flag(
      flag.getVersion(),
      flag.getType(),
      flag.getKey(),
      flag.getName(),
      target,
      rules
    );
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
