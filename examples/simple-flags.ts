/**
 * Simple Flag Operations
 *
 * This example demonstrates basic flag retrieval and type-safe value access.
 */

import { Zenmanage, ConfigBuilder } from '../src';

async function main() {
  console.log('=== Simple Flag Operations ===\n');

  const zenmanage = new Zenmanage(
    ConfigBuilder.create()
      .withEnvironmentToken(process.env.ZENMANAGE_ENVIRONMENT_TOKEN || 'tok_your_token_here')
      .build()
  );

  // Example 1: Boolean flags
  console.log('1. Boolean Flags\n');

  try {
    const boolFlag = await zenmanage.flags().single('example-boolean-flag', false);
    console.log(`   Boolean Flag: ${boolFlag.asBool()}`);

    const enabledFlag = await zenmanage.flags().single('example-feature-enabled', true);
    console.log(`   Feature Enabled: ${enabledFlag.isEnabled() ? 'Yes' : 'No'}\n`);
  } catch (error) {
    console.error('   Error fetching boolean flags:', (error as Error).message);
  }

  // Example 2: String flags
  console.log('2. String Flags\n');

  try {
    const stringFlag = await zenmanage.flags().single('example-string-flag', 'default-value');
    console.log(`   String Flag: ${stringFlag.asString()}`);

    const variantFlag = await zenmanage.flags().single('example-variant-flag', 'control');
    console.log(`   Variant Flag: ${variantFlag.asString()}\n`);
  } catch (error) {
    console.error('   Error fetching string flags:', (error as Error).message);
  }

  // Example 3: Number flags
  console.log('3. Number Flags\n');

  try {
    const numberFlag = await zenmanage.flags().single('example-number-flag', 0);
    console.log(`   Number Flag: ${numberFlag.asNumber()}`);

    const limitFlag = await zenmanage.flags().single('example-limit-flag', 100);
    console.log(`   Limit Flag: ${limitFlag.asNumber()}\n`);
  } catch (error) {
    console.error('   Error fetching number flags:', (error as Error).message);
  }

  // Example 4: Get all flags
  console.log('4. Retrieving All Flags\n');

  try {
    const flags = await zenmanage.flags().all();
    console.log(`   Total flags: ${flags.length}\n`);

    for (const flag of flags) {
      let value: string;
      if (flag.getType() === 'boolean') {
        value = flag.isEnabled() ? 'enabled' : 'disabled';
      } else {
        value = String(flag.getValue());
      }
      console.log(`   - ${flag.getKey()} (${flag.getType()}): ${value}`);
    }
  } catch (error) {
    console.error('   Error fetching all flags:', (error as Error).message);
  }

  console.log('\n=== Type-Safe Access ===\n');

  try {
    const flag = await zenmanage.flags().single('example-number-flag', 42);

    console.log(`   getValue(): ${flag.getValue()}`);
    console.log(`   asString(): ${flag.asString()}`);
    console.log(`   asNumber(): ${flag.asNumber()}`);
    console.log(`   asBool(): ${flag.asBool()}`);
    console.log(`   isEnabled(): ${flag.isEnabled()}\n`);
  } catch (error) {
    console.error('   Error:', (error as Error).message);
  }

  console.log('Examples completed!');
}

main().catch(console.error);
