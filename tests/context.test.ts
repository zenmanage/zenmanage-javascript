import { describe, it, expect } from 'vitest';
import { Context, Attribute, Value } from '../src/context';

describe('Value', () => {
  it('should create a value', () => {
    const value = new Value('test-value');
    expect(value.value).toBe('test-value');
  });

  it('should serialize to JSON', () => {
    const value = new Value('test');
    expect(value.toJSON()).toEqual({ value: 'test' });
  });
});

describe('Attribute', () => {
  it('should create an attribute with values', () => {
    const attr = new Attribute('country', ['US', 'CA']);
    expect(attr.getKey()).toBe('country');
    expect(attr.getValues()).toEqual(['US', 'CA']);
  });

  it('should create an attribute with no values', () => {
    const attr = new Attribute('test');
    expect(attr.getValues()).toEqual([]);
  });

  it('should add values', () => {
    const attr = new Attribute('country', ['US']);
    attr.addValue('CA');
    expect(attr.getValues()).toEqual(['US', 'CA']);
  });

  it('should serialize to JSON', () => {
    const attr = new Attribute('country', ['US', 'CA']);
    expect(attr.toJSON()).toEqual({
      key: 'country',
      values: [{ value: 'US' }, { value: 'CA' }],
    });
  });
});

describe('Context', () => {
  describe('constructor', () => {
    it('should create a simple context', () => {
      const context = new Context('user', 'John Doe', 'user-123');
      expect(context.getType()).toBe('user');
      expect(context.getName()).toBe('John Doe');
      expect(context.getIdentifier()).toBe('user-123');
    });

    it('should create context with attributes', () => {
      const attr1 = new Attribute('country', ['US']);
      const attr2 = new Attribute('plan', ['premium']);

      const context = new Context('user', 'John Doe', 'user-123', [attr1, attr2]);

      expect(context.hasAttribute('country')).toBe(true);
      expect(context.hasAttribute('plan')).toBe(true);
      expect(context.getAttribute('country')?.getValues()).toEqual(['US']);
    });
  });

  describe('single', () => {
    it('should create a simple context', () => {
      const context = Context.single('user', 'user-123', 'John Doe');
      expect(context.getType()).toBe('user');
      expect(context.getIdentifier()).toBe('user-123');
      expect(context.getName()).toBe('John Doe');
    });

    it('should create context without name', () => {
      const context = Context.single('user', 'user-123');
      expect(context.getType()).toBe('user');
      expect(context.getIdentifier()).toBe('user-123');
      expect(context.getName()).toBeUndefined();
    });
  });

  describe('fromObject', () => {
    it('should create context from object', () => {
      const data = {
        type: 'user',
        name: 'John Doe',
        identifier: 'user-123',
        attributes: [
          {
            key: 'country',
            values: [{ value: 'US' }, { value: 'CA' }],
          },
        ],
      };

      const context = Context.fromObject(data);
      expect(context.getType()).toBe('user');
      expect(context.getName()).toBe('John Doe');
      expect(context.getIdentifier()).toBe('user-123');
      expect(context.getAttribute('country')?.getValues()).toEqual(['US', 'CA']);
    });

    it('should create context from minimal object', () => {
      const data = { type: 'user' };
      const context = Context.fromObject(data);
      expect(context.getType()).toBe('user');
      expect(context.getName()).toBeUndefined();
      expect(context.getIdentifier()).toBeUndefined();
    });
  });

  describe('attributes', () => {
    it('should add attributes', () => {
      const context = new Context('user');
      context.addAttribute(new Attribute('country', ['US']));

      expect(context.hasAttribute('country')).toBe(true);
      expect(context.getAttribute('country')?.getValues()).toEqual(['US']);
    });

    it('should get all attributes', () => {
      const context = new Context('user');
      context.addAttribute(new Attribute('country', ['US']));
      context.addAttribute(new Attribute('plan', ['premium']));

      const attrs = context.getAttributes();
      expect(attrs).toHaveLength(2);
      expect(attrs[0].getKey()).toBe('country');
      expect(attrs[1].getKey()).toBe('plan');
    });

    it('should return undefined for non-existent attribute', () => {
      const context = new Context('user');
      expect(context.getAttribute('nonexistent')).toBeUndefined();
    });
  });

  describe('toJSON', () => {
    it('should serialize to JSON', () => {
      const context = new Context('user', 'John Doe', 'user-123');
      context.addAttribute(new Attribute('country', ['US']));

      const json = context.toJSON();
      expect(json).toEqual({
        type: 'user',
        name: 'John Doe',
        identifier: 'user-123',
        attributes: [
          {
            key: 'country',
            values: [{ value: 'US' }],
          },
        ],
      });
    });

    it('should omit undefined fields', () => {
      const context = new Context('user');
      const json = context.toJSON();
      expect(json).toEqual({ type: 'user' });
      expect(json).not.toHaveProperty('name');
      expect(json).not.toHaveProperty('identifier');
    });
  });

  describe('getId (deprecated)', () => {
    it('should return identifier', () => {
      const context = new Context('user', 'John Doe', 'user-123');
      expect(context.getId()).toBe('user-123');
    });
  });
});
