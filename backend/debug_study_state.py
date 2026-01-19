import asyncio
from sqlalchemy import select
from app.database import SessionLocal
from app.models import Study


async def check_state():
    async with SessionLocal() as session:
        result = await session.execute(
            select(Study.slug, Study.state).filter(Study.slug == "rewilding-nk")
        )
        study = result.first()
        if study:
            print(f"Study '{study[0]}' is in state: {study[1]}")
        else:
            print("Study not found")


if __name__ == "__main__":
    asyncio.run(check_state())
