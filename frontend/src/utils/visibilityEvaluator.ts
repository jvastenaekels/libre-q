/*
 * Open-Q - Open-source platform for conducting Q-methodology research
 * Copyright (C) 2025 Julien Vastenekels
 * Licensed under the GNU Affero General Public License v3.0 or later.
 */

/**
 * Evaluates a visibility condition against current form values.
 *
 * @param condition The visibility condition to check
 * @param values The current form values
 * @returns true if the condition is met, false otherwise
 */
export function evaluateVisibilityCondition(
    condition:
        | {
              depends_on: string;
              operator: 'equals' | 'not_equals' | 'contains' | 'greater_than' | 'less_than';
              value?: unknown;
          }
        | undefined,
    // biome-ignore lint/suspicious/noExplicitAny: form values can be anything
    values: Record<string, any>
): boolean {
    if (!condition) return true;

    const actualValue = values[condition.depends_on];
    const targetValue = condition.value;

    // Handle case where parent question hasn't been answered yet
    if (actualValue === undefined || actualValue === null || actualValue === '') {
        // Only allow if checking for "not_equals" a value that isn't empty/null
        if (condition.operator === 'not_equals') {
            return targetValue !== actualValue;
        }
        return false;
    }

    switch (condition.operator) {
        case 'equals':
            return actualValue === targetValue;
        case 'not_equals':
            return actualValue !== targetValue;
        case 'contains':
            if (Array.isArray(actualValue)) {
                return actualValue.includes(targetValue);
            }
            if (typeof actualValue === 'string') {
                return actualValue.includes(String(targetValue));
            }
            return false;
        case 'greater_than':
            return Number(actualValue) > Number(targetValue);
        case 'less_than':
            return Number(actualValue) < Number(targetValue);
        default:
            return true;
    }
}
