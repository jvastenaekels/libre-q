from fastapi import APIRouter, HTTPException, status

from app.utils.security import decode_invitation_token

router = APIRouter(tags=["Admin Invitations"])


# Endpoint /slug/invite is deprecated and removed. Functionality moved to workspaces endpoint.


@router.get("/verify")
async def verify_invitation(token: str):
    """Verify an invitation token and return details."""
    try:
        payload = decode_invitation_token(token)
        return {
            "email": payload["sub"],
            "workspace_id": payload.get("workspace_id"),
            "role": payload["role"],
        }
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid or expired invitation token: {str(e)}",
        )
