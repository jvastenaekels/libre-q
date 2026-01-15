# 🔄 COMPREHENSIVE MIGRATION PLAN: WorkspaceRole.admin → WorkspaceRole.owner

**Status**: Draft
**Created**: 2026-01-15
**Estimated Effort**: 24-32 hours
**Risk Level**: **HIGH**
**Breaking Change**: ✅ YES

---

## 📋 Executive Summary

This document outlines the complete strategy for renaming the workspace-level `admin` role to `owner` for better semantic consistency with the study-level `owner` role. This is a **breaking change** requiring careful database migration, extensive code updates, and thorough testing.

### Why This Change?

**Problem**: Current role naming creates confusion:
- Workspace level: `admin` / `researcher` / `viewer`
- Study level: `owner` / `editor` / `viewer`

**Solution**: Harmonize terminology:
- Workspace level: `owner` / `researcher` / `viewer`
- Study level: `owner` / `editor` / `viewer`

This follows industry best practices (GitHub, GitLab, Notion) and provides a clearer mental model.

---

## 🎯 Success Criteria

- [ ] All database records migrated from 'admin' to 'owner'
- [ ] Zero data loss during migration
- [ ] All tests passing (unit, integration, E2E)
- [ ] API backward compatibility during transition
- [ ] Frontend correctly displays new role
- [ ] Documentation fully updated
- [ ] Rollback procedure tested and verified
- [ ] No breaking changes for active user sessions

---

## 🔍 COMPREHENSIVE TRAP ANALYSIS

### 🚨 CRITICAL TRAPS (Must Address)

#### **TRAP #1: String-Based ROLE_MAP in migrate_collaboration.py**
**Location**: `/home/user/open-q/backend/migrate_collaboration.py:17-21`

```python
ROLE_MAP = {
    "admin": StudyRole.owner,  # ⚠️ STRING-BASED!
    "researcher": StudyRole.editor,
    "viewer": StudyRole.viewer,
}
```

**Problem**: Uses string literals instead of enum values. If this script runs after enum change but before data migration, it will break.

**Impact**: Historical migration script becomes non-functional

**Solution**:
- Option A: Update to support both old and new values: `{"admin": ..., "owner": ...}`
- Option B: Mark as deprecated and document it's for historical use only
- Option C: Update to use enum values: `{WorkspaceRole.owner.value: ...}`

**Recommended**: Option B (mark deprecated) + Option C (fix for future)

---

#### **TRAP #2: SQLite vs PostgreSQL Enum Handling**
**Locations**: Multiple

**The Problem**:
- **PostgreSQL**: Uses native ENUM types stored in `pg_type` catalog
  - ALTER TYPE operations are complex
  - Cannot directly remove enum values without type replacement
  - Must use multi-step migration to avoid downtime
- **SQLite**: No native ENUM support
  - SQLAlchemy stores enum values as VARCHAR with CHECK constraint
  - Easier to migrate, but CHECK constraint needs updating

**Example of the Difference**:
```sql
-- PostgreSQL
CREATE TYPE workspacerole AS ENUM ('admin', 'researcher', 'viewer');

-- SQLite (what SQLAlchemy creates)
CREATE TABLE workspace_members (
    role VARCHAR(10) CHECK (role IN ('admin', 'researcher', 'viewer'))
);
```

**Impact**: Migration strategy must branch based on database dialect

**Specific PostgreSQL Trap**:
```python
# This WON'T work in PostgreSQL:
ALTER TYPE workspacerole RENAME VALUE 'admin' TO 'owner';  # ❌ Not supported!

# This is required instead:
# 1. Create new type
CREATE TYPE workspacerole_new AS ENUM ('owner', 'researcher', 'viewer');
# 2. Alter column type with USING clause
ALTER TABLE workspace_members ALTER COLUMN role TYPE workspacerole_new USING role::text::workspacerole_new;
# 3. Drop old type
DROP TYPE workspacerole;
# 4. Rename new type
ALTER TYPE workspacerole_new RENAME TO workspacerole;
```

**This requires**:
- All tables with the enum must be updated simultaneously
- Cannot have connections holding references to old type
- Requires exclusive locks (potential downtime)

**Solution**: Use ADD VALUE strategy for zero-downtime deployment

---

#### **TRAP #3: SAEnum Column Default Value**
**Location**: `/home/user/open-q/backend/app/models.py:96`

```python
role: Mapped[WorkspaceRole] = mapped_column(
    SAEnum(WorkspaceRole), default=WorkspaceRole.viewer  # ⚠️ Default is viewer, not admin
)
```

**Good News**: Default is `viewer`, not `admin`, so changing `admin` to `owner` doesn't affect defaults

**But Watch Out**: If anyone has code that explicitly sets `default=WorkspaceRole.admin`, it will break

**Verification Needed**: Search codebase for `default=WorkspaceRole.admin`

---

#### **TRAP #4: Composite Primary Key Data Integrity**
**Location**: `workspace_members` table schema

```python
class WorkspaceMember(Base):
    workspace_id: Mapped[int] = mapped_column(
        ForeignKey("workspaces.id", ondelete="CASCADE"), primary_key=True
    )
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), primary_key=True
    )
    role: Mapped[WorkspaceRole] = ...
```

**The Issue**: Composite PK (workspace_id, user_id) means:
- A user can only have ONE role per workspace
- No risk of duplicate records during migration
- BUT: If migration fails halfway, we might have inconsistent state

**Solution**: Use transactions with proper isolation level

---

#### **TRAP #5: Frontend Auto-Generated Types**
**Location**: `/home/user/open-q/frontend/src/api/model/workspaceRole.ts:15`

```typescript
export const WorkspaceRole = {
    admin: 'admin',  // ⚠️ Auto-generated from OpenAPI
    researcher: 'researcher',
    viewer: 'viewer',
} as const;
```

**The Problem**:
- File is auto-generated by Orval from backend OpenAPI spec
- Has warning: "Do not edit manually"
- Manual changes will be overwritten on next generation

**Impact**:
- Frontend changes MUST happen after backend OpenAPI spec updates
- Need to regenerate types with `npm run generate:api` or similar

**Deployment Sequence**:
1. Deploy backend with updated enum
2. Backend generates new OpenAPI spec
3. Frontend runs code generation
4. Frontend rebuild and deploy

**Risk**: If frontend deployed before backend updated, API calls will fail validation

---

#### **TRAP #6: String Assertions in Tests**
**Location**: `/home/user/open-q/backend/tests/test_admin_workspaces.py:53`

```python
assert data["members"][0]["role"] == "admin"  # ⚠️ String comparison!
```

**The Problem**: Direct string comparison instead of enum comparison

**Why It's a Trap**:
- Won't be caught by type checking
- Will silently fail after migration
- Could cause test suite to give false negatives

**Solution**: Update ALL string assertions to use `"owner"` or enum value

**Search Pattern**: `== "admin"` and `!= "admin"` in test files

---

#### **TRAP #7: JSON Serialization Edge Cases**
**Location**: API responses, database JSON columns

**The Issue**: When WorkspaceRole enum is serialized:
```python
# Pydantic serializes as:
{"role": "admin"}  # String value, not enum object

# After migration:
{"role": "owner"}  # Different string!
```

**Impact on**:
1. **API Clients**: Any hardcoded role checks will break
2. **Cached Responses**: If using HTTP caching, old responses might be cached
3. **Logs/Analytics**: Historical log analysis breaks if searching for "admin"
4. **External Integrations**: Webhooks or APIs expecting "admin" will fail

**Solution**:
- Document breaking change in API changelog
- Add version header to API
- Clear caches during deployment
- Update any external integrations

---

#### **TRAP #8: Permission Check Fallback Logic**
**Location**: `/home/user/open-q/backend/app/dependencies.py:106-144`

```python
# Fallback for Workspace Admins/Superusers?
ws_query = (
    select(Study, WorkspaceMember)
    .join(Study.workspace)
    .join(WorkspaceMember, WorkspaceMember.workspace_id == Study.workspace_id)
    .where(Study.slug == slug)
    .where(WorkspaceMember.user_id == current_user.id)
)
# ...
mapped_role = ROLE_MAP.get(member.role)  # ⚠️ Uses ROLE_MAP
```

