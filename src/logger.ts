import type { Logger } from './types';

/**
 * Default logger that does nothing (null logger pattern)
 */
export class NullLogger implements Logger {
  debug(): void {}
  info(): void {}
  warn(): void {}
  error(): void {}
}
