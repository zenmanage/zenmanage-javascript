/**
 * A/B Testing Example
 *
 * This example demonstrates how to use Zenmanage for A/B testing and experiments.
 * You can use string flags to represent different variants and target them to
 * specific user segments.
 */

import { Zenmanage, ConfigBuilder, Context, Attribute } from '../src';

async function main() {
  console.log('=== A/B Testing with Zenmanage ===\n');

  const zenmanage = new Zenmanage(
    ConfigBuilder.create()
      .withEnvironmentToken(process.env.ZENMANAGE_ENVIRONMENT_TOKEN || 'tok_your_token_here')
      .build()
  );

  // Example 1: Simple A/B test (two variants)
  console.log('1. Simple A/B Test - Checkout Flow\n');

  const users = [
    { id: 'user-001', name: 'Alice', country: 'US' },
    { id: 'user-002', name: 'Bob', country: 'CA' },
    { id: 'user-003', name: 'Charlie', country: 'UK' },
  ];

  for (const user of users) {
    const context = new Context('user', user.name, user.id, [
      new Attribute('country', [user.country]),
    ]);

    try {
      const variant = await zenmanage
        .flags()
        .withContext(context)
        .single('checkout-flow', 'control');

      console.log(`   ${user.name} (${user.country}): ${variant.asString()}`);

      // In your application, you would route based on the variant:
      if (variant.asString() === 'one-page') {
        // Show one-page checkout
      } else if (variant.asString() === 'multi-page') {
        // Show multi-page checkout
      } else {
        // Show control (original) checkout
      }
    } catch (error) {
      console.error(`   Error for ${user.name}:`, (error as Error).message);
    }
  }

  console.log();

  // Example 2: Multi-variant test (A/B/C test)
  console.log('2. Multi-Variant Test - Landing Page\n');

  const visitors = [
    { id: 'visitor-001', source: 'google', device: 'mobile' },
    { id: 'visitor-002', source: 'facebook', device: 'desktop' },
    { id: 'visitor-003', source: 'direct', device: 'tablet' },
    { id: 'visitor-004', source: 'google', device: 'desktop' },
  ];

  for (const visitor of visitors) {
    const context = new Context('user', undefined, visitor.id, [
      new Attribute('traffic_source', [visitor.source]),
      new Attribute('device_type', [visitor.device]),
    ]);

    try {
      const variant = await zenmanage
        .flags()
        .withContext(context)
        .single('landing-page-variant', 'original');

      console.log(
        `   Visitor ${visitor.id} (${visitor.source}/${visitor.device}): ${variant.asString()}`
      );

      // Route to different landing pages
      switch (variant.asString()) {
        case 'hero-focused':
          // Show landing page with large hero section
          break;
        case 'form-focused':
          // Show landing page with prominent signup form
          break;
        case 'testimonial-focused':
          // Show landing page with customer testimonials
          break;
        default:
          // Show original landing page
          break;
      }
    } catch (error) {
      console.error(`   Error for visitor ${visitor.id}:`, (error as Error).message);
    }
  }

  console.log();

  // Example 3: Percentage rollout
  console.log('3. Gradual Rollout - New Search Algorithm\n');

  // Simulate multiple users
  const testUsers = Array.from({ length: 10 }, (_, i) => ({
    id: `user-${String(i).padStart(3, '0')}`,
    name: `User ${i}`,
  }));

  let newAlgorithmCount = 0;

  for (const user of testUsers) {
    const context = Context.single('user', user.id, user.name);

    try {
      const flag = await zenmanage
        .flags()
        .withContext(context)
        .single('new-search-algorithm', false);

      if (flag.isEnabled()) {
        newAlgorithmCount++;
        console.log(`   ✓ ${user.name}: New algorithm`);
        // Use new search algorithm
      } else {
        console.log(`   ✗ ${user.name}: Old algorithm`);
        // Use old search algorithm
      }
    } catch (error) {
      console.error(`   Error for ${user.name}:`, (error as Error).message);
    }
  }

  console.log(
    `\n   ${newAlgorithmCount}/${testUsers.length} users on new algorithm (${((newAlgorithmCount / testUsers.length) * 100).toFixed(0)}%)\n`
  );

  // Example 4: Feature flag with metrics tracking
  console.log('4. A/B Test with Usage Tracking\n');

  const context = Context.single('user', 'user-metrics-test', 'Metrics User');

  try {
    const variant = await zenmanage
      .flags()
      .withContext(context)
      .single('pricing-page-variant', 'control');

    console.log(`   User assigned to variant: ${variant.asString()}`);

    // Manually report usage (if automatic tracking is disabled)
    await zenmanage.flags().reportUsage('pricing-page-variant', context);

    console.log('   ✓ Usage tracked for analytics\n');

    // In your application, you would track conversions and metrics:
    // trackConversion('pricing-page', variant.asString());
    // trackMetric('time-on-page', variant.asString(), timeOnPage);
  } catch (error) {
    console.error('   Error:', (error as Error).message);
  }

  // Example 5: Segment-based targeting
  console.log('5. Segment-Based Experiment\n');

  const segments = [
    { segment: 'new-users', days_since_signup: 5 },
    { segment: 'active-users', days_since_signup: 180 },
    { segment: 'power-users', days_since_signup: 365 },
  ];

  for (const { segment, days_since_signup } of segments) {
    const context = new Context('user', segment, `user-${segment}`, [
      new Attribute('segment', [segment]),
      new Attribute('days_since_signup', [String(days_since_signup)]),
    ]);

    try {
      const variant = await zenmanage
        .flags()
        .withContext(context)
        .single('onboarding-flow', 'standard');

      console.log(`   ${segment}: ${variant.asString()}`);

      // Customize onboarding based on user segment
      if (variant.asString() === 'extended') {
        // Show extended onboarding with more steps
      } else if (variant.asString() === 'minimal') {
        // Show minimal onboarding for experienced users
      } else {
        // Show standard onboarding
      }
    } catch (error) {
      console.error(`   Error for ${segment}:`, (error as Error).message);
    }
  }

  console.log('\nExamples completed!');
  console.log('\nTips for A/B Testing:');
  console.log('  - Always provide a default/control variant');
  console.log('  - Use consistent variant names across your application');
  console.log('  - Enable usage reporting to track which variants are shown');
  console.log('  - Monitor metrics for each variant to determine winners');
  console.log('  - Start with small percentages and gradually increase');
}

main().catch(console.error);
