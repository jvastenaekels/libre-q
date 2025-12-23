# Open-Q - Open-source platform for conducting Q-methodology research
# Copyright (C) 2025 Julien Vastenekels
# Licensed under the GNU Affero General Public License v3.0 or later.

import asyncio
import json
import sys
import os
from sqlalchemy import select
from app.database import engine, SessionLocal
from app.models import User, Study, StudyTranslation, Statement, StatementTranslation, StudyState

async def seed_study(json_path: str):
    if not os.path.exists(json_path):
        print(f"Error: File {json_path} not found.")
        return

    with open(json_path, 'r', encoding='utf-8') as f:
        data = json.load(f)

    async with SessionLocal() as session:
        # 1. Ensure owner exists
        result = await session.execute(select(User).filter(User.email == "admin@example.com"))
        owner = result.scalars().first()
        if not owner:
            owner = User(email="admin@example.com", hashed_password="hashed_secret", is_active=True)
            session.add(owner)
            await session.commit()
            await session.refresh(owner)
            print(f"Created owner: {owner.email}")

        # 2. Check if study already exists
        slug = data["slug"]
        result = await session.execute(select(Study).filter(Study.slug == slug))
        existing_study = result.scalars().first()
        if existing_study:
            print(f"Study '{slug}' already exists. Skipping.")
            return

        # 3. Create Study
        study = Study(
            slug=slug,
            owner_id=owner.id,
            state=StudyState.active,
            default_language=data.get("default_language", "en"),
            grid_config=data["grid_config"],
            presort_config=data["presort_config"],
            postsort_config=data["postsort_config"]
        )
        session.add(study)
        await session.flush() # Get study ID

        # 4. Add Translations
        for lang, t_data in data["translations"].items():
            translation = StudyTranslation(
                study_id=study.id,
                language_code=lang,
                title=t_data["title"],
                subtitle=t_data.get("subtitle"),
                description=t_data.get("description", ""),
                objective=t_data.get("objective"),
                instructions=t_data["instructions"],
                consent_title=t_data["consent_title"],
                consent_description=t_data.get("consent_description", ""),
                consent_accept=t_data.get("consent_accept", "I agree"),
                consent_decline=t_data.get("consent_decline", "I do not agree"),
                ui_labels=t_data.get("ui_labels", {})
            )
            session.add(translation)

        # 5. Add Statements and their translations
        for s_data in data["statements"]:
            stmt = Statement(study_id=study.id, code=s_data["code"])
            session.add(stmt)
            await session.flush() # Get statement ID
            
            for lang, text in s_data["translations"].items():
                s_trans = StatementTranslation(
                    statement_id=stmt.id,
                    language_code=lang,
                    text=text
                )
                session.add(s_trans)

        await session.commit()
        print(f"Successfully seeded study: {slug}")

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python seed.py <path_to_study_json>")
        sys.exit(1)
    
    asyncio.run(seed_study(sys.argv[1]))
