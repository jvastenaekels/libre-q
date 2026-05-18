# S3-optional mode — design

**Date:** 2026-05-18
**Branch:** `feat/s3-optional-mode`
**Status:** approved (brainstorming), pending implementation plan

## Goal

Qualis must be **non-blocking when object storage (S3 / Cellar) is not
configured**, and the resulting capability loss must be **clear to the
operator**. This is the storage analogue of the already-shipped
`smtp-optional-mode` work (see
`docs/superpowers/specs/2026-05-17-smtp-optional-mode-design.md`).

### Defect today

Audio is a per-study opt-in feature (`postsort_config.audio.enabled`, default
`false`). When S3 is unconfigured the singleton is built with `skip_init=True`
(`storage_service.py:329-333`) so `s3_client` / `bucket_name` are never set.
The audio router (`audio.py:140-175`) gates on study state, submission, and
study-level `audio.enabled` — **but never on whether S3 is configured**.
Consequently:

- A study with no audio (the default) → `storage_service` is never touched →
  everything works. **Non-blocking.** ✅
- A study with audio enabled (or a `text_audio` question) → all router guards
  pass → `storage_service.upload_audio(...)` is called on the unconfigured
  instance → `AttributeError` → **HTTP 500**. **Blocking, and a crash, not a
  clean error.** ❌
- No capability flag (no `is_s3_configured`, `/api/config` says nothing about
  storage); the participant sees the recorder, records, then the upload fails
  with a generic "Upload failed. Please try again." loop.
- No startup signal; nothing stops an operator enabling audio without S3.

**Acceptance bar (chosen):** an audio-enabled study without S3 must never
crash; the participant degrades to text-only **silently** (user choice), and
the operator is **clearly informed** that audio will not be collected (startup
log + study-design note + doc). No operator-side hard block (user choice).

## Scope

Audio is **postsort-only**: the feedback step (`Step1_Feedback.tsx`) and
`text_audio` questions (`Step2_Questionnaire.tsx`). There is no presort audio.
The per-study `audio.enabled` toggle is unchanged; storage availability gates
it at runtime.

### Out of scope (YAGNI)

- Migrating / re-collecting audio for studies already run without S3.
- A local-disk storage fallback (object storage is the only backend).
- Operator-side activation block or warning in `validate_for_activation`
  (explicit user choice: silent participant degradation, no operator block).
- Any change to the non-audio storage callers' informational behaviour.

## Design

Mirror the SMTP-optional pattern: one capability flag, derived from existing
settings, exposed via the existing `/api/config`, read once into the platform
store, driving every adaptive decision; a backend safety-net guard; operator
signposting.

### 1. Capability signal (backend → frontend)

- New `Settings.is_s3_configured` property, exactly analogous to
  `is_smtp_configured`: `True` iff all of `S3_ENDPOINT_URL`,
  `S3_BUCKET_NAME`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY` are set. No new
  config setting — only exposure of existing settings.
- Extend the **existing** `PublicConfig` schema (`app/schemas/config.py`) and
  `GET /api/config` (`app/routers/config.py`) with
  `audio_storage: Literal["available", "unavailable"]`, derived from
  `settings.is_s3_configured`. **No new endpoint.**
- Extend `usePlatformConfigStore` with `audioStorage: AudioStorage | null`,
  `setAudioStorage`, and `isAudioStorageAvailable()`. `null` is the safe
  default = treat as available (so a config-fetch failure does not silently
  suppress audio on a correctly-configured instance — symmetric with the SMTP
  store's safe default). The existing `usePlatformConfigBootstrap` already
  fetches `/api/config`; it just maps the extra field.

### 2. Backend safety-net guard

- In `app/routers/audio.py`, before **any** `storage_service` access (the
  upload path and the existing delete / presigned-url / get-url paths), if
  `not settings.is_s3_configured` → `raise HTTPException(status_code=503,
  detail="audio_storage_unavailable")`. This replaces the current unguarded
  `AttributeError` → 500.
- The guard stays even though the adaptive UI should never reach it (defence
  in depth; symmetric with the SMTP 2FA guard rationale).

### 3. Participant auto-degradation (silent — user choice)

- `Step1_Feedback.tsx`: the existing `isAudioEnabled` becomes
  `isAudioEnabled && isAudioStorageAvailable()`. When storage is unavailable
  the recorder is simply not rendered; the participant gives a text response
  only. No participant-facing message.
- `Step2_Questionnaire.tsx`: a `text_audio` question degrades to its plain
  text input when storage is unavailable (the text half is always present;
  only the audio affordance is suppressed).
- No other participant flow references audio, so nothing else changes.

### 4. Operator clarity (non-blocking — the "must be clear" half)

- **Startup log:** new pure helper `app/utils/storage_mode.py` exposing
  `storage_mode_banner_lines(*, s3_configured: bool) -> list[str]` (empty when
  configured; otherwise lines stating audio responses will not be collected
  and referencing `docs/guides/running-without-s3.md`). Wired into the
  `main.py` lifespan next to the existing SMTP banner call, via
  `logger.warning`.
- **Study-design audio toggle:** when `!isAudioStorageAvailable()`, an inline
  note next to the audio-enable control: "Object storage is not configured —
  audio responses will not be collected; participants answer in text only."
  The control stays enabled; the operator is free to proceed (no validation
  error — explicit user choice). All strings via `t('key', 'English
  fallback')`, admin-best-effort per i18n policy.
- **Doc:** new `docs/guides/running-without-s3.md` with a capability matrix
  (✅ works unchanged / ⚙️ requires action / 🚫 disabled), parallel to
  `docs/guides/running-without-smtp.md`, referenced by the startup banner.

## Security considerations

- The new flag exposes only whether object storage is configured (a boolean
  capability), no credentials or endpoint — same disclosure class as the
  existing `email_delivery` flag on the same unauthenticated endpoint.
- The 503 guard is strictly safer than the status-quo 500/`AttributeError`
  and leaks no storage detail.
- No new privileged surface; no secret at rest.

## Testing

**Backend**
- `Settings.is_s3_configured`: unit — `False` when any of the four unset,
  `True` when all set.
- `storage_mode_banner_lines`: unit — empty when configured; otherwise
  contains the `docs/guides/running-without-s3.md` reference.
- `/api/config`: integration — `audio_storage == "unavailable"` when S3 unset,
  `"available"` when all four set (monkeypatched).
- Audio endpoint: integration — returns **503** (`audio_storage_unavailable`),
  not 500, when S3 unconfigured and a study has audio enabled.

**Frontend**
- `usePlatformConfigStore`: `isAudioStorageAvailable()` reflects the fetched
  flag; `null` → available (safe default).
- `Step1_Feedback`: recorder not rendered when audio enabled but storage
  unavailable; rendered when both true.
- `Step2_Questionnaire`: `text_audio` question shows text input only when
  storage unavailable.

## Cross-cutting gates (apply in the same commits)

- `backend/vulture_whitelist.py`: append a `# --- S3-optional mode ---`
  section with `is_s3_configured`, `audio_storage`, and the new banner helper
  (memory: `project_qualis_vulture_whitelist_gate` — `make ci-fast` does not
  run vulture; only full `make ci` does).
- `app/utils/storage_mode.py` and the `PublicConfig` field opt into the
  `mypy --strict` overrides list in `backend/pyproject.toml`, consistent with
  the SMTP-optional leaf modules (`smtp_mode.py`, `schemas/config.py`).
- After backend schema/route changes: `make generate-api`; verify with
  `make check-api`.
- Run a full `make check` (not just `make ci-fast`) before the final gate.
