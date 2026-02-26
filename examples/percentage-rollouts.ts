/**
 * Percentage Rollouts Example
 *
 * This example demonstrates SDK-side percentage rollouts. When a flag includes
 * a `rollout` configuration, the SDK automatically buckets the context
 * identifier via CRC32B hashing and selects either the rollout value or the
 * fallback value — no manual bucketing needed.
 */

import { Zenmanage, ConfigBuilder, Context, Attribute } from '../src';

async function main() {
  console.log('=== Percentage Rollouts with Zenmanage ===\n');

  const zenmanage = new Zenmanage(
    ConfigBuilder.create()
      .withEnvironmentToken(process.env.ZENMANAGE_ENVIRONMENT_TOKEN || 'tok_your_token_here')
      .build()
  );

  // Example 1: Basic boolean rollout
  console.log('1. Basic Rollout (Boolean Flag)\n');

  const userIds = ['user-1', 'user-2', 'user-3', 'user-4', 'user-5'];

  for (const userId of userIds) {
    const context = Context.single('user', userId);

    try {
      const flag = await zenmanage.flags().withContext(context).single('new-checkout-flow');
      const enabled = flag.isEnabled();
      console.log(`   ${userId}: ${enabled ? 'IN rollout (new flow)' : 'NOT in rollout (old flow)'}`);
    } catch (error) {
      console.error(`   Error for ${userId}:`, (error as Error).message);
    }
  }

  console.log();

  // Example 2: Rollout with context attributes
  // The rollout may include rules that further filter within the rollout group
  console.log('2. Rollout with Attribute Rules\n');

  const users = [
    { id: 'user-100', country: 'US' },
    { id: 'user-200', country: 'GB' },
    { id: 'user-300', country: 'US' },
  ];

  for (const user of users) {
    const context = new Context('user', undefined, user.id, [
      new Attribute('country', [user.country]),
    ]);

    try {
      const flag = await zenmanage.flags().withContext(context).single('premium-feature', false);
      console.log(`   ${user.id} (${user.country}): ${flag.isEnabled() ? 'enabled' : 'disabled'}`);
    } catch (error) {
      console.error(`   Error for ${user.id}:`, (error as Error).message);
    }
  }

  console.log();

  // Example 3: String variant rollout
  console.log('3. String Variant Rollout\n');

  for (const userId of ['user-alpha', 'user-beta', 'user-gamma']) {
    const context = Context.single('user', userId);

    try {
      const flag = await zenmanage.flags().withContext(context).single('landing-page-variant', 'control');
      console.log(`   ${userId}: ${flag.asString()}`);
    } catch (error) {
      console.error(`   Error for ${userId}:`, (error as Error).message);
    }
  }

  console.log();

  // Example 4: Deterministic bucketing — same user always gets same result
  console.log('4. Deterministic Bucketing\n');

  const context = Context.single('user', 'consistent-user');

  try {
    const result1 = (await zenmanage.flags().withContext(context).single('rollout-flag', false)).isEnabled();
    const result2 = (await zenmanage.flags().withContext(context).single('rollout-flag', false)).isEnabled();
    const result3 = (await zenmanage.flags().withContext(context).single('rollout-flag', false)).isEnabled();

    console.log(`   Same result every time: ${result1 === result2 && result2 === result3 ? 'Yes' : 'No'}`);
  } catch (error) {
    console.error('   Error:', (error as Error).message);
  }

  console.log('\nExamples completed!');
}

main().catch(console.error);
