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
          clauses: [{ attribute: 'country', operator: 'equal', value: 'US' }],
          value: { value: { boolean: true } },
        },
        {
          clauses: [{ attribute: 'country', operator: 'equal', value: 'CA' }],
          value: { value: { boolean: false } },
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
          clauses: [{ attribute: 'country', operator: 'equal', value: 'US' }],
          value: { value: { boolean: true } },
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
          clauses: [{ attribute: 'plan', operator: 'equal', value: 'premium' }],
          value: { value: { boolean: true } },
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
          clauses: [{ attribute: 'plan', operator: 'equal', value: 'premium' }],
          value: { value: { boolean: true } },
        },
      ];

      const context = new Context('user');
      context.addAttribute(new Attribute('plan', ['basic']));

      const result = engine.evaluate(rules, context);
      expect(result).toBeNull();
    });
  });

  describe('notequal operator', () => {
    it('should match different values', () => {
      const rules: Rule[] = [
        {
          clauses: [{ attribute: 'plan', operator: 'notequal', value: 'basic' }],
          value: { value: { boolean: true } },
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
          value: { value: { boolean: true } },
        },
      ];

      const context = new Context('user');
      context.addAttribute(new Attribute('email', ['john@acme.com']));

      const result = engine.evaluate(rules, context);
      expect(result).toBe(rules[0]);
    });
  });

  describe('notcontains operator', () => {
    it('should match when value does not contain substring', () => {
      const rules: Rule[] = [
        {
          clauses: [{ attribute: 'email', operator: 'notcontains', value: '@other.com' }],
          value: { value: { boolean: true } },
        },
      ];

      const context = new Context('user');
      context.addAttribute(new Attribute('email', ['john@acme.com']));

      const result = engine.evaluate(rules, context);
      expect(result).toBe(rules[0]);
    });

    it('should not match when value contains substring', () => {
      const rules: Rule[] = [
        {
          clauses: [{ attribute: 'email', operator: 'notcontains', value: '@acme.com' }],
          value: { value: { boolean: true } },
        },
      ];

      const context = new Context('user');
      context.addAttribute(new Attribute('email', ['john@acme.com']));

      const result = engine.evaluate(rules, context);
      expect(result).toBeNull();
    });
  });

  describe('in operator', () => {
    it('should match when value is in list', () => {
      const rules: Rule[] = [
        {
          clauses: [{ attribute: 'country', operator: 'in', value: ['US', 'CA', 'UK'] }],
          value: { value: { boolean: true } },
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
          value: { value: { boolean: true } },
        },
      ];

      const context = new Context('user');
      context.addAttribute(new Attribute('country', ['UK']));

      const result = engine.evaluate(rules, context);
      expect(result).toBeNull();
    });
  });

  describe('startswith operator', () => {
    it('should match when value starts with prefix', () => {
      const rules: Rule[] = [
        {
          clauses: [{ attribute: 'user_id', operator: 'startswith', value: 'user-' }],
          value: { value: { boolean: true } },
        },
      ];

      const context = new Context('user');
      context.addAttribute(new Attribute('user_id', ['user-12345']));

      const result = engine.evaluate(rules, context);
      expect(result).toBe(rules[0]);
    });
  });

  describe('notstartswith operator', () => {
    it('should match when value does not start with prefix', () => {
      const rules: Rule[] = [
        {
          clauses: [{ attribute: 'user_id', operator: 'notstartswith', value: 'admin-' }],
          value: { value: { boolean: true } },
        },
      ];

      const context = new Context('user');
      context.addAttribute(new Attribute('user_id', ['user-12345']));

      const result = engine.evaluate(rules, context);
      expect(result).toBe(rules[0]);
    });
  });

  describe('endswith operator', () => {
    it('should match when value ends with suffix', () => {
      const rules: Rule[] = [
        {
          clauses: [{ attribute: 'email', operator: 'endswith', value: '@acme.com' }],
          value: { value: { boolean: true } },
        },
      ];

      const context = new Context('user');
      context.addAttribute(new Attribute('email', ['john@acme.com']));

      const result = engine.evaluate(rules, context);
      expect(result).toBe(rules[0]);
    });
  });

  describe('notendswith operator', () => {
    it('should match when value does not end with suffix', () => {
      const rules: Rule[] = [
        {
          clauses: [{ attribute: 'email', operator: 'notendswith', value: '@internal.com' }],
          value: { value: { boolean: true } },
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
          value: { value: { boolean: true } },
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
          value: { value: { boolean: true } },
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
          value: { value: { boolean: true } },
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
          value: { value: { boolean: true } },
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
            { attribute: 'country', operator: 'equal', value: 'US' },
            { attribute: 'plan', operator: 'equal', value: 'premium' },
          ],
          value: { value: { boolean: true } },
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
          clauses: [{ attribute: 'nonexistent', operator: 'equal', value: 'value' }],
          value: { value: { boolean: true } },
        },
      ];

      const context = new Context('user');
      const result = engine.evaluate(rules, context);
      expect(result).toBeNull();
    });

    it('should match isnull when attribute is absent', () => {
      const rules: Rule[] = [
        {
          clauses: [{ attribute: 'nonexistent', operator: 'isnull', value: undefined }],
          value: { value: { boolean: true } },
        },
      ];

      const context = new Context('user');
      const result = engine.evaluate(rules, context);
      expect(result).not.toBeNull();
    });

    it('should match isnull when attribute value is empty string', () => {
      const rules: Rule[] = [
        {
          clauses: [{ attribute: 'tag', operator: 'isnull', value: undefined }],
          value: { value: { boolean: true } },
        },
      ];

      const context = new Context('user');
      context.addAttribute(new Attribute('tag', ['']));
      const result = engine.evaluate(rules, context);
      expect(result).not.toBeNull();
    });

    it('should match notnull when attribute has a value', () => {
      const rules: Rule[] = [
        {
          clauses: [{ attribute: 'tag', operator: 'notnull', value: undefined }],
          value: { value: { boolean: true } },
        },
      ];

      const context = new Context('user');
      context.addAttribute(new Attribute('tag', ['active']));
      const result = engine.evaluate(rules, context);
      expect(result).not.toBeNull();
    });

    it('should not match notnull when attribute is absent', () => {
      const rules: Rule[] = [
        {
          clauses: [{ attribute: 'nonexistent', operator: 'notnull', value: undefined }],
          value: { value: { boolean: true } },
        },
      ];

      const context = new Context('user');
      const result = engine.evaluate(rules, context);
      expect(result).toBeNull();
    });

    it('should match notequal when attribute is absent', () => {
      const rules: Rule[] = [
        {
          clauses: [{ attribute: 'nonexistent', operator: 'notequal', value: 'x' }],
          value: { value: { boolean: true } },
        },
      ];

      const context = new Context('user');
      const result = engine.evaluate(rules, context);
      expect(result).not.toBeNull();
    });
  });

  describe('context target rules', () => {
    it('should match context target when type and identifier both match', () => {
      const rules: Rule[] = [
        {
          clauses: [
            {
              attribute: 'context',
              operator: 'equal',
              value: { identifier: 'user-123', type: 'user' },
            },
          ],
          value: { value: { boolean: true } },
        },
      ];

      const context = Context.single('user', 'user-123');

      const result = engine.evaluate(rules, context);
      expect(result).toBe(rules[0]);
    });

    it('should not match context target when type differs', () => {
      const rules: Rule[] = [
        {
          clauses: [
            {
              attribute: 'context',
              operator: 'equal',
              value: { identifier: 'user-123', type: 'organization' },
            },
          ],
          value: { value: { boolean: true } },
        },
      ];

      const context = Context.single('user', 'user-123');

      const result = engine.evaluate(rules, context);
      expect(result).toBeNull();
    });

    it('should match context target by identifier only when rule type is null', () => {
      const rules: Rule[] = [
        {
          clauses: [
            {
              attribute: 'context',
              operator: 'equal',
              value: { identifier: 'shared-id', type: null },
            },
          ],
          value: { value: { boolean: true } },
        },
      ];

      const context = Context.single('organization', 'shared-id');

      const result = engine.evaluate(rules, context);
      expect(result).toBe(rules[0]);
    });

    it('should match segment target by identifier when segment type is null', () => {
      const rules: Rule[] = [
        {
          clauses: [
            {
              attribute: 'segment',
              operator: 'equal',
              value: { identifier: 'beta-1', type: null },
            },
          ],
          value: { value: { boolean: true } },
        },
      ];

      const context = Context.single('user', 'beta-1');

      const result = engine.evaluate(rules, context);
      expect(result).toBe(rules[0]);
    });
  });
});
