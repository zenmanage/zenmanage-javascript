/**
 * Context-Based Flag Evaluation
 *
 * This example demonstrates how to use contexts to evaluate flags with rules.
 * Contexts allow you to pass information about the user, organization, or other
 * entities that influence flag evaluation based on server-side rules.
 */

import { Zenmanage, ConfigBuilder, Context, Attribute } from '../src';

async function main() {
  console.log('=== Context-Based Flag Evaluation ===\n');

  const zenmanage = new Zenmanage(
    ConfigBuilder.create()
      .withEnvironmentToken(process.env.ZENMANAGE_ENVIRONMENT_TOKEN || 'tok_your_token_here')
      .build()
  );

  // Example 1: Simple user context
  console.log('1. Simple User Context\n');

  const userContext = Context.single('user', 'user-12345', 'John Doe');

  console.log(`   Context Type: ${userContext.getType()}`);
  console.log(`   Context Identifier: ${userContext.getIdentifier()}`);
  console.log(`   Context Name: ${userContext.getName()}\n`);

  try {
    const flagWithContext = await zenmanage
      .flags()
      .withContext(userContext)
      .single('feature-new-ui', false);

    console.log(
      `   Flag 'feature-new-ui' for user: ${flagWithContext.isEnabled() ? 'enabled' : 'disabled'}\n`
    );
  } catch (error) {
    console.error('   Error:', (error as Error).message);
  }

  // Example 2: Organization context
  console.log('2. Organization Context\n');

  const orgContext = Context.single('organization', 'org-acme-corp', 'Acme Corporation');

  console.log(`   Context Type: ${orgContext.getType()}`);
  console.log(`   Context Identifier: ${orgContext.getIdentifier()}`);
  console.log(`   Context Name: ${orgContext.getName()}\n`);

  try {
    const flagForOrg = await zenmanage
      .flags()
      .withContext(orgContext)
      .single('enterprise-feature', false);

    console.log(
      `   Flag 'enterprise-feature' for org: ${flagForOrg.isEnabled() ? 'enabled' : 'disabled'}\n`
    );
  } catch (error) {
    console.error('   Error:', (error as Error).message);
  }

  // Example 3: Context with attributes
  console.log('3. User Context with Custom Attributes\n');

  const userWithAttrs = new Context('user', 'Jane Smith', 'user-98765', [
    new Attribute('subscription_plan', ['premium', 'annual']),
    new Attribute('country', ['US']),
    new Attribute('signup_date', ['2024-01-15']),
  ]);

  console.log(`   User: ${userWithAttrs.getName()}`);
  const planAttr = userWithAttrs.getAttribute('subscription_plan');
  if (planAttr) {
    console.log(`   Subscription Plan: ${planAttr.getValues().join(', ')}`);
  }
  const countryAttr = userWithAttrs.getAttribute('country');
  if (countryAttr) {
    console.log(`   Country: ${countryAttr.getValues().join(', ')}`);
  }
  console.log();

  try {
    const premiumFlag = await zenmanage
      .flags()
      .withContext(userWithAttrs)
      .single('premium-feature', false);

    console.log(
      `   Flag 'premium-feature' for premium user: ${premiumFlag.isEnabled() ? 'enabled' : 'disabled'}\n`
    );
  } catch (error) {
    console.error('   Error:', (error as Error).message);
  }

  // Example 4: Creating context from object
  console.log('4. Context from Object\n');

  const contextData = {
    type: 'user',
    name: 'Bob Johnson',
    identifier: 'user-55555',
    attributes: [
      {
        key: 'region',
        values: [{ value: 'west-coast' }],
      },
      {
        key: 'beta_tester',
        values: [{ value: 'true' }],
      },
    ],
  };

  const contextFromObj = Context.fromObject(contextData);

  console.log(`   User: ${contextFromObj.getName()}`);
  console.log(`   Identifier: ${contextFromObj.getIdentifier()}`);
  const regionAttr = contextFromObj.getAttribute('region');
  if (regionAttr) {
    console.log(`   Region: ${regionAttr.getValues().join(', ')}`);
  }
  console.log();

  try {
    const betaFlag = await zenmanage
      .flags()
      .withContext(contextFromObj)
      .single('beta-features', false);

    console.log(
      `   Flag 'beta-features' for beta tester: ${betaFlag.isEnabled() ? 'enabled' : 'disabled'}\n`
    );
  } catch (error) {
    console.error('   Error:', (error as Error).message);
  }

  // Example 5: Multiple attributes for complex targeting
  console.log('5. Complex Targeting with Multiple Attributes\n');

  const complexContext = new Context('user', 'Complex User', 'user-complex', [
    new Attribute('country', ['US']),
    new Attribute('plan', ['enterprise']),
    new Attribute('company_size', ['500']),
    new Attribute('industry', ['technology']),
  ]);

  try {
    const targetedFlag = await zenmanage
      .flags()
      .withContext(complexContext)
      .single('advanced-analytics', false);

    console.log(
      `   Flag 'advanced-analytics': ${targetedFlag.isEnabled() ? 'enabled' : 'disabled'}`
    );
    console.log(`   Value type: ${targetedFlag.getType()}`);
    console.log(`   Raw value: ${targetedFlag.getValue()}\n`);
  } catch (error) {
    console.error('   Error:', (error as Error).message);
  }

  console.log('Examples completed!');
}

main().catch(console.error);
