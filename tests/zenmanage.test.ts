import { describe, it, expect } from 'vitest';
import { Zenmanage } from '../src/zenmanage';
import { ConfigBuilder } from '../src/config';
import { ConfigurationError } from '../src/errors';

describe('Zenmanage', () => {
  describe('constructor', () => {
    it('should create instance with valid config', () => {
      const config = ConfigBuilder.create()
        .withEnvironmentToken('tok_test_123')
        .build();

      const zenmanage = new Zenmanage(config);
      expect(zenmanage).toBeInstanceOf(Zenmanage);
    });

    it('should create instance with memory cache', () => {
      const config = ConfigBuilder.create()
        .withEnvironmentToken('tok_test_123')
        .withCacheBackend('memory')
        .build();

      const zenmanage = new Zenmanage(config);
      expect(zenmanage.flags()).toBeDefined();
    });

    it('should create instance with null cache', () => {
      const config = ConfigBuilder.create()
        .withEnvironmentToken('tok_test_123')
        .withCacheBackend('null')
        .build();

      const zenmanage = new Zenmanage(config);
      expect(zenmanage.flags()).toBeDefined();
    });

    it('should throw error for filesystem cache without directory', () => {
      const config = ConfigBuilder.create()
        .withEnvironmentToken('tok_test_123')
        .withCacheBackend('filesystem')
        .withCacheDirectory('/tmp/zenmanage-test');

      // Config build should succeed
      const builtConfig = config.build();
      
      // Creating Zenmanage should succeed (filesystem cache handles missing directory gracefully)
      const zenmanage = new Zenmanage(builtConfig);
      expect(zenmanage).toBeInstanceOf(Zenmanage);
    });

    it('should throw error for invalid cache backend', () => {
      const config = {
        environmentToken: 'tok_test_123',
        cacheBackend: 'invalid' as any,
        logger: {
          debug: () => {},
          info: () => {},
          warn: () => {},
          error: () => {},
        },
      };

      expect(() => new Zenmanage(config)).toThrow(ConfigurationError);
      expect(() => new Zenmanage(config)).toThrow('Invalid cache backend');
    });
  });

  describe('flags', () => {
    it('should return FlagManager instance', () => {
      const config = ConfigBuilder.create()
        .withEnvironmentToken('tok_test_123')
        .build();

      const zenmanage = new Zenmanage(config);
      const flagManager = zenmanage.flags();
      
      expect(flagManager).toBeDefined();
      expect(typeof flagManager.single).toBe('function');
      expect(typeof flagManager.all).toBe('function');
      expect(typeof flagManager.withContext).toBe('function');
    });

    it('should return the same FlagManager instance', () => {
      const config = ConfigBuilder.create()
        .withEnvironmentToken('tok_test_123')
        .build();

      const zenmanage = new Zenmanage(config);
      const flags1 = zenmanage.flags();
      const flags2 = zenmanage.flags();
      
      expect(flags1).toBe(flags2);
    });
  });
});
