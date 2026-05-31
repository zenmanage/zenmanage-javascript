import { describe, it, expect, vi, afterEach } from 'vitest';
import { ApiClient } from '../src/api-client';
import { FetchRulesError } from '../src/errors';
import type { Logger } from '../src/types';

function createMockLogger(): Logger {
  return {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  };
}

function makeJsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('ApiClient security', () => {
  describe('SSRF: CDN URL must be HTTPS', () => {
    it('rejects a non-HTTPS CDN URL returned by the metadata endpoint', async () => {
      // All 3 retry attempts return the same HTTP-only CDN URL.
      // Use mockImplementation so each call gets a fresh Response (body can only be read once).
      vi.stubGlobal(
        'fetch',
        vi
          .fn()
          .mockImplementation(() =>
            Promise.resolve(
              makeJsonResponse({ data: { cdn: 'http://internal-host', path: '/rules.json' } })
            )
          )
      );

      const client = new ApiClient('srv_test', 'https://api.example.com', createMockLogger());

      const error = await client.getRules().catch((e) => e);
      expect(error).toBeInstanceOf(FetchRulesError);
      expect(error.message).toMatch(/HTTPS/i);
    });
  });

  describe('URL injection: flag key encoding', () => {
    it('percent-encodes flag keys containing path-special characters', async () => {
      const capturedUrls: string[] = [];
      vi.stubGlobal(
        'fetch',
        vi.fn().mockImplementation((url: string) => {
          capturedUrls.push(url);
          return Promise.resolve(new Response(null, { status: 200 }));
        })
      );

      // enableUsageReporting must be true (4th arg)
      const client = new ApiClient('srv_test', 'https://api.example.com', createMockLogger(), true);
      await client.reportUsage('flag/with/slashes');

      expect(capturedUrls.length).toBeGreaterThan(0);
      expect(capturedUrls.some((u) => u.includes('flag%2Fwith%2Fslashes'))).toBe(true);
      expect(capturedUrls.every((u) => !u.includes('/flag/with/slashes/'))).toBe(true);
    });
  });
});
