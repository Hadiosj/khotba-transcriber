from typing import Optional
from sqlalchemy.orm import Session
from sqlalchemy import desc

from database.models import Analysis


def create_analysis(
    db: Session,
    youtube_url: str = "",
    video_title: str = "",
    thumbnail_url: Optional[str] = None,
    start_seconds: int = 0,
    end_seconds: int = 0,
    arabic_text: str = "",
    french_text: str = "",
    article_markdown: str = "",
    segments_json: str = "",
    processing_time_seconds: float = 0.0,
    cost_json: Optional[str] = None,
    source_type: str = "youtube",
    upload_id: Optional[str] = None,
    upload_filename: Optional[str] = None,
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
        source_type=source_type,
        upload_id=upload_id,
        upload_filename=upload_filename,
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


def update_analysis(
    db: Session,
    analysis_id: str,
    arabic_text: Optional[str] = None,
    french_text: Optional[str] = None,
    segments_json: Optional[str] = None,
    article_markdown: Optional[str] = None,
) -> Optional[Analysis]:
    record = db.query(Analysis).filter(Analysis.id == analysis_id).first()
    if not record:
        return None
    if arabic_text is not None:
        record.arabic_text = arabic_text
    if french_text is not None:
        record.french_text = french_text
    if segments_json is not None:
        record.segments_json = segments_json
    if article_markdown is not None:
        record.article_markdown = article_markdown
    db.commit()
    db.refresh(record)
    return record


def delete_analysis(db: Session, analysis_id: str) -> bool:
    record = db.query(Analysis).filter(Analysis.id == analysis_id).first()
    if not record:
        return False
    upload_id = record.upload_id
    upload_filename = record.upload_filename
    db.delete(record)
    db.commit()
    # Clean up generated subtitle videos (glob to catch any lang variant)
    import glob as _glob
    import os as _os
    from utils.file_manager import VIDEOS_DIR, UPLOADS_DIR
    for video_file in _glob.glob(_os.path.join(VIDEOS_DIR, f"{analysis_id}_*.mp4")):
        try:
            _os.unlink(video_file)
        except OSError:
            pass
    # Clean up uploaded video file
    if upload_id and upload_filename:
        ext = _os.path.splitext(upload_filename)[1]
        upload_path = _os.path.join(UPLOADS_DIR, f"{upload_id}{ext}")
        try:
            if _os.path.exists(upload_path):
                _os.unlink(upload_path)
        except OSError:
            pass
    return True
