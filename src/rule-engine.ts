import type { Context } from './context';
import type { Rule, RuleCondition, RuleContextTarget } from './types';

/**
 * Raw condition shape as delivered by the CDN:
 *   { selector, selector_subtype?, comparer, values: string[] | CdnTarget[] }
 * The rule engine normalises this into the internal RuleCondition format before evaluation.
 */
interface CdnRuleCondition {
  selector: string;
  selector_subtype?: string | null;
  comparer: string;
  values?: Array<string | { identifier: string; type?: string | null }>;
}

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
  private evaluateClause(rawClause: RuleCondition, context: Context): boolean {
    const clause = this.normalizeCdnClause(rawClause);

    if (clause.attribute === 'context' || clause.attribute === 'segment') {
      return this.evaluateContextClause(clause, context);
    }

    const attribute = context.getAttribute(clause.attribute);

    if (!attribute) {
      switch (clause.operator) {
        case 'isnull':
        case 'notequal':
        case 'notin':
        case 'notcontains':
        case 'notstartswith':
        case 'notendswith':
          return true;
        default:
          return false;
      }
    }

    const attributeValues = attribute.getValues();
    const attributeClauseValue = this.toAttributeClauseValue(clause.value);

    switch (clause.operator) {
      case 'equal':
        return this.evaluateEquals(attributeValues, attributeClauseValue);

      case 'notequal':
        return !this.evaluateEquals(attributeValues, attributeClauseValue);

      case 'contains':
        return this.evaluateContains(attributeValues, attributeClauseValue);

      case 'notcontains':
        return !this.evaluateContains(attributeValues, attributeClauseValue);

      case 'in':
        return this.evaluateIn(attributeValues, attributeClauseValue);

      case 'notin':
        return !this.evaluateIn(attributeValues, attributeClauseValue);

      case 'startswith':
        return this.evaluateStartsWith(attributeValues, attributeClauseValue);

      case 'notstartswith':
        return !this.evaluateStartsWith(attributeValues, attributeClauseValue);

      case 'endswith':
        return this.evaluateEndsWith(attributeValues, attributeClauseValue);

      case 'notendswith':
        return !this.evaluateEndsWith(attributeValues, attributeClauseValue);

      case 'gt':
        return this.evaluateGreaterThan(attributeValues, attributeClauseValue);

      case 'gte':
        return this.evaluateGreaterThanOrEqual(attributeValues, attributeClauseValue);

      case 'lt':
        return this.evaluateLessThan(attributeValues, attributeClauseValue);

      case 'lte':
        return this.evaluateLessThanOrEqual(attributeValues, attributeClauseValue);

      case 'isnull':
        return attributeValues.every((v) => v === '');

      case 'notnull':
        return attributeValues.some((v) => v !== '');

      default:
        return false;
    }
  }

  /**
   * Normalise a condition that may be in CDN format
   * (selector/selector_subtype/comparer/values) into the internal format
   * (attribute/operator/value). Conditions already in internal format are
   * returned unchanged.
   */
  private normalizeCdnClause(clause: RuleCondition): RuleCondition {
    const raw = clause as unknown as CdnRuleCondition;
    if (raw.selector === undefined) {
      return clause;
    }

    const attribute = raw.selector === 'attribute' ? (raw.selector_subtype ?? '') : raw.selector;

    // Normalise operator: lowercase, strip hyphens/spaces/underscores so that
    // "not_equal" → "notequal", "starts_with" → "startswith", etc.
    const operator = raw.comparer.toLowerCase().replace(/[-_ ]/g, '');

    const value = this.normalizeCdnValues(raw.values ?? []);

    return { attribute, operator, value };
  }

  /**
   * Convert CDN `values` array into the internal clause value type.
   * Plain strings become a string array; object entries become RuleContextTarget[].
   */
  private normalizeCdnValues(
    values: Array<string | { identifier: string; type?: string | null }>
  ): string[] | RuleContextTarget[] | undefined {
    if (values.length === 0) {
      return undefined;
    }

    if (typeof values[0] === 'string') {
      return values as string[];
    }

    return (values as Array<{ identifier: string; type?: string | null }>).map((v) => ({
      identifier: v.identifier,
      type: v.type ?? null,
    }));
  }

  private evaluateContextClause(clause: RuleCondition, context: Context): boolean {
    const identifier = context.getIdentifier();
    if (!identifier) {
      return false;
    }

    const targets = this.toContextTargets(clause.value);
    if (targets.length === 0) {
      return false;
    }

    const contextType = context.getType();
    const matchingTargets = targets
      .filter((target) => target.type == null || target.type === contextType)
      .map((target) => target.identifier);

    if (matchingTargets.length === 0) {
      return false;
    }

    const values = [identifier];

    switch (clause.operator) {
      case 'equal':
        return this.evaluateEquals(values, matchingTargets);

      case 'notequal':
        return !this.evaluateEquals(values, matchingTargets);

      case 'in':
        return this.evaluateIn(values, matchingTargets);

      case 'notin':
        return !this.evaluateIn(values, matchingTargets);

      default:
        return false;
    }
  }

  private toContextTargets(
    clauseValue: string | string[] | RuleContextTarget | RuleContextTarget[] | undefined
  ): RuleContextTarget[] {
    if (clauseValue === undefined) {
      return [];
    }

    if (typeof clauseValue === 'string') {
      return [{ identifier: clauseValue, type: null }];
    }

    if (Array.isArray(clauseValue)) {
      const targets: RuleContextTarget[] = [];

      for (const item of clauseValue) {
        if (typeof item === 'string') {
          targets.push({ identifier: item, type: null });
          continue;
        }

        if (item && typeof item.identifier === 'string') {
          targets.push({ identifier: item.identifier, type: item.type ?? null });
        }
      }

      return targets;
    }

    if (typeof clauseValue.identifier === 'string') {
      return [{ identifier: clauseValue.identifier, type: clauseValue.type ?? null }];
    }

    return [];
  }

  private toAttributeClauseValue(
    clauseValue: string | string[] | RuleContextTarget | RuleContextTarget[] | undefined
  ): string | string[] | undefined {
    if (clauseValue === undefined) {
      return undefined;
    }

    if (typeof clauseValue === 'string') {
      return clauseValue;
    }

    if (Array.isArray(clauseValue)) {
      if (clauseValue.every((item) => typeof item === 'string')) {
        return clauseValue;
      }

      return undefined;
    }

    return undefined;
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
