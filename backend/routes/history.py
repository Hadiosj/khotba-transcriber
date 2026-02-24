import json

from fastapi import APIRouter, HTTPException, Depends, Query
from sqlalchemy.orm import Session

from database.db import get_db
from database.crud import get_analyses, get_analysis, delete_analysis
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


@router.delete("/history/{analysis_id}")
async def delete_history_item(analysis_id: str, db: Session = Depends(get_db)):
    deleted = delete_analysis(db, analysis_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Analysis not found")
    logger.info(f"Deleted analysis id={analysis_id}")
    return {"success": True}
