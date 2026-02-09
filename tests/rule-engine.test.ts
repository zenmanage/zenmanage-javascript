import { describe, it, expect } from 'vitest';
import { RuleEngine } from '../src/rule-engine';
import { Context, Attribute } from '../src/context';
import type { Rule } from '../src/types';

describe('RuleEngine', () => {
  const engine = new RuleEngine();

  describe('evaluate', () => {
    it('should return null when no rules provided', () => {
      const context = new Context('user');
      const result = engine.evaluate([], context);
      expect(result).toBeNull();
    });

    it('should return first matching rule', () => {
      const rules: Rule[] = [
        {
          clauses: [{ attribute: 'country', operator: 'equals', value: 'US' }],
          target: { value: { boolean: true } },
        },
        {
          clauses: [{ attribute: 'country', operator: 'equals', value: 'CA' }],
          target: { value: { boolean: false } },
        },
      ];

      const context = new Context('user');
      context.addAttribute(new Attribute('country', ['US']));

      const result = engine.evaluate(rules, context);
      expect(result).toBe(rules[0]);
    });

    it('should return null when no rules match', () => {
      const rules: Rule[] = [
        {
          clauses: [{ attribute: 'country', operator: 'equals', value: 'US' }],
          target: { value: { boolean: true } },
        },
      ];

      const context = new Context('user');
      context.addAttribute(new Attribute('country', ['UK']));

      const result = engine.evaluate(rules, context);
      expect(result).toBeNull();
    });
  });

  describe('equals operator', () => {
    it('should match equal values', () => {
      const rules: Rule[] = [
        {
          clauses: [{ attribute: 'plan', operator: 'equals', value: 'premium' }],
          target: { value: { boolean: true } },
        },
      ];

      const context = new Context('user');
      context.addAttribute(new Attribute('plan', ['premium']));

      const result = engine.evaluate(rules, context);
      expect(result).toBe(rules[0]);
    });

    it('should not match different values', () => {
      const rules: Rule[] = [
        {
          clauses: [{ attribute: 'plan', operator: 'equals', value: 'premium' }],
          target: { value: { boolean: true } },
        },
      ];

      const context = new Context('user');
      context.addAttribute(new Attribute('plan', ['basic']));

      const result = engine.evaluate(rules, context);
      expect(result).toBeNull();
    });
  });

  describe('not_equals operator', () => {
    it('should match different values', () => {
      const rules: Rule[] = [
        {
          clauses: [{ attribute: 'plan', operator: 'not_equals', value: 'basic' }],
          target: { value: { boolean: true } },
        },
      ];

      const context = new Context('user');
      context.addAttribute(new Attribute('plan', ['premium']));

      const result = engine.evaluate(rules, context);
      expect(result).toBe(rules[0]);
    });
  });

  describe('contains operator', () => {
    it('should match when value contains substring', () => {
      const rules: Rule[] = [
        {
          clauses: [{ attribute: 'email', operator: 'contains', value: '@acme.com' }],
          target: { value: { boolean: true } },
        },
      ];

      const context = new Context('user');
      context.addAttribute(new Attribute('email', ['john@acme.com']));

      const result = engine.evaluate(rules, context);
      expect(result).toBe(rules[0]);
    });
  });

  describe('in operator', () => {
    it('should match when value is in list', () => {
      const rules: Rule[] = [
        {
          clauses: [{ attribute: 'country', operator: 'in', value: ['US', 'CA', 'UK'] }],
          target: { value: { boolean: true } },
        },
      ];

      const context = new Context('user');
      context.addAttribute(new Attribute('country', ['CA']));

      const result = engine.evaluate(rules, context);
      expect(result).toBe(rules[0]);
    });

    it('should not match when value is not in list', () => {
      const rules: Rule[] = [
        {
          clauses: [{ attribute: 'country', operator: 'in', value: ['US', 'CA'] }],
          target: { value: { boolean: true } },
        },
      ];

      const context = new Context('user');
      context.addAttribute(new Attribute('country', ['UK']));

      const result = engine.evaluate(rules, context);
      expect(result).toBeNull();
    });
  });

  describe('starts_with operator', () => {
    it('should match when value starts with prefix', () => {
      const rules: Rule[] = [
        {
          clauses: [{ attribute: 'user_id', operator: 'starts_with', value: 'user-' }],
          target: { value: { boolean: true } },
        },
      ];

      const context = new Context('user');
      context.addAttribute(new Attribute('user_id', ['user-12345']));

      const result = engine.evaluate(rules, context);
      expect(result).toBe(rules[0]);
    });
  });

  describe('ends_with operator', () => {
    it('should match when value ends with suffix', () => {
      const rules: Rule[] = [
        {
          clauses: [{ attribute: 'email', operator: 'ends_with', value: '@acme.com' }],
          target: { value: { boolean: true } },
        },
      ];

      const context = new Context('user');
      context.addAttribute(new Attribute('email', ['john@acme.com']));

      const result = engine.evaluate(rules, context);
      expect(result).toBe(rules[0]);
    });
  });

  describe('numeric comparison operators', () => {
    it('should match gt (greater than)', () => {
      const rules: Rule[] = [
        {
          clauses: [{ attribute: 'age', operator: 'gt', value: '18' }],
          target: { value: { boolean: true } },
        },
      ];

      const context = new Context('user');
      context.addAttribute(new Attribute('age', ['25']));

      const result = engine.evaluate(rules, context);
      expect(result).toBe(rules[0]);
    });

    it('should match gte (greater than or equal)', () => {
      const rules: Rule[] = [
        {
          clauses: [{ attribute: 'age', operator: 'gte', value: '18' }],
          target: { value: { boolean: true } },
        },
      ];

      const context = new Context('user');
      context.addAttribute(new Attribute('age', ['18']));

      const result = engine.evaluate(rules, context);
      expect(result).toBe(rules[0]);
    });

    it('should match lt (less than)', () => {
      const rules: Rule[] = [
        {
          clauses: [{ attribute: 'age', operator: 'lt', value: '18' }],
          target: { value: { boolean: true } },
        },
      ];

      const context = new Context('user');
      context.addAttribute(new Attribute('age', ['15']));

      const result = engine.evaluate(rules, context);
      expect(result).toBe(rules[0]);
    });

    it('should match lte (less than or equal)', () => {
      const rules: Rule[] = [
        {
          clauses: [{ attribute: 'age', operator: 'lte', value: '18' }],
          target: { value: { boolean: true } },
        },
      ];

      const context = new Context('user');
      context.addAttribute(new Attribute('age', ['18']));

      const result = engine.evaluate(rules, context);
      expect(result).toBe(rules[0]);
    });
  });

  describe('multiple clauses', () => {
    it('should require all clauses to match (AND logic)', () => {
      const rules: Rule[] = [
        {
          clauses: [
            { attribute: 'country', operator: 'equals', value: 'US' },
            { attribute: 'plan', operator: 'equals', value: 'premium' },
          ],
          target: { value: { boolean: true } },
        },
      ];

      // Both match
      let context = new Context('user');
      context.addAttribute(new Attribute('country', ['US']));
      context.addAttribute(new Attribute('plan', ['premium']));
      expect(engine.evaluate(rules, context)).toBe(rules[0]);

      // Only first matches
      context = new Context('user');
      context.addAttribute(new Attribute('country', ['US']));
      context.addAttribute(new Attribute('plan', ['basic']));
      expect(engine.evaluate(rules, context)).toBeNull();

      // Only second matches
      context = new Context('user');
      context.addAttribute(new Attribute('country', ['CA']));
      context.addAttribute(new Attribute('plan', ['premium']));
      expect(engine.evaluate(rules, context)).toBeNull();
    });
  });

  describe('missing attributes', () => {
    it('should not match when attribute is missing', () => {
      const rules: Rule[] = [
        {
          clauses: [{ attribute: 'nonexistent', operator: 'equals', value: 'value' }],
          target: { value: { boolean: true } },
        },
      ];

      const context = new Context('user');
      const result = engine.evaluate(rules, context);
      expect(result).toBeNull();
    });
  });
});
