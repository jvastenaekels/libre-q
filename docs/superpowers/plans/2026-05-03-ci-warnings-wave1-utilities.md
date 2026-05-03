# CI warnings — Wave 1 (utilities + transverse hooks) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Eliminate the 12 cognitive-complexity warnings in W1's scope (utilities + transverse hooks) by extracting pure helpers, with characterization tests pinning current behavior, leaving 0 residual warnings on these 10 files.

**Architecture:** Refactor TDD — pin existing behavior with tests *first* (these are working production paths, not greenfield), then extract pure helpers, verify tests still green and lint warning gone, commit per site. New helpers live in colocated `helpers.ts` modules adjacent to the consuming hook/util, with their own `*.test.ts`.

**Tech Stack:** TypeScript, Vitest (`renderHook` from `@testing-library/react` for hook tests), Biome for lint, `make ci-fast` as inner-loop gate.

**Spec:** [`2026-05-03-ci-warnings-design.md`](../specs/2026-05-03-ci-warnings-design.md). Patterns referenced: P3 (function decomposition for pure utils), P4 (hook-internal helper extraction).

**Sites in scope (12 sites grouped into 11 refactor tasks + 1 verification task):**

| Task | File | Line(s) | Site | Pattern |
|---|---|---|---|---|
| 1 | `frontend/src/utils/uaParser.ts` | 10 | `parseUA` | P3 |
| 2 | `frontend/src/utils/tuckerPhi.ts` | 46 | `matchFactorsByPhi` | P3 |
| 3 | `frontend/src/utils/studyResetHelpers.ts` | 34 | `updateDraft` callback | P3 |
| 4 | `frontend/src/api/mutator.ts` | 72 | `handleErrorStatus` | P3 |
| 5 | `frontend/src/hooks/useStudyPersistence.ts` | 60 | change-detection `useEffect` | P4 |
| 6 | `frontend/src/hooks/useStudyPersistence.ts` | 107 | `save` callback (409 conflict) | P4 |
| 7 | `frontend/src/hooks/useDragAutoInteraction.ts` | 39, 91 (**2 sites**) | `startPanInterval` + `updateInteraction` | P4 |
| 8 | `frontend/src/hooks/useGridZoom.ts` | 29 | `performAutoFit` | P4 |
| 9 | `frontend/src/hooks/useGridCalculations.ts` | 34 | `calculateOptimalSize` | P4 |
| 10 | `frontend/src/hooks/useFineSortDrag.ts` | 143 | `handleDragEnd` | P4 |
| 11 | `frontend/src/hooks/admin/useRecruitmentPage.ts` | 350 | `onAccessRulesSubmit` | P4 |
| 12 | (verification + PR) | — | wave-level checks | — |

**Done criteria for the wave (per spec):**

1. `npx biome check src --max-diagnostics=200 | grep -c "noExcessiveCognitiveComplexity"` decreases by ≥12 (from 65 to ≤53).
2. `make ci-fast` green at every commit (lint + types + unit tests).
3. `make ci` green before opening PR.
4. Each new helper has ≥5 pure tests; each modified hook has its existing tests still green.
5. No file outside W1 scope is modified except the auto-generated `frontend/openapi.json`/`generated.ts` (not expected here).

---

## Task 1: Refactor `parseUA` (P3, complexity 16 → ≤10)

**Files:**
- Modify: `frontend/src/utils/uaParser.ts`
- Create: `frontend/src/utils/uaParser.test.ts`

The existing function chains three independent detection blocks (device, OS, browser). Each is a pure function from `userAgent` to a category. Extract each.

- [ ] **Step 1: Write characterization tests pinning current detector outputs**

```ts
// frontend/src/utils/uaParser.test.ts
import { describe, it, expect } from 'vitest';
import { parseUA } from './uaParser';

describe('parseUA', () => {
    it('returns Unknown defaults for empty input', () => {
        expect(parseUA()).toEqual({ browser: 'Unknown', os: 'Unknown', device: 'desktop' });
        expect(parseUA('')).toEqual({ browser: 'Unknown', os: 'Unknown', device: 'desktop' });
    });

    it('detects iPad as tablet + iOS + Safari', () => {
        const ua = 'Mozilla/5.0 (iPad; CPU OS 16_0 like Mac OS X) AppleWebKit Safari/605.1.15';
        const r = parseUA(ua);
        expect(r.device).toBe('tablet');
        expect(r.os).toBe('iOS');
        expect(r.browser).toBe('Safari');
    });

    it('detects iPhone as mobile + iOS', () => {
        const ua = 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0)';
        expect(parseUA(ua)).toMatchObject({ device: 'mobile', os: 'iOS' });
    });

    it('detects Android phone as mobile + Android + Chrome', () => {
        const ua = 'Mozilla/5.0 (Linux; Android 13) AppleWebKit Chrome/120';
        const r = parseUA(ua);
        expect(r.device).toBe('mobile');
        expect(r.os).toBe('Android');
        expect(r.browser).toBe('Chrome');
    });

    it('detects Edge over Chrome on Windows', () => {
        const ua = 'Mozilla/5.0 (Windows NT 10.0) AppleWebKit Chrome/120 Edg/120';
        const r = parseUA(ua);
        expect(r.os).toBe('Windows');
        expect(r.browser).toBe('Edge');
    });

    it('detects Opera not Chrome', () => {
        const ua = 'Mozilla/5.0 (Windows NT 10.0) AppleWebKit Chrome/120 OPR/100';
        expect(parseUA(ua).browser).toBe('Opera');
    });

    it('detects Firefox', () => {
        expect(parseUA('Mozilla/5.0 Firefox/120').browser).toBe('Firefox');
    });

    it('detects macOS desktop Safari', () => {
        const ua = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15) AppleWebKit Safari/605';
        expect(parseUA(ua)).toEqual({ device: 'desktop', os: 'macOS', browser: 'Safari' });
    });

    it('detects Linux desktop', () => {
        expect(parseUA('Mozilla/5.0 (X11; Linux x86_64) Firefox/120').os).toBe('Linux');
    });

    it('falls back to desktop when no mobile/tablet markers present', () => {
        expect(parseUA('Mozilla/5.0 (Windows NT 10.0)').device).toBe('desktop');
    });
});
```

- [ ] **Step 2: Run tests against current implementation**

```
cd frontend && npx vitest run src/utils/uaParser.test.ts
```
Expected: all 9 tests PASS (we are pinning existing behavior).

- [ ] **Step 3: Extract three detector functions, keep `parseUA` as orchestrator**

Replace the body of `frontend/src/utils/uaParser.ts` with:

```ts
interface UAInfo {
    browser: string;
    os: string;
    device: 'mobile' | 'tablet' | 'desktop';
}

function detectDevice(ua: string): UAInfo['device'] {
    if (/tablet|ipad|playbook|silk/i.test(ua)) return 'tablet';
    if (/mobile|iphone|ipod|android|blackberry|opera mini|windows phone/i.test(ua)) return 'mobile';
    return 'desktop';
}

function detectOS(ua: string): string {
    if (/windows/i.test(ua)) return 'Windows';
    if (/android/i.test(ua)) return 'Android';
    if (/ipad|iphone|ipod/i.test(ua)) return 'iOS';
    if (/macintosh|mac os x/i.test(ua)) return 'macOS';
    if (/linux/i.test(ua)) return 'Linux';
    return 'Unknown';
}

function detectBrowser(ua: string): string {
    if (/edg/i.test(ua)) return 'Edge';
    if (/opr|opios/i.test(ua)) return 'Opera';
    if (/chrome|crios/i.test(ua)) return 'Chrome';
    if (/firefox|fxios/i.test(ua)) return 'Firefox';
    if (/safari/i.test(ua)) return 'Safari';
    if (/trident|msie/i.test(ua)) return 'Internet Explorer';
    return 'Unknown';
}

export function parseUA(userAgent?: string): UAInfo {
    if (!userAgent) {
        return { browser: 'Unknown', os: 'Unknown', device: 'desktop' };
    }
    return {
        device: detectDevice(userAgent),
        os: detectOS(userAgent),
        browser: detectBrowser(userAgent),
    };
}
```

**Note**: the original Edge-vs-Chrome and Opera-vs-Chrome ordering is preserved by listing Edge and Opera *before* Chrome (early return wins).
The original Safari guard `&& !/chrome|crios|edg|opr|opios/i.test(ua)` is replaced by **ordering** (Edge/Opera/Chrome/Firefox come first). The characterization test in Step 1 covers all 4 ordering-sensitive cases.

- [ ] **Step 4: Re-run tests, verify behavior preserved**

```
cd frontend && npx vitest run src/utils/uaParser.test.ts
```
Expected: all 9 tests PASS.

- [ ] **Step 5: Verify lint warning removed**

```
cd frontend && npx biome check src/utils/uaParser.ts
```
Expected: no `noExcessiveCognitiveComplexity` for `parseUA`.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/utils/uaParser.ts frontend/src/utils/uaParser.test.ts
git commit -m "refactor(utils): split parseUA into per-axis detectors (W1)

Reduces cognitive complexity from 16 to <10 by extracting detectDevice,
detectOS, detectBrowser. Behavior pinned by 9 characterization tests
including ordering-sensitive Edge/Opera/Chrome and Safari guard cases."
```

---

## Task 2: Refactor `matchFactorsByPhi` (P3, complexity 16 → ≤10)

**Files:**
- Modify: `frontend/src/utils/tuckerPhi.ts`
- Modify: `frontend/src/utils/tuckerPhi.test.ts` (extend existing)

The complexity comes from the nested loop with `best` tracking, `used` set, and column extraction inline. Extract `findBestMatchForFactor(aCol, bMatrix, used)` as a pure helper.

- [ ] **Step 1: Add tests for the extracted helper before extracting**

Append to `frontend/src/utils/tuckerPhi.test.ts`:

```ts
import { findBestMatchForFactor } from './tuckerPhi';

