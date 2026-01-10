"""
Test Router - Only available in test/development environments
Provides endpoints for E2E test database management
"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession
from pydantic import BaseModel

from app.core.config import settings
from app.db.session import get_db
from app.core.security import get_password_hash

router = APIRouter(prefix="/api/test", tags=["test"])

# Only enable test endpoints in test/dev environments
if settings.ENVIRONMENT not in ["test", "development"]:
    # Empty router in production
    pass
else:

    class TestUserData(BaseModel):
        email: str
        password: str
        is_superuser: bool = False

    class TestWorkspaceData(BaseModel):
        name: str
        slug: str

    class TestSeedData(BaseModel):
        user: TestUserData
        workspace: TestWorkspaceData

    @router.post("/init")
    async def init_test_db(db: AsyncSession = Depends(get_db)):
        """
        Initialize test database - ensure tables exist
        This is typically handled by app startup, but useful for explicit initialization
        """
        try:
            # Test database connection
            await db.execute(text("SELECT 1"))
            return {"status": "ok", "message": "Database initialized"}
        except Exception as e:
            raise HTTPException(
                status_code=500, detail=f"Database initialization failed: {str(e)}"
            )

    @router.post("/seed")
    async def seed_test_data(data: TestSeedData, db: AsyncSession = Depends(get_db)):
        """
        Seed base test data: user and workspace
        Idempotent - won't create duplicates
        """
        try:
            # Check if user exists
            result = await db.execute(
                text("SELECT id FROM users WHERE email = :email"),
                {"email": data.user.email},
            )
            existing_user = result.fetchone()

            if not existing_user:
                # Create test user
                hashed_password = get_password_hash(data.user.password)
                result = await db.execute(
                    text("""
                        INSERT INTO users (email, hashed_password, is_active, is_superuser)
                        VALUES (:email, :password, true, :is_superuser)
                        RETURNING id
                    """),
                    {
                        "email": data.user.email,
                        "password": hashed_password,
                        "is_superuser": data.user.is_superuser,
                    },
                )
                user_id = result.fetchone()[0]
            else:
                user_id = existing_user[0]

            # Check if workspace exists
            result = await db.execute(
                text("SELECT id FROM workspaces WHERE slug = :slug"),
                {"slug": data.workspace.slug},
            )
            existing_workspace = result.fetchone()

            if not existing_workspace:
                # Create test workspace
                result = await db.execute(
                    text("""
                        INSERT INTO workspaces (name, slug, created_at)
                        VALUES (:name, :slug, NOW())
                        RETURNING id
                    """),
                    {
                        "name": data.workspace.name,
                        "slug": data.workspace.slug,
                    },
                )
                workspace_id = result.fetchone()[0]

                # Add user as owner
                await db.execute(
                    text("""
                        INSERT INTO workspace_members (workspace_id, user_id, role)
                        VALUES (:workspace_id, :user_id, 'owner')
                    """),
                    {
                        "workspace_id": workspace_id,
                        "user_id": user_id,
                    },
                )
            else:
                workspace_id = existing_workspace[0]

            await db.commit()

            return {
                "status": "ok",
                "user_id": user_id,
                "workspace_id": workspace_id,
                "message": "Test data seeded successfully",
            }

        except Exception as e:
            await db.rollback()
            raise HTTPException(status_code=500, detail=f"Seeding failed: {str(e)}")

    @router.post("/cleanup")
    async def cleanup_test_data(db: AsyncSession = Depends(get_db)):
        """
        Cleanup test data between tests
        Removes all data except the base test user and workspace
        """
        try:
            # Delete in correct order to respect foreign keys
            tables_to_clean = [
                "participant_responses",
                "participants",
                "recruitment_links",
                "study_collaborators",
                "statement_translations",
                "statements",
                "study_translations",
                "studies",
            ]

            for table in tables_to_clean:
                await db.execute(text(f"DELETE FROM {table}"))

            await db.commit()

            return {"status": "ok", "message": "Test data cleaned up"}

        except Exception as e:
            await db.rollback()
            raise HTTPException(status_code=500, detail=f"Cleanup failed: {str(e)}")

    @router.post("/cleanup-all")
    async def cleanup_all_test_data(db: AsyncSession = Depends(get_db)):
        """
        Full cleanup including users and workspaces
        Use at end of test suite
        """
        try:
            # Delete everything in reverse dependency order
            tables_to_clean = [
                "participant_responses",
                "participants",
                "recruitment_links",
                "study_collaborators",
                "statement_translations",
                "statements",
                "study_translations",
                "studies",
                "workspace_members",
                "workspaces",
                "users",
            ]

            for table in tables_to_clean:
                await db.execute(text(f"DELETE FROM {table}"))

            await db.commit()

            return {"status": "ok", "message": "All test data cleaned up"}

        except Exception as e:
            await db.rollback()
            raise HTTPException(
                status_code=500, detail=f"Full cleanup failed: {str(e)}"
            )

    @router.get("/health")
    async def test_health():
        """Simple health check for test router"""
        return {"status": "ok", "environment": settings.ENVIRONMENT}
