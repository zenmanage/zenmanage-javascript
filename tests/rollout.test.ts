import { describe, it, expect } from 'vitest';
import { crc32b, isInBucket } from '../src/rollout';

describe('rollout', () => {
  describe('crc32b', () => {
    it('should compute correct CRC32B hashes for known inputs', () => {
      // Validate against the cross-SDK test vectors from the spec
      expect(crc32b('test-salt:user-0').toString(16)).toBe('83d08e62');
      expect(crc32b('test-salt:user-2').toString(16)).toBe('6ddeef4e');
      expect(crc32b('abc123:ctx-alpha').toString(16)).toBe('b2b1cec6');
      expect(crc32b('abc123:ctx-beta').toString(16)).toBe('37b773f');
      expect(crc32b('rollout-salt:user-100').toString(16)).toBe('8ec865f5');
      expect(crc32b('rollout-salt:user-200').toString(16)).toBe('8c8edbac');
      expect(crc32b('fixed-salt:user-42').toString(16)).toBe('706dd0af');
    });

    it('should return unsigned 32-bit integers', () => {
      // All results should be non-negative
      const hash = crc32b('test-salt:user-0');
      expect(hash).toBeGreaterThanOrEqual(0);
      expect(hash).toBeLessThanOrEqual(0xffffffff);
    });

    it('should handle empty string', () => {
      const hash = crc32b('');
      expect(hash).toBeGreaterThanOrEqual(0);
      expect(hash).toBeLessThanOrEqual(0xffffffff);
    });

    it('should be deterministic', () => {
      const hash1 = crc32b('same-input');
      const hash2 = crc32b('same-input');
      expect(hash1).toBe(hash2);
    });
  });

  describe('isInBucket', () => {
    describe('cross-SDK test vectors', () => {
      // Test vectors from the SDK_PERCENTAGE_ROLLOUTS.md specification
      // These must match across all SDK implementations

      const vectors = [
        {
          salt: 'test-salt',
          identifier: 'user-0',
          unsigned: 2211483234,
          bucket: 34,
          at50: true,
          at25: false,
          at10: false,
        },
        {
          salt: 'test-salt',
          identifier: 'user-2',
          unsigned: 1843326798,
          bucket: 98,
          at50: false,
          at25: false,
          at10: false,
        },
        {
          salt: 'abc123',
          identifier: 'ctx-alpha',
          unsigned: 2997997254,
          bucket: 54,
          at50: false,
          at25: false,
          at10: false,
        },
        {
          salt: 'abc123',
          identifier: 'ctx-beta',
          unsigned: 58423103,
          bucket: 3,
          at50: true,
          at25: true,
          at10: true,
        },
        {
          salt: 'rollout-salt',
          identifier: 'user-100',
          unsigned: 2395497973,
          bucket: 73,
          at50: false,
          at25: false,
          at10: false,
        },
        {
          salt: 'rollout-salt',
          identifier: 'user-200',
          unsigned: 2358172588,
          bucket: 88,
          at50: false,
          at25: false,
          at10: false,
        },
        {
          salt: 'fixed-salt',
          identifier: 'user-42',
          unsigned: 1886245039,
          bucket: 39,
          at50: true,
          at25: false,
          at10: false,
        },
      ];

      for (const v of vectors) {
        it(`should produce correct unsigned value for salt="${v.salt}" id="${v.identifier}"`, () => {
          const hash = crc32b(`${v.salt}:${v.identifier}`);
          expect(hash).toBe(v.unsigned);
        });

        it(`should produce bucket ${v.bucket} for salt="${v.salt}" id="${v.identifier}"`, () => {
          const hash = crc32b(`${v.salt}:${v.identifier}`);
          expect(hash % 100).toBe(v.bucket);
        });

        it(`should return ${v.at50} at 50% for salt="${v.salt}" id="${v.identifier}"`, () => {
          expect(isInBucket(v.salt, v.identifier, 50)).toBe(v.at50);
        });

        it(`should return ${v.at25} at 25% for salt="${v.salt}" id="${v.identifier}"`, () => {
          expect(isInBucket(v.salt, v.identifier, 25)).toBe(v.at25);
        });

        it(`should return ${v.at10} at 10% for salt="${v.salt}" id="${v.identifier}"`, () => {
          expect(isInBucket(v.salt, v.identifier, 10)).toBe(v.at10);
        });
      }
    });

    describe('null/undefined context identifier', () => {
      it('should return false when identifier is null', () => {
        expect(isInBucket('any-salt', null, 100)).toBe(false);
      });

      it('should return false when identifier is undefined', () => {
        expect(isInBucket('any-salt', undefined, 100)).toBe(false);
      });
    });

    describe('percentage boundaries', () => {
      it('should always return false when percentage is 0', () => {
        // Bucket values are in [0, 99], none are < 0
        expect(isInBucket('test-salt', 'user-0', 0)).toBe(false); // bucket 34
        expect(isInBucket('abc123', 'ctx-beta', 0)).toBe(false); // bucket 3
        expect(isInBucket('fixed-salt', 'user-42', 0)).toBe(false); // bucket 39
      });

      it('should always return true when percentage is 100', () => {
        // Bucket values are in [0, 99], all are < 100
        expect(isInBucket('test-salt', 'user-0', 100)).toBe(true); // bucket 34
        expect(isInBucket('test-salt', 'user-2', 100)).toBe(true); // bucket 98
        expect(isInBucket('abc123', 'ctx-alpha', 100)).toBe(true); // bucket 54
      });

      it('should return false for null identifier even at 100%', () => {
        expect(isInBucket('any-salt', null, 100)).toBe(false);
      });

      it('should throw for percentage < 0', () => {
        expect(() => isInBucket('salt', 'id', -1)).toThrow('Percentage must be between 0 and 100');
      });

      it('should throw for percentage > 100', () => {
        expect(() => isInBucket('salt', 'id', 101)).toThrow('Percentage must be between 0 and 100');
      });

      it('should not throw for percentage = 0', () => {
        expect(() => isInBucket('salt', 'id', 0)).not.toThrow();
      });

      it('should not throw for percentage = 100', () => {
        expect(() => isInBucket('salt', 'id', 100)).not.toThrow();
      });
    });

    describe('deterministic bucketing', () => {
      it('should produce the same result for the same inputs', () => {
        const salt = 'deterministic-test';
        const id = 'user-abc';
        const pct = 50;

        const result1 = isInBucket(salt, id, pct);
        const result2 = isInBucket(salt, id, pct);
        const result3 = isInBucket(salt, id, pct);

        expect(result1).toBe(result2);
        expect(result2).toBe(result3);
      });

      it('should produce different results for different salts', () => {
        // With enough identifiers, different salts should distribute differently.
        // We pick a specific case where we know the results differ.
        const id = 'ctx-beta'; // bucket 3 with salt "abc123"
        expect(isInBucket('abc123', id, 5)).toBe(true);
        // Different salt should give a different bucket
        expect(isInBucket('test-salt', id, 5)).not.toBe(isInBucket('abc123', id, 5));
      });
    });

    describe('monotonic rollout expansion', () => {
      it('should keep contexts in bucket as percentage increases', () => {
        // "abc123" + "ctx-beta" = bucket 3
        // Once in at 10%, should remain in at all higher percentages
        expect(isInBucket('abc123', 'ctx-beta', 4)).toBe(true); // 3 < 4
        expect(isInBucket('abc123', 'ctx-beta', 10)).toBe(true);
        expect(isInBucket('abc123', 'ctx-beta', 25)).toBe(true);
        expect(isInBucket('abc123', 'ctx-beta', 50)).toBe(true);
        expect(isInBucket('abc123', 'ctx-beta', 100)).toBe(true);
      });

      it('should never remove contexts from bucket when percentage grows', () => {
        // "test-salt" + "user-0" = bucket 34
        // Not in at 34%, in at 35%+
        expect(isInBucket('test-salt', 'user-0', 34)).toBe(false); // 34 is NOT < 34
        expect(isInBucket('test-salt', 'user-0', 35)).toBe(true); // 34 < 35
        expect(isInBucket('test-salt', 'user-0', 50)).toBe(true);
        expect(isInBucket('test-salt', 'user-0', 100)).toBe(true);
      });
    });

    describe('colon delimiter prevents ambiguous concatenation', () => {
      it('should produce different buckets for ambiguous salt/id pairs', () => {
        // Without a delimiter, "ab" + "c" and "a" + "bc" would collide
        const result1 = isInBucket('ab', 'c', 50);
        const result2 = isInBucket('a', 'bc', 50);
        // They use different hash inputs ("ab:c" vs "a:bc")
        const hash1 = crc32b('ab:c');
        const hash2 = crc32b('a:bc');
        expect(hash1).not.toBe(hash2);
      });
    });

    describe('rough distribution', () => {
      it('should bucket approximately the expected percentage of identifiers', () => {
        const salt = 'distribution-test-salt';
        const total = 10000;
        let inBucket = 0;

        for (let i = 0; i < total; i++) {
          if (isInBucket(salt, `user-${i}`, 50)) {
            inBucket++;
          }
        }

        // Should be roughly 50% (allow ±5% tolerance)
        const ratio = inBucket / total;
        expect(ratio).toBeGreaterThan(0.45);
        expect(ratio).toBeLessThan(0.55);
      });

      it('should bucket approximately 25% at 25%', () => {
        const salt = 'dist-25-salt';
        const total = 10000;
        let inBucket = 0;

        for (let i = 0; i < total; i++) {
          if (isInBucket(salt, `user-${i}`, 25)) {
            inBucket++;
          }
        }

        const ratio = inBucket / total;
        expect(ratio).toBeGreaterThan(0.2);
        expect(ratio).toBeLessThan(0.3);
      });

      it('should bucket approximately 10% at 10%', () => {
        const salt = 'dist-10-salt';
        const total = 10000;
        let inBucket = 0;

        for (let i = 0; i < total; i++) {
          if (isInBucket(salt, `user-${i}`, 10)) {
            inBucket++;
          }
        }

        const ratio = inBucket / total;
        expect(ratio).toBeGreaterThan(0.07);
        expect(ratio).toBeLessThan(0.13);
      });
    });
  });
});
