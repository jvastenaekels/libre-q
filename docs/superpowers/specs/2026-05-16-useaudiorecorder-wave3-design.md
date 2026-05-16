# Wave 3 — useAudioRecorder extraction — design

**Date:** 2026-05-16
**Status:** Approved (design)
**Scope:** Code-quality program, Wave 3 of the audit-waves track.

## Background

The Wave-2 backlog review pre-scoped Wave 3 (with `QSortEditor` state-hook as
the alternative). User chose `useAudioRecorder`.

`frontend/src/components/audio/AudioRecorder.tsx` is 946 LOC: first JSX `return`
at line 743, so ~735 LOC of imperative media logic before ~200 LOC of JSX. It
has 8 `useState`, 17 `useRef`, 6 effects/callbacks, and the full
`getUserMedia` → `MediaRecorder` → `AudioContext`/`AnalyserNode` →
`requestAnimationFrame` → `new Audio()` playback lifecycle. No extracted hook.
On the participant critical path (consumed by `Step1_Feedback.tsx` and
`Step2_Questionnaire.tsx`).

A robust behaviour-preservation net **already exists**:
`AudioRecorder.test.tsx` is 948 LOC, mocks `MediaRecorder`/`getUserMedia`/
`AudioContext`, captures the recorder instance, and drives the real lifecycle
(permission, record transition, timer, auto-stop at max duration,
`onRecordingComplete`, codec selection + MP4 fallback, `cleanup()` in
`afterEach`). No characterization-tests-first phase is needed.

Decisions taken at brainstorm:
- **Boundary:** resource-refs move into the hook (documented exception).
- **Behaviour proof:** the existing 948-LOC test stays green unchanged.

This is Wave 3; its own spec → plan → impl cycle. Branch off `main`
(`chore/code-quality-wave3-useaudiorecorder`), independent of PRs #176/#177/#178.

## Goal

Reduce `AudioRecorder.tsx` to a declarative JSX shell by extracting the entire
media-recording/playback/waveform lifecycle into
`frontend/src/hooks/participant/useAudioRecorder.ts`, with **no behaviour
change** — identical media-resource cleanup on every path.

## Architecture & boundary

