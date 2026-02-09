# Zenmanage JavaScript SDK

[![npm version](https://badge.fury.io/js/@zenmanage%2Fsdk.svg)](https://www.npmjs.com/package/@zenmanage/sdk)
[![Build Status](https://github.com/zenmanage/zenmanage-javascript/actions/workflows/ci.yml/badge.svg)](https://github.com/zenmanage/zenmanage-javascript)
[![TypeScript](https://img.shields.io/badge/TypeScript-Ready-blue.svg)](https://www.typescriptlang.org/)

Add feature flags to your JavaScript/TypeScript application in minutes. Control feature rollouts, A/B test, and manage configurations without deploying code. Works in both Node.js and browsers!

## Why Zenmanage?

- 🚀 **Fast**: Rules cached locally - ~1ms evaluation time
- 🎯 **Targeted**: Roll out features to specific users, organizations, or segments  
- 🛡️ **Safe**: Graceful fallbacks and error handling built-in
- 📊 **Insightful**: Automatic usage tracking (optional)
- 🧪 **Testable**: Easy to mock in tests
- 🌐 **Universal**: Works in Node.js (16+) and modern browsers
- 📘 **TypeScript**: Full type definitions included

## Installation

```bash
npm install @zenmanage/sdk
```

**Browser Requirements**: Modern browsers with fetch API support (or use a polyfill)
**Node.js Requirements**: Node.js 16+ (requires native fetch API)

## Get Started in 60 Seconds

### 1. Get your environment token from [zenmanage.com](https://zenmanage.com)

### 2. Initialize the SDK:

```typescript
import { Zenmanage, ConfigBuilder } from '@zenmanage/sdk';

const zenmanage = new Zenmanage(
  ConfigBuilder.create()
    .withEnvironmentToken('tok_your_token_here')
    .build()
);
```

### 3. Check a feature flag:

```typescript
const flag = await zenmanage.flags().single('new-dashboard');

if (flag.isEnabled()) {
  // Show new dashboard
  showNewDashboard();
} else {
  // Show old dashboard
  showOldDashboard();
}
```

That's it! 🎉

## Common Use Cases

### Roll Out a New Feature Gradually

```typescript
import { Zenmanage, ConfigBuilder, Context } from '@zenmanage/sdk';

const zenmanage = new Zenmanage(
  ConfigBuilder.create()
    .withEnvironmentToken('tok_your_token_here')
    .build()
);

// Create context with user information
const context = Context.single('user', userId, userName);

const betaAccess = await zenmanage.flags()
  .withContext(context)
  .single('beta-program');

if (betaAccess.isEnabled()) {
  // User is in beta program
  const features = getBetaFeatures();
}
```

**Note:** Call `withContext()` on the flag manager to ensure context is sent to the API when loading rules.

### A/B Testing

```typescript
import { Context, Attribute } from '@zenmanage/sdk';

const context = new Context(
  'user',
  user.name,
  user.id,
  [
    new Attribute('country', [user.country]),
    new Attribute('plan', [user.subscriptionPlan]),
  ]
);

const variant = await zenmanage.flags()
  .withContext(context)
  .single('checkout-flow');

if (variant.asString() === 'one-page') {
  renderOnePageCheckout();
} else {
  renderMultiPageCheckout();
}
```

### Feature Toggles by Organization

```typescript
const orgContext = Context.single('organization', orgId, orgName);

const enterpriseFeatures = await zenmanage.flags()
  .withContext(orgContext)
  .single('enterprise-analytics');

if (enterpriseFeatures.isEnabled()) {
  showEnterpriseAnalytics();
}
```

### Using Default Values

```typescript
// Inline default (highest priority)
const flag = await zenmanage.flags()
  .single('feature-flag', true);

console.log(flag.isEnabled()); // Returns true if flag not found

// Or use DefaultsCollection for multiple defaults
import { DefaultsCollection } from '@zenmanage/sdk';

const defaults = DefaultsCollection.fromObject({
  'new-ui': true,
  'api-version': 'v2',
  'max-items': 100,
});

const flagManager = zenmanage.flags().withDefaults(defaults);
const flag = await flagManager.single('new-ui');
```

### Get All Flags

```typescript
const allFlags = await zenmanage.flags().all();

for (const flag of allFlags) {
  console.log(`${flag.getKey()}: ${flag.getValue()}`);
}
```

## Configuration Options

```typescript
const config = ConfigBuilder.create()
  .withEnvironmentToken('tok_your_token_here')  // Required
  .withCacheTtl(3600)                            // Cache TTL in seconds (default: 3600)
  .withCacheBackend('memory')                    // 'memory', 'filesystem', 'null' (default: 'memory')
  .withCacheDirectory('/tmp/zenmanage')          // Required if using 'filesystem' cache
  .withUsageReporting(true)                      // Enable usage tracking (default: true)
  .withApiEndpoint('https://api.zenmanage.com')  // Custom API endpoint (default: api.zenmanage.com)
  .withLogger(customLogger)                      // Custom logger instance
  .build();

const zenmanage = new Zenmanage(config);
```

### Configuration from Environment Variables

```typescript
// Reads from environment variables:
// - ZENMANAGE_ENVIRONMENT_TOKEN
// - ZENMANAGE_CACHE_TTL
// - ZENMANAGE_CACHE_BACKEND
// - ZENMANAGE_CACHE_DIR
// - ZENMANAGE_ENABLE_USAGE_REPORTING
// - ZENMANAGE_API_ENDPOINT

const config = ConfigBuilder.fromEnvironment().build();
const zenmanage = new Zenmanage(config);
```

## Cache Backends

### Memory Cache (Default)
Best for: Most applications, serverless functions

```typescript
ConfigBuilder.create()
  .withEnvironmentToken('tok_your_token_here')
  .withCacheBackend('memory')
  .build();
```

Data is cached in memory for the lifetime of the application. Fastest option but data is lost on restart.

### Filesystem Cache (Node.js only)
Best for: Long-running Node.js servers

```typescript
ConfigBuilder.create()
  .withEnvironmentToken('tok_your_token_here')
  .withCacheBackend('filesystem')
  .withCacheDirectory('/tmp/zenmanage-cache')
  .build();
```

Data persists across application restarts. Only works in Node.js (not browsers).

### Null Cache (No Caching)
Best for: Testing, debugging

```typescript
ConfigBuilder.create()
  .withEnvironmentToken('tok_your_token_here')
  .withCacheBackend('null')
  .build();
```

Fetches rules from API on every request. Useful for testing but not recommended for production.

## Context

Context allows you to pass information about the user, organization, or other entities that influence flag evaluation based on server-side rules.

### Simple Context

```typescript
import { Context } from '@zenmanage/sdk';

// Context with just identifier
const context = Context.single('user', 'user-123');

// Context with identifier and name
const context = Context.single('user', 'user-123', 'John Doe');
```

### Context with Attributes

```typescript
import { Context, Attribute } from '@zenmanage/sdk';

const context = new Context(
  'user',           // type
  'John Doe',       // name (optional)
  'user-123',       // identifier (optional)
  [
    new Attribute('country', ['US']),
    new Attribute('plan', ['premium', 'annual']),
    new Attribute('signup_date', ['2024-01-15']),
  ]
);

const flag = await zenmanage.flags()
  .withContext(context)
  .single('premium-feature');
```

### Context Types

- **user**: Individual users
- **organization**: Companies or teams
- **session**: Browser or app sessions
- **device**: Physical devices
- **custom**: Any custom type you define

## Flag Types

### Boolean Flags

```typescript
const flag = await zenmanage.flags().single('feature-enabled');

if (flag.isEnabled()) {
  // Feature is enabled
}

// Or use asBool()
const enabled = flag.asBool();
```

### String Flags

```typescript
const flag = await zenmanage.flags().single('theme');

const theme = flag.asString();
console.log(theme); // 'dark', 'light', etc.
```

### Number Flags

```typescript
const flag = await zenmanage.flags().single('max-items');

const maxItems = flag.asNumber();
console.log(maxItems); // 100, 250, etc.
```

### Type-Safe Access

All flags have multiple accessor methods:
- `isEnabled()`: Boolean check (only true for boolean flags with value `true`)
- `asBool()`: Get value as boolean
- `asString()`: Get value as string
- `asNumber()`: Get value as number
- `getValue()`: Get raw value

## Advanced Features

### Custom Logger

```typescript
import type { Logger } from '@zenmanage/sdk';

const customLogger: Logger = {
  debug: (msg, meta) => console.debug(msg, meta),
  info: (msg, meta) => console.info(msg, meta),
  warn: (msg, meta) => console.warn(msg, meta),
  error: (msg, meta) => console.error(msg, meta),
};

const config = ConfigBuilder.create()
  .withEnvironmentToken('tok_your_token_here')
  .withLogger(customLogger)
  .build();
```

### Force Refresh Rules

```typescript
// Force refresh from API (bypasses cache)
await zenmanage.flags().refreshRules();
```

### Manual Usage Reporting

```typescript
const context = Context.single('user', 'user-123');

// Report that a flag was evaluated
await zenmanage.flags().reportUsage('feature-flag', context);
```

## TypeScript Support

The SDK is written in TypeScript and includes full type definitions:

```typescript
import type {
  Config,
  Logger,
  FlagType,
  FlagValue,
  ContextData,
  RulesResponse,
} from '@zenmanage/sdk';

const config: Config = {
  environmentToken: 'tok_test',
  cacheTtl: 3600,
  cacheBackend: 'memory',
};
```

## Browser Usage

The SDK works seamlessly in browsers:

```html
<!DOCTYPE html>
<html>
<head>
  <script type="module">
    import { Zenmanage, ConfigBuilder } from 'https://cdn.skypack.dev/@zenmanage/sdk';

    const zenmanage = new Zenmanage(
      ConfigBuilder.create()
        .withEnvironmentToken('tok_your_token_here')
        .build()
    );

    const flag = await zenmanage.flags().single('new-ui');
    if (flag.isEnabled()) {
      document.body.classList.add('new-ui');
    }
  </script>
</head>
<body>
  <!-- Your content -->
</body>
</html>
```

Or with a bundler (Webpack, Vite, etc.):

```typescript
import { Zenmanage, ConfigBuilder } from '@zenmanage/sdk';

const zenmanage = new Zenmanage(
  ConfigBuilder.create()
    .withEnvironmentToken('tok_your_token_here')
    .withCacheBackend('memory') // Use memory cache in browsers
    .build()
);
```

## Error Handling

```typescript
import { EvaluationError, FetchRulesError } from '@zenmanage/sdk';

try {
  const flag = await zenmanage.flags().single('unknown-flag');
} catch (error) {
  if (error instanceof EvaluationError) {
    // Flag not found
    console.error('Flag not found:', error.message);
  } else if (error instanceof FetchRulesError) {
    // API error
    console.error('Failed to fetch rules:', error.message);
  }
}

// Or use default values to avoid errors
const flag = await zenmanage.flags().single('unknown-flag', false);
console.log(flag.isEnabled()); // false
```

## Testing

The SDK is designed to be easily testable:

```typescript
import { Zenmanage, ConfigBuilder } from '@zenmanage/sdk';
import { vi } from 'vitest'; // or jest

// Mock the API client
vi.mock('@zenmanage/sdk', async () => {
  const actual = await vi.importActual('@zenmanage/sdk');
  return {
    ...actual,
    Zenmanage: vi.fn().mockImplementation(() => ({
      flags: () => ({
        single: vi.fn().mockResolvedValue({
          isEnabled: () => true,
          asString: () => 'test-value',
          asNumber: () => 42,
        }),
      }),
    })),
  };
});

test('feature flag enabled', async () => {
  const zenmanage = new Zenmanage(
    ConfigBuilder.create().withEnvironmentToken('tok_test').build()
  );

  const flag = await zenmanage.flags().single('test-flag');
  expect(flag.isEnabled()).toBe(true);
});
```

## Best Practices

### 1. Initialize Once

Create a single Zenmanage instance and reuse it throughout your application:

```typescript
// zenmanage.ts
import { Zenmanage, ConfigBuilder } from '@zenmanage/sdk';

export const zenmanage = new Zenmanage(
  ConfigBuilder.create()
    .withEnvironmentToken(process.env.ZENMANAGE_TOKEN!)
    .build()
);

// other-file.ts
import { zenmanage } from './zenmanage';

const flag = await zenmanage.flags().single('feature');
```

### 2. Use Default Values

Always provide default values to ensure your application works even if the API is unavailable:

```typescript
const flag = await zenmanage.flags().single('feature', false);
```

### 3. Context Best Practices

- Always include context when evaluating flags that have targeting rules
- Use consistent attribute names across your application
- Keep attribute values simple (strings, numbers)

### 4. Cache Configuration

- Use **memory cache** for most applications and serverless
- Use **filesystem cache** for long-running Node.js servers
- Use **null cache** only for testing/debugging

### 5. Error Handling

Always handle errors gracefully with try-catch or default values:

```typescript
try {
  const flag = await zenmanage.flags().single('feature');
  if (flag.isEnabled()) {
    // Enable feature
  }
} catch (error) {
  // Fallback to safe default
  console.error('Flag evaluation failed:', error);
}
```

## API Reference

### Zenmanage

Main SDK class.

**Methods:**
- `flags()`: Returns the FlagManager instance

### ConfigBuilder

Fluent builder for creating configuration.

**Methods:**
- `create()`: Create new builder
- `fromEnvironment()`: Create builder from environment variables
- `withEnvironmentToken(token)`: Set environment token (required)
- `withCacheTtl(seconds)`: Set cache TTL
- `withCacheBackend(backend)`: Set cache backend
- `withCacheDirectory(path)`: Set cache directory for filesystem cache
- `withUsageReporting(enabled)`: Enable or disable usage tracking
- `withApiEndpoint(url)`: Set custom API endpoint
- `withLogger(logger)`: Set custom logger
- `build()`: Build the configuration

### FlagManager

Manages flag evaluation.

**Methods:**
- `single(key, defaultValue?)`: Get a single flag by key
- `all()`: Get all flags
- `withContext(context)`: Create new manager with context
- `withDefaults(defaults)`: Create new manager with defaults
- `refreshRules()`: Force refresh rules from API
- `reportUsage(key, context?)`: Manually report flag usage

### Context

Represents evaluation context.

**Methods:**
- `single(type, identifier, name?)`: Create simple context
- `fromObject(data)`: Create from plain object
- `addAttribute(attribute)`: Add an attribute
- `getAttribute(key)`: Get an attribute
- `hasAttribute(key)`: Check if attribute exists
- `getAttributes()`: Get all attributes

### Flag

Represents a feature flag.

**Methods:**
- `isEnabled()`: Check if boolean flag is enabled
- `asBool()`: Get value as boolean
- `asString()`: Get value as string
- `asNumber()`: Get value as number
- `getValue()`: Get raw value
- `getKey()`: Get flag key
- `getName()`: Get flag name
- `getType()`: Get flag type

## Examples

See the [examples](./examples) directory for more examples:

- [simple-flags.ts](./examples/simple-flags.ts) - Basic flag operations
- [context-based-flags.ts](./examples/context-based-flags.ts) - Using context for targeting
- [ab-testing.ts](./examples/ab-testing.ts) - A/B testing example
- [defaults.ts](./examples/defaults.ts) - Using default values
- [caching.ts](./examples/caching.ts) - Cache configuration examples

## Contributing

Contributions are welcome! Please see [CONTRIBUTING.md](./CONTRIBUTING.md) for guidelines.

## License

MIT License - see [LICENSE](./LICENSE) for details.

## Support

- **Documentation**: [https://zenmanage.com/resources](https://zenmanage.com/resources)
- **Issues**: [GitHub Issues](https://github.com/zenmanage/zenmanage-javascript/issues)
- **Email**: hello@zenmanage.com

## Changelog

See [CHANGELOG.md](./CHANGELOG.md) for release history and changes.
