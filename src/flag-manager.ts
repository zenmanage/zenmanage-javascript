import type { Logger, FlagValue, FlagType, FlagData, FlagTarget, Rule } from './types';
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
 * How long to wait before trying again after rules fail to (re)load. Reading
 * the rules retries the API with backoff, so without this pause a down API
 * would make every flag evaluation pay for a full retry cycle. Capped by
 * `cacheTtl` for managers configured with a shorter TTL.
 */
const RELOAD_RETRY_SECONDS = 30;

/**
 * Flag types this SDK release knows how to evaluate. The API may serve
 * additional types that a given SDK release predates — see
 * `isKnownFlagType`.
 */
const KNOWN_FLAG_TYPES: ReadonlySet<FlagType> = new Set(['boolean', 'string', 'number', 'json']);

/**
 * Narrows a flag's wire `type` to one this SDK release knows how to
 * evaluate. The API is expected to add new flag types over time; an SDK
 * release older than a given type must not throw or mis-parse when it
 * encounters one, so unrecognized types are filtered out at load time
 * rather than assumed to be one of the known variants.
 */
function isKnownFlagType(type: unknown): type is FlagType {
  return KNOWN_FLAG_TYPES.has(type as FlagType);
}

/**
 * Main flag manager that orchestrates fetching, caching, and evaluating flags
 */
export class FlagManager {
  private flags: Flag[] | null = null;
  private flagsByKey: Map<string, Flag> | null = null;
  /** Epoch ms after which the in-memory rules are re-read from the cache, then the API. */
  private rulesExpireAt = 0;
  /** The reload in progress on this instance, so concurrent callers share it. */
  private reloading: Promise<void> | null = null;
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
    await this.loadFlagsOrFallBackToDefaults();

