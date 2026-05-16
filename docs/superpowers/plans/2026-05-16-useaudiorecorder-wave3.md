# Wave 3 — useAudioRecorder Extraction Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reduce `frontend/src/components/audio/AudioRecorder.tsx` (946 LOC) to a declarative JSX shell by relocating the entire media-recording/playback/waveform lifecycle verbatim into `frontend/src/hooks/participant/useAudioRecorder.ts`, with identical media-resource cleanup on every path (no behaviour change).

**Architecture:** Phase-5-G hook extraction with a documented boundary exception — imperative-resource refs move into the hook (they ARE the lifecycle it owns); only the JSX-bound `containerRef` stays. The module-level cleanup helpers (`clearIntervalRef` etc.) and the shared `RecorderState`/`AudioRecorderProps` types co-locate in the hook file to avoid a hook→component import cycle (Wave-1 `.columns` precedent); the component imports them back from the hook. Behaviour preservation is structural: the existing 948-LOC `AudioRecorder.test.tsx` stays green unchanged (the cardinal cleanup-correctness oracle) + `tsc -b` + `npm run build`.

**Tech Stack:** React 19, TypeScript (strict via `tsc -b`/Biome), MediaRecorder/getUserMedia/AudioContext Web APIs, Vitest + @testing-library/react `renderHook`.

**Branch:** `chore/code-quality-wave3-useaudiorecorder` (already created off `main`; spec committed there).

**The real typecheck gate is `cd frontend && npm run type-check` (= `tsc -b`).** `npx tsc --noEmit` is a FALSE-GREEN (root tsconfig references-only) — never use it as the gate.

---

### Task 0: Baseline

**Files:** none modified.

- [ ] **Step 1: Record the green baseline + LOC**

Run: `cd frontend && npm run type-check && npx vitest run 2>&1 | grep -E "Test Files|Tests " | tail -2 && wc -l < src/components/audio/AudioRecorder.tsx`
Expected: `tsc -b` exit 0; full suite green — **record the exact `Tests N passed | M skipped` line** (this is the behaviour-preservation target for Tasks 2–4); `AudioRecorder.tsx` = 946.

- [ ] **Step 2: Confirm the AudioRecorder test is green in isolation (the oracle)**

Run: `cd frontend && npx vitest run src/components/audio/AudioRecorder.test.tsx 2>&1 | tail -3`
Expected: all pass. Note the count. This file MUST remain unchanged and green through Tasks 1–4 — it is the cardinal cleanup-correctness proof. If at any later step it requires modification to pass, behaviour changed → STOP and escalate.

- [ ] **Step 3: Confirm the consumers**

Run: `grep -rln "components/audio/AudioRecorder" frontend/src --include="*.tsx" --include="*.ts" | grep -v "AudioRecorder.tsx" | grep -v "AudioRecorder.test"`
Expected: exactly `frontend/src/components/postsort/Step1_Feedback.tsx` and `frontend/src/components/postsort/Step2_Questionnaire.tsx`. If anything else, STOP and report — blast-radius assumption wrong.

No commit (read-only).

---

### Task 1: Create useAudioRecorder + first failing test

**Files:**
- Create: `frontend/src/hooks/participant/useAudioRecorder.ts`
- Create: `frontend/src/hooks/participant/useAudioRecorder.test.ts`
- Read for the verbatim move: `frontend/src/components/audio/AudioRecorder.tsx` (module helpers + types lines ~1–75; state/ref block ~88–116; lifecycle effects/callbacks ~117 through the line immediately before the JSX `return (` at 743)

- [ ] **Step 1: Write the first failing hook test**

Create `frontend/src/hooks/participant/useAudioRecorder.test.ts`:

