import subprocess
import json
import re
import time
# import glob as _glob

from utils.logger import get_logger
from utils.file_manager import tmp_path, safe_remove

logger = get_logger(__name__)

YOUTUBE_URL_RE = re.compile(
    r"^(https?://)?(www\.)?"
    r"(youtube\.com/(watch\?v=|shorts/|embed/|live/)|youtu\.be/)"
    r"[\w\-]{11}"
)


def validate_youtube_url(url: str) -> bool:
    return bool(YOUTUBE_URL_RE.match(url.strip()))


def get_video_info(url: str) -> dict:
    logger.info(f"Fetching video info for URL: {url}")
    t0 = time.perf_counter()

    cmd = [
        "yt-dlp",
        "--dump-json",
        "--no-playlist",
        "--skip-download",
        url,
    ]
    result = subprocess.run(cmd, capture_output=True, text=True, timeout=30)

    if result.returncode != 0:
        err = (
            result.stderr.strip().splitlines()[-1]
            if result.stderr.strip()
            else "Unknown yt-dlp error"
        )
        logger.error(f"yt-dlp info failed: {err}")
        raise RuntimeError(f"yt-dlp error: {err}")

    data = json.loads(result.stdout)
    title = data.get("title", "Unknown")
    duration = data.get("duration", 0)
    thumbnail = data.get("thumbnail", "")

    elapsed = time.perf_counter() - t0
    logger.info(
        f'Video info fetched: "{title}" (duration: {duration}s) in {elapsed:.2f}s'
    )

    return {
        "title": title,
        "duration": int(duration),
        "thumbnail_url": thumbnail,
    }


def extract_audio(url: str, start: int, end: int) -> str:
    """Extract audio segment using yt-dlp (get stream URL) + FFmpeg (range request).
    Fast — FFmpeg seeks directly in the stream, no full download required."""
    logger.info(f"Extracting audio: start={start}s end={end}s")
    t0 = time.perf_counter()

    url_cmd = [
        "yt-dlp",
        "--no-playlist",
        "-f",
        "bestaudio[ext=m4a]/bestaudio[ext=webm]/bestaudio",
        "--get-url",
        url,
    ]
    url_result = subprocess.run(url_cmd, capture_output=True, text=True, timeout=30)

    if url_result.returncode != 0:
        err = (
            url_result.stderr.strip().splitlines()[-1]
            if url_result.stderr.strip()
            else "Unknown yt-dlp error"
        )
        logger.error(f"yt-dlp URL extraction failed: {err}")
        raise RuntimeError(f"yt-dlp error: {err}")

    stream_url = url_result.stdout.strip()
    if not stream_url:
        raise RuntimeError("yt-dlp returned empty stream URL")

    out_path = f"{tmp_path()}.m4a"
    ffmpeg_cmd = [
        "ffmpeg",
        "-ss",
        str(start),  # seek BEFORE -i for fast HTTP range request
        "-to",
        str(end),
        "-i",
        stream_url,
        "-c",
        "copy",  # no re-encoding, just copy the stream
        "-y",  # overwrite if exists
        out_path,
    ]
    ffmpeg_result = subprocess.run(
        ffmpeg_cmd, capture_output=True, text=True, timeout=900
    )

    if ffmpeg_result.returncode != 0:
        err = (
            ffmpeg_result.stderr.strip().splitlines()[-1]
            if ffmpeg_result.stderr.strip()
            else "Unknown FFmpeg error"
        )
        logger.error(f"FFmpeg extraction failed: {err}")
        raise RuntimeError(f"FFmpeg error: {err}")

    elapsed = time.perf_counter() - t0
    logger.info(f"Audio extracted (m4a) in {elapsed:.2f}s")
    return out_path


# def extract_audio(url: str, start: int, end: int) -> str:
#     """Download the audio segment in its native format (m4a or webm) using
#     yt-dlp's --download-sections. No FFmpeg required — Groq accepts both formats."""
#     logger.info(f"Extracting audio: start={start}s end={end}s")
#     t0 = time.perf_counter()

#     base = tmp_path()  # path without extension; yt-dlp appends it

#     section = f"*{_fmt(start)}-{_fmt(end)}"
#     cmd = [
#         "yt-dlp",
#         "--no-playlist",
#         "--download-sections",
#         section,
#         "--concurrent-fragments",
#         "5",
#         # Prefer m4a (AAC), fall back to webm/opus — both accepted by Groq Whisper
#         "-f",
#         "bestaudio[ext=m4a]/bestaudio[ext=webm]/bestaudio",
#         "-o",
#         f"{base}.%(ext)s",
#         url,
#     ]

#     result = subprocess.run(cmd, capture_output=True, text=True, timeout=600)

#     if result.returncode != 0:
#         err = (
#             result.stderr.strip().splitlines()[-1]
#             if result.stderr.strip()
#             else "Unknown yt-dlp error"
#         )
#         logger.error(f"yt-dlp audio extraction failed: {err}")
#         raise RuntimeError(f"yt-dlp error: {err}")

#     matches = _glob.glob(f"{base}.*")
#     if not matches:
#         raise RuntimeError("yt-dlp produced no output file")

#     out_path = matches[0]
#     elapsed = time.perf_counter() - t0
#     logger.info(f"Audio extracted ({out_path.rsplit('.', 1)[-1]}) in {elapsed:.2f}s")
#     return out_path


# def _fmt(seconds: int) -> str:
#     h = seconds // 3600
#     m = (seconds % 3600) // 60
#     s = seconds % 60
#     if h:
#         return f"{h:02d}:{m:02d}:{s:02d}"
#     return f"{m:02d}:{s:02d}"
