"""One-time setup / recovery: create (or reset) a manager account from the terminal.

Run from the backend folder with the venv active:
    python -m app.create_manager
"""
import getpass
import sys

from dotenv import load_dotenv

load_dotenv()

from pydantic import ValidationError  # noqa: E402

from app.auth.schemas import UserCreate  # noqa: E402
from app.auth.security import hash_password  # noqa: E402
from app.database import Base, SessionLocal, engine  # noqa: E402
from app.models.models import User  # noqa: E402


def _clean_error(exc: ValidationError) -> str:
    return exc.errors()[0]["msg"].removeprefix("Value error, ")


def create_or_reset_manager(db, username: str, password: str, reset_existing: bool = False) -> str:
    """Creates a manager, or (if reset_existing) resets an existing user's password and
    makes them an active manager. Returns a summary; raises ValueError on bad input."""
    try:
        data = UserCreate(username=username, password=password, role="manager")
    except ValidationError as exc:
        raise ValueError(_clean_error(exc))

    existing = db.query(User).filter(User.username == data.username).first()
    if existing:
        if not reset_existing:
            raise ValueError(f"User '{data.username}' already exists.")
        existing.password_hash = hash_password(data.password)
        existing.role = "manager"
        existing.is_active = True
        db.commit()
        return f"Reset password for '{data.username}' and made it an active manager."

    db.add(User(username=data.username, password_hash=hash_password(data.password), role="manager"))
    db.commit()
    return f"Created manager account '{data.username}'."


def main() -> int:
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        username = input("Manager username: ").strip().lower()
        reset = False
        if db.query(User).filter(User.username == username).first():
            answer = input(
                f"'{username}' already exists. Reset its password and make it an active manager? [y/N]: "
            )
            if answer.strip().lower() != "y":
                print("Nothing changed.")
                return 1
            reset = True

        password = getpass.getpass("Password (hidden): ")
        if password != getpass.getpass("Confirm password: "):
            print("Passwords don't match. Nothing changed.")
            return 1

        try:
            print(create_or_reset_manager(db, username, password, reset_existing=reset))
        except ValueError as exc:
            print(f"Error: {exc}")
            return 1
        return 0
    finally:
        db.close()


if __name__ == "__main__":
    sys.exit(main())