**The Trap**: ROLE_MAP at line 72-76 maps workspace roles to study roles:
```python
ROLE_MAP = {
    WorkspaceRole.admin: StudyRole.owner,  # ⚠️ Will need update
    WorkspaceRole.researcher: StudyRole.editor,
    WorkspaceRole.viewer: StudyRole.viewer,
}
```

**Critical Issue**: If we update the enum but forget to update ROLE_MAP key, permission checks BREAK

**Solution**: Update in same commit as enum definition

---

#### **TRAP #9: Database Connection Pooling During Migration**
**Location**: PostgreSQL production environment

**The Problem**: Active database connections may cache enum type definitions

**Scenario**:
1. Connection pool has 10 active connections
2. We run migration to add 'owner' enum value
3. Old connections still see old enum definition
4. INSERT with 'owner' fails on those connections
5. Application errors until connections are recycled

**Impact**: Intermittent failures during migration window

**Solution**:
- Option A: Restart application after migration (causes downtime)
- Option B: Use `pool_pre_ping=True` and `pool_recycle=3600` in SQLAlchemy
- Option C: Graceful connection refresh via `engine.dispose()`

**Recommended for Production**:
```python
# After migration, in deployment script:
async with engine.begin() as conn:
    # Run migration
    pass

# Force connection pool refresh
await engine.dispose()

# Restart app or let it reconnect naturally
```

---

#### **TRAP #10: Workspace Creation Race Condition**
**Location**: `/home/user/open-q/backend/app/routers/admin/workspaces.py:62`

```python
member = WorkspaceMember(
    workspace_id=workspace.id,
    user_id=current_user.id,
    role=WorkspaceRole.admin,  # ⚠️ Assigned at creation
)
```

**The Race Condition**:
1. User A starts workspace creation request (old code with `admin`)
2. Migration runs, enum changes to `owner`
3. User A's request completes, tries to insert `admin`
4. Database rejects: 'admin' not in enum

**Probability**: Low (requires exact timing), but possible in high-traffic scenarios

**Solution**: Deploy with both values supported temporarily:
```python
# Migration Phase 1: Add 'owner' to enum (both exist)
# Migration Phase 2: Update code to use 'owner'
# Migration Phase 3: Data migration admin → owner
# Migration Phase 4: Remove 'admin' from enum (optional)
```

---

### ⚠️ MEDIUM SEVERITY TRAPS

#### **TRAP #11: Test Fixtures with Admin Users**
**Location**: `/home/user/open-q/backend/tests/conftest.py:113, 229`

```python
# Fixture 1
WorkspaceMember(
    workspace_id=ws.id, user_id=test_user.id, role=WorkspaceRole.admin
)

# Fixture 2
WorkspaceMember(
    workspace_id=ws.id, user_id=owner.id, role=WorkspaceRole.admin
)
```

**The Issue**: At least 2-3 test fixtures create users with `admin` role

**Impact**:
- ~15 test files depend on these fixtures
- If fixtures break, cascading test failures
- Hard to debug because error is in fixture, not test

**Solution**: Update all fixtures in single commit, run full test suite

---

#### **TRAP #12: init_db.py Default Admin**
**Location**: `/home/user/open-q/backend/init_db.py:88`

```python
member = WorkspaceMember(
    workspace_id=default_workspace.id,
    user_id=owner.id,
    role=WorkspaceRole.admin,  # ⚠️ Initial workspace setup
)
```

**The Issue**: Database initialization script creates first admin user

**Impact**: Fresh deployments or CI environments that run `init_db.py` will fail

**Solution**: Must update in same commit as enum change

---

#### **TRAP #13: Query Filters with .in_() Operator**
**Location**: `/home/user/open-q/backend/app/routers/admin/studies.py:57`

```python
.where(
    WorkspaceMember.role.in_([WorkspaceRole.admin, WorkspaceRole.researcher])
)
```

**Found in**:
- Line 57: Study creation permission check
- Line 134: List studies permission (admin only)
- Line 313: Export permission
- Line 353: Another admin check

**The Trap**: `.in_()` with enum list is type-safe, but...
- Easy to miss one location
- No compile-time checking for exhaustiveness
- If one check is missed, security hole

**Solution**: Global search for `WorkspaceRole.admin` ensures we catch all

---

#### **TRAP #14: Comments and Documentation Strings**
**Locations**: Multiple

```python
# Line 49: "Find a valid workspace for the user (Admin or Researcher)"
# Line 67: "You need to be an Admin or Researcher in a Workspace"
# Line 39: "Create Member (Admin)"
```

**The Issue**: Human-readable comments reference "Admin" role

**Impact**:
- Confusing for future developers
- Outdated documentation
- May mislead during debugging

**Solution**: Update all comments mentioning "admin" role

**Search Pattern**: `[Aa]dmin` in comments (case-insensitive)

---

### 💡 SUBTLE TRAPS (Easy to Miss)

#### **TRAP #15: OpenAPI Schema Generation**
**Location**: `/home/user/open-q/frontend/openapi.json`

**The Issue**: OpenAPI spec is likely generated from backend code

**If spec is committed to repo**:
- Need to regenerate and commit updated spec
- CI/CD might validate against old spec
- API documentation sites will show outdated info

**If spec is generated at runtime**:
- Need to restart backend to see changes
- Swagger UI needs cache clear

**Solution**: Document OpenAPI regeneration steps

---

#### **TRAP #16: Historical Data Analysis**
**Location**: Any analytics, reporting, or audit logs

**The Problem**: If anyone has:
- SQL reports: `WHERE role = 'admin'`
- Analytics dashboards filtering on "admin"
- Audit logs searching for admin actions
- Compliance reports referencing admin role

All of these will break or show incomplete data after migration

**Solution**:
- Document historical data query changes
- Update any reporting queries to use: `WHERE role IN ('admin', 'owner')`
- For new queries after migration: `WHERE role = 'owner'`

---

#### **TRAP #17: External API Clients**
**Location**: Any third-party integrations

**Risk**: If external systems call the API and expect `role: "admin"`, they'll break

**Mitigation**:
- Check if API is documented externally
- Search for API clients in other repos
- Add deprecation notice in API docs
- Consider API versioning: `/api/v2/` with new role names

---

#### **TRAP #18: Environment-Specific Issues**
**Locations**: Different deployment environments

**Development**:
- Uses SQLite: Simpler migration
- May have different enum handling

**Staging**:
- Should use PostgreSQL: Complex migration
- Connection pooling might differ

**Production**:
- Uses PostgreSQL: Most complex
- Connection pooling, replication, read replicas
- Potential for split-brain if replicas lag

**Solution**: Test migration path in all environments

---

## 🛡️ ROBUSTNESS STRATEGY

### 1. **Pre-Migration Validation**

```python
# Pre-migration checklist script
async def validate_pre_migration():
    """Run before starting migration."""
    async with SessionLocal() as db:
        # 1. Count current admin roles
        result = await db.execute(
            text("SELECT COUNT(*) FROM workspace_members WHERE role = 'admin'")
        )
        admin_count = result.scalar()
        print(f"✓ Found {admin_count} workspace admins to migrate")

        # 2. Check for any 'owner' roles (shouldn't exist yet)
        result = await db.execute(
            text("SELECT COUNT(*) FROM workspace_members WHERE role = 'owner'")
        )
        owner_count = result.scalar()
        if owner_count > 0:
            print(f"⚠️  WARNING: {owner_count} 'owner' roles already exist!")
            return False

        # 3. Verify no null roles
        result = await db.execute(
            text("SELECT COUNT(*) FROM workspace_members WHERE role IS NULL")
        )
        null_count = result.scalar()
        if null_count > 0:
            print(f"❌ ERROR: {null_count} NULL roles found!")
            return False

        # 4. Check database dialect
        dialect = db.bind.dialect.name
        print(f"✓ Database dialect: {dialect}")

        # 5. Verify no active transactions
        # (implementation depends on database)

        print("✓ All pre-migration checks passed")
        return True
```

