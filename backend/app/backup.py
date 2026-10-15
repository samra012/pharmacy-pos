"""Database backups: consistent online copies of the SQLite file, verified,
renamed into place atomically (so cloud sync never uploads half a file),
and pruned to the newest BACKUP_KEEP copies."""
import os
import sqlite3
import threading
from datetime import datetime
from pathlib import Path

from app.database import engine
from app.timezone_utils import LOCAL_TZ

BACKUP_PREFIX = "pharmacy_pos-"
BACKUP_SUFFIX = ".db"
PARTIAL_SUFFIX = ".partial"

_lock = threading.Lock()  # never run two backups at the same time
last_error = None  # message from the most recent failed attempt, or None


def backup_dir() -> Path:
    default = Path(__file__).resolve().parent.parent / "backups"  # backend/backups
    return Path(os.getenv("BACKUP_DIR") or default)


def keep_count() -> int:
    return int(os.getenv("BACKUP_KEEP", "30"))


def interval_hours() -> float:
    return float(os.getenv("BACKUP_INTERVAL_HOURS", "6"))


def _db_path() -> Path:
    if engine.url.get_backend_name() != "sqlite":
        raise RuntimeError("Built-in backups only support SQLite.")
    path = Path(engine.url.database).resolve()
    if not path.exists():
        # sqlite3.connect() would silently create an empty file; refuse instead.
        raise RuntimeError(f"Database file not found: {path}")
    return path


def list_backups() -> list:
    folder = backup_dir()
    if not folder.exists():
        return []
    files = [p for p in folder.glob(f"{BACKUP_PREFIX}*{BACKUP_SUFFIX}") if p.is_file()]
    return sorted(files, key=lambda p: p.stat().st_mtime, reverse=True)


def newest_backup_age_hours():
    backups = list_backups()
    if not backups:
        return None
    return (datetime.now().timestamp() - backups[0].stat().st_mtime) / 3600


def create_backup() -> Path:
    global last_error
    with _lock:
        try:
            folder = backup_dir()
            folder.mkdir(parents=True, exist_ok=True)
            for leftover in folder.glob(f"*{PARTIAL_SUFFIX}"):  # from an interrupted run
                leftover.unlink(missing_ok=True)

            stamp = datetime.now(LOCAL_TZ).strftime("%Y-%m-%d_%H%M%S")
            final = folder / f"{BACKUP_PREFIX}{stamp}{BACKUP_SUFFIX}"
            n = 2
            while final.exists():  # two backups in the same second keep separate names
                final = folder / f"{BACKUP_PREFIX}{stamp}-{n}{BACKUP_SUFFIX}"
                n += 1
            temp = folder / f"{final.name}{PARTIAL_SUFFIX}"

            source = sqlite3.connect(_db_path())
            try:
                target = sqlite3.connect(temp)
                try:
                    source.backup(target)  # consistent snapshot, safe while the app is in use
                    check = target.execute("PRAGMA integrity_check").fetchone()[0]
                finally:
                    target.close()
            finally:
                source.close()

            if check != "ok":
                temp.unlink(missing_ok=True)
                raise RuntimeError(f"Backup failed its integrity check: {check}")

            os.replace(temp, final)  # appears all at once, already complete
            for old in list_backups()[keep_count():]:
                old.unlink(missing_ok=True)

            last_error = None
            return final
        except Exception as exc:
            last_error = f"{type(exc).__name__}: {exc}"
            raise


def run_scheduled_backup(interval_hours: float) -> None:
    """Back up only if the newest backup is older than interval_hours, so frequent
    restarts (like --reload during development) don't pile up copies."""
    age = newest_backup_age_hours()
    if age is None or age >= interval_hours:
        try:
            create_backup()
        except Exception:
            pass  # kept in last_error; managers will see it in the app (step B2)
