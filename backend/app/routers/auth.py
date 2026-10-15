from typing import List

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.auth.dependencies import get_current_user, require_role
from app.auth.schemas import (
    MAX_PASSWORD_BYTES,
    LoginRequest,
    TokenResponse,
    UserCreate,
    UserOut,
    UserUpdate,
)
from app.auth.security import hash_password, verify_password
from app.auth.tokens import create_access_token
from app.database import get_db
from app.models.models import User

router = APIRouter(prefix="/auth", tags=["auth"])

INVALID_LOGIN = "Incorrect username or password."

# A real bcrypt hash of a throwaway value. Checking against it when the username
# doesn't exist makes that failure take as long as a wrong-password failure, so
# response timing can't reveal which usernames exist.
_DUMMY_HASH = hash_password("timing-equalizer-not-a-real-password")


@router.post("/login", response_model=TokenResponse)
def login(body: LoginRequest, db: Session = Depends(get_db)):
    username = body.username.strip().lower()
    user = db.query(User).filter(User.username == username).first()
    password_too_long = len(body.password.encode("utf-8")) > MAX_PASSWORD_BYTES

    if user is None or password_too_long:
        verify_password("x", _DUMMY_HASH)
        raise HTTPException(status_code=401, detail=INVALID_LOGIN)

    if not verify_password(body.password, user.password_hash):
        raise HTTPException(status_code=401, detail=INVALID_LOGIN)

    # Only revealed after a correct password, so it doesn't leak which accounts exist.
    if not user.is_active:
        raise HTTPException(status_code=403, detail="This account has been deactivated. Ask a manager.")

    return TokenResponse(
        access_token=create_access_token(user.id, user.role),
        user_id=user.id,
        username=user.username,
        role=user.role,
    )


@router.get("/me", response_model=UserOut)
def me(user: User = Depends(get_current_user)):
    return user


# ---------- Staff management (manager-only) ----------

def _other_active_managers(db: Session, excluding_id: int) -> int:
    return (
        db.query(User)
        .filter(User.role == "manager", User.is_active.is_(True), User.id != excluding_id)
        .count()
    )


@router.get("/users", response_model=List[UserOut])
def list_users(
    db: Session = Depends(get_db),
    _manager: User = Depends(require_role("manager")),
):
    return db.query(User).order_by(User.username).all()


@router.post("/users", response_model=UserOut, status_code=201)
def create_user(
    body: UserCreate,
    db: Session = Depends(get_db),
    _manager: User = Depends(require_role("manager")),
):
    if db.query(User).filter(User.username == body.username).first():
        raise HTTPException(status_code=409, detail="That username is already taken.")

    user = User(username=body.username, password_hash=hash_password(body.password), role=body.role)
    db.add(user)
    try:
        db.commit()
    except IntegrityError:  # two managers created the same username at the same moment
        db.rollback()
        raise HTTPException(status_code=409, detail="That username is already taken.")
    db.refresh(user)
    return user


@router.patch("/users/{user_id}", response_model=UserOut)
def update_user(
    user_id: int,
    body: UserUpdate,
    db: Session = Depends(get_db),
    current: User = Depends(require_role("manager")),
):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    if user.id == current.id and body.is_active is False:
        raise HTTPException(status_code=400, detail="You can't deactivate your own account.")

    loses_manager_access = user.role == "manager" and user.is_active and (
        (body.role is not None and body.role != "manager") or body.is_active is False
    )
    if loses_manager_access and _other_active_managers(db, user.id) == 0:
        raise HTTPException(
            status_code=400,
            detail="This is the last active manager. Make another account a manager first.",
        )

    if body.role is not None:
        user.role = body.role
    if body.password is not None:
        user.password_hash = hash_password(body.password)
    if body.is_active is not None:
        user.is_active = body.is_active

    db.commit()
    db.refresh(user)
    return user