describe('findBestMatchForFactor', () => {
    const bMatrix = [[1, 0], [0, 1], [1, 0]];

    it('picks the highest |φ| from unused columns', () => {
        const aCol = [1, 0, 1];
        const used = new Set<number>();
        const m = findBestMatchForFactor(0, aCol, bMatrix, used);
        expect(m).not.toBeNull();
        expect(m?.bIndex).toBe(0);
        expect(m?.phi).toBeCloseTo(1, 5);
    });

    it('skips already-used columns', () => {
        const aCol = [1, 0, 1];
        const used = new Set([0]);
        const m = findBestMatchForFactor(0, aCol, bMatrix, used);
        expect(m?.bIndex).toBe(1);
    });

    it('returns null when all columns are used', () => {
        const aCol = [1, 0, 1];
        const used = new Set([0, 1]);
        expect(findBestMatchForFactor(0, aCol, bMatrix, used)).toBeNull();
    });

    it('preserves negative phi for sign-flipped match', () => {
        const flipped = [[-1, 0], [0, -1], [-1, 0]];
        const m = findBestMatchForFactor(0, [1, 0, 1], flipped, new Set());
        expect(m?.phi).toBeCloseTo(-1, 5);
    });

    it('returns null for empty bMatrix row width', () => {
        expect(findBestMatchForFactor(0, [1], [[]], new Set())).toBeNull();
    });
});
```

- [ ] **Step 2: Run tests — they should fail (helper not exported yet)**

```
cd frontend && npx vitest run src/utils/tuckerPhi.test.ts
```
Expected: 5 new tests FAIL with "findBestMatchForFactor is not a function" or import error.

- [ ] **Step 3: Extract `findBestMatchForFactor` and refactor `matchFactorsByPhi`**

In `frontend/src/utils/tuckerPhi.ts`, add before `matchFactorsByPhi`:

```ts
/**
 * Find the unused column of bMatrix with the highest |φ| against aCol.
 * Returns null if all columns are used or bMatrix has no factors.
 */
export function findBestMatchForFactor(
    aIndex: number,
    aCol: readonly number[],
    bMatrix: readonly (readonly number[])[],
    used: ReadonlySet<number>
): FactorMatch | null {
    const nFactorsB = bMatrix[0]?.length ?? 0;
    let best: FactorMatch | null = null;
    for (let j = 0; j < nFactorsB; j++) {
        if (used.has(j)) continue;
        const bCol = bMatrix.map((row) => row[j] ?? 0);
        const phi = tuckerPhi(aCol, bCol);
        if (best === null || Math.abs(phi) > Math.abs(best.phi)) {
            best = { aIndex, bIndex: j, phi };
        }
    }
    return best;
}
```

Replace the body of `matchFactorsByPhi` with:

```ts
export function matchFactorsByPhi(
    aMatrix: readonly (readonly number[])[],
    bMatrix: readonly (readonly number[])[]
): FactorMatch[] {
    if (aMatrix.length === 0 || bMatrix.length === 0) return [];
    const nFactorsA = aMatrix[0]?.length ?? 0;
    const used = new Set<number>();
    const matches: FactorMatch[] = [];
    for (let i = 0; i < nFactorsA; i++) {
        const aCol = aMatrix.map((row) => row[i] ?? 0);
        const best = findBestMatchForFactor(i, aCol, bMatrix, used);
        if (best !== null) {
            used.add(best.bIndex);
            matches.push(best);
        }
    }
    return matches;
}
```

- [ ] **Step 4: Re-run tests**

```
cd frontend && npx vitest run src/utils/tuckerPhi.test.ts
```
Expected: all tests (existing + 5 new) PASS.

- [ ] **Step 5: Verify lint warning removed**

```
cd frontend && npx biome check src/utils/tuckerPhi.ts
```
Expected: no `noExcessiveCognitiveComplexity`.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/utils/tuckerPhi.ts frontend/src/utils/tuckerPhi.test.ts
git commit -m "refactor(utils): extract findBestMatchForFactor from matchFactorsByPhi (W1)

Reduces cognitive complexity from 16 to <10 by lifting the inner-loop
match selection into a standalone exported helper. 5 new tests cover
unused-column selection, used-set filtering, sign preservation, and
empty-matrix edge cases."
```

---

## Task 3: Refactor `createResetToDefaultHandler` inner callback (P3, complexity 21 → ≤10)

**Files:**
- Modify: `frontend/src/utils/studyResetHelpers.ts`
- Create: `frontend/src/utils/studyResetHelpers.test.ts`

The complexity is in the `updateDraft((d) => { … })` callback that iterates translations and applies defaults. Extract `applyDefaultsToTranslations(draft, field, transform)` as a pure mutator (the function mutates the draft but is otherwise testable in isolation).

- [ ] **Step 1: Write characterization tests for the new helper**

```ts
// frontend/src/utils/studyResetHelpers.test.ts
import { describe, it, expect, vi } from 'vitest';
import { applyDefaultsToTranslations } from './studyResetHelpers';

vi.mock('@/constants/studyDefaults', () => ({
    DEFAULT_STUDY_CONTENT: {
        en: { instructions: 'Default EN instructions', title: 'Default EN title' },
        fr: { instructions: 'Default FR instructions', title: 'Default FR title' },
    },
}));

describe('applyDefaultsToTranslations', () => {
    it('returns early when draft has no translations', () => {
        const draft: { translations?: unknown } = {};
        applyDefaultsToTranslations(draft, 'instructions');
        expect(draft).toEqual({});
    });

    it('applies the EN default to a single EN translation', () => {
        const draft = { translations: [{ language_code: 'en', instructions: 'old' }] };
        applyDefaultsToTranslations(draft, 'instructions');
        expect(draft.translations[0].instructions).toBe('Default EN instructions');
    });

    it('falls back to EN default when language is not in DEFAULT_STUDY_CONTENT', () => {
        const draft = { translations: [{ language_code: 'fi', instructions: 'old' }] };
        applyDefaultsToTranslations(draft, 'instructions');
        expect(draft.translations[0].instructions).toBe('Default EN instructions');
    });

    it('applies per-language defaults independently', () => {
        const draft = {
            translations: [
                { language_code: 'en', title: 'old' },
                { language_code: 'fr', title: 'old' },
            ],
        };
        applyDefaultsToTranslations(draft, 'title');
        expect(draft.translations[0].title).toBe('Default EN title');
        expect(draft.translations[1].title).toBe('Default FR title');
    });

    it('applies the transform when provided', () => {
        const draft = { translations: [{ language_code: 'en', title: 'old' }] };
        applyDefaultsToTranslations(draft, 'title', (v: string) => `[${v}]`);
        expect(draft.translations[0].title).toBe('[Default EN title]');
    });

    it('skips a field absent from defaults', () => {
        const draft = { translations: [{ language_code: 'en', missing: 'kept' }] };
        applyDefaultsToTranslations(draft, 'missing');
        expect(draft.translations[0].missing).toBe('kept');
    });
});
```

- [ ] **Step 2: Run tests — should fail (helper not exported)**

```
cd frontend && npx vitest run src/utils/studyResetHelpers.test.ts
```
Expected: tests FAIL with "applyDefaultsToTranslations is not a function".

- [ ] **Step 3: Extract the helper and slim the callback**

Replace `frontend/src/utils/studyResetHelpers.ts` with:

```ts
import { DEFAULT_STUDY_CONTENT } from '@/constants/studyDefaults';
import { toast } from 'sonner';
import type { TFunction } from 'i18next';

interface ResetOptions {
    confirmMessage?: string;
    successMessage?: string;
    requireConfirmation?: boolean;
}

/**
 * Apply the localized default for `field` to every translation on the draft.
 * Mutates `draft` in place. Falls back to EN defaults when a language is not
 * in DEFAULT_STUDY_CONTENT. Optionally transforms the default value.
 */
export function applyDefaultsToTranslations(
    // biome-ignore lint/suspicious/noExplicitAny: draft requires dynamic property access
    draft: any,
    field: string,
    // biome-ignore lint/suspicious/noExplicitAny: transform handles various value types
    transform?: (value: any) => any
): void {
    if (!draft.translations) return;

    for (const trans of draft.translations) {
        const lang = trans.language_code;
        const defaults = DEFAULT_STUDY_CONTENT[lang] || DEFAULT_STUDY_CONTENT.en;

        if (defaults && defaults[field] !== undefined) {
            const defaultValue = defaults[field];
            const valueToApply = transform ? transform(defaultValue) : defaultValue;
            trans[field] = JSON.parse(JSON.stringify(valueToApply));
        }
    }
}

export const createResetToDefaultHandler = (
    // biome-ignore lint/suspicious/noExplicitAny: draft requires dynamic property access
    updateDraft: (fn: (draft: any) => void) => void,
    t: TFunction,
    options: ResetOptions = {}
) => {
    // biome-ignore lint/suspicious/noExplicitAny: transform function needs to handle various value types
    return (field: string, transform?: (value: any) => any) => {
        const {
            confirmMessage,
            successMessage = t('common.reset_to_default_success'),
            requireConfirmation = options.requireConfirmation ?? false,
        } = options;

        const doReset = () => {
            updateDraft((d) => applyDefaultsToTranslations(d, field, transform));
            toast.success(successMessage);
        };

        if (requireConfirmation && confirmMessage) {
            if (window.confirm(confirmMessage)) {
                doReset();
            }
        } else {
            doReset();
        }
    };
};
```

