import { describe, it, expect } from 'vitest';
import { Flag } from '../src/flag';
import type { FlagData } from '../src/types';

describe('Flag', () => {
  describe('constructor and getters', () => {
    it('should create a flag', () => {
      const flag = new Flag('1', 'boolean', 'test-flag', 'Test Flag', {
        value: { value: { boolean: true } },
      });

      expect(flag.getVersion()).toBe('1');
      expect(flag.getType()).toBe('boolean');
      expect(flag.getKey()).toBe('test-flag');
      expect(flag.getName()).toBe('Test Flag');
    });
  });

  describe('isEnabled', () => {
    it('should return true for enabled boolean flag', () => {
      const flag = new Flag('1', 'boolean', 'test', 'Test', {
        value: { value: { boolean: true } },
      });
      expect(flag.isEnabled()).toBe(true);
    });

    it('should return false for disabled boolean flag', () => {
      const flag = new Flag('1', 'boolean', 'test', 'Test', {
        value: { value: { boolean: false } },
      });
      expect(flag.isEnabled()).toBe(false);
    });

    it('should return false for non-boolean flags', () => {
      const stringFlag = new Flag('1', 'string', 'test', 'Test', {
        value: { value: { string: 'value' } },
      });
      expect(stringFlag.isEnabled()).toBe(false);

      const numberFlag = new Flag('1', 'number', 'test', 'Test', {
        value: { value: { number: 42 } },
      });
      expect(numberFlag.isEnabled()).toBe(false);
    });
  });

  describe('asBool', () => {
    it('should return boolean value', () => {
      const flag = new Flag('1', 'boolean', 'test', 'Test', {
        value: { value: { boolean: true } },
      });
      expect(flag.asBool()).toBe(true);
    });

    it('should convert non-boolean values', () => {
      const stringFlag = new Flag('1', 'string', 'test', 'Test', {
        value: { value: { string: 'test' } },
      });
      expect(stringFlag.asBool()).toBe(true);

      const numberFlag = new Flag('1', 'number', 'test', 'Test', {
        value: { value: { number: 0 } },
      });
      expect(numberFlag.asBool()).toBe(false);
    });
  });

  describe('asString', () => {
    it('should return string value', () => {
      const flag = new Flag('1', 'string', 'test', 'Test', {
        value: { value: { string: 'hello' } },
      });
      expect(flag.asString()).toBe('hello');
    });

    it('should convert non-string values', () => {
      const boolFlag = new Flag('1', 'boolean', 'test', 'Test', {
        value: { value: { boolean: true } },
      });
      expect(boolFlag.asString()).toBe('true');

      const numberFlag = new Flag('1', 'number', 'test', 'Test', {
        value: { value: { number: 42 } },
      });
      expect(numberFlag.asString()).toBe('42');
    });

    it('should return empty string for invalid values', () => {
      const flag = new Flag('1', 'string', 'test', 'Test', { value: { value: {} } } as any);
      expect(flag.asString()).toBe('');
    });
  });

  describe('asNumber', () => {
    it('should return number value', () => {
      const flag = new Flag('1', 'number', 'test', 'Test', { value: { value: { number: 42 } } });
      expect(flag.asNumber()).toBe(42);
    });

    it('should convert string to number', () => {
      const stringFlag = new Flag('1', 'string', 'test', 'Test', {
        value: { value: { string: '3.14' } },
      });
      expect(stringFlag.asNumber()).toBe(3.14);
    });

    it('should return 0 for invalid numbers', () => {
      const stringFlag = new Flag('1', 'string', 'test', 'Test', {
        value: { value: { string: 'invalid' } },
      });
      expect(stringFlag.asNumber()).toBe(0);
    });

    it('should convert boolean to number', () => {
      const boolFlag = new Flag('1', 'boolean', 'test', 'Test', {
        value: { value: { boolean: true } },
      });
      expect(boolFlag.asNumber()).toBe(1);
    });
  });

  describe('getValue', () => {
    it('should return the raw value for boolean', () => {
      const flag = new Flag('1', 'boolean', 'test', 'Test', {
        value: { value: { boolean: true } },
      });
      expect(flag.getValue()).toBe(true);
    });

    it('should return the raw value for string', () => {
      const flag = new Flag('1', 'string', 'test', 'Test', {
        value: { value: { string: 'hello' } },
      });
      expect(flag.getValue()).toBe('hello');
    });

    it('should return the raw value for number', () => {
      const flag = new Flag('1', 'number', 'test', 'Test', { value: { value: { number: 42 } } });
      expect(flag.getValue()).toBe(42);
    });
  });

  describe('fromObject', () => {
    it('should create flag from object', () => {
      const data: FlagData = {
        version: '1',
        type: 'boolean',
        key: 'test-flag',
        name: 'Test Flag',
        target: { value: { value: { boolean: true } } },
        rules: [],
      };

      const flag = Flag.fromObject(data);
      expect(flag.getKey()).toBe('test-flag');
      expect(flag.getName()).toBe('Test Flag');
      expect(flag.isEnabled()).toBe(true);
    });

    it('should handle missing rules', () => {
      const data: FlagData = {
        version: '1',
        type: 'string',
        key: 'test-flag',
        name: 'Test Flag',
        target: { value: { value: { string: 'value' } } },
      };

      const flag = Flag.fromObject(data);
      expect(flag.getRules()).toEqual([]);
    });
  });

  describe('toJSON', () => {
    it('should serialize to JSON', () => {
      const flag = new Flag(
        '1',
        'boolean',
        'test-flag',
        'Test Flag',
        { value: { value: { boolean: true } } },
        []
      );

      const json = flag.toJSON();
      expect(json).toEqual({
        version: '1',
        type: 'boolean',
        key: 'test-flag',
        name: 'Test Flag',
        target: { value: { value: { boolean: true } } },
        rules: [],
      });
    });
  });
});
