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
 * @param questionsConfig Optional configuration of all questions to resolve localized options
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
    values: Record<string, any>,
    // biome-ignore lint/suspicious/noExplicitAny: config structure
    questionsConfig?: Record<string, any>
): boolean {
    if (!condition) return true;

    const actualValue = values[condition.depends_on];
    const targetValue = condition.value;

    // Handle case where parent question hasn't been answered yet
    if (actualValue === undefined || actualValue === null || actualValue === '') {
        // Only allow if checking for "not_equals" a value that isn't empty/null
        if (condition.operator === 'not_equals') {
            return String(actualValue) !== String(targetValue);
        }
        return false;
    }

    // Standard comparison
    let isMatch = false;
    const actualStr = String(actualValue);
    const targetStr = String(targetValue);

    switch (condition.operator) {
        case 'equals':
            if (actualStr === targetStr) {
                isMatch = true;
            }
            break;
        case 'not_equals':
            if (actualStr !== targetStr) {
                return true;
            }
            break;
        case 'contains':
            if (Array.isArray(actualValue)) {
                return actualValue.includes(targetValue);
            }
            if (typeof actualValue === 'string') {
                return actualValue.includes(targetStr);
            }
            return false;
        case 'greater_than':
            return Number(actualValue) > Number(targetValue);
        case 'less_than':
            return Number(actualValue) < Number(targetValue);
        default:
            return true;
    }

    if (isMatch) return true;

    // Fallback: Check localized labels if standard check failed
    if (
        questionsConfig &&
        condition.operator === 'equals' &&
        typeof targetValue === 'string' &&
        typeof actualValue === 'string'
    ) {
        const question = questionsConfig[condition.depends_on];
        if (question && Array.isArray(question.options)) {
            // Find option that matches the CONDITION's target value
            // biome-ignore lint/suspicious/noExplicitAny: dynamic option type
            const targetOption = question.options.find((opt: any) => {
                const optVal = typeof opt === 'string' ? opt : opt.value;
                return String(optVal) === String(targetValue);
            });

            if (targetOption && typeof targetOption === 'object' && targetOption.label) {
                // Check if ACTUAL value matches any of the labels for this option
                const labels = Object.values(targetOption.label);
                if (labels.some((l) => String(l) === String(actualValue))) {
                    return true;
                }
            }
        }
    }

    return false;
}