- [ ] **Step 4: Re-run tests**

```
cd frontend && npx vitest run src/utils/studyResetHelpers.test.ts
```
Expected: all 6 tests PASS.

- [ ] **Step 5: Verify lint warning removed**

```
cd frontend && npx biome check src/utils/studyResetHelpers.ts
```
Expected: no `noExcessiveCognitiveComplexity`.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/utils/studyResetHelpers.ts frontend/src/utils/studyResetHelpers.test.ts
git commit -m "refactor(utils): extract applyDefaultsToTranslations from reset handler (W1)

Reduces cognitive complexity from 21 to <10 by lifting the per-translation
default application into a pure exported mutator. 6 new tests cover EN
fallback for unknown languages, per-language application, transform
support, and absent-field skipping."
```

---

## Task 4: Refactor `handleErrorStatus` (P3, complexity 19 → ≤10)

**Files:**
- Modify: `frontend/src/api/mutator.ts`

The function dispatches per HTTP status (401, 403, 429, 409, 5xx). Each branch is independent. Extract one handler per status as module-private functions. The 401 branch is the most complex (token state, auth-store coordination) and benefits most from isolation.

- [ ] **Step 1: Read current handler tests**

```
cd frontend && grep -r "handleErrorStatus\|mutator" src/ --include="*.test.ts" --include="*.test.tsx"
```
If no tests exist for `mutator.ts`, **do not** add new ones — `mutator.ts` is hard to unit-test (touches global stores, `window.location`, `i18n`). Step 4's behavior verification relies on existing API integration tests. Skip to Step 3.

- [ ] **Step 2: Capture current behavior via lint+type baseline**

```
cd frontend && npx biome check src/api/mutator.ts && npx tsc --noEmit
```
Expected: 1 `noExcessiveCognitiveComplexity` warning on line 72; no type errors.

- [ ] **Step 3: Split per status code**

In `frontend/src/api/mutator.ts`, replace the body of `handleErrorStatus` (lines 71-151) with the dispatcher below, keeping its signature unchanged. Add the four module-private helpers above it:

```ts
function handle401(method: string, url: string): void {
    if (url.includes('/api/token') || url.includes('/api/study/')) return;
    // biome-ignore lint/suspicious/noExplicitAny: window hack to suppress unsaved-changes dialog
    (window as any).__isAutoLogout = true;

    const hadToken = useAuthStore.getState().token !== null;
    useAuthStore.getState().logout();
    useSessionStore.getState().resetSession();
    useResponseStore.getState().resetResponses();
    if (!window.location.pathname.includes('/login')) {
        const reason = hadToken ? 'session_expired' : 'auth_required';
        window.location.href = `/login?reason=${reason}`;
    }
}

function handle403(method: string, url: string, parsedMessage: string, parsedCode: string | undefined): void {
    console.warn('Access Forbidden:', method, url);
    if (method.toUpperCase() === 'GET') return;
    const { key, fallback } = resolveApiErrorKey({ code: parsedCode, message: parsedMessage });
    const description = key
        ? i18n.t(key, fallback)
        : parsedMessage ||
          i18n.t('errors.access_denied_description', 'You do not have permission to perform this action.');
    toast.error(i18n.t('errors.access_denied_title', 'Access Denied'), {
        id: `403:${method}:${url}`,
        description,
    });
}

function handle409(method: string, url: string, parsedMessage: string, parsedCode: string | undefined): void {
    const { key, fallback } = resolveApiErrorKey({ code: parsedCode, message: parsedMessage });
    toast.error(i18n.t('errors.conflict_title', 'Conflict'), {
        id: `409:${method}:${url}`,
        description: key
            ? i18n.t(key, fallback)
            : parsedMessage ||
              i18n.t('errors.conflict_description', 'The resource has been modified or already exists.'),
    });
}

function handle429(url: string): void {
    toast.error(i18n.t('errors.rate_limited_title', 'Too Many Requests'), {
        id: `429:${url}`,
        description: i18n.t('errors.rate_limited_description', 'Please wait a moment before trying again.'),
    });
}

function handleErrorStatus(
    status: number,
    method: string,
    url: string,
    errorText: string,
    parsedMessage: string,
    parsedCode: string | undefined
): void {
    if (status === 401) handle401(method, url);
    else if (status === 403) handle403(method, url, parsedMessage, parsedCode);
    else if (status === 409) handle409(method, url, parsedMessage, parsedCode);
    else if (status === 429) handle429(url);
    if (status >= 500) {
        reportBug(`Server Error ${status} at ${url}: ${errorText}`, { endpoint: url, status });
    }
}
```

**Note**: 5xx and 401 are not mutually exclusive in the original (5xx could co-occur with 401 logically — the original code uses separate `if`s, not `else if`). The refactor preserves this: `if (status >= 500)` stays as a separate trailing `if`.

- [ ] **Step 4: Verify type check + lint**

```
cd frontend && npx tsc --noEmit && npx biome check src/api/mutator.ts
```
Expected: type-check OK; no `noExcessiveCognitiveComplexity` warning.

- [ ] **Step 5: Run full unit suite to catch regression**

```
cd frontend && npx vitest run
```
Expected: all green.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/api/mutator.ts
git commit -m "refactor(api): split handleErrorStatus into per-status handlers (W1)

Reduces cognitive complexity from 19 to <10 by extracting handle401/403/
409/429 as module-private functions. Behavior preserved including the
5xx-and-other coexistence (separate trailing if, not else-if)."
```

---

## Task 5: Refactor `useStudyPersistence` change-detection effect (P4, complexity 16 → ≤10)

**Files:**
- Modify: `frontend/src/hooks/useStudyPersistence.ts`
- Create: `frontend/src/hooks/useStudyPersistence.helpers.ts`
- Create: `frontend/src/hooks/useStudyPersistence.helpers.test.ts`

The `useEffect` at line 60 mixes "is the draft synced?" detection with "back up to localStorage" scheduling. Extract the pure sync-detection into a helper.

- [ ] **Step 1: Write tests for the extracted predicate**

```ts
// frontend/src/hooks/useStudyPersistence.helpers.test.ts
import { describe, it, expect } from 'vitest';
import { isDraftInSync } from './useStudyPersistence.helpers';

describe('isDraftInSync', () => {
    it('returns true when draft equals original', () => {
        const draft = { id: 1, title: 'a' };
        const original = { id: 1, title: 'a' };
        expect(isDraftInSync(draft, original, null)).toBe(true);
    });

    it('returns true when draft equals last saved (even if differs from original)', () => {
        const draft = { id: 1, title: 'b' };
        const original = { id: 1, title: 'a' };
        const lastSaved = JSON.stringify({ id: 1, title: 'b' });
        expect(isDraftInSync(draft, original, lastSaved)).toBe(true);
    });

    it('returns false when draft differs from both', () => {
        const draft = { id: 1, title: 'c' };
        const original = { id: 1, title: 'a' };
        const lastSaved = JSON.stringify({ id: 1, title: 'b' });
        expect(isDraftInSync(draft, original, lastSaved)).toBe(false);
    });

    it('handles null original (no server state yet)', () => {
        const draft = { id: 1, title: 'a' };
        const lastSaved = JSON.stringify({ id: 1, title: 'a' });
        expect(isDraftInSync(draft, null, lastSaved)).toBe(true);
    });

    it('handles null lastSaved', () => {
        const draft = { id: 1, title: 'a' };
        const original = { id: 1, title: 'a' };
        expect(isDraftInSync(draft, original, null)).toBe(true);
    });
});
```

- [ ] **Step 2: Run tests — fail (module not yet created)**

```
cd frontend && npx vitest run src/hooks/useStudyPersistence.helpers.test.ts
```
Expected: FAIL with "Cannot find module".

- [ ] **Step 3: Create the helpers module**

```ts
// frontend/src/hooks/useStudyPersistence.helpers.ts
import { projectStudyToUpdate, areStudiesEqual } from '@/store/useStudyDesigner';
import type { StudyUpdate, StudyRead } from '@/api/model';

export function isDraftInSync(
    draft: StudyUpdate,
    original: StudyRead | null,
    lastSavedDraftJson: string | null
): boolean {
    const originalDraft = original ? projectStudyToUpdate(original) : null;
    if (areStudiesEqual(draft, originalDraft)) return true;
    if (lastSavedDraftJson) {
        return areStudiesEqual(draft, JSON.parse(lastSavedDraftJson));
    }
    return false;
}
```

- [ ] **Step 4: Run helper tests, verify green**

```
cd frontend && npx vitest run src/hooks/useStudyPersistence.helpers.test.ts
```
Expected: all 5 tests PASS.

- [ ] **Step 5: Slim the `useEffect` in `useStudyPersistence.ts`**

Replace the entire effect (lines 60-104, from `useEffect(() => {` through `}, [draft, …]);`) with:

```ts
useEffect(() => {
    if (!draft || !effectiveSlug) return;

    const synced = isDraftInSync(draft, original ?? null, lastSavedDraftRef.current);

    if (synced) {
        if (syncStatus !== 'synced' && syncStatus !== 'saving') {
            setSyncStatus('synced');
        }
        return;
    }

    if (syncStatus !== 'modified' && syncStatus !== 'saving' && syncStatus !== 'error') {
        setSyncStatus('modified');
    }

    // 5. Local Backup Logic — keeps a localStorage snapshot keyed by slug
    // as a safety net against crashes/refreshes. Debounced 1s so we don't
    // hammer storage on every keystroke.
    const backupTimer = setTimeout(() => {
        if (syncStatus === 'modified' || syncStatus === 'saving') {
            const backupData = {
                ...draft,
                _study_id: original?.id,
                _backup_at: new Date().toISOString(),
            };
            localStorage.setItem(
                `qualis-draft-backup-${effectiveSlug}`,
                JSON.stringify(backupData)
            );
            // Also update the test-draft key so open test tabs react via 'storage' event.
            localStorage.setItem(`qualis-test-draft-${effectiveSlug}`, JSON.stringify(draft));
        }
    }, 1000);

    return () => clearTimeout(backupTimer);
}, [draft, effectiveSlug, original, setSyncStatus, syncStatus]);
```

