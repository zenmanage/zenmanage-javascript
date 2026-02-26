# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Changed
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
