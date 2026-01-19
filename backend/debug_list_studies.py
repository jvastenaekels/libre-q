import asyncio
from sqlalchemy import select
from app.database import SessionLocal
from app.models import Study


async def list_studies():
    async with SessionLocal() as session:
        result = await session.execute(select(Study.slug))
        slugs = result.scalars().all()
        print(f"Total studies slugs: {len(slugs)}")
        for slug in slugs:
            print(f"- {slug}")


if __name__ == "__main__":
    asyncio.run(list_studies())