Add the import at the top of the file:

```ts
import { isDraftInSync } from './useStudyPersistence.helpers';
```

- [ ] **Step 6: Run hook tests + lint**

```
cd frontend && npx vitest run src/hooks/useStudyPersistence.test.ts && npx biome check src/hooks/useStudyPersistence.ts
```
Expected: existing hook tests PASS; no `noExcessiveCognitiveComplexity` for the line-60 site.

- [ ] **Step 7: Commit**

```bash
git add frontend/src/hooks/useStudyPersistence.ts frontend/src/hooks/useStudyPersistence.helpers.ts frontend/src/hooks/useStudyPersistence.helpers.test.ts
git commit -m "refactor(hooks): extract isDraftInSync from useStudyPersistence (W1)

Reduces cognitive complexity at line 60 from 16 to <10 by lifting the
sync-detection logic into a pure helper module. 5 tests cover original-
match, last-saved-match, both-mismatch, null original, and null last-saved
cases."
```

---

## Task 6: Refactor `useStudyPersistence` save callback (P4, complexity ~25 → ≤10)

**Files:**
- Modify: `frontend/src/hooks/useStudyPersistence.ts`
- Modify: `frontend/src/hooks/useStudyPersistence.helpers.ts`
- Modify: `frontend/src/hooks/useStudyPersistence.helpers.test.ts`

The 409-conflict merge branch is the source of complexity. Extract `mergeServerConflict(apiError, draft, original)` returning a discriminated union (`'merged' | 'hard-conflict' | 'merge-error'`) plus payload.

- [ ] **Step 1: Add tests for the new helper**

Append to `frontend/src/hooks/useStudyPersistence.helpers.test.ts`:

```ts
import { resolveServerConflict } from './useStudyPersistence.helpers';
import type { StudyRead } from '@/api/model';

const fakeServerRead = { id: 1, title: 'server' } as unknown as StudyRead;

describe('resolveServerConflict', () => {
    it('returns hard-conflict when merge fails', () => {
        // Force mergeStudyUpdates to return success:false by passing
        // incompatible drafts — for the test, we mock the merge module.
        // This test acts as a guard for the discriminated-union shape;
        // detailed merge-result behavior is covered in mergeStudy.test.ts.
        const result = resolveServerConflict(
            { id: 1, title: 'local' },
            fakeServerRead,
            null,
            () => ({ success: false, merged: null, warnings: [] })
        );
        expect(result.kind).toBe('hard-conflict');
    });

    it('returns merged on success', () => {
        const result = resolveServerConflict(
            { id: 1, title: 'local' },
            fakeServerRead,
            null,
            () => ({ success: true, merged: { id: 1, title: 'merged' }, warnings: [] })
        );
        expect(result.kind).toBe('merged');
        if (result.kind === 'merged') {
            expect(result.merged).toEqual({ id: 1, title: 'merged' });
            expect(result.warnings).toEqual([]);
            expect(result.serverRead).toBe(fakeServerRead);
        }
    });

    it('forwards warnings on partial merge', () => {
        const result = resolveServerConflict(
            { id: 1, title: 'local' },
            fakeServerRead,
            null,
            () => ({ success: true, merged: { id: 1 }, warnings: ['title'] })
        );
        if (result.kind === 'merged') {
            expect(result.warnings).toEqual(['title']);
        }
    });
});
```

- [ ] **Step 2: Run tests — fail**

```
cd frontend && npx vitest run src/hooks/useStudyPersistence.helpers.test.ts
```
Expected: 3 new tests FAIL with "resolveServerConflict is not a function".

- [ ] **Step 3: Add the helper**

Append to `frontend/src/hooks/useStudyPersistence.helpers.ts`:

```ts
import { mergeStudyUpdates, type MergeStudyResult } from '@/utils/mergeStudy';
import type { StudyUpdate, StudyRead } from '@/api/model';

type MergeFn = (
    local: StudyUpdate,
    server: StudyUpdate,
    original: StudyUpdate | null,
    strategy: 'local-wins'
) => MergeStudyResult;

export type ConflictResolution =
    | { kind: 'merged'; merged: StudyUpdate; warnings: string[]; serverRead: StudyRead }
    | { kind: 'hard-conflict' };

export function resolveServerConflict(
    draft: StudyUpdate,
    serverRead: StudyRead,
    original: StudyRead | null,
    merge: MergeFn = mergeStudyUpdates
): ConflictResolution {
    const serverUpdate = projectStudyToUpdate(serverRead);
    const originalUpdate = original ? projectStudyToUpdate(original) : null;
    const result = merge(draft, serverUpdate, originalUpdate, 'local-wins');
    if (result.success && result.merged) {
        return {
            kind: 'merged',
            merged: result.merged,
            warnings: result.warnings ?? [],
            serverRead,
        };
    }
    return { kind: 'hard-conflict' };
}
```

(`MergeStudyResult` is already exported from `@/utils/mergeStudy`. If not, add that export — verify with `grep "export.*MergeStudyResult" frontend/src/utils/mergeStudy.ts` first; add `export` to the existing interface declaration if missing.)

- [ ] **Step 4: Re-run helper tests**

```
cd frontend && npx vitest run src/hooks/useStudyPersistence.helpers.test.ts
```
Expected: all 8 tests PASS.

- [ ] **Step 5: Slim the `save` callback**

In `frontend/src/hooks/useStudyPersistence.ts`, replace the 409 branch (lines 149-208) with:

```ts
if (apiError?.status === 409 && apiError.details?.server_state) {
    try {
        const resolution = resolveServerConflict(
            draft,
            apiError.details.server_state,
            original ?? null
        );

        if (resolution.kind === 'merged') {
            if (resolution.warnings.length > 0) {
                toast.info(
                    t('admin.study.save.synced_warnings', {
                        fields: resolution.warnings.join(', '),
                    })
                );
            } else {
                toast.info(t('admin.study.save.synced_concurrent'));
            }

            updateOriginal(resolution.serverRead);
            updateDraft((d) => {
                Object.keys(d).forEach((k) => {
                    // @ts-expect-error
                    if (resolution.merged[k] === undefined) delete d[k];
                });
                Object.assign(d, resolution.merged);
            });
            lastSavedDraftRef.current = null;
            setSyncStatus('modified');
            return;
        }

        toast.error(
            t(
                'admin.study.save.conflict',
                'Conflict detected. Some changes could not be merged.'
            )
        );
        setSyncStatus('error');
        return;
    } catch (mergeError) {
        console.error('Merge failed', mergeError);
        setSyncStatus('error');
    }
} else {
    console.error('Save failed:', error);
    setSyncStatus('error');
    toast.error(t('admin.study.save.error', 'Failed to save changes'));
}
```

Add the import: `import { resolveServerConflict } from './useStudyPersistence.helpers';`

- [ ] **Step 6: Run hook tests + lint**

```
cd frontend && npx vitest run src/hooks/useStudyPersistence.test.ts && npx biome check src/hooks/useStudyPersistence.ts
```
Expected: hook tests PASS; no `noExcessiveCognitiveComplexity` warnings on this file.

- [ ] **Step 7: Commit**

```bash
git add frontend/src/hooks/useStudyPersistence.ts frontend/src/hooks/useStudyPersistence.helpers.ts frontend/src/hooks/useStudyPersistence.helpers.test.ts
git commit -m "refactor(hooks): extract resolveServerConflict from useStudyPersistence (W1)

Reduces cognitive complexity at line 107 from ~25 to <10 by lifting the
409-conflict merge branch into a pure helper that returns a discriminated
union ('merged' | 'hard-conflict'). 3 new tests cover the merge-success,
merge-failure, and warning-forwarding paths."
```

---

## Task 7: Refactor `useDragAutoInteraction.startPanInterval` (P4, complexity ~22 → ≤10)

**Files:**
- Modify: `frontend/src/hooks/useDragAutoInteraction.ts`
- Create: `frontend/src/hooks/useDragAutoInteraction.helpers.ts`
- Create: `frontend/src/hooks/useDragAutoInteraction.helpers.test.ts`

The complexity is in the `setInterval` body that computes `speedFactor`, then `effectiveDx/Dy`, then clamps to bounds. Extract `computeNextPanPosition(state, panSpeed, lastPos, dimensions): { x, y } | null` (returns null when no movement is needed).

- [ ] **Step 1: Write helper tests**

