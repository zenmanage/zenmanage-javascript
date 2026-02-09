import type { ContextData } from './types';

/**
 * Represents an attribute value in a context
 */
export class Value {
  constructor(public readonly value: string) {}

  toJSON(): { value: string } {
    return { value: this.value };
  }
}

/**
 * Represents an attribute with multiple values
 */
export class Attribute {
  private values: Value[];

  constructor(
    public readonly key: string,
    values: string[] = []
  ) {
    this.values = values.map((v) => new Value(v));
  }

  getKey(): string {
    return this.key;
  }

  getValues(): string[] {
    return this.values.map((v) => v.value);
  }

  addValue(value: string): this {
    this.values.push(new Value(value));
    return this;
  }

  toJSON(): { key: string; values: { value: string }[] } {
    return {
      key: this.key,
      values: this.values.map((v) => v.toJSON()),
    };
  }
}

/**
 * Represents the evaluation context containing attributes for rule matching
 */
export class Context {
  private attributes: Map<string, Attribute> = new Map();

  constructor(
    private type: string,
    private name?: string,
    private identifier?: string,
    attributes: Attribute[] = []
  ) {
    attributes.forEach((attr) => this.addAttribute(attr));
  }

  /**
   * Create a context from plain data object
   */
  static fromObject(data: ContextData): Context {
    const context = new Context(data.type, data.name, data.identifier);

    if (data.attributes) {
      data.attributes.forEach((attrData) => {
        const values = attrData.values.map((v) => v.value);
        context.addAttribute(new Attribute(attrData.key, values));
      });
    }

    return context;
  }

  /**
   * Create a simple context with identifier and optional name
   */
  static single(type: string, identifier: string, name?: string): Context {
    return new Context(type, name, identifier);
  }

  getType(): string {
    return this.type;
  }

  getName(): string | undefined {
    return this.name;
  }

  getIdentifier(): string | undefined {
    return this.identifier;
  }

  /**
   * @deprecated Use getIdentifier() instead
   */
  getId(): string | undefined {
    return this.identifier;
  }

  addAttribute(attribute: Attribute): this {
    this.attributes.set(attribute.key, attribute);
    return this;
  }

  getAttribute(key: string): Attribute | undefined {
    return this.attributes.get(key);
  }

  hasAttribute(key: string): boolean {
    return this.attributes.has(key);
  }

  getAttributes(): Attribute[] {
    return Array.from(this.attributes.values());
  }

  toJSON(): ContextData {
    const result: ContextData = {
      type: this.type,
    };

    if (this.name !== undefined) {
      result.name = this.name;
    }

    if (this.identifier !== undefined) {
      result.identifier = this.identifier;
    }

    const attrs = this.getAttributes();
    if (attrs.length > 0) {
      result.attributes = attrs.map((attr) => attr.toJSON());
    }

    return result;
  }
}
