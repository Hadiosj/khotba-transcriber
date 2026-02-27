import subprocess
import json
import re
import time

import httpx

from utils.logger import get_logger
from utils.file_manager import tmp_path

logger = get_logger(__name__)

# Ordered from most server-friendly to least. yt-dlp tries each in sequence.
_PLAYER_CLIENTS = "android,ios,android_vr,tv_embedded,mweb,web"

INVIDIOUS_INSTANCES = [
    "https://inv.nadeko.net",
    "https://yewtu.be",
    "https://invidious.nerdvpn.de",
]

YOUTUBE_URL_RE = re.compile(
    r"^(https?://)?(www\.)?"
    r"(youtube\.com/(watch\?v=|shorts/|embed/|live/)|youtu\.be/)"
    r"[\w\-]{11}"
)


def validate_youtube_url(url: str) -> bool:
    return bool(YOUTUBE_URL_RE.match(url.strip()))


def _extract_video_id(url: str) -> str:
    match = re.search(r"(?:v=|youtu\.be/|shorts/|embed/|live/)([\w-]{11})", url)
    if not match:
        raise ValueError(f"Could not extract video ID from URL: {url}")
    return match.group(1)


def _get_stream_url_invidious(youtube_url: str) -> str:
    video_id = _extract_video_id(youtube_url)
    for instance in INVIDIOUS_INSTANCES:
        try:
            logger.info(f"Trying Invidious instance: {instance}")
            r = httpx.get(f"{instance}/api/v1/videos/{video_id}", timeout=10)
            r.raise_for_status()
            data = r.json()
            formats = data.get("adaptiveFormats", [])
            audio = [f for f in formats if f.get("type", "").startswith("audio/")]
            audio.sort(key=lambda f: f.get("bitrate", 0), reverse=True)
            if audio:
                stream_url = audio[0]["url"]
                logger.info(f"Got stream URL from {instance}")
                return stream_url
        except Exception as e:
            logger.warning(f"Invidious instance {instance} failed: {e}")
    raise RuntimeError("All Invidious instances failed")


def _get_stream_url_ytdlp(url: str) -> str:
    cmd = [
        "yt-dlp",
        "--no-playlist",
        "-f",
        "bestaudio/best",
        "--extractor-args",
        f"youtube:player_client={_PLAYER_CLIENTS}",
        "--get-url",
        url,
    ]
    result = subprocess.run(cmd, capture_output=True, text=True, timeout=60)
    if result.returncode != 0:
        full_err = result.stderr.strip() or "Unknown yt-dlp error"
        logger.warning(f"yt-dlp stream URL extraction failed:\n{full_err}")
        raise RuntimeError(full_err.splitlines()[-1])
    stream_url = result.stdout.strip()
    if not stream_url:
        raise RuntimeError("yt-dlp returned empty stream URL")
    return stream_url


def get_video_info(url: str) -> dict:
    logger.info(f"Fetching video info for URL: {url}")
    t0 = time.perf_counter()

    cmd = [
        "yt-dlp",
        "--dump-json",
        "--no-playlist",
        "--skip-download",
        "--extractor-args",
        f"youtube:player_client={_PLAYER_CLIENTS}",
        url,
    ]
    result = subprocess.run(cmd, capture_output=True, text=True, timeout=30)

    if result.returncode != 0:
        # Fallback: get basic info from Invidious
        logger.warning("yt-dlp info failed, trying Invidious for metadata")
        try:
            video_id = _extract_video_id(url)
            for instance in INVIDIOUS_INSTANCES:
                try:
                    r = httpx.get(f"{instance}/api/v1/videos/{video_id}", timeout=10)
                    r.raise_for_status()
                    data = r.json()
                    elapsed = time.perf_counter() - t0
                    logger.info(f"Video info fetched via Invidious in {elapsed:.2f}s")
                    return {
                        "title": data.get("title", "Unknown"),
                        "duration": int(data.get("lengthSeconds", 0)),
                        "thumbnail_url": data.get("videoThumbnails", [{}])[0].get(
                            "url", ""
                        ),
                    }
                except Exception as e:
                    logger.warning(f"Invidious metadata from {instance} failed: {e}")
        except Exception:
            pass
        err = (
            result.stderr.strip().splitlines()[-1]
            if result.stderr.strip()
            else "Unknown yt-dlp error"
        )
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


def extract_audio_from_local(file_path: str, start: int, end: int) -> str:
    """Extract an audio segment from a local video file using FFmpeg."""
    logger.info(f"Extracting audio from local file: [{start}s - {end}s]")
    t0 = time.perf_counter()

    out_path = f"{tmp_path()}.m4a"
    ffmpeg_cmd = [
        "ffmpeg",
        "-ss", str(start),
        "-to", str(end),
        "-i", file_path,
        "-vn",
        "-c:a", "copy",
        "-y", out_path,
    ]
    result = subprocess.run(ffmpeg_cmd, capture_output=True, text=True, timeout=900)

    if result.returncode != 0:
        # Some codecs can't be stream-copied to m4a — retry with re-encode
        out_path2 = f"{tmp_path()}.m4a"
        ffmpeg_cmd2 = [
            "ffmpeg",
            "-ss", str(start),
            "-to", str(end),
            "-i", file_path,
            "-vn",
            "-c:a", "aac",
            "-y", out_path2,
        ]
        result2 = subprocess.run(ffmpeg_cmd2, capture_output=True, text=True, timeout=900)
        if result2.returncode != 0:
            err = (
                result2.stderr.strip().splitlines()[-1]
                if result2.stderr.strip()
                else "Unknown FFmpeg error"
            )
            raise RuntimeError(f"FFmpeg error: {err}")
        out_path = out_path2

    elapsed = time.perf_counter() - t0
    logger.info(f"Audio extracted from local file in {elapsed:.2f}s")
    return out_path


def extract_audio(url: str, start: int, end: int) -> str:
    """Extract audio segment using yt-dlp or Invidious (get stream URL) + FFmpeg."""
    logger.info(f"Extracting audio: start={start}s end={end}s")
    t0 = time.perf_counter()

    stream_url = None
    try:
        stream_url = _get_stream_url_ytdlp(url)
        logger.info("Using yt-dlp stream URL")
    except RuntimeError as e:
        logger.warning(f"yt-dlp failed ({e}), falling back to Invidious")
        stream_url = _get_stream_url_invidious(url)
        logger.info("Using Invidious stream URL")

    out_path = f"{tmp_path()}.m4a"
    ffmpeg_cmd = [
        "ffmpeg",
        "-ss",
        str(start),
        "-to",
        str(end),
        "-i",
        stream_url,
        "-c",
        "copy",
        "-y",
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
