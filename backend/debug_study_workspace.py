import asyncio
from sqlalchemy import select
from app.database import SessionLocal
from app.models import Study, Workspace


async def debug_study():
    async with SessionLocal() as session:
        result = await session.execute(
            select(Study.slug, Study.workspace_id, Workspace.title, Workspace.slug)
            .join(Workspace)
            .filter(Study.slug == "rewilding-nk")
        )
        study_info = result.first()
        if study_info:
            print(f"Study 'rewilding-nk' belongs to Workspace ID: {study_info[1]}")
            print(f"Workspace Title: {study_info[2]}, Slug: {study_info[3]}")
        else:
            print("Study info not found (join failed?)")


if __name__ == "__main__":
    asyncio.run(debug_study())