### 2. **Migration Transaction Isolation**

```python
# Use SERIALIZABLE isolation for PostgreSQL
async def run_migration_with_isolation():
    async with engine.begin() as conn:
        # Set isolation level
        if conn.dialect.name == 'postgresql':
            await conn.execute(text("SET TRANSACTION ISOLATION LEVEL SERIALIZABLE"))

        # Run migration atomically
        # Either all succeeds or all rolls back
        await conn.execute(text(
            "UPDATE workspace_members SET role = 'owner' WHERE role = 'admin'"
        ))

        # Verify
        result = await conn.execute(text(
            "SELECT COUNT(*) FROM workspace_members WHERE role = 'admin'"
        ))
        remaining = result.scalar()

        if remaining > 0:
            raise Exception(f"Migration failed: {remaining} admin roles remain")

        print("✓ Migration successful")
```

### 3. **Post-Migration Validation**

```python
async def validate_post_migration():
    """Run after migration completes."""
    async with SessionLocal() as db:
        # 1. Verify no 'admin' roles remain
        result = await db.execute(
            text("SELECT COUNT(*) FROM workspace_members WHERE role = 'admin'")
        )
        admin_count = result.scalar()
        if admin_count > 0:
            print(f"❌ ERROR: {admin_count} admin roles still exist!")
            return False

        # 2. Count 'owner' roles
        result = await db.execute(
            text("SELECT COUNT(*) FROM workspace_members WHERE role = 'owner'")
        )
        owner_count = result.scalar()
        print(f"✓ Found {owner_count} workspace owners")

        # 3. Verify total count unchanged
        result = await db.execute(
            text("SELECT COUNT(*) FROM workspace_members")
        )
        total_count = result.scalar()
        expected_total = owner_count + ... # researcher + viewer counts
        print(f"✓ Total workspace members: {total_count}")

        # 4. Check referential integrity
        result = await db.execute(text("""
            SELECT COUNT(*) FROM workspace_members wm
            LEFT JOIN users u ON wm.user_id = u.id
            LEFT JOIN workspaces w ON wm.workspace_id = w.id
            WHERE u.id IS NULL OR w.id IS NULL
        """))
        orphaned = result.scalar()
        if orphaned > 0:
            print(f"❌ ERROR: {orphaned} orphaned records!")
            return False

        print("✓ All post-migration checks passed")
        return True
```

### 4. **Rollback Procedure**

```python
async def rollback_migration():
    """Emergency rollback if issues detected."""
    print("🔄 Starting rollback...")

    async with engine.begin() as conn:
        # Rollback data change
        await conn.execute(text(
            "UPDATE workspace_members SET role = 'admin' WHERE role = 'owner'"
        ))

        # Verify rollback
        result = await conn.execute(text(
            "SELECT COUNT(*) FROM workspace_members WHERE role = 'owner'"
        ))
        owner_count = result.scalar()

        if owner_count > 0:
            print(f"⚠️  {owner_count} owner roles remain after rollback")
        else:
            print("✓ Rollback successful - all roles reverted to 'admin'")
```

### 5. **Idempotency Guarantee**

```python
async def idempotent_migration():
    """Can run multiple times safely."""
    async with SessionLocal() as db:
        # Check if migration already ran
        result = await db.execute(
            text("SELECT COUNT(*) FROM workspace_members WHERE role = 'owner'")
        )
        owner_count = result.scalar()

        result = await db.execute(
            text("SELECT COUNT(*) FROM workspace_members WHERE role = 'admin'")
        )
        admin_count = result.scalar()

        if owner_count > 0 and admin_count == 0:
            print("✓ Migration already completed - skipping")
            return True

        if owner_count > 0 and admin_count > 0:
            print("⚠️  Partial migration detected - completing...")

        # Run migration
        await db.execute(text(
            "UPDATE workspace_members SET role = 'owner' WHERE role = 'admin'"
        ))
        await db.commit()

        print("✓ Migration complete")
        return True
```

---

## 📐 DETAILED IMPLEMENTATION PLAN

### **PHASE 0: Preparation & Infrastructure** (4-6 hours)

#### Step 0.1: Set Up Alembic
**Time**: 2 hours
**Risk**: Low

```bash
# 1. Install Alembic
cd backend
uv add alembic

# 2. Initialize Alembic
alembic init alembic

# 3. Configure alembic/env.py
```

**Files to Create**:
1. `/home/user/open-q/backend/alembic.ini`
2. `/home/user/open-q/backend/alembic/env.py`
3. `/home/user/open-q/backend/alembic/script.py.mako`

**alembic.ini Configuration**:
```ini
[alembic]
script_location = alembic
sqlalchemy.url = driver://user:pass@localhost/dbname

[loggers]
keys = root,sqlalchemy,alembic

[handlers]
keys = console

[formatters]
keys = generic

[logger_root]
level = WARN
handlers = console
qualname =

[logger_sqlalchemy]
level = WARN
handlers =
qualname = sqlalchemy.engine

[logger_alembic]
level = INFO
handlers =
qualname = alembic

[handler_console]
class = StreamHandler
args = (sys.stderr,)
level = NOTSET
formatter = generic

[formatter_generic]
format = %(levelname)-5.5s [%(name)s] %(message)s
datefmt = %H:%M:%S
```

**alembic/env.py** (Async Support):
```python
"""Alembic environment configuration for async SQLAlchemy."""

import asyncio
import os
from logging.config import fileConfig

from sqlalchemy import pool
from sqlalchemy.engine import Connection
from sqlalchemy.ext.asyncio import async_engine_from_config

from alembic import context

# Import Base and all models
from app.database import Base, SQLALCHEMY_DATABASE_URL
from app.models import *  # noqa: F403, F401

# Alembic Config object
config = context.config

# Override sqlalchemy.url with environment variable
if SQLALCHEMY_DATABASE_URL:
    config.set_main_option("sqlalchemy.url", SQLALCHEMY_DATABASE_URL)

# Interpret the config file for Python logging
if config.config_file_name is not None:
    fileConfig(config.config_file_name)

# Target metadata for 'autogenerate' support
target_metadata = Base.metadata


def run_migrations_offline() -> None:
    """Run migrations in 'offline' mode."""
    url = config.get_main_option("sqlalchemy.url")
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
    )

    with context.begin_transaction():
        context.run_migrations()


def do_run_migrations(connection: Connection) -> None:
    """Run migrations with connection."""
    context.configure(connection=connection, target_metadata=target_metadata)

    with context.begin_transaction():
        context.run_migrations()


async def run_async_migrations() -> None:
    """Run migrations in 'online' mode with async engine."""
    connectable = async_engine_from_config(
        config.get_section(config.config_ini_section, {}),
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )

    async with connectable.connect() as connection:
        await connection.run_sync(do_run_migrations)

    await connectable.dispose()


def run_migrations_online() -> None:
    """Run migrations in 'online' mode."""
    asyncio.run(run_async_migrations())


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
```

**Test Alembic Setup**:
```bash
# Generate initial migration (snapshot of current state)
alembic revision --autogenerate -m "initial schema"

# Review generated migration
cat alembic/versions/001_initial_schema.py

# Don't apply yet - this is just to verify Alembic works
```

**Verification**:
- [ ] Alembic initialized
- [ ] Can generate migrations
- [ ] Async SQLAlchemy working
- [ ] Environment variables loaded correctly

---

#### Step 0.2: Create Validation Scripts
**Time**: 1-2 hours
**Risk**: Low

Create `/home/user/open-q/backend/scripts/validate_migration.py`:

```python
"""Migration validation script."""

import asyncio
import sys
from sqlalchemy import text
from app.database import SessionLocal, engine


async def validate_pre_migration():
    """Pre-migration checks."""
    print("="*50)
    print("PRE-MIGRATION VALIDATION")
    print("="*50)

    async with SessionLocal() as db:
        # Count current roles
        for role in ['admin', 'researcher', 'viewer', 'owner']:
            result = await db.execute(
                text(f"SELECT COUNT(*) FROM workspace_members WHERE role = '{role}'")
            )
            count = result.scalar() or 0
            symbol = "✓" if role != 'owner' or count == 0 else "⚠️"
            print(f"{symbol} {role}: {count}")

        # Total count
        result = await db.execute(text("SELECT COUNT(*) FROM workspace_members"))
        total = result.scalar()
        print(f"\nTotal workspace members: {total}")

        # Check database dialect
        dialect = db.bind.dialect.name
        print(f"Database: {dialect}")

        return True


async def validate_post_migration():
    """Post-migration checks."""
    print("="*50)
    print("POST-MIGRATION VALIDATION")
    print("="*50)

    async with SessionLocal() as db:
        # Verify no 'admin' remain
        result = await db.execute(
            text("SELECT COUNT(*) FROM workspace_members WHERE role = 'admin'")
        )
        admin_count = result.scalar()

        if admin_count > 0:
            print(f"❌ ERROR: {admin_count} 'admin' roles still exist!")
            return False
        else:
            print("✓ No 'admin' roles found")

        # Count current roles
        for role in ['owner', 'researcher', 'viewer']:
            result = await db.execute(
                text(f"SELECT COUNT(*) FROM workspace_members WHERE role = '{role}'")
            )
            count = result.scalar() or 0
            print(f"✓ {role}: {count}")

        # Check referential integrity
        result = await db.execute(text("""
            SELECT COUNT(*) FROM workspace_members wm
            LEFT JOIN users u ON wm.user_id = u.id
            WHERE u.id IS NULL
        """))
        orphaned = result.scalar()

        if orphaned > 0:
            print(f"❌ ERROR: {orphaned} orphaned member records!")
            return False
        else:
            print("✓ Referential integrity OK")

        return True


if __name__ == "__main__":
    if "--pre" in sys.argv:
        success = asyncio.run(validate_pre_migration())
    elif "--post" in sys.argv:
        success = asyncio.run(validate_post_migration())
    else:
        print("Usage: python scripts/validate_migration.py [--pre|--post]")
        sys.exit(1)

    sys.exit(0 if success else 1)
```

**Test**:
```bash
python backend/scripts/validate_migration.py --pre
```

---

#### Step 0.3: Create Backup Script
**Time**: 1 hour
**Risk**: Low

Create `/home/user/open-q/backend/scripts/backup_database.py`:

```python
"""Database backup script."""

import asyncio
import os
from datetime import datetime
from sqlalchemy import text
from app.database import SessionLocal, engine


async def backup_workspace_members():
    """Create backup of workspace_members table."""
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    backup_file = f"backups/workspace_members_{timestamp}.sql"

    os.makedirs("backups", exist_ok=True)

    async with SessionLocal() as db:
        dialect = db.bind.dialect.name

        if dialect == "postgresql":
            # PostgreSQL dump using pg_dump would be better,
            # but here's a SQL-based backup
            result = await db.execute(text("""
                SELECT workspace_id, user_id, role::text, joined_at
                FROM workspace_members
            """))
            rows = result.fetchall()
        else:
            # SQLite
            result = await db.execute(text("""
                SELECT workspace_id, user_id, role, joined_at
                FROM workspace_members
            """))
            rows = result.fetchall()

        with open(backup_file, 'w') as f:
            f.write(f"-- Backup created: {timestamp}\n")
            f.write(f"-- Dialect: {dialect}\n")
            f.write(f"-- Total rows: {len(rows)}\n\n")

            for row in rows:
                ws_id, user_id, role, joined_at = row
                f.write(
                    f"-- INSERT: workspace_id={ws_id}, user_id={user_id}, "
                    f"role='{role}', joined_at='{joined_at}'\n"
                )

        print(f"✓ Backup created: {backup_file}")
        print(f"  Rows backed up: {len(rows)}")

        return backup_file


if __name__ == "__main__":
    backup_file = asyncio.run(backup_workspace_members())
    print(f"\n✓ Backup complete: {backup_file}")
```

---

### **PHASE 1: Database Migration** (6-8 hours)

#### Step 1.1: Create Migration 001 - Add 'owner' to Enum
**Time**: 2 hours
**Risk**: Medium

```bash
alembic revision -m "add_owner_to_workspace_role"
```

Edit the generated file:

```python
"""Add owner to WorkspaceRole enum

Revision ID: 001_add_owner_workspace_role
Revises:
Create Date: 2026-01-15
"""
from alembic import op
import sqlalchemy as sa

revision = '001_add_owner_workspace_role'
down_revision = None  # Or your latest migration
branch_labels = None
depends_on = None


def upgrade() -> None:
    """Add 'owner' value to workspace_role enum."""
    connection = op.get_bind()
    dialect = connection.dialect.name

    print(f"Running migration on {dialect}")

    if dialect == 'postgresql':
        # PostgreSQL: Add enum value if not exists
        # Note: Cannot be wrapped in transaction in PostgreSQL < 12
        # For PostgreSQL 12+, this is transactional
        connection.execute(
            sa.text("ALTER TYPE workspacerole ADD VALUE IF NOT EXISTS 'owner'")
        )
        print("✓ Added 'owner' to workspacerole enum")

    elif dialect == 'sqlite':
        # SQLite doesn't have real enums, handled at application level
        print("✓ SQLite detected - enum handled at application level")

    else:
        print(f"⚠️  Unknown dialect: {dialect}")


def downgrade() -> None:
    """Downgrade is not straightforward for enum values."""
    # PostgreSQL doesn't support removing enum values directly
    # This would require:
    # 1. Create new enum without 'owner'
    # 2. Update all columns to new enum
    # 3. Drop old enum
    # 4. Rename new enum
    #
    # For now, we document that downgrade is not supported
    print("⚠️  Downgrade not supported for enum value addition")
    print("   If needed, manually remove 'owner' from enum")
```

**Test Migration**:
```bash
# Run migration
alembic upgrade head

# Verify
python backend/scripts/validate_migration.py --pre
```

**Verification**:
- [ ] Migration runs without errors on SQLite
- [ ] Migration runs without errors on PostgreSQL
- [ ] 'owner' value can be used in queries
- [ ] No data has changed yet

---

#### Step 1.2: Create Migration 002 - Migrate Data
**Time**: 2 hours
**Risk**: HIGH

```bash
alembic revision -m "migrate_admin_to_owner"
```

```python
"""Migrate admin to owner in workspace_members

Revision ID: 002_migrate_admin_to_owner
Revises: 001_add_owner_workspace_role
Create Date: 2026-01-15
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy import text

revision = '002_migrate_admin_to_owner'
down_revision = '001_add_owner_workspace_role'
branch_labels = None
depends_on = None


def upgrade() -> None:
    """Update all 'admin' roles to 'owner' in workspace_members."""
    connection = op.get_bind()

    print("\n" + "="*60)
    print("MIGRATING WORKSPACE ADMIN ROLES TO OWNER")
    print("="*60 + "\n")

    # Count before migration
    result = connection.execute(
        text("SELECT COUNT(*) FROM workspace_members WHERE role = 'admin'")
    )
    admin_count = result.scalar() or 0
    print(f"Found {admin_count} workspace members with 'admin' role")

    if admin_count == 0:
        print("✓ No admin roles to migrate - skipping")
        return

    # Perform migration
    print("Updating roles from 'admin' to 'owner'...")
    connection.execute(
        text("UPDATE workspace_members SET role = 'owner' WHERE role = 'admin'")
    )

    # Verify migration
    result = connection.execute(
        text("SELECT COUNT(*) FROM workspace_members WHERE role = 'owner'")
    )
    owner_count = result.scalar() or 0

    result = connection.execute(
        text("SELECT COUNT(*) FROM workspace_members WHERE role = 'admin'")
    )
    remaining_admin = result.scalar() or 0

    print(f"\nMigration Results:")
    print(f"  - Owner roles: {owner_count}")
    print(f"  - Admin roles remaining: {remaining_admin}")

    if remaining_admin > 0:
        raise Exception(
            f"❌ Migration incomplete: {remaining_admin} admin roles remain"
        )

    print("\n✓ Migration successful - all admin roles converted to owner\n")


def downgrade() -> None:
    """Rollback: Update all 'owner' roles back to 'admin'."""
    connection = op.get_bind()

    print("\n" + "="*60)
    print("ROLLING BACK OWNER ROLES TO ADMIN")
    print("="*60 + "\n")

    # Count before rollback
    result = connection.execute(
        text("SELECT COUNT(*) FROM workspace_members WHERE role = 'owner'")
    )
    owner_count = result.scalar() or 0
    print(f"Found {owner_count} workspace members with 'owner' role")

    if owner_count == 0:
        print("✓ No owner roles to rollback - skipping")
        return

    # Perform rollback
    print("Updating roles from 'owner' to 'admin'...")
    connection.execute(
        text("UPDATE workspace_members SET role = 'admin' WHERE role = 'owner'")
    )

    # Verify rollback
    result = connection.execute(
        text("SELECT COUNT(*) FROM workspace_members WHERE role = 'admin'")
    )
    admin_count = result.scalar() or 0

    print(f"\nRollback Results:")
    print(f"  - Admin roles: {admin_count}")

    print("\n✓ Rollback successful\n")
```

