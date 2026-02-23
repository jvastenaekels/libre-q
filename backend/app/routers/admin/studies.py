"""Admin routes for study CRUD management.

Participant and import/export routes live in dedicated sub-routers
that are included into this router at the bottom of the file.
"""

from typing import cast
import logging
from fastapi import APIRouter, Depends, HTTPException, Request, status
from fastapi.encoders import jsonable_encoder
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import selectinload
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.limiter import limiter
from app.dependencies import (
    check_study_permission,
    get_current_user,
    get_current_workspace,
)
from app.models import (
    Participant,
    Study,
    StudyRole,
    StudyState,
    User,
    Workspace,
    WorkspaceMember,
    WorkspaceRole,
)
from sqlalchemy import func
from app.schemas import (
    StudyCreate,
    StudyRead,
    StudyUpdate,
)
from app.schemas.common import PaginatedResponse

router = APIRouter()
logger = logging.getLogger(__name__)


@router.post("", response_model=StudyRead, status_code=status.HTTP_201_CREATED)
@limiter.limit("30/minute")
async def create_study(
    request: Request,
    study: StudyCreate,
    current_user: User = Depends(get_current_user),
    workspace_ctx: tuple[Workspace, WorkspaceMember] = Depends(get_current_workspace),
    db: AsyncSession = Depends(get_db),
) -> Study:
    """Create a new study in the active workspace."""
    workspace, member = workspace_ctx

    # Check permission (Researcher or Admin)
    if member.role not in [
        WorkspaceRole.owner,
        WorkspaceRole.researcher,
        WorkspaceRole.owner,
    ]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You need to be an Admin or Researcher in this Workspace to create a study.",
        )

    # 1. Check slug uniqueness
    query = select(Study).where(Study.slug == study.slug)
    result = await db.execute(query)
    if result.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Study with this slug already exists",
        )

    try:
        # 2. Create Study
        db_study = Study(
            slug=study.slug,
            workspace_id=workspace.id,
            state=StudyState.draft,  # Always draft initially
            grid_config=[col.model_dump() for col in study.grid_config],
            presort_config=study.presort_config,
            postsort_config=study.postsort_config,
            default_language=study.default_language
            or (study.translations[0].language_code if study.translations else "en"),
            show_statement_codes=study.show_statement_codes,
            branding=study.branding.model_dump() if study.branding else None,
            start_date=study.start_date,
            end_date=study.end_date,
        )
        db.add(db_study)
        await db.flush()  # to get ID

        from app.models import Statement, StatementTranslation, StudyTranslation
        from app.services.study_service import (
            DEFAULT_PROCESS_STEPS,
            DEFAULT_TRANSLATION_CONTENT,
        )

        logger.error(
            f"DEBUG: creating study with translations: {len(study.translations)}"
        )
        for t_in in study.translations:
            t_data = t_in.model_dump()
            lang = t_data.get("language_code", "en")
            defaults = DEFAULT_TRANSLATION_CONTENT.get(
                lang, DEFAULT_TRANSLATION_CONTENT["en"]
            )

            # Inject default process steps if not provided
            if not t_data.get("process_steps"):
                t_data["process_steps"] = DEFAULT_PROCESS_STEPS.get(
                    lang, DEFAULT_PROCESS_STEPS["en"]
                )

            # Inject other defaults if empty
            for field, value in defaults.items():
                if not t_data.get(field):
                    t_data[field] = value

            db.add(StudyTranslation(study_id=db_study.id, **t_data))

        # 3. Add Statements and their translations
        for idx, s_in in enumerate(study.statements):
            stmt = Statement(study_id=db_study.id, code=s_in.code, display_order=idx)
            db.add(stmt)
            await db.flush()  # get stmt ID
            for st_in in s_in.translations:
                db.add(
                    StatementTranslation(
                        statement_id=stmt.id,
                        language_code=st_in.language_code,
                        text=st_in.text,
                    )
                )

        await db.commit()
    except IntegrityError as e:
        await db.rollback()
        logger.error(
            f"Integrity check failed during study creation: {e}", exc_info=True
        )
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Database integrity check failed: {str(e)}",
        )
    except Exception as e:
        await db.rollback()
        logger.error(f"Unexpected error during study creation: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An unexpected error occurred while creating the study",
        )

    # Re-fetch with relationships for Response Serialization
    from app.services.study_service import StudyService

    updated_study = await StudyService.get_study_by_slug(db, db_study.slug)
    if updated_study is None:
        raise HTTPException(status_code=404, detail="Study not found after creation")
    return updated_study


@router.get("", response_model=PaginatedResponse[StudyRead])
async def list_studies(
    workspace_ctx: tuple[Workspace, WorkspaceMember] = Depends(get_current_workspace),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    limit: int = 50,
    offset: int = 0,
):
    """List studies in the active workspace with pagination."""
    workspace, _ = workspace_ctx

    base = select(Study).where(Study.workspace_id == workspace.id)

    # Total count
    count_result = await db.execute(select(func.count()).select_from(base.subquery()))
    total = count_result.scalar() or 0

    # Paginated items
    query = (
        base.options(selectinload(Study.workspace))
        .order_by(Study.created_at.desc())
        .limit(limit)
        .offset(offset)
    )
    result = await db.execute(query)
    items = list(result.scalars().all())

    return PaginatedResponse(items=items, total=total, limit=limit, offset=offset)


