import type { Logger, RulesResponse } from './types';
import type { Context } from './context';
import { FetchRulesError, InvalidRulesError } from './errors';

/**
 * Metadata response from the API containing CDN information
 */
interface FlagMetadataResponse {
  data: {
    cdn: string;
    path: string;
  };
}

const SDK_VERSION = '1.0.0';
const CLIENT_AGENT = 'zenmanage-javascript';
const DEFAULT_API_ENDPOINT = 'https://api.zenmanage.com';
const RULES_PATH = '/v1/flag-json';
const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 100;

/**
 * API client for communicating with the Zenmanage service
 */
export class ApiClient {
  private readonly baseUrl: string;
  private readonly headers: Record<string, string>;

  constructor(
    environmentToken: string,
    apiEndpoint: string = DEFAULT_API_ENDPOINT,
    private readonly logger: Logger,
    private readonly enableUsageReporting: boolean = false
  ) {
    this.baseUrl = apiEndpoint;
    this.headers = {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      'X-API-Key': environmentToken,
      'X-ZEN-CLIENT-AGENT': `${CLIENT_AGENT}/${SDK_VERSION}`,
    };
  }

  /**
   * Fetch rules from the API with retry logic
   * First fetches metadata from the API, then fetches actual rules from CDN
   */
  async getRules(): Promise<RulesResponse> {
    let lastError: Error | null = null;

    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      try {
        if (attempt > 0) {
          const delay = RETRY_DELAY_MS * Math.pow(2, attempt - 1);
          this.logger.debug(`Retrying after ${delay}ms (attempt ${attempt + 1}/${MAX_RETRIES})`);
          await this.delay(delay);
        }

        // Step 1: Fetch metadata from API to get CDN URL
        this.logger.debug('Fetching rules metadata from API', {
          endpoint: `${this.baseUrl}${RULES_PATH}`,
          attempt: attempt + 1,
        });

        const cdnUrl = await this.getCdnRulesUrl();

        // Step 2: Fetch actual rules from CDN
        this.logger.debug('Fetching rules from CDN', { url: cdnUrl });

        const rulesResponse = await this.fetch(cdnUrl, {
          method: 'GET',
          headers: {
            Accept: 'application/json',
          },
        });

        if (!rulesResponse.ok) {
          throw new FetchRulesError(
            `CDN request failed with status ${rulesResponse.status}`,
            rulesResponse.status
          );
        }

        const data = await rulesResponse.json();

        if (!this.isValidRulesResponse(data)) {
          throw new InvalidRulesError('Invalid response format from CDN');
        }

        this.logger.info('Successfully fetched rules from CDN', {
          size: JSON.stringify(data).length,
          flags: data.flags.length,
        });

        return data;
      } catch (error) {
        lastError = error as Error;
        this.logger.warn(`Failed to fetch rules (attempt ${attempt + 1}/${MAX_RETRIES})`, {
          error: (error as Error).message,
        });
      }
    }

    throw new FetchRulesError(
      `Failed to fetch rules after ${MAX_RETRIES} attempts: ${lastError?.message}`
    );
  }

  /**
   * Report flag usage to the API
   */
  async reportUsage(key: string, context?: Context): Promise<void> {
    this.logger.debug(`reportUsage called for flag: ${key}`, {
      enableUsageReporting: this.enableUsageReporting,
      hasContext: !!context,
    });

    if (!this.enableUsageReporting) {
      this.logger.debug('Usage reporting disabled, skipping HTTP call');
      return;
    }

    try {
      const url = `${this.baseUrl}/v1/flags/${key}/usage`;
      const headers = { ...this.headers };

      // Send context as header if provided
      if (context) {
        headers['X-ZENMANAGE-CONTEXT'] = JSON.stringify(context.toJSON());
      }

      this.logger.debug(`Sending reportUsage request to ${url}`, { method: 'POST' });

      // Fire and forget - don't wait for response
      this.fetch(url, {
        method: 'POST',
        headers,
      }).catch((error) => {
        this.logger.debug('Failed to report usage', { error: error.message });
      });
    } catch (error) {
      // Silently ignore usage reporting errors
      this.logger.debug('Failed to report usage', { error: (error as Error).message });
    }
  }

  /**
   * Get the CDN URL for rules from the API metadata endpoint
   */
  private async getCdnRulesUrl(): Promise<string> {
    const url = `${this.baseUrl}${RULES_PATH}`;
    const response = await this.fetch(url, {
      method: 'GET',
      headers: this.headers,
    });

    if (!response.ok) {
      throw new FetchRulesError(
        `API metadata request failed with status ${response.status}`,
        response.status
      );
    }

    const metadata = await response.json();

    if (!this.isValidMetadataResponse(metadata)) {
      throw new InvalidRulesError('API response missing cdn or path fields');
    }

    const { cdn, path } = metadata.data;

    if (typeof cdn !== 'string' || typeof path !== 'string') {
      throw new InvalidRulesError('cdn or path fields are not strings');
    }

    return cdn + path;
  }

  /**
   * Validate the metadata response structure
   */
  private isValidMetadataResponse(data: unknown): data is FlagMetadataResponse {
    if (typeof data !== 'object' || data === null) {
      return false;
    }

    const obj = data as Record<string, unknown>;

    if (typeof obj.data !== 'object' || obj.data === null) {
      return false;
    }

    const dataObj = obj.data as Record<string, unknown>;

    return 'cdn' in dataObj && 'path' in dataObj;
  }

  /**
   * Validate the rules response structure
   */
  private isValidRulesResponse(data: unknown): data is RulesResponse {
    if (typeof data !== 'object' || data === null) {
      return false;
    }

    const obj = data as Record<string, unknown>;

    if (typeof obj.version !== 'string') {
      return false;
    }

    if (!Array.isArray(obj.flags)) {
      return false;
    }

    return true;
  }

  /**
   * Fetch wrapper that works in both browser and Node.js
   */
  private async fetch(url: string, options: RequestInit): Promise<Response> {
    // In browser, use native fetch
    if (typeof window !== 'undefined' && typeof window.fetch === 'function') {
      return window.fetch(url, options);
    }

    // In Node.js, use native fetch (Node 18+) or throw error
    if (typeof globalThis.fetch === 'function') {
      return globalThis.fetch(url, options);
    }

    throw new Error('fetch is not available. Please use Node.js 18+ or a polyfill like node-fetch');
  }

  /**
   * Simple delay utility
   */
  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
