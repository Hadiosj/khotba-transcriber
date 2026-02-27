import time
import traceback
from typing import Optional

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, model_validator

from services.downloader import validate_youtube_url, extract_audio, extract_audio_from_local
from services.transcriber import transcribe_audio
from utils.file_manager import find_upload_file
from utils.logger import get_logger
from utils.file_manager import safe_remove
from utils.models_config import GROQ_WHISPER_COST_PER_SECOND

logger = get_logger(__name__)

router = APIRouter()

MAX_DURATION = 30 * 60  # 30 minutes


class TranscribeRequest(BaseModel):
    url: Optional[str] = None
    upload_id: Optional[str] = None
    start_seconds: int
    end_seconds: int
    include_timestamps: bool = True

    @model_validator(mode="after")
    def check_source(self):
        if not self.url and not self.upload_id:
            raise ValueError("Either 'url' or 'upload_id' must be provided")
        if self.url and self.upload_id:
            raise ValueError("Provide either 'url' or 'upload_id', not both")
        return self


@router.post("/transcribe")
async def transcribe(body: TranscribeRequest):
    start = body.start_seconds
    end = body.end_seconds

    if end <= start:
        raise HTTPException(status_code=400, detail="end_seconds must be greater than start_seconds")

    if (end - start) > MAX_DURATION:
        raise HTTPException(
            status_code=400,
            detail=f"Segment cannot exceed {MAX_DURATION // 60} minutes",
        )

    if body.url:
        url = body.url.strip()
        logger.info(f"Starting transcription for URL: {url} [{start}s - {end}s]")
        if not validate_youtube_url(url):
            raise HTTPException(status_code=400, detail="Invalid YouTube URL")
    else:
        logger.info(f"Starting transcription for upload_id: {body.upload_id} [{start}s - {end}s]")

    t0 = time.perf_counter()
    wav_path = None
    try:
        t_audio = time.perf_counter()

        if body.url:
            wav_path = extract_audio(body.url.strip(), start, end)
        else:
            local_path = find_upload_file(body.upload_id)
            if not local_path:
                raise HTTPException(status_code=404, detail="Uploaded file not found")
            wav_path = extract_audio_from_local(local_path, start, end)

        audio_elapsed = time.perf_counter() - t_audio
        logger.info(f"Audio extraction completed in {audio_elapsed:.2f}s")

        t_trans = time.perf_counter()
        result = transcribe_audio(wav_path, include_timestamps=body.include_timestamps)
        trans_elapsed = time.perf_counter() - t_trans
        logger.info(f"Whisper transcription completed in {trans_elapsed:.2f}s")

        total = time.perf_counter() - t0
        audio_seconds = float(end - start)
        whisper_cost = round(audio_seconds * GROQ_WHISPER_COST_PER_SECOND, 6)
        logger.info(
            f"Transcription pipeline completed in {total:.2f}s — "
            f"audio={audio_seconds:.1f}s cost=${whisper_cost:.5f}"
        )

        return {
            **result,
            "whisper_audio_seconds": audio_seconds,
            "whisper_cost_usd": whisper_cost,
        }

    except HTTPException:
        raise
    except FileNotFoundError as e:
        logger.error(f"yt-dlp or FFmpeg not found: {type(e).__name__}")
        raise HTTPException(
            status_code=500,
            detail="yt-dlp or FFmpeg is not installed. Please install both.",
        )
    except RuntimeError as e:
        msg = str(e)
        logger.error(f"Transcription failed: {msg}")
        if "GROQ_API_KEY" in msg:
            raise HTTPException(status_code=500, detail="Groq API key is not configured")
        raise HTTPException(status_code=500, detail="Audio extraction or transcription failed")
    except Exception as e:
        logger.error(f"Unexpected transcription error: {type(e).__name__}: {e}\n{traceback.format_exc()}")
        raise HTTPException(status_code=500, detail="Transcription failed unexpectedly")
    finally:
        if wav_path:
            safe_remove(wav_path)
