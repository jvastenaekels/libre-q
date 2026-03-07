# Migration Guide: Workspace Admin → Owner Role Rename

> **Note**: Since this migration, the "workspace" concept has been renamed to "project" across the entire codebase (tables: `projects`, `project_members`; enum: `projectrole`). The information below uses the original terminology for historical accuracy.

**Date**: 2026-01-15
**Type**: Breaking Change
**Affects**: API, Database, Frontend

---

## Overview

The workspace-level `admin` role has been renamed to `owner` for consistency with study-level roles and to align with industry best practices.

## What Changed

### Database

- All `workspace_members` records with `role = 'admin'` updated to `role = 'owner'`
- Enum type `WorkspaceRole` updated: `admin` → `owner`

### API

- **Endpoint Changes**: None (URLs unchanged)
- **Request/Response Format**:
  - Old: `{"role": "admin"}`
  - New: `{"role": "owner"}`

### Frontend

- UI labels updated: "Admin" → "Owner" (in individual role contexts)
- Type definitions regenerated

---

## Impact on Users

### Who is Affected?

- Users with workspace admin role (now called "owner")
- API clients that hardcode role values
- Custom scripts querying the database

### What Users Need to Do

1. **No action required** for web interface users.
2. **API clients**: Update hardcoded `"admin"` strings to `"owner"`.
3. **Database queries**: Update `WHERE role = 'admin'` to `WHERE role = 'owner'`.

---

## Migration Timeline

| Phase   | Date       | Action                                      |
| ------- | ---------- | ------------------------------------------- |
| Phase 1 | 2026-01-15 | Database migration (add 'owner' enum value) |
| Phase 2 | 2026-01-15 | Data migration (admin → owner)              |
| Phase 3 | 2026-01-15 | Code deployment (backend + frontend)        |

---

## Rollback Procedure

If issues occur, rollback is possible:

```bash
# 1. Rollback code deployment
git revert <commit-hash>

# 2. Rollback database migration
cd backend
uv run alembic downgrade -1

# 3. Restart services
```

---

## For Developers

### Updating API Clients

**Python**:

```python
# OLD:
workspace_member = {
    "user_id": 123,
    "role": "admin"
}

# NEW:
workspace_member = {
    "user_id": 123,
    "role": "owner"
}
```

**JavaScript**:

```javascript
// OLD:
if (member.role === "admin") {
  // ...
}

// NEW:
if (member.role === "owner") {
  // ...
}
```

### Database Queries

**SQL**:

```sql
-- OLD:
SELECT * FROM workspace_members WHERE role::text = 'admin';

-- NEW:
SELECT * FROM workspace_members WHERE role::text = 'owner';
```

---

## FAQ

### Q: Will my existing admin permissions change?

**A**: No. The role name changed, but permissions remain identical.

### Q: Do I need to re-login?

**A**: No. Your session remains valid; roles are fetched from the database on each request.

### Q: Can I still use the term "admin"?

**A**: The UI and documentation use "Owner" for workspace-level control. "Admin" now refers exclusively to system-level superusers.
