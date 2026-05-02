# Project Roles Refactor — Design

**Date:** 2026-05-02
**Status:** Approved (brainstorming → spec)
**Owner:** Julien Vastenaekels

## 1. Goal

Tighten the project membership model so that:

1. The role taxonomy is **Owner / Member / Viewer** with crisp, easy-to-explain semantics.
2. There is **exactly one Owner per project**, set at creation time, never reassigned through the API.
3. **Viewer** is strictly read-only across every project surface (studies, concourses, members, memos, exports).
4. Operators can cap deployment-wide:
   - the **maximum number of members per project** (`MAX_MEMBERS_PER_PROJECT`),
   - the **maximum number of projects a user may own** (`MAX_PROJECTS_AS_OWNER`).
5. The frontend mirrors the backend exactly — no stale role names, proactive UI feedback when quotas are reached, structured error toasts when they are hit.

The cardinal sin to avoid: scope creep. This is a rename + invariant tightening + two quotas. It is **not** an overhaul of `StudyRole`, the invitation pipeline, or the auth system.

## 2. Non-goals

- Reworking `StudyRole` (`owner / editor / viewer`) — separate enum, separate concern.
- Introducing a persistent `Invitation` table — invitation tokens stay JWT-encoded.
- Adding a transfer-ownership endpoint. The Owner is fixed at creation; the only way out is `DELETE /projects/{slug}`.
- Public API stability guarantees for clients beyond the in-tree frontend.

## 3. Decisions made during brainstorming

| Question | Decision |
|---|---|
| Owner uniqueness mechanism | **C** — Owner is set at creation, never changed by API. PATCH and invitation endpoints reject `role=owner`. |
| Quota sentinel + defaults | **A** — `0` means unlimited; both env vars default to `0`. |
| Superuser bypass | **A** — superusers bypass both quotas; their UI hides counters. |
| Pending invitations vs quota | **A** — quota counts effective members only; `POST /invitations` checks best-effort, `POST /invitations/accept` is authoritative. |
| Rename strategy | **A** — single PR, single Alembic migration, no `researcher` alias kept. |
| Frontend feedback | **B** — proactive (counters, disabled buttons, tooltips) + reactive (structured 409s, translated toasts). |

## 4. Data model and constraints

### 4.1 Enum

`ProjectRole` becomes `{owner, member, viewer}` everywhere — Python enum (`backend/app/models/base.py`), SQL enum (`projectrole`), generated TS enum (`frontend/src/api/model/projectRole.ts`), all i18n locales.

### 4.2 Hierarchy

`PROJECT_ROLE_HIERARCHY = {owner: 40, member: 20, viewer: 10}` (`backend/app/dependencies.py`). The numeric weights are unchanged in spirit — only the key name changes.

### 4.3 Owner uniqueness invariant

A new partial unique index on `project_members`:

```sql
CREATE UNIQUE INDEX project_members_one_owner_per_project
    ON project_members (project_id)
    WHERE role = 'owner';
```

This makes the invariant a database-level fact, not a service-level convention.

### 4.4 API restrictions on Owner

- `PATCH /admin/projects/{slug}/members/{user_id}` rejects `role=owner` with **400** and `detail=OWNER_ROLE_IMMUTABLE`.
- `POST /admin/projects/{slug}/invitations` rejects `role=owner` with **400** and the same code.
- Self-removal stays blocked (current behaviour). Consequence: an Owner cannot leave their project; the only exit is `DELETE /projects/{slug}`.

### 4.5 Role semantics (canonical reference)

| Role | Manage team | Delete project | Edit studies/concourses/memos | Read everything visible |
|---|---|---|---|---|
| Owner | yes | yes | yes | yes |
| Member | no | no | yes | yes |
| Viewer | no | no | no | yes |

## 5. Configuration and quotas

### 5.1 New env vars

Added to `backend/app/core/config.py` `Settings`:

```python
MAX_MEMBERS_PER_PROJECT: int = Field(0, ge=0)   # 0 = unlimited
MAX_PROJECTS_AS_OWNER:   int = Field(0, ge=0)   # 0 = unlimited
```