**CRITICAL: Test Rollback Before Production**:
```bash
# Run migration
alembic upgrade head

# Test rollback
alembic downgrade -1

# Verify data restored
python backend/scripts/validate_migration.py --pre

# Re-run migration
alembic upgrade head

# Verify again
python backend/scripts/validate_migration.py --post
```

**Verification**:
- [ ] Migration completes successfully
- [ ] All 'admin' roles converted to 'owner'
- [ ] No data loss (row count unchanged)
- [ ] Rollback works correctly
- [ ] Foreign key constraints still valid

---

#### Step 1.3: Update migrate_collaboration.py
**Time**: 30 minutes
**Risk**: Low

**File**: `/home/user/open-q/backend/migrate_collaboration.py`

**Change Line 17-21**:
```python
# OLD:
ROLE_MAP = {
    "admin": StudyRole.owner,
    "researcher": StudyRole.editor,
    "viewer": StudyRole.viewer,
}

# NEW (support both for historical compatibility):
ROLE_MAP = {
    "admin": StudyRole.owner,  # Legacy - for historical migrations
    "owner": StudyRole.owner,  # New value
    "researcher": StudyRole.editor,
    "viewer": StudyRole.viewer,
}
```

**Add comment at top of file**:
```python
"""Migration script for study collaboration.

⚠️  DEPRECATION NOTICE:
This script is for historical migrations only. It references the old 'admin'
workspace role which has been renamed to 'owner' as of 2026-01-15.

For new migrations, use Alembic in /backend/alembic/
"""
```

---

### **PHASE 2: Backend Code Updates** (4-6 hours)

#### Step 2.1: Update Enum Definition
**Time**: 5 minutes
**Risk**: LOW (but breaks everything if done alone)

**File**: `/home/user/open-q/backend/app/models.py:49`

```python
# OLD:
class WorkspaceRole(str, Enum):
    """Enum for workspace roles."""
    admin = "admin"
    researcher = "researcher"
    viewer = "viewer"

# NEW:
class WorkspaceRole(str, Enum):
    """Enum for workspace roles."""
    owner = "owner"  # Renamed from 'admin' for consistency with StudyRole
    researcher = "researcher"
    viewer = "viewer"
```

⚠️ **CRITICAL**: This change MUST be deployed atomically with all other code changes

---

#### Step 2.2: Update ROLE_MAP
**Time**: 5 minutes
**Risk**: CRITICAL

**File**: `/home/user/open-q/backend/app/dependencies.py:73`

```python
# OLD:
ROLE_MAP = {
    WorkspaceRole.admin: StudyRole.owner,
    WorkspaceRole.researcher: StudyRole.editor,
    WorkspaceRole.viewer: StudyRole.viewer,
}

# NEW:
ROLE_MAP = {
    WorkspaceRole.owner: StudyRole.owner,  # Updated: admin → owner
    WorkspaceRole.researcher: StudyRole.editor,
    WorkspaceRole.viewer: StudyRole.viewer,
}
```

---

#### Step 2.3: Update All Router Files
**Time**: 1-2 hours
**Risk**: Medium

**Files to Update**:

1. **`/home/user/open-q/backend/app/routers/admin/workspaces.py`**
   - Line 62: `role=WorkspaceRole.admin` → `role=WorkspaceRole.owner`
   - Line 39 comment: "Create Member (Admin)" → "Create Member (Owner)"

2. **`/home/user/open-q/backend/app/routers/admin/studies.py`**
   - Line 57: `[WorkspaceRole.admin, WorkspaceRole.researcher]` → `[WorkspaceRole.owner, WorkspaceRole.researcher]`
   - Line 49 comment: "Admin or Researcher" → "Owner or Researcher"
   - Line 67 error message: "Admin or Researcher" → "Owner or Researcher"
   - Line 134: `WorkspaceRole.admin` → `WorkspaceRole.owner`
   - Line 313: `WorkspaceRole.admin` → `WorkspaceRole.owner`
   - Line 353: `WorkspaceRole.admin` → `WorkspaceRole.owner`

**Verification Script**:
```bash
# Check all occurrences are updated
cd /home/user/open-q/backend
grep -rn "WorkspaceRole\.admin" app/routers/
# Should return NO results
```

---

#### Step 2.4: Update init_db.py
**Time**: 15 minutes
**Risk**: Medium

**File**: `/home/user/open-q/backend/init_db.py`

**Line 88**:
```python
# OLD:
member = WorkspaceMember(
    workspace_id=default_workspace.id,
    user_id=owner.id,
    role=WorkspaceRole.admin,
)

# NEW:
member = WorkspaceMember(
    workspace_id=default_workspace.id,
    user_id=owner.id,
    role=WorkspaceRole.owner,  # Updated: admin → owner
)
```

**Line 57 comment**:
```python
# OLD:
print("2. No users found. Initializing admin account and default workspace...")

# NEW:
print("2. No users found. Initializing superuser account and default workspace...")
```

**Line 93**:
```python
# OLD:
print(f"3. Admin user created: {admin_email}")

# NEW:
print(f"3. Superuser created: {admin_email}")
print(f"   (Workspace Owner role assigned)")
```

---

### **PHASE 3: Backend Tests Updates** (4-5 hours)

#### Step 3.1: Update Test Fixtures
**Time**: 1 hour
**Risk**: Medium

**File**: `/home/user/open-q/backend/tests/conftest.py`

**Line 113**:
```python
# OLD:
WorkspaceMember(
    workspace_id=ws.id, user_id=test_user.id, role=WorkspaceRole.admin
)

# NEW:
WorkspaceMember(
    workspace_id=ws.id, user_id=test_user.id, role=WorkspaceRole.owner
)
```

**Line 229**:
```python
# OLD:
WorkspaceMember(
    workspace_id=ws.id, user_id=owner.id, role=WorkspaceRole.admin
)

# NEW:
WorkspaceMember(
    workspace_id=ws.id, user_id=owner.id, role=WorkspaceRole.owner
)
```

---

#### Step 3.2: Update Integration Tests
**Time**: 2-3 hours
**Risk**: Medium

**Files to Update**:

1. **`/home/user/open-q/backend/tests/test_admin_workspaces.py`**
   - Line 23: `role=WorkspaceRole.admin` → `role=WorkspaceRole.owner`
   - Line 53: `assert data["members"][0]["role"] == "admin"` → `== "owner"`

2. **`/home/user/open-q/backend/tests/integration/test_admin_rbac.py`**
   - Line 49: `role=WorkspaceRole.admin` → `role=WorkspaceRole.owner`
   - Line 90 comment: Update "WorkspaceRole.admin" → "WorkspaceRole.owner"

**Global Search and Replace**:
```bash
cd /home/user/open-q/backend/tests

# Find all occurrences
grep -rn "WorkspaceRole\.admin" .

# After manual review, use sed for replacements:
find . -type f -name "*.py" -exec sed -i 's/WorkspaceRole\.admin/WorkspaceRole.owner/g' {} +

# Find string assertions
grep -rn '== "admin"' .
grep -rn '!= "admin"' .

# Update manually (context-dependent)
```

