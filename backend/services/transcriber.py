import os
import time

from groq import Groq
from utils.logger import get_logger
from utils.models_config import GROQ_TRANSCRIPTION_MODEL

logger = get_logger(__name__)


_MIME_TYPES = {
    "m4a": "audio/mp4",
    "mp4": "audio/mp4",
    "webm": "audio/webm",
    "mp3": "audio/mpeg",
    "ogg": "audio/ogg",
    "flac": "audio/flac",
    "wav": "audio/wav",
}


def transcribe_audio(audio_path: str, include_timestamps: bool = True) -> dict:
    """Send an audio file to Groq Whisper and return segments + full text.
    Accepts m4a, webm, mp3, ogg, flac, wav — no FFmpeg conversion needed.
    When include_timestamps is False, returns only the full text with no segments."""
    ext = audio_path.rsplit(".", 1)[-1].lower() if "." in audio_path else "m4a"
    mime = _MIME_TYPES.get(ext, "audio/mp4")
    filename = f"audio.{ext}"

    logger.info(f"Starting transcription with Groq Whisper (format: {ext}, timestamps: {include_timestamps})")
    t0 = time.perf_counter()

    api_key = os.getenv("GROQ_API_KEY")
    if not api_key:
        raise RuntimeError("GROQ_API_KEY is not set")

    client = Groq(api_key=api_key)

    with open(audio_path, "rb") as audio_file:
        response = client.audio.transcriptions.create(
            file=(filename, audio_file, mime),
            model=GROQ_TRANSCRIPTION_MODEL,
            language="ar",
            response_format="verbose_json" if include_timestamps else "json",
        )

    segments = []
    full_text = ""

    if not include_timestamps:
        full_text = response.text.strip() if hasattr(response, "text") else ""
        elapsed = time.perf_counter() - t0
        logger.info(f"Transcription (text-only) completed in {elapsed:.2f}s")
        return {"segments": [], "full_text": full_text}

    if hasattr(response, "segments") and response.segments:
        for seg in response.segments:
            if isinstance(seg, dict):
                segments.append({
                    "start": round(seg["start"], 2),
                    "end": round(seg["end"], 2),
                    "text": seg["text"].strip(),
                })
            else:
                segments.append({
                    "start": round(seg.start, 2),
                    "end": round(seg.end, 2),
                    "text": seg.text.strip(),
                })
        full_text = " ".join(s["text"] for s in segments)
    elif hasattr(response, "text"):
        full_text = response.text.strip()
        segments = [{"start": 0.0, "end": 0.0, "text": full_text}]

    elapsed = time.perf_counter() - t0
    logger.info(f"Transcription completed in {elapsed:.2f}s — {len(segments)} segment(s) returned")

    return {"segments": segments, "full_text": full_text}