```ts
/*
 * Qualis - Open-source platform for conducting Q-methodology research
 * Copyright (C) 2025 Qualis Team
 * Licensed under the GNU Affero General Public License v3.0 or later.
 */

/**
 * Unit tests for useAudioRecorder — pure-logic paths only. The full
 * mocked record/stop/auto-stop/codec/cleanup lifecycle is covered
 * end-to-end through the component by the unchanged
 * AudioRecorder.test.tsx (the behaviour-preservation oracle).
 */

import { renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useAudioRecorder } from './useAudioRecorder';

vi.mock('react-i18next', () => ({
    useTranslation: () => ({ t: (_k: string, d?: string) => d ?? _k }),
}));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

function makeProps(over: Record<string, unknown> = {}) {
    return {
        questionKey: 'q1',
        maxDurationSeconds: 180,
        onRecordingComplete: vi.fn().mockResolvedValue(undefined),
        onRecordingDeleted: vi.fn().mockResolvedValue(undefined),
        ...over,
    } as Parameters<typeof useAudioRecorder>[0];
}

beforeEach(() => {
    vi.clearAllMocks();
});

describe('useAudioRecorder — initial state', () => {
    it('starts idle with zero duration and no audio url', () => {
        const { result } = renderHook(() => useAudioRecorder(makeProps()));
        expect(result.current.status.state).toBe('idle');
        expect(result.current.recording.duration).toBe(0);
        expect(result.current.playback.audioUrl).toBeNull();
        expect(result.current.waveform.audioLevels).toHaveLength(5);
    });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd frontend && npx vitest run src/hooks/participant/useAudioRecorder.test.ts`
Expected: FAIL — `Failed to resolve import "./useAudioRecorder"` (hook does not exist yet).

- [ ] **Step 3: Create the hook by relocating the lifecycle verbatim**

Create `frontend/src/hooks/participant/useAudioRecorder.ts` with this exact scaffold. The regions marked `// ⟶ MOVE` are **verbatim relocations** from `AudioRecorder.tsx` (copy unchanged — no logic edits; only the wiring noted below):

