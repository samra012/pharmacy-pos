from fastapi import APIRouter, Depends
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.auth.dependencies import get_current_user, require_role
from app.database import get_db
from app.models.models import StoreSettings, User
from app.schemas.schemas import StoreSettingsOut, StoreSettingsUpdate

router = APIRouter(
    prefix="/settings",
    tags=["settings"],
    dependencies=[Depends(get_current_user)],  # any logged-in user can read (receipts need it)
)

SETTINGS_ID = 1  # there is only ever one row


def _get_or_create(db: Session) -> StoreSettings:
    settings = db.get(StoreSettings, SETTINGS_ID)
    if settings is not None:
        return settings
    settings = StoreSettings(
        id=SETTINGS_ID,
        store_name="Pharmacy",
        address="",
        phone="",
        receipt_footer="Thank you for your visit!",
    )
    db.add(settings)
    try:
        db.commit()
    except IntegrityError:
        # Another request created the row at the same moment; use theirs.
        db.rollback()
        return db.get(StoreSettings, SETTINGS_ID)
    db.refresh(settings)
    return settings


@router.get("/", response_model=StoreSettingsOut)
def get_settings(db: Session = Depends(get_db)):
    return _get_or_create(db)


@router.put("/", response_model=StoreSettingsOut)
def update_settings(
    body: StoreSettingsUpdate,
    db: Session = Depends(get_db),
    _manager: User = Depends(require_role("manager")),
):
    settings = _get_or_create(db)
    for field, value in body.model_dump().items():
        setattr(settings, field, value)
    db.commit()
    db.refresh(settings)
    return settings
