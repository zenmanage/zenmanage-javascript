/**
 * Custom error classes for the SDK
 */

export class ZenmanageError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ZenmanageError';
    Object.setPrototypeOf(this, ZenmanageError.prototype);
  }
}

export class ConfigurationError extends ZenmanageError {
  constructor(message: string) {
    super(message);
    this.name = 'ConfigurationError';
    Object.setPrototypeOf(this, ConfigurationError.prototype);
  }
}

export class EvaluationError extends ZenmanageError {
  constructor(message: string) {
    super(message);
    this.name = 'EvaluationError';
    Object.setPrototypeOf(this, EvaluationError.prototype);
  }
}

export class FetchRulesError extends ZenmanageError {
  constructor(
    message: string,
    public readonly statusCode?: number
  ) {
    super(message);
    this.name = 'FetchRulesError';
    Object.setPrototypeOf(this, FetchRulesError.prototype);
  }
}

export class InvalidRulesError extends ZenmanageError {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidRulesError';
    Object.setPrototypeOf(this, InvalidRulesError.prototype);
  }
}
