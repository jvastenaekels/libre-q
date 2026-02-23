"""Workspace schemas."""

from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.models import WorkspaceRole

from .common import validate_non_empty_string
from .users import UserRead


class WorkspaceMemberRead(BaseModel):
    """Schema for reading workspace member details."""

    user_id: int
    user: UserRead
    role: WorkspaceRole
    joined_at: datetime
    model_config = ConfigDict(from_attributes=True)


class WorkspaceBrief(BaseModel):
    """Lightweight workspace schema (no members) for nested use in StudyRead."""

    id: int
    title: str
    slug: str
    created_at: datetime
    model_config = ConfigDict(from_attributes=True)


class WorkspaceRead(WorkspaceBrief):
    """Schema for reading a workspace with members."""

    members: list[WorkspaceMemberRead] = []


class WorkspaceWithRole(WorkspaceRead):
    """Schema for reading a workspace with the current user's role."""

    user_role: WorkspaceRole


class WorkspaceCreate(BaseModel):
    """Schema for creating a workspace."""

    title: str = Field(..., max_length=100)
    slug: str = Field(..., pattern="^[a-z0-9-]+$", min_length=3, max_length=50)

    @field_validator("title")
    @classmethod
    def validate_title(cls, v: str) -> str:
        res = validate_non_empty_string(v)
        if res is None:
            raise ValueError("String cannot be empty")
        return res


class WorkspaceUpdate(BaseModel):
    """Schema for updating a workspace."""

    title: str | None = Field(None, max_length=100)
    slug: str | None = Field(None, pattern="^[a-z0-9-]+$", min_length=3, max_length=50)

    @field_validator("title")
    @classmethod
    def validate_title(cls, v: str | None) -> str | None:
        return validate_non_empty_string(v)


class WorkspaceMemberUpdate(BaseModel):
    """Schema for updating a workspace member."""

    role: WorkspaceRole


class WorkspaceInvitationCreate(BaseModel):
    """Schema for creating a workspace invitation."""

    email: str
    role: WorkspaceRole = WorkspaceRole.researcher
