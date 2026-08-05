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

describe('ApiClient.reportUsage default value header', () => {
  function captureHeaders(): {
    capturedHeaders: HeadersInit[];
    fetchMock: ReturnType<typeof vi.fn>;
  } {
    const capturedHeaders: HeadersInit[] = [];
    const fetchMock = vi.fn().mockImplementation((_url: string, options: RequestInit) => {
      capturedHeaders.push(options.headers as HeadersInit);
      return Promise.resolve(new Response(null, { status: 200 }));
    });
    vi.stubGlobal('fetch', fetchMock);
    return { capturedHeaders, fetchMock };
  }

  it('sends the default value keyed by flag key in the X-ZEN-DEFAULT-VALUE header', async () => {
    const { capturedHeaders } = captureHeaders();
    const client = new ApiClient('srv_test', 'https://api.example.com', createMockLogger(), true);

    await client.reportUsage('my-flag', undefined, true);

    expect(capturedHeaders).toHaveLength(1);
    const headers = capturedHeaders[0] as Record<string, string>;
    expect(headers['X-ZEN-DEFAULT-VALUE']).toBe(JSON.stringify({ 'my-flag': true }));
  });

  it('supports string and number default values', async () => {
    const { capturedHeaders } = captureHeaders();
    const client = new ApiClient('srv_test', 'https://api.example.com', createMockLogger(), true);

    await client.reportUsage('str-flag', undefined, 'fallback');
    await client.reportUsage('num-flag', undefined, 42);

    expect((capturedHeaders[0] as Record<string, string>)['X-ZEN-DEFAULT-VALUE']).toBe(
      JSON.stringify({ 'str-flag': 'fallback' })
    );
    expect((capturedHeaders[1] as Record<string, string>)['X-ZEN-DEFAULT-VALUE']).toBe(
      JSON.stringify({ 'num-flag': 42 })
    );
  });

  it('omits the header entirely when no default value is provided', async () => {
    const { capturedHeaders } = captureHeaders();
    const client = new ApiClient('srv_test', 'https://api.example.com', createMockLogger(), true);

    await client.reportUsage('no-default-flag');

    expect(capturedHeaders).toHaveLength(1);
    expect('X-ZEN-DEFAULT-VALUE' in (capturedHeaders[0] as Record<string, string>)).toBe(false);
  });

  it('omits the header when reporting usage for a found flag with no default (falsy but defined values still send)', async () => {
    const { capturedHeaders } = captureHeaders();
    const client = new ApiClient('srv_test', 'https://api.example.com', createMockLogger(), true);

    // false/0/'' are valid default values and must still be sent
    await client.reportUsage('bool-false-flag', undefined, false);
    await client.reportUsage('zero-flag', undefined, 0);

    expect((capturedHeaders[0] as Record<string, string>)['X-ZEN-DEFAULT-VALUE']).toBe(
      JSON.stringify({ 'bool-false-flag': false })
    );
    expect((capturedHeaders[1] as Record<string, string>)['X-ZEN-DEFAULT-VALUE']).toBe(
      JSON.stringify({ 'zero-flag': 0 })
    );
  });
});