```ts
// frontend/src/hooks/useDragAutoInteraction.helpers.test.ts
import { describe, it, expect } from 'vitest';
import { computeNextPanPosition, computeEdgePanSpeed } from './useDragAutoInteraction.helpers';

describe('computeNextPanPosition', () => {
    const dims = { contentW: 1000, contentH: 800, wrapperW: 500, wrapperH: 400 };

    it('returns null when speed is zero', () => {
        const r = computeNextPanPosition(
            { positionX: 0, positionY: 0, scale: 1 },
            { dx: 0, dy: 0 },
            { x: 250, y: 200 },
            dims,
            null
        );
        expect(r).toBeNull();
    });

    it('moves position by dx/dy at scale 1', () => {
        const r = computeNextPanPosition(
            { positionX: 0, positionY: 0, scale: 1 },
            { dx: 5, dy: 3 },
            { x: 250, y: 200 },
            dims,
            null
        );
        expect(r).toEqual({ x: 5, y: 3 });
    });

    it('clamps to wrapper - content bounds', () => {
        const r = computeNextPanPosition(
            { positionX: -10000, positionY: -10000, scale: 1 },
            { dx: -100, dy: -100 },
            { x: 250, y: 200 },
            dims,
            null
        );
        // minX = 500 - 1000*1 - 500*0.2 = -600 ; effective dx clamped here.
        expect(r?.x).toBeGreaterThanOrEqual(-600);
        expect(r?.y).toBeGreaterThanOrEqual(-1000 + 400 + 400 * 0.2 ? -480 : -480);
    });

    it('reduces speed by 0.3 when cursor is outside grid rect', () => {
        const r = computeNextPanPosition(
            { positionX: 0, positionY: 0, scale: 1 },
            { dx: 10, dy: 0 },
            { x: 1000, y: 200 },  // x > gridRect.right
            dims,
            { left: 0, right: 500, top: 0, bottom: 400 }
        );
        expect(r?.x).toBeCloseTo(3, 5);  // 10 * 0.3
    });
});

describe('computeEdgePanSpeed', () => {
    const rect = { left: 0, right: 500, top: 0, bottom: 400 };

    it('returns zero speed in the center', () => {
        expect(computeEdgePanSpeed(250, 200, rect)).toEqual({ dx: 0, dy: 0 });
    });

    it('pans right when near left edge', () => {
        const { dx } = computeEdgePanSpeed(10, 200, rect);
        expect(dx).toBeGreaterThan(0);
    });

    it('pans left when near right edge', () => {
        const { dx } = computeEdgePanSpeed(495, 200, rect);
        expect(dx).toBeLessThan(0);
    });

    it('pans down when near top edge', () => {
        const { dy } = computeEdgePanSpeed(250, 10, rect);
        expect(dy).toBeGreaterThan(0);
    });

    it('pans up when near bottom edge', () => {
        const { dy } = computeEdgePanSpeed(250, 395, rect);
        expect(dy).toBeLessThan(0);
    });
});
```

- [ ] **Step 2: Run tests — fail**

```
cd frontend && npx vitest run src/hooks/useDragAutoInteraction.helpers.test.ts
```
Expected: tests FAIL with "Cannot find module".

- [ ] **Step 3: Create the helpers module**

```ts
// frontend/src/hooks/useDragAutoInteraction.helpers.ts

interface TransformState {
    positionX: number;
    positionY: number;
    scale: number;
}

interface PanSpeed {
    dx: number;
    dy: number;
}

interface Dimensions {
    contentW: number;
    contentH: number;
    wrapperW: number;
    wrapperH: number;
}

interface Rect {
    left: number;
    right: number;
    top: number;
    bottom: number;
}

/**
 * Compute the next clamped position for an auto-pan tick. Returns null when
 * the resulting position would equal the current one (no movement).
 *
 * @param gridRect optional grid bounding box; when the cursor is outside of
 *   it, speed is reduced to 30% (kinder when the user has moved off-grid).
 */
export function computeNextPanPosition(
    state: TransformState,
    panSpeed: PanSpeed,
    cursor: { x: number; y: number },
    dims: Dimensions,
    gridRect: Rect | null
): { x: number; y: number } | null {
    let speedFactor = 1.0;
    if (gridRect) {
        const { x, y } = cursor;
        if (x < gridRect.left || x > gridRect.right || y < gridRect.top || y > gridRect.bottom) {
            speedFactor = 0.3;
        }
    }

    const effectiveDx = panSpeed.dx * speedFactor;
    const effectiveDy = panSpeed.dy * speedFactor;

    const contentW = dims.contentW * state.scale;
    const contentH = dims.contentH * state.scale;
    const minX = dims.wrapperW - contentW - dims.wrapperW * 0.2;
    const maxX = dims.wrapperW * 0.2;
    const minY = dims.wrapperH - contentH - dims.wrapperH * 0.2;
    const maxY = dims.wrapperH * 0.2;

    const newX = Math.max(minX, Math.min(maxX, state.positionX + effectiveDx));
    const newY = Math.max(minY, Math.min(maxY, state.positionY + effectiveDy));

    if (newX === state.positionX && newY === state.positionY) return null;
    return { x: newX, y: newY };
}

/**
 * Compute the auto-pan speed when the cursor is near an edge of `rect`.
 * Returns zero speed when the cursor is in the central zone.
 */
export function computeEdgePanSpeed(
    x: number,
    y: number,
    rect: Rect
): PanSpeed {
    const edgeThreshold = 60;
    const maxPanSpeed = 15;
    let dx = 0;
    let dy = 0;

    if (x < rect.left + edgeThreshold) {
        dx = maxPanSpeed * Math.min((rect.left + edgeThreshold - x) / edgeThreshold, 1);
    } else if (x > rect.right - edgeThreshold) {
        dx = -maxPanSpeed * Math.min((x - (rect.right - edgeThreshold)) / edgeThreshold, 1);
    }

    if (y < rect.top + edgeThreshold) {
        dy = maxPanSpeed * Math.min((rect.top + edgeThreshold - y) / edgeThreshold, 1);
    } else if (y > rect.bottom - edgeThreshold) {
        dy = -maxPanSpeed * Math.min((y - (rect.bottom - edgeThreshold)) / edgeThreshold, 1);
    }

    return { dx, dy };
}
```

- [ ] **Step 4: Re-run helper tests**

```
cd frontend && npx vitest run src/hooks/useDragAutoInteraction.helpers.test.ts
```
Expected: all 9 tests PASS.

- [ ] **Step 5: Use the helpers from the hook**

In `frontend/src/hooks/useDragAutoInteraction.ts`:

Add at top: `import { computeNextPanPosition, computeEdgePanSpeed } from './useDragAutoInteraction.helpers';`

Replace the body of `startPanInterval` (lines 36-88) with:

```ts
const startPanInterval = useCallback(() => {
    if (panInterval.current) return;

    panInterval.current = setInterval(() => {
        const transform = interactionUtils?.transformRef.current;
        const content = interactionUtils?.contentRef.current;
        const wrapper = interactionUtils?.wrapperRef.current;

        if (!transform || !content || !wrapper) return;

        const state = transform.instance.transformState;
        const gridEl = document.querySelector('[data-testid="grid-container"]');
        const gridRect = gridEl ? gridEl.getBoundingClientRect() : null;

        const next = computeNextPanPosition(
            state,
            panSpeed.current,
            lastPos.current,
            {
                contentW: content.offsetWidth,
                contentH: content.offsetHeight,
                wrapperW: wrapper.clientWidth,
                wrapperH: wrapper.clientHeight,
            },
            gridRect
        );

        if (next) {
            transform.setTransform(next.x, next.y, state.scale, 0);
            onPan?.();
        } else {
            stopPan();
        }
    }, 16);
}, [interactionUtils, onPan, stopPan]);
```

Replace the edge-detection block in `updateInteraction` (lines 109-127) with:

```ts
const wrapper = interactionUtils.wrapperRef.current;
if (!wrapper) return;

const rect = wrapper.getBoundingClientRect();
const { dx, dy } = computeEdgePanSpeed(x, y, rect);
panSpeed.current = { dx, dy };
```

- [ ] **Step 6: Run hook tests + lint**

```
cd frontend && npx vitest run src/hooks/ && npx biome check src/hooks/useDragAutoInteraction.ts
```
Expected: hook tests PASS; no `noExcessiveCognitiveComplexity` warnings on this file.

- [ ] **Step 7: Commit**

```bash
git add frontend/src/hooks/useDragAutoInteraction.ts frontend/src/hooks/useDragAutoInteraction.helpers.ts frontend/src/hooks/useDragAutoInteraction.helpers.test.ts
git commit -m "refactor(hooks): extract pan computations from useDragAutoInteraction (W1)

Reduces cognitive complexity at lines 39 and 91 from 22+18 to <10 each by
extracting computeNextPanPosition (clamped pan tick with off-grid speed
attenuation) and computeEdgePanSpeed (edge-proximity speed). 9 tests
cover center/edge/corner cursor positions and bounds clamping."
```

This task closes both T7 and T8 (line 39 and line 91 are coupled — same hook, same edge logic).

---

## Task 8: Refactor `useGridZoom.performAutoFit` (P4, complexity ~25 → ≤10)

**Files:**
- Modify: `frontend/src/hooks/useGridZoom.ts`
- Create: `frontend/src/hooks/useGridZoom.helpers.ts`
- Create: `frontend/src/hooks/useGridZoom.helpers.test.ts`

The function branches on `isMobile` × `isLandscapeMobile` × desktop, each with its own scale/x/y formula. Extract `computeAutoFitTransform(dims, viewport): { scale, x, y }`.

- [ ] **Step 1: Helper tests**

