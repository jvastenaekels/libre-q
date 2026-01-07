from fastapi import APIRouter, Depends, HTTPException, status, BackgroundTasks

from app.core.config import settings
from app.dependencies import check_study_permission
from app.models import Study, StudyRole
from app.schemas import InvitationCreate, InvitationLink
from app.utils.security import create_invitation_token, decode_invitation_token
from app.utils.email import send_invitation_email

router = APIRouter(tags=["Admin Invitations"])


@router.post("/{slug}/invite", response_model=InvitationLink)
async def invite_collaborator(
    invite: InvitationCreate,
    background_tasks: BackgroundTasks,
    study: Study = Depends(check_study_permission(StudyRole.editor)),
):
    """Generate a JWT invitation link and send an email."""
    token = create_invitation_token(
        email=invite.email,
        study_id=study.id,
        role=invite.role.value,
    )

    # URL for the invitation
    invite_url = f"{settings.FRONTEND_URL}/register?token={token}"

    # Send email in background
    background_tasks.add_task(
        send_invitation_email,
        email_to=invite.email,
        context_name=study.slug,
        invite_url=invite_url,
        context_type="study",
    )

    return InvitationLink(invite_url=invite_url, token=token)


@router.get("/verify")
async def verify_invitation(token: str):
    """Verify an invitation token and return details."""
    try:
        payload = decode_invitation_token(token)
        return {
            "email": payload["sub"],
            "study_id": payload["study_id"],
            "role": payload["role"],
        }
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid or expired invitation token: {str(e)}",
        )
