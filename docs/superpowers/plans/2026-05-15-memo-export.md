# Memo Export Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a project member download a concourse's or study's reflexive memo (entries + full comment audit trail) as a single Markdown file.

**Architecture:** A new typed `MemoService.render_markdown` builds the Markdown string from the existing memo ORM query plus a batched user-name lookup. Two `StreamingResponse` endpoints in the memos router (concourse + study) expose it under `viewer` auth. The frontend downloads via a hand-written `AdminService` helper (raw `fetch` → `blob`, because the orval `customInstance` forces `.json()` and cannot handle non-JSON bodies); the button lives in the `MemoSection` header with logic in the `useMemoSection` hook.

**Tech Stack:** Python 3.13 / FastAPI / SQLAlchemy async / pytest; React 19 / TypeScript / Vitest; orval-generated client + hand-written `AdminService` wrapper; i18n via react-i18next (9 locales).

**Spec:** `docs/superpowers/specs/2026-05-15-memo-export-design.md`

**Conventions to respect:**
- `app/services/memo_service.py` is under `mypy --strict` (full tier): every new function fully typed, no `Any`, explicit return types.
- Inner loop: `make ci-fast` between changes. Backend tests: `.venv/bin/python -m pytest` from `backend/` or via `make test`.
- Endpoint path: the memos router has `prefix="/admin"` and is mounted at `/api`, so full paths are `/api/admin/concourses/{cid}/memo/export` and `/api/admin/studies/{sid}/memo/export`.

---

### Task 1: `MemoService.render_markdown` + unit tests

**Files:**
- Modify: `backend/app/services/memo_service.py` (add a static method on `MemoService`; add `from app.models import User` usage via local import like the existing `validate_mentions` pattern)
- Create: `backend/tests/unit/test_memo_export.py`

- [ ] **Step 1: Write the failing tests**

Create `backend/tests/unit/test_memo_export.py`:

```python
"""Unit tests for MemoService.render_markdown."""

import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import (
    Concourse,
    MemoComment,
    MemoEntry,
    MemoParentType,
    Project,
    User,
)
from app.services.memo_service import MemoService
from app.utils.security import get_password_hash


@pytest.mark.asyncio
class TestRenderMarkdown:
    async def _mk_user(self, db: AsyncSession, email: str, full_name: str | None) -> User:
        u = User(email=email, hashed_password=get_password_hash("x"), full_name=full_name)
        db.add(u)
        await db.commit()
        await db.refresh(u)
        return u

    async def _mk_concourse(self, db: AsyncSession) -> Concourse:
        p = Project(title="P", slug="p")
        db.add(p)
        await db.flush()
        c = Concourse(project_id=p.id, title="My Concourse")
        db.add(c)
        await db.commit()
        await db.refresh(c)
        return c

    async def test_empty_memo_has_header_and_no_entries_line(self, db: AsyncSession):
        c = await self._mk_concourse(db)
        md = await MemoService.render_markdown(
            db,
            parent_type=MemoParentType.concourse,
            parent_id=c.id,
            parent_title="My Concourse",
        )
        assert "My Concourse" in md
        assert "No entries." in md

    async def test_entries_ordered_by_position(self, db: AsyncSession):
        c = await self._mk_concourse(db)
        user = await self._mk_user(db, "a@x.io", "Alice Adams")
        await MemoService.add_entry(
            db, parent_type=MemoParentType.concourse, parent_id=c.id,
            title="Second", body="b2", position=20, user_id=user.id,
        )
        await MemoService.add_entry(
            db, parent_type=MemoParentType.concourse, parent_id=c.id,
            title="First", body="b1", position=10, user_id=user.id,
        )
        md = await MemoService.render_markdown(
            db, parent_type=MemoParentType.concourse, parent_id=c.id,
            parent_title="My Concourse",
        )
        assert md.index("## First") < md.index("## Second")
        assert "Alice Adams" in md

    async def test_name_falls_back_to_email_then_unknown(self, db: AsyncSession):
        c = await self._mk_concourse(db)
        no_name = await self._mk_user(db, "noname@x.io", None)
        e = await MemoService.add_entry(
            db, parent_type=MemoParentType.concourse, parent_id=c.id,
            title="E", body="x", position=10, user_id=no_name.id,
        )
        # comment authored by a NULL user_id -> "Unknown"
        await MemoService.add_comment(
            db, entry_id=e.id, user_id=None, body="anon comment", mentions=[],
        )
        md = await MemoService.render_markdown(
            db, parent_type=MemoParentType.concourse, parent_id=c.id,
            parent_title="My Concourse",
        )
        assert "noname@x.io" in md       # email fallback (full_name is None)
        assert "Unknown" in md           # NULL user_id

    async def test_deleted_comment_is_placeholder_but_keeps_author(self, db: AsyncSession):
        c = await self._mk_concourse(db)
        user = await self._mk_user(db, "b@x.io", "Bob Brown")
        e = await MemoService.add_entry(
            db, parent_type=MemoParentType.concourse, parent_id=c.id,
            title="E", body="x", position=10, user_id=user.id,
        )
        cm = await MemoService.add_comment(
            db, entry_id=e.id, user_id=user.id, body="secret", mentions=[],
        )
        await MemoService.soft_delete_comment(db, comment_id=cm.id)
        md = await MemoService.render_markdown(
            db, parent_type=MemoParentType.concourse, parent_id=c.id,
            parent_title="My Concourse",
        )
        assert "secret" not in md
        assert "*[deleted]*" in md
        assert "Bob Brown" in md  # author retained for audit fidelity

    async def test_resolved_comment_is_marked(self, db: AsyncSession):
        c = await self._mk_concourse(db)
        user = await self._mk_user(db, "c@x.io", "Cara Cole")
        e = await MemoService.add_entry(
            db, parent_type=MemoParentType.concourse, parent_id=c.id,
            title="E", body="x", position=10, user_id=user.id,
        )
        cm = await MemoService.add_comment(
            db, entry_id=e.id, user_id=user.id, body="please fix", mentions=[],
        )
        await MemoService.resolve_comment(db, comment_id=cm.id, user_id=user.id)
        md = await MemoService.render_markdown(
            db, parent_type=MemoParentType.concourse, parent_id=c.id,
            parent_title="My Concourse",
        )
        assert "resolved by Cara Cole" in md
```

