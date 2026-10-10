# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [3.5.1] - 2026-10-10

### Changed

- `ConfigBuilder` no longer reads `process.versions` when it works out the runtime. The check never changed the result (every runtime without a `window` or `document` was already treated as `node`), but it made `next build` warn that "A Node.js API is used (process.versions) which is not supported in the Edge Runtime" for any app importing `@zenmanage/sdk` from middleware. The warning is gone; behaviour is the same.

### Fixed

- A `FlagManager` now reloads its rules once `cacheTtl` has passed. Before, it kept the first rules it loaded until the process restarted (unless you called `refreshRules()`), so `withCacheTtl()` had no effect on a long-running server that kept using `zenmanage.flags()`. Clones made with `withContext()` and `withDefaults()` expire on the same schedule as the manager they came from. Within the TTL nothing changes: evaluations still read neither the cache nor the API. When the TTL has passed, the rules are re-read from the cache first, then the API, and callers that arrive together share one reload.
- A failed reload no longer throws away the rules the manager already has. If the API can't be reached when the TTL runs out, the manager keeps serving its existing rules and tries again after 30 seconds (or after `cacheTtl`, if that is shorter). A manager whose very first load failed used to stay empty until restart; it now tries again on the same schedule. `refreshRules()` is unchanged: a failed explicit refresh still clears the rules and throws.
- A cache that can't be written to no longer fails a load that succeeded. Once the rules have been fetched from the API they are used even if the cache write throws; the SDK logs a warning and fetches again at the next reload. Before, the write error was thrown after the rules were fetched, and `refreshRules()` cleared them.

## [3.5.0] - 2026-10-04

### Added

- `ConfigBuilder.withClientAgent(name)` and `ConfigBuilder.withSdkVersion(version)` let a package that wraps this SDK (such as `@zenmanage/react`) report itself in the `X-ZEN-CLIENT-AGENT` header instead of the default `zenmanage-javascript` / `zenmanage-javascript-node`. An overridden agent is sent exactly as given, with no `-node` suffix for server keys. `build()` throws a `ConfigurationError` if either value is empty or contains characters that aren't valid in the header (letters, digits, `.`, `_` and `-` only, plus `+` in versions).

### Changed

- Upgraded the dev tooling to `vitest` and `@vitest/coverage-v8` 5. This only affects contributors and CI — the published package is unchanged. Vitest 5 does not run on Node 18, so the CI matrix is now Node 20, 22 and 24. The package's `engines` field is unchanged.

### Fixed

- `single()` and `all()` now fall back to the caller-supplied default (inline parameter or `DefaultsCollection` entry) instead of throwing when rule-loading fails outright — e.g. an unreachable API or an invalid/misconfigured environment token. Previously an evaluation error on the network call was thrown all the way through `single()`/`all()` even when a usable default was available, so a client that couldn't resolve its environment couldn't serve defaults either.
- Usage reporting now defaults to on when `enableUsageReporting` isn't set, as `Config` has always documented (`default: true`). `ConfigBuilder` always sets it, so builder users were never affected. A `Config` object written by hand without that field silently had usage reporting off, because the internal API client defaulted to `false`. If you depend on that, set `enableUsageReporting: false`.
- `new Zenmanage(config)` now applies the defaults `Config` documents for a `Config` written by hand, instead of throwing or crashing. Omitting `cacheBackend` threw `Invalid cache backend: undefined`; it now defaults to `'memory'`. Omitting `logger` crashed with `Cannot read properties of undefined` the first time the SDK logged, for example when rules failed to load; it now defaults to a silent logger. `ConfigBuilder` already set both, so builder users were never affected.

## [3.4.0] - 2026-09-24

### Added

- Support for the `json` flag type: `Flag.asJson()` returns the decoded value (an object or array). Object/array default values passed to `single()` or `DefaultsCollection` are now typed as `json` instead of being coerced through the `string` fallback, so `asJson()` on a missing flag with such a default returns it unchanged.

### Changed

- `FlagManager.single()` now looks up flags by key in a `Map` built when rules are parsed, instead of scanning the flags array on every call — this is the hot path, hit once per flag check per request.

## [3.3.2] - 2026-09-23

### Fixed

- Flags with a `type` this SDK release doesn't recognize (e.g. a future `json` flag type) are now skipped when parsing a rules payload, instead of being evaluated with a silently mis-parsed value. Looking up such a flag by key now behaves exactly like a missing flag: it resolves to the caller-supplied default (or throws the standard "Flag not found" error if none was given), and every other flag in the payload is unaffected. Previously, `asString()`/`asNumber()`/`getValue()` on an unrecognized-type flag could return a garbage value (e.g. `"[object Object]"`) instead of the caller's default, and `single()` with no default would resolve the flag instead of throwing "not found". A warning is now logged once per unrecognized flag encountered while loading rules.

