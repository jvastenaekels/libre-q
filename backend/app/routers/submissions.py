"""API router for study submissions."""

import random
from typing import Any
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Path, Query, Request, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.limiter import limiter
from app.schemas import SubmissionInput
from app.services.study_service import StudyService
from app.services.recruitment_service import RecruitmentService
from app.utils.security import verify_password
from app.models import StudyState

router = APIRouter()


@router.post("/submit")
@limiter.limit("60/minute")
async def submit_study(
    data: SubmissionInput, request: Request, db: AsyncSession = Depends(get_db)
):
    """Submits or updates a study participation.

    Logic moved to StudyService for maintainability.
    """
    # Edge case: Handle None request.client
    client_ip = "unknown"
    if request.client and hasattr(request.client, "host"):
        client_ip = request.client.host or "unknown"

    user_agent = request.headers.get("user-agent")

    try:
        confirmation_code = await StudyService.process_submission(
            db, data, client_ip, user_agent
        )
        return {"status": "success", "confirmation_code": confirmation_code}
    except HTTPException:
        # Re-raise HTTP exceptions (they're already properly formatted)
        raise
    except Exception as e:
        # Edge case: Catch any unexpected errors and return proper HTTP error
        raise HTTPException(
            status_code=500,
            detail=f"Unexpected error during submission: {str(e)}",
        )


@router.get("/study/{slug}")
@limiter.limit("120/minute")
async def get_study(
    request: Request,
    slug: str = Path(..., pattern="^[a-z0-9-]+$", min_length=3, max_length=100),
    lang: str = Query("en", pattern="^[a-z]{2}(-[A-Z]{2})?$", max_length=5),
    session_token: UUID | None = Query(
        None, description="Participant session token for deterministic randomization"
    ),
    link_token: str | None = Query(None, description="Recruitment link token"),
    password: str | None = Query(None, description="Study access password"),
    db: AsyncSession = Depends(get_db),
):
    """Fetches study configuration for the frontend, including language resolution.

    If the study has randomize_statements=True and a session_token is provided,
    statements will be shuffled deterministically using the token as seed.
    This ensures the same participant always sees statements in the same order.
    """
    study = await StudyService.get_study_by_slug(db, slug)
    if not study:
        raise HTTPException(status_code=404, detail="Study not found")

    # 3. Recruitment Link Validation
    if link_token:
        link = await RecruitmentService.validate_link_token(db, study.id, link_token)
        if not link:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Invalid, expired, or full recruitment link",
            )
        # Record start (participant accessed the study layout)
        await RecruitmentService.record_start(db, link.id)

    # 4. Password Protection
    if study.access_password and not verify_password(
        password or "", study.access_password
    ):
        # Return only basic metadata if password is not provided or incorrect
        resolved_lang, translation = StudyService.resolve_translation(study, lang)
        return {
            "slug": study.slug,
            "title": translation.title if translation else study.slug,
            "description": translation.description if translation else "",
            "requires_password": True,
            "language": resolved_lang,
        }

    resolved_lang, translation = StudyService.resolve_translation(study, lang)

    # Transform to Frontend Format
    title = (
        translation.title
        if (translation and hasattr(translation, "title"))
        else study.slug
    )
    description = (
        translation.description
        if (translation and hasattr(translation, "description"))
        else ""
    )
    instructions = (
        translation.instructions
        if (translation and hasattr(translation, "instructions"))
        else ""
    )
    subtitle = (
        translation.subtitle
        if (translation and hasattr(translation, "subtitle"))
        else None
    )
    objective = (
        translation.objective
        if (translation and hasattr(translation, "objective"))
        else None
    )

    statements_data = []
    for s in study.statements:
        # Resolve statement translation
        s_trans = next(
            (t for t in s.translations if t.language_code == resolved_lang), None
        )
        if not s_trans:
            s_trans = next((t for t in s.translations if t.language_code == "en"), None)
        if not s_trans and s.translations:
            s_trans = s.translations[0]

        text = s_trans.text if s_trans else s.code
        statements_data.append({"id": s.id, "text": text, "code": s.code})

    # Q Methodology: Randomize statement order if configured
    # This prevents order effects from biasing participant responses
    random_seed_str = None
    if study.randomize_statements and session_token:
        # Use session token as deterministic seed
        random_seed_str = str(session_token)
        local_random = random.Random(random_seed_str)
        local_random.shuffle(statements_data)

    # Helper for safe attribute access
    def get_t_attr(attr: str, default: Any = None) -> Any:
        return getattr(translation, attr, default) if translation else default

    # Calculate effective state based on dates
    from datetime import datetime, timezone

    now = datetime.now(timezone.utc)
    effective_state = study.state.value

    # Only override if currently active (don't re-open a explicitly closed/archived study)
    if study.state == StudyState.active:
        if study.start_date and now < study.start_date:
            # Not yet started
            effective_state = "scheduled"  # Frontend might need to handle this, or map to 'paused'/'closed'
            # For now, let's treat as 'paused' which usually implies "not taking submissions"
            effective_state = StudyState.paused.value
        elif study.end_date and now > study.end_date:
            # Expired
            effective_state = StudyState.closed.value

    return {
        "slug": study.slug,
        "title": title,
        "subtitle": subtitle,
        "description": description,
        "objective": objective,
        "instructions": instructions,
        "presort_config": study.presort_config,
        "postsort_config": study.postsort_config,
        "grid_config": study.grid_config,
        "statements": statements_data,
        "consent": {
            "title": get_t_attr("consent_title"),
            "description": get_t_attr("consent_description"),
            "accept": get_t_attr("consent_accept"),
            "decline": get_t_attr("consent_decline"),
        },
        "available_languages": [t.language_code for t in study.translations],
        "language": resolved_lang,
        "default_language": study.default_language,
        "show_statement_codes": study.show_statement_codes,
        "randomize_statements": study.randomize_statements,
        "ui_labels": get_t_attr("ui_labels", {}) or {},
        "state": effective_state,
        "requires_password": False,
        "start_date": study.start_date,
        "end_date": study.end_date,
    }


@router.post("/study/{slug}/unlock")
async def unlock_study(
    password: str = Query(...),
    slug: str = Path(..., pattern="^[a-z0-9-]+$"),
    db: AsyncSession = Depends(get_db),
):
    """Validate study access password."""
    study = await StudyService.get_study_by_slug(db, slug)
    if not study:
        raise HTTPException(status_code=404, detail="Study not found")

    if not study.access_password:
        return {"status": "unlocked", "details": "No password required"}

    if verify_password(password, study.access_password):
        return {"status": "unlocked"}

    raise HTTPException(status_code=401, detail="Incorrect password")