- [ ] **Step 2: Run the tests to verify they fail**

Run (from repo root):
```bash
cd backend && ../.venv/bin/python -m pytest tests/unit/test_memo_export.py -q
```
Expected: FAIL — `AttributeError: type object 'MemoService' has no attribute 'render_markdown'`.

- [ ] **Step 3: Implement `render_markdown`**

In `backend/app/services/memo_service.py`, add this method to the `MemoService` class (place it after `get_memo`, before `add_entry`). Note `User` is imported locally (same pattern as `validate_mentions`):

```python
    @staticmethod
    async def render_markdown(
        db: AsyncSession,
        *,
        parent_type: MemoParentType,
        parent_id: int,
        parent_title: str,
    ) -> str:
        """Render the full memo (entries + comment audit trail) as Markdown.

        Soft-deleted comments keep author + timestamp but their body
        becomes ``*[deleted]*``. Resolved comments carry a
        ``resolved by <name>`` marker. User ids resolve to
        ``full_name or email``; missing/None ids render ``Unknown``.
        """
        from datetime import timezone

        from app.models import User

        stmt = (
            select(MemoEntry)
            .where(
                MemoEntry.parent_type == parent_type,
                MemoEntry.parent_id == parent_id,
            )
            .options(selectinload(MemoEntry.comments))
            .order_by(MemoEntry.position, MemoEntry.id)
        )
        entries: Sequence[MemoEntry] = (await db.execute(stmt)).scalars().all()

        user_ids: set[int] = set()
        for e in entries:
            for uid in (e.created_by, e.last_edited_by):
                if uid is not None:
                    user_ids.add(uid)
            for c in e.comments:
                for uid in (c.user_id, c.resolved_by):
                    if uid is not None:
                        user_ids.add(uid)

        names: dict[int, str] = {}
        if user_ids:
            rows = (
                await db.execute(select(User).where(User.id.in_(user_ids)))
            ).scalars().all()
            for u in rows:
                names[u.id] = u.full_name or u.email

        def name_of(uid: int | None) -> str:
            if uid is None:
                return "Unknown"
            return names.get(uid, "Unknown")

        def fmt(dt: datetime) -> str:
            return dt.astimezone(timezone.utc).strftime("%Y-%m-%d %H:%M UTC")

        now = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC")
        lines: list[str] = [
            f"# {parent_title} — {parent_type.value} memo",
            "",
            f"_Exported {now}_",
            "",
        ]

        if not entries:
            lines.append("No entries.")
            return "\n".join(lines) + "\n"

        for e in entries:
            lines.append(f"## {e.title}")
            lines.append("")
            meta = f"_Created by {name_of(e.created_by)} on {fmt(e.created_at)}_"
            if e.last_edited_by is not None and e.last_edited_by != e.created_by:
                meta += f" · _last edited by {name_of(e.last_edited_by)}_"
            lines.append(meta)
            lines.append("")
            if e.body:
                lines.append(e.body)
                lines.append("")
            ordered = sorted(e.comments, key=lambda c: c.created_at)
            for c in ordered:
                header = f"**{name_of(c.user_id)}** · {fmt(c.created_at)}"
                if c.resolved:
                    header += f" · resolved by {name_of(c.resolved_by)}"
                lines.append(f"> {header}")
                body = "*[deleted]*" if c.deleted else c.body
                for bl in body.splitlines() or [""]:
                    lines.append(f"> {bl}")
                lines.append("")

        return "\n".join(lines) + "\n"
```

