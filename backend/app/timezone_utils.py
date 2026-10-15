from datetime import date, datetime, time, timedelta, timezone
from zoneinfo import ZoneInfo
import os

# The pharmacy's local timezone. All "is this expired / is this today" checks
# across the app should go through this, rather than the server's raw clock,
# so behavior doesn't silently change based on what timezone the server itself
# happens to be running in.
LOCAL_TZ = ZoneInfo(os.getenv("APP_TIMEZONE", "Asia/Karachi"))


def local_today() -> date:
    return datetime.now(LOCAL_TZ).date()


def local_day_bounds_in_utc(local_date: date):
    """Given a calendar date in LOCAL_TZ, return (start, end) as naive UTC
    datetimes marking a half-open interval [start, end) spanning that local
    day — i.e. from local midnight up to (but not including) the next local
    midnight. A half-open interval avoids relying on a day's "last instant",
    which is precision-sensitive; a sale at exactly local midnight is cleanly
    included as the interval's start, not an edge case to get right."""
    start_local = datetime.combine(local_date, time.min, tzinfo=LOCAL_TZ)
    end_local = start_local + timedelta(days=1)
    start_utc = start_local.astimezone(timezone.utc).replace(tzinfo=None)
    end_utc = end_local.astimezone(timezone.utc).replace(tzinfo=None)
    return start_utc, end_utc
