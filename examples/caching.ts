/**
 * Caching Examples
 *
 * This example demonstrates different cache backend configurations and their use cases.
 */

import { Zenmanage, ConfigBuilder } from '../src';
import * as os from 'os';
import * as path from 'path';

async function main() {
  console.log('=== Caching Examples ===\n');

  // Example 1: In-Memory Cache (Default)
  console.log('1. In-Memory Cache (Default)\n');

  const memoryZenmanage = new Zenmanage(
    ConfigBuilder.create()
      .withEnvironmentToken(process.env.ZENMANAGE_ENVIRONMENT_TOKEN || 'tok_your_token_here')
      .withCacheBackend('memory')
      .withCacheTtl(3600) // 1 hour
      .build()
  );

  console.log('   Cache backend: memory');
  console.log('   Cache TTL: 3600 seconds (1 hour)');
  console.log('   Best for: Most applications, serverless functions');
  console.log('   Pros: Fast, no I/O, works everywhere');
  console.log('   Cons: Cache lost on restart\n');

  try {
    const flag = await memoryZenmanage.flags().single('example-flag', true);
    console.log(`   Flag value: ${flag.isEnabled()}`);
    console.log('   ✓ First fetch - retrieved from API and cached in memory');

    // Second fetch will use cache
    const flag2 = await memoryZenmanage.flags().single('example-flag', true);
    console.log(`   Flag value: ${flag2.isEnabled()}`);
    console.log('   ✓ Second fetch - retrieved from memory cache\n');
  } catch (error) {
    console.error('   Error:', (error as Error).message);
  }

  // Example 2: Filesystem Cache (Node.js only)
  console.log('2. Filesystem Cache (Node.js only)\n');

  const cacheDir = path.join(os.tmpdir(), 'zenmanage-cache');

  const filesystemZenmanage = new Zenmanage(
    ConfigBuilder.create()
      .withEnvironmentToken(process.env.ZENMANAGE_ENVIRONMENT_TOKEN || 'tok_your_token_here')
      .withCacheBackend('filesystem')
      .withCacheDirectory(cacheDir)
      .withCacheTtl(7200) // 2 hours
      .build()
  );

  console.log('   Cache backend: filesystem');
  console.log(`   Cache directory: ${cacheDir}`);
  console.log('   Cache TTL: 7200 seconds (2 hours)');
  console.log('   Best for: Long-running Node.js servers');
  console.log('   Pros: Persists across restarts');
  console.log('   Cons: Slower than memory, Node.js only\n');

  try {
    const flag = await filesystemZenmanage.flags().single('example-flag', true);
    console.log(`   Flag value: ${flag.isEnabled()}`);
    console.log('   ✓ Cached to filesystem\n');
  } catch (error) {
    console.error('   Error:', (error as Error).message);
  }

  // Example 3: Null Cache (No caching)
  console.log('3. Null Cache (No Caching)\n');

  const nullCacheZenmanage = new Zenmanage(
    ConfigBuilder.create()
      .withEnvironmentToken(process.env.ZENMANAGE_ENVIRONMENT_TOKEN || 'tok_your_token_here')
      .withCacheBackend('null')
      .build()
  );

  console.log('   Cache backend: null');
  console.log('   Best for: Testing, debugging');
  console.log('   Pros: Always fresh data from API');
  console.log('   Cons: Slower, more API calls\n');

  try {
    const flag = await nullCacheZenmanage.flags().single('example-flag', true);
    console.log(`   Flag value: ${flag.isEnabled()}`);
    console.log('   ✓ Fetched directly from API (not cached)\n');
  } catch (error) {
    console.error('   Error:', (error as Error).message);
  }

  // Example 4: Custom Cache TTL
  console.log('4. Custom Cache TTL\n');

  // Short TTL for frequently changing flags
  const shortTtlZenmanage = new Zenmanage(
    ConfigBuilder.create()
      .withEnvironmentToken(process.env.ZENMANAGE_ENVIRONMENT_TOKEN || 'tok_your_token_here')
      .withCacheBackend('memory')
      .withCacheTtl(60) // 1 minute
      .build()
  );

  console.log('   Cache TTL: 60 seconds (1 minute)');
  console.log('   Use case: Frequently updated feature flags');
  console.log('   Trade-off: More API calls vs. fresher data\n');

  // Long TTL for stable flags
  const longTtlZenmanage = new Zenmanage(
    ConfigBuilder.create()
      .withEnvironmentToken(process.env.ZENMANAGE_ENVIRONMENT_TOKEN || 'tok_your_token_here')
      .withCacheBackend('memory')
      .withCacheTtl(86400) // 24 hours
      .build()
  );

  console.log('   Cache TTL: 86400 seconds (24 hours)');
  console.log('   Use case: Stable configuration values');
  console.log('   Trade-off: Fewer API calls vs. stale data risk\n');

  // Example 5: Force refresh (bypass cache)
  console.log('5. Force Refresh Rules\n');

  const zenmanage = new Zenmanage(
    ConfigBuilder.create()
      .withEnvironmentToken(process.env.ZENMANAGE_ENVIRONMENT_TOKEN || 'tok_your_token_here')
      .withCacheBackend('memory')
      .build()
  );

  try {
    // Normal fetch (uses cache)
    const flag = await zenmanage.flags().single('example-flag', true);
    console.log(`   Flag value (from cache): ${flag.isEnabled()}`);

    // Force refresh from API
    console.log('   Forcing refresh from API...');
    await zenmanage.flags().refreshRules();

    const flagAfterRefresh = await zenmanage.flags().single('example-flag', true);
    console.log(`   Flag value (fresh from API): ${flagAfterRefresh.isEnabled()}\n`);
  } catch (error) {
    console.error('   Error:', (error as Error).message);
  }

  // Example 6: Cache configuration from environment
  console.log('6. Configuration from Environment Variables\n');

  // Set these environment variables:
  // - ZENMANAGE_CACHE_TTL=1800
  // - ZENMANAGE_CACHE_BACKEND=memory
  // - ZENMANAGE_CACHE_DIR=/tmp/custom-cache

  console.log('   Environment variables:');
  console.log(`   - ZENMANAGE_CACHE_TTL: ${process.env.ZENMANAGE_CACHE_TTL || 'not set'}`);
  console.log(`   - ZENMANAGE_CACHE_BACKEND: ${process.env.ZENMANAGE_CACHE_BACKEND || 'not set'}`);
  console.log(`   - ZENMANAGE_CACHE_DIR: ${process.env.ZENMANAGE_CACHE_DIR || 'not set'}`);

  const envZenmanage = new Zenmanage(
    ConfigBuilder.fromEnvironment().build()
  );

  console.log('   ✓ Configuration loaded from environment\n');

  // Example 7: Cache performance comparison
  console.log('7. Cache Performance Comparison\n');

  const iterations = 5;

  // Memory cache
  console.log('   Testing memory cache:');
  const memoryStart = Date.now();
  for (let i = 0; i < iterations; i++) {
    await memoryZenmanage.flags().single('example-flag', true);
  }
  const memoryTime = Date.now() - memoryStart;
  console.log(`   ${iterations} fetches: ${memoryTime}ms (${(memoryTime / iterations).toFixed(2)}ms avg)\n`);

  // Null cache (always fetches from API)
  console.log('   Testing null cache (direct API):');
  console.log('   Note: This will be slower due to network requests');
  // Uncomment to test (will make actual API calls):
  // const nullStart = Date.now();
  // for (let i = 0; i < iterations; i++) {
  //   await nullCacheZenmanage.flags().single('example-flag', true);
  // }
  // const nullTime = Date.now() - nullStart;
  // console.log(`   ${iterations} fetches: ${nullTime}ms (${(nullTime / iterations).toFixed(2)}ms avg)\n`);
  console.log('   (Skipped to avoid excessive API calls)\n');

  console.log('Examples completed!');
  console.log('\nCache Selection Guide:');
  console.log('  - Memory: Most applications, serverless, default choice');
  console.log('  - Filesystem: Long-running servers, Node.js only');
  console.log('  - Null: Testing, debugging, always need fresh data');
  console.log('\nTTL Selection Guide:');
  console.log('  - Short (60s): Frequently changing flags');
  console.log('  - Medium (3600s): Most use cases, good balance');
  console.log('  - Long (86400s): Stable configuration values');
}

main().catch(console.error);
