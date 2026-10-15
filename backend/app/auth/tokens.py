import os
from datetime import datetime, timedelta, timezone

import jwt

ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_HOURS = 12  # roughly one shift


def _secret_key() -> str:
    key = os.getenv("JWT_SECRET_KEY")
    if not key:
        raise RuntimeError(
            "JWT_SECRET_KEY is not set. Add it to backend/.env before starting the server."
        )
    return key


def create_access_token(user_id: int, role: str) -> str:
    expires = datetime.now(timezone.utc) + timedelta(hours=ACCESS_TOKEN_EXPIRE_HOURS)
    payload = {"sub": str(user_id), "role": role, "exp": expires}
    return jwt.encode(payload, _secret_key(), algorithm=ALGORITHM)


def decode_access_token(token: str) -> dict:
    """Returns the payload if the token is valid and unexpired.
    Raises jwt.InvalidTokenError (or a subclass like ExpiredSignatureError) otherwise."""
    return jwt.decode(token, _secret_key(), algorithms=[ALGORITHM])
