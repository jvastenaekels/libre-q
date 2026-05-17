# Wave 2 — StudyConfig Typing Adoption Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove ≥90 `biome-ignore lint/suspicious/noExplicitAny` suppressions from the study-config code by adopting the existing `StudyConfig` schema types behind a typed, zero-runtime accessor boundary in `utils/studyConfig.ts`, with no behaviour change.

**Architecture:** The canonical zod schema (`frontend/src/schemas/study.ts`) already models every config shape including the legacy↔new union. The ~95 `any` sites exist because the generated wire types are opaque (`{ [k]: unknown }`) by backend design. We add additive `z.infer`/indexed-access type aliases (zero schema edit), generalize the existing `utils/studyConfig.ts` `PresortLike` bridge into typed accessors (controlled compile-time assertion, no `zod.parse`), and route the top-10-cluster `any` sites through them. Type-only ⇒ behaviour preservation is structural (`tsc -b` + full existing suite green is the proof).

**Tech Stack:** TypeScript (strict via `tsc -b`/Biome), zod, React 19, Zustand (`useStudyDesigner`), Vitest.

**Branch:** `chore/code-quality-wave2-studyconfig-typing` (already created; spec committed there).

**The real typecheck gate is `cd frontend && npm run type-check` (= `tsc -b`).** `npx tsc --noEmit` is a FALSE-GREEN (root tsconfig is references-only) — never use it as the gate in this plan.

---

### Task 0: Baseline

**Files:** none modified.

- [ ] **Step 1: Record the noExplicitAny baseline**

Run: `grep -rc "biome-ignore lint/suspicious/noExplicitAny" frontend/src --include="*.ts" --include="*.tsx" | awk -F: '{s+=$2} END {print s}'`
Note the number (expected `245`). DoD target at the end: **≤ 155**.

- [ ] **Step 2: Record the green baseline**

Run: `cd frontend && npm run type-check && npx vitest run 2>&1 | tail -3`
Expected: `tsc -b` exit 0; full suite green (record the passed count, expected ~1419 passed / 6 skipped).

No commit (read-only).

---

### Task 1: Additive type exports + typed accessors (the only new code)

**Files:**
- Modify: `frontend/src/schemas/study.ts` (append 3 type exports — NO schema edits)
- Modify: `frontend/src/utils/studyConfig.ts` (add accessors)
- Create: `frontend/src/utils/studyConfig.test.ts`

- [ ] **Step 1: Write the failing accessor tests**

Create `frontend/src/utils/studyConfig.test.ts`:

```ts
/*
 * Qualis - Open-source platform for conducting Q-methodology research
 * Copyright (C) 2025 Qualis Team
 * Licensed under the GNU Affero General Public License v3.0 or later.
 */

import { describe, it, expect } from 'vitest';
import { presortFields, postsortConfig, processSteps } from './studyConfig';

describe('presortFields — legacy/new union collapse', () => {
    it('returns the field map for the legacy flat-record shape', () => {
        const cfg = { presort_config: { age: { type: 'number', label: 'Age' } } };
        expect(presortFields(cfg)).toEqual({ age: { type: 'number', label: 'Age' } });
    });

    it('returns config.fields for the new {enabled, fields} shape', () => {
        const cfg = {
            presort_config: { enabled: true, fields: { age: { type: 'number', label: 'Age' } } },
        };
        expect(presortFields(cfg)).toEqual({ age: { type: 'number', label: 'Age' } });
    });

    it('returns {} when presort_config is absent or null', () => {
        expect(presortFields({})).toEqual({});
        expect(presortFields({ presort_config: null })).toEqual({});
        expect(presortFields(null)).toEqual({});
    });
});

describe('postsortConfig', () => {
    it('returns the postsort object when present', () => {
        const cfg = { postsort_config: { ask_missing: true } };
        expect(postsortConfig(cfg)).toEqual({ ask_missing: true });
    });
    it('returns undefined when absent', () => {
        expect(postsortConfig({})).toBeUndefined();
        expect(postsortConfig(null)).toBeUndefined();
    });
});

describe('processSteps', () => {
    it('returns the steps array from a config/draft', () => {
        const steps = [{ id: '1', title: 'A', description: '', icon: 'X' }];
        expect(processSteps({ process_steps: steps })).toEqual(steps);
    });
    it('returns the steps array from a translation-like object', () => {
        const steps = [{ id: '1', title: 'A', description: '', icon: 'X' }];
        expect(processSteps({ process_steps: steps } as object)).toEqual(steps);
    });
    it('returns [] when absent or null', () => {
        expect(processSteps({})).toEqual([]);
        expect(processSteps(null)).toEqual([]);
        expect(processSteps({ process_steps: null })).toEqual([]);
    });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cd frontend && npx vitest run src/utils/studyConfig.test.ts`
Expected: FAIL — `presortFields`/`postsortConfig`/`processSteps` are not exported yet.

- [ ] **Step 3: Add the additive type exports (NO schema edits)**

In `frontend/src/schemas/study.ts`, immediately after the existing
`export type Statement = z.infer<typeof StatementSchema>;` line, append:

```ts
// Additive type aliases — derived from the existing schema, no schema-shape
// change, no runtime effect. PostsortConfig / PreSortFieldOption use
// indexed-access because those sub-schemas are inline in StudyConfigSchema /
// PreSortFieldSchema (extracting them to named consts is unnecessary).
export type ProcessStep = z.infer<typeof ProcessStepSchema>;
export type PostsortConfig = NonNullable<StudyConfig['postsort_config']>;
export type PreSortFieldOption = NonNullable<PreSortField['options']>[number];
```

- [ ] **Step 4: Implement the accessors**

In `frontend/src/utils/studyConfig.ts`, add the imports at the top
(after the existing file header comment) and the accessors at the end.
Keep the existing `RoughSortLike`/`PresortLike`/`isPresortEnabled`/
`isRoughSortEnabled` exactly as they are.

```ts
import type {
    PreSortField,
    PostsortConfig,
    ProcessStep,
} from '@/schemas/study';

/**
 * Structural input accepted by the config accessors: the participant-side
 * `StudyConfig`, the admin designer draft (`StudyUpdate`), a study
 * translation, or the opaque wire shape — all share the relevant keys.
 * Widened to `unknown`-valued fields so the single controlled assertion in
 * each accessor is the only place the opaque→typed bridge happens. No
 * runtime validation (zod.parse) — type-only by design (see spec).
 */
type ConfigLike = {
    presort_config?: unknown;
    postsort_config?: unknown;
    process_steps?: unknown;
} | null | undefined;

/** Field map regardless of legacy (flat record) vs new ({enabled, fields}). */
export function presortFields(config: ConfigLike): Record<string, PreSortField> {
    const pc = config?.presort_config;
    if (!pc || typeof pc !== 'object') return {};
    if ('fields' in pc) {
        return ((pc as { fields?: Record<string, PreSortField> }).fields ?? {});
    }
    return pc as Record<string, PreSortField>;
}

export function postsortConfig(config: ConfigLike): PostsortConfig | undefined {
    const pc = config?.postsort_config;
    if (!pc || typeof pc !== 'object') return undefined;
    return pc as PostsortConfig;
}

/** Steps from a config, designer draft, or a translation-like object. */
export function processSteps(source: ConfigLike): ProcessStep[] {
    const ps = source?.process_steps;
    return Array.isArray(ps) ? (ps as ProcessStep[]) : [];
}
```

- [ ] **Step 5: Run accessor tests + typecheck**

Run: `cd frontend && npx vitest run src/utils/studyConfig.test.ts && npm run type-check`
Expected: tests PASS (all describe blocks green); `tsc -b` exit 0.

- [ ] **Step 6: Lint**

Run: `cd frontend && npm run lint`
Expected: 0 errors on the 3 touched files; no `any`; no new `biome-ignore`.

- [ ] **Step 7: Commit**

```bash
git add frontend/src/schemas/study.ts frontend/src/utils/studyConfig.ts frontend/src/utils/studyConfig.test.ts
git commit -m "feat(types): StudyConfig type aliases + typed config accessors

Additive z.infer/indexed-access exports (no schema-shape change) +
zero-runtime accessors generalizing the existing PresortLike bridge.
Wave 2 foundation.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

### Task 2: Adopt types in `store/useStudyDesigner.ts` (~17 sites)

**Files:**
- Modify: `frontend/src/store/useStudyDesigner.ts`

The `any` sites and their prescribed replacement (verify each against the compiler — `npm run type-check` is the oracle):

- [ ] **Step 1: Replace the import-boundary `any` with `unknown`**

These take untyped external JSON — `any` → `unknown` is correct (still removes the suppression; narrow internally via the Task 1 accessors / type guards):
- `importConfig: (config: any)` (interface decl ~line 50) and `importConfig: (config: any) =>` (impl ~line 333) → `(config: unknown)`
- `applyImportedSimpleFields(draft: StudyUpdate, studyData: any)` (~349), `applyImportedStructuralFields(... studyData: any)` (~366), `applyImportedMergedConfigs(... studyData: any)` (~372), `applyImportedTranslations(... studyData: any)` (~391) → `studyData: unknown` (cast/narrow at first structured use; if a field read needs a shape, use a local `as { … }` on that read only, not a blanket `any`)
- `stripInternalFields(obj: any): any` (~106), `const newObj: any = {}` (~112) → generic `stripInternalFields<T>(obj: T): T` over `Record<string, unknown>` with `const newObj: Record<string, unknown> = {}` (it strips keys; no shape knowledge needed)

- [ ] **Step 2: Replace the element-shape `any` with schema types**

- `field: any` (~133) → `field: PreSortField` (import from `@/schemas/study`)
- `opt: any` (~160), return `): any` (~164), `(opt: any) =>` (~194) → `PreSortFieldOption`
- `q: any` (~183) → `PreSortField`

- [ ] **Step 3: Replace the config-cast `any` with accessors**

- `fields: draft.presort_config as any` (~230) and `const fields = (draft.presort_config as any).fields` (~234) → use `presortFields(draft)` from `@/utils/studyConfig`
- `const questions = (draft.postsort_config as any).questions` (~241) → `postsortConfig(draft)?.questions`

(The surrounding `normalizeStudyData` migration logic stays behaviourally identical — the accessor returns the same value the `as any` access produced; this is a type-only substitution.)

- [ ] **Step 4: Typecheck + full suite**

Run: `cd frontend && npm run type-check && npx vitest run`
Expected: `tsc -b` exit 0; full suite green (same passed count as Task 0 baseline — proves no behaviour change). If `tsc -b` flags a site, narrow with a precise local type at that read, never reintroduce `any` or a `biome-ignore`.

- [ ] **Step 5: Lint**

Run: `cd frontend && npm run lint`
Expected: 0 errors; `grep -c "biome-ignore lint/suspicious/noExplicitAny" frontend/src/store/useStudyDesigner.ts` → `0` (was ~17). No new suppression of any rule.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/store/useStudyDesigner.ts
git commit -m "refactor(types): adopt StudyConfig types in useStudyDesigner

Import boundary -> unknown; element shapes -> PreSortField/Option;
config casts -> typed accessors. Type-only, no behaviour change.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

### Task 3: Adopt types in the 4 designer editors (~41 sites)

**Files:**
- Modify: `frontend/src/components/admin/designer/PostSortConfigEditor.tsx` (~12)
- Modify: `frontend/src/components/admin/designer/QSortEditor.tsx` (~10)
- Modify: `frontend/src/components/admin/designer/ProcessStepEditor.tsx` (~10)
- Modify: `frontend/src/components/admin/designer/QuestionBuilder.tsx` (~9)

- [ ] **Step 1: Apply the Task-1 toolkit per file**

For each file, replace `any` per these rules (compiler is the oracle; run `npm run type-check` iteratively):
- Whole-config / `draft.presort_config as any` / `draft.postsort_config as any` reads → `presortFields(...)` / `postsortConfig(...)`.
- `process_steps` reads (incl. the `(t as any).process_steps` translation-array pattern in `ProcessStepEditor.tsx` ~lines 277–320) → `processSteps(t)` from `@/utils/studyConfig`. This also lets the existing `biome-ignore lint/complexity/noExcessiveCognitiveComplexity` comment at `ProcessStepEditor.tsx:289` stay (it is a complexity suppression, not `noExplicitAny`); do NOT remove or add complexity suppressions in this wave.
- Single field/option/question params (`field: any`, `opt: any`, `q: any`, `(s: any)`, `(ts: any)`, `(ms: any)`) → `PreSortField` / `PreSortFieldOption` / `ProcessStep`.
- **Honest exception — not config-typeable:** `const IconComponent = (LucideIcons as any)[step.icon]` (`ProcessStepEditor.tsx:61`) is a dynamic icon-registry lookup, not study config. Replace with a typed registry access: `(LucideIcons as unknown as Record<string, React.ComponentType<{ className?: string }>>)[step.icon]`. This removes the `noExplicitAny` (it becomes `unknown`-based) without inventing a fake config type. If the file already imports a typed icon map, prefer that.

- [ ] **Step 2: Typecheck + full suite**

Run: `cd frontend && npm run type-check && npx vitest run`
Expected: `tsc -b` exit 0; full suite green (same passed count as baseline).

- [ ] **Step 3: Lint + per-file suppression check**

Run: `cd frontend && npm run lint && for f in PostSortConfigEditor QSortEditor ProcessStepEditor QuestionBuilder; do echo -n "$f noExplicitAny: "; grep -c "biome-ignore lint/suspicious/noExplicitAny" "frontend/src/components/admin/designer/$f.tsx" || echo 0; done`
Expected: lint 0 errors; each file's `noExplicitAny` count `0` (or only a documented genuine-dynamic residue — state it in the commit if any remains, with why it is irreducible).

- [ ] **Step 4: Commit**

```bash
git add frontend/src/components/admin/designer/PostSortConfigEditor.tsx \
        frontend/src/components/admin/designer/QSortEditor.tsx \
        frontend/src/components/admin/designer/ProcessStepEditor.tsx \
        frontend/src/components/admin/designer/QuestionBuilder.tsx
git commit -m "refactor(types): adopt StudyConfig types in designer editors

Config reads -> accessors; element params -> schema types; icon-registry
lookup -> typed unknown. Type-only, no behaviour change.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

### Task 4: Adopt types in dashboard + hooks (~38 sites)

**Files:**
- Modify: `frontend/src/components/admin/dashboard/ParticipantDetailContent.tsx` (~10)
- Modify: `frontend/src/components/admin/dashboard/SurveyResponseTable.helpers.ts` (~8)
- Modify: `frontend/src/components/admin/dashboard/types.ts` (~6)
- Modify: `frontend/src/hooks/admin/useStudyDesignPage.ts` (~7)
- Modify: `frontend/src/components/admin/designer/LanguageManagerModal.helpers.ts` (~7)

- [ ] **Step 1: Apply the toolkit; answer-payloads → `unknown`**

- Config reads (`presort_config`/`postsort_config`/`process_steps`) → Task-1 accessors / schema types, same as Tasks 2–3.
- **Honest exception — participant answer payloads are genuine dynamic JSON, not config.** In `dashboard/types.ts` (`presort: Record<string, any>`, `postsort: … & Record<string, any>`, `questions_answers?: Record<string, any>`, `audio_recordings?: Record<string, any>`, `presort_config?: Record<string, any>`, `postsort_config?: … & Record<string, any>`), in `ParticipantDetailContent.tsx`, and in `SurveyResponseTable.helpers.ts`: replace `any` with `unknown` (i.e. `Record<string, unknown>`). This removes the `noExplicitAny` and is type-safer, mirroring the backend's documented JSON-boundary discipline. Do NOT force `StudyConfig` onto an answer blob to inflate the count. Where a specific known key is read off such a blob, narrow that one read with a local `as { … }`.
- `useStudyDesignPage.ts` / `LanguageManagerModal.helpers.ts`: config-shaped `any` → accessors/schema types; genuinely dynamic → `unknown`.

- [ ] **Step 2: Typecheck + full suite**

Run: `cd frontend && npm run type-check && npx vitest run`
Expected: `tsc -b` exit 0; full suite green (same passed count as baseline).

- [ ] **Step 3: Lint**

Run: `cd frontend && npm run lint`
Expected: 0 errors; no new `biome-ignore`.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/components/admin/dashboard/ParticipantDetailContent.tsx \
        frontend/src/components/admin/dashboard/SurveyResponseTable.helpers.ts \
        frontend/src/components/admin/dashboard/types.ts \
        frontend/src/hooks/admin/useStudyDesignPage.ts \
        frontend/src/components/admin/designer/LanguageManagerModal.helpers.ts
git commit -m "refactor(types): adopt StudyConfig types in dashboard + hooks

Config reads -> accessors; genuine answer payloads any -> unknown.
Type-only, no behaviour change.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

### Task 5: Final verification against the Definition of Done

**Files:** none (verification only; fix inline if a gate fails).

- [ ] **Step 1: noExplicitAny target**

Run: `grep -rc "biome-ignore lint/suspicious/noExplicitAny" frontend/src --include="*.ts" --include="*.tsx" | awk -F: '{s+=$2} END {print s}'`
Expected: **≤ 155** (baseline 245, ≥ 90 removed). If above 155, identify which cluster files still carry config-shaped `any` that should have used an accessor (do NOT pad by touching the deferred tail).

- [ ] **Step 2: Type + build + lint + full suite**

Run: `cd frontend && npm run type-check && npm run build && npm run lint && npx vitest run 2>&1 | tail -3`
Expected: `tsc -b` exit 0; `vite build` succeeds; lint 0 errors, no new `biome-ignore`; full suite green with the **same passed count as the Task-0 baseline** (type-only ⇒ identical runtime behaviour).

- [ ] **Step 3: Confirm scope discipline**

Run: `git diff main...HEAD --name-only`
Expected: only the spec/plan docs + the Task 1–4 files. NO long-tail files touched (the deferred ~6 files × 1–5). NO `frontend/src/schemas/study.ts` zod-schema-shape changes (`git diff main...HEAD -- frontend/src/schemas/study.ts` shows only appended `export type` lines).

- [ ] **Step 4: Final commit if inline fixes were made in Steps 1–2**

```bash
git add -A
git commit -m "chore(types): wave-2 DoD fixups

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

(Skip if Steps 1–2 were green with no edits.)

---

## Self-Review

**Spec coverage:**
- Additive type exports, no schema edit → Task 1 Step 3 (indexed-access for inline sub-schemas). ✓
- Typed zero-runtime accessors in `utils/studyConfig.ts`, generalizing `PresortLike` → Task 1 Step 4. ✓
- Top-10-cluster adoption → Tasks 2 (store), 3 (4 editors), 4 (dashboard+hooks). ✓
- Honest `any`→`unknown` for answer payloads / icon registry, not forced config types → Task 3 Step 1 (icon), Task 4 Step 1 (answer blobs). ✓
- Type-only, no `zod.parse` → `ConfigLike` accessors are pure assertions (Task 1 Step 4); behaviour proof = full suite green at same count (Tasks 2–5). ✓
- DoD (type-check, build, lint, suite, noExplicitAny ≤155, no new biome-ignore) → Task 5. ✓
- Long tail deferred, no schema-shape change → Task 5 Step 3 asserts it. ✓
- Real gate is `npm run type-check`, never `tsc --noEmit` → stated in header + every gate step. ✓
- New-accessor unit tests (≥3 cases incl. legacy/new/absent) → Task 1 Step 1. ✓

**Placeholder scan:** No TBD/TODO. Per-file adoption tasks intentionally give the `any`-site→type mapping rules + the compiler as oracle rather than transcribing ~95 micro-edits verbatim — re-transcription of mechanical type substitutions would be error-prone and the spec's behaviour-proof is the full suite, not per-line code. The only genuinely new code (type exports, accessors, their tests) is given in full.

**Type consistency:** `presortFields` / `postsortConfig` / `processSteps`, `ProcessStep` / `PostsortConfig` / `PreSortFieldOption`, `ConfigLike` — names identical across Task 1 definition and Tasks 2–4 usage and the Task 1 test file. Accessor return types match the spec's Section 2.

**Open note for the reviewer:** the ≥90 target assumes ~15–20 sites legitimately become `unknown` (answer payloads/icon registry). If post-Task-4 the count is between 155 and ~165, judge whether the residue is genuinely irreducible (legit `unknown`) before treating it as a miss — the spec explicitly forbids contorting answer blobs into `StudyConfig` to hit a number.
