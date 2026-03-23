import json

from fastapi import APIRouter, BackgroundTasks, HTTPException, Depends, Query
from fastapi.responses import FileResponse, PlainTextResponse
from sqlalchemy.orm import Session

from database.db import get_db
from database.crud import get_analysis
from services.subtitle_burner import burn_subtitles, generate_srt
from utils.file_manager import safe_remove, find_upload_file
from utils.logger import get_logger

logger = get_logger(__name__)

router = APIRouter()


@router.post("/subtitle-video/{analysis_id}")
async def generate_subtitled_video(
    analysis_id: str,
    background_tasks: BackgroundTasks,
    lang: str = Query("arabic", pattern="^(arabic|french)$"),
    text_color: str = Query("white", pattern="^(white|black)$"),
    background: bool = Query(False),
    inline: bool = Query(False),
    db: Session = Depends(get_db),
):
    """Generate a video with burned-in subtitles and serve it.

    The video is generated on demand and deleted after being served — nothing
    is stored on disk between requests.
    Only available when the analysis was done with timestamps enabled.
    Set inline=true to serve for browser preview instead of as a download attachment.
    """
    record = get_analysis(db, analysis_id)
    if not record:
        raise HTTPException(status_code=404, detail="Analysis not found")

    if not record.segments_json:
        raise HTTPException(
            status_code=400,
            detail="No segments available. Re-run the analysis with timestamps enabled.",
        )

    try:
        segments_data = json.loads(record.segments_json)
    except json.JSONDecodeError:
        raise HTTPException(status_code=500, detail="Corrupted segment data in database")

    segments = segments_data.get(lang, [])
    if not segments:
        raise HTTPException(
            status_code=400,
            detail=f"No {lang} segments available for this analysis.",
        )

    logger.info(
        f"Generating subtitled video for {analysis_id} lang={lang} "
        f"text_color={text_color} background={background}"
    )

    video_source_path = ""
    if record.upload_id:
        video_source_path = find_upload_file(record.upload_id) or ""
        if not video_source_path:
            raise HTTPException(
                status_code=404,
                detail="Uploaded video file not found. It may have been deleted.",
            )

    try:
        out_path = burn_subtitles(
            start=record.start_seconds,
            end=record.end_seconds,
            segments=segments,
            analysis_id=analysis_id,
            lang=lang,
            youtube_url=record.youtube_url or "",
            video_source_path=video_source_path,
            text_color=text_color,
            background=background,
        )
    except Exception as exc:
        logger.error(f"Subtitle video generation failed: {exc}")
        raise HTTPException(status_code=500, detail=f"Video generation failed: {exc}")

    lang_label = "arabe" if lang == "arabic" else "francais"
    filename = f"khotba-{lang_label}-{analysis_id[:8]}.mp4"
    disposition = "inline" if inline else f'attachment; filename="{filename}"'

    background_tasks.add_task(safe_remove, out_path)

    return FileResponse(
        out_path,
        media_type="video/mp4",
        filename=filename,
        headers={"Content-Disposition": disposition},
    )


@router.get("/subtitle-srt/{analysis_id}")
async def download_srt(
    analysis_id: str,
    lang: str = Query("arabic", pattern="^(arabic|french)$"),
    db: Session = Depends(get_db),
):
    """Return the subtitle segments as a downloadable SRT file."""
    record = get_analysis(db, analysis_id)
    if not record:
        raise HTTPException(status_code=404, detail="Analysis not found")

    if not record.segments_json:
        raise HTTPException(
            status_code=400,
            detail="No segments available. Re-run the analysis with timestamps enabled.",
        )

    try:
        segments_data = json.loads(record.segments_json)
    except json.JSONDecodeError:
        raise HTTPException(status_code=500, detail="Corrupted segment data in database")

    segments = segments_data.get(lang, [])
    if not segments:
        raise HTTPException(
            status_code=400,
            detail=f"No {lang} segments available for this analysis.",
        )

    srt_content = generate_srt(segments, offset=float(record.start_seconds or 0))
    lang_label = "arabe" if lang == "arabic" else "francais"
    filename = f"khotba-{lang_label}-{analysis_id[:8]}.srt"

    return PlainTextResponse(
        content=srt_content,
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )
