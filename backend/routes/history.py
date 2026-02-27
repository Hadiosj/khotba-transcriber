import glob
import json
import os
from typing import Optional

from fastapi import APIRouter, HTTPException, Depends, Query
from pydantic import BaseModel
from sqlalchemy.orm import Session

from database.db import get_db
from database.crud import get_analyses, get_analysis, delete_analysis, update_analysis
from services.translator import translate_segments
from utils.file_manager import VIDEOS_DIR
from utils.logger import get_logger

logger = get_logger(__name__)

router = APIRouter()


def _parse_total_cost(cost_json: str | None) -> float | None:
    if not cost_json:
        return None
    try:
        return json.loads(cost_json).get("total_cost_usd")
    except Exception:
        return None


def _fmt_seconds(s: int) -> str:
    h = s // 3600
    m = (s % 3600) // 60
    sec = s % 60
    if h:
        return f"{h:02d}:{m:02d}:{sec:02d}"
    return f"{m:02d}:{sec:02d}"


@router.get("/history")
async def list_history(
    page: int = Query(1, ge=1),
    limit: int = Query(10, ge=1, le=100),
    db: Session = Depends(get_db),
):
    items, total = get_analyses(db, page=page, limit=limit)
    return {
        "total": total,
        "page": page,
        "limit": limit,
        "items": [
            {
                "id": r.id,
                "video_title": r.video_title,
                "thumbnail_url": r.thumbnail_url,
                "youtube_url": r.youtube_url,
                "start_seconds": r.start_seconds,
                "end_seconds": r.end_seconds,
                "time_range": f"{_fmt_seconds(r.start_seconds)} – {_fmt_seconds(r.end_seconds)}",
                "created_at": r.created_at.isoformat() if r.created_at else None,
                "status": r.status,
                "has_timestamps": bool(r.segments_json),
                "total_cost_usd": _parse_total_cost(r.cost_json),
            }
            for r in items
        ],
    }


@router.get("/history/{analysis_id}")
async def get_history_item(analysis_id: str, db: Session = Depends(get_db)):
    record = get_analysis(db, analysis_id)
    if not record:
        raise HTTPException(status_code=404, detail="Analysis not found")

    segments = {}
    if record.segments_json:
        try:
            segments = json.loads(record.segments_json)
        except json.JSONDecodeError:
            pass

    costs = None
    if record.cost_json:
        try:
            costs = json.loads(record.cost_json)
        except json.JSONDecodeError:
            pass

    return {
        "id": record.id,
        "created_at": record.created_at.isoformat() if record.created_at else None,
        "youtube_url": record.youtube_url,
        "video_title": record.video_title,
        "thumbnail_url": record.thumbnail_url,
        "start_seconds": record.start_seconds,
        "end_seconds": record.end_seconds,
        "time_range": f"{_fmt_seconds(record.start_seconds)} – {_fmt_seconds(record.end_seconds)}",
        "arabic_text": record.arabic_text,
        "french_text": record.french_text,
        "article_markdown": record.article_markdown,
        "arabic_segments": segments.get("arabic", []),
        "french_segments": segments.get("french", []),
        "status": record.status,
        "processing_time_seconds": record.processing_time_seconds,
        "costs": costs,
    }


class SegmentUpdate(BaseModel):
    start: float
    end: float
    text: str


class UpdateAnalysisRequest(BaseModel):
    arabic_segments: Optional[list[SegmentUpdate]] = None
    french_segments: Optional[list[SegmentUpdate]] = None
    arabic_text: Optional[str] = None
    french_text: Optional[str] = None


def _invalidate_video_cache(analysis_id: str, lang: str = "*"):
    """Delete cached subtitle video files for an analysis."""
    pattern = os.path.join(VIDEOS_DIR, f"{analysis_id}_{lang}.mp4")
    for path in glob.glob(pattern):
        try:
            os.unlink(path)
        except OSError:
            pass


@router.patch("/history/{analysis_id}")
async def update_history_item(
    analysis_id: str, body: UpdateAnalysisRequest, db: Session = Depends(get_db)
):
    record = get_analysis(db, analysis_id)
    if not record:
        raise HTTPException(status_code=404, detail="Analysis not found")

    new_segments_json = None
    new_french_text = None
    new_french_segments = None

    if body.arabic_segments is not None or body.french_segments is not None:
        existing = {}
        if record.segments_json:
            try:
                existing = json.loads(record.segments_json)
            except json.JSONDecodeError:
                pass
        if body.arabic_segments is not None:
            existing["arabic"] = [
                {"start": s.start, "end": s.end, "text": s.text}
                for s in body.arabic_segments
            ]
        if body.french_segments is not None:
            existing["french"] = [
                {"start": s.start, "end": s.end, "text": s.text}
                for s in body.french_segments
            ]
        new_segments_json = json.dumps(existing, ensure_ascii=False)

    # When Arabic segments are updated: retranslate to get new French segments
    if body.arabic_segments is not None:
        try:
            arabic_segs = [
                {"start": s.start, "end": s.end, "text": s.text}
                for s in body.arabic_segments
            ]
            arabic_text = " ".join(s.text for s in body.arabic_segments)
            trans = await translate_segments(
                segments=arabic_segs,
                arabic_text=arabic_text,
                include_timestamps=True,
            )
            new_french_segments = trans["translated_segments"]
            segs = json.loads(new_segments_json)
            segs["french"] = new_french_segments
            new_segments_json = json.dumps(segs, ensure_ascii=False)
        except Exception as e:
            logger.error(f"Retranslation failed: {e}")
            raise HTTPException(status_code=500, detail="Retranslation failed")
        # Invalidate both video caches since content changed
        _invalidate_video_cache(analysis_id)

    # When Arabic full-text is updated (no-timestamps mode): retranslate
    elif body.arabic_text is not None:
        try:
            trans = await translate_segments(
                segments=[],
                arabic_text=body.arabic_text,
                include_timestamps=False,
            )
            new_french_text = trans["french_text"]
        except Exception as e:
            logger.error(f"Retranslation failed: {e}")
            raise HTTPException(status_code=500, detail="Retranslation failed")

    # When French segments/text are updated: invalidate French video cache
    if body.french_segments is not None:
        _invalidate_video_cache(analysis_id, "french")

    updated = update_analysis(
        db,
        analysis_id,
        arabic_text=body.arabic_text,
        french_text=new_french_text if new_french_text is not None else body.french_text,
        segments_json=new_segments_json,
    )
    if not updated:
        raise HTTPException(status_code=404, detail="Analysis not found")

    logger.info(f"Updated analysis id={analysis_id}")
    response: dict = {"success": True}
    if new_french_text is not None:
        response["french_text"] = new_french_text
    if new_french_segments is not None:
        response["french_segments"] = new_french_segments
    return response


@router.delete("/history/{analysis_id}")
async def delete_history_item(analysis_id: str, db: Session = Depends(get_db)):
    deleted = delete_analysis(db, analysis_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Analysis not found")
    logger.info(f"Deleted analysis id={analysis_id}")
    return {"success": True}
