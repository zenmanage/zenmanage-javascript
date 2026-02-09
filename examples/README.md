# Zenmanage JavaScript SDK Examples

This directory contains examples demonstrating various features and use cases of the Zenmanage JavaScript SDK.

## Running the Examples

1. Install dependencies:
```bash
npm install
```

2. Set your environment token:
```bash
export ZENMANAGE_ENVIRONMENT_TOKEN="tok_your_token_here"
```

3. Run an example:
```bash
# For TypeScript examples (requires ts-node)
npm install -g ts-node
ts-node examples/simple-flags.ts

# Or compile and run
npm run build
node dist/index.js
```

## Examples

### simple-flags.ts
Basic flag operations including retrieving boolean, string, and number flags.

### context-based-flags.ts
Demonstrates using context for user-based, organization-based, and attribute-based flag targeting.

### ab-testing.ts
A/B testing example showing how to use flags for experiments and variants.

### defaults.ts
Using default values with inline defaults and DefaultsCollection.

### caching.ts
Different cache backend configurations and their use cases.

## Note

These examples assume you have flags set up in your Zenmanage dashboard. You may need to adjust flag keys to match your configuration.