    const flags = this.flags || [];
    return flags.map((flag) => this.evaluateFlag(flag));
  }

  /**
   * Get a single flag by key
   */
  async single(key: string, defaultValue?: FlagValue): Promise<Flag> {
    await this.loadFlagsOrFallBackToDefaults();

    const flag = this.flagsByKey?.get(key);

    if (flag) {
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
    const clone = this.copy();
    clone.context = context;
    return clone;
  }

  /**
   * Create a new FlagManager instance with default values
   */
  withDefaults(defaults: DefaultsCollection): FlagManager {
    const clone = this.copy();
    clone.defaults = defaults;
    return clone;
  }

  /**
   * Copy this manager, including the rules it has already loaded and when
   * they expire, so a clone follows the same TTL as its source instead of
   * holding a snapshot forever. A reload in progress belongs to the source
   * only: the clone starts without one and loads for itself if it needs to.
   */
  private copy(): FlagManager {
    const clone = Object.create(Object.getPrototypeOf(this));
    Object.assign(clone, this);
    clone.reloading = null;
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

    try {
      await this.loadRulesFromApi();
    } catch (error) {
      // An explicit refresh that fails must not leave the old rules queryable
      this.discardRules();
      this.retryReloadSoon();
      throw error;
    }
  }

  /**
   * Ensure rules are loaded, falling back to an empty flag set (so callers fall
   * through to their own default handling) if rule-loading fails outright —
   * e.g. an unreachable API or an invalid/misconfigured environment token.
   *
   * Used by all()/single() so a client that can't resolve its environment still
   * serves caller-supplied defaults instead of throwing. refreshRules() calls
   * loadRulesFromApi() directly and is unaffected, since an explicit refresh
   * should surface its own failure to the caller.
   */
  private async loadFlagsOrFallBackToDefaults(): Promise<void> {
    try {
      await this.ensureRulesLoaded();
    } catch (error) {
      this.logger.warn('Failed to load rules, falling back to configured defaults', {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Ensure rules are loaded and still within `cacheTtl`. Rules already in
   * memory are used as-is until they expire, with no cache or API read per
   * evaluation; after that they are re-read from the cache, then the API.
   * Callers that arrive while a reload is running share it.
   */
  private async ensureRulesLoaded(): Promise<void> {
    if (this.flags !== null && Date.now() <= this.rulesExpireAt) {
      return;
    }

    if (this.reloading === null) {
      this.reloading = this.reloadRules().finally(() => {
        this.reloading = null;
      });
    }

    await this.reloading;
  }

  /**
   * Load rules from the cache, falling back to the API. If that fails, keep
   * any rules already in memory (a blip in the API shouldn't turn every flag
   * into its default) and wait a short while before trying again.
   */
  private async reloadRules(): Promise<void> {
    try {
      if (await this.loadRulesFromCache()) {
        return;
      }

      await this.loadRulesFromApi();
    } catch (error) {
      if (this.flags === null) {
        this.discardRules();
      }

      this.retryReloadSoon();
      throw error;
    }
  }

  /**
   * Load rules from the cache. Returns false if there is nothing usable
   * there, so the caller goes on to the API.
   */
  private async loadRulesFromCache(): Promise<boolean> {
    const cached = await this.cache.get(CACHE_KEY);

    if (cached === null) {
      return false;
    }

    this.logger.debug('Loading rules from cache');

    try {
      const data = JSON.parse(cached);

      if (data && Array.isArray(data.flags)) {
        this.useRules(data.flags as FlagData[]);
        this.startTtl();
        return true;
      }
    } catch (error) {
      this.logger.warn('Failed to parse cached rules', {
        error: (error as Error).message,
      });
    }

    return false;
  }

  /**
   * Make these the rules in memory. Assigns `flags` and `flagsByKey` together
   * so the two can never fall out of sync.
   */
  private useRules(flagsData: FlagData[]): void {
    const parsed = this.parseFlags(flagsData);
    this.flags = parsed.flags;
    this.flagsByKey = parsed.flagsByKey;
  }

  /**
   * Start the `cacheTtl` for the rules in memory. Called after the cache
   * write when the rules came from the API, so the rules in memory outlast
   * the cache entry holding them: by the time they expire, so has the entry,
   * and the reload reaches the API instead of re-reading its own entry.
   */
  private startTtl(): void {
    this.rulesExpireAt = Date.now() + this.cacheTtl * 1000;
  }

  /**
   * Drop the rules in memory so every lookup falls through to the caller's
   * defaults.
   */
  private discardRules(): void {
    this.flags = [];
    this.flagsByKey = new Map();
  }

  /**
   * After a failed load, keep what is in memory for a short while rather
   * than trying again on the very next evaluation.
   */
  private retryReloadSoon(): void {
    this.rulesExpireAt = Date.now() + Math.min(RELOAD_RETRY_SECONDS, this.cacheTtl) * 1000;
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
   *
   * Also builds the `flagsByKey` index used by `single()`, keeping
   * first-match-wins semantics on duplicate keys to match the previous
   * linear-scan behavior. Returns both rather than assigning `flagsByKey`
   * as a side effect, so the caller assigns `this.flags`/`this.flagsByKey`
   * together and the two can never fall out of sync.
   */
  private parseFlags(flagsData: FlagData[]): { flags: Flag[]; flagsByKey: Map<string, Flag> } {
    const flags: Flag[] = [];
    const flagsByKey = new Map<string, Flag>();

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

      const flag = Flag.fromObject(flagData);
      flags.push(flag);

      if (!flagsByKey.has(flag.getKey())) {
        flagsByKey.set(flag.getKey(), flag);
      }
    }

    return { flags, flagsByKey };
  }

  /**
   * Load rules from the API and cache them. If the fetch fails, the rules in
   * memory are left as they were and the caller decides what that means.
   */
  private async loadRulesFromApi(): Promise<void> {
    this.logger.info('Fetching rules from API');

    try {
      const response = await this.apiClient.getRules();
      this.useRules(response.flags);

      // Cache the response. The rules are already in hand, so a cache that
      // can't be written to is not a failed load: the next reload just goes
      // to the API again.
      try {
        await this.cache.set(CACHE_KEY, JSON.stringify(response), this.cacheTtl);
      } catch (error) {
        this.logger.warn('Failed to cache rules', {
          error: (error as Error).message,
        });
      }

      this.startTtl();

      this.logger.info('Rules loaded and cached', {
        count: this.flags?.length,
      });
    } catch (error) {
      this.logger.error('Failed to load rules from API', {
        error: (error as Error).message,
      });

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
    let target: FlagTarget = flag.getTarget();
    let rules: Rule[] = flag.getRules();

    if (rollout) {
      // Rollout is active — determine which target to use via bucketing
      const contextIdentifier = this.context.getIdentifier() ?? null;
      const inBucket = isInBucket(rollout.salt, contextIdentifier, rollout.percentage);

      if (inBucket) {
        // Context is in the rollout bucket — use rollout target & rules
        target = rollout.target;
        rules = rollout.rules || [];
      }
      // Otherwise keep the fallback target & rules already selected above
    }

    if (rules.length > 0) {
      // Evaluate rules against context
      const matchedRule = this.ruleEngine.evaluate(rules, this.context);

      if (matchedRule) {
        // Matched rule's value overrides the selected target's value
        target = {
          version: target.version,
          expired_at: target.expired_at,
          published_at: target.published_at,
          scheduled_at: target.scheduled_at,
          value: matchedRule.value,
        };
      }
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
    } else if (typeof defaultValue === 'object' && defaultValue !== null) {
      type = 'json';
      // Shallow-clone so a caller mutating the object/array they passed in
      // afterward can't reach back into this flag's stored value.
      target = {
        value: {
          value: { json: Array.isArray(defaultValue) ? [...defaultValue] : { ...defaultValue } },
        },
      };
    } else {
      type = 'string';
      target = { value: { value: { string: String(defaultValue) } } };
    }

    return new Flag('1', type, key, key, target, []);
  }
}
