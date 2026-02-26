/**
 * Percentage rollout bucketing algorithm
 *
 * Uses CRC32B (IEEE polynomial) to deterministically assign contexts to buckets.
 * The same (salt, contextIdentifier) pair always produces the same result.
 */

/**
 * CRC32B lookup table (IEEE polynomial 0xEDB88320)
 */
const CRC32_TABLE: Uint32Array = (() => {
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let crc = i;
    for (let j = 0; j < 8; j++) {
      if (crc & 1) {
        crc = (crc >>> 1) ^ 0xedb88320;
      } else {
        crc = crc >>> 1;
      }
    }
    table[i] = crc >>> 0;
  }
  return table;
})();

/**
 * Compute CRC32B hash of a string, matching PHP's hash('crc32b', ...) and
 * standard IEEE CRC32 implementations.
 *
 * @returns Unsigned 32-bit integer
 */
export function crc32b(input: string): number {
  let crc = 0xffffffff;
  for (let i = 0; i < input.length; i++) {
    const byte = input.charCodeAt(i) & 0xff;
    crc = (crc >>> 8) ^ CRC32_TABLE[(crc ^ byte) & 0xff];
  }
  return (crc ^ 0xffffffff) >>> 0; // Ensure unsigned 32-bit
}

/**
 * Determine whether a context identifier falls within a rollout bucket.
 *
 * The algorithm is deterministic: the same salt + identifier always produces
 * the same result. Increasing the percentage only adds new contexts to the
 * bucket — it never removes existing ones (monotonic expansion).
 *
 * @param salt - Random string unique to the rollout, used as the hash seed
 * @param contextIdentifier - The context identifier (e.g., user ID). Null means not in bucket.
 * @param percentage - The rollout percentage (0–100)
 * @returns Whether the context is in the rollout bucket
 */
export function isInBucket(
  salt: string,
  contextIdentifier: string | null | undefined,
  percentage: number
): boolean {
  if (percentage < 0 || percentage > 100) {
    throw new Error('Percentage must be between 0 and 100');
  }

  if (contextIdentifier == null) {
    return false;
  }

  const hash = crc32b(salt + ':' + contextIdentifier);
  const bucket = hash % 100;

  return bucket < percentage;
}
