import { describe, it, expect } from 'vitest';
import { DefaultsCollection } from '../src/defaults-collection';

describe('DefaultsCollection', () => {
  describe('constructor', () => {
    it('should create an empty collection', () => {
      const collection = new DefaultsCollection();
      expect(collection.size()).toBe(0);
    });
  });

  describe('fromObject', () => {
    it('should create collection from object', () => {
      const obj = {
        'flag-1': true,
        'flag-2': 'value',
        'flag-3': 42,
      };

      const collection = DefaultsCollection.fromObject(obj);
      expect(collection.size()).toBe(3);
      expect(collection.get('flag-1')).toBe(true);
      expect(collection.get('flag-2')).toBe('value');
      expect(collection.get('flag-3')).toBe(42);
    });
  });

  describe('set/get', () => {
    it('should set and get values', () => {
      const collection = new DefaultsCollection();
      collection.set('test-flag', true);
      expect(collection.get('test-flag')).toBe(true);
    });

    it('should support different value types', () => {
      const collection = new DefaultsCollection();
      collection.set('bool-flag', false);
      collection.set('string-flag', 'test');
      collection.set('number-flag', 123);

      expect(collection.get('bool-flag')).toBe(false);
      expect(collection.get('string-flag')).toBe('test');
      expect(collection.get('number-flag')).toBe(123);
    });

    it('should return undefined for non-existent keys', () => {
      const collection = new DefaultsCollection();
      expect(collection.get('nonexistent')).toBeUndefined();
    });

    it('should allow method chaining', () => {
      const collection = new DefaultsCollection();
      collection.set('flag-1', true).set('flag-2', false);
      expect(collection.size()).toBe(2);
    });
  });

  describe('has', () => {
    it('should return true for existing keys', () => {
      const collection = new DefaultsCollection();
      collection.set('test', true);
      expect(collection.has('test')).toBe(true);
    });

    it('should return false for non-existent keys', () => {
      const collection = new DefaultsCollection();
      expect(collection.has('nonexistent')).toBe(false);
    });
  });

  describe('delete', () => {
    it('should delete existing keys', () => {
      const collection = new DefaultsCollection();
      collection.set('test', true);
      expect(collection.has('test')).toBe(true);

      const result = collection.delete('test');
      expect(result).toBe(true);
      expect(collection.has('test')).toBe(false);
    });

    it('should return false for non-existent keys', () => {
      const collection = new DefaultsCollection();
      const result = collection.delete('nonexistent');
      expect(result).toBe(false);
    });
  });

  describe('clear', () => {
    it('should clear all defaults', () => {
      const collection = new DefaultsCollection();
      collection.set('flag-1', true);
      collection.set('flag-2', false);
      expect(collection.size()).toBe(2);

      collection.clear();
      expect(collection.size()).toBe(0);
      expect(collection.has('flag-1')).toBe(false);
      expect(collection.has('flag-2')).toBe(false);
    });
  });

  describe('keys', () => {
    it('should return all keys', () => {
      const collection = new DefaultsCollection();
      collection.set('flag-1', true);
      collection.set('flag-2', false);
      collection.set('flag-3', 'test');

      const keys = collection.keys();
      expect(keys).toHaveLength(3);
      expect(keys).toContain('flag-1');
      expect(keys).toContain('flag-2');
      expect(keys).toContain('flag-3');
    });

    it('should return empty array for empty collection', () => {
      const collection = new DefaultsCollection();
      expect(collection.keys()).toEqual([]);
    });
  });

  describe('size', () => {
    it('should return the number of defaults', () => {
      const collection = new DefaultsCollection();
      expect(collection.size()).toBe(0);

      collection.set('flag-1', true);
      expect(collection.size()).toBe(1);

      collection.set('flag-2', false);
      expect(collection.size()).toBe(2);

      collection.delete('flag-1');
      expect(collection.size()).toBe(1);
    });
  });
});
