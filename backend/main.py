import os
from contextlib import asynccontextmanager

from dotenv import load_dotenv
load_dotenv()

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from database.db import engine, Base
from routes import video, transcribe, translate, history, subtitle_video
from utils.logger import get_logger
from utils.file_manager import ensure_dirs, clear_tmp

logger = get_logger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    ensure_dirs()
    cleared = clear_tmp()
    logger.info(f"Startup: cleared {cleared} temp file(s) from tmp/")
    Base.metadata.create_all(bind=engine)
    logger.info("Database tables initialized")
    yield
    logger.info("Application shutting down")


app = FastAPI(
    title="Khotba Transcriber API",
    description="Arabic lecture transcription and translation service",
    version="1.0.0",
    lifespan=lifespan,
)

allowed_origin = os.getenv("ALLOWED_ORIGIN", "http://localhost:5173")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[allowed_origin],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(video.router, prefix="/api/video", tags=["video"])
app.include_router(transcribe.router, prefix="/api", tags=["transcribe"])
app.include_router(translate.router, prefix="/api", tags=["translate"])
app.include_router(history.router, prefix="/api", tags=["history"])
app.include_router(subtitle_video.router, prefix="/api", tags=["subtitle-video"])


@app.get("/api/health")
async def health():
    return {"status": "ok"}
