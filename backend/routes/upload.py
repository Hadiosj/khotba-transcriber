import json
import os
import subprocess
import uuid

from fastapi import APIRouter, HTTPException, UploadFile, File

from utils.file_manager import UPLOADS_DIR, get_upload_path
from utils.logger import get_logger

logger = get_logger(__name__)

router = APIRouter()

MAX_FILE_SIZE = 500 * 1024 * 1024   # 500 MB
MAX_DURATION_SECONDS = 120 * 60      # 120 minutes

ALLOWED_EXTENSIONS = {".mp4", ".mov", ".avi", ".mkv", ".webm", ".m4v"}


def _probe_duration(file_path: str) -> float:
    """Return the video duration in seconds using ffprobe."""
    cmd = [
        "ffprobe", "-v", "quiet",
        "-print_format", "json",
        "-show_format",
        file_path,
    ]
    result = subprocess.run(cmd, capture_output=True, text=True, timeout=30)
    if result.returncode != 0:
        raise RuntimeError("ffprobe failed to read the file")
    data = json.loads(result.stdout)
    return float(data.get("format", {}).get("duration", 0))


@router.get("/upload/limits")
async def get_upload_limits():
    """Return the upload constraints so the frontend can stay in sync."""
    return {
        "max_file_size_bytes": MAX_FILE_SIZE,
        "max_duration_seconds": MAX_DURATION_SECONDS,
        "allowed_extensions": sorted(ALLOWED_EXTENSIONS),
    }


@router.post("/upload")
async def upload_video(file: UploadFile = File(...)):
    """Accept a local video file, validate size/duration, and store it for transcription."""
    filename = file.filename or "upload"
    ext = os.path.splitext(filename)[1].lower()

    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=400,
            detail=(
                f"Format non supporté '{ext}'. "
                f"Formats acceptés : {', '.join(sorted(ALLOWED_EXTENSIONS))}"
            ),
        )

    upload_id = str(uuid.uuid4())
    save_path = get_upload_path(upload_id, ext)
    os.makedirs(UPLOADS_DIR, exist_ok=True)

    # Stream to disk while enforcing the size limit
    size = 0
    try:
        with open(save_path, "wb") as f:
            while True:
                chunk = await file.read(1024 * 1024)  # 1 MB chunks
                if not chunk:
                    break
                size += len(chunk)
                if size > MAX_FILE_SIZE:
                    raise HTTPException(
                        status_code=413,
                        detail="Fichier trop volumineux. Maximum autorisé : 500 Mo.",
                    )
                f.write(chunk)
    except HTTPException:
        if os.path.exists(save_path):
            os.unlink(save_path)
        raise

    logger.info(f"Upload saved: {upload_id}{ext} ({size / 1024 / 1024:.1f} MB)")

    # Probe duration
    try:
        duration = _probe_duration(save_path)
    except Exception as e:
        os.unlink(save_path)
        logger.error(f"ffprobe failed for {save_path}: {e}")
        raise HTTPException(
            status_code=400,
            detail="Impossible de lire la durée de la vidéo. Vérifiez que le fichier est valide.",
        )

    if duration <= 0:
        os.unlink(save_path)
        raise HTTPException(status_code=400, detail="Vidéo invalide ou durée nulle.")

    if duration > MAX_DURATION_SECONDS:
        os.unlink(save_path)
        raise HTTPException(
            status_code=400,
            detail=f"Vidéo trop longue ({int(duration // 60)} min). Maximum autorisé : 2 heures.",
        )

    title = os.path.splitext(filename)[0]
    logger.info(f"Upload validated: {upload_id}{ext} duration={duration:.1f}s title='{title}'")

    return {
        "upload_id": upload_id,
        "ext": ext,
        "title": title,
        "duration": int(duration),
        "file_size": size,
        "filename": filename,
    }