In-line docstrings explain the `0`-means-unlimited convention. Defaults preserve current behaviour (no quotas) so the upgrade is invisible until an operator opts in.

### 5.2 Centralised quota helpers

A new strict-typed module `backend/app/services/quotas.py`:

```python
class QuotaState(TypedDict):
    count: int
    limit: int | None  # None == unlimited

async def assert_can_add_member(
    db: AsyncSession, project_id: int, current_user: User
) -> None: ...

async def assert_can_create_owned_project(
    db: AsyncSession, current_user: User
) -> None: ...

async def get_member_quota_state(
    db: AsyncSession, project_id: int, current_user: User
) -> QuotaState: ...

async def get_owned_project_quota_state(
    db: AsyncSession, current_user: User
) -> QuotaState: ...
```

The `0` sentinel is translated into `None` at the boundary of this module so the rest of the codebase reasons in terms of `int | None`. Superusers receive `limit=None` from the `get_*` helpers and short-circuit through the `assert_*` helpers.

### 5.3 Enforcement points

- `POST /admin/projects` → `assert_can_create_owned_project` before flushing the new `Project`.
- `POST /admin/projects/{slug}/invitations` → `assert_can_add_member` before signing the JWT (best-effort UX guardrail).
- `POST /admin/invitations/accept` → `assert_can_add_member` before inserting the new `ProjectMember` (authoritative, race-safe).

### 5.4 Error contract

HTTP **409 Conflict** with a stable error code in `detail`:

```json
{"detail": "MEMBER_LIMIT_REACHED", "message": "Project member limit reached (5/5)"}
```

Error codes:

- `MEMBER_LIMIT_REACHED` — `MAX_MEMBERS_PER_PROJECT` would be exceeded.
- `OWNER_PROJECT_LIMIT_REACHED` — `MAX_PROJECTS_AS_OWNER` would be exceeded.
- `OWNER_ROLE_IMMUTABLE` — attempt to assign `owner` via PATCH or invitation (400, not 409).

The `detail` field is the stable code (compatible with FastAPI conventions); `message` is human-readable and serves as a fallback for the frontend toast.

## 6. API surface changes

### 6.1 New schema fragment

```python
class QuotaInfo(BaseModel):
    count: int
    limit: int | None  # null == unlimited
```

### 6.2 Enriched response models

- `ProjectRead` and `ProjectWithRole` gain `member_quota: QuotaInfo`.
- The `/auth/me`-equivalent response (or whatever endpoint serves the current user; the exact name is verified at implementation time) gains `owned_project_quota: QuotaInfo`.

### 6.3 No new endpoints

Quota state travels with existing resources. No dedicated `/quotas` endpoint.

### 6.4 Counters

- `member_quota.count = COUNT(*) FROM project_members WHERE project_id = X` — joined into the existing project listing/detail queries to avoid N+1.
- `owned_project_quota.count = COUNT(*) FROM project_members WHERE user_id = me AND role = 'owner'`.

The composite primary key on `project_members (project_id, user_id)` plus the existing FK indexes already cover these counts; no new index needed.

## 7. Frontend reflection

### 7.1 Permissions hook

`frontend/src/hooks/usePermission.ts`:

- `PERMISSION_MATRIX` key `researcher` renamed to `member`. Permission set unchanged.
- Hook returns `isMember` instead of `isResearcher`. `isOwner` and `isViewer` unchanged.
- All call sites updated.

### 7.2 Proactive quota UI

- **Project members page** (`ProjectMembersPage.tsx`): the list header shows `t('admin.projects.members.quota', '{{count}}/{{limit}} seats used', {count, limit})` when `member_quota.limit !== null`. The "Invite" button is disabled with an explanatory tooltip when `count >= limit`. When `limit === null`, no counter is rendered.
- **Project creation entry point** (`CreateProjectPage.tsx` and any owner-project listing where a "Create project" CTA lives): the CTA is disabled with a tooltip when `owned_project_quota.count >= limit`. When `limit !== null`, a discreet `count/limit owned projects` indicator is shown.
- **Role dropdown in invitation/edit forms**: only `member` and `viewer` are offered. `owner` is never selectable. Default = `member`.

