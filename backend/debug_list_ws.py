import asyncio
from sqlalchemy import select
from app.database import SessionLocal
from app.models import Workspace


async def list_ws():
    async with SessionLocal() as db:
        res = await db.execute(select(Workspace.slug, Workspace.id))
        print(res.all())


if __name__ == "__main__":
    asyncio.run(list_ws())
