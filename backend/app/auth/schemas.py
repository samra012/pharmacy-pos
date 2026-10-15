from datetime import datetime, timezone
from typing import Literal, Optional

from pydantic import BaseModel, field_serializer, field_validator

Role = Literal["cashier", "manager"]

MIN_PASSWORD_LENGTH = 8
MAX_PASSWORD_BYTES = 72  # bcrypt's limit, measured in bytes, not characters


def _validate_password(value: str) -> str:
    if len(value) < MIN_PASSWORD_LENGTH:
        raise ValueError(f"Password must be at least {MIN_PASSWORD_LENGTH} characters.")
    if len(value.encode("utf-8")) > MAX_PASSWORD_BYTES:
        raise ValueError(
            "Password is too long (max 72 bytes; Urdu and other non-English "
            "characters count as 2-3 bytes each)."
        )
    return value


def _normalize_username(value: str) -> str:
    value = value.strip().lower()
    if not 3 <= len(value) <= 32:
        raise ValueError("Username must be 3-32 characters.")
    if not all(c.isalnum() or c in "._-" for c in value):
        raise ValueError("Username can only contain letters, numbers, dots, underscores and hyphens.")
    return value


class LoginRequest(BaseModel):
    username: str
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user_id: int
    username: str
    role: Role


class UserCreate(BaseModel):
    username: str
    password: str
    role: Role

    @field_validator("username")
    @classmethod
    def check_username(cls, v: str) -> str:
        return _normalize_username(v)

    @field_validator("password")
    @classmethod
    def check_password(cls, v: str) -> str:
        return _validate_password(v)


class UserUpdate(BaseModel):
    role: Optional[Role] = None
    password: Optional[str] = None
    is_active: Optional[bool] = None

    @field_validator("password")
    @classmethod
    def check_password(cls, v: Optional[str]) -> Optional[str]:
        return None if v is None else _validate_password(v)


class UserOut(BaseModel):
    id: int
    username: str
    role: Role
    is_active: bool
    created_at: datetime

    class Config:
        from_attributes = True

    @field_serializer("created_at")
    def serialize_created_at(self, dt: datetime, _info):
        return dt.replace(tzinfo=timezone.utc).isoformat()
