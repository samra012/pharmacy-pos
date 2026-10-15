import jwt
from fastapi import Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from app.auth.tokens import decode_access_token
from app.database import get_db
from app.models.models import User

# auto_error=False so a missing token gives our own 401, not FastAPI's default 403.
bearer_scheme = HTTPBearer(auto_error=False)


def _unauthorized(detail: str = "Not authenticated.") -> HTTPException:
    return HTTPException(status_code=401, detail=detail, headers={"WWW-Authenticate": "Bearer"})


def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
    db: Session = Depends(get_db),
) -> User:
    if credentials is None:
        raise _unauthorized()
    try:
        payload = decode_access_token(credentials.credentials)
        user_id = int(payload["sub"])
    except (jwt.InvalidTokenError, KeyError, ValueError):
        raise _unauthorized("Invalid or expired session. Please log in again.")

    # Always load from the database: the role stored here is the source of truth,
    # so demoting or deleting a user takes effect immediately.
    user = db.query(User).filter(User.id == user_id).first()
    if user is None:
        raise _unauthorized("This account no longer exists. Please log in again.")
    if not user.is_active:
        raise _unauthorized("This account has been deactivated. Ask a manager.")
    return user


def require_role(*allowed_roles: str):
    def checker(user: User = Depends(get_current_user)) -> User:
        if user.role not in allowed_roles:
            raise HTTPException(status_code=403, detail="You don't have permission to do this.")
        return user

    return checker
