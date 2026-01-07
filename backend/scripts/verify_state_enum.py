import asyncio
import sys
import os

# Add parent dir to sys.path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.database import SessionLocal
from app.services.study_service import StudyService


async def main():
    async with SessionLocal() as db:
        study = await StudyService.get_study_by_slug(db, "example-study")
        if study:
            print(f"Study found: {study.slug}")
            print(f"State: {study.state}")
            print(f"State type: {type(study.state)}")
            try:
                print(f"State value: {study.state.value}")
            except Exception as e:
                print(f"Error accessing .value: {e}")

            # Verify start_date
            print(f"Start Date: {study.start_date}")
            if study.start_date:
                print(f"Start Date type: {type(study.start_date)}")
        else:
            print("Example Study not found")


if __name__ == "__main__":
    asyncio.run(main())
