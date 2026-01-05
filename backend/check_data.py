"""Check workspace and study data."""

import asyncio
from sqlalchemy import select, text
from app.database import SessionLocal
from app.models import Workspace, WorkspaceMember, Study, StudyCollaborator


async def check_data():
    async with SessionLocal() as db:
        # Check workspaces
        workspaces_result = await db.execute(select(Workspace))
        workspaces = workspaces_result.scalars().all()
        print(f"Workspaces: {len(workspaces)}")
        for ws in workspaces:
            print(f"  - {ws.slug} (ID: {ws.id})")

        # Check workspace members
        members_result = await db.execute(select(WorkspaceMember))
        members = members_result.scalars().all()
        print(f"\nWorkspace Members: {len(members)}")

        # Check studies
        studies_result = await db.execute(select(Study))
        studies = studies_result.scalars().all()
        print(f"\nStudies: {len(studies)}")
        for study in studies:
            print(f"  - {study.slug} (workspace_id: {study.workspace_id})")

        # Check if studies have workspace_id
        null_workspace_result = await db.execute(
            text("SELECT COUNT(*) FROM studies WHERE workspace_id IS NULL")
        )
        null_count = null_workspace_result.scalar()
        if null_count > 0:
            print(f"\n⚠️  {null_count} studies have NULL workspace_id!")

        # Check study collaborators
        collabs_result = await db.execute(select(StudyCollaborator))
        collabs = collabs_result.scalars().all()
        print(f"\nStudy Collaborators: {len(collabs)}")


if __name__ == "__main__":
    asyncio.run(check_data())