```ts
// frontend/src/hooks/useGridZoom.helpers.test.ts
import { describe, it, expect } from 'vitest';
import { computeAutoFitTransform } from './useGridZoom.helpers';

const wrapperDims = { wrapperW: 500, wrapperH: 800, contentW: 1000, contentH: 600 };

describe('computeAutoFitTransform', () => {
    it('returns null when content has zero size', () => {
        expect(computeAutoFitTransform(
            { ...wrapperDims, contentW: 0 },
            { isDesktop: true, isLandscape: false }
        )).toBeNull();
    });

    it('portrait mobile: anchors bottom with 10px margin', () => {
        const r = computeAutoFitTransform(wrapperDims, { isDesktop: false, isLandscape: false });
        expect(r).not.toBeNull();
        if (!r) return;
        expect(r.y).toBeCloseTo(800 - 600 * r.scale - 10, 1);
    });

    it('landscape mobile: centers vertically', () => {
        const r = computeAutoFitTransform(wrapperDims, { isDesktop: false, isLandscape: true });
        if (!r) return;
        expect(r.y).toBeCloseTo((800 - 600 * r.scale) / 2, 1);
    });

    it('desktop: caps scale at 1.0', () => {
        // contentW=100, wrapperW=500 → scaleX would be ~4.3 ; cap to 1.0
        const r = computeAutoFitTransform(
            { wrapperW: 500, wrapperH: 800, contentW: 100, contentH: 60 },
            { isDesktop: true, isLandscape: false }
        );
        expect(r?.scale).toBe(1.0);
    });

    it('desktop: enforces minimum y of 20', () => {
        const r = computeAutoFitTransform(
            { wrapperW: 500, wrapperH: 100, contentW: 100, contentH: 60 },
            { isDesktop: true, isLandscape: false }
        );
        if (!r) return;
        expect(r.y).toBeGreaterThanOrEqual(20);
    });

    it('mobile: x is centered horizontally', () => {
        const r = computeAutoFitTransform(wrapperDims, { isDesktop: false, isLandscape: false });
        if (!r) return;
        expect(r.x).toBeCloseTo((500 - 1000 * r.scale) / 2, 1);
    });
});
```

- [ ] **Step 2: Run tests — fail**

```
cd frontend && npx vitest run src/hooks/useGridZoom.helpers.test.ts
```
Expected: FAIL.

- [ ] **Step 3: Create the helper**

```ts
// frontend/src/hooks/useGridZoom.helpers.ts

interface AutoFitDims {
    wrapperW: number;
    wrapperH: number;
    contentW: number;
    contentH: number;
}

interface Viewport {
    isDesktop: boolean;
    isLandscape: boolean;
}

interface AutoFitTransform {
    scale: number;
    x: number;
    y: number;
}

/**
 * Compute the (scale, x, y) for centering and fitting the grid content into
 * the wrapper. Branches on desktop / portrait-mobile / landscape-mobile,
 * each with empirically-tuned padding and anchoring rules. Returns null
 * when content dimensions are zero.
 */
export function computeAutoFitTransform(
    dims: AutoFitDims,
    viewport: Viewport
): AutoFitTransform | null {
    if (dims.contentW === 0 || dims.contentH === 0) return null;

    const { wrapperW, wrapperH, contentW, contentH } = dims;
    const { isDesktop, isLandscape } = viewport;
    const isMobile = !isDesktop;
    const isLandscapeMobile = isMobile && isLandscape;

    if (isMobile) {
        const widthScale = (wrapperW * 0.98) / contentW;
        const heightScale = (wrapperH * (isLandscapeMobile ? 0.95 : 0.9)) / contentH;
        const scale = isLandscapeMobile
            ? Math.min(widthScale, heightScale)
            : Math.min(widthScale, Math.max(heightScale, widthScale * 0.7));

        const x = (wrapperW - contentW * scale) / 2;
        const y = isLandscapeMobile
            ? (wrapperH - contentH * scale) / 2
            : wrapperH - contentH * scale - 10;

        return { scale, x, y };
    }

    // Desktop
    const padding = 70;
    const bottomLegendBuffer = 60;
    const availableW = wrapperW - padding;
    const availableH = wrapperH - padding - bottomLegendBuffer;
    const scale = Math.min(availableW / contentW, availableH / contentH, 1.0);
    const x = (wrapperW - contentW * scale) / 2;
    const yRaw = (wrapperH - contentH * scale) / 2;
    const y = yRaw < 20 ? 20 : yRaw;
    return { scale, x, y };
}
```

- [ ] **Step 4: Helper tests pass**

```
cd frontend && npx vitest run src/hooks/useGridZoom.helpers.test.ts
```
Expected: all 6 PASS.

- [ ] **Step 5: Use helper in the hook**

In `frontend/src/hooks/useGridZoom.ts`, replace the body of `performAutoFit` (lines 29-100) with:

```ts
const performAutoFit = useCallback(() => {
    if (!transformRef.current || !wrapperRef.current || !contentRef.current) return;
    const wrapper = wrapperRef.current;
    const content = contentRef.current;

    const transform = computeAutoFitTransform(
        {
            wrapperW: wrapper.clientWidth,
            wrapperH: wrapper.clientHeight,
            contentW: content.offsetWidth,
            contentH: content.offsetHeight,
        },
        { isDesktop, isLandscape }
    );
    if (!transform) return;

    transformRef.current.setTransform(transform.x, transform.y, transform.scale, 400, 'easeOutQuad');
}, [wrapperRef, contentRef, isDesktop, isLandscape]);
```

Add: `import { computeAutoFitTransform } from './useGridZoom.helpers';`

- [ ] **Step 6: Run hook tests + lint**

```
cd frontend && npx vitest run src/hooks/useGridZoom.test.ts && npx biome check src/hooks/useGridZoom.ts
```
Expected: hook tests PASS; no `noExcessiveCognitiveComplexity`.

- [ ] **Step 7: Commit**

```bash
git add frontend/src/hooks/useGridZoom.ts frontend/src/hooks/useGridZoom.helpers.ts frontend/src/hooks/useGridZoom.helpers.test.ts
git commit -m "refactor(hooks): extract computeAutoFitTransform from useGridZoom (W1)

Reduces cognitive complexity from ~25 to <10 by lifting the desktop /
portrait-mobile / landscape-mobile auto-fit branching into a pure helper.
6 tests cover zero-size short-circuit, mobile bottom anchor, landscape
center, desktop scale cap, and desktop minimum-y guard."
```

---

## Task 9: Refactor `useGridCalculations.calculateOptimalSize` (P4, complexity ~20 → ≤10)

**Files:**
- Modify: `frontend/src/hooks/useGridCalculations.ts`
- Create: `frontend/src/hooks/useGridCalculations.helpers.ts`
- Create: `frontend/src/hooks/useGridCalculations.helpers.test.ts`

The function combines short-circuit guards (orientation, focus mode) with the actual dimension math. Extract `computeCardDimensions(wrapperSize, gridColumns)` returning `{ width, height } | null`.

- [ ] **Step 1: Helper tests**

```ts
// frontend/src/hooks/useGridCalculations.helpers.test.ts
import { describe, it, expect } from 'vitest';
import { computeCardDimensions } from './useGridCalculations.helpers';

describe('computeCardDimensions', () => {
    it('returns null for zero-size wrapper', () => {
        expect(computeCardDimensions({ W: 0, H: 100 }, [{ score: 0, capacity: 5 }])).toBeNull();
        expect(computeCardDimensions({ W: 100, H: 0 }, [{ score: 0, capacity: 5 }])).toBeNull();
    });

    it('returns null for empty columns', () => {
        expect(computeCardDimensions({ W: 1000, H: 800 }, [])).toBeNull();
    });

    it('returns null when max row capacity is 0', () => {
        expect(computeCardDimensions({ W: 1000, H: 800 }, [{ score: 0, capacity: 0 }])).toBeNull();
    });

    it('clamps minimum dimensions to 140x90 on tiny screens', () => {
        const r = computeCardDimensions(
            { W: 200, H: 200 },
            Array.from({ length: 10 }, () => ({ score: 0, capacity: 10 }))
        );
        expect(r).not.toBeNull();
        if (!r) return;
        expect(r.width).toBeGreaterThanOrEqual(140);
        expect(r.height).toBeGreaterThanOrEqual(90);
    });

    it('uses clamped aspect ratio (1.2-1.8)', () => {
        const r = computeCardDimensions(
            { W: 4000, H: 200 },  // very wide → ratio would be huge
            [{ score: 0, capacity: 5 }]
        );
        if (!r) return;
        expect(r.width / r.height).toBeLessThanOrEqual(1.8 + 0.001);
    });

    it('respects vertical bound when content overflows height', () => {
        const r = computeCardDimensions(
            { W: 1000, H: 100 },
            Array.from({ length: 5 }, () => ({ score: 0, capacity: 10 }))
        );
        if (!r) return;
        // 10 rows × 90 = 900 > 100, but min bound applies
        expect(r.height).toBeGreaterThanOrEqual(90);
    });
});
```

- [ ] **Step 2: Run — fail**

```
cd frontend && npx vitest run src/hooks/useGridCalculations.helpers.test.ts
```

- [ ] **Step 3: Create helper**

```ts
// frontend/src/hooks/useGridCalculations.helpers.ts

interface GridColumn {
    score: number;
    capacity: number;
}

const GAP = 8;
const PADDING_X = 32;
const PADDING_Y = 32;
const MIN_W = 140;
const MIN_H = 90;
const MIN_RATIO = 1.2;
const MAX_RATIO = 1.8;

/**
 * Compute clamped card width/height that fit `gridColumns` within the
 * wrapper. Returns null on degenerate input (zero size, no columns,
 * zero-capacity columns).
 */
export function computeCardDimensions(
    wrapper: { W: number; H: number },
    gridColumns: GridColumn[]
): { width: number; height: number } | null {
    const { W, H } = wrapper;
    if (W === 0 || H === 0) return null;
    const numCols = gridColumns.length;
    if (numCols === 0) return null;
    const maxRows = Math.max(...gridColumns.map((c) => c.capacity || 0));
    if (maxRows === 0) return null;

    const availableW = W - PADDING_X - (numCols - 1) * GAP;
    const availableH = H - PADDING_Y - (maxRows - 1) * GAP;
    if (availableW <= 0 || availableH <= 0) return null;

    const rawW = availableW / numCols;
    const rawH = availableH / maxRows;
    const ratio = Math.max(MIN_RATIO, Math.min(rawW / rawH, MAX_RATIO));

    let width = rawW;
    let height = rawW / ratio;
    if (height > rawH) {
        height = rawH;
        width = height * ratio;
    }

    width = Math.max(width, MIN_W);
    height = Math.max(height, MIN_H);
    return { width, height };
}
```