```ts
/*
 * Qualis - Open-source platform for conducting Q-methodology research
 * Copyright (C) 2025 Qualis Team
 * Licensed under the GNU Affero General Public License v3.0 or later.
 */

/**
 * useAudioRecorder hook
 *
 * Owns the entire media-recording/playback/waveform lifecycle for
 * AudioRecorder: getUserMedia → MediaRecorder → AudioContext/Analyser →
 * requestAnimationFrame → new Audio() playback, and every cleanup path.
 * AudioRecorder renders JSX from this hook's return value.
 *
 * Boundary exception (Phase-5-G refined, documented): imperative-resource
 * refs live here because they ARE the lifecycle; only the JSX-bound
 * containerRef stays in the component.
 */

import { useState, useRef, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
// ⟶ MOVE: carry over every other import AudioRecorder.tsx uses for the
//   lifecycle (NOT the JSX-only ones — those stay in the component).
//   Let `tsc -b` drive which: add an import here the moment a moved line
//   references a missing symbol.

// ⟶ MOVE verbatim: `type RecorderState = …` (AudioRecorder.tsx:28) — export it.
export type RecorderState = 'idle' | 'recording' | 'stopped' | 'playing' | 'uploading';

// ⟶ MOVE verbatim: the AudioRecorderProps interface (AudioRecorder.tsx:8-27)
//   — rename nothing; export it (the component will import it back).
export interface AudioRecorderProps {
    questionKey: string;
    maxDurationSeconds?: number;
    onRecordingComplete: (blob: Blob, duration: number) => Promise<void>;
    onRecordingDeleted: () => Promise<void>;
    existingRecording?: {
        id: number;
        // ⟶ MOVE verbatim the remaining fields exactly as declared at
        //   AudioRecorder.tsx:13-20 (do not paraphrase).
    };
    disabled?: boolean;
    sessionToken?: string;
    onError?: (
        type: 'mic_denied' | 'mic_revoked' | 'recorder_error' | 'empty_blob' | 'unsupported',
    ) => void;
}

// ⟶ MOVE verbatim: the module-level cleanup helpers and any module-level
//   type aliases they use (AudioRecorder.tsx ~lines 30-75:
//   `MutableRef` type, `clearIntervalRef`, `cancelAnimationFrameRef`,
//   `closeAudioContextRef`/stream-stop/audio-src-revoke helpers).
//   These are pure utilities — paste them unchanged, keep them
//   module-private (NOT exported) unless a test needs one.

export interface UseAudioRecorderResult {
    status: {
        state: RecorderState;
        uploadStatus: 'idle' | 'uploading' | 'success' | 'failed';
        isAtMaxDuration: boolean;
    };
    recording: {
        duration: number;
        start: () => void | Promise<void>;
        stop: () => void;
        pause: () => void;
        resume: () => void;
    };
    playback: {
        audioUrl: string | null;
        urlExpiresAt: number | null;
        playbackSpeed: number;
        setPlaybackSpeed: (s: number) => void;
        playbackPosition: number;
        play: () => void | Promise<void>;
        pause: () => void;
        seek: (pos: number) => void;
    };
    waveform: { audioLevels: number[] };
}

export function useAudioRecorder(props: AudioRecorderProps): UseAudioRecorderResult {
    // ⟶ MOVE verbatim: the entire component body from the state/ref block
    //   (AudioRecorder.tsx:88) through the LAST line before `return (` at
    //   743 — all useState, all resource useRef, durationRef/startTimeRef,
    //   every useEffect/useCallback, the start/stop/pause/resume/play/seek
    //   handlers, waveform rAF loop, upload, and EVERY cleanup path.
    //
    //   Wiring changes ALLOWED (behaviour-identical only):
    //   - destructure `props` instead of the component's prop params
    //     (the component used `questionKey: _questionKey, …` — keep the
    //     same identifiers the moved body already references; if the body
    //     references `_questionKey`, destructure `const { questionKey:
    //     _questionKey, maxDurationSeconds, onRecordingComplete, … } =
    //     props;`).
    //   - DO NOT move `containerRef` (AudioRecorder.tsx:115,
    //     `useRef<HTMLDivElement>(null)`) — it stays in the component.
    //     Any moved line referencing `containerRef` must instead be
    //     reached via the return (if the lifecycle needs the DOM node,
    //     expose nothing new — verify no moved logic actually uses
    //     containerRef; the waveform is state-driven via audioLevels, so
    //     it should not. If a moved line DOES use containerRef, STOP and
    //     report — the boundary needs re-examination).
    //
    //   NO other logic edits. The moved code's behaviour must be identical.

    return {
        status: { state, uploadStatus, isAtMaxDuration },
        recording: { duration, start: startRecording, stop: stopRecording,
            pause: pauseRecording, resume: resumeRecording },
        playback: { audioUrl, urlExpiresAt, playbackSpeed, setPlaybackSpeed,
            playbackPosition, play: playRecording, pause: pausePlayback,
            seek: seekPlayback },
        waveform: { audioLevels },
    };
}
```

Note: the exact local handler identifiers in the `return` (`startRecording`,
`stopRecording`, `pauseRecording`, `resumeRecording`, `playRecording`,
`pausePlayback`, `seekPlayback`, `isAtMaxDuration`) MUST be renamed in this
return block to match whatever the moved body actually names them. Read the
moved handlers and map them 1:1 — do not invent names. If a control in the
spec's API (e.g. `pause`/`resume`/`seek`) has no corresponding handler in the
moved body, expose only what exists and STOP to report the discrepancy (do
not fabricate a handler).

- [ ] **Step 4: Run the first hook test to verify it passes**

Run: `cd frontend && npx vitest run src/hooks/participant/useAudioRecorder.test.ts`
Expected: PASS (1 test). If the moved body needs Web-API globals the test env lacks for *initial render only*, that signals the hook does setup work at render time it shouldn't — STOP and report (the original did not).

- [ ] **Step 5: Typecheck the hook in isolation**

Run: `cd frontend && npm run type-check`
Expected: exit 0. (`AudioRecorder.tsx` still has its own copy of the logic — fine; removed in Task 2. Duplicate module-level helpers in two files are file-local, no conflict.)

- [ ] **Step 6: Commit**

```bash
git add frontend/src/hooks/participant/useAudioRecorder.ts frontend/src/hooks/participant/useAudioRecorder.test.ts
git commit -m "feat(audio): extract useAudioRecorder hook (lifecycle verbatim)

Phase-5-G wave 3 foundation. State + resource refs + full media
lifecycle relocated verbatim into the hook; RecorderState/
AudioRecorderProps/cleanup helpers co-located to avoid a
hook->component cycle. AudioRecorder.tsx still holds its own copy
until Task 2.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

### Task 2: Rewire AudioRecorder.tsx to consume the hook

**Files:**
- Modify: `frontend/src/components/audio/AudioRecorder.tsx`

- [ ] **Step 1: Replace the component body with the hook call**

In `AudioRecorder.tsx`:
- Replace the local `type RecorderState` and `interface AudioRecorderProps`
  declarations with: `import { useAudioRecorder, type RecorderState, type AudioRecorderProps } from '@/hooks/participant/useAudioRecorder';`
- Replace the entire span from the state/ref block (line 88) through the
  last line before `return (` (743) with: keep ONLY
  `const containerRef = useRef<HTMLDivElement>(null);` and
  ```ts
  const {
      status: { state, uploadStatus, isAtMaxDuration },
      recording: { duration, start: startRecording, stop: stopRecording,
          pause: pauseRecording, resume: resumeRecording },
      playback: { audioUrl, urlExpiresAt, playbackSpeed, setPlaybackSpeed,
          playbackPosition, play: playRecording, pause: pausePlayback,
          seek: seekPlayback },
      waveform: { audioLevels },
  } = useAudioRecorder(props);
  ```
  where `props` is the component's destructured-then-reassembled props, OR
  change the component signature to `(props: AudioRecorderProps)` and pass
  `props` straight through, then read fields from the destructured hook
  result. The JSX below `return (` must keep referencing the SAME
  identifiers it already uses (`state`, `duration`, `audioUrl`,
  `audioLevels`, `playbackSpeed`, etc.) — if the moved handlers had
  different local names than the destructured aliases above, adjust the
  destructure aliases to match the JSX (do NOT edit the JSX).
- Delete the now-orphaned module-level cleanup helpers and `MutableRef`
  type from `AudioRecorder.tsx` (they live in the hook now). If the JSX
  references `RecorderState`, it's imported from the hook (above).

- [ ] **Step 2: Fix imports**

Remove imports now unused by the trimmed component (the media/Web-API
imports, lifecycle-only utilities). Keep imports the JSX shell still needs.
Let `tsc -b` and Biome drive this — do not guess; do not leave unused
imports.

- [ ] **Step 3: Typecheck**

Run: `cd frontend && npm run type-check`
Expected: exit 0. Fix unused/missing imports until clean. No `any` introduced.

- [ ] **Step 4: Lint**

Run: `cd frontend && npm run lint`
Expected: 0 errors. The pre-existing `noExcessiveCognitiveComplexity`
suppression on the component shell may remain; **no new `biome-ignore`**, and
none added inside the hook.

- [ ] **Step 5: The cardinal gate — AudioRecorder.test.tsx unchanged + green**

Run: `cd frontend && git diff --exit-code src/components/audio/AudioRecorder.test.tsx && npx vitest run src/components/audio/AudioRecorder.test.tsx 2>&1 | tail -3`
Expected: `git diff --exit-code` exits 0 (test file UNMODIFIED) AND all its tests pass with the same count as Task 0 Step 2. If the test file had to change to pass, behaviour changed → STOP and escalate (do not "fix" the test).

- [ ] **Step 6: Full suite + consumers**

Run: `cd frontend && npx vitest run 2>&1 | grep -E "Tests " | tail -1`
Expected: full suite green at the **same passed/skipped count as Task 0 Step 1** plus the 1 new hook test from Task 1 (i.e. baseline + 1). Consumers `Step1_Feedback.tsx` / `Step2_Questionnaire.tsx` are unmodified; `tsc -b` (Step 3) already proved their `<AudioRecorder …>` call sites still type-check against the unchanged `AudioRecorderProps`.

- [ ] **Step 7: Commit**

```bash
git add frontend/src/components/audio/AudioRecorder.tsx
git commit -m "refactor(audio): AudioRecorder consumes useAudioRecorder

Component reduced to JSX shell + containerRef. AudioRecorder.test.tsx
unchanged and green (cleanup-correctness oracle). Props interface
unchanged; consumers untouched. No behaviour change.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

### Task 3: Add the pure-logic hook tests

**Files:**
- Modify: `frontend/src/hooks/participant/useAudioRecorder.test.ts`

- [ ] **Step 1: Add ≥4 more pure-logic tests (≥5 total with Task 1's)**

Append `describe` blocks covering, via `renderHook` + the Web-API mocks
the existing `AudioRecorder.test.tsx` uses as a reference (mock
`MediaRecorder`/`navigator.mediaDevices.getUserMedia`/`AudioContext`
in this test the same way that file does — read it for the exact mock
shapes; reuse them):

1. **codec selection** — with `MediaRecorder.isTypeSupported` returning
   true for `audio/webm;codecs=opus`, starting a recording uses WebM;
   when it returns false, falls back to MP4. Assert on the captured
   recorder's `mimeType` (mirror `AudioRecorder.test.tsx`'s capture
   technique).
2. **duration → mm:ss formatting** — drive the hook to a known `duration`
   and assert the formatted string the hook exposes (if formatting is
   internal to JSX only and not on the return, assert via the `duration`
   number and cover the formatter as a standalone pure function if the
   moved code has one; do not invent a return field).
3. **state-machine transition** — idle → (start) → recording →
   (stop, fire mocked `onstop`) → stopped, asserting `result.current.
   status.state` at each step inside `act`.
4. **max-duration auto-stop** — `maxDurationSeconds: 1`, fake timers,
   advance past 1s, assert the recorder `stop` was called and state left
   `recording` (mirror `AudioRecorder.test.tsx`'s "auto-stops at max
   duration" test setup).

Write real assertions against hook behaviour (not mock tautologies);
reuse `makeProps`. If a planned test can only be expressed by asserting a
mock was told what to return, drop it and add a different genuine
pure-logic path instead — never weaken to a tautology.

- [ ] **Step 2: Run the hook test file**

Run: `cd frontend && npx vitest run src/hooks/participant/useAudioRecorder.test.ts`
Expected: ≥5 tests pass.

- [ ] **Step 3: Lint/format the test file**

Run: `cd frontend && npx @biomejs/biome check --write src/hooks/participant/useAudioRecorder.test.ts && npx @biomejs/biome check src/hooks/participant/useAudioRecorder.test.ts`
Expected: first normalizes formatting; second reports 0 errors/0 warnings (no `noExplicitAny`, no unused import). Re-run Step 2's vitest to confirm formatting didn't break a test.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/hooks/participant/useAudioRecorder.test.ts
git commit -m "test(audio): cover useAudioRecorder pure-logic paths (>=5)

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

### Task 4: Final verification against the Definition of Done

**Files:** none (verification only; fix inline if a gate fails).

- [ ] **Step 1: Type + build + lint**

Run: `cd frontend && npm run type-check && npm run build && npm run lint 2>&1 | tail -1`
Expected: `tsc -b` exit 0; `vite build` succeeds (no TS errors); lint 0 errors, no new `biome-ignore`.

- [ ] **Step 2: Cardinal oracle still unmodified + green; full suite**

Run: `cd frontend && git diff --exit-code main -- src/components/audio/AudioRecorder.test.tsx && npx vitest run 2>&1 | grep -E "Test Files|Tests " | tail -2`
Expected: `AudioRecorder.test.tsx` byte-identical to `main` (exit 0) AND full suite green at **Task-0 baseline count + the new hook tests** (no regression; the existing AudioRecorder lifecycle tests still pass through the new hook).

- [ ] **Step 3: Shell shrank; scope discipline**

Run: `wc -l < frontend/src/components/audio/AudioRecorder.tsx && git diff main...HEAD --name-only`
Expected: `AudioRecorder.tsx` decreased by ≥600 lines from 946 (now a JSX shell + `containerRef`). Changed files = the spec/plan docs + `useAudioRecorder.ts` + `useAudioRecorder.test.ts` + `AudioRecorder.tsx` ONLY. `Step1_Feedback.tsx`/`Step2_Questionnaire.tsx` NOT in the diff. No other wave's files.

- [ ] **Step 4: No `any`, no new suppressions**

Run: `cd frontend && grep -nE ': any|as any|<any>' src/hooks/participant/useAudioRecorder.ts src/components/audio/AudioRecorder.tsx || echo "no any"` and `git diff main...HEAD | grep '^+' | grep -c "biome-ignore" || echo 0`
Expected: "no any" (or only matches inside strings/comments); added `biome-ignore` count 0 (the pre-existing component-shell complexity suppression is not in the added lines because it pre-exists; if the move relocated it, it must be on the component shell, never in the hook — verify).

- [ ] **Step 5: Final commit if inline fixes were made**

```bash
git add -A
git commit -m "chore(audio): wave-3 DoD fixups

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

(Skip if Steps 1–4 were green with no edits.)

---

## Self-Review

**Spec coverage:**
- Resource-refs→hook documented exception; only `containerRef` stays → Task 1 Step 3 (explicit MOVE/keep boundary). ✓
- Helpers + `RecorderState`/`AudioRecorderProps` co-located in hook to avoid cycle → Task 1 Step 3, imported back in Task 2 Step 1. ✓
- Verbatim relocation, behaviour-identical wiring only → Task 1 Step 3 constraints + "NO other logic edits". ✓
- Hook API role-grouped, `any`-free, controls stable → `UseAudioRecorderResult` interface (Task 1 Step 3). ✓
- Cardinal: `AudioRecorder.test.tsx` unchanged + green is the proof → Task 0 Step 2, Task 2 Step 5 (`git diff --exit-code`), Task 4 Step 2. ✓
- ≥5 pure-logic hook tests → Task 1 (1) + Task 3 (≥4). ✓
- DoD (type-check, build, lint, suite, ≥600-line drop, consumers untouched, no behaviour change, no new biome-ignore/any) → Task 4. ✓
- Real gate `npm run type-check`, never `tsc --noEmit` → header + every gate step. ✓

**Placeholder scan:** No TBD/TODO. The `// ⟶ MOVE` markers are explicit verbatim-relocation directives with exact line anchors + the precise allowed-wiring list — not placeholders. Re-transcribing ~650 lines of imperative media code would risk transcription errors and violate the no-behaviour-change guarantee (same justified approach the Wave-1 reviewers accepted). Genuinely new code (hook scaffold, return interface, first test) is shown in full. The `existingRecording` sub-fields are anchored to `AudioRecorder.tsx:13-20` for verbatim copy because reproducing them here without the source risks drift — the engineer copies the real lines.

**Type consistency:** `UseAudioRecorderResult` field names in Task 1 match the Task 2 destructure exactly (`status`/`recording`/`playback`/`waveform`). The handler-name caveat is explicit in Task 1 Step 3 (map 1:1 to the real moved identifiers; do not invent) and re-stated in Task 2 Step 1 (adjust destructure aliases to the JSX, never edit JSX). `RecorderState`/`AudioRecorderProps` exported from the hook, imported by the component.

**Open note for the reviewer:** the one judgement risk is the verbatim move of ~650 LOC of imperative media + cleanup. The plan's defence is structural: `AudioRecorder.test.tsx` is the 948-LOC behaviour oracle and Task 2 Step 5 enforces it is byte-unchanged via `git diff --exit-code`. If a moved line references `containerRef` (it should not — waveform is state-driven), Task 1 Step 3 mandates STOP rather than improvise the boundary. Spec-reviewer should independently confirm zero moved-line references to `containerRef` and that no cleanup path was dropped/duplicated.