## [3.3.1] - 2026-08-28

### Fixed

- The `X-ZEN-CLIENT-AGENT` header now reports `zenmanage-javascript-node/<version>` when the SDK is used with a server key (`srv_...`), instead of the same `zenmanage-javascript/<version>` sent for browser client-key usage. The API's per-SDK-family key-type check couldn't otherwise distinguish a Node.js server-side caller from a browser one, since both run this same package, and was rejecting valid server-key usage with a 401.

## [3.3.0] - 2026-08-16

### Added

- CI now automatically publishes the package to npm on every merge to `main`, skipping the publish when the `package.json` version hasn't changed.

## [3.2.1] - 2026-08-05

### Fixed

- `FlagManager.single()` now sends the caller-supplied default value on usage reports even when the flag is found, not only when it falls back to a default. Previously the `X-ZEN-DEFAULT-VALUE` header was only sent for flags that didn't resolve at all.
- The `X-ZEN-CLIENT-AGENT` header now reports the SDK's actual `package.json` version instead of a hardcoded constant that had drifted out of date (stuck at `3.0.0` since the 3.1.x/3.2.0 releases).

### Changed

- Renamed request headers to use a consistent `X-ZEN-` prefix: `X-API-Key` → `X-ZEN-API-KEY`, `X-ZENMANAGE-CONTEXT` → `X-ZEN-CONTEXT`, and `X-DEFAULT-VALUE` → `X-ZEN-DEFAULT-VALUE`.

## [3.2.0] - 2026-07-30

### Changed

- Usage reports now include the default value the SDK fell back to (inline default or `DefaultsCollection` entry), sent via the `X-DEFAULT-VALUE` header, so it can be persisted and shown on the flag detail page.
- **Browser-safe default entry point**: `@zenmanage/sdk` no longer imports Node.js built-ins (`fs`, `path`, `util`), making it fully compatible with browser bundlers (Webpack, Vite, Rollup, esbuild, etc.) and CDNs.
- **New Node.js entry point**: `@zenmanage/sdk/node` re-exports everything from the main entry plus `FileSystemCache`. Use this when you need filesystem caching on a Node.js server.
- **New `.withCache()` config method**: `ConfigBuilder.withCache(cache)` accepts any `Cache` implementation, making it easy to provide `FileSystemCache` (from the node entry) or a completely custom cache (e.g., Redis, IndexedDB).
- `ConfigBuilder.fromEnvironment()` now gracefully returns an empty builder in browser environments where `process` is not available.
- Selecting `cacheBackend: 'filesystem'` without a custom cache instance now throws a clear error directing users to `@zenmanage/sdk/node`.

## [1.0.0] - 2024-02-09

### Added

- Initial release of the Zenmanage JavaScript SDK
- Full TypeScript support with type definitions
- Support for both Node.js (16+) and modern browsers
- Multiple cache backends: In-Memory, Filesystem (Node.js only), and Null
- Context-based flag evaluation with user attributes
- Rule engine for server-side flag targeting
- Default values support (inline defaults and DefaultsCollection)
- Comprehensive error handling with custom error types
- Fluent ConfigBuilder API
- Usage reporting (optional)
- Automatic retry logic for API requests
- Full test suite with high coverage
- Complete documentation with examples
- ESM and CommonJS support (dual package)

### Features

- Boolean, string, and number flag types
- Type-safe flag value accessors
- Context attributes for fine-grained targeting
- Configurable cache TTL
- Environment variable configuration support
- Custom logger interface
- Flag refresh functionality
- A/B testing capabilities

### Cache Backends

- **InMemoryCache**: Fast, works everywhere, default choice
- **FileSystemCache**: Persistent cache for Node.js servers
- **NullCache**: No caching for testing and debugging

### Supported Operators

- equals, not_equals
- contains, not_contains
- in, not_in
- starts_with, ends_with
- gt, gte, lt, lte (numeric comparisons)

### Documentation

- Comprehensive README with usage examples
- API reference documentation
- 5 detailed example files
- TypeScript type definitions
- Best practices guide

### Testing

- Unit tests for all core functionality
- Test coverage for cache implementations
- Context and attribute testing
- Rule engine evaluation tests
- Configuration builder tests
- Flag type conversion tests