- [ ] **Step 4: Helper tests pass**

```
cd frontend && npx vitest run src/hooks/useGridCalculations.helpers.test.ts
```
Expected: all 6 PASS.

- [ ] **Step 5: Use helper from hook**

In `frontend/src/hooks/useGridCalculations.ts`, replace the body of `calculateOptimalSize` (lines 34-101) with:

```ts
const calculateOptimalSize = useCallback(() => {
    if (!wrapperRef.current) return;

    const orientationChanged = isLandscape !== prevLandscapeRef.current;
    if (orientationChanged) {
        prevLandscapeRef.current = isLandscape;
    }
    if (selectedCardId && !isDesktop && !orientationChanged) return;

    const wrapper = wrapperRef.current;
    const next = computeCardDimensions(
        { W: wrapper.clientWidth, H: wrapper.clientHeight },
        gridColumns
    );
    if (!next) return;

    setCardDimensions((prev) => {
        if (Math.abs(prev.width - next.width) < 2 && Math.abs(prev.height - next.height) < 2) {
            return prev;
        }
        return next;
    });
}, [gridColumns, selectedCardId, isDesktop, isLandscape]);
```

Add: `import { computeCardDimensions } from './useGridCalculations.helpers';`

- [ ] **Step 6: Lint + tests**

```
cd frontend && npx biome check src/hooks/useGridCalculations.ts && npx vitest run src/hooks/
```
Expected: no warning on this file; tests green.

- [ ] **Step 7: Commit**

```bash
git add frontend/src/hooks/useGridCalculations.ts frontend/src/hooks/useGridCalculations.helpers.ts frontend/src/hooks/useGridCalculations.helpers.test.ts
git commit -m "refactor(hooks): extract computeCardDimensions from useGridCalculations (W1)

Reduces cognitive complexity from ~20 to <10 by lifting the dimension math
(aspect-ratio clamping, minimum size bounds, raw fitting) into a pure
helper. 6 tests cover null-on-degenerate-input, min-clamping, ratio
clamping, and vertical-bound paths."
```

---

## Task 10: Refactor `useFineSortDrag.handleDragEnd` (P4, complexity ~16 → ≤10)

**Files:**
- Modify: `frontend/src/hooks/useFineSortDrag.ts`
- Create: `frontend/src/hooks/useFineSortDrag.helpers.ts`
- Create: `frontend/src/hooks/useFineSortDrag.helpers.test.ts`

The handler decodes the `over.id` string into one of three intents: deck-drop (return to pile), placed-card-drop (resolve to its slot), slot-drop. Extract `resolveDropTarget(overId, qsort): DropTarget` returning a discriminated union.

- [ ] **Step 1: Helper tests**

```ts
// frontend/src/hooks/useFineSortDrag.helpers.test.ts
import { describe, it, expect } from 'vitest';
import { resolveDropTarget } from './useFineSortDrag.helpers';

describe('resolveDropTarget', () => {
    const qsort = [
        { statementId: 42, col: 3, row: 2 },
        { statementId: 99, col: 5, row: 1 },
    ];

    it('decodes a deck drop with category prefix', () => {
        expect(resolveDropTarget('deck-agree', qsort)).toEqual({
            kind: 'deck',
            category: 'agree',
        });
    });

    it('decodes a deck-area drop (deck-area-disagree)', () => {
        expect(resolveDropTarget('deck-area-disagree', qsort)).toEqual({
            kind: 'deck',
            category: 'disagree',
        });
    });

    it('decodes a slot drop', () => {
        expect(resolveDropTarget('slot_3_2', qsort)).toEqual({
            kind: 'slot',
            col: 3,
            row: 2,
        });
    });

    it('resolves a card-on-card drop to the underlying card slot', () => {
        // overId = '42' (number coerced to string) — refers to placed card 42 at (3,2)
        expect(resolveDropTarget('42', qsort)).toEqual({
            kind: 'slot',
            col: 3,
            row: 2,
        });
    });

    it('returns kind:none for an unrecognized overId with no matching card', () => {
        expect(resolveDropTarget('1234', qsort)).toEqual({ kind: 'none' });
    });

    it('returns kind:none for a malformed slot id', () => {
        expect(resolveDropTarget('slot_x_y', qsort)).toEqual({ kind: 'none' });
    });
});
```

- [ ] **Step 2: Run — fail**

- [ ] **Step 3: Create helper**

```ts
// frontend/src/hooks/useFineSortDrag.helpers.ts

interface PlacedCard {
    statementId: number;
    col: number;
    row: number;
}

export type DropTarget =
    | { kind: 'deck'; category: 'agree' | 'neutral' | 'disagree' }
    | { kind: 'slot'; col: number; row: number }
    | { kind: 'none' };

/**
 * Decode a DnD-Kit `over.id` (string) into the participant intent.
 * - `deck-<cat>` or `deck-area-<cat>` → return-to-pile
 * - `slot_<col>_<row>` → place at slot
 * - any other string that matches a placed card's statementId → resolve
 *   to that card's slot
 */
export function resolveDropTarget(overIdRaw: string, qsort: PlacedCard[]): DropTarget {
    let overId = overIdRaw;

    if (overId.startsWith('deck-')) {
        let cat = overId.replace('deck-', '');
        if (cat.startsWith('area-')) cat = cat.replace('area-', '');
        return { kind: 'deck', category: cat as 'agree' | 'neutral' | 'disagree' };
    }

    if (!overId.startsWith('slot_')) {
        const cardId = Number(overId);
        const placed = !Number.isNaN(cardId)
            ? qsort.find((c) => c.statementId === cardId)
            : undefined;
        if (placed) {
            overId = `slot_${placed.col}_${placed.row}`;
        } else {
            return { kind: 'none' };
        }
    }

    const parts = overId.split('_');
    if (parts.length !== 3 || !parts[1] || !parts[2]) return { kind: 'none' };
    const col = parseInt(parts[1], 10);
    const row = parseInt(parts[2], 10);
    if (Number.isNaN(col) || Number.isNaN(row)) return { kind: 'none' };
    return { kind: 'slot', col, row };
}
```

- [ ] **Step 4: Helper tests pass**

```
cd frontend && npx vitest run src/hooks/useFineSortDrag.helpers.test.ts
```
Expected: all 6 PASS.

- [ ] **Step 5: Use helper in hook**

In `frontend/src/hooks/useFineSortDrag.ts`, replace the body of `handleDragEnd` (lines 142-193) with:

```ts
const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
        const { active, over } = event;
        try {
            if (!over) return;
            const cardId = active.id as number;
            const target = resolveDropTarget(String(over.id), responses.qsort);

            if (target.kind === 'deck') {
                actions.unplaceCard(cardId);
                actions.categorizeCard(cardId, target.category);
                return;
            }
            if (target.kind === 'slot') {
                handlePlacement(cardId, target.col, target.row);
            }
        } catch (error) {
            console.error('Drag end error:', error);
        } finally {
            setActiveId(null);
            cleanupInteraction();
        }
    },
    [responses.qsort, handlePlacement, cleanupInteraction, actions]
);
```

Add: `import { resolveDropTarget } from './useFineSortDrag.helpers';`

- [ ] **Step 6: Run hook tests + lint**

```
cd frontend && npx vitest run src/hooks/useFineSortDrag.test.ts src/hooks/useFineSortDrag.deck.test.ts && npx biome check src/hooks/useFineSortDrag.ts
```
Expected: existing 2 hook test files PASS; no warning on this file.

- [ ] **Step 7: Commit**

```bash
git add frontend/src/hooks/useFineSortDrag.ts frontend/src/hooks/useFineSortDrag.helpers.ts frontend/src/hooks/useFineSortDrag.helpers.test.ts
git commit -m "refactor(hooks): extract resolveDropTarget from useFineSortDrag (W1)

Reduces cognitive complexity at line 143 from ~16 to <10 by decoding the
dnd-kit over.id into a discriminated union (deck/slot/none) up front.
6 tests cover deck-area prefix stripping, card-on-card resolution to slot,
malformed-slot rejection, and unrecognized-id fallback."
```

---

## Task 11: Refactor `useRecruitmentPage.onAccessRulesSubmit` (P4, complexity ~16 → ≤10)

**Files:**
- Modify: `frontend/src/hooks/admin/useRecruitmentPage.ts`
- Create: `frontend/src/hooks/admin/useRecruitmentPage.helpers.ts`
- Create: `frontend/src/hooks/admin/useRecruitmentPage.helpers.test.ts`

The complexity comes from building the `update` payload with nested branches on `isSlugLocked`, `passwordEnabled`, and date conversions. Extract `buildAccessRulesUpdate(values, opts): Record<string, unknown>`.

- [ ] **Step 1: Helper tests**

