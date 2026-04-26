"""Shared response schemas for endpoints whose payloads are too narrow to
deserve their own dedicated schemas file.

These exist primarily so FastAPI emits a named openapi schema (not
`additionalProperties: true`), which lets orval generate proper TypeScript
interfaces instead of opaque `{[k:string]:unknown}` wrappers.
"""

from pydantic import BaseModel, ConfigDict, Field


class AckResponse(BaseModel):
    """Generic acknowledgement: `{status: "...", details?: "..."}`.

    Used by endpoints that mutate state and only need to confirm success
    (save_draft, update_progress, change_password, disable_totp, unlock_study).
    """

    status: str = Field(description="Short status token, e.g. 'ok' or 'unlocked'.")
    details: str | None = Field(
        None, description="Optional human-readable explanation."
    )


class StorageUsageResponse(BaseModel):
    """Audio storage usage for a study (returned by GET /storage-usage)."""

    total_bytes: int
    total_mb: float
    file_count: int
    quota_mb: int
    quota_bytes: int
    usage_percent: float


class TOTPEnableResponse(BaseModel):
    """Result of enabling 2FA: status token + backup recovery codes."""

    status: str
    backup_codes: list[str] = Field(
        default_factory=list,
        description="One-time backup codes to store offline.",
    )


class ResolvedStudyConfigResponse(BaseModel):
    """Public study config returned by GET /api/study/{slug}.

    The runtime payload is rich and partially dynamic (translation-resolved
    fields, optional pre/post-sort configs, ui_labels, branding) — too much
    to enumerate exhaustively here without dragging the StudyConfig zod
    schema's structure into Pydantic. We declare the well-known top-level
    fields the frontend always reads and accept additional keys via
    `extra='allow'`. This is enough for orval to emit a real interface
    instead of an opaque dict.
    """

    model_config = ConfigDict(extra="allow")

    slug: str
    title: str
    description: str = ""
    instructions: str | None = None
    language: str | None = None
    requires_password: bool = False


class StudyDumpResponse(BaseModel):
    """Admin full-study dump (GET /admin/studies/{slug}/dump). Open shape."""

    model_config = ConfigDict(extra="allow")

    slug: str
    id: int


class ParticipantExportResponse(BaseModel):
    """Admin participant JSON export. Open shape."""

    model_config = ConfigDict(extra="allow")

    participant_id: int
