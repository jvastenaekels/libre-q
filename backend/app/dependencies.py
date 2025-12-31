"""Dependency injection definitions."""

from collections.abc import Callable
from typing import cast

import jwt
from fastapi import Depends, HTTPException, Path, status
from fastapi.security import OAuth2PasswordBearer
from jwt.exceptions import InvalidTokenError
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.database import get_db
from app.models import Study, User, WorkspaceMember, WorkspaceRole
from app.schemas import TokenData

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="api/token")


async def get_current_user(
    token: str = Depends(oauth2_scheme), db: AsyncSession = Depends(get_db)
) -> User:
    """Validate JWT token and retrieve the current user."""
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(
            token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM]
        )
        sub = payload.get("sub")
        if sub is None:
            raise credentials_exception
        email: str = cast(str, sub)
        token_data = TokenData(email=email)
    except InvalidTokenError:
        raise credentials_exception

    query = select(User).where(User.email == token_data.email)
    result = await db.execute(query)
    user = cast(User | None, result.scalar_one_or_none())

    if user is None:
        raise credentials_exception

    return user


# --- RBAC Logic ---

ROLE_HIERARCHY = {
    WorkspaceRole.admin: 30,
    WorkspaceRole.researcher: 20,
    WorkspaceRole.viewer: 10,
}


def check_workspace_permission(required_role: WorkspaceRole) -> Callable:
    """Factory creating a dependency to verify workspace access (via Study slug)."""

    async def permission_dependency(
        slug: str = Path(..., description="The slug of the study"),
        current_user: User = Depends(get_current_user),
        db: AsyncSession = Depends(get_db),
    ) -> Study:
        """Dependency that returns the Study if the user has required workspace role."""
        # 1. Access Study joined with Workspace joined with Member
        # We need to find the study by slug, ensure it belongs to a workspace,
        # and ensure the current user is a member of that workspace with sufficient role.
        query = (
            select(Study, WorkspaceMember)
            .join(Study.workspace)
            .join(WorkspaceMember, WorkspaceMember.workspace_id == Study.workspace_id)
            .where(Study.slug == slug)
            .where(WorkspaceMember.user_id == current_user.id)
        )

        result = await db.execute(query)
        row = result.one_or_none()

        if not row:
            # Either study doesn't exist, or user is not in the workspace
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Study not found or access denied",
            )

        study, member = row

        # Check Role Hierarchy
        required_level = ROLE_HIERARCHY[required_role]
        user_level = ROLE_HIERARCHY[member.role]

        if user_level < required_level:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Insufficient permissions. Required: {required_role.value}",
            )

        return cast(Study, study)

    return permission_dependency