- [ ] **Step 4: Run the tests to verify they pass**

Run:
```bash
cd backend && ../.venv/bin/python -m pytest tests/unit/test_memo_export.py -q
```
Expected: PASS (6 passed).

- [ ] **Step 5: Type-check the strict module**

Run:
```bash
make ci-fast
```
Expected: PASS — no `mypy --strict` error on `app.services.memo_service` (no `Any`, explicit return type).

- [ ] **Step 6: Commit**

```bash
git add backend/app/services/memo_service.py backend/tests/unit/test_memo_export.py
git commit -m "feat(memo): add MemoService.render_markdown audit-trail renderer"
```

---

### Task 2: Export endpoints (concourse + study)

**Files:**
- Modify: `backend/app/routers/admin/memos.py` (add `io` + `re` + `StreamingResponse` imports; two endpoints in the read section, after `get_study_memo`)
- Create: `backend/tests/integration/test_memo_export_endpoints.py`

- [ ] **Step 1: Write the failing tests**

Create `backend/tests/integration/test_memo_export_endpoints.py`:

```python
"""Integration tests for the memo Markdown export endpoints."""

import pytest
import pytest_asyncio
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import Concourse, MemoParentType, Project, ProjectRole, Study, User
from app.services.memo_service import MemoService


@pytest_asyncio.fixture
async def memo_concourse(db: AsyncSession, test_project: Project, test_user: User):
    c = Concourse(project_id=test_project.id, title="Export Me")
    db.add(c)
    await db.commit()
    await db.refresh(c)
    await MemoService.add_entry(
        db, parent_type=MemoParentType.concourse, parent_id=c.id,
        title="Sources canvassed", body="We searched X.", position=10,
        user_id=test_user.id,
    )
    return c


@pytest.mark.asyncio
class TestMemoExportEndpoints:
    async def test_concourse_export_ok_for_member(
        self, client: AsyncClient, test_user: User, auth_token_factory, memo_concourse
    ):
        headers = auth_token_factory(test_user)
        r = await client.get(
            f"/api/admin/concourses/{memo_concourse.id}/memo/export", headers=headers
        )
        assert r.status_code == 200
        assert r.headers["content-type"].startswith("text/markdown")
        assert "attachment; filename=" in r.headers["content-disposition"]
        assert "## Sources canvassed" in r.text
        assert "We searched X." in r.text

    async def test_concourse_export_404_for_non_member(
        self, client: AsyncClient, db: AsyncSession, regular_user: User,
        auth_token_factory, memo_concourse,
    ):
        headers = auth_token_factory(regular_user)
        r = await client.get(
            f"/api/admin/concourses/{memo_concourse.id}/memo/export", headers=headers
        )
        assert r.status_code == 404

    async def test_concourse_export_404_for_missing_parent(
        self, client: AsyncClient, test_user: User, auth_token_factory
    ):
        headers = auth_token_factory(test_user)
        r = await client.get(
            "/api/admin/concourses/999999/memo/export", headers=headers
        )
        assert r.status_code == 404

    async def test_study_export_ok_for_member(
        self, client: AsyncClient, db: AsyncSession, test_user: User,
        auth_token_factory, seed_study: Study,
    ):
        await MemoService.add_entry(
            db, parent_type=MemoParentType.study, parent_id=seed_study.id,
            title="Distribution rationale", body="Forced choice.", position=10,
            user_id=test_user.id,
        )
        headers = auth_token_factory(test_user)
        r = await client.get(
            f"/api/admin/studies/{seed_study.id}/memo/export", headers=headers
        )
        assert r.status_code == 200
        assert "## Distribution rationale" in r.text
```