```ts
// frontend/src/hooks/admin/useRecruitmentPage.helpers.test.ts
import { describe, it, expect } from 'vitest';
import { buildAccessRulesUpdate } from './useRecruitmentPage.helpers';

describe('buildAccessRulesUpdate', () => {
    const baseValues = {
        passwordEnabled: false,
        accessPassword: '',
        startDate: null,
        endDate: null,
    };

    it('omits password fields when slug is locked', () => {
        const update = buildAccessRulesUpdate(
            { ...baseValues, passwordEnabled: true, accessPassword: 'secret' },
            { isSlugLocked: true }
        );
        expect(update).not.toHaveProperty('access_password');
    });

    it('clears password (null) when password is disabled in unlocked draft', () => {
        const update = buildAccessRulesUpdate(
            { ...baseValues, passwordEnabled: false },
            { isSlugLocked: false }
        );
        expect(update.access_password).toBeNull();
    });

    it('sets password when enabled and value provided in unlocked draft', () => {
        const update = buildAccessRulesUpdate(
            { ...baseValues, passwordEnabled: true, accessPassword: 'secret' },
            { isSlugLocked: false }
        );
        expect(update.access_password).toBe('secret');
    });

    it('omits password field when enabled but empty string in unlocked draft', () => {
        const update = buildAccessRulesUpdate(
            { ...baseValues, passwordEnabled: true, accessPassword: '' },
            { isSlugLocked: false }
        );
        expect(update).not.toHaveProperty('access_password');
    });

    it('serializes dates as ISO strings, null when absent', () => {
        const update = buildAccessRulesUpdate(
            {
                ...baseValues,
                startDate: '2026-01-01T00:00',
                endDate: null,
            },
            { isSlugLocked: false }
        );
        expect(update.start_date).toBe(new Date('2026-01-01T00:00').toISOString());
        expect(update.end_date).toBeNull();
    });
});
```

- [ ] **Step 2: Run — fail**

- [ ] **Step 3: Create helper**

```ts
// frontend/src/hooks/admin/useRecruitmentPage.helpers.ts

interface AccessRulesValues {
    passwordEnabled: boolean;
    accessPassword: string | null | undefined;
    startDate: string | null | undefined;
    endDate: string | null | undefined;
}

interface BuildOpts {
    isSlugLocked: boolean;
}

/**
 * Build the partial study-update payload for the recruitment "access rules"
 * form. Password edits are only valid in draft (unlocked) state — outside
 * draft, the backend whitelist accepts only start_date/end_date, so this
 * helper omits `access_password` entirely instead of sending a no-op null
 * that would trigger a 422.
 */
export function buildAccessRulesUpdate(
    data: AccessRulesValues,
    opts: BuildOpts
): Record<string, unknown> {
    const update: Record<string, unknown> = {};

    if (!opts.isSlugLocked) {
        if (!data.passwordEnabled) {
            update.access_password = null;
        } else if (data.accessPassword) {
            update.access_password = data.accessPassword;
        }
    }

    update.start_date = data.startDate ? new Date(data.startDate).toISOString() : null;
    update.end_date = data.endDate ? new Date(data.endDate).toISOString() : null;
    return update;
}
```

- [ ] **Step 4: Helper tests pass**

```
cd frontend && npx vitest run src/hooks/admin/useRecruitmentPage.helpers.test.ts
```
Expected: 5 PASS.

- [ ] **Step 5: Use helper in the hook**

In `frontend/src/hooks/admin/useRecruitmentPage.ts`, replace the body of `onAccessRulesSubmit` (lines 350-390) with:

```ts
const onAccessRulesSubmit = useCallback(
    async (data: AccessRulesValues) => {
        if (!slug) return;
        try {
            const update = buildAccessRulesUpdate(data, { isSlugLocked });
            await AdminService.updateStudy(slug, update as unknown as StudyUpdate);

            toast.success(
                t('admin.recruitment.access_rules.save_success', 'Access rules updated')
            );

            await queryClient.invalidateQueries({
                queryKey: getGetStudyApiAdminStudiesSlugGetQueryKey(slug),
            });
            revalidator.revalidate();
        } catch (error) {
            const message = parseApiErrorSync(
                error,
                t('admin.recruitment.access_rules.save_error', 'Failed to update access rules')
            );
            toast.error(
                t('admin.recruitment.access_rules.save_error', 'Failed to update access rules'),
                { description: message }
            );
        }
    },
    [slug, isSlugLocked, queryClient, revalidator, t]
);
```

Add: `import { buildAccessRulesUpdate } from './useRecruitmentPage.helpers';`

- [ ] **Step 6: Run hook tests + lint**

```
cd frontend && npx vitest run src/hooks/admin/ && npx biome check src/hooks/admin/useRecruitmentPage.ts
```
Expected: tests PASS; no `noExcessiveCognitiveComplexity` for line 350 (other warnings on this hook in W3 stay if any — none expected, this is the only W1/admin hook site).

- [ ] **Step 7: Commit**

```bash
git add frontend/src/hooks/admin/useRecruitmentPage.ts frontend/src/hooks/admin/useRecruitmentPage.helpers.ts frontend/src/hooks/admin/useRecruitmentPage.helpers.test.ts
git commit -m "refactor(hooks): extract buildAccessRulesUpdate helper (W1)

Reduces cognitive complexity at line 350 from ~16 to <10 by lifting the
access-rules payload construction (slug-lock / password-enabled / date
serialization) into a pure helper. 5 tests cover slug-lock omission,
password clear, password set, empty-string omission, date ISO conversion."
```

---

## Task 12: Wave-level verification + PR

**Files:** none new — verification only.

- [ ] **Step 1: Final lint count**

```
cd frontend && npx biome check src --max-diagnostics=200 2>&1 | grep -c "noExcessiveCognitiveComplexity"
```
Expected: 53 or lower (was 65, minus 12 sites = 53).

- [ ] **Step 2: Full local CI**

```
cd /home/julien/tools/qualis && make ci
```
Expected: green.

- [ ] **Step 3: Verify each W1 file is clean**

```
cd frontend && npx biome check \
    src/utils/uaParser.ts \
    src/utils/tuckerPhi.ts \
    src/utils/studyResetHelpers.ts \
    src/api/mutator.ts \
    src/hooks/useStudyPersistence.ts \
    src/hooks/useDragAutoInteraction.ts \
    src/hooks/useGridZoom.ts \
    src/hooks/useGridCalculations.ts \
    src/hooks/useFineSortDrag.ts \
    src/hooks/admin/useRecruitmentPage.ts
```
Expected: no `noExcessiveCognitiveComplexity` diagnostics.

- [ ] **Step 4: Push branch and open PR**

```bash
git push -u origin <branch>
gh pr create --title "refactor: reduce cognitive complexity — Wave 1 utilities & hooks" --body "$(cat <<'EOF'
## Summary
- Extract pure helpers from 12 cognitive-complexity sites in W1 scope (utilities + transverse hooks).
- Pin existing behavior with characterization tests before each refactor.
- Reduce frontend complexity warnings from 65 to 53 (-12, -18%).

Refactors follow patterns P3 (utility decomposition) and P4 (hook helper extraction) from `docs/superpowers/specs/2026-05-03-ci-warnings-design.md`.

Files refactored:
- `utils/uaParser.ts` — split into per-axis detectors
- `utils/tuckerPhi.ts` — extract findBestMatchForFactor
- `utils/studyResetHelpers.ts` — extract applyDefaultsToTranslations
- `api/mutator.ts` — split handleErrorStatus per status code
- `hooks/useStudyPersistence.ts` — extract isDraftInSync, resolveServerConflict
- `hooks/useDragAutoInteraction.ts` — extract computeNextPanPosition, computeEdgePanSpeed
- `hooks/useGridZoom.ts` — extract computeAutoFitTransform
- `hooks/useGridCalculations.ts` — extract computeCardDimensions
- `hooks/useFineSortDrag.ts` — extract resolveDropTarget
- `hooks/admin/useRecruitmentPage.ts` — extract buildAccessRulesUpdate

## Test plan
- [x] `make ci-fast` green at each commit
- [x] `make ci` green pre-push
- [x] Existing hook test files (`useStudyPersistence.test.ts`, `useGridZoom.test.ts`, `useFineSortDrag.test.ts`, `useFineSortDrag.deck.test.ts`, `tuckerPhi.test.ts`) still pass
- [x] 60+ new pure-helper tests added across 9 new `*.helpers.test.ts` / `*.test.ts` files
- [x] Frontend complexity warning count drops from 65 to ≤53

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

- [ ] **Step 5: Mark wave complete**

If the mid-point checkpoint (after W2) is not yet scheduled, add a follow-up TODO to the spec or open an issue to schedule it once W2 ships.

---

## Self-review checklist (run before closing this plan)

1. **Spec coverage** — every W1 site (12) has a task: ✅ (Tasks 1-11 cover the 12 sites, Task 7 closing both lines 39 and 91 of `useDragAutoInteraction`; Task 12 is the wave-level verification + PR).
2. **Placeholder scan** — no TBD/TODO/"add validation" in any task; the `useStudyPersistence` effect replacement spells out the localStorage backup block in full.
3. **Type consistency** — helper signatures are stable across tasks: `isDraftInSync` and `resolveServerConflict` both live in `useStudyPersistence.helpers.ts`; `computeNextPanPosition` and `computeEdgePanSpeed` both live in `useDragAutoInteraction.helpers.ts`; naming convention `<hookName>.helpers.ts` everywhere.
4. **No file outside W1 scope** is modified by these tasks (with one explicit exception: Task 6 may need to add `export` to `MergeStudyResult` in `frontend/src/utils/mergeStudy.ts` if not already exported — verified via grep before editing).
5. **Test count**: 9 (T1) + 5 (T2) + 6 (T3) + 0 (T4) + 5 (T5) + 3 (T6) + 9 (T7) + 6 (T8) + 6 (T9) + 6 (T10) + 5 (T11) = **60 new pure-helper tests** across 9 new test files.
