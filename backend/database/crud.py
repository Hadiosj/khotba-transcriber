from typing import Optional
from sqlalchemy.orm import Session
from sqlalchemy import desc

from database.models import Analysis


def create_analysis(
    db: Session,
    youtube_url: str,
    video_title: str,
    thumbnail_url: Optional[str],
    start_seconds: int,
    end_seconds: int,
    arabic_text: str,
    french_text: str,
    article_markdown: str,
    segments_json: str,
    processing_time_seconds: float,
    cost_json: Optional[str] = None,
) -> Analysis:
    record = Analysis(
        youtube_url=youtube_url,
        video_title=video_title,
        thumbnail_url=thumbnail_url,
        start_seconds=start_seconds,
        end_seconds=end_seconds,
        arabic_text=arabic_text,
        french_text=french_text,
        article_markdown=article_markdown,
        segments_json=segments_json,
        cost_json=cost_json,
        status="completed",
        processing_time_seconds=processing_time_seconds,
    )
    db.add(record)
    db.commit()
    db.refresh(record)
    return record


def get_analyses(db: Session, page: int = 1, limit: int = 10):
    offset = (page - 1) * limit
    total = db.query(Analysis).count()
    items = (
        db.query(Analysis)
        .order_by(desc(Analysis.created_at))
        .offset(offset)
        .limit(limit)
        .all()
    )
    return items, total


def get_analysis(db: Session, analysis_id: str) -> Optional[Analysis]:
    return db.query(Analysis).filter(Analysis.id == analysis_id).first()


def delete_analysis(db: Session, analysis_id: str) -> bool:
    record = db.query(Analysis).filter(Analysis.id == analysis_id).first()
    if not record:
        return False
    db.delete(record)
    db.commit()
    # Clean up any generated subtitle videos
    from utils.file_manager import get_video_path, safe_remove
    for lang in ("arabic", "french"):
        safe_remove(get_video_path(analysis_id, lang))
    return True
