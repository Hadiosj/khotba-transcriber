import json
import os

from fastapi import APIRouter, HTTPException, Depends, Query
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from database.db import get_db
from database.crud import get_analysis
from services.subtitle_burner import burn_subtitles
from utils.file_manager import get_video_path
from utils.logger import get_logger

logger = get_logger(__name__)

router = APIRouter()


@router.post("/subtitle-video/{analysis_id}")
async def generate_subtitled_video(
    analysis_id: str,
    lang: str = Query("arabic", pattern="^(arabic|french)$"),
    db: Session = Depends(get_db),
):
    """Generate (or serve cached) a video with burned-in subtitles.

    Only available when the analysis was done with timestamps enabled.
    The generated video is cached on disk; subsequent requests are served instantly.
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

    out_path = get_video_path(analysis_id, lang)

    if not os.path.exists(out_path):
        logger.info(f"Cache miss — generating subtitled video for {analysis_id} lang={lang}")
        try:
            burn_subtitles(
                youtube_url=record.youtube_url,
                start=record.start_seconds,
                end=record.end_seconds,
                segments=segments,
                analysis_id=analysis_id,
                lang=lang,
            )
        except Exception as exc:
            logger.error(f"Subtitle video generation failed: {exc}")
            raise HTTPException(
                status_code=500,
                detail=f"Video generation failed: {exc}",
            )
    else:
        logger.info(f"Cache hit — serving existing video for {analysis_id} lang={lang}")

    lang_label = "arabe" if lang == "arabic" else "francais"
    filename = f"khotba-{lang_label}-{analysis_id[:8]}.mp4"

    return FileResponse(
        out_path,
        media_type="video/mp4",
        filename=filename,
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )
