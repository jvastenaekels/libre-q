# Wave 2 — StudyConfig typing adoption — design

**Date:** 2026-05-16
**Status:** Approved (design)
**Scope:** Code-quality program, Wave 2 of the audit-waves track.

## Background

The Wave-1 backlog review (cold-context) **dropped the original Wave 2 framing**
("triage all ~244 `noExplicitAny`"): 119/245 suppressions are irreducibly legit
(94 test fixtures + 25 library/wire boundary); triaging them mirrors a backend
discipline that does not transfer 1:1.

Re-pointed Wave 2: **adopt the existing typed `StudyConfig` model at the ~112
non-test `any` sites that bypass it.** Investigation refined this further:

- A canonical zod schema **already exists** — `frontend/src/schemas/study.ts`:
  `StudyConfigSchema` + `export type StudyConfig = z.infer<…>`, plus
  `PreSortField`, `Statement`, and sub-schemas `ProcessStepSchema`,
  `PreSortField` option union, the postsort object. It **already models the
  legacy↔new union** (`presort_config: z.union([ z.record(PreSortField),
  z.object({enabled, fields}) ])`). No type invention is required.
- The root cause of the ~112 `any`: the **generated wire types are opaque by
  backend design** (`StudyUpdatePresortConfig = { [k]: unknown }`,
  `StudyReadPresortConfig`, dump configs — CLAUDE.md documents these as
  load-bearing JSON blobs at the ORM boundary). Every structured read/write of
  a config therefore casts `as any`.
- `frontend/src/utils/studyConfig.ts` already establishes the bridging pattern:
  structural "*Like" types (`PresortLike`, `RoughSortLike`) that accept both
  the participant `StudyConfig` and the designer-draft `StudyUpdate`.

So Wave 2 is **not** type invention and **not** runtime validation. It is:
generalize the existing `utils/studyConfig.ts` bridge into a small set of typed
accessors, and route the ~95 top-cluster `any` sites through them / the existing
schema element types.

Decisions taken at brainstorm:
- Type ambition: **normalized type + one boundary** (not a bidirectional
  discriminated union maintained everywhere).
- Boundary enforcement: **type-only** (controlled assertion, no `zod.parse` at
  runtime). Preserves the program's cardinal "zero behaviour change" guarantee
  by construction — a type-only diff cannot alter runtime behaviour.
- Scope: **Approach A** — top-10 cluster only; long tail explicitly deferred.

This is Wave 2; each wave is its own spec → plan → impl cycle. Wave 3 candidate
(separate cycle): `useAudioRecorder` extraction from `AudioRecorder.tsx`.

## Goal

Remove ~90+ `biome-ignore lint/suspicious/noExplicitAny` suppressions from the
study-config code by adopting the existing `StudyConfig` schema types behind a
typed, zero-runtime accessor boundary — with no behaviour change.

## Architecture & boundary

The bridge lives in `frontend/src/utils/studyConfig.ts`, extending its existing
`PresortLike`/`isPresortEnabled` precedent. It exposes typed structural
accessors that take the opaque wire value (`StudyUpdate` draft / dump config)
and return schema-inferred element types via a controlled compile-time
assertion. One-directional, single-point per concern, **zero runtime** (no
`.parse`, no `.safeParse`). Call sites stop casting `as any` and call the
accessor.

`frontend/src/schemas/study.ts` gains **only additive type exports** (no schema
edits, no runtime change):

- `export type ProcessStep = z.infer<typeof ProcessStepSchema>;`
- `export type PostsortConfig` — `z.infer` of the existing inline postsort
  object schema (extract the inline object to a named `PostsortConfigSchema`
  const if needed for inference; the shape is unchanged).
- `export type PreSortFieldOption` — `z.infer` of the existing option-union
  sub-schema (extract to a named const if needed; shape unchanged).

`frontend/src/utils/studyConfig.ts` gains:

- `presortFields(config): Record<string, PreSortField>` — collapses the legacy
  `Record<PreSortField>` vs new `{ enabled, fields }` union into the field map
  (replaces the `as any` at `useStudyDesigner.ts:230-234` and equivalents).
- `postsortConfig(config): PostsortConfig | undefined`.
- `processSteps(draftOrConfig): ProcessStep[]`.
- option/label normalizer helpers typed with `PreSortFieldOption` (for the
  `normalizeOption(opt: any)` / `normalizeQuestion(q: any)` paths).

Accessors accept the structural "*Like" widening (per the existing precedent)
so both `StudyConfig` and `StudyUpdate` callers share them.

## Per-file adoption (top-10 cluster)

Replace `any` with the accessors / `PreSortField` / `ProcessStep` /
`PreSortFieldOption` / `PostsortConfig`:

| File | approx suppressions |
|---|---|
| `store/useStudyDesigner.ts` | 17 |
| `components/admin/designer/PostSortConfigEditor.tsx` | 12 |
| `components/admin/designer/QSortEditor.tsx` | 10 |
| `components/admin/designer/ProcessStepEditor.tsx` | 10 |
| `components/admin/dashboard/ParticipantDetailContent.tsx` | 10 |
| `components/admin/designer/QuestionBuilder.tsx` | 9 |
| `components/admin/dashboard/SurveyResponseTable.helpers.ts` | 8 |
| `hooks/admin/useStudyDesignPage.ts` | 7 |
| `components/admin/designer/LanguageManagerModal.helpers.ts` | 7 |
| `components/admin/dashboard/types.ts` | 6 |

**Honest caveat.** A subset (chiefly in `ParticipantDetailContent.tsx`,
`dashboard/types.ts`, `SurveyResponseTable.helpers.ts`) are participant **answer
payloads** — genuinely dynamic JSON, not study config. Those become `unknown` /
`Record<string, unknown>`, **not** a forced config type. That still removes the
`noExplicitAny` suppression and is type-safer, mirroring the backend's
documented JSON-boundary discipline. Estimated ~15–20 land as `unknown` rather
than a schema type. Do not contort a genuine answer blob into `StudyConfig` to
hit a number.

## Testing

Type-only ⇒ behaviour preservation is structural, not test-driven:

- `cd frontend && npm run type-check` (`tsc -b`, the real strict gate — *not*
  `tsc --noEmit`, which is a false-green on the references-only root tsconfig)
  → exit 0.
- The **full existing test suite** (`npx vitest run`) stays green — this is the
  behaviour-preservation proof; no new tests are written because no new
  behaviour is introduced.
- If a new accessor has non-trivial union-collapsing logic
  (`presortFields` handling legacy vs new), add a focused unit test for that
  accessor in `utils/studyConfig.test.ts` (≥3 cases: legacy map, new
  `{enabled,fields}`, absent/null). This is the only new test surface.

## Definition of done

- `cd frontend && npm run type-check` → exit 0.
- `cd frontend && npm run build` → succeeds.
- `cd frontend && npm run lint` → 0 errors, **no new `biome-ignore`**.
- `cd frontend && npx vitest run` → full suite green (~1419 passed baseline).
- Net global `noExplicitAny`: **245 → ≤ 155** (≥ ~90 removed; `any`→`unknown`
  conversions count). Measured by
  `grep -rc 'biome-ignore lint/suspicious/noExplicitAny' frontend/src
  --include='*.ts' --include='*.tsx' | awk -F: '{s+=$2} END {print s}'`.
- No behaviour, style, or i18n change (type-only diff).
- The deferred long tail (~6 files × 1–5 suppressions) listed as a documented
  "Wave 2-tail" follow-up — explicitly NOT in this PR.

## Non-goals

- Inventing a new type model (`StudyConfigSchema` already exists and is
  adequate).
- Any runtime validation / `zod.parse` / `safeParse` at the boundary.
- Bidirectional legacy/new discriminated-union handling at every site.
- Touching the long tail (~6 files × 1–5) — deferred follow-up.
- Schema behaviour change — only additive `z.infer` type exports; no zod schema
  field edits.
- Forcing a `StudyConfig` type onto genuine dynamic answer payloads.
- Any change to `AudioRecorder`/`QSortEditor` structure (Wave 3 candidates).
