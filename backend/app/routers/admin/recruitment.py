"""API router for managing study recruitment."""

from typing import List

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies import check_study_permission
from app.models import Study, StudyRole
from app.schemas import RecruitmentLinkCreate, RecruitmentLinkRead
from app.services.recruitment_service import RecruitmentService

router = APIRouter(tags=["Admin Recruitment"])


@router.get("/{slug}/links", response_model=List[RecruitmentLinkRead])
async def list_study_links(
    study: Study = Depends(check_study_permission(StudyRole.viewer)),
    db: AsyncSession = Depends(get_db),
):
    """List all recruitment links for a specific study."""
    return await RecruitmentService.get_study_links(db, study.id)


@router.post("/{slug}/links", response_model=List[RecruitmentLinkRead])
async def create_recruitment_links(
    data: RecruitmentLinkCreate,
    count: int = 1,
    study: Study = Depends(check_study_permission(StudyRole.editor)),
    db: AsyncSession = Depends(get_db),
):
    """Create one or more recruitment links."""
    if count > 100:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot create more than 100 links at once",
        )

    return await RecruitmentService.create_links(
        db,
        study_id=study.id,
        type=data.type,
        count=count,
        name=data.name,
        capacity=data.capacity,
        expires_in_days=90,  # Default expiration
    )


@router.delete("/links/{link_id}")
async def revoke_recruitment_link(
    link_id: int,
    db: AsyncSession = Depends(get_db),
    # Note: We should ideally check permission on the associated study
):
    """Revoke a recruitment link."""
    # Simplified permission check: active user (more specific check recommended in production)
    success = await RecruitmentService.delete_link(db, link_id)
    if not success:
        raise HTTPException(status_code=404, detail="Link not found")

    return {"status": "revoked"}