---

#### Step 3.3: Add New Test Cases
**Time**: 1 hour
**Risk**: Low

Create `/home/user/open-q/backend/tests/integration/test_role_migration.py`:

```python
"""Tests for workspace role migration."""

import pytest
from sqlalchemy import select, text
from app.models import WorkspaceMember, WorkspaceRole


@pytest.mark.asyncio
async def test_owner_role_exists(db_session):
    """Test that 'owner' role is valid and can be used."""
    # This would fail if migration didn't add 'owner' to enum
    from app.models import User, Workspace

    user = User(email="test@example.com", hashed_password="hash")
    db_session.add(user)

    workspace = Workspace(title="Test", slug="test")
    db_session.add(workspace)
    await db_session.flush()

    member = WorkspaceMember(
        workspace_id=workspace.id,
        user_id=user.id,
        role=WorkspaceRole.owner
    )
    db_session.add(member)
    await db_session.commit()

    # Verify
    result = await db_session.execute(
        select(WorkspaceMember).where(WorkspaceMember.user_id == user.id)
    )
    saved_member = result.scalar_one()
    assert saved_member.role == WorkspaceRole.owner


@pytest.mark.asyncio
async def test_no_admin_role_exists(db_session):
    """Test that 'admin' role no longer exists in database."""
    # Query for any 'admin' roles
    result = await db_session.execute(
        text("SELECT COUNT(*) FROM workspace_members WHERE role = 'admin'")
    )
    admin_count = result.scalar()

    assert admin_count == 0, f"Found {admin_count} 'admin' roles - migration incomplete!"


@pytest.mark.asyncio
async def test_role_map_uses_owner(db_session):
    """Test that ROLE_MAP correctly maps owner to owner."""
    from app.dependencies import ROLE_MAP
    from app.models import StudyRole

    assert WorkspaceRole.owner in ROLE_MAP
    assert ROLE_MAP[WorkspaceRole.owner] == StudyRole.owner


@pytest.mark.asyncio
async def test_admin_enum_value_removed():
    """Test that WorkspaceRole.admin no longer exists."""
    with pytest.raises(AttributeError):
        _ = WorkspaceRole.admin  # Should raise AttributeError
```

---

### **PHASE 4: Frontend Updates** (3-4 hours)

#### Step 4.1: Regenerate OpenAPI Client
**Time**: 30 minutes
**Risk**: Low

```bash
cd /home/user/open-q/frontend

# Check if orval configuration exists
cat orval.config.js  # or orval.config.ts

# Regenerate API client from backend OpenAPI spec
npm run generate:api

# Or if using orval directly:
npx orval --config orval.config.js
```

**Expected Changes**:
- `/home/user/open-q/frontend/src/api/model/workspaceRole.ts:15`
  - `admin: 'admin'` → `owner: 'owner'`
- `/home/user/open-q/frontend/src/api/generated.ts`
  - Type definitions updated
- `/home/user/open-q/frontend/openapi.json`
  - Enum values updated

---

#### Step 4.2: Update Frontend Components (if needed)
**Time**: 1-2 hours
**Risk**: Low

**Search for Hardcoded References**:
```bash
cd /home/user/open-q/frontend

# Search for hardcoded "admin" strings
grep -rn '"admin"' src/
grep -rn "'admin'" src/

# Search for WorkspaceRole.admin (if any manual usage)
grep -rn "WorkspaceRole.admin" src/
```

**Expected**: Most references should be auto-updated by type regeneration

**Manual Updates Needed (if any)**:
- Update any UI labels: "Admin" → "Owner"
- Update any role descriptions
- Update test mocks

---

#### Step 4.3: Update E2E Tests
**Time**: 1-2 hours
**Risk**: Medium

**Files to Check**:
- `/home/user/open-q/frontend/e2e/admin-flow.spec.ts`
- `/home/user/open-q/frontend/e2e/fixtures/admin-mocks.ts`
- `/home/user/open-q/frontend/e2e/user-management.spec.ts`

**Update Mock Data**:
```typescript
// OLD:
const mockWorkspaceMember = {
  user_id: 1,
  role: 'admin',
  joined_at: '2024-01-01T00:00:00Z'
};

// NEW:
const mockWorkspaceMember = {
  user_id: 1,
  role: 'owner',
  joined_at: '2024-01-01T00:00:00Z'
};
```

**Run E2E Tests**:
```bash
npm run test:e2e
```

---

### **PHASE 5: Documentation Updates** (2-3 hours)

#### Step 5.1: Update User-Facing Documentation
**Time**: 1 hour
**Risk**: Low

**File**: `/home/user/open-q/docs/guides/admin-management.md`

**Line 3-24**: Update to clarify workspace owner vs system superuser:
```markdown
# Admin & Team Management

This guide explains how to manage accounts, research teams, and study permissions in Open-Q.

⚠️ **Important Terminology Update (2026-01-15)**:
- **Workspace Owner** (formerly "Admin"): Full control within a workspace
- **Superuser**: System-level administrator with global access

---

## 👤 User Management

User accounts are managed by **Superusers**. A superuser can list all system users and create new accounts.

### Bootstrapping the First Superuser

If your system is fresh, use the CLI to create your first superuser:

```bash
cd backend
python scripts/create_user.py
```

Follow the prompts to enter an email, password, and toggle the **Superuser** status to `y`. This user will be added as the **Owner** of the default workspace.

[... rest of documentation ...]

## 👥 Managing Study Teams

Study owners can invite other researchers to collaborate on their work.

[... update all references to "admin" → "owner" ...]
```

**Update Table** (Line 52-61):
```markdown
| Feature                            | Owner | Editor | Viewer |
| :--------------------------------- | :---: | :----: | :----: |
| View Configuration                 |  ✅   |   ✅   |   ✅   |
| Update Meta/Text (Active/Paused)   |  ✅   |   ✅   |   ❌   |
| Update Grid/Structure (Draft Only) |  ✅   |   ✅   |   ❌   |
| Export Study Data                  |  ✅   |   ✅   |   ✅   |
| Change Study State                 |  ✅   |   ✅   |   ❌   |
| Manage Collaborators               |  ✅   |   ❌   |   ❌   |
| Delete Study                       |  ✅   |   ❌   |   ❌   |

**Note**: Workspace Owners automatically have Owner-level access to all studies in their workspace.
```

---

#### Step 5.2: Create Migration Guide
**Time**: 1 hour
**Risk**: Low

Create `/home/user/open-q/docs/guides/migrations/workspace-role-rename.md`:

```markdown
# Migration Guide: Workspace Admin → Owner Role Rename

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
- UI labels updated: "Admin" → "Owner"
- Type definitions regenerated

---

## Impact on Users

### Who is Affected?
- Users with workspace admin role (now called "owner")
- API clients that hardcode role values
- Custom scripts querying the database

### What Users Need to Do
1. **No action required** for web interface users
2. **API clients**: Update hardcoded `"admin"` strings to `"owner"`
3. **Database queries**: Update `WHERE role = 'admin'` to `WHERE role = 'owner'`

---

## Migration Timeline

| Phase | Date | Action |
|-------|------|--------|
| Phase 1 | 2026-01-15 | Database migration (add 'owner' enum value) |
| Phase 2 | 2026-01-15 | Data migration (admin → owner) |
| Phase 3 | 2026-01-15 | Code deployment (backend + frontend) |
| Phase 4 | 2026-01-22 | Cleanup (remove 'admin' enum value) - OPTIONAL |

---

## Rollback Procedure

If issues occur, rollback is possible within 7 days:

```bash
# 1. Rollback code deployment
git revert <commit-hash>

# 2. Rollback database migration
cd backend
alembic downgrade -1

# 3. Restart services
systemctl restart openq-backend
```

After 7 days, rollback becomes more complex due to new data created with 'owner' role.

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
if (member.role === 'admin') {
    // ...
}

// NEW:
if (member.role === 'owner') {
    // ...
}
```

### Database Queries

