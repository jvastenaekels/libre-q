from fastapi import APIRouter, Depends, HTTPException, Request
from datetime import datetime
from sqlalchemy.orm import Session, selectinload
from sqlalchemy import select
from app.database import get_db
from app.models import Study, Participant, QSortEntry, ParticipantStatus, Statement
from app.schemas import SubmissionInput

router = APIRouter()

@router.post("/submit")
async def submit_study(data: SubmissionInput, request: Request, db: Session = Depends(get_db)):
    # Metadata
    ip_address = request.client.host if request.client else "unknown"
    # Confirmation code logic moved up (or re-generated if new, but session token is consistent)
    confirmation_code = str(data.session_token)[:8].upper()

    # 1. Find Study
    study = await db.execute(select(Study).where(Study.slug == data.study_slug))
    study = study.scalar_one_or_none()
    if not study:
        raise HTTPException(status_code=404, detail="Study not found")

    # 2. Find or Create Participant
    # We trust the session_token from the client for now, or ensure uniqueness
    participant = await db.execute(select(Participant).where(Participant.session_token == data.session_token))
    participant = participant.scalar_one_or_none()

    if not participant:
        # Create participant
        participant = Participant(
            study_id=study.id,
            session_token=data.session_token,
            language_used=data.language_used,
            presort_answers=data.presort_answers,
            postsort_answers=data.postsort_answers,
            status=data.status, # Use provided status or default
            confirmation_code=confirmation_code,
            ip_address=ip_address,
            submitted_at=datetime.now()
        )
        db.add(participant)
        await db.commit()
        await db.refresh(participant)
    else:
        # Update existing participant
        # Prevent re-submission if already completed and we are trying to set completed again?
        # Actually logic:
        # If DB is completed -> Return early (prevent overwrite)
        # UNLESS we want to support editing? Requirement says "Verify and propose ways to handle this". 
        # Current logic was: if completed, return code.
        # User request today: "save as incomplete".
        
        if participant.status == ParticipantStatus.completed:
             # If already completed, do not allow switching back to started or editing.
             # Return success with code.
            confirmation_code = str(participant.session_token)[:8].upper()
            return {"status": "success", "confirmation_code": confirmation_code}

        # We must await refresh calls if we access lazy loaded attrs, but here we just set values.
        participant.language_used = data.language_used
        participant.presort_answers = data.presort_answers
        participant.postsort_answers = data.postsort_answers
        participant.status = data.status # Update status (e.g. started -> completed)
        participant.confirmation_code = confirmation_code
        participant.ip_address = ip_address
        participant.submitted_at = datetime.now()
        
        # Explicit flush to ensure updates are ready before managing children
        await db.flush()
        
        # Delete existing Q-Sorts to replace them
        stmt = select(Participant).where(Participant.id == participant.id).options(selectinload(Participant.qsort_entries))
        p_with_entries = await db.execute(stmt)
        participant = p_with_entries.scalar_one()

        if participant.qsort_entries:
            for entry in participant.qsort_entries:
                await db.delete(entry)
        await db.commit()

    # 3. Save Q-Sort Entries
    # Verify statement IDs belong to this study (optional but good for integrity)
    # For speed, we just insert.
    new_entries = []
    for entry in data.qsort:
        new_entries.append(QSortEntry(
            participant_id=participant.id,
            statement_id=entry.statement_id,
            grid_score=entry.grid_score,
            card_comment=entry.card_comment
        ))
    
    db.add_all(new_entries)
    await db.commit()

    # Generate a user-friendly confirmation code from the session token
    # Taking the first 8 characters is usually sufficient for short-term uniqueness display
    confirmation_code = str(participant.session_token)[:8].upper()

    return {"status": "success", "confirmation_code": confirmation_code}

@router.get("/study/{slug}")
async def get_study(slug: str, lang: str = "en", db: Session = Depends(get_db)):
    # Fetch study with all necessary relations
    # We need: grid_config, presort_config, postsort_config, statements
    # AND translations for the current language (handling this in backend or sending all?)
    # Sending all translations is easier for now, frontend selects.
    
    # Eager load relationships
    stmt = select(Study).where(Study.slug == slug) \
        .options(selectinload(Study.translations)) \
        .options(selectinload(Study.statements).selectinload(Statement.translations))
        
    study = await db.execute(stmt)
    study = study.scalar_one_or_none()

    if not study:
         # Fallback to defaults or 404
         raise HTTPException(status_code=404, detail="Study not found")

    # Transform to Frontend Config Format
    # Logic:
    # 1. Determine language (default 'en' for now, or accept query param)
    # 2. Extract title/desc/instr from translations
    # 3. Extract statements
    
    # For now, let's return a structured object the frontend can use directly.
    # We default to English for the main fields if found, else first available.
    
    translation = next((t for t in study.translations if t.language_code == lang), None)
    if not translation and study.translations:
        # Fallback to First Available if requested lang not found
        translation = study.translations[0]
        # logic could be improved to fallback to EN explicitly if available
        
    title = translation.title if translation else study.slug
    description = translation.description if translation else ""
    instructions = translation.instructions if translation else ""
    
    statements_data = []
    for s in study.statements:
        s_trans = next((t for t in s.translations if t.language_code == lang), None)
        if not s_trans and s.translations:
             # Fallback
             s_trans = s.translations[0]
             
        text = s_trans.text if s_trans else s.code
        statements_data.append({"id": s.id, "text": text})


    # Transform grid_config from dict {"-4": 2} to list [{"score": -4, "capacity": 2}]
    grid_config_list = []
    if study.grid_config:
        # Check if it's already a list (legacy/safety) or dict
        if isinstance(study.grid_config, list):
            grid_config_list = study.grid_config
        elif isinstance(study.grid_config, dict):
             # Depending on seed structure. seed.py used simple dict keys "-4".
             # We assume keys are scores (str) and values are capacity (int).
             for score_str, capacity in study.grid_config.items():
                 try:
                     score = int(score_str)
                     grid_config_list.append({"score": score, "capacity": capacity})
                 except ValueError:
                     pass # Ignore non-integer keys if any
             # Sort by score
             grid_config_list.sort(key=lambda x: x["score"])

    return {
        "slug": study.slug,
        "title": title,
        "description": description,
        "instructions": instructions,
        "presort_config": study.presort_config,
        "grid_config": grid_config_list, 
        "postsort_config": study.postsort_config,
        "statements": statements_data
    }
