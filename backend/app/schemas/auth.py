"""Authentication and TOTP schemas."""

from pydantic import BaseModel, EmailStr, Field


class Token(BaseModel):
    """Schema for returning an access token or 2FA requirement."""

    access_token: str | None = None
    token_type: str | None = None
    requires_2fa: bool = False
    temp_token: str | None = None


class TokenData(BaseModel):
    """Schema for data stored in JWT."""

    email: str | None = None


class TOTPSetup(BaseModel):
    """Schema for TOTP setup response."""

    secret: str
    qr_code_uri: str


class TOTPVerify(BaseModel):
    """Schema for TOTP verification."""

    token: str


class EmailTokenSubmit(BaseModel):
    """Schema for submitting an email-link JWT (verify, password-reset, etc.)."""

    token: str


class EmailRequest(BaseModel):
    """Schema for submitting an email address (resend flows)."""

    email: EmailStr


class PasswordResetConfirm(BaseModel):
    """Schema for confirming a password reset via email-link JWT."""

    token: str
    new_password: str = Field(min_length=8)