Phase-5-G hook-extraction pattern with one **documented exception**
(analogous to Wave 1's `.columns` module). CLAUDE.md's literal rule is
"the component keeps `useRef` for DOM elements". Here that rule is refined:
**only JSX-bound DOM refs stay in the component; imperative-resource refs move
into the hook, because they ARE the lifecycle the hook owns.** Splitting
lifecycle ownership across component/hook (passing 17 refs as arguments) would
fracture cleanup correctness — explicitly rejected.

**Moves into `useAudioRecorder.ts`:**
- All 8 state vars: `state`, `duration`, `audioUrl`, `audioLevels`,
  `urlExpiresAt`, `playbackSpeed`, `playbackPosition`, `uploadStatus`.
- The ~16 resource/logic refs: `stateRef`, `audioUrlRef`, `mediaRecorderRef`,
  `audioChunksRef`, `timerRef`, `streamRef`, `audioContextRef`, `analyserRef`,
  `animationFrameRef`, `permissionCheckIntervalRef`, `startTimeRef`,
  `pendingBlobRef`, `audioPlayerRef` (`new Audio()` — imperative, not JSX).
- All 6 effects/callbacks and the full record / pause / resume / stop /
  playback / upload / waveform lifecycle, **including every cleanup path**:
  stream/track stop, `AudioContext.close()`, `cancelAnimationFrame`,
  `clearInterval` (timer + permission-check), `URL.revokeObjectURL`.

- `containerRef` (`useRef<HTMLDivElement>(null)`) **also moves into the
  hook** and is **returned** by it. Rationale (corrected at planning time):
  the keyboard-shortcut `useEffect` — part of the lifecycle — reads
  `containerRef.current?.contains(event.target)` to scope the Space-key
  start/stop to this recorder's container. The ref is therefore lifecycle
  state the hook owns; the component merely binds the hook-returned ref onto
  its root `<div>`. This is the idiomatic "hook needs a DOM node" pattern and
  keeps lifecycle ownership whole (the brainstorm's principle). The waveform
  is state-driven (`audioLevels` via rAF) — no canvas ref.

**Stays in `AudioRecorder.tsx`:** only the ~200 LOC of JSX. It binds the
hook-returned `containerRef` (`ref={containerRef}`) — it does **not** declare
any `useRef` itself.

## Hook API

`useAudioRecorder(props)` accepts the behaviour-driving subset of the existing
`AudioRecorderProps` (`onRecordingComplete`, `maxDurationSeconds`, existing
recording url/expiry, `disabled`, the upload handler — exact field set fixed
during planning against the real interface). Returns a role-grouped object
with an explicit `any`-free interface (precedent: Wave-1
`UseInteractiveDataViewResult`):

```ts
{
  status:    { state, uploadStatus, isAtMaxDuration },
  recording: { start, stop, pause, resume, duration },
  playback:  { audioUrl, urlExpiresAt, playbackSpeed, setPlaybackSpeed,
               playbackPosition, play, pause, seek },
  waveform:  { audioLevels },
  dom:       { containerRef },   // hook-created RefObject<HTMLDivElement>;
                                 // the component binds it onto its root <div>
}
```

All controls are stable `useCallback`s. The ~16 resource refs are
hook-internal, never exposed. `containerRef` **is** in the return (`dom`
group) because the hook's keyboard-shortcut effect depends on it; the
component binds it but declares no ref of its own.

## Testing

Behaviour preservation is structural, not new-test-driven:

- The existing **`AudioRecorder.test.tsx` (948 LOC) stays green, unchanged** —
  it drives the full mocked record/stop/auto-stop/codec/cleanup lifecycle
  through the component, exercising the hook end-to-end. This is the cardinal
  cleanup-correctness proof.
- Per Phase-5-G convention, add **≥5 pure-logic hook unit tests** in
  `frontend/src/hooks/participant/useAudioRecorder.test.ts` via `renderHook`:
  1. codec selection (WebM preferred → MP4 fallback when unsupported)
  2. duration → `mm:ss` formatting
  3. audio-level computation from analyser data
  4. state-machine transitions (idle → recording → stopped)
  5. max-duration auto-stop trigger
- `tsc -b` + `npm run build` green is the type-level proof; the full vitest
  suite stays green at its pre-existing pass count + the ≥5 new hook tests.

## Definition of done

- `cd frontend && npm run type-check` (`tsc -b`, the real gate — never
  `tsc --noEmit`) → exit 0.
- `cd frontend && npm run build` → succeeds.
- `cd frontend && npm run lint` → 0 errors; **no new `biome-ignore`**; no
  `any`. The pre-existing `noExcessiveCognitiveComplexity` suppression may
  remain on the **component shell** only — never inside the hook.
- `cd frontend && npx vitest run` → full suite green;
  **`AudioRecorder.test.tsx` unchanged and green** + ≥5 new hook tests.
- `AudioRecorder.tsx` reduced to a pure JSX shell that binds the
  hook-returned `containerRef` and declares no `useRef` of its own (~735
  logic LOC moved out; expect a ≥600-line decrease).
- Consumers `Step1_Feedback.tsx` / `Step2_Questionnaire.tsx` untouched and
  still type-checking; `AudioRecorderProps` interface unchanged.
- No behaviour change: identical media cleanup on every path (record, stop,
  unmount, auto-stop-at-max).

## Non-goals

- Changing recording/playback/upload behaviour, UX, or the media pipeline.
- Modifying `AudioRecorder.test.tsx` (it is the behaviour-preservation
  oracle — if it needs changes to pass, behaviour changed → stop).
- Changing `AudioRecorderProps` or touching the consumers.
- Moving JSX sub-components to sibling files (no cycle forces it here).
- Removing/relocating the component's existing complexity suppression.
- Refactoring the media logic itself (verbatim relocation; only the
  ref/closure wiring needed to live in a hook may change, behaviour-identically).
- Touching `QSortEditor` (the deferred Wave-3 alternative) or any other wave.