### 7.3 Reactive error mapping

A centralised mapping (`frontend/src/utils/apiErrors.ts` or the existing equivalent — to be verified at implementation time):

```ts
const ERROR_KEY: Record<string, string> = {
    MEMBER_LIMIT_REACHED: 'errors.member_limit_reached',
    OWNER_PROJECT_LIMIT_REACHED: 'errors.owner_project_limit_reached',
    OWNER_ROLE_IMMUTABLE: 'errors.owner_role_immutable',
};
```

When an API call returns `{detail: <code>, message: <text>}`, the frontend looks up `ERROR_KEY[detail]` and calls `t(key, message)`. The server `message` is the fallback when no key matches.

### 7.4 Cleanup of stale residues

- `frontend/src/types/backend.ts`: the local `ProjectWithRole` type (`'owner' | 'admin' | 'researcher' | 'viewer'`) is deleted; the OpenAPI-generated type is the single source of truth.
- `ProjectMembersPage.tsx:133`: the local variable `isAdmin` is renamed `isOwner` for clarity.
- All `'researcher'` literals in app code replaced with `'member'`.

### 7.5 Regeneration

`make generate-api` regenerates `frontend/src/api/model/projectRole.ts` with the `member` value. The mock generators in `frontend/src/api/generated.ts` (line ~17434+) are regenerated in the same step.

## 8. i18n

### 8.1 Renamed keys

The role taxonomy keys are renamed in all three locales (`en`, `fr`, `fi`):

```
admin.project.roles.researcher                                  → admin.project.roles.member
admin.projects.settings.team.permissions_matrix.researcher.*    → ….member.*
```

The full list is verified exhaustively at implementation time with `grep -rn "researcher" frontend/public/locales/`. The list above is what was visible during the explore phase and may be incomplete.

### 8.2 Content occurrences of "researcher" stay intact

The English word "researcher" also appears in **content** strings (e.g. "contact the researcher for follow-up", "help the researchers interpret the data"). These describe the human running a Q-methodology study, not the technical role, and **are not changed**. The implementation reviews each occurrence and only touches the role-vocabulary keys.

### 8.3 New keys

```json
admin.projects.members.quota                : "{{count}}/{{limit}} seats used"
admin.projects.members.quota_full_tooltip   : "Member limit reached. Increase MAX_MEMBERS_PER_PROJECT or remove a member."
admin.projects.create.quota                 : "{{count}}/{{limit}} owned projects"
admin.projects.create.quota_full_tooltip    : "You've reached your owned-project limit."
errors.member_limit_reached                 : "Project member limit reached."
errors.owner_project_limit_reached          : "You can't own any more projects."
errors.owner_role_immutable                 : "The Owner role can only be assigned at project creation."
```

French and Finnish translations ship in the same PR. `npm run i18n-check` must pass.

## 9. Migration

A single Alembic revision: `<rev>_rename_researcher_to_member_and_add_owner_constraint.py`.

### 9.1 Forward migration

The migration uses the **enum recreation pattern**, which is the only reliable way to remove an enum value in PostgreSQL inside a single Alembic transaction. The rename from `researcher → member` is performed during the cast, avoiding the `ALTER TYPE ADD VALUE` / explicit `COMMIT` workaround entirely.

1. **Pre-flight invariant check.** Before any DDL, run:

   ```sql
   SELECT project_id
   FROM project_members
   WHERE role = 'owner'
   GROUP BY project_id
   HAVING COUNT(*) > 1;
   ```

   If this returns any rows, the migration `raise`s with a clear message listing the offending `project_id`s. The operator resolves manually before retrying. Unlikely in practice — the API doesn't expose a path to multiple owners — but a cheap safety net.