@router.get("/{slug}", response_model=StudyRead)
async def get_study(
    study: Study = Depends(check_study_permission(StudyRole.viewer)),
    db: AsyncSession = Depends(get_db),
) -> Study:
    """Get study details."""
    from app.models import Statement

    stmt = (
        select(Study)
        .where(Study.id == study.id)
        .options(
            selectinload(Study.translations),
            selectinload(Study.statements).selectinload(Statement.translations),
            selectinload(Study.participants),
        )
    )
    res = await db.execute(stmt)
    study_loaded = res.scalar_one()
    return study_loaded


@router.patch("/{slug}", response_model=StudyRead)
@limiter.limit("30/minute")
async def update_study(
    request: Request,
    study_update: StudyUpdate,
    study: Study = Depends(check_study_permission(StudyRole.editor)),
    db: AsyncSession = Depends(get_db),
) -> Study:
    """Update study configuration."""
    # Ensure relationships are loaded for logic below
    from app.models import Statement, StudyTranslation

    stmt = (
        select(Study)
        .where(Study.id == study.id)
        .options(
            selectinload(Study.translations),
            selectinload(Study.statements).selectinload(Statement.translations),
            selectinload(Study.participants),
        )
    )
    res = await db.execute(stmt)
    study = res.scalar_one_or_none()  # type: ignore[assignment]

    if study is None:
        raise HTTPException(status_code=404, detail="Study not found")

    # Pre-fetch all statement translations to ensure they are in identity map
    for s in study.statements:
        _ = s.translations

    # Relax structural checks in update_study if study is in DRAFT
    if study_update.grid_config is not None:
        new_grid = [col.model_dump() for col in study_update.grid_config]
        current_grid = study.grid_config

        if new_grid != current_grid:
            stmt_part = select(func.count(Participant.id)).where(
                Participant.study_id == study.id, Participant.is_test_run.is_(False)
            )
            res_part = await db.execute(stmt_part)
            has_participants = (res_part.scalar() or 0) > 0

            if has_participants:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Cannot modify grid configuration because participants have already started the study.",
                )

    # Block ALL updates if not in DRAFT state.
    if study.state != StudyState.draft:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot update study in {study.state.value} state. Switch it back to draft first.",
        )

    # Optimistic Locking Check
    if study_update.last_updated_at and study.updated_at:
        if study.updated_at > study_update.last_updated_at:
            if study.state == StudyState.draft:
                pass  # validation/concurrency is less strict in draft mode
            else:
                from app.services.study_service import StudyService

                # Fetch full fresh state to return to client
                fresh_study = await StudyService.get_study_by_slug(db, study.slug)
                if fresh_study:
                    raise HTTPException(
                        status_code=status.HTTP_409_CONFLICT,
                        detail={
                            "message": "Study has been modified by another user.",
                            "server_state": jsonable_encoder(
                                StudyRead.model_validate(fresh_study)
                            ),
                        },
                    )

    try:
        # 1. Update basic fields
        update_data = study_update.model_dump(exclude_unset=True)
        for field, value in update_data.items():
            if field in ["translations", "statements", "grid_config"]:
                continue
            if field == "access_password" and value is not None:
                from app.utils.security import get_password_hash

                value = get_password_hash(value)
            setattr(study, field, value)

        # 2. Update grid_config (DRAFT only)
        if study_update.grid_config is not None:
            study.grid_config = [col.model_dump() for col in study_update.grid_config]

        # 3. Update translations
        if study_update.translations is not None:
            from app.models import StudyTranslation

            current_trans = {t.language_code: t for t in study.translations}
            new_trans_list = []
            for t_in in study_update.translations:
                if t_in.language_code in current_trans:
                    t_obj = current_trans[t_in.language_code]
                    for k, v in t_in.model_dump().items():
                        setattr(t_obj, k, v)
                    new_trans_list.append(t_obj)
                else:
                    new_trans_list.append(StudyTranslation(**t_in.model_dump()))
            study.translations = new_trans_list

        # 4. Update statements
        if study_update.statements is not None:
            from app.models import (
                Statement,
                StatementTranslation,
            )

            current_statements = {s.code: s for s in study.statements}
            updated_codes = {s.code for s in study_update.statements}

            stmt_count = select(func.count(Participant.id)).where(
                Participant.study_id == study.id, Participant.is_test_run.is_(False)
            )
            res = await db.execute(stmt_count)
            has_participants = (cast(int, res.scalar()) or 0) > 0

            can_sync_structure = not has_participants

            if not can_sync_structure:
                current_codes = {s.code for s in study.statements}
                if updated_codes != current_codes:
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail="Cannot modify statement structure because participants have already started the study.",
                    )

            # A. Remove statements not in the update (only if allowed)
            if can_sync_structure:
                for code, s_obj in list(current_statements.items()):
                    if code not in updated_codes:
                        study.statements.remove(s_obj)
                        await db.delete(s_obj)
                        del current_statements[code]

            # B. Sync existing and add new
            for idx, s_up in enumerate(study_update.statements):
                if s_up.code in current_statements:
                    # Update existing
                    target_s = current_statements[s_up.code]
                    target_s.display_order = idx
                    curr_s_trans = {t.language_code: t for t in target_s.translations}
                    new_s_trans_list = []
                    for st_in in s_up.translations:
                        if st_in.language_code in curr_s_trans:
                            st_obj = curr_s_trans[st_in.language_code]
                            st_obj.text = st_in.text
                            new_s_trans_list.append(st_obj)
                        else:
                            new_s_trans_list.append(
                                StatementTranslation(
                                    statement_id=target_s.id, **st_in.model_dump()
                                )
                            )
                    target_s.translations = new_s_trans_list
                elif can_sync_structure:
                    # Add new
                    new_s = Statement(
                        study_id=study.id, code=s_up.code, display_order=idx
                    )
                    db.add(new_s)
                    study.statements.append(new_s)

                    await db.flush()  # Get ID

                    for st_in in s_up.translations:
                        new_st = StatementTranslation(
                            statement_id=new_s.id,
                            language_code=st_in.language_code,
                            text=st_in.text,
                        )
                        db.add(new_st)

        await db.commit()
    except IntegrityError as e:
        await db.rollback()
        logger.error(f"Integrity check failed during study update: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Database integrity check failed (possibly duplicate statement codes)",
        )
    except HTTPException:
        await db.rollback()
        raise
    except Exception as e:
        await db.rollback()
        logger.error(f"Unexpected error during study update: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An unexpected error occurred while updating the study",
        )
    from app.services.study_service import StudyService

    updated_study = await StudyService.get_study_by_slug(db, study.slug)
    if updated_study is None:
        raise HTTPException(status_code=404, detail="Study not found after update")
    return updated_study


