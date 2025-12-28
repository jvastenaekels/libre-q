"""Admin routes for study management."""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies import check_study_permission, get_current_user
from app.models import (
    Study,
    StudyCollaborator,
    StudyRole,
    StudyState,
    User,
)
from app.schemas import (
    StudyCollaboratorAdd,
    StudyCollaboratorRead,
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
    """Create a new study."""
    # Check if slug exists
    query = select(Study).where(Study.slug == study.slug)
    result = await db.execute(query)
    if result.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Study with this slug already exists",
        )

    # Create Study
    db_study = Study(
        slug=study.slug,
        state=StudyState.draft,  # Always draft initially
        grid_config=[col.model_dump() for col in study.grid_config],
        presort_config=study.presort_config,
        postsort_config=study.postsort_config,
        default_language=study.default_language or "en",
        show_statement_codes=study.show_statement_codes,
        owner_id=current_user.id,
    )
    db.add(db_study)
    await db.flush()  # to get ID

    # Add owner as collaborator
    owner_collab = StudyCollaborator(
        study_id=db_study.id, user_id=current_user.id, role=StudyRole.owner
    )
    db.add(owner_collab)

    # TODO: Handle translations and statements creation here if included in StudyCreate

    await db.commit()
    await db.refresh(db_study)
    return db_study


@router.get("/", response_model=list[StudyRead])
async def list_studies(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> list[Study]:
    """List studies accessible to the current user."""
    # Join with collaborators to filter
    query = (
        select(Study)
        .join(StudyCollaborator)
        .where(StudyCollaborator.user_id == current_user.id)
    )
    result = await db.execute(query)
    return list(result.scalars().all())


@router.get("/{slug}", response_model=StudyRead)
async def get_study(
    study: Study = Depends(check_study_permission(StudyRole.viewer)),
    db: AsyncSession = Depends(get_db),
) -> Study:
    """Get study details."""
    await db.refresh(
        study, attribute_names=["translations", "statements", "collaborators"]
    )
    return study


@router.patch("/{slug}", response_model=StudyRead)
async def update_study(
    study_update: StudyUpdate,
    study: Study = Depends(check_study_permission(StudyRole.editor)),
    db: AsyncSession = Depends(get_db),
) -> Study:
    """Update study configuration."""
    # Structural changes only allowed in DRAFT
    if study.state != StudyState.draft:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot modify configuration of an active or closed study.",
        )

    update_data = study_update.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        if field == "grid_config" and value is not None:
            setattr(study, field, [col.model_dump() for col in value])
        else:
            setattr(study, field, value)

    await db.commit()
    await db.refresh(study)
    return study


@router.post("/{slug}/state", response_model=StudyRead)
async def change_study_state(
    new_state: StudyState,
    study: Study = Depends(check_study_permission(StudyRole.editor)),
    db: AsyncSession = Depends(get_db),
) -> Study:
    """Change study state (Draft <-> Active <-> Closed)."""
    study.state = new_state
    await db.commit()
    await db.refresh(study)
    return study


@router.delete("/{slug}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_study(
    study: Study = Depends(check_study_permission(StudyRole.owner)),
    db: AsyncSession = Depends(get_db),
):
    """Delete a study (Owner only)."""
    await db.delete(study)
    await db.commit()
    return None


# --- Collaborator Management ---


@router.get("/{slug}/collaborators", response_model=list[StudyCollaboratorRead])
async def list_collaborators(
    study: Study = Depends(check_study_permission(StudyRole.viewer)),
    db: AsyncSession = Depends(get_db),
):
    """List collaborators for a study."""
    query = (
        select(StudyCollaborator, User.email)
        .join(User, StudyCollaborator.user_id == User.id)
        .where(StudyCollaborator.study_id == study.id)
    )
    result = await db.execute(query)
    collaborators = []
    for collab, email in result.all():
        collab_read = StudyCollaboratorRead.model_validate(collab)
        collab_read.user_email = email
        collaborators.append(collab_read)
    return collaborators


@router.post("/{slug}/collaborators", response_model=StudyCollaboratorRead)
async def add_collaborator(
    collab_in: StudyCollaboratorAdd,
    study: Study = Depends(check_study_permission(StudyRole.owner)),
    db: AsyncSession = Depends(get_db),
):
    """Add or update a collaborator."""
    # 1. Find User
    user_query = select(User).where(User.email == collab_in.email)
    user_res = await db.execute(user_query)
    user = user_res.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    # 2. Check if already collaborator
    collab_query = select(StudyCollaborator).where(
        StudyCollaborator.study_id == study.id, StudyCollaborator.user_id == user.id
    )
    collab_res = await db.execute(collab_query)
    db_collab = collab_res.scalar_one_or_none()

    if db_collab:
        # Update role
        db_collab.role = collab_in.role
    else:
        # Create new
        db_collab = StudyCollaborator(
            study_id=study.id, user_id=user.id, role=collab_in.role
        )
        db.add(db_collab)

    await db.commit()
    await db.refresh(db_collab)

    res = StudyCollaboratorRead.model_validate(db_collab)
    res.user_email = user.email
    return res


@router.delete("/{slug}/collaborators/{email}", status_code=status.HTTP_204_NO_CONTENT)
async def remove_collaborator(
    email: str,
    study: Study = Depends(check_study_permission(StudyRole.owner)),
    db: AsyncSession = Depends(get_db),
):
    """Remove a collaborator."""
    # 1. Find User
    user_query = select(User).where(User.email == email)
    user_res = await db.execute(user_query)
    user = user_res.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    # Prevent removing oneself if owner?
    # Usually owner shouldn't be able to remove themselves via this endpoint to avoid orphan studies.
    if user.id == study.owner_id:
        raise HTTPException(status_code=400, detail="Cannot remove the study owner")

    await db.execute(
        delete(StudyCollaborator).where(
            StudyCollaborator.study_id == study.id, StudyCollaborator.user_id == user.id
        )
    )
    await db.commit()
    return None
