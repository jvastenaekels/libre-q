"""Check for orphaned or invalid participant records."""

import asyncio
from sqlalchemy import select, text
from app.database import SessionLocal
from app.models import Participant


async def check_participants():
    async with SessionLocal() as db:
        # Check all participants
        participants_result = await db.execute(select(Participant))
        participants = participants_result.scalars().all()
        print(f"Total Participants: {len(participants)}")

        # Check for participants with NULL study_id
        null_study_result = await db.execute(
            text("SELECT COUNT(*) FROM participants WHERE study_id IS NULL")
        )
        null_count = null_study_result.scalar()
        if null_count > 0:
            print(f"⚠️  {null_count} participants have NULL study_id!")

        # Check for participants referencing non-existent studies
        orphaned_result = await db.execute(
            text("""
                SELECT p.id, p.session_token, p.study_id
                FROM participants p
                LEFT JOIN studies s ON p.study_id = s.id
                WHERE s.id IS NULL
            """)
        )
        orphaned = orphaned_result.fetchall()
        if orphaned:
            print(
                f"⚠️  {len(orphaned)} orphaned participants (referencing deleted studies):"
            )
            for p in orphaned:
                print(f"   Participant ID: {p[0]}, Session: {p[1]}, Study ID: {p[2]}")

        # List recent participants
        print("\nRecent participants:")
        for p in participants[-5:]:
            print(
                f"  - Session: {p.session_token[:8]}..., Study: {p.study_id}, Status: {p.status}"
            )


if __name__ == "__main__":
    asyncio.run(check_participants())
