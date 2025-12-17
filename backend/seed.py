import asyncio
from sqlalchemy.exc import IntegrityError
from app.database import engine, Base, SessionLocal
from app.models import User, Study, StudyTranslation, Statement, StatementTranslation, StudyState

async def seed_db():
    print("--- Seeding Database ---")
    
    # Optional: Reset DB? 
    # For now, let's try to add. If it fails due to unique constraints, we know it's there.
    # To be clean, maybe we drop/create if user wants a clean slate.
    # Let's do a clean reset to ensure consistent state for the mock.
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
        await conn.run_sync(Base.metadata.create_all)
    
    async with SessionLocal() as session:
        # 1. Create Owner
        owner = User(email="admin@example.com", hashed_password="hashed_secret", is_active=True)
        session.add(owner)
        await session.commit()
        print("1. User created.")

        # 2. Create Study
        study = Study(
            slug="complex-study",
            owner_id=owner.id,
            state=StudyState.active,
            grid_config=[
                {"score": -4, "capacity": 2},
                {"score": -3, "capacity": 3},
                {"score": -2, "capacity": 4},
                {"score": -1, "capacity": 6},
                {"score": 0, "capacity": 10},
                {"score": 1, "capacity": 6},
                {"score": 2, "capacity": 4},
                {"score": 3, "capacity": 3},
                {"score": 4, "capacity": 2}
            ],
            presort_config={
                "age": {"type": "number", "label": "Age", "required": True, "min": 18, "max": 99},
                "gender": {"type": "select", "options": ["Male", "Female", "Non-binary", "Prefer not to say"], "label": "Gender", "required": True}
            },
            postsort_config={
                "extreme_columns": [-4, 4],
                "ask_missing": True,
                "ask_general_comment": True
            }
        )
        session.add(study)
        await session.commit()
        await session.refresh(study)
        print(f"2. Study created (ID: {study.id}).")

        # 3. Add Translations (En, Fr)
        t_en = StudyTranslation(
            study_id=study.id, 
            language_code="en", 
            title="Complex Study", 
            description="A detailed Q-Methodology study.", 
            instructions="<p>Please sort the cards.</p>"
        )
        t_fr = StudyTranslation(
            study_id=study.id, 
            language_code="fr", 
            title="Étude Complexe", 
            description="Une étude Q-Method détaillée.", 
            instructions="<p>Veuillez trier les cartes.</p>"
        )
        session.add_all([t_en, t_fr])
        
        # 4. Add Statements (40 statements to match grid capacity of 40)
        statements = []
        for i in range(1, 41):
            stmt = Statement(study_id=study.id, code=f"S{i}")
            statements.append(stmt)
        session.add_all(statements)
        await session.commit()
        
        # Translations for statements
        stmt_translations = []
        for stmt in statements:
            stmt_translations.append(StatementTranslation(
                statement_id=stmt.id, 
                language_code="en", 
                text=f"Statement {stmt.code} content."
            ))
            stmt_translations.append(StatementTranslation(
                statement_id=stmt.id, 
                language_code="fr", 
                text=f"Contenu de l'énoncé {stmt.code}."
            ))
        session.add_all(stmt_translations)
        await session.commit()
        
        print("3. Statements and translations added.")
        print("--- Seeding Complete ---")

if __name__ == "__main__":
    asyncio.run(seed_db())