- [ ] **Step 2: Run the tests to verify they fail**

Run:
```bash
cd backend && ../.venv/bin/python -m pytest tests/integration/test_memo_export_endpoints.py -q
```
Expected: FAIL — 404 / route not found (endpoints don't exist yet).

- [ ] **Step 3: Add the imports**

In `backend/app/routers/admin/memos.py`, the top of the file currently has:

```python
from __future__ import annotations

import logging
from datetime import datetime
```

Replace that block with:

```python
from __future__ import annotations

import io
import logging
import re
from datetime import datetime
```

And add to the FastAPI imports — the file currently imports:

```python
from fastapi import APIRouter, Depends, HTTPException, Request, status
```

Immediately after that line add:

```python
from fastapi.responses import StreamingResponse
```

- [ ] **Step 4: Add the two endpoints**

In `backend/app/routers/admin/memos.py`, immediately after the `get_study_memo` function (it ends at the `return await MemoService.get_memo(... parent_id=sid)` line, before `@router.get("/concourses/{cid}/memo/unread")`), insert:

```python
def _memo_filename(stem: str) -> str:
    """Slugify a parent title/slug into a safe ``<slug>_memo.md`` filename."""
    slug = re.sub(r"[^a-z0-9]+", "-", stem.lower()).strip("-")
    return f"{slug or 'memo'}_memo.md"


@router.get("/concourses/{cid}/memo/export")
async def export_concourse_memo(
    cid: int,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> StreamingResponse:
    c = await db.get(Concourse, cid)
    if c is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Concourse not found")
    await _check_member(db, c.project_id, user, ProjectRole.viewer)
    md = await MemoService.render_markdown(
        db,
        parent_type=MemoParentType.concourse,
        parent_id=cid,
        parent_title=c.title,
    )
    filename = _memo_filename(c.title)
    return StreamingResponse(
        io.StringIO(md),
        media_type="text/markdown",
        headers={"Content-Disposition": f"attachment; filename={filename}"},
    )


@router.get("/studies/{sid}/memo/export")
async def export_study_memo(
    sid: int,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> StreamingResponse:
    s = await db.get(Study, sid)
    if s is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Study not found")
    await _check_member(db, s.project_id, user, ProjectRole.viewer)
    md = await MemoService.render_markdown(
        db,
        parent_type=MemoParentType.study,
        parent_id=sid,
        parent_title=s.slug,
    )
    filename = _memo_filename(s.slug)
    return StreamingResponse(
        io.StringIO(md),
        media_type="text/markdown",
        headers={"Content-Disposition": f"attachment; filename={filename}"},
    )
```

- [ ] **Step 5: Run the tests to verify they pass**

Run:
```bash
cd backend && ../.venv/bin/python -m pytest tests/integration/test_memo_export_endpoints.py -q
```
Expected: PASS (4 passed).

- [ ] **Step 6: Lint + type-check**

Run:
```bash
make ci-fast
```
Expected: PASS. Note `app.routers.admin.memos` is in the relaxed-strict tier (Pydantic models) but the new code adds no `Any`; `StreamingResponse` return type is explicit.

- [ ] **Step 7: Commit**

```bash
git add backend/app/routers/admin/memos.py backend/tests/integration/test_memo_export_endpoints.py
git commit -m "feat(memo): add concourse/study memo Markdown export endpoints"
```

---

### Task 3: Regenerate the API client

**Files:**
- Modify: `frontend/openapi.json`, `frontend/src/api/generated.ts` (regenerated, committed for `make check-api`)

The frontend will *consume* the export via a hand-written `AdminService` helper (Task 4), because the orval `customInstance` in `frontend/src/api/mutator.ts` always calls `response.json()` and cannot return a Markdown body. But the generated client must still be regenerated and committed so `make check-api` (which runs in `make ci`) passes.

- [ ] **Step 1: Regenerate**

Run:
```bash
make generate-api
```
Expected: `frontend/openapi.json` and `frontend/src/api/generated.ts` updated with the two new operations (`exportConcourseMemoApiAdminConcoursesCidMemoExportGet`, `exportStudyMemoApiAdminStudiesSidMemoExportGet`).

- [ ] **Step 2: Verify the client is in sync**

Run:
```bash
make check-api
```
Expected: PASS — `git diff --exit-code` clean after regeneration (no uncommitted drift).

- [ ] **Step 3: Commit**

```bash
git add frontend/openapi.json frontend/src/api/generated.ts frontend/src/api/model frontend/src/api/mocks
git commit -m "chore(api): regenerate client for memo export endpoints"
```

---

### Task 4: `AdminService` download helpers

**Files:**
- Modify: `frontend/src/api/admin.ts` (add two methods to the `AdminService` object, mirroring `exportParticipantCSV`)

- [ ] **Step 1: Add the helpers**

In `frontend/src/api/admin.ts`, inside the `AdminService = { ... }` object, add these two methods right before the closing `};` (after `exportResearchPackage`):

```typescript
    /**
     * Export a concourse memo (entries + comment audit trail) as Markdown.
     * Uses raw fetch + blob: the orval customInstance forces .json() and
     * cannot return a text/markdown body.
     */
    exportConcourseMemo: async (concourseId: number, signal?: AbortSignal) => {
        const response = await fetch(`/api/admin/concourses/${concourseId}/memo/export`, {
            headers: {
                Authorization: `Bearer ${useAuthStore.getState().token}`,
            },
            signal,
        });
        if (!response.ok) throw new Error('Failed to export concourse memo');
        return response.blob();
    },

    /**
     * Export a study memo (entries + comment audit trail) as Markdown.
     */
    exportStudyMemo: async (studyId: number, signal?: AbortSignal) => {
        const response = await fetch(`/api/admin/studies/${studyId}/memo/export`, {
            headers: {
                Authorization: `Bearer ${useAuthStore.getState().token}`,
            },
            signal,
        });
        if (!response.ok) throw new Error('Failed to export study memo');
        return response.blob();
    },
```

- [ ] **Step 2: Lint**

Run:
```bash
cd frontend && npm run lint
```
Expected: PASS (no Biome errors on `src/api/admin.ts`).

- [ ] **Step 3: Commit**

```bash
git add frontend/src/api/admin.ts
git commit -m "feat(memo): add AdminService memo export download helpers"
```

---

### Task 5: `useMemoSection` export handler + `MemoSection` button + hook test

**Files:**
- Modify: `frontend/src/hooks/admin/useMemoSection.ts` (add `exportMemo` callback; add `AdminService` import; return it)
- Modify: `frontend/src/components/admin/memo/MemoSection.tsx` (add an Export button in the header `flex gap-2` div)
- Modify: `frontend/src/hooks/admin/useMemoSection.test.ts` (add an export-handler test)

- [ ] **Step 1: Write the failing hook test**

In `frontend/src/hooks/admin/useMemoSection.test.ts`, the existing top mocks `@/api/generated` and `sonner`. Add a mock for `@/api/admin` next to the existing `vi.mock('@/api/generated', ...)` call:

```typescript
vi.mock('@/api/admin', () => ({
    AdminService: {
        exportConcourseMemo: vi.fn(),
        exportStudyMemo: vi.fn(),
    },
}));
```

Then add this test inside the `describe('useMemoSection', () => { ... })` block:

```typescript
    it('exportMemo downloads a blob and toasts success', async () => {
        const admin = await import('@/api/admin');
        const generated = await import('@/api/generated');
        // mount fetch (memo + templates) so the hook initialises cleanly
        (generated.getConcourseMemoApiAdminConcoursesCidMemoGet as ReturnType<typeof vi.fn>)
            .mockResolvedValue({ parent_type: 'concourse', parent_id: 1, entries: [] });
        (generated.getTemplatesApiAdminMemoTemplatesGet as ReturnType<typeof vi.fn>)
            .mockResolvedValue([]);
        const blob = new Blob(['# memo'], { type: 'text/markdown' });
        (admin.AdminService.exportConcourseMemo as ReturnType<typeof vi.fn>)
            .mockResolvedValue(blob);

        const createSpy = vi
            .spyOn(URL, 'createObjectURL')
            .mockReturnValue('blob:fake');
        vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined);

        const { result } = renderHook(() =>
            useMemoSection({
                parentType: 'concourse',
                parentId: 1,
                currentUserId: 1,
                projectMembers: [],
            })
        );
        await waitFor(() => expect(result.current.entries).toEqual([]));

        await act(async () => {
            await result.current.exportMemo();
        });

        expect(admin.AdminService.exportConcourseMemo).toHaveBeenCalledWith(1);
        expect(createSpy).toHaveBeenCalledWith(blob);
    });
```

- [ ] **Step 2: Run the test to verify it fails**

Run:
```bash
cd frontend && npx vitest run src/hooks/admin/useMemoSection.test.ts -t "exportMemo downloads"
```
Expected: FAIL — `result.current.exportMemo is not a function`.

- [ ] **Step 3: Implement `exportMemo` in the hook**

In `frontend/src/hooks/admin/useMemoSection.ts`:

(a) Add the import near the other api imports (the file already imports from `@/api/generated` ending around line 34):

```typescript
import { AdminService } from '@/api/admin';
```

(b) Add this callback alongside the other `useCallback`s (e.g. right after the `refetch` callback near line 139):

```typescript
    const exportMemo = useCallback(async (): Promise<void> => {
        try {
            const blob =
                parentType === 'concourse'
                    ? await AdminService.exportConcourseMemo(parentId)
                    : await AdminService.exportStudyMemo(parentId);
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `memo_${parentType}_${parentId}.md`;
            document.body.appendChild(a);
            a.click();
            a.remove();
            URL.revokeObjectURL(url);
            toast.success(t('admin.export.success', 'Export successful'));
        } catch {
            toast.error(t('admin.export.error', 'Export failed. Try again.'));
        }
    }, [parentType, parentId, t]);
```

Note: the hook already uses `toast` (imported from `sonner` at the top) and `t`. If `t` is not yet obtained in the hook, add `const { t } = useTranslation();` and `import { useTranslation } from 'react-i18next';` — check the existing hook head first; reuse whatever is already there. (The component `MemoSection.tsx` uses `useTranslation`; mirror that import.)

(c) Add `exportMemo` to the hook's returned object. The `return { ... }` block is around line 259 — add the key alongside `refetch`:

```typescript
        refetch,
        exportMemo,
```

- [ ] **Step 4: Run the hook test to verify it passes**

Run:
```bash
cd frontend && npx vitest run src/hooks/admin/useMemoSection.test.ts -t "exportMemo downloads"
```
Expected: PASS.

- [ ] **Step 5: Add the Export button to `MemoSection.tsx`**

In `frontend/src/components/admin/memo/MemoSection.tsx`, the header has a `<div className="flex gap-2">` containing the "Add entry" button (`onClick={() => setAdding((s) => !s)}`) and the template dropdown. Add an Export button as the last child inside that `flex gap-2` div, after the template `DropdownMenu` block closes:

```tsx
                <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                        void m.exportMemo();
                    }}
                >
                    {t('admin.memo.export', 'Export')}
                </Button>
```

(`m` is the `useMemoSection` return value already destructured/used in this component as `m.templates`, `m.setShowResolved`, etc. `Button` and `t` are already imported.)

- [ ] **Step 6: Run the full MemoSection + hook tests**

Run:
```bash
cd frontend && npx vitest run src/hooks/admin/useMemoSection.test.ts src/components/admin/memo/MemoSection.test.tsx
```
Expected: PASS (existing tests still green + the new export test).

- [ ] **Step 7: Lint**

Run:
```bash
cd frontend && npm run lint
```
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add frontend/src/hooks/admin/useMemoSection.ts frontend/src/hooks/admin/useMemoSection.test.ts frontend/src/components/admin/memo/MemoSection.tsx
git commit -m "feat(memo): wire memo export button + hook handler"
```

---

### Task 6: i18n key in all 9 locales

**Files:**
- Modify: `frontend/public/locales/{de,en,es,fi,fr,it,nl,pl,pt}/admin.json` — add one key `admin.memo.export`

`npm run i18n-check` enforces key parity across all locale files, so the key must exist in **all nine**. The `admin.export.success` / `admin.export.error` toast keys are reused from the existing export flow (they already exist with fallbacks) — no new toast keys needed.

- [ ] **Step 1: Add the key to each locale's `admin.json`**

In each file, locate the `"memo": {` block and the line `"add_entry": "...",`. Insert an `"export"` key immediately after the `"add_entry"` line, using these per-locale values:

| File | Line to add after `"add_entry"` |
|---|---|
| `en/admin.json` | `"export": "Export",` |
| `fr/admin.json` | `"export": "Exporter",` |
| `de/admin.json` | `"export": "Exportieren",` |
| `es/admin.json` | `"export": "Exportar",` |
| `fi/admin.json` | `"export": "Vie",` |
| `it/admin.json` | `"export": "Esporta",` |
| `nl/admin.json` | `"export": "Exporteren",` |
| `pl/admin.json` | `"export": "Eksportuj",` |
| `pt/admin.json` | `"export": "Exportar",` |

Example for `en/admin.json` — the block becomes:

```json
            "add_entry": "Add entry",
            "export": "Export",
            "insert_template": "Insert from template",
```

(Match each file's existing indentation; the memo block is indented 12 spaces in `en`. Verify per file — they share structure.)

- [ ] **Step 2: Verify i18n parity**

Run:
```bash
cd frontend && npm run i18n-check
```
Expected: PASS — no missing/extra keys; `admin.memo.export` present in all 9 locales.

- [ ] **Step 3: Commit**

```bash
git add frontend/public/locales
git commit -m "i18n(memo): add admin.memo.export label in 9 locales"
```

---

### Task 7: Full CI gate

- [ ] **Step 1: Run the full local CI**

Run:
```bash
make ci
```
Expected: PASS — lint + type-check (backend `mypy --strict` on `memo_service`, frontend Biome/tsc) + backend & frontend tests + frontend build + `make check-api` all green.

- [ ] **Step 2: If anything fails**

Use superpowers:systematic-debugging. Do not patch over a red gate. Common spots: `make check-api` drift (rerun `make generate-api`, recommit), an i18n indentation slip (re-check the edited `admin.json`), or a `mypy --strict` `Any` leak in `render_markdown`.

- [ ] **Step 3: Final state**

All seven tasks committed. Branch ready for PR/merge per superpowers:finishing-a-development-branch (the user decides branch/PR — do not push or open a PR unless asked).

---

## Self-Review

**Spec coverage:**
- Markdown-only, full audit trail (entries + all comments, resolved marked, deleted placeholder, names + timestamps) → Task 1 `render_markdown` + its 6 unit tests. ✓
- `viewer` auth, concourse + study endpoints, `StreamingResponse` + `Content-Disposition` → Task 2. ✓
- `make generate-api` / `check-api` → Task 3. ✓
- Frontend download (blob pattern, not orval) → Task 4 + 5. ✓
- Button in `MemoSection` header, logic in `useMemoSection` hook (hook-driven convention) → Task 5. ✓
- i18n in all locales (spec corrected: 9 locales, not 3; CLAUDE.md stale) → Task 6. ✓
- Quality gate (`ci-fast`, `check-api`, `ci`) → Tasks 1–7. ✓
- Out-of-scope items (JSON/PDF, re-import, bulk, per-section) → not implemented. ✓

**Placeholder scan:** No TBD/TODO; every code step shows full code; commands have expected output. One conditional ("if `t` not yet in hook, add the import") is resolved with an explicit instruction + precedent, not a placeholder.

**Type consistency:** `render_markdown(db, *, parent_type, parent_id, parent_title) -> str` is defined identically in Task 1 and called identically in Task 2. `AdminService.exportConcourseMemo(id)` / `exportStudyMemo(id)` defined in Task 4, consumed identically in Task 5 hook and mocked identically in Task 5 test. `exportMemo` returned from the hook (Task 5 step 3c) matches the test's `result.current.exportMemo()` (Task 5 step 1) and the component's `m.exportMemo()` (Task 5 step 5). Endpoint paths consistent across Tasks 2/4. ✓
