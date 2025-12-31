"""Admin routes for study management."""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies import check_workspace_permission, get_current_user
from app.models import (
    Study,
    StudyState,
    User,
    Workspace,
    WorkspaceMember,
    WorkspaceRole,
)
from app.schemas import (
    StudyCreate,
    StudyRead,
    StudyUpdate,
)

router = APIRouter()


@router.post("/", response_model=StudyRead, status_code=status.HTTP_201_CREATED)
async def create_study(
    study: StudyCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> Study:
    """Create a new study in the user's active workspace."""
    # 1. Check slug uniqueness
    query = select(Study).where(Study.slug == study.slug)
    result = await db.execute(query)
    if result.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Study with this slug already exists",
        )

    # 2. Find a valid workspace for the user (Admin or Researcher)
    # In a real app, workspace_id might be passed in headers or body.
    # Here we pick the first workspace where user has create permissions.
    ws_query = (
        select(Workspace)
        .join(WorkspaceMember)
        .where(WorkspaceMember.user_id == current_user.id)
        .where(
            WorkspaceMember.role.in_([WorkspaceRole.admin, WorkspaceRole.researcher])
        )
        .limit(1)
    )
    ws_res = await db.execute(ws_query)
    workspace = ws_res.scalar_one_or_none()

    if not workspace:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You need to be an Admin or Researcher in a Workspace to create a study.",
        )

    # 3. Create Study
    db_study = Study(
        slug=study.slug,
        workspace_id=workspace.id,
        state=StudyState.draft,  # Always draft initially
        grid_config=[col.model_dump() for col in study.grid_config],
        presort_config=study.presort_config,
        postsort_config=study.postsort_config,
        default_language=study.default_language or "en",
        show_statement_codes=study.show_statement_codes,
    )
    db.add(db_study)
    await db.flush()  # to get ID

    # TODO: Handle translations and statements creation here if included in StudyCreate
    from ...models import Statement, StatementTranslation, StudyTranslation

    for t_in in study.translations:
        db.add(StudyTranslation(study_id=db_study.id, **t_in.model_dump()))

    # 4. Add Statements and their translations
    for s_in in study.statements:
        stmt = Statement(study_id=db_study.id, code=s_in.code)
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
    # Re-fetch with relationships for Response Serialization
    from ...services.study_service import StudyService

    updated_study = await StudyService.get_study_by_slug(db, db_study.slug)
    if updated_study is None:
        raise HTTPException(status_code=404, detail="Study not found after creation")
    return updated_study


@router.get("/", response_model=list[StudyRead])
async def list_studies(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> list[Study]:
    """List studies accessible to the current user (via Workspace membership)."""
    query = (
        select(Study)
        .join(Study.workspace)
        .join(WorkspaceMember, WorkspaceMember.workspace_id == Study.workspace_id)
        .where(WorkspaceMember.user_id == current_user.id)
    )
    result = await db.execute(query)
    return list(result.scalars().all())


@router.get("/{slug}", response_model=StudyRead)
async def get_study(
    study: Study = Depends(check_workspace_permission(WorkspaceRole.viewer)),
    db: AsyncSession = Depends(get_db),
) -> Study:
    """Get study details."""
    await db.refresh(study, attribute_names=["translations", "statements"])
    return study


@router.patch("/{slug}", response_model=StudyRead)
async def update_study(
    study_update: StudyUpdate,
    study: Study = Depends(check_workspace_permission(WorkspaceRole.researcher)),
    db: AsyncSession = Depends(get_db),
) -> Study:
    """Update study configuration."""
    # Structural changes only allowed in DRAFT
    is_structural_edit = any(
        f in study_update.model_dump(exclude_unset=True) for f in ["grid_config"]
    )

    if is_structural_edit and study.state != StudyState.draft:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot modify grid structure of an active, paused, or closed study.",
        )

    if study.state == StudyState.closed:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot update a closed study.",
        )

    # 1. Update basic fields
    update_data = study_update.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        if field in ["translations", "statements", "grid_config"]:
            continue
        setattr(study, field, value)

    # 2. Update grid_config (DRAFT only)
    if study_update.grid_config is not None:
        study.grid_config = [col.model_dump() for col in study_update.grid_config]

    # 3. Update translations
    if study_update.translations is not None:
        from ...models import StudyTranslation

        # Replace all translations for simplicity or update existing?
        # For now, we'll implement a "sync" logic: update existing, add new, remove old.
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
        from ...models import StatementTranslation

        # We only allow updating translations for existing statements by code
        # No adding/removing statements here if not in DRAFT (but let's keep it safe for all)
        current_statements = {s.code: s for s in study.statements}
        for s_up in study_update.statements:
            if s_up.code in current_statements:
                target_s = current_statements[s_up.code]
                # Update translations for this statement
                curr_s_trans = {t.language_code: t for t in target_s.translations}
                new_s_trans_list = []
                for st_in in s_up.translations:
                    if st_in.language_code in curr_s_trans:
                        st_obj = curr_s_trans[st_in.language_code]
                        st_obj.text = st_in.text
                        new_s_trans_list.append(st_obj)
                    else:
                        new_s_trans_list.append(
                            StatementTranslation(**st_in.model_dump())
                        )
                target_s.translations = new_s_trans_list
            elif study.state == StudyState.draft:
                # In DRAFT, we could technically allow adding by code, but StudyUpdate is for partials.
                # Usually creation handles the bulk.
                pass

    await db.commit()
    # Re-fetch with relationships for Response Serialization
    from ...services.study_service import StudyService

    updated_study = await StudyService.get_study_by_slug(db, study.slug)
    if updated_study is None:
        raise HTTPException(status_code=404, detail="Study not found after update")
    return updated_study


@router.post("/{slug}/state", response_model=StudyRead)
async def change_study_state(
    new_state: StudyState,
    study: Study = Depends(check_workspace_permission(WorkspaceRole.researcher)),
    db: AsyncSession = Depends(get_db),
) -> Study:
    """Change study state (Draft <-> Active <-> Closed)."""
    study.state = new_state
    await db.commit()
    # Re-fetch with relationships for Response Serialization
    from ...services.study_service import StudyService

    updated_study = await StudyService.get_study_by_slug(db, study.slug)
    if updated_study is None:
        raise HTTPException(
            status_code=404, detail="Study not found after state change"
        )
    return updated_study


@router.delete("/{slug}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_study(
    study: Study = Depends(check_workspace_permission(WorkspaceRole.admin)),
    db: AsyncSession = Depends(get_db),
):
    """Delete a study (Workspace Admin only)."""
    await db.delete(study)
    await db.commit()
    return None
