import subprocess
import time

from utils.file_manager import tmp_path, safe_remove
from utils.logger import get_logger
from services.downloader import _proxy_args, _PLAYER_CLIENTS, _ffmpeg_proxy_args

logger = get_logger(__name__)


def seconds_to_srt_time(seconds: float) -> str:
    ms = int((seconds % 1) * 1000)
    total_int = int(seconds)
    s = total_int % 60
    m = (total_int // 60) % 60
    h = total_int // 3600
    return f"{h:02d}:{m:02d}:{s:02d},{ms:03d}"


def generate_srt(segments: list, offset: float = 0.0) -> str:
    lines = []
    for i, seg in enumerate(segments, 1):
        start_str = seconds_to_srt_time(float(seg["start"]) + offset)
        end_str = seconds_to_srt_time(float(seg["end"]) + offset)
        text = seg["text"].strip()
        lines.append(str(i))
        lines.append(f"{start_str} --> {end_str}")
        lines.append(text)
        lines.append("")
    return "\n".join(lines)


def burn_subtitles(
    start: int,
    end: int,
    segments: list,
    analysis_id: str,
    lang: str,
    youtube_url: str = "",
    video_source_path: str = "",
    text_color: str = "white",
    background: bool = False,
) -> str:
    """Download (or use local) video segment and burn subtitles into it.

    Provide either youtube_url (fetched via yt-dlp) or video_source_path (local file).
    Uses a two-pass approach:
      1. Obtain the raw video segment in a temp file (stream copy or local seek).
      2. Re-encode the temp file with subtitles burned in via libass.
    """
    logger.info(
        f"Generating subtitled video: analysis={analysis_id} lang={lang} "
        f"start={start}s end={end}s segments={len(segments)} "
        f"text_color={text_color} background={background}"
    )
    t0 = time.perf_counter()

    srt_file = None
    temp_video = None

    try:
        # ── Step 1: Write SRT subtitle file ────────────────────────────────────
        srt_content = generate_srt(segments)
        srt_file = tmp_path(".srt")
        with open(srt_file, "w", encoding="utf-8") as f:
            f.write(srt_content)
        logger.info(f"SRT written to {srt_file} ({len(segments)} segments)")

        # ── Step 2: Obtain video segment ───────────────────────────────────────
        temp_video = tmp_path(".mp4")

        if video_source_path:
            # Local file: extract segment directly with FFmpeg
            logger.info(f"Using local video source: {video_source_path}")
            dl_cmd = [
                "ffmpeg",
                "-ss", str(start),
                "-to", str(end),
                "-i", video_source_path,
                "-c", "copy",
                "-reset_timestamps", "1",
                "-y", temp_video,
            ]
            dl_result = subprocess.run(dl_cmd, capture_output=True, text=True, timeout=1800)
        else:
            # Remote: get stream URL via yt-dlp first
            url_cmd = [
                "yt-dlp",
                "--no-playlist",
                "-f", "best[ext=mp4]/best",
                "--extractor-args", f"youtube:player_client={_PLAYER_CLIENTS}",
                *_proxy_args(),
                "--get-url",
                youtube_url,
            ]
            url_result = subprocess.run(url_cmd, capture_output=True, text=True, timeout=30)
            if url_result.returncode != 0:
                err = (
                    url_result.stderr.strip().splitlines()[-1]
                    if url_result.stderr.strip()
                    else "Unknown yt-dlp error"
                )
                raise RuntimeError(f"yt-dlp error: {err}")

            stream_urls = [u for u in url_result.stdout.strip().splitlines() if u]
            if not stream_urls:
                raise RuntimeError("yt-dlp returned empty stream URL")

            ffmpeg_proxy = _ffmpeg_proxy_args()
            if len(stream_urls) == 2:
                dl_cmd = [
                    "ffmpeg",
                    *ffmpeg_proxy,
                    "-ss", str(start), "-to", str(end), "-i", stream_urls[0],
                    *ffmpeg_proxy,
                    "-ss", str(start), "-to", str(end), "-i", stream_urls[1],
                    "-c", "copy",
                    "-map", "0:v:0", "-map", "1:a:0",
                    "-reset_timestamps", "1",
                    "-y", temp_video,
                ]
            else:
                dl_cmd = [
                    "ffmpeg",
                    *ffmpeg_proxy,
                    "-ss", str(start),
                    "-to", str(end),
                    "-i", stream_urls[0],
                    "-c", "copy",
                    "-reset_timestamps", "1",
                    "-y", temp_video,
                ]
            dl_result = subprocess.run(dl_cmd, capture_output=True, text=True, timeout=1800)

        if dl_result.returncode != 0:
            err = (
                dl_result.stderr.strip().splitlines()[-1]
                if dl_result.stderr.strip()
                else "Unknown FFmpeg error"
            )
            logger.error(f"FFmpeg segment extraction failed: {err}")
            raise RuntimeError(f"FFmpeg download error: {err}")

        # ── Step 3: Burn subtitles into the temp video ─────────────────────────
        out_path = tmp_path(".mp4")

        primary = "&H00FFFFFF" if text_color == "white" else "&H00000000"
        outline = "&H00000000" if text_color == "white" else "&H00FFFFFF"
        if background:
            back_color = "&H80000000" if text_color == "white" else "&H80FFFFFF"
            subtitle_style = (
                f"FontSize=20,Alignment=2,"
                f"PrimaryColour={primary},"
                f"OutlineColour={outline},"
                f"BackColour={back_color},"
                "BorderStyle=3,Outline=1,Shadow=0"
            )
        else:
            subtitle_style = (
                f"FontSize=20,Alignment=2,"
                f"PrimaryColour={primary},"
                f"OutlineColour={outline},"
                "BorderStyle=1,Outline=2,Shadow=0"
            )
        burn_cmd = [
            "ffmpeg",
            "-i", temp_video,
            "-vf", f"subtitles={srt_file}:force_style='{subtitle_style}'",
            "-c:v", "libx264",
            "-preset", "fast",
            "-crf", "23",
            "-c:a", "aac",
            "-y",
            out_path,
        ]

        burn_result = subprocess.run(burn_cmd, capture_output=True, text=True, timeout=3600)
        if burn_result.returncode != 0:
            err = (
                burn_result.stderr.strip().splitlines()[-1]
                if burn_result.stderr.strip()
                else "Unknown FFmpeg error"
            )
            logger.error(f"FFmpeg subtitle burn failed: {err}")
            raise RuntimeError(f"FFmpeg subtitle burn error: {err}")

        elapsed = time.perf_counter() - t0
        logger.info(f"Subtitled video generated in {elapsed:.2f}s → {out_path}")
        return out_path

    finally:
        safe_remove(srt_file)
        safe_remove(temp_video)