2. **Create the new enum type:**

   ```sql
   CREATE TYPE projectrole_new AS ENUM ('owner', 'member', 'viewer');
   ```

3. **Cast the column with the rename folded into the `USING` clause:**

   ```sql
   ALTER TABLE project_members
       ALTER COLUMN role TYPE projectrole_new
       USING (CASE
                  WHEN role::text = 'researcher' THEN 'member'
                  ELSE role::text
              END)::projectrole_new;
   ```

   This is atomic: every existing `researcher` row becomes `member` in the same statement that switches the column type.

4. **Swap the type names:**

   ```sql
   DROP TYPE projectrole;
   ALTER TYPE projectrole_new RENAME TO projectrole;
   ```

5. **Create the partial unique index** that enforces one Owner per project:

   ```sql
   CREATE UNIQUE INDEX project_members_one_owner_per_project
       ON project_members (project_id)
       WHERE role = 'owner';
   ```

### 9.2 Downgrade

Implemented as a defence-in-depth measure: drop the partial unique index, then mirror §9.1's enum-recreation pattern in reverse — create `projectrole_old` with `{owner, researcher, viewer}`, cast with `member → researcher` in the `USING` clause, swap names. Not expected to run in production, but Alembic requires a working `downgrade()`.

### 9.3 Deployment ordering

1. PR merged → Procfile release phase runs `python scripts/migrate.py`.
2. Backend binary starts with the new code (which no longer knows `'researcher'`).
3. Frontend build ships with the regenerated OpenAPI client (which knows `member`).

No feature flag. PostgreSQL DDL is transactional, so the migration is atomic. `MAX_*=0` defaults make the new code backwards-compatible from the operator's perspective; quotas are opt-in.

## 10. Tests

### 10.1 Backend (pytest)

**Quotas:**
- `test_project_create_owner_quota_blocks` — `MAX_PROJECTS_AS_OWNER` reached → 409 `OWNER_PROJECT_LIMIT_REACHED`.
- `test_project_create_owner_quota_unlimited` — `MAX_PROJECTS_AS_OWNER=0` → 1000th project succeeds.
- `test_project_create_owner_quota_superuser_bypass` — superuser exceeds the limit silently.
- `test_invitation_member_quota_blocks_at_send` — full project → 409 `MEMBER_LIMIT_REACHED` on send.
- `test_invitation_member_quota_blocks_at_accept` — invitation sent while there was room, project filled in between → 409 on accept.
- `test_member_quota_state_returned_in_project_read` — `GET /projects/{slug}` returns `member_quota`.
- `test_owned_project_quota_state_returned_in_me` — `/auth/me` returns `owned_project_quota`.

**Owner immutability:**
- `test_patch_member_role_owner_rejected` — 400 `OWNER_ROLE_IMMUTABLE`.
- `test_invitation_role_owner_rejected` — 400.
- `test_unique_owner_db_constraint` — direct SQL insertion of a second owner → `IntegrityError`. Locks down the DB invariant.

**Rename:**
- `test_legacy_researcher_role_rejected_in_api` — payload with `role=researcher` rejected by Pydantic.
- Existing tests referencing `ProjectRole.researcher` are updated to use `ProjectRole.member`.

### 10.2 Frontend (Vitest)

- `usePermission.test.ts` — `isMember` reflects `user_role='member'`, `cannot('project:manage_team')` for a member.
- `ProjectMembersPage.test.tsx` — Invite button disabled at quota with tooltip; enabled otherwise; counter visible when `limit !== null`, hidden when `null`.
- `apiErrors.test.ts` — `MEMBER_LIMIT_REACHED → errors.member_limit_reached` produces the expected translated toast.

### 10.3 E2E (Playwright, automated)

New file: `frontend/e2e/admin/roles-and-quotas.spec.ts`. Fixtures seed a project with one owner, one member, one viewer. Quota scenarios start a backend test server with the relevant `MAX_*` env vars set ahead of the suite (Playwright global setup or per-spec server config — exact mechanism follows the existing pattern in `frontend/e2e/`); switching quotas mid-suite is **not** required.