**SQL**:
```sql
-- OLD:
SELECT * FROM workspace_members WHERE role = 'admin';

-- NEW:
SELECT * FROM workspace_members WHERE role = 'owner';
```

---

## FAQ

### Q: Will my existing admin permissions change?
**A**: No. The role name changed, but permissions remain identical.

### Q: Do I need to re-login?
**A**: No. Your session remains valid; roles are fetched from the database on each request.

### Q: What about historical data?
**A**: All historical `admin` roles have been migrated to `owner`. Analytics queries need updating.

### Q: Can I still use the term "admin"?
**A**: The UI and documentation use "Owner" for workspace-level control. "Admin" now refers exclusively to system-level superusers.

---

## Support

For issues or questions, please:
1. Check the [Admin Management Guide](../admin-management.md)
2. Review [GitHub Issues](https://github.com/open-q/open-q/issues)
3. Contact support@openq.dev
```

---

#### Step 5.3: Update README and Other Docs
**Time**: 30 minutes
**Risk**: Low

**Files to Update**:
1. `/home/user/open-q/backend/README.md`
2. `/home/user/open-q/README.md`
3. `/home/user/open-q/docs/guides/deployment.md`

**Search and Update**:
```bash
# Find all markdown files mentioning admin
cd /home/user/open-q
grep -rn "admin" docs/ --include="*.md"

# Review each occurrence and update if referring to workspace role
```

---

### **PHASE 6: Testing & Validation** (6-8 hours)

#### Step 6.1: Unit Tests
**Time**: 1 hour
**Risk**: Low

```bash
cd /home/user/open-q/backend

# Run unit tests
pytest tests/unit/ -v

# Check coverage
pytest tests/unit/ --cov=app --cov-report=html
```

**Expected**: All tests pass

---

#### Step 6.2: Integration Tests
**Time**: 2 hours
**Risk**: Medium

```bash
# Run integration tests
pytest tests/integration/ -v

# Specific RBAC tests
pytest tests/integration/test_rbac_strict.py -v
pytest tests/integration/test_admin_rbac.py -v
```

**Watch For**:
- Permission check failures
- Role mapping issues
- Database constraint violations

---

#### Step 6.3: Database Migration Tests
**Time**: 2 hours
**Risk**: HIGH

**Test on SQLite (Development)**:
```bash
# 1. Backup database
cp q_method.db q_method.db.backup

# 2. Pre-migration validation
python scripts/validate_migration.py --pre

# 3. Run migration
alembic upgrade head

# 4. Post-migration validation
python scripts/validate_migration.py --post

# 5. Test rollback
alembic downgrade -1
python scripts/validate_migration.py --pre  # Should show 'admin' again

# 6. Re-apply migration
alembic upgrade head
```

**Test on PostgreSQL (Staging)**:
```bash
# Same steps as above, but on PostgreSQL staging environment

# Additional PostgreSQL-specific checks:
psql $DATABASE_URL -c "SELECT enumlabel FROM pg_enum WHERE enumtypid = 'workspacerole'::regtype;"
# Should show: owner, researcher, viewer
```

---

#### Step 6.4: End-to-End Tests
**Time**: 1-2 hours
**Risk**: Medium

```bash
cd /home/user/open-q/frontend

# Run E2E tests
npm run test:e2e

# Run specific admin flow tests
npm run test:e2e -- admin-flow.spec.ts
```

---

#### Step 6.5: Manual Testing Checklist
**Time**: 2-3 hours
**Risk**: Medium

**Critical User Flows**:

**1. Workspace Creation**:
- [ ] Create new workspace
- [ ] Verify creator assigned "Owner" role
- [ ] Check role displays correctly in UI
- [ ] Verify permissions work (can create studies)

**2. Study Creation**:
- [ ] Create study as workspace owner
- [ ] Verify can access study management
- [ ] Verify can edit study
- [ ] Verify can manage team

**3. Role Display**:
- [ ] Check workspace members list shows "Owner"
- [ ] Check study collaborators list
- [ ] Verify role badges display correctly
- [ ] Check tooltips and descriptions

**4. Permissions**:
- [ ] Owner can create studies ✓
- [ ] Owner can delete studies ✓
- [ ] Owner can manage team ✓
- [ ] Researcher can create studies ✓
- [ ] Researcher cannot manage team ✓
- [ ] Viewer cannot create studies ✓

**5. API Responses**:
- [ ] GET /api/admin/workspaces/ returns role: "owner"
- [ ] GET /api/admin/studies/ respects owner permissions
- [ ] POST /api/admin/studies/ works for owner
- [ ] Role serialization correct in all endpoints

**6. Error Handling**:
- [ ] Proper error messages for insufficient permissions
- [ ] No references to "admin" role in error messages

---

## 🚀 DEPLOYMENT STRATEGY

### **Zero-Downtime Deployment (Recommended)**

#### **Week 1: Preparation & Development**

**Monday-Tuesday**: Infrastructure Setup
- Set up Alembic
- Create migration scripts
- Create validation scripts
- Create backup scripts
- Code review

**Wednesday-Thursday**: Code Changes
- Update enum definition
- Update all router files
- Update tests
- Run test suite locally

**Friday**: Documentation
- Update user-facing docs
- Create migration guide
- Update README

#### **Week 2: Staging Deployment & Testing**

**Monday**: Staging Deployment Phase 1
```bash
# 1. Backup staging database
./scripts/backup_database.sh

# 2. Deploy backend with migration 001 (add 'owner' enum)
git checkout feature/workspace-role-rename
cd backend
alembic upgrade +1

# 3. Verify enum added
./scripts/validate_migration.py --pre

# 4. Deploy backend code that accepts BOTH 'admin' and 'owner'
# (temporarily add compatibility layer if needed)
git deploy staging backend-phase1
```

**Tuesday**: Staging Data Migration
```bash
# 1. Run data migration
alembic upgrade +1

# 2. Verify migration
./scripts/validate_migration.py --post

# 3. Monitor logs
tail -f /var/log/openq/backend.log
```

**Wednesday**: Frontend Staging Deployment
```bash
# 1. Regenerate API client
cd frontend
npm run generate:api

# 2. Build and deploy
npm run build
git deploy staging frontend

# 3. Test in staging
npm run test:e2e:staging
```

**Thursday-Friday**: QA Testing
- Run full test suite
- Manual testing by QA team
- Performance testing
- Load testing (if applicable)

#### **Week 3: Production Deployment**

**Monday (LOW TRAFFIC TIME)**: Production Phase 1
```bash
# 1. Announce maintenance window (if needed)
# 2. Backup production database
./scripts/backup_database.sh --production

# 3. Deploy migration 001
alembic upgrade +1

# 4. Verify
./scripts/validate_migration.py --pre
```

**Tuesday-Wednesday**: Monitor & Validate
- Monitor error rates
- Check user reports
- Verify no issues

**Thursday (LOW TRAFFIC TIME)**: Production Phase 2
```bash
# 1. Run data migration
alembic upgrade +1

# 2. Verify
./scripts/validate_migration.py --post

# 3. Deploy updated backend code
git deploy production backend

# 4. Monitor logs
```

**Friday**: Frontend Production Deployment
```bash
# 1. Deploy frontend
git deploy production frontend

# 2. Verify
curl -I https://openq.example.com

# 3. Monitor
```

#### **Week 4: Cleanup & Final Validation**

**Monday-Friday**:
- Monitor system stability
- Collect user feedback
- Update analytics queries
- Document lessons learned
- (OPTIONAL) Deploy migration 003 to remove 'admin' enum value

---

### **Rollback Decision Tree**

```
Issue Detected?
├─ YES → What phase?
│   ├─ Phase 1 (enum added) → Safe to rollback
│   │   └─ Action: alembic downgrade -1, redeploy old code
│   ├─ Phase 2 (data migrated) → Rollback possible
│   │   └─ Action: alembic downgrade -1, verify data
│   ├─ Phase 3 (frontend deployed) → Rollback complex
│   │   └─ Action: Rollback frontend + backend, then data
│   └─ After 7 days → Rollback very difficult
│       └─ Action: Fix forward, don't rollback
└─ NO → Continue monitoring
```

---

## 📊 SUCCESS METRICS

### Technical Metrics
- [ ] All tests passing (unit, integration, E2E)
- [ ] Zero data loss (row count unchanged)
- [ ] API response times unchanged
- [ ] No 500 errors related to roles
- [ ] Database query performance unchanged

### User Experience Metrics
- [ ] No user-reported permission issues
- [ ] Role labels display correctly in UI
- [ ] No confusion between workspace owner and superuser
- [ ] Documentation is clear and accurate

### Operational Metrics
- [ ] Migration completed within maintenance window
- [ ] No need for emergency rollback
- [ ] Monitoring shows stable system
- [ ] No increase in support tickets

---

## 🔧 TROUBLESHOOTING

### Issue: Migration Fails with "enum value already exists"
**Cause**: Migration 001 ran twice, or manual enum value added
**Solution**:
```sql
-- Check existing enum values
SELECT enumlabel FROM pg_enum WHERE enumtypid = 'workspacerole'::regtype;

-- If 'owner' exists, skip migration 001
alembic stamp +1
```

### Issue: "role 'admin' does not exist in enum"
**Cause**: Code deployed before data migration
**Solution**:
```bash
# Rollback code deployment
git revert HEAD

# Run data migration
alembic upgrade head

# Redeploy code
git cherry-pick <original-commit>
```

### Issue: Workspace members show incorrect role in UI
**Cause**: Frontend types not regenerated
**Solution**:
```bash
cd frontend
npm run generate:api
npm run build
```

### Issue: Permission checks failing for workspace owners
**Cause**: ROLE_MAP not updated
**Solution**: Verify `/home/user/open-q/backend/app/dependencies.py:73` uses `WorkspaceRole.owner`

### Issue: Database connection pool errors
**Cause**: Cached enum definitions in connection pool
**Solution**:
```python
# In backend after migration
from app.database import engine
await engine.dispose()  # Force pool refresh
```

---

## 📝 FINAL CHECKLIST

### Pre-Deployment
- [ ] Alembic installed and configured
- [ ] All migration scripts created and tested
- [ ] Validation scripts created
- [ ] Backup scripts created
- [ ] All code changes completed
- [ ] All tests passing locally
- [ ] Documentation updated
- [ ] Code reviewed and approved
- [ ] Staging environment tested
- [ ] Rollback procedure tested

### Deployment Day
- [ ] Maintenance window scheduled (if needed)
- [ ] Team notified
- [ ] Database backup created
- [ ] Migration Phase 1 deployed (add enum)
- [ ] Validation run (pre-migration)
- [ ] Migration Phase 2 deployed (data migration)
- [ ] Validation run (post-migration)
- [ ] Backend code deployed
- [ ] Frontend deployed
- [ ] Smoke tests run
- [ ] Monitoring active

### Post-Deployment
- [ ] All tests passing in production
- [ ] No errors in logs
- [ ] User reports checked
- [ ] Analytics updated
- [ ] Documentation published
- [ ] Team debriefed
- [ ] Rollback no longer needed (after 7 days)

---

## 📚 APPENDIX

### A. Complete File Change List

**Backend Core** (13 files):
1. `/backend/app/models.py` - Enum definition
2. `/backend/app/dependencies.py` - ROLE_MAP
3. `/backend/app/routers/admin/workspaces.py` - Workspace creation
4. `/backend/app/routers/admin/studies.py` - Study permissions (4 locations)
5. `/backend/init_db.py` - Database initialization
6. `/backend/migrate_collaboration.py` - Legacy migration script

**Backend Tests** (15+ files):
7. `/backend/tests/conftest.py` - Test fixtures
8. `/backend/tests/test_admin_workspaces.py` - Workspace tests
9. `/backend/tests/integration/test_admin_rbac.py` - RBAC tests
10. `/backend/tests/integration/test_rbac_matrix.py` - Permission matrix
11. `/backend/tests/integration/test_admin_exports.py` - Export tests
12. [... all other test files with WorkspaceRole.admin references]

**Frontend** (Auto-generated + tests):
13. `/frontend/src/api/model/workspaceRole.ts` - Type definitions (auto-gen)
14. `/frontend/src/api/generated.ts` - API client (auto-gen)
15. `/frontend/openapi.json` - OpenAPI spec (auto-gen)
16. `/frontend/e2e/fixtures/admin-mocks.ts` - Test mocks
17. [... other E2E test files]

**Documentation** (5 files):
18. `/docs/guides/admin-management.md` - User guide
19. `/docs/guides/migrations/workspace-role-rename.md` - Migration guide (NEW)
20. `/docs/guides/deployment.md` - Deployment guide
21. `/backend/README.md` - Backend README
22. `/README.md` - Main README

**Migration Scripts** (NEW):
23. `/backend/alembic/versions/001_add_owner_workspace_role.py`
24. `/backend/alembic/versions/002_migrate_admin_to_owner.py`
25. `/backend/scripts/validate_migration.py`
26. `/backend/scripts/backup_database.py`

**Total**: ~27 files modified/created

---

### B. Database Schema Details

**Table**: `workspace_members`

```sql
CREATE TABLE workspace_members (
    workspace_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    role workspacerole NOT NULL DEFAULT 'viewer',  -- ENUM TYPE
    joined_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (workspace_id, user_id),
    FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Enum type (PostgreSQL)
CREATE TYPE workspacerole AS ENUM ('owner', 'researcher', 'viewer');
-- After migration, 'admin' removed
```

**Indexes**: Composite primary key creates implicit index

**Constraints**:
- Primary Key: (workspace_id, user_id) - prevents duplicate memberships
- Foreign Keys: CASCADE delete - if workspace or user deleted, membership deleted
- NOT NULL: role must always be set
- DEFAULT: role defaults to 'viewer' if not specified

---

### C. Git Commit Strategy

**Recommended Commits**:

```
Commit 1: [infra] Add Alembic migration infrastructure
- Add Alembic dependency
- Configure alembic.ini and env.py
- Create validation and backup scripts

Commit 2: [migration] Add workspace role migration scripts
- Migration 001: Add 'owner' to enum
- Migration 002: Migrate data admin → owner
- Update migrate_collaboration.py

Commit 3: [backend] Update WorkspaceRole enum to use 'owner'
- Update models.py enum definition
- Update ROLE_MAP in dependencies.py
- Update all router permission checks
- Update init_db.py

Commit 4: [tests] Update all tests for new workspace role
- Update conftest.py fixtures
- Update integration tests
- Update unit tests
- Add migration-specific tests

Commit 5: [frontend] Regenerate API client and update types
- Regenerate OpenAPI types
- Update E2E test mocks
- Update any hardcoded role references

Commit 6: [docs] Update documentation for role rename
- Update admin-management.md
- Add migration guide
- Update README files

Commit 7: [release] Workspace admin role renamed to owner
- Version bump
- CHANGELOG update
- Release notes
```

**Branch Strategy**:
```
main
 └─ feature/workspace-role-rename
     ├─ feat/alembic-setup
     ├─ feat/migration-scripts
     ├─ feat/backend-changes
     ├─ feat/test-updates
     ├─ feat/frontend-updates
     └─ feat/documentation
```

---

## ✅ CONCLUSION

This migration plan provides a **comprehensive**, **trap-aware**, and **robust** strategy for renaming the workspace-level `admin` role to `owner`.

**Key Takeaways**:
1. **10 Critical Traps Identified** - each with mitigation strategy
2. **Zero-Downtime Deployment** - using multi-phase migration
3. **Complete Validation** - pre/post migration checks
4. **Tested Rollback** - emergency recovery procedures
5. **Comprehensive Testing** - unit, integration, E2E, manual
6. **Full Documentation** - for users and developers

**Estimated Total Effort**: 24-32 hours

**Recommended Timeline**: 3-4 weeks from start to production

---

**Next Steps**:
1. Review this plan with the team
2. Set up staging environment
3. Begin Phase 0 (Alembic setup)
4. Test migration on development database
5. Proceed with implementation

**Questions or Concerns?** Review specific trap sections for detailed mitigation strategies.
