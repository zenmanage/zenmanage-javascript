import type { Context } from './context';
import type { Rule, RuleCondition } from './types';

/**
 * Rule engine for evaluating flag rules against context
 */
export class RuleEngine {
  /**
   * Evaluate rules against a context
   * Returns the matching rule or null if no rules match
   */
  evaluate(rules: Rule[], context: Context): Rule | null {
    // Rules are evaluated in order - first match wins
    for (const rule of rules) {
      if (this.evaluateRule(rule, context)) {
        return rule;
      }
    }

    return null;
  }

  /**
   * Evaluate a single rule against context
   * All clauses must match for the rule to match
   */
  private evaluateRule(rule: Rule, context: Context): boolean {
    // Handle both 'clauses' (array) and 'criteria' (single condition)
    if (rule.clauses && rule.clauses.length > 0) {
      // All clauses must match (AND logic)
      return rule.clauses.every((clause) => this.evaluateClause(clause, context));
    }
    
    if (rule.criteria) {
      // Single criteria condition
      return this.evaluateClause(rule.criteria, context);
    }
    
    // No conditions means rule matches
    return true;
  }

  /**
   * Evaluate a single clause against context
   */
  private evaluateClause(clause: RuleCondition, context: Context): boolean {
    const attribute = context.getAttribute(clause.attribute);

    if (!attribute) {
      return false;
    }

    const attributeValues = attribute.getValues();

    switch (clause.operator) {
      case 'equals':
        return this.evaluateEquals(attributeValues, clause.value);

      case 'not_equals':
        return !this.evaluateEquals(attributeValues, clause.value);

      case 'contains':
        return this.evaluateContains(attributeValues, clause.value);

      case 'not_contains':
        return !this.evaluateContains(attributeValues, clause.value);

      case 'in':
        return this.evaluateIn(attributeValues, clause.value);

      case 'not_in':
        return !this.evaluateIn(attributeValues, clause.value);

      case 'starts_with':
        return this.evaluateStartsWith(attributeValues, clause.value);

      case 'ends_with':
        return this.evaluateEndsWith(attributeValues, clause.value);

      case 'gt':
        return this.evaluateGreaterThan(attributeValues, clause.value);

      case 'gte':
        return this.evaluateGreaterThanOrEqual(attributeValues, clause.value);

      case 'lt':
        return this.evaluateLessThan(attributeValues, clause.value);

      case 'lte':
        return this.evaluateLessThanOrEqual(attributeValues, clause.value);

      default:
        return false;
    }
  }

  private evaluateEquals(values: string[], clauseValue: string | string[] | undefined): boolean {
    if (clauseValue === undefined) return false;
    const target = Array.isArray(clauseValue) ? clauseValue[0] : clauseValue;
    return values.some((v) => v === target);
  }

  private evaluateContains(values: string[], clauseValue: string | string[] | undefined): boolean {
    if (clauseValue === undefined) return false;
    const target = Array.isArray(clauseValue) ? clauseValue[0] : clauseValue;
    return values.some((v) => v.includes(target));
  }

  private evaluateIn(values: string[], clauseValue: string | string[] | undefined): boolean {
    if (clauseValue === undefined) return false;
    const targets = Array.isArray(clauseValue) ? clauseValue : [clauseValue];
    return values.some((v) => targets.includes(v));
  }

  private evaluateStartsWith(
    values: string[],
    clauseValue: string | string[] | undefined
  ): boolean {
    if (clauseValue === undefined) return false;
    const target = Array.isArray(clauseValue) ? clauseValue[0] : clauseValue;
    return values.some((v) => v.startsWith(target));
  }

  private evaluateEndsWith(values: string[], clauseValue: string | string[] | undefined): boolean {
    if (clauseValue === undefined) return false;
    const target = Array.isArray(clauseValue) ? clauseValue[0] : clauseValue;
    return values.some((v) => v.endsWith(target));
  }

  private evaluateGreaterThan(
    values: string[],
    clauseValue: string | string[] | undefined
  ): boolean {
    if (clauseValue === undefined) return false;
    const target = Array.isArray(clauseValue) ? clauseValue[0] : clauseValue;
    const targetNum = parseFloat(target);
    if (isNaN(targetNum)) return false;
    return values.some((v) => {
      const num = parseFloat(v);
      return !isNaN(num) && num > targetNum;
    });
  }

  private evaluateGreaterThanOrEqual(
    values: string[],
    clauseValue: string | string[] | undefined
  ): boolean {
    if (clauseValue === undefined) return false;
    const target = Array.isArray(clauseValue) ? clauseValue[0] : clauseValue;
    const targetNum = parseFloat(target);
    if (isNaN(targetNum)) return false;
    return values.some((v) => {
      const num = parseFloat(v);
      return !isNaN(num) && num >= targetNum;
    });
  }

  private evaluateLessThan(values: string[], clauseValue: string | string[] | undefined): boolean {
    if (clauseValue === undefined) return false;
    const target = Array.isArray(clauseValue) ? clauseValue[0] : clauseValue;
    const targetNum = parseFloat(target);
    if (isNaN(targetNum)) return false;
    return values.some((v) => {
      const num = parseFloat(v);
      return !isNaN(num) && num < targetNum;
    });
  }

  private evaluateLessThanOrEqual(
    values: string[],
    clauseValue: string | string[] | undefined
  ): boolean {
    if (clauseValue === undefined) return false;
    const target = Array.isArray(clauseValue) ? clauseValue[0] : clauseValue;
    const targetNum = parseFloat(target);
    if (isNaN(targetNum)) return false;
    return values.some((v) => {
      const num = parseFloat(v);
      return !isNaN(num) && num <= targetNum;
    });
  }
}
