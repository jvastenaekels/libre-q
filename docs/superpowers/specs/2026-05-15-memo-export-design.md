# Memo export — design

**Date:** 2026-05-15
**Status:** Approved (brainstorming)

## Goal

Let a project member download a concourse's or study's reflexive memo as a
single Markdown file, suitable for a methods appendix, supplementary
materials, or an audit-trail archive.

## Decisions (locked)

- **Format:** Markdown only. No JSON, no PDF (no PDF dependency exists; out
  of scope).
- **Scope:** Full audit trail. All entries + all comments, including
  resolved comments (marked) and soft-deleted comments (rendered as a
  `*[deleted]*` placeholder but keeping author + timestamp for fidelity).
  Author display names and timestamps included throughout.
- **Auth:** `viewer` role — identical to reading the memo.
- **UI entry point:** an Export button in the `MemoSection` header, beside
  "Add entry" (not a per-section overflow menu).

## Backend

### `MemoService.render_markdown`

New static method in `app/services/memo_service.py` (module is already
under full `mypy --strict`; new code must be fully typed, no `Any`).

Signature:

```python
@staticmethod
async def render_markdown(
    db: AsyncSession,
    *,
    parent_type: MemoParentType,
    parent_id: int,
    parent_title: str,
) -> str
```

Behaviour:

1. Reuse the `get_memo` ORM query: entries ordered by `position, id`,
   comments `selectinload`-ed.
2. One batched query resolves every distinct user id referenced by
   `MemoEntry.created_by`, `MemoEntry.last_edited_by`,
   `MemoComment.user_id`, `MemoComment.resolved_by` into a
   `dict[int, str]`. Display name = `user.full_name or user.email`.
   A `None` id or an unresolved id renders as `Unknown`.
3. Emit Markdown:
   - Document header: parent type + `parent_title` + a UTC export
     timestamp line.
   - Per entry: `## {title}`, a metadata line
     (`created by {name} on {date}` + `last edited by {name}` when it
     differs), then the entry body verbatim.
   - Comments under their entry as nested blockquotes: author, timestamp,
     `(resolved by {name})` marker when resolved, mentions rendered as
     names. Soft-deleted comments keep author + timestamp; body becomes
     `*[deleted]*`.
   - Empty memo: header + a "No entries." line.

### Endpoints

Two endpoints in `app/routers/admin/memos.py`, mirroring the existing
`get_concourse_memo` / `get_study_memo` pair:

- `GET /admin/concourses/{cid}/memo/export`
- `GET /admin/studies/{sid}/memo/export`

Each: resolve parent (404 if missing), `_check_member(... ProjectRole.viewer)`,
derive `parent_title` (Concourse `title` / Study `slug`), call
`render_markdown`, return:

```python
StreamingResponse(
    io.StringIO(md),
    media_type="text/markdown",
    headers={"Content-Disposition": f"attachment; filename={slug}_memo.md"},
)
```

`slug` = the concourse title slugified / the study slug.

## Frontend

- Run `make generate-api` to pick up the two new client methods.
- `MemoSection.tsx`: add an Export button in the header next to
  "Add entry".
- The handler lives in `useMemoSection.ts` (hook-driven-component
  convention — logic in the hook, JSX in the component). It calls the
  generated `AdminService` method, wraps the response in a `Blob`,
  triggers a download via `createObjectURL` + `a.download`, and shows a
  success/error toast — same pattern as `ParticipantDetailContent`.
- i18n: add `admin.memo.export` to every locale's `admin.json`
  (9 locales: de, en, es, fi, fr, it, nl, pl, pt). `npm run i18n-check`
  enforces key parity. (Note: project CLAUDE.md still says "three
  locales" — stale since the add-5-languages + namespace-split work; the
  authoritative set is the 9 dirs under `frontend/public/locales/`.)

## Tests

**Backend** (`backend/tests/`):
- `render_markdown` unit tests: entry ordering by position; comment
  nesting under the right entry; soft-deleted → `*[deleted]*` placeholder
  with author retained; resolved marker present; `full_name` used, falls
  back to `email`, then `Unknown`; empty memo.
- Endpoint tests: viewer → 200 + `text/markdown` + `Content-Disposition`;
  non-member → 404; missing parent → 404; both concourse and study
  variants.

**Frontend:**
- Extend `useMemoSection.test.ts`: mocked client, assert the export
  handler resolves the blob and invokes the download path; error path
  shows the error toast.

## Quality gate

- `make ci-fast` during iteration.
- `make check-api` after `make generate-api` (generated client must be
  committed and in sync).
- `make ci` before push.

## Out of scope

- JSON / PDF export formats.
- Re-import of an exported memo.
- Bulk / project-wide memo export across all concourses + studies.
- Per-section (single-entry) export.