Critical scenarios:

- **`owner can manage team`** — invite, change role, remove.
- **`member cannot manage team`** — member-management UI absent or disabled; direct API call returns 403.
- **`viewer is fully read-only`** — every edit/create/delete control absent or disabled across studies, concourses, memos; data is visible.
- **`member can edit study and concourse, viewer cannot`** — same browser context, switch accounts, verify the design panel.
- **`owner role is never offered in dropdowns`** — invitation and member-edit dropdowns expose `member` and `viewer` only.
- **`owner cannot self-remove`** — clicking "Remove" on the owner's own row (or hitting the API directly) returns a clear error.
- **`member quota blocks invite at limit`** — backend started with `MAX_MEMBERS_PER_PROJECT=2`, project at 2/2 → Invite button disabled, counter `2/2`, tooltip; bypass attempt → translated toast.
- **`owner project quota blocks creation`** — `MAX_PROJECTS_AS_OWNER=1`, user already owns one → CTA disabled, tooltip; direct API call → 409 + toast.
- **`legacy researcher role token rejected`** — invitation token forged with `role=researcher` (via `create_invitation_token`) → `accept` returns 400; no membership row created.

### 10.4 Manual Playwright checks (run by Claude via Playwright MCP)

After `make ci` passes, the implementer starts the dev stack and pilots a browser through `mcp__playwright-humanized__*` to verify the polish that automated tests miss. Checklist:

1. Project creation → Owner assigned → Members page renders the counter correctly, no "Owner" option in the role dropdown, permission matrix displays cleanly.
2. Invite a member → log out → accept from a second account → return to Members page; counter advanced to `2/N`.
3. Change role member → viewer (from owner account) → re-login as the affected user → navigate into a study → edit controls absent, "View" controls present.
4. Attempt to promote to Owner via the dropdown — option absent. Forge the payload via DevTools (using `mcp__playwright-humanized__browser_evaluate`) → toast `errors.owner_role_immutable`.
5. Member-quota reached: relaunch stack with `MAX_MEMBERS_PER_PROJECT=3`, fill the project, verify Invite button is disabled with tooltip and counter shows `3/3`.
6. Owner-quota reached: `MAX_PROJECTS_AS_OWNER=2`, user already owns 2 → Create-project CTA disabled, tooltip explains.
7. Superuser bypass: log in as superuser → counters not shown (limit `null`), creation passes beyond the quota.
8. i18n: switch to `fr` then `fi`, screenshot the Members page, eyeball-check that all new keys are translated (no EN fallback visible).

Each step is documented in the PR description with screenshots. The manual campaign is the safety net for transitions, toasts, translation polish — things automated suites capture poorly.

### 10.5 CI gates

- `make ci-fast` between every change during development (~38s wall-clock).
- `make ci` (lint + check + test + build) before push.
- `make e2e` runs the new role/quota suite alongside existing admin-flow tests.

## 11. Risk and rollout

- **Atomic migration.** PostgreSQL DDL is transactional; failure rolls everything back.
- **Pre-flight integrity check** in the migration prevents a silent crash if multi-owner rows somehow exist.
- **Quota defaults are zero.** Operators see no behaviour change until they opt in.
- **Single-PR rename.** No backwards-compatibility shim to remove later. The rename is a one-shot atomic event in time.

## 12. Open at implementation time

These items are deferred to the implementation pass — they are not architectural decisions, just verifications that the spec defers to the actual code at implementation time:

- Exact name of the current-user endpoint (`/auth/me` vs `/users/me` vs other) — the spec assumes `/auth/me`.
- Exact list of i18n keys touched by the rename — the implementation runs the exhaustive `grep` mentioned in §8.1.
- Exact location of the centralised API-error utility on the frontend (§7.3) — the implementation either extends an existing module or creates `frontend/src/utils/apiErrors.ts`.
- Exact dev-server start command for the manual Playwright pass (§10.4) — the implementation uses whatever `make` target or `npm run` script is current.
