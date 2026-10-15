from dotenv import load_dotenv
load_dotenv()

import asyncio
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app import backup
from app.database import Base, engine
from app.routers import auth, backups, products, sales, reports, settings

Base.metadata.create_all(bind=engine)

BACKUP_CHECK_SECONDS = 15 * 60  # how often to ask "is a backup due?"


async def _backup_loop():
    while True:
        await asyncio.to_thread(backup.run_scheduled_backup, backup.interval_hours())
        await asyncio.sleep(BACKUP_CHECK_SECONDS)


@asynccontextmanager
async def lifespan(app):
    task = asyncio.create_task(_backup_loop())
    try:
        yield
    finally:
        task.cancel()


app = FastAPI(title="Pharmacy POS API", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(products.router)
app.include_router(sales.router)
app.include_router(reports.router)
app.include_router(settings.router)
app.include_router(backups.router)


@app.get("/")
def root():
    return {"status": "Pharmacy POS API running"}
