/**
 * Default Values Example
 *
 * This example demonstrates how to use default values to ensure your application
 * works even when flags are not found or the API is unavailable.
 */

import { Zenmanage, ConfigBuilder, DefaultsCollection } from '../src';

async function main() {
  console.log('=== Default Values Example ===\n');

  const zenmanage = new Zenmanage(
    ConfigBuilder.create()
      .withEnvironmentToken(process.env.ZENMANAGE_ENVIRONMENT_TOKEN || 'tok_your_token_here')
      .build()
  );

  // Example 1: Inline default values (highest priority)
  console.log('1. Inline Default Values\n');

  try {
    // Even if the flag doesn't exist, we get the default value
    const flag1 = await zenmanage.flags().single('non-existent-flag', true);
    console.log(`   non-existent-flag: ${flag1.isEnabled()}`);

    const flag2 = await zenmanage.flags().single('non-existent-string', 'default-value');
    console.log(`   non-existent-string: ${flag2.asString()}`);

    const flag3 = await zenmanage.flags().single('non-existent-number', 42);
    console.log(`   non-existent-number: ${flag3.asNumber()}\n`);
  } catch (error) {
    console.error('   Error:', (error as Error).message);
  }

  // Example 2: DefaultsCollection for multiple defaults
  console.log('2. DefaultsCollection\n');

  const defaults = DefaultsCollection.fromObject({
    'feature-new-ui': true,
    'api-version': 'v2',
    'max-items-per-page': 50,
    'enable-analytics': false,
    'theme': 'dark',
  });

  console.log(`   Defaults configured: ${defaults.size()}`);
  console.log(`   Keys: ${defaults.keys().join(', ')}\n`);

  const flagManager = zenmanage.flags().withDefaults(defaults);

  try {
    // These will use defaults if flags don't exist in the API
    const uiFlag = await flagManager.single('feature-new-ui');
    console.log(`   feature-new-ui: ${uiFlag.isEnabled()}`);

    const apiFlag = await flagManager.single('api-version');
    console.log(`   api-version: ${apiFlag.asString()}`);

    const itemsFlag = await flagManager.single('max-items-per-page');
    console.log(`   max-items-per-page: ${itemsFlag.asNumber()}`);

    const analyticsFlag = await flagManager.single('enable-analytics');
    console.log(`   enable-analytics: ${analyticsFlag.isEnabled()}`);

    const themeFlag = await flagManager.single('theme');
    console.log(`   theme: ${themeFlag.asString()}\n`);
  } catch (error) {
    console.error('   Error:', (error as Error).message);
  }

  // Example 3: Priority of defaults
  console.log('3. Default Value Priority\n');

  const defaultsForPriority = new DefaultsCollection();
  defaultsForPriority.set('test-flag', 'from-collection');

  const managerWithDefaults = zenmanage.flags().withDefaults(defaultsForPriority);

  try {
    // Inline default has highest priority
    const inlineFlag = await managerWithDefaults.single('test-flag', 'from-inline');
    console.log(`   With inline default: ${inlineFlag.asString()}`);

    // Collection default is used if no inline default
    const collectionFlag = await managerWithDefaults.single('test-flag');
    console.log(`   With collection default: ${collectionFlag.asString()}`);

    // API value would have highest priority (if flag exists in API)
    console.log('   Note: API values override all defaults when available\n');
  } catch (error) {
    console.error('   Error:', (error as Error).message);
  }

  // Example 4: Building defaults dynamically
  console.log('4. Dynamic Defaults\n');

  const dynamicDefaults = new DefaultsCollection();

  // Add defaults one by one
  dynamicDefaults
    .set('feature-a', true)
    .set('feature-b', false)
    .set('feature-c', true);

  console.log(`   Initial defaults: ${dynamicDefaults.size()}`);

  // Check if a default exists
  if (dynamicDefaults.has('feature-a')) {
    console.log('   feature-a default exists');
  }

  // Get a specific default
  const defaultValue = dynamicDefaults.get('feature-a');
  console.log(`   feature-a default value: ${defaultValue}`);

  // Remove a default
  dynamicDefaults.delete('feature-b');
  console.log(`   After deletion: ${dynamicDefaults.size()}`);

  // Clear all defaults
  dynamicDefaults.clear();
  console.log(`   After clear: ${dynamicDefaults.size()}\n`);

  // Example 5: Graceful degradation
  console.log('5. Graceful Degradation Pattern\n');

  // Configure defaults for all critical features
  const productionDefaults = DefaultsCollection.fromObject({
    'maintenance-mode': false,
    'new-checkout': false, // Conservative default
    'payment-gateway': 'primary',
    'max-retries': 3,
    'timeout-seconds': 30,
  });

  const productionFlags = zenmanage.flags().withDefaults(productionDefaults);

  try {
    // Even if API is down, application continues with safe defaults
    const maintenanceMode = await productionFlags.single('maintenance-mode');
    if (maintenanceMode.isEnabled()) {
      console.log('   🚧 Application in maintenance mode');
    } else {
      console.log('   ✓ Application operational');
    }

    const paymentGateway = await productionFlags.single('payment-gateway');
    console.log(`   Payment gateway: ${paymentGateway.asString()}`);

    const maxRetries = await productionFlags.single('max-retries');
    console.log(`   Max retries: ${maxRetries.asNumber()}`);

    const timeout = await productionFlags.single('timeout-seconds');
    console.log(`   Timeout: ${timeout.asNumber()}s\n`);
  } catch (error) {
    console.error('   Error:', (error as Error).message);
  }

  // Example 6: Environment-specific defaults
  console.log('6. Environment-Specific Defaults\n');

  const environment = process.env.NODE_ENV || 'development';

  let envDefaults: DefaultsCollection;

  if (environment === 'production') {
    envDefaults = DefaultsCollection.fromObject({
      'debug-mode': false,
      'verbose-logging': false,
      'cache-enabled': true,
    });
  } else if (environment === 'staging') {
    envDefaults = DefaultsCollection.fromObject({
      'debug-mode': true,
      'verbose-logging': true,
      'cache-enabled': true,
    });
  } else {
    // development
    envDefaults = DefaultsCollection.fromObject({
      'debug-mode': true,
      'verbose-logging': true,
      'cache-enabled': false,
    });
  }

  console.log(`   Environment: ${environment}`);
  console.log(`   Defaults configured: ${envDefaults.size()}`);

  const envFlags = zenmanage.flags().withDefaults(envDefaults);

  try {
    const debugMode = await envFlags.single('debug-mode');
    console.log(`   debug-mode: ${debugMode.isEnabled()}`);

    const verboseLogging = await envFlags.single('verbose-logging');
    console.log(`   verbose-logging: ${verboseLogging.isEnabled()}`);

    const cacheEnabled = await envFlags.single('cache-enabled');
    console.log(`   cache-enabled: ${cacheEnabled.isEnabled()}\n`);
  } catch (error) {
    console.error('   Error:', (error as Error).message);
  }

  console.log('Examples completed!');
  console.log('\nBest Practices:');
  console.log('  - Always provide defaults for critical features');
  console.log('  - Use conservative defaults (safer values)');
  console.log('  - Inline defaults for one-off cases');
  console.log('  - DefaultsCollection for application-wide defaults');
  console.log('  - Environment-specific defaults for different stages');
}

main().catch(console.error);