@router.post("/{slug}/validate", response_model=list[str])
@limiter.limit("30/minute")
async def validate_study(
    request: Request,
    study: Study = Depends(check_study_permission(StudyRole.editor)),
    db: AsyncSession = Depends(get_db),
) -> list[str]:
    """Check if study is ready for activation."""
    from app.services.study_service import StudyService

    # Ensure relations are loaded
    await db.refresh(study, attribute_names=["translations", "statements"])
    for s in study.statements:
        await db.refresh(s, attribute_names=["translations"])

    return StudyService.validate_for_activation(study)


@router.post("/{slug}/state", response_model=StudyRead)
@limiter.limit("30/minute")
async def change_study_state(
    request: Request,
    new_state: StudyState,
    study: Study = Depends(check_study_permission(StudyRole.editor)),
    db: AsyncSession = Depends(get_db),
) -> Study:
    """Change study state (Draft <-> Active <-> Closed <-> Archived)."""
    # Rules for Activation
    if new_state == StudyState.active:
        from app.services.study_service import StudyService

        # Ensure relations are loaded for validation
        await db.refresh(study, attribute_names=["translations", "statements"])
        for s in study.statements:
            await db.refresh(s, attribute_names=["translations"])

        errors = StudyService.validate_for_activation(study)
        if errors:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail={
                    "message": "Study is not ready for activation",
                    "errors": errors,
                },
            )

    try:
        study.state = new_state
        await db.commit()
    except Exception as e:
        await db.rollback()
        logger.error(f"Unexpected error during study state change: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An unexpected error occurred while changing study state",
        )
    # Re-fetch with relationships for Response Serialization
    from app.services.study_service import StudyService

    updated_study = await StudyService.get_study_by_slug(db, study.slug)
    if updated_study is None:
        raise HTTPException(
            status_code=404, detail="Study not found after state change"
        )
    return updated_study


@router.post("/{slug}/reset", status_code=status.HTTP_204_NO_CONTENT)
@limiter.limit("30/minute")
async def reset_study_participants(
    request: Request,
    study: Study = Depends(check_study_permission(StudyRole.owner)),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Delete all participants for the study (Owner only)."""
    from app.services.study_data_service import StudyDataService

    await StudyDataService.reset_study_participants(db, study.id)
    return None


@router.delete("/{slug}", status_code=status.HTTP_204_NO_CONTENT)
@limiter.limit("30/minute")
async def delete_study(
    request: Request,
    study: Study = Depends(check_study_permission(StudyRole.owner)),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Delete a study (Superuser only, and must be Archived)."""
    # 1. Check Superuser
    if not current_user.is_superuser:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only system administrators can delete studies.",
        )

    # 2. Check Archived
    if study.state != StudyState.archived:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Study must be ARCHIVED before it can be deleted.",
        )
    # Delete S3 audio files before DB cascade removes AudioRecording rows
    from app.services.study_data_service import StudyDataService

    await StudyDataService.delete_audio_files_for_study(db, study.id)
    await db.delete(study)
    await db.commit()
    return None


# ------------------------------------------------------------------
# Include sub-routers
# ------------------------------------------------------------------
from . import studies_participants, studies_import_export  # noqa: E402

router.include_router(studies_participants.router)
router.include_router(studies_import_export.router)
