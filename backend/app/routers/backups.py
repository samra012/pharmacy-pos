from datetime import datetime, timezone
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from app import backup
from app.auth.dependencies import require_role

router = APIRouter(
    prefix="/backups",
    tags=["backups"],
    dependencies=[Depends(require_role("manager"))],
)


class BackupFile(BaseModel):
    filename: str
    created_at: str
    size_bytes: int


class BackupStatus(BaseModel):
    backup_dir: str
    interval_hours: float
    keep: int
    healthy: bool
    newest_age_hours: Optional[float]
    last_error: Optional[str]
    backups: List[BackupFile]


def _describe(path) -> BackupFile:
    stat = path.stat()
    return BackupFile(
        filename=path.name,
        created_at=datetime.fromtimestamp(stat.st_mtime, tz=timezone.utc).isoformat(),
        size_bytes=stat.st_size,
    )


@router.get("/", response_model=BackupStatus)
def backup_status():
    described = []
    for path in backup.list_backups()[:5]:
        try:
            described.append(_describe(path))
        except FileNotFoundError:  # pruned between listing and reading
            continue

    age = backup.newest_backup_age_hours()
    interval = backup.interval_hours()
    healthy = backup.last_error is None and age is not None and age < interval * 2

    return BackupStatus(
        backup_dir=str(backup.backup_dir().resolve()),
        interval_hours=interval,
        keep=backup.keep_count(),
        healthy=healthy,
        newest_age_hours=age,
        last_error=backup.last_error,
        backups=described,
    )


@router.post("/", response_model=BackupFile, status_code=201)
def backup_now():
    try:
        path = backup.create_backup()
    except Exception:
        raise HTTPException(status_code=500, detail=f"Backup failed: {backup.last_error}")
    return _describe(path)
